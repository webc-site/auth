import upsertLru from "../../../db/upsertLru.js";
import { keyPhone } from "./key.js";
import split from "./split.js";

const [run, PHONE_ID] = upsertLru(
  "UPSERT ONLY phone SET area=$area,num=$num WHERE area=$area AND num=$num"
);

export { PHONE_ID };

export default (account) => {
  const [area, num] = split(account);
  if (!area || !num) return;

  return run(keyPhone(area, num), { area, num });
};
