const proto = {
  toString() {
    return this.tb + ":" + this.id;
  },
  toJSON() {
    return this.toString();
  },
  [Symbol.toPrimitive]() {
    return this.toString();
  }
};

export default (str) => {
  const idx = str.indexOf(":"),
    raw = str.slice(idx + 1);
  return {
    __proto__: proto,
    tb: str.slice(0, idx),
    id: Number(raw) || raw
  };
};
