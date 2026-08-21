import { describe, test, expect } from "bun:test";
import Lru from "../Lru.js";

describe("Lru 模块测试", () => {
  test("基础 set / get 功能", () => {
    const cache = Lru(3);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  test("容量超限驱逐最久未使用项 (LRU 淘汰)", () => {
    const cache = Lru(2);
    cache.set("a", 1);
    cache.set("b", 2);
    // 访问 a，使其成为最近使用
    cache.get("a");

    // 插入 c，应当淘汰 b
    cache.set("c", 3);

    expect(cache.has("a")).toBeTrue();
    expect(cache.has("b")).toBeFalse();
    expect(cache.has("c")).toBeTrue();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  test("rm 删除与 clear 清空", () => {
    const cache = Lru(3);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.rm("a")).toBeTrue();
    expect(cache.has("a")).toBeFalse();
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has("b")).toBeFalse();
  });
});
