import u64Buf from "@3-/intbin/u64Buf.js";
import sec from "@3-/time/sec.js";
import KV from "../../../db/KV.js";
import SDB from "../../../db/SDB.js";
import kvU64 from "../../../db/kvU64.js";
import { passwordHash } from "../user/password.js";
import { keyUserLevel, keyUserName, keyUserPassword } from "./key.js";

export const orgUserName = (org_id, user_id) => KV.get(keyUserName(org_id, u64Buf(user_id))),
  orgUserNameLi = (org_id, user_id_li) =>
    user_id_li.length ? KV.mget(user_id_li.map((uid) => keyUserName(org_id, u64Buf(uid)))) : [],
  orgUserLevel = (org_id, user_id) => kvU64(keyUserLevel(org_id, u64Buf(user_id))),
  orgUserPassword = (org_id, user_id) => KV.getBuffer(keyUserPassword(org_id, u64Buf(user_id)));

const mailCopy = async (db, id) => {
  const [m] = await SDB(
    "SELECT prefix, host.id.id AS host_id, host.host AS host FROM ONLY type::record('mail',$id)",
    { id }
  );
  if (m) {
    await db(
      "UPSERT ONLY type::record('mailHost',$host_id) SET host=$host;UPSERT ONLY type::record('mail',$id) SET host=type::record('mailHost',$host_id),prefix=$prefix",
      {
        host_id: m.host_id,
        host: m.host,
        id,
        prefix: m.prefix
      }
    );
  }
};

const phoneCopy = async (db, id) => {
  const [p] = await SDB("SELECT area, num FROM ONLY type::record('phone',$id)", { id });
  if (p) {
    await db("UPSERT ONLY type::record('phone',$id) SET area=$area,num=$num", {
      id,
      area: p.area,
      num: p.num
    });
  }
};

export default async (db, org_id, user_id, level, name, conf = {}) => {
  const [exist] = await db("SELECT VALUE id FROM ONLY type::record('user',$user_id)", {
    user_id
  });

  if (exist) return;

  const { password, mail, phone } = conf;

  if (mail) await mailCopy(db, mail);
  if (phone) await phoneCopy(db, phone);

  const uid_buf = u64Buf(user_id),
    password_hash = password ? await passwordHash(password) : new Uint8Array(),
    sql =
      "CREATE ONLY type::record('user',$user_id) SET level=$level,ts=$ts,name=$name,password=$password_hash,mail=IF $mail { type::record('mail', $mail) } ELSE { NULL },phone=IF $phone { type::record('phone', $phone) } ELSE { NULL }",
    ts = sec(),
    [{ id }] = await db(sql, {
      user_id,
      level,
      ts,
      name,
      password_hash,
      mail: mail || null,
      phone: phone || null
    });

  await KV.mset(
    keyUserName(org_id, uid_buf),
    name,
    keyUserLevel(org_id, uid_buf),
    u64Buf(level),
    keyUserPassword(org_id, uid_buf),
    password_hash
  );

  return id.id;
};
