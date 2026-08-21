export const INT = "int",
  STRING = "string",
  BYTES = "bytes",
  rec = (t, is_null) => "record<" + t + ">" + (is_null ? " | null" : "");

const idxSql = (table, li, is_unique) => {
  if (!li) return [];
  if (!Array.isArray(li)) li = [li];
  return li.map((f) => {
    const f_li = Array.isArray(f) ? f : [f];
    return (
      "DEFINE INDEX IF NOT EXISTS " +
      f_li.join("_") +
      " ON " +
      table +
      " FIELDS " +
      f_li.join(", ") +
      (is_unique ? " UNIQUE;" : ";")
    );
  });
};

export default (table_map) =>
  Object.entries(table_map)
    .flatMap(([table, { field, unique, index }]) => [
      "DEFINE TABLE IF NOT EXISTS " + table + " SCHEMAFULL;",
      ...field.map(
        ([k, v]) => "DEFINE FIELD IF NOT EXISTS " + k + " ON " + table + " TYPE " + v + ";"
      ),
      ...idxSql(table, unique, true),
      ...idxSql(table, index, false)
    ])
    .join("");
