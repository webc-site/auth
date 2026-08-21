import utf8e from "@3-/utf8/utf8e.js";
import reqIter from "../srv/reqIter.js";
import resChunk from "../srv/resChunk.js";
import { OK, ERR, CAPTCHA } from "@1-/protoapi/STATUS.js";
import { uint32 } from "@1-/proto/E.js";
import { dUint32, uint32 as dUint32Val } from "@1-/proto/D.js";
import app from "../../srv.js";
import BASE64URL from "../../const/BASE64URL.js";

describe("lib/srv 编解码模块测试", () => {
  test("resChunk 编码与 dUint32 解码对应", () => {
    const payload = new Uint8Array([1, 2, 3, 4]),
      chunk = resChunk(123, OK, payload),
      [id, p1] = dUint32(chunk, 0),
      [status, p2] = dUint32(chunk, p1),
      [len, p3] = dUint32(chunk, p2);

    expect(id).toBe(123);
    expect(status).toBe(OK);
    expect(len).toBe(4);
    expect(chunk.subarray(p3)).toEqual(payload);
  });

  test("resChunk 支持错误与验证码状态", () => {
    const chunk_captcha = resChunk(456, CAPTCHA),
      [id1, p1] = dUint32(chunk_captcha, 0),
      [status1, p2] = dUint32(chunk_captcha, p1);

    expect(id1).toBe(456);
    expect(status1).toBe(CAPTCHA);
    expect(p2).toBe(chunk_captcha.length);

    const err_payload = new Uint8Array([5, 6]),
      chunk_err = resChunk(999, ERR, err_payload),
      [id3, r1] = dUint32(chunk_err, 0),
      [status3, r2] = dUint32(chunk_err, r1),
      [len3, r3] = dUint32(chunk_err, r2);

    expect(id3).toBe(999);
    expect(status3).toBe(ERR);
    expect(len3).toBe(2);
    expect(chunk_err.subarray(r3)).toEqual(err_payload);
  });

  test("reqIter 迭代解析多个请求", () => {
    // 构造字段 1 (tag: 1<<3|2=10) 和字段 2 (tag: 2<<3|2=18)
    const mod1 = utf8e("auth\0"),
      mod2 = utf8e("user\0"),
      call1 = new Uint8Array([10, 2, 9, 9]),
      call2 = new Uint8Array([18, 1, 8]),
      h1_id = uint32(1),
      h1_len = uint32(call1.length),
      h2_id = uint32(2),
      h2_len = uint32(call2.length),
      chunk1_len = mod1.length + h1_id.length + h1_len.length + call1.length,
      chunk2_len = mod2.length + h2_id.length + h2_len.length + call2.length,
      body = new Uint8Array(chunk1_len + chunk2_len);

    let offset = 0;
    body.set(mod1, offset);
    offset += mod1.length;
    body.set(h1_id, offset);
    offset += h1_id.length;
    body.set(h1_len, offset);
    offset += h1_len.length;
    body.set(call1, offset);
    offset += call1.length;

    body.set(mod2, offset);
    offset += mod2.length;
    body.set(h2_id, offset);
    offset += h2_id.length;
    body.set(h2_len, offset);
    offset += h2_len.length;
    body.set(call2, offset);

    const items = [...reqIter(body)];
    expect(items.length).toBe(2);

    expect(items[0][0]).toBe(1);
    expect(items[0][1]).toBe("auth");
    expect(items[0][2]).toBe(0); // index 0 (field 1)
    expect(items[0][3]).toEqual(call1);

    expect(items[1][0]).toBe(2);
    expect(items[1][1]).toBe("user");
    expect(items[1][2]).toBe(1); // index 1 (field 2)
    expect(items[1][3]).toEqual(call2);
  });

  test("srv 中间件：无 cookie B 时自动生成并设置变长 cookie B", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: {
        origin: "https://auth.webc.site"
      },
      body: new Uint8Array(0)
    });
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toBeDefined();
    expect(cookie.startsWith("B=")).toBe(true);
    expect(cookie).toContain("Domain=webc.site");
    expect(cookie).toContain("SameSite=None");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Partitioned");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=90000000");

    const b64 = cookie.split(";")[0].slice(2),
      bin = Buffer.from(b64, BASE64URL),
      now = Math.floor(Date.now() / 864e5);
    expect(bin.length).toBe(16 + uint32(now).length);
    expect(dUint32Val(bin.subarray(16))).toBe(now);
  });

  test("srv 中间件：当天合法 cookie B 维持不变且不重复设置", async () => {
    const now = Math.floor(Date.now() / 864e5),
      valid_bid = crypto.getRandomValues(Buffer.alloc(16)),
      bin = Buffer.concat([valid_bid, uint32(now)]),
      b64 = bin.toString(BASE64URL),
      res = await app.request("/", {
        method: "POST",
        headers: {
          cookie: "B=" + b64
        },
        body: new Uint8Array(0)
      });
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toBeNull();
  });

  test("srv 中间件：cookie B 日期超过 1 天时自动续期并保持相同 bid", async () => {
    const past_day = Math.floor(Date.now() / 864e5) - 2,
      valid_bid = crypto.getRandomValues(Buffer.alloc(16)),
      bin = Buffer.concat([valid_bid, uint32(past_day)]),
      b64 = bin.toString(BASE64URL),
      res = await app.request("/", {
        method: "POST",
        headers: {
          cookie: "B=" + b64
        },
        body: new Uint8Array(0)
      });
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toBeDefined();
    expect(cookie.startsWith("B=")).toBe(true);

    const new_b64 = cookie.split(";")[0].slice(2),
      new_bin = Buffer.from(new_b64, BASE64URL),
      now = Math.floor(Date.now() / 864e5);
    expect(new_bin.length).toBe(16 + uint32(now).length);
    expect(new_bin.subarray(0, 16)).toEqual(valid_bid);
    expect(dUint32Val(new_bin.subarray(16))).toBe(now);
  });

  test("srv 中间件：cookie B 长度异样时重新生成并设置", async () => {
    const invalid_b64 = Buffer.from([1, 2, 3]).toString(BASE64URL),
      res = await app.request("/", {
        method: "POST",
        headers: {
          cookie: "B=" + invalid_b64
        },
        body: new Uint8Array(0)
      });
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toBeDefined();
    expect(cookie.startsWith("B=")).toBe(true);

    const new_b64 = cookie.split(";")[0].slice(2),
      new_bin = Buffer.from(new_b64, BASE64URL);
    expect(new_b64).not.toBe(invalid_b64);
    expect(new_bin.length).toBe(16 + uint32(Math.floor(Date.now() / 864e5)).length);
  });

  test("srv CORS：跨域 POST 请求返回对应 Allow-Origin 与 Credentials", async () => {
    const origin = "http://127.0.0.1:8888",
      res = await app.request("/", {
        method: "POST",
        headers: {
          origin
        },
        body: new Uint8Array(0)
      });
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("vary")).toContain("Origin");
  });

  test("srv CORS：OPTIONS 预检请求返回 204 及预检响应头", async () => {
    const origin = "http://127.0.0.1:8888",
      req_headers = "content-type,pragma",
      res = await app.request("/", {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-headers": req_headers
        }
      });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-methods")).toBe("POST,OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe(req_headers);
    expect(res.headers.get("access-control-max-age")).toBe("86400");
  });
});
