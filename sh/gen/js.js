import { parse as parseJs } from "yuku-parser";
import read from "@3-/read";
import write from "@3-/write";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";

const NUMBER_SET = new Set([
    "int32",
    "uint32",
    "sint32",
    "fixed32",
    "sfixed32",
    "int64",
    "uint64",
    "sint64",
    "fixed64",
    "sfixed64",
    "float",
    "double"
  ]),
  toTsType = (raw, sub_map = {}) => {
    if (NUMBER_SET.has(raw)) return "number";
    if (raw.endsWith("Li")) {
      const base = raw.slice(0, -2);
      return (NUMBER_SET.has(base) ? "number" : base === "bool" ? "boolean" : base) + "[]";
    }
    if (raw === "bool") return "boolean";
    if (raw === "bytes") return "Uint8Array";
    if (raw.endsWith("[]")) {
      const base = raw.slice(0, -2);
      if (sub_map[base]) return sub_map[base] + "[]";
      return "any[]";
    }
    return raw || "any";
  },
  parseComments = (comments, toCamel) => {
    const name_li = [];
    for (const { value } of comments) {
      for (const line of value.split("\n")) {
        const m = line.trim().match(/^\d+\s+([a-zA-Z0-9_]+)/);
        if (m && m[1] !== "_") name_li.push(toCamel(m[1]));
      }
    }
    return name_li;
  },
  parseProtoJs = (file_path, toCamel) => {
    const src = read(file_path),
      ast = parseJs(src, { sourceType: "module" }),
      name_li = parseComments(ast.comments, toCamel);

    let cur_path = file_path,
      cur_src = src,
      cur_ast = ast,
      reexport_path;

    do {
      reexport_path = undefined;
      for (const { type, source } of cur_ast.program.body) {
        if (type === "ExportNamedDeclaration" && source?.value) {
          reexport_path = join(dirname(cur_path), source.value);
          break;
        }
      }
      if (reexport_path) {
        cur_path = reexport_path;
        cur_src = read(cur_path);
        cur_ast = parseJs(cur_src, { sourceType: "module" });
      }
    } while (reexport_path);

    let array_code = "[]",
      elements = [];
    const import_map = new Map(),
      field_li = [],
      sub_map = {};

    for (const node of cur_ast.program.body) {
      const { type } = node;
      if (type === "ImportDeclaration") {
        const src_pkg = node.source.value;
        if (!import_map.has(src_pkg)) import_map.set(src_pkg, { named: new Set(), default: null });
        const entry = import_map.get(src_pkg);
        for (const spec of node.specifiers) {
          if (spec.type === "ImportDefaultSpecifier") {
            entry.default = spec.local.name;
          } else {
            const { name } = spec.local;
            if (name !== "$E" && name !== "$D" && spec.imported?.name !== "$") {
              entry.named.add(name);
            }
          }
        }
      } else if (type === "ExportDefaultDeclaration") {
        const { declaration } = node;
        if (declaration.type === "CallExpression" && declaration.arguments.length) {
          const [arg] = declaration.arguments;
          if (arg.type === "ArrayExpression") {
            elements = arg.elements.map((el) => {
              if (el.type === "Identifier") return el.name;
              if (
                el.type === "ArrayExpression" &&
                el.elements.length === 1 &&
                el.elements[0].type === "Identifier"
              ) {
                const sub_name = el.elements[0].name;
                for (const [src_pkg, entry] of import_map) {
                  if (entry.default === sub_name && src_pkg.startsWith("./")) {
                    const sub_file = join(dirname(cur_path), src_pkg),
                      sub_info = parseProtoJs(sub_file, toCamel);
                    sub_map[sub_name] =
                      "[" + sub_info.field_li.map((f) => f.name + "?: " + f.type).join(",") + "]";
                  }
                }
                return sub_name + "[]";
              }
              return "any";
            });
          }
          array_code = cur_src
            .slice(arg.start, arg.end)
            .replace(/\/\*.*?\*\//g, "")
            .replace(/\s+/g, " ")
            .trim();
        }
      }
    }

    name_li.forEach((name, i) => {
      field_li.push({ name, type: toTsType(elements[i], sub_map) });
    });

    return { import_map, array_code, field_li };
  };

export default (api_dir, pkg, pkg_src_gen_dir, call_fields, toCamel, GEN_HEAD, enum_li = []) => {
  const pkg_api_dir = join(api_dir, pkg);
  rmSync(pkg_api_dir, { recursive: true, force: true });

  const enum_dir = join(pkg_api_dir, "enum");
  for (const enum_name of enum_li) {
    write(join(enum_dir, enum_name + ".js"), read(join(pkg_src_gen_dir, enum_name + ".js")));
  }

  const req_code =
    GEN_HEAD +
    'import { req } from "@1-/protoapi";\n\n' +
    "export default req(" +
    JSON.stringify(pkg) +
    ");\n";
  write(join(pkg_api_dir, "_req.js"), req_code);

  for (const field of Object.values(call_fields)) {
    const { id, type, name } = field,
      req_type = type.value,
      func_name = toCamel(name),
      res_type = req_type.endsWith("Req")
        ? req_type.slice(0, -3)
        : func_name[0].toUpperCase() + func_name.slice(1),
      req_e_file = join(pkg_src_gen_dir, req_type + "E.js"),
      res_d_file = join(pkg_src_gen_dir, res_type + "D.js"),
      req_info = parseProtoJs(req_e_file, toCamel),
      res_info = parseProtoJs(res_d_file, toCamel),
      merged_import = new Map(),
      imp_li = [];

    for (const { import_map } of [req_info, res_info]) {
      for (const [pkg_src, entry] of import_map) {
        if (!merged_import.has(pkg_src))
          merged_import.set(pkg_src, { named: new Set(), default: null });
        const merged_entry = merged_import.get(pkg_src);
        if (entry.default) merged_entry.default = entry.default;
        for (const n of entry.named) merged_entry.named.add(n);
      }
    }

    for (const [pkg_src, entry] of merged_import) {
      if (pkg_src.startsWith("./")) {
        const file_name = pkg_src.slice(2),
          import_path = "./proto/" + file_name;
        write(join(pkg_api_dir, "proto", file_name), read(join(pkg_src_gen_dir, file_name)));
        if (entry.default) {
          imp_li.push("import " + entry.default + ' from "' + import_path + '";');
        }
        if (entry.named.size) {
          imp_li.push("import { " + [...entry.named].join(",") + ' } from "' + import_path + '";');
        }
      } else if (entry.named.size) {
        imp_li.push("import { " + [...entry.named].join(",") + ' } from "' + pkg_src + '";');
      }
    }

    imp_li.push('import req from "./_req.js";');

    const param_names = req_info.field_li.map((f) => f.name),
      params_str = param_names.join(","),
      call_args_str = params_str ? "," + params_str : "",
      code =
        GEN_HEAD +
        imp_li.join("\n") +
        "\n\nexport default (" +
        params_str +
        ") => req(" +
        id +
        "," +
        req_info.array_code +
        "," +
        res_info.array_code +
        call_args_str +
        ");\n";

    write(join(pkg_api_dir, func_name + ".js"), code);

    const dts_params = req_info.field_li.map((f) => f.name + "?: " + f.type).join(","),
      dts_returns = res_info.field_li.map((f) => f.name + "?: " + f.type).join(","),
      dts_code =
        GEN_HEAD +
        "declare const _default: (" +
        dts_params +
        ") => Promise<[" +
        dts_returns +
        "]>;\nexport default _default;\n";
    write(join(pkg_api_dir, func_name + ".d.ts"), dts_code);
  }
};
