import orgDb from "../../db/orgDb.js";
import { describe, test, expect, afterAll, beforeEach } from "bun:test";
import mailId from "../db/mail/id.js";
import mailNew, { MAIL_ID } from "../db/mail/new.js";
import userPasswordVerify from "../db/user/userPasswordVerify.js";
import orgUser from "../db/org/orgUser.js";
import hostOrg from "../db/org/hostOrg.js";
import { OWNER } from "../db/org/LEVEL.js";
import { MAIL_HOST_ID } from "../db/mail/hostNew.js";

import KV from "../../db/KV.js";
import SDB from "../../db/SDB.js";

describe("user 模块测试 (mailId & mailNew & userPasswordVerify)", () => {
  beforeEach(async () => {
    await KV.flushdb();
    MAIL_ID.clear();
    MAIL_HOST_ID.clear();
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");
  });

  afterAll(async () => {
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");
  });

  test("mailId 对未注册的邮箱返回 undefined 且不创建 mail 记录", async () => {
    const uid = await mailId("nonexistent@notexist-mail-user.xyz");
    expect(uid).toBeUndefined();

    const [mail] = await SDB("SELECT VALUE id FROM ONLY mail WHERE prefix='nonexistent'");
    expect(mail).toBeUndefined();
  });

  test("mailNew 创建新用户并返回 id", async () => {
    const uid = await mailNew("Alice@Example.com");
    expect(uid).toBeDefined();

    // 验证 mailId 能通过邮箱获取该用户 id（清空 LRU 测试 KV 读取）
    MAIL_ID.clear();
    const found_uid = await mailId("alice@example.com");
    expect(found_uid).toBeDefined();
    expect(found_uid.toString()).toBe(uid.toString());

    // 验证 mail 记录中的 host 和 prefix
    const [mail] = await SDB("SELECT * FROM ONLY type::record('mail',$uid)", { uid });
    expect(mail).toBeDefined();
    expect(mail.prefix).toBe("alice");
  });

  test("userPasswordVerify 通过 orgUser 验证密码", async () => {
    const uid = await mailNew("pwdtest@example.com"),
      org_id = await hostOrg("pwdtest.com"),
      db = orgDb(org_id);
    await orgUser(db, org_id, uid, OWNER, "PwdTest", { password: "password123" });

    expect(await userPasswordVerify(org_id, uid, "password123")).toBe(true);
    expect(await userPasswordVerify(org_id, uid, "wrongPassword")).toBe(false);

    // 验证 user 中 password 字段
    const [rec] = await db("SELECT password FROM ONLY type::record('user',$uid) LIMIT 1", {
      uid
    });
    expect(rec).toBeDefined();
    expect(rec.password).toBeDefined();
    const u8 = new Uint8Array(rec.password);
    expect(u8.length).toBe(48);
  });

  test("userPasswordVerify 处理无效参数及不存在用户", async () => {
    expect(await userPasswordVerify(undefined, undefined, "pass")).toBe(false);
    expect(await userPasswordVerify(1, "user:nonexistent", "")).toBe(false);
    expect(await userPasswordVerify(1, "user:nonexistent", "pass")).toBe(false);
  });

  test("mailNew 邮箱已存在时返回原 id", async () => {
    const uid1 = await mailNew("bob@example.com"),
      uid2 = await mailNew("BOB@EXAMPLE.COM");
    expect(uid1).toBeDefined();
    expect(uid2.toString()).toBe(uid1.toString());
  });

  test("无效邮箱格式返回 undefined", async () => {
    expect(await mailId("invalidemail")).toBeUndefined();
    expect(await mailNew("invalidemail")).toBeUndefined();
  });
});
