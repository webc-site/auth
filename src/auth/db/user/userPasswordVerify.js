import { orgUserPassword } from "../org/orgUser.js";
import { passwordVerify } from "./password.js";

export default async (org_id, uid, password) => {
  const hash = await orgUserPassword(org_id, uid);
  return passwordVerify(password, hash);
};
