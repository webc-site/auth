import ERR from "@3-/log/ERR.js";
import sendMail from "../../conf/MAIL.js";

export default async (host, to, title, txt, html) => {
  for (let i = 0; i < 3; ++i) {
    try {
      return await sendMail(host, to, title, txt, html);
    } catch (err) {
      ERR(to, err);
    }
  }
};
