import { toUnicode } from "punycode";
import psl from "@1-/psl";

export default ({ req }) => {
  const origin = req.header("origin");
  if (!origin) return;
  return psl(toUnicode(new URL(origin).hostname.toLowerCase().trim()));
};
