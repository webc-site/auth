import { describe, test, expect, afterAll, beforeEach } from "bun:test";
import mailId from "../db/mail/id.js";
import mailNew, { MAIL_ID } from "../db/mail/new.js";
import { MAIL_HOST_ID } from "../db/mail/hostNew.js";
import SDB from "../../db/SDB.js";
import KV from "../../db/KV.js";

describe("mail 模块测试", () => {
  const clean = async () => {
    MAIL_ID.clear();
    MAIL_HOST_ID.clear();
    await KV.flushdb();
    await SDB("DELETE mail; DELETE mailHost;");
  };

  beforeEach(clean);
  afterAll(clean);

  test("mailId 与 mailNew 创建与获取邮箱", async () => {
    expect(await mailId("TestUser@notexist-mail.xyz")).toBeUndefined();

    const id1 = await mailNew("TestUser@Example.COM");
    expect(id1).toBeDefined();

    // mailId 查询已有邮箱（命中 LRU）
    const found_id = await mailId("testuser@example.com");
    expect(found_id.toString()).toBe(id1.toString());

    // 清空 LRU 后，mailId 依然能从 KV 读取
    MAIL_ID.clear();
    const found_from_kv = await mailId("testuser@example.com");
    expect(found_from_kv.toString()).toBe(id1.toString());

    // 再次用相同邮箱（不同大小写）创建，返回同一个 ID
    const id2 = await mailNew("testuser@example.com");
    expect(id2.toString()).toBe(id1.toString());
  });

  test("mailNew punycode 域名解码", async () => {
    const id = await mailNew("Admin@XN--FIQS8S.COM");
    expect(id).toBeDefined();

    // 再次用已解码的中文域名创建，应该关联同一条 host/mail
    const id2 = await mailNew("admin@中国.com");
    expect(id2.toString()).toBe(id.toString());
  });

  test("无效邮箱格式返回 undefined", async () => {
    expect(await mailId("invalidemail")).toBeUndefined();
    expect(await mailNew("invalidemail")).toBeUndefined();
  });
});
