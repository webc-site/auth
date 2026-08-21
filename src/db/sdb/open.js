import signin from "./signin.js";
import query from "./query.js";

export default async (url, username, password, namespace) => {
  const rpc_url = url.endsWith("/rpc") ? url : url.replace(/\/+$/, "") + "/rpc",
    token = await signin(rpc_url, username, password, username === "root" ? undefined : namespace);

  return (database) => (sql, params) => query(rpc_url, token, namespace, database, sql, params);
};
