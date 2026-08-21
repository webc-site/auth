import { orgUserLevel } from "../db/org/orgUser.js";
import mailId from "../db/mail/id.js";
import phoneId from "../db/phone/id.js";

import { MAIL, PHONE } from "../gen/AccountType.js";
import InfoE from "../gen/InfoE.js";

export default async function (account) {
  const { org_id } = this,
    org = await org_id,
    is_mail = account.includes("@"),
    type = is_mail ? MAIL : PHONE,
    uid = await (is_mail ? mailId(account) : phoneId(account)),
    exist = Boolean(uid && (await orgUserLevel(org, uid)));

  return InfoE([type, exist]);
}
