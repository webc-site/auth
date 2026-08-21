import { addExtension, encode, decode } from "cbor-x";
import RecordId from "./RecordId.js";

addExtension({
  tag: 6,
  encode: () => null,
  decode: () => undefined
});

addExtension({
  tag: 8,
  encode: (v) => [v.tb, v.id],
  decode: (val) => {
    if (typeof val === "string") return RecordId(val);
    const [tb, id] = val;
    return RecordId(tb + ":" + id);
  }
});

export const APPLICATION_CBOR = "application/cbor";
export { encode, decode };
