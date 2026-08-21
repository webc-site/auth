import { describe, test, expect } from "bun:test";
import cookieStr from "../srv/cookie_str.js";

describe("cookieStr 模块测试", () => {
  test("基础 Cookie 字符串生成", () => {
    const res = cookieStr("example.com", "token", "123");
    expect(res).toBe(
      "token=123;Path=/;Domain=example.com;SameSite=None;Secure;Partitioned;HttpOnly"
    );
  });

  test("指定 max_age 与 is_http_only", () => {
    const res = cookieStr("example.com", "B", "abc", 34560000, false);
    expect(res).toBe(
      "B=abc;Path=/;Domain=example.com;SameSite=None;Secure;Partitioned;Max-Age=34560000"
    );
  });

  test("生产环境启用 HttpOnly", () => {
    const res = cookieStr("example.com", "B", "abc", 34560000, true);
    expect(res).toBe(
      "B=abc;Path=/;Domain=example.com;SameSite=None;Secure;Partitioned;Max-Age=34560000;HttpOnly"
    );
  });
});
