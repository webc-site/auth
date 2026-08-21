import { $ as $E } from "@1-/proto/E.js";
import auth$Empty from "./EmptyE.js";
import auth$ExitReq from "./ExitReqE.js";
import auth$InfoReq from "./InfoReqE.js";
import auth$RmReq from "./RmReqE.js";
import auth$SignUpMailReq from "./SignUpMailReqE.js";
import auth$UserNewByMailReq from "./UserNewByMailReqE.js";
export default $E([
  /* 1 user_new_by_mail */ auth$UserNewByMailReq,
  /* 2 lang */ auth$Empty,
  /* 3 get */ auth$Empty,
  /* 4 info */ auth$InfoReq,
  /* 5 sign_up_mail */ auth$SignUpMailReq,
  /* 6 exit */ auth$ExitReq,
  /* 7 rm */ auth$RmReq
]);
