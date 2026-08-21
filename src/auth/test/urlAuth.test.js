import { describe, test, expect, afterAll } from "bun:test";
import urlUserNewByMail from "../url/userNewByMail.js";
import { ERR_MAIL_EXIST, ERR_VERIFY_CODE, OK } from "../gen/UserNewByMailErr.js";

import hostOrg from "../db/org/hostOrg.js";
import mailNew from "../db/mail/new.js";
import orgUser from "../db/org/orgUser.js";

import { USER } from "../db/org/LEVEL.js";
import { verifyNew } from "../db/mail/verify.js";
import { authTypeNew } from "../db/host/authType.js";

import SDB from "../../db/SDB.js";
import utf8e from "@3-/utf8/utf8e.js";
import UserNewByMailD from "../gen/UserNewByMailD.js";
import LangD from "../gen/LangD.js";
import urlLang from "../url/lang.js";
import GetD from "../gen/GetD.js";
import urlGet from "../url/get.js";
import InfoD from "../gen/InfoD.js";
import urlInfo from "../url/info.js";
import ExitD from "../gen/ExitD.js";
import urlExit from "../url/exit.js";
import RmD from "../gen/RmD.js";
import urlRm from "../url/rm.js";
import { MAIL as ACCOUNT_MAIL, PHONE as ACCOUNT_PHONE } from "../gen/AccountType.js";
import { PHONE, GOOGLE, APPLE, MICROSOFT, WECHAT, GITHUB } from "../gen/AuthType.js";
import phoneUserNew from "../db/phone/userNew.js";
import { userBidSet, userBidExit, userBidHas, userBidLi } from "../db/user/bid.js";

import CallE from "../gen/CallE.js";

import { uint32 } from "@1-/proto/E.js";
import { dUint32 } from "@1-/proto/D.js";
import app from "../../srv.js";
import KV from "../../db/KV.js";
import { keyHostOrg } from "../db/org/key.js";
import { keyAuthType } from "../db/host/key.js";
import reqCtx from "../../lib/srv/ctx.js";
import orgDb from "../../db/orgDb.js";

