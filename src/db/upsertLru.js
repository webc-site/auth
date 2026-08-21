import Lru from "../lib/Lru.js";
import upsert from "./upsert.js";

export default (sql, limit) => {
  const lru = Lru(limit),
    run = upsert(sql);

  return [
    async (k, var_obj) => {
      let id = lru.get(k);
      if (id) return id;

      id = await run(k, var_obj);
      lru.set(k, id);
      return id;
    },
    lru
  ];
};
