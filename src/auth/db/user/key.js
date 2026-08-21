import { keyOrg } from "../org/key.js";

const PREFIX_BID = Buffer.from("bidOrgUser:");

export const keyBid = (org_id, bid) => keyOrg(PREFIX_BID, org_id, bid);
