import u64B64 from "@3-/intbin/u64B64.js";

export const keyHost = (host) => "mailHost:" + host,
  keyMail = (host_id, prefix) => "mail:" + u64B64(host_id) + ":" + prefix,
  keyVerify = (org_id, mail) => "mailVerifyCode:" + u64B64(org_id) + ":" + mail;
