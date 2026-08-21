import { describe, test, expect, afterAll } from "bun:test";
import mdHtm from "../../lib/mail/mdHtm.js";
import hostOrg from "../db/org/hostOrg.js";
import urlSignUpMail from "../url/signUpMail.js";
import SignUpMailD from "../gen/SignUpMailD.js";
import { ERR_MAIL_EXIST, OK } from "../gen/SignUpMailRes.js";
import mailNew from "../db/mail/new.js";
import orgUser from "../db/org/orgUser.js";
import orgDb from "../../db/orgDb.js";

import { USER } from "../db/org/LEVEL.js";
import SDB from "../../db/SDB.js";
import KV from "../../db/KV.js";
import b36e from "@3-/b36/b36e.js";
import { keyVerify } from "../db/mail/key.js";
import reqCtx from "../../lib/srv/ctx.js";

describe("signUpMail 邮件发送与样式测试", () => {
  const mockCtx = (origin, lang = "zh") =>
    reqCtx({
      req: {
        header: (k) => (k === "origin" ? origin : k === "accept-language" ? lang : null)
      }
    });

  afterAll(async () => {
    await KV.flushdb();
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");
  });

  test("mdHtm 转换 Markdown 为带有内联 CSS 的 HTML", () => {
    const md = "正文 **12345678** 结束",
      html = mdHtm(md);

    expect(html).toContain("<b style=");
    expect(html).toContain("letter-spacing:2px");
    expect(html).not.toContain("<strong>");
    expect(html).toContain(">12345678</b>");
  });

  test("mdHtm 渲染邮件正文结构", () => {
    const code = "87654321",
      md =
        "您的邮件验证码是：\n\n**" +
        code +
        "**\n\n验证码二十四小时内有效。\n\n如果您没有申请注册，请忽略此邮件。",
      html = mdHtm(md);

    expect(html).toContain("您的邮件验证码是：");
    expect(html).toContain(code);
    expect(html).toContain("<b style=");
  });

  test("无对应组织时抛出异常", async () => {
    expect(
      urlSignUpMail.call(mockCtx("https://no-org-mail.xyz"), "user@test.com")
    ).rejects.toThrow();
  });

  test("用户已在当前 org 注册时返回 ERR_MAIL_EXIST，但在其他 org 注册不影响", async () => {
    const org_id = await hostOrg("org-a.com"),
      ctx_a = mockCtx("https://org-a.com"),
      ctx_b = mockCtx("https://org-b.com");

    await hostOrg("org-b.com");
    const uid = await mailNew("multiorg@test.com");

    let mail_count = 0;
    const original_fetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      if (url === "https://mail.webc.pub/send") {
        ++mail_count;
        return new Response("ok", { status: 200 });
      }
      return original_fetch(url, options);
    };

    try {
      // 1. 全局用户存在，但未加入 org-a -> 允许发送邮件，返回 OK (0)
      const res1_bin = await urlSignUpMail.call(ctx_a, "multiorg@test.com");
      const [res1] = SignUpMailD(res1_bin);
      expect(res1).toBe(OK);
      expect(mail_count).toBe(1);

      // 2. 加入 org-a 成为 orgUser -> 再次请求返回 ERR_MAIL_EXIST (1)，不发送邮件
      const db_a = orgDb(org_id);
      await orgUser(db_a, org_id, uid, USER, "MemberA", { password: "pwd123" });
      const res2_bin = await urlSignUpMail.call(ctx_a, "multiorg@test.com");
      const [res2] = SignUpMailD(res2_bin);
      expect(res2).toBe(ERR_MAIL_EXIST);
      expect(mail_count).toBe(1);

      // 3. 用户在 org-a 中，但申请注册 org-b -> 允许发送邮件，返回 OK (0)
      const res3_bin = await urlSignUpMail.call(ctx_b, "multiorg@test.com");
      const [res3] = SignUpMailD(res3_bin);
      expect(res3).toBe(OK);
      expect(mail_count).toBe(2);
    } finally {
      globalThis.fetch = original_fetch;
    }
  });

  test("成功发送注册邮件并验证发送参数", async () => {
    const org_id = await hostOrg("signup-mail-domain.com");

    const original_fetch = globalThis.fetch;
    let sent_payload;

    let send_count = 0;
    globalThis.fetch = async (url, options) => {
      if (url === "https://mail.webc.pub/send") {
        ++send_count;
        sent_payload = JSON.parse(options.body);
        return new Response("ok", { status: 200 });
      }
      return original_fetch(url, options);
    };

    try {
      const res_bin = await urlSignUpMail.call(
        mockCtx("https://signup-mail-domain.com", "zh"),
        "testuser@example.com"
      );
      const [res] = SignUpMailD(res_bin);
      expect(res).toBe(OK);
      expect(send_count).toBe(1);

      expect(sent_payload).toBeDefined();
      const [, , sender_name, to, title, txt, html] = sent_payload;

      expect(sender_name).toBe("signup-mail-domain.com");
      expect(to).toBe("testuser@example.com");
      const code_match = txt.match(/您的邮件验证码是：\s+([0-9a-z]+)/);
      expect(code_match).not.toBeNull();
      const code = code_match[1];

      expect(title).toBe("signup-mail-domain.com - 验证码 : " + code);
      expect(txt).toContain("您的邮件验证码是：");
      expect(txt).toContain("验证码二十四小时内有效。");
      expect(html).toContain("<b style=");

      const key = keyVerify(org_id, "testuser@example.com"),
        saved = await KV.getBuffer(key);

      expect(saved.length).toBeGreaterThanOrEqual(7);
      expect(saved.length).toBeLessThanOrEqual(9);
      expect(b36e(saved)).toBe(code);

      // 59秒内立即再次请求发送，应复用验证码且忽略重发邮件
      const res2_bin = await urlSignUpMail.call(
        mockCtx("https://signup-mail-domain.com", "en"),
        "testuser@example.com"
      );
      const [res2] = SignUpMailD(res2_bin);
      expect(res2).toBe(OK);
      expect(send_count).toBe(1);

      // 模拟超过 59 秒（设置剩余 TTL <= 86400 - 59）
      await KV.expire(key, 86400 - 60);

      const res3_bin = await urlSignUpMail.call(
        mockCtx("https://signup-mail-domain.com", "en"),
        "testuser@example.com"
      );
      const [res3] = SignUpMailD(res3_bin);
      expect(res3).toBe(OK);
      expect(send_count).toBe(2);
      expect(sent_payload[4]).toBe("signup-mail-domain.com - Verification code : " + code);
      expect(sent_payload[5]).toContain(code);

      const new_ttl = await KV.ttl(key);
      expect(new_ttl).toBeGreaterThan(86400 - 5);
    } finally {
      globalThis.fetch = original_fetch;
    }
  });
});
