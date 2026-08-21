import kvU64 from "../../../db/kvU64.js";
import { PHONE_ID } from "./new.js";
import { keyPhone } from "./key.js";
import split from "./split.js";

export default async (account) => {
  const [area, num] = split(account);
  if (!area || !num) return;

  const k = keyPhone(area, num);
  let id = PHONE_ID.get(k);
  if (id) return id;

  id = await kvU64(k);
  if (id) PHONE_ID.set(k, id);
  return id;
};
