import { describe, test, expect, afterAll } from "bun:test";
import { authType, authTypeNew, authTypeRm } from "../db/host/authType.js";
import hostOrgCreate, { hostOrg } from "../db/org/hostOrg.js";
import { GOOGLE, GITHUB } from "../gen/AuthType.js";
import SDB from "../../db/SDB.js";
import KV from "../../db/KV.js";
import { keyHostOrg } from "../db/org/key.js";
import { keyAuthType } from "../db/host/key.js";

describe("host 模块测试", () => {
  const hostOrgRm = (host) => KV.del(keyHostOrg(host)),
    authTypeKvRm = (host) => KV.del(keyAuthType(host)),
    HOST_LI = ["non-exist.com", "example.com", "中国.com", "no-oauth.com", "oauth-test.com"],
    rm = () => Promise.all(HOST_LI.flatMap((h) => [hostOrgRm(h), authTypeKvRm(h)]));

  afterAll(async () => {
    await rm();
    await SDB("DELETE host; DELETE org; DELETE authType;");
  });

  test("hostOrg 查询未绑定组织域名的 org 返回 undefined", async () => {
    const org_id = await hostOrg("non-exist.com");
    expect(org_id).toBeUndefined();
  });

  test("hostOrg 查询已绑定的域名返回 org_id", async () => {
    const created_org_id = await hostOrgCreate("example.com"),
      org_id1 = await hostOrg("example.com");
    expect(org_id1).toBeDefined();
    expect(org_id1.toString()).toBe(created_org_id.toString());
  });

  test("hostOrg 中文域名查询", async () => {
    const created_org_id = await hostOrgCreate("中国.com"),
      org_id1 = await hostOrg("中国.com");
    expect(org_id1).toBeDefined();
    expect(org_id1.toString()).toBe(created_org_id.toString());
  });

  test("authType 查询未配置 authType 的 host 返回 undefined", async () => {
    const type_li = await authType("no-oauth.com");
    expect(type_li).toBeUndefined();
  });

  test("authTypeNew / authTypeRm 增删 authType 并同步 SDB 和 KV", async () => {
    await hostOrgCreate("oauth-test.com");

    const li1 = await authTypeNew("oauth-test.com", GOOGLE);
    expect(li1).toEqual([GOOGLE]);

    const li2 = await authTypeNew("oauth-test.com", GITHUB);
    expect(li2).toEqual([GOOGLE, GITHUB]);

    const li3 = await authType("oauth-test.com");
    expect(li3).toEqual([GOOGLE, GITHUB]);

    // 删除单个 type
    const li4 = await authTypeRm("oauth-test.com", GOOGLE);
    expect(li4).toEqual([GITHUB]);

    // 删除剩余 type
    const li5 = await authTypeRm("oauth-test.com", GITHUB);
    expect(li5).toEqual([]);
  });
});
