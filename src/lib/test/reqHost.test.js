import { describe, test, expect } from "bun:test";
import host from "../ctx/host.js";

describe("ctx/host 模块测试", () => {
  test("从请求上下文对象 (this/ctx) 提取域名 host", () => {
    const ctx = {
      req: { header: (k) => (k === "origin" ? "https://success-domain.com" : null) }
    };
    expect(host(ctx)).toBe("success-domain.com");
  });

  test("无 origin 请求头返回 undefined", () => {
    const ctx = { req: { header: () => null } };
    expect(host(ctx)).toBeUndefined();
  });

  test("支持 Punycode / Unicode 域名", () => {
    const ctx = { req: { header: (k) => (k === "origin" ? "https://测试.中国" : null) } };
    expect(host(ctx)).toBe("测试.中国");
  });

  test("提取多级子域名的根域名", () => {
    const ctx = { req: { header: (k) => (k === "origin" ? "https://a.b.webc.site" : null) } };
    expect(host(ctx)).toBe("webc.site");
  });

  test("本地与 IP 地址直接返回", () => {
    expect(
      host({ req: { header: (k) => (k === "origin" ? "http://127.0.0.1:3000" : null) } })
    ).toBe("127.0.0.1");
    expect(
      host({ req: { header: (k) => (k === "origin" ? "http://localhost:8080" : null) } })
    ).toBe("localhost");
  });
});
