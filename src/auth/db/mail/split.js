import hostDecode from "../../../lib/hostDecode.js";

export default (mail) => {
  if (typeof mail !== "string") return [];
  mail = mail.trim();
  const at = mail.lastIndexOf("@");
  if (at <= 0) return [];
  return [mail.slice(0, at).toLowerCase(), hostDecode(mail.slice(at + 1))];
};
