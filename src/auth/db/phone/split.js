const MATCH_LI = [
  [10, "", 0, 1],
  [11, "12", 1, 1],
  [11, "1", 0, 86],
  [13, "86", 2, 86]
];

export default (account) => {
  if (typeof account !== "string") return [];
  account = account.trim();
  if (!account) return [];

  const li = account.split(/\D+/).filter(Boolean),
    s = li.join("");
  if (!s) return [];

  for (const [len, prefix, offset, country_code] of MATCH_LI) {
    if (s.length === len && s.startsWith(prefix)) {
      return [country_code, +s.slice(offset)];
    }
  }

  if (li.length > 1) {
    return [+li[0], +li.slice(1).join("")];
  }

  return [];
};
