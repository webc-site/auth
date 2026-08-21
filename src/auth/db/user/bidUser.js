import { orgUserNameLi } from "../org/orgUser.js";
import { userBidLi } from "./bid.js";

export default async (org, bid) => {
  const bid_user_li = await userBidLi(org, bid),
    name_li = await orgUserNameLi(
      org,
      bid_user_li.map(([id]) => id)
    );

  return bid_user_li.map(([id, is_login], idx) => [id, name_li[idx] || "", is_login]);
};
