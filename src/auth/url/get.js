import { authType } from "../db/host/authType.js";
import bidUser from "../db/user/bidUser.js";
import GetE from "../gen/GetE.js";

export default async function () {
  const { host, org_id, bid } = this,
    org = await org_id,
    auth_type_li = (host && (await authType(host))) || [],
    user_li = await bidUser(org, bid);

  return GetE([auth_type_li, user_li]);
}
