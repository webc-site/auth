import verify from "../db/mail/verify.js";
import mailNew from "../db/mail/new.js";
import UserNewByMailE from "../gen/UserNewByMailE.js";

import { ERR_MAIL_EXIST, ERR_VERIFY_CODE } from "../gen/UserNewByMailErr.js";
import { USER } from "../db/org/LEVEL.js";
import orgUser, { orgUserLevel } from "../db/org/orgUser.js";
import { userBidSet } from "../db/user/bid.js";
import orgDb from "../../db/orgDb.js";

export default async function (mail, name, password, verify_code) {
  const { org_id, bid } = this,
    org = await org_id;

  if (!(await verify(org, mail, verify_code))) {
    return UserNewByMailE([0, ERR_VERIFY_CODE]);
  }

  const uid = await mailNew(mail);

  if (await orgUserLevel(org, uid)) {
    return UserNewByMailE([0, ERR_MAIL_EXIST]);
  }

  await orgUser(orgDb(org), org, uid, USER, name, { password, mail: uid });
  await userBidSet(org, bid, uid);

  return UserNewByMailE([uid]);
}
