import { userBidExit } from "../db/user/bid.js";
import ExitE from "../gen/ExitE.js";

export default async function (uid) {
  const { org_id, bid } = this;
  await userBidExit(await org_id, bid, uid);
  return ExitE([]);
}
