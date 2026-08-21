import u64Buf from "@3-/intbin/u64Buf.js";

const COLON = Buffer.from(":"),
  PREFIX_NAME = Buffer.from("orgUserName:"),
  PREFIX_LEVEL = Buffer.from("orgUserLevel:"),
  PREFIX_PASSWORD = Buffer.from("orgUserPassword:");

export const keyOrg = (prefix, org_id, suffix) =>
    Buffer.concat([prefix, u64Buf(org_id), COLON, suffix]),
  keyHostOrg = (host) => "hostOrg:" + host,
  keyUserName = (org_id, uid_buf) => keyOrg(PREFIX_NAME, org_id, uid_buf),
  keyUserLevel = (org_id, uid_buf) => keyOrg(PREFIX_LEVEL, org_id, uid_buf),
  keyUserPassword = (org_id, uid_buf) => keyOrg(PREFIX_PASSWORD, org_id, uid_buf);
