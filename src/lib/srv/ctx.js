import host from "../ctx/host.js";
import lang from "../ctx/lang.js";
import org_db from "../ctx/org_db.js";
import org_id from "../ctx/org_id.js";

const GET = {
  host,
  lang,
  org_db,
  org_id
};

export default (c) => {
  const cache = {},
    ctx = new Proxy(c, {
      get(target, prop) {
        const get = GET[prop];
        if (get) {
          return cache[prop] || (cache[prop] = get(ctx));
        }
        return Reflect.get(target, prop, target);
      }
    });
  return ctx;
};
