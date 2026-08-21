import { describe, test, expect, afterAll } from "bun:test";
import { hostOrg } from "../db/org/hostOrg.js";
import SDB from "../../db/SDB.js";
import KV from "../../db/KV.js";
import { HOST, ALIAS_HOST_LI } from "../../../conf/initUser.js";
import { $ } from "@3-/zx";

describe("auth/init.js 测试", () => {
  const hostOrgRm = (host) => KV.del("hostOrg:" + host),
    HOST_LI = [HOST, ...ALIAS_HOST_LI],
    rm = () => Promise.all(HOST_LI.map(hostOrgRm));

  afterAll(async () => {
    await rm();
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");
  });

  test("运行 init.js 初始化用户与组织，开发域名自动绑定到该组织", async () => {
    await rm();
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");

    const out = await $`bun src/auth/init.js`;
    expect(out.exitCode).toBe(0);

    const org_id = await hostOrg(HOST);
    expect(org_id).toBeDefined();

    for (const dev of ALIAS_HOST_LI) {
      const dev_org = await hostOrg(dev);
      expect(dev_org).toBeDefined();
      expect(dev_org.toString()).toBe(org_id.toString());
    }
  });
});
