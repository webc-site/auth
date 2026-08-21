import { $ as $D } from "@1-/proto/D.js";
import auth$Empty from "./EmptyD.js";
import auth$ExitReq from "./ExitReqD.js";
import auth$InfoReq from "./InfoReqD.js";
import auth$RmReq from "./RmReqD.js";
import auth$SignUpMailReq from "./SignUpMailReqD.js";
import auth$UserNewByMailReq from "./UserNewByMailReqD.js";
export default $D([
  /* 1 user_new_by_mail */ auth$UserNewByMailReq,
  /* 2 lang */ auth$Empty,
  /* 3 get */ auth$Empty,
  /* 4 info */ auth$InfoReq,
  /* 5 sign_up_mail */ auth$SignUpMailReq,
  /* 6 exit */ auth$ExitReq,
  /* 7 rm */ auth$RmReq
]);
