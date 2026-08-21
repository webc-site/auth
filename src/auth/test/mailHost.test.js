import { describe, test, expect, afterAll, beforeEach } from "bun:test";
import mailHostId from "../db/mail/host.js";
import mailHostNew, { MAIL_HOST_ID } from "../db/mail/hostNew.js";
import { keyHost } from "../db/mail/key.js";
import KV from "../../db/KV.js";
import SDB from "../../db/SDB.js";

describe("mailHost 模块测试", () => {
  const clean = async () => {
    MAIL_HOST_ID.clear();
    await KV.del(keyHost("example.com"), keyHost("中国.com"));
    await SDB("DELETE mailHost;");
  };

  beforeEach(clean);
  afterAll(clean);

  test("mailHostId 与 mailHostNew 获取与创建域名 ID", async () => {
    expect(await mailHostId("notexist-host.xyz")).toBeUndefined();

    const id1 = await mailHostNew("EXAMPLE.COM"),
      id2 = await mailHostNew("example.com"),
      found_id = await mailHostId("example.com");
    expect(id1).toBeDefined();
    expect(id2.toString()).toBe(id1.toString());
    expect(found_id.toString()).toBe(id1.toString());
  });

  test("mailHostNew punycode 域名自动转码", async () => {
    const id1 = await mailHostNew("XN--FIQS8S.COM"),
      id2 = await mailHostNew("中国.com");
    expect(id1).toBeDefined();
    expect(id2.toString()).toBe(id1.toString());
  });
});
