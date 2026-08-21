import b36d from "@3-/b36/b36d.js";
import b36e from "@3-/b36/b36e.js";
import u8eq from "@3-/u8/u8eq.js";
import KV from "../../../db/KV.js";
import { keyVerify } from "./key.js";

const LEN = 9,
  TTL = 86400;

export const verifyNew = async (org_id, mail) => {
  const k = keyVerify(org_id, mail),
    [[, exist], [, ttl]] = await KV.pipeline().getBuffer(k).ttl(k).exec();
  if (exist) {
    const interval = TTL - ttl || 1;
    if (interval >= 59) await KV.expire(k, TTL);
    return [b36e(exist), interval];
  }

  const code = b36e(crypto.getRandomValues(new Uint8Array(LEN)));
  await KV.set(k, b36d(code), "EX", TTL);
  return [code, 0];
};

export default async (org_id, mail, verify_code) => {
  let bin;
  try {
    bin = b36d(verify_code.toLowerCase());
  } catch {
    return false;
  }

  const k = keyVerify(org_id, mail),
    saved = await KV.getBuffer(k);

  if (saved && u8eq(saved, bin)) {
    await KV.del(k);
    return true;
  }
  return false;
};
