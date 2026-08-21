#!/usr/bin/env bun

import proto2js from "@1-/proto2js";
import merge from "@1-/proto2js/merge.js";
import { parse } from "proto-parser";
import write from "@3-/write";
import { $ } from "@3-/zx";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import genJs from "./sh/gen/js.js";
import srcPkg from "./sh/srcPkg.js";

const ROOT = import.meta.dirname,
  GEN_HEAD = "// GEN BY gen.js\n",
  toCamel = (name) => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
  findEnums = (node) => {
    const li = [],
      scan = (obj) => {
        if (!obj) return;
        for (const [k, v] of Object.entries(obj)) {
          if (v.syntaxType === "EnumDefinition") {
            li.push(k);
          } else if (v.nested) {
            scan(v.nested);
          }
        }
      };
    scan(node);
    return li;
  },
  genAll = (proto_li, api_dir, src_dir, gen_tmp_dir) => {
    const pkg_li = [];

    for (const proto_path of proto_li) {
      const proto_dir = dirname(proto_path),
        rel_proto_path = proto_path.slice(proto_dir.length + 1),
        [proto_src, , pkg] = merge([proto_dir], rel_proto_path),
        parsed = parse(proto_src),
        call = parsed.root?.nested?.[pkg]?.nested?.Call || parsed.root?.nested?.Call;

      if (!call?.fields) continue;

      pkg_li.push(pkg);

      const pkg_src_gen_dir = join(src_dir, pkg, "gen"),
        pkg_gen_tmp_dir = join(gen_tmp_dir, pkg);

      rmSync(pkg_src_gen_dir, { recursive: true, force: true });
      cpSync(pkg_gen_tmp_dir, pkg_src_gen_dir, { recursive: true, force: true });

      const enum_li = findEnums(parsed.root?.nested?.[pkg]?.nested || parsed.root?.nested);

      genJs(api_dir, pkg, pkg_src_gen_dir, call.fields, toCamel, GEN_HEAD, enum_li);

      const url_li = [];
      for (const field of Object.values(call.fields)) {
        url_li[field.id - 1] = toCamel(field.name);
      }

      const url_code = GEN_HEAD + "export default " + JSON.stringify(url_li) + ";\n";
      write(join(src_dir, pkg, "url.js"), url_code);
    }

    if (pkg_li.length) {
      const imp_li = [],
        entry_li = [];

      for (const pkg of pkg_li) {
        imp_li.push("import " + pkg + '_url from "./' + pkg + '/url.js";');
        imp_li.push("import " + pkg + 'CallD from "./' + pkg + '/gen/CallD.js";');
        entry_li.push("  " + pkg + ": [" + pkg + "_url," + pkg + "CallD],");
      }

      const src_url_code =
        GEN_HEAD + imp_li.join("\n") + "\n\nexport default {\n" + entry_li.join("\n") + "\n};\n";
      write(join(src_dir, "url.js"), src_url_code);
    }
  },
  main = async () => {
    const src_dir = join(ROOT, "src"),
      gen_tmp_dir = join(src_dir, ".gen"),
      api_dir = join(ROOT, "api", "js");

    rmSync(join(ROOT, "gen"), { recursive: true, force: true });
    rmSync(join(src_dir, "gen"), { recursive: true, force: true });
    rmSync(gen_tmp_dir, { recursive: true, force: true });

    const proto_li = srcPkg(src_dir)
      .map((pkg) => join(src_dir, pkg, "url.proto"))
      .filter(existsSync);
    for (const proto_path of proto_li) {
      rmSync(join(dirname(proto_path), "gen"), { recursive: true, force: true });
      proto2js(proto_path, gen_tmp_dir);
    }

    genAll(proto_li, api_dir, src_dir, gen_tmp_dir);
    rmSync(gen_tmp_dir, { recursive: true, force: true });

    await $({ quiet: true })`bun x oxfmt ${api_dir} ${src_dir}`;
  };

export default main;

if (import.meta.main) {
  await main();
}
