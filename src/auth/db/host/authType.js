import { uint32Li as dUint32Li } from "@1-/proto/D.js";
import { uint32Li as eUint32Li } from "@1-/proto/E.js";
import KV from "../../../db/KV.js";
import SDB from "../../../db/SDB.js";
import { keyAuthType } from "./key.js";

const sdbGet = async (host) => {
  const [type_li = []] = await SDB(
    "SELECT VALUE type FROM authType WHERE host.host=$host ORDER BY type ASC",
    { host }
  );
  await KV.set(keyAuthType(host), Buffer.from(eUint32Li(type_li)));
  return type_li;
};

export const authType = async (host) => {
    const bin = await KV.getBuffer(keyAuthType(host));
    if (bin) return dUint32Li(bin);
  },
  authTypeNew = async (host, type) => {
    await SDB(
      "UPSERT ONLY authType SET host=(SELECT VALUE id FROM ONLY host WHERE host=$host),type=$type WHERE host.host=$host AND type=$type",
      { host, type }
    );
    return sdbGet(host);
  },
  authTypeRm = async (host, type) => {
    await SDB(
      "DELETE authType WHERE host=(SELECT VALUE id FROM ONLY host WHERE host=$host) AND type=$type",
      { host, type }
    );
    return sdbGet(host);
  };
