import u64Buf from "@3-/intbin/u64Buf.js";
import KV from "./KV.js";
import SDB from "./SDB.js";

export default (sql) => async (k, var_obj) => {
  const [{ id: rec_id }] = await SDB(sql, var_obj),
    id = rec_id.id;
  await KV.set(k, u64Buf(id));
  return id;
};
