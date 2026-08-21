import int from "@3-/int";
import sec from "@3-/time/sec.js";
import KV from "../../../db/KV.js";
import { keyBid } from "./key.js";

export const userBidSet = (org_id, bid, user_id) => KV.zadd(keyBid(org_id, bid), sec(), user_id),
  userBidExit = (org_id, bid, user_id) => KV.zadd(keyBid(org_id, bid), -1, user_id),
  userBidLi = async (org_id, bid) => {
    const li = await KV.zrevrange(keyBid(org_id, bid), 0, -1, "WITHSCORES"),
      r_li = [];
    for (let i = 0; i < li.length; i += 2) {
      r_li.push([int(li[i]), li[i + 1] > 0]);
    }
    return r_li;
  },
  userBidHas = async (org_id, bid, user_id) => (await KV.zscore(keyBid(org_id, bid), user_id)) > 0,
  userBidRm = (org_id, bid, user_id) => KV.zrem(keyBid(org_id, bid), user_id),
  userBidReset = (org_id, bid) => KV.del(keyBid(org_id, bid));
