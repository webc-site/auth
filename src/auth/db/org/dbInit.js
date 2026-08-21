import SDB from "../../../db/SDB.js";
import gen, { BYTES, INT, STRING, rec } from "../../../db/gen.js";

const AREA = "area",
  HOST = "host",
  PREFIX = "prefix",
  MAIL = "mail",
  PHONE = "phone",
  MAIL_HOST = "mailHost",
  TS = "ts",
  INIT_SQL = gen({
    [MAIL_HOST]: {
      field: [[HOST, STRING]],
      unique: HOST
    },
    [MAIL]: {
      field: [
        [HOST, rec(MAIL_HOST)],
        [PREFIX, STRING]
      ],
      unique: [[HOST, PREFIX]]
    },
    [PHONE]: {
      field: [
        [AREA, INT],
        ["num", INT]
      ],
      unique: [[AREA, "num"]]
    },
    user: {
      field: [
        ["level", INT],
        [MAIL, rec(MAIL, 1)],
        ["name", STRING],
        ["password", BYTES + " DEFAULT <bytes> ''"],
        [PHONE, rec(PHONE, 1)],
        [TS, INT]
      ],
      unique: [MAIL, PHONE],
      index: TS
    }
  });

export default async (org_id) => {
  const org = "org" + org_id;
  await SDB("DEFINE DATABASE IF NOT EXISTS " + org + ";USE DB " + org + ";" + INIT_SQL);
};
