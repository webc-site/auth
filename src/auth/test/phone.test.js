import { describe, test, expect, beforeEach } from "bun:test";
import phoneSplit from "../db/phone/split.js";
import phoneId from "../db/phone/id.js";
import phoneDbNew, { PHONE_ID } from "../db/phone/new.js";

import phoneUserNew from "../db/phone/userNew.js";
import hostOrgCreate from "../db/org/hostOrg.js";
import orgUser from "../db/org/orgUser.js";
import orgDb from "../../db/orgDb.js";
import { OWNER } from "../db/org/LEVEL.js";
import KV from "../../db/KV.js";
import SDB from "../../db/SDB.js";

describe("phone 测试", () => {
  beforeEach(async () => {
    await KV.flushdb();
    PHONE_ID.clear();
    await SDB("DELETE org; DELETE host; DELETE phone;");
  });

  test("phoneSplit 格式解析", () => {
    expect(phoneSplit("")).toEqual([]);
    expect(phoneSplit("abc")).toEqual([]);
    expect(phoneSplit("13800000000")).toEqual([86, 13800000000]);
    expect(phoneSplit("8613800000000")).toEqual([86, 13800000000]);
    expect(phoneSplit("+86 13800000000")).toEqual([86, 13800000000]);
    expect(phoneSplit("+86-13800000000")).toEqual([86, 13800000000]);
    expect(phoneSplit("86 13800000000")).toEqual([86, 13800000000]);
    expect(phoneSplit("+8613800000000")).toEqual([86, 13800000000]);
    expect(phoneSplit("+86 138 0000 0000")).toEqual([86, 13800000000]);
    expect(phoneSplit("+86-138-0000-0000")).toEqual([86, 13800000000]);
    expect(phoneSplit("+1 2025550143")).toEqual([1, 2025550143]);
    expect(phoneSplit("+1 (202) 555-0143")).toEqual([1, 2025550143]);
    expect(phoneSplit("2025550143")).toEqual([1, 2025550143]);
    expect(phoneSplit("202-555-0143")).toEqual([1, 2025550143]);
    expect(phoneSplit("(202) 555-0143")).toEqual([1, 2025550143]);
    expect(phoneSplit("12025550143")).toEqual([1, 2025550143]);
  });

  test("phoneNew 与 phoneId 查找 id", async () => {
    expect(await phoneId("13800000000")).toBeUndefined();
    const [phone_li] = await SDB("SELECT VALUE id FROM phone");
    expect(phone_li).toEqual([]);

    const phone_id = await phoneDbNew("13800000000");
    expect(phone_id).toBeDefined();

    // 清空 LRU 后测试 KV 读取 phoneId
    PHONE_ID.clear();
    expect(await phoneId("+86 13800000000")).toBe(phone_id);

    const uid = await phoneUserNew("+86 13800000000");
    expect(uid).toBeDefined();
    expect(uid).toBe(phone_id);
  });

  test("orgUser 添加手机号用户并复制 phone 记录到组织库", async () => {
    const org_id = await hostOrgCreate("phone-org.com"),
      uid = await phoneUserNew("13912345678"),
      db = orgDb(org_id);

    await orgUser(db, org_id, uid, OWNER, "PhoneOwner", {
      phone: uid
    });

    const [rec] = await db("SELECT *, phone.* FROM ONLY type::record('user',$uid)", { uid });
    expect(rec).toBeDefined();
    expect(rec.phone.id.id).toBe(uid);
    expect(rec.phone.area).toBe(86);
    expect(rec.phone.num).toBe(13912345678n);
  });
});
