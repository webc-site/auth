import { userBidRm } from "../db/user/bid.js";
import RmE from "../gen/RmE.js";

export default async function (uid) {
  const { org_id, bid } = this;
  await userBidRm(await org_id, bid, uid);
  return RmE([]);
}