describe("url.js userNewByMail 接口测试", () => {
  const hostOrgRm = (host) => KV.del(keyHostOrg(host)),
    authTypeRm = (host) => KV.del(keyAuthType(host)),
    mockCtx = (origin) =>
      reqCtx({
        req: { header: (k) => (k === "origin" ? origin : null) },
        bid: Buffer.from("0123456789abcdef")
      }),
    HOST_LI = [
      "conf-domain.com",
      "somehost.com",
      "success-domain.com",
      "already-member.com",
      "chunk-domain.com",
      "info-test.com",
      "other-domain.com",
      "exit-test.com"
    ],
    rm = () => Promise.all(HOST_LI.flatMap((h) => [hostOrgRm(h), authTypeRm(h)]));

  afterAll(async () => {
    await rm();
    await SDB(
      "DELETE org; DELETE mail; DELETE phone; DELETE mailHost; DELETE host; DELETE authType;"
    );
  });

  test("找不到 org 抛出 Error", async () => {
    const [code] = await verifyNew("no-org", "user2@no-org.xyz");
    expect(
      urlUserNewByMail.call(
        mockCtx("https://no-org.xyz"),
        "user2@no-org.xyz",
        "User2",
        "pass123",
        code
      )
    ).rejects.toThrow();
  });

  test("验证码错误或不存在返回 ERR_VERIFY_CODE", async () => {
    const org_id = await hostOrg("somehost.com");

    const r1 = await urlUserNewByMail.call(
      mockCtx("https://somehost.com"),
      "some@test.com",
      "Some",
      "pass123",
      "invalidCode"
    );
    const [, err1] = UserNewByMailD(r1);
    expect(err1).toBe(ERR_VERIFY_CODE);

    const [valid_code] = await verifyNew(org_id, "other@test.com");
    const r2 = await urlUserNewByMail.call(
      mockCtx("https://somehost.com"),
      "mismatch@test.com",
      "Mismatch",
      "pass123",
      valid_code
    );
    const [, err2] = UserNewByMailD(r2);
    expect(err2).toBe(ERR_VERIFY_CODE);
  });

  test("用户已在组织中返回 ERR_MAIL_EXIST 错误码", async () => {
    const org_id = await hostOrg("somehost.com"),
      uid = await mailNew("exist@test.com"),
      db = orgDb(org_id);

    await orgUser(db, org_id, uid, USER, "Exist");
    const [code] = await verifyNew(org_id, "exist@test.com");

    const r = await urlUserNewByMail.call(
      mockCtx("https://somehost.com"),
      "exist@test.com",
      "Exist",
      "pass123",
      code
    );
    const [, err] = UserNewByMailD(r);
    expect(err).toBe(ERR_MAIL_EXIST);
  });

  test("完整成功流程：邮箱新注册 + 找到 hostOrg + 关联 orgUser", async () => {
    const org_id = await hostOrg("success-domain.com"),
      [code] = await verifyNew(org_id, "newuser@success-domain.com");

    const r = await urlUserNewByMail.call(
      mockCtx("https://success-domain.com"),
      "newuser@success-domain.com",
      "NewUser",
      "pass123",
      code
    );
    const [uid, err] = UserNewByMailD(r);
    expect(err).toBe(OK);
    expect(uid).toBeDefined();

    const db = orgDb(org_id),
      [rec] = await db("SELECT * FROM ONLY type::record('user',$uid)", { uid });
    expect(rec).toBeDefined();
    expect(rec.level).toBe(USER);
    expect(rec.name).toBe("NewUser");
    expect(rec.mail.id).toBe(uid);

    const [rec_expanded] = await db(
      "SELECT *, mail.*, mail.host.* FROM ONLY type::record('user',$uid)",
      { uid }
    );
    expect(rec_expanded.mail.prefix).toBe("newuser");
    expect(rec_expanded.mail.host.host).toBe("success-domain.com");

    // 验证码被消费，再次使用返回 ERR_VERIFY_CODE
    const r_reuse = await urlUserNewByMail.call(
      mockCtx("https://success-domain.com"),
      "newuser@success-domain.com",
      "NewUser",
      "pass123",
      code
    );
    const [, err_reuse] = UserNewByMailD(r_reuse);
    expect(err_reuse).toBe(ERR_VERIFY_CODE);
  });

  test("org 已有该 user 条件判定", async () => {
    const org_id = await hostOrg("already-member.com"),
      direct_uid = await mailNew("direct@already-member.com"),
      db = orgDb(org_id);

    await orgUser(db, org_id, direct_uid, USER, "DirectUser");

    const [exist] = await db("SELECT VALUE id FROM ONLY type::record('user',$uid)", {
      uid: direct_uid
    });
    expect(exist).toBeDefined();
  });

  test("srv.js 端到端：二进制 body 与 http chunk 响应", async () => {
    const org_id = await hostOrg("chunk-domain.com");

    const [code1] = await verifyNew(org_id, "chunk1@chunk-domain.com"),
      [code2] = await verifyNew(org_id, "chunk2@chunk-domain.com"),
      mod_bin = utf8e("auth\0"),
      call1 = CallE([["chunk1@chunk-domain.com", "Chunk1", "pass123", code1]]),
      call2 = CallE([["chunk2@chunk-domain.com", "Chunk2", "pass123", code2]]),
      h1_id = uint32(101),
      h1_len = uint32(call1.length),
      h2_id = uint32(102),
      h2_len = uint32(call2.length),
      chunk1_len = mod_bin.length + h1_id.length + h1_len.length + call1.length,
      chunk2_len = mod_bin.length + h2_id.length + h2_len.length + call2.length,
      body = new Uint8Array(chunk1_len + chunk2_len);

    let offset = 0;
    body.set(mod_bin, offset);
    offset += mod_bin.length;
    body.set(h1_id, offset);
    offset += h1_id.length;
    body.set(h1_len, offset);
    offset += h1_len.length;
    body.set(call1, offset);
    offset += call1.length;

    body.set(mod_bin, offset);
    offset += mod_bin.length;
    body.set(h2_id, offset);
    offset += h2_id.length;
    body.set(h2_len, offset);
    offset += h2_len.length;
    body.set(call2, offset);

    const res = await app.request("/", {
      method: "POST",
      headers: {
        origin: "https://chunk-domain.com"
      },
      body
    });

    expect(res.status).toBe(200);

    const reader = res.body.getReader(),
      chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const total_len = chunks.reduce((len, arr) => len + arr.length, 0),
      res_body = new Uint8Array(total_len);
    let p = 0;
    for (const chunk of chunks) {
      res_body.set(chunk, p);
      p += chunk.length;
    }

    let pos = 0,
      received_count = 0;
    while (pos < res_body.length) {
      const [id, p1] = dUint32(res_body, pos),
        [status, p2] = dUint32(res_body, p1),
        [len, p3] = dUint32(res_body, p2),
        resp_bin = res_body.subarray(p3, p3 + len),
        [uid, err] = UserNewByMailD(resp_bin);

      expect(status).toBe(OK);
      if (received_count === 0) {
        expect(id).toBe(101);
        expect(err).toBe(OK);
        expect(uid).toBeDefined();
      } else if (received_count === 1) {
        expect(id).toBe(102);
        expect(err).toBe(OK);
        expect(uid).toBeDefined();
      }
      ++received_count;
      pos = p3 + len;
    }

    expect(received_count).toBe(2);
  });

  test("lang 接口返回 [-1]", () => {
    const [lang] = LangD(urlLang());
    expect(lang).toBe(-1);
  });

  test("AuthType 枚举定义测试", () => {
    expect(PHONE).toBe(1);
    expect(GOOGLE).toBe(2);
    expect(APPLE).toBe(3);
    expect(MICROSOFT).toBe(4);
    expect(WECHAT).toBe(5);
    expect(GITHUB).toBe(6);
  });

  test("get 接口无 host 抛出异常", async () => {
    expect(urlGet.call(mockCtx())).rejects.toThrow();
  });

  test("get 接口有 host 且配置了 authType 与 bid 返回对应列表", async () => {
    const org_id = await hostOrg("conf-domain.com");
    await authTypeNew("conf-domain.com", GOOGLE);
    await authTypeNew("conf-domain.com", MICROSOFT);

    const uid1 = await mailNew("exist@conf-domain.com"),
      db = orgDb(org_id);
    await orgUser(db, org_id, uid1, USER, "ExistUser", { password: "pwd123" });

    const uid_phone = await phoneUserNew("13800000001");
    await orgUser(db, org_id, uid_phone, USER, "PhoneUser", { password: "pwd123" });

    const bid = Buffer.from("get_bid_test_123");
    await userBidSet(org_id, bid, uid1);
    await userBidSet(org_id, bid, uid_phone);
    await userBidExit(org_id, bid, uid1);

    const ctx = reqCtx({
      bid,
      req: {
        header: (k) => (k === "origin" ? "https://conf-domain.com" : null)
      }
    });

    const [auth_type_li, user_li] = GetD(await urlGet.call(ctx));
    expect(auth_type_li).toEqual([GOOGLE, MICROSOFT]);
    expect(user_li).toEqual([
      [uid_phone, "PhoneUser", true],
      [uid1, "ExistUser", false]
    ]);
  });

  test("info 接口无对应 host/org 时抛出异常", async () => {
    expect(urlInfo.call(mockCtx("https://no-org-info.xyz"), "test@no-org.xyz")).rejects.toThrow();
  });

  test("info 接口测试：邮箱与手机账号是否存在判断", async () => {
    const org_id = await hostOrg("info-test.com"),
      ctx = mockCtx("https://info-test.com");

    // 1. 邮箱未注册
    const [t1, exist1] = InfoD(await urlInfo.call(ctx, "notexist@info-test.com"));
    expect(t1).toBe(ACCOUNT_MAIL);
    expect(exist1).toBe(false);

    // 2. 邮箱已注册在数据库中，并在该 org 存在
    const uid1 = await mailNew("exist@info-test.com"),
      db = orgDb(org_id);

    await orgUser(db, org_id, uid1, USER, "ExistUser", { password: "pwd123" });

    // 3. 邮箱已存在
    const [t2, exist2] = InfoD(await urlInfo.call(ctx, "exist@info-test.com"));
    expect(t2).toBe(ACCOUNT_MAIL);
    expect(exist2).toBe(true);

    // 4. 手机号未注册
    const [t3, exist3] = InfoD(await urlInfo.call(ctx, "13800000001"));
    expect(t3).toBe(ACCOUNT_PHONE);
    expect(exist3).toBe(false);

    // 5. 在数据库创建手机号记录与 user，并绑定 orgUser
    const uid_phone = await phoneUserNew("13800000001");
    await orgUser(db, org_id, uid_phone, USER, "PhoneUser", { password: "pwd123" });

    // 6. 手机号已存在（测试各种输入格式）
    const [t4, exist4] = InfoD(await urlInfo.call(ctx, "13800000001"));
    expect(t4).toBe(ACCOUNT_PHONE);
    expect(exist4).toBe(true);

    const [t5, exist5] = InfoD(await urlInfo.call(ctx, "+86 13800000001"));
    expect(t5).toBe(ACCOUNT_PHONE);
    expect(exist5).toBe(true);

    const [t6, exist6] = InfoD(await urlInfo.call(ctx, "+86-13800000001"));
    expect(t6).toBe(ACCOUNT_PHONE);
    expect(exist6).toBe(true);

    // 7. 用户存在于其他 org 但未加入当前 org
    const other_org_id = await hostOrg("other-domain.com"),
      other_uid = await phoneUserNew("13900000002"),
      other_db = orgDb(other_org_id);
    await orgUser(other_db, other_org_id, other_uid, USER, "OtherUser", { password: "pwd123" });

    // 在 info-test.com 下查询 13900000002 应该为 false（未在该 org 存在）
    const [t7, exist7] = InfoD(await urlInfo.call(ctx, "13900000002"));
    expect(t7).toBe(ACCOUNT_PHONE);
    expect(exist7).toBe(false);
  });

  test("exit 接口调用 userBidExit 将分数置为 -1", async () => {
    const org_id = await hostOrg("exit-test.com"),
      bid = Buffer.from("exit_bid_test_1"),
      ctx = reqCtx({
        bid,
        req: {
          header: (k) => (k === "origin" ? "https://exit-test.com" : null)
        }
      }),
      uid = 99991;

    await userBidSet(org_id, bid, uid);
    expect(await userBidHas(org_id, bid, uid)).toBe(true);

    const res = await urlExit.call(ctx, uid),
      decoded = ExitD(res);
    expect(decoded).toEqual([]);
    expect(await userBidHas(org_id, bid, uid)).toBe(false);
    expect(await userBidLi(org_id, bid)).toEqual([[uid, false]]);
  });

  test("rm 接口调用 userBidRm 移除 bid 下的用户绑定", async () => {
    const org_id = await hostOrg("exit-test.com"),
      bid = Buffer.from("exit_bid_test_1"),
      ctx = reqCtx({
        bid,
        req: {
          header: (k) => (k === "origin" ? "https://exit-test.com" : null)
        }
      }),
      uid = 99991;

    const res = await urlRm.call(ctx, uid),
      decoded = RmD(res);
    expect(decoded).toEqual([]);
    expect(await userBidHas(org_id, bid, uid)).toBe(false);
    expect(await userBidLi(org_id, bid)).toEqual([]);
  });
});
