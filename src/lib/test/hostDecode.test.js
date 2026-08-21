import { describe, test, expect } from "bun:test";
import hostDecode from "../hostDecode.js";

describe("hostDecode 模块测试", () => {
  test("转为小写并去除两端空格", () => {
    expect(hostDecode("  EXAMPLE.COM  ")).toBe("example.com");
  });

  test("Punycode 自动解码为 Unicode", () => {
    expect(hostDecode("XN--FIQS8S.COM")).toBe("中国.com");
  });
});
