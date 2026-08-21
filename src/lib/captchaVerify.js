import CAPTCHA_URL from "../../conf/CAPTCHA.js";
import { CAPTCHA } from "@1-/protoapi/STATUS.js";

export default (fn) =>
  process.env.NODE_ENV == "test"
    ? fn
    : async function (...args) {
        const captcha = this.req.header("pragma");
        if (captcha) {
          try {
            const res = await fetch(CAPTCHA_URL + "/verify/" + captcha);
            if (res.ok && (await res.text()) === "1") {
              return fn.apply(this, args);
            }
          } catch {}
        }
        throw CAPTCHA;
      };
