import { encode, decode, APPLICATION_CBOR } from "./cbor.js";
import { log, errLog } from "./log.js";

const normVal = (val) => {
  if (!val || typeof val !== "object") return val;
  if (val instanceof Uint8Array) {
    return Buffer.isBuffer(val) ? val : Buffer.from(val.buffer, val.byteOffset, val.byteLength);
  }
  if (Array.isArray(val)) return val.map(normVal);
  const out = {};
  for (const [k, v] of Object.entries(val)) out[k] = normVal(v);
  return out;
};

export default async (rpc_url, token, namespace, database, sql, params = {}) => {
  const headers = {
      "Content-Type": APPLICATION_CBOR,
      Accept: APPLICATION_CBOR,
      Authorization: "Bearer " + token
    },
    db_name = database || namespace || "",
    start = performance.now();

  if (namespace) headers["Surreal-NS"] = namespace;
  if (database) headers["Surreal-DB"] = database;

  try {
    const res = await fetch(rpc_url, {
        method: "POST",
        headers,
        body: encode({
          id: "q",
          method: "query",
          params: [sql, normVal(params)]
        })
      }),
      data = decode(new Uint8Array(await res.arrayBuffer()));

    if (data.error) throw new Error(data.error.message);

    log(sql, db_name, performance.now() - start);

    return data.result.map((item) => {
      if (item.status === "ERR") throw new Error(item.result);
      return item.result;
    });
  } catch (e) {
    errLog(sql, db_name, performance.now() - start, e);
    throw e;
  }
};
