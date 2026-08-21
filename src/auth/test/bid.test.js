import { describe, test, expect, afterAll } from "bun:test";
import KV from "../../db/KV.js";
import hostOrg from "../db/org/hostOrg.js";
import {
  userBidSet,
  userBidExit,
  userBidLi,
  userBidHas,
  userBidRm,
  userBidReset
} from "../db/user/bid.js";
import { verifyNew } from "../db/mail/verify.js";
import urlUserNewByMail from "../url/userNewByMail.js";

import UserNewByMailD from "../gen/UserNewByMailD.js";
import SDB from "../../db/SDB.js";
import reqCtx from "../../lib/srv/ctx.js";

describe("user/bid.js ZSET 绑定与查询测试", () => {
  afterAll(async () => {
    await KV.flushdb();
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");
  });

  test("zset 绑定用户并按最新时间倒序返回 [id, is_login] 列表", async () => {
    const org_id = 1,
      bid = Buffer.from("bid_test_1_12345");

    await userBidSet(org_id, bid, 101);
    await userBidSet(org_id, bid, 102);

    const li = await userBidLi(org_id, bid);
    expect(li).toEqual([
      [102, true],
      [101, true]
    ]);
  });

  test("userBidExit 退出登录将分数置为 -1，is_login 为 false，userBidHas 为 false", async () => {
    const org_id = 1,
      bid = Buffer.from("bid_test_1_12345");

    expect(await userBidHas(org_id, bid, 102)).toBe(true);
    await userBidExit(org_id, bid, 102);
    const li = await userBidLi(org_id, bid);
    expect(li).toEqual([
      [101, true],
      [102, false]
    ]);
    expect(await userBidHas(org_id, bid, 102)).toBe(false);
  });

  test("支持 Buffer 类型的 bid", async () => {
    const org_id = 2,
      bid_buf = Buffer.from("1234567890abcdef");

    await userBidSet(org_id, bid_buf, 201);
    const li = await userBidLi(org_id, bid_buf);
    expect(li).toEqual([[201, true]]);
  });

  test("存在判定、删除单用户与重置操作", async () => {
    const org_id = 3,
      bid = Buffer.from("bid_test_3_has_rm");

    expect(await userBidHas(org_id, bid, 301)).toBe(false);

    await userBidSet(org_id, bid, 301);
    await userBidSet(org_id, bid, 302);

    expect(await userBidHas(org_id, bid, 301)).toBe(true);
    expect(await userBidHas(org_id, bid, 302)).toBe(true);
    expect(await userBidHas(org_id, bid, 303)).toBe(false);

    await userBidRm(org_id, bid, 301);
    expect(await userBidHas(org_id, bid, 301)).toBe(false);
    expect(await userBidHas(org_id, bid, 302)).toBe(true);
    expect(await userBidLi(org_id, bid)).toEqual([[302, true]]);

    await userBidReset(org_id, bid);
    expect(await userBidHas(org_id, bid, 302)).toBe(false);
    expect(await userBidLi(org_id, bid)).toEqual([]);
  });

  test("urlUserNewByMail 调用时自动绑定 this.bid", async () => {
    const org_id = await hostOrg("bid-mail-domain.com"),
      bid = Buffer.from("test_bid_buffer_"),
      [code] = await verifyNew(org_id, "biduser@bid-mail-domain.com"),
      ctx = reqCtx({
        bid,
        req: {
          header: (k) => (k === "origin" ? "https://bid-mail-domain.com" : null)
        }
      });

    const res = await urlUserNewByMail.call(
      ctx,
      "biduser@bid-mail-domain.com",
      "BidUser",
      "password123",
      code
    );
    const [uid] = UserNewByMailD(res);
    expect(uid).toBeDefined();

    const li = await userBidLi(org_id, bid);
    expect(li.map(([id]) => id)).toContain(uid);
  });
});
