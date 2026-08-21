import { describe, expect, test } from "bun:test";
import lang from "../ctx/lang.js";

describe("ctx/lang 测试", () => {
  const ctx = (acceptLanguage) => ({
    req: {
      header: () => acceptLanguage
    }
  });

  test("无 header 或未知语言默认返回 en", () => {
    expect(lang(ctx(null))).toBe("en");
    expect(lang(ctx(""))).toBe("en");
    expect(lang(ctx("unknown-lang"))).toBe("en");
  });

  test("精确匹配语言代码", () => {
    expect(lang(ctx("zh"))).toBe("zh");
    expect(lang(ctx("ja"))).toBe("ja");
    expect(lang(ctx("zh-TW"))).toBe("zh-TW");
    expect(lang(ctx("en"))).toBe("en");
  });

  test("复合 Accept-Language 头匹配", () => {
    expect(lang(ctx("zh-CN,zh;q=0.9,en;q=0.8"))).toBe("zh");
    expect(lang(ctx("ja-JP,ja;q=0.9"))).toBe("ja");
    expect(lang(ctx("zh-TW,zh;q=0.9"))).toBe("zh-TW");
  });
});
