import { describe, test, expect } from "bun:test";
import { passwordHash, passwordVerify } from "../db/user/password.js";

describe("password 模块测试 (passwordHash & passwordVerify)", () => {
  test("passwordHash 生成 48 字节 Buffer", async () => {
    const hash = await passwordHash("mySecurePassword123");
    expect(Buffer.isBuffer(hash)).toBe(true);
    expect(hash.length).toBe(48);
  });

  test("passwordVerify 密码正确返回 true", async () => {
    const password = "correctPassword!@#",
      hash = await passwordHash(password),
      isValid = await passwordVerify(password, hash);
    expect(isValid).toBe(true);
  });

  test("passwordVerify 密码错误返回 false", async () => {
    const hash = await passwordHash("correctPassword"),
      isValid = await passwordVerify("wrongPassword", hash);
    expect(isValid).toBe(false);
  });

  test("多次 passwordHash 生成随机 salt,均可正常 verify", async () => {
    const pwd = "samePassword",
      hash1 = await passwordHash(pwd),
      hash2 = await passwordHash(pwd);

    expect(hash1.equals(hash2)).toBe(false);

    expect(await passwordVerify(pwd, hash1)).toBe(true);
    expect(await passwordVerify(pwd, hash2)).toBe(true);
  });

  test("passwordVerify 支持数据库返回的 ArrayBuffer 类型", async () => {
    const pwd = "dbPassword",
      hash = await passwordHash(pwd),
      // 模拟 SurrealDB 查询返回的 ArrayBuffer 数据类型
      arrayBuffer = hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    expect(await passwordVerify(pwd, arrayBuffer)).toBe(true);
  });

  test("无效或错误格式输入返回 false", async () => {
    const hash = await passwordHash("validPwd");
    expect(await passwordVerify("", hash)).toBe(false);
    expect(await passwordVerify("validPwd", null)).toBe(false);
    expect(await passwordVerify("validPwd", Buffer.alloc(10))).toBe(false);
  });
});
