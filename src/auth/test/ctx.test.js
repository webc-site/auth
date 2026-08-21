import { describe, test, expect, afterAll } from "bun:test";
import reqCtx from "../../lib/srv/ctx.js";
import hostOrgCreate, { hostOrg } from "../db/org/hostOrg.js";
import KV from "../../db/KV.js";
import SDB from "../../db/SDB.js";
import { keyHostOrg } from "../db/org/key.js";

describe("lib/srv/ctx.js Proxy 与 org_id/host/lang getter 测试", () => {
  const HOST = "ctx-test-domain.com",
    hostOrgRm = (host) => KV.del(keyHostOrg(host));

  afterAll(async () => {
    await hostOrgRm(HOST);
    await SDB("DELETE host; DELETE org;");
  });

  test("org_id / host / lang / org_db getter 正常获取", async () => {
    const org_id = await hostOrgCreate(HOST),
      raw_c = {
        req: {
          header: (k) => {
            if (k === "origin") return "https://" + HOST;
            if (k === "accept-language") return "zh-CN,zh;q=0.9";
            return null;
          }
        },
        bid: Buffer.from("0123456789abcdef"),
        custom_val: 123
      },
      ctx = reqCtx(raw_c);

    expect(ctx.custom_val).toBe(123);
    expect(ctx.bid).toBe(raw_c.bid);
    expect(ctx.host).toBe(HOST);
    expect(ctx.lang).toBe("zh");

    const { org_id: p_org_id, org_db: p_db } = ctx;
    expect(p_org_id instanceof Promise).toBe(true);
    expect(await p_org_id).toBe(org_id);

    expect(p_db instanceof Promise).toBe(true);
    const db = await p_db;
    expect(typeof db).toBe("function");
    const [res] = await db("SELECT * FROM user;");
    expect(Array.isArray(res)).toBe(true);
  });

  test("并发多次访问 org_id / org_db 返回同一 Promise 实例，避免重复获取", async () => {
    const org_id = await hostOrg(HOST),
      raw_c = {
        req: {
          header: (k) => (k === "origin" ? "https://" + HOST : null)
        }
      },
      ctx = reqCtx(raw_c),
      p1 = ctx.org_id,
      p2 = ctx.org_id,
      p3 = ctx.org_id,
      pdb1 = ctx.org_db,
      pdb2 = ctx.org_db;

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    expect(pdb1).toBe(pdb2);

    const [v1, v2, v3, db1, db2] = await Promise.all([p1, p2, p3, pdb1, pdb2]);
    expect(v1).toBe(org_id);
    expect(v2).toBe(org_id);
    expect(v3).toBe(org_id);
    expect(db1).toBe(db2);
  });

  test("未绑定组织域名时 org_id Promise 抛出异常", async () => {
    const raw_c = {
        req: {
          header: (k) => (k === "origin" ? "https://nonexistent-org.xyz" : null)
        }
      },
      ctx = reqCtx(raw_c);

    expect(ctx.org_id).rejects.toThrow("No Org nonexistent-org.xyz");
  });
});
