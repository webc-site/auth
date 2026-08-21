import { describe, test, expect, afterAll, beforeEach } from "bun:test";
import upsert from "../../db/upsert.js";
import upsertLru from "../../db/upsertLru.js";

import KV from "../../db/KV.js";
import kvU64 from "../../db/kvU64.js";
import SDB from "../../db/SDB.js";

describe("db/upsert.js 模块测试", () => {
  const clean = async () => {
    await KV.del("mailHost:upsert-test.com", "mailHost:upsert-lru-test.com");
    await SDB("DELETE mailHost;");
  };

  beforeEach(clean);
  afterAll(clean);

  test("upsert 无 LRU 写入 SDB 并同步 KV", async () => {
    const run = upsert("UPSERT ONLY mailHost SET host=$host WHERE host=$host"),
      k = "mailHost:upsert-test.com",
      id = await run(k, { host: "upsert-test.com" });

    expect(id).toBeDefined();
    expect(await kvU64(k)).toBe(id);
  });

  test("upsertLru 有 LRU 写入 SDB、KV 与闭包创建的 LRU", async () => {
    const [run, lru] = upsertLru("UPSERT ONLY mailHost SET host=$host WHERE host=$host"),
      k = "mailHost:upsert-lru-test.com",
      id1 = await run(k, { host: "upsert-lru-test.com" });

    expect(id1).toBeDefined();
    expect(lru.get(k)).toBe(id1);
    expect(await kvU64(k)).toBe(id1);

    // 命中 LRU 时直接返回
    const id2 = await run(k, { host: "upsert-lru-test.com" });
    expect(id2).toBe(id1);
  });
});
