import captchaVerify from "../../lib/captchaVerify.js";
import mdHtm from "../../lib/mail/mdHtm.js";
import sendMail from "../../lib/sendMail.js";
import split from "@3-/split";
import { verifyNew } from "../db/mail/verify.js";
import { orgUserLevel } from "../db/org/orgUser.js";
import mailId from "../db/mail/id.js";
import SignUpMailE from "../gen/SignUpMailE.js";
import { ERR_MAIL_EXIST, OK } from "../gen/SignUpMailRes.js";

export default captchaVerify(async function (to = "") {
  const { org_id, host, lang } = this,
    org = await org_id,
    uid = await mailId(to);

  if (uid && (await orgUserLevel(org, uid))) {
    return SignUpMailE([ERR_MAIL_EXIST]);
  }

  const [code, interval] = await verifyNew(org, to);

  if (!interval || interval >= 59) {
    const render = (await import(`../i18n/${lang}/signUpMail.js`)).default,
      md = render({ token_str: "**" + code + "**\n" }),
      [head, body] = split(md, "\n"),
      title = host + " - " + head.trim() + " : " + code,
      trim_body = body.trimStart();

    sendMail(host, to, title, trim_body.replaceAll("*", ""), mdHtm(trim_body));
  }

  return SignUpMailE([OK]);
});
