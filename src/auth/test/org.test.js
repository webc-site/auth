import orgDb from "../../db/orgDb.js";
import { describe, test, expect, afterAll } from "bun:test";
import hostOrgCreate, { hostOrg } from "../db/org/hostOrg.js";
import hostOrgBind from "../db/org/hostOrgBind.js";
import orgUser, {
  orgUserName,
  orgUserNameLi,
  orgUserLevel,
  orgUserPassword
} from "../db/org/orgUser.js";
import { OWNER, ADMIN, USER } from "../db/org/LEVEL.js";
import mailNew from "../db/mail/new.js";
import SDB from "../../db/SDB.js";
import KV from "../../db/KV.js";
import { keyHostOrg } from "../db/org/key.js";

describe("org 模块与 hostOrg / orgUser / hostOrgBind 测试", () => {
  const hostOrgRm = (host) => KV.del(keyHostOrg(host)),
    HOST_LI = ["test.com", "main-org.com", "extra.main-org.com", "org-test.com"],
    rm = () => Promise.all(HOST_LI.map(hostOrgRm));

  afterAll(async () => {
    await rm();
    await KV.flushdb();
    await SDB("DELETE org; DELETE mail; DELETE mailHost; DELETE host;");
  });

  test("hostOrg 查找与自动创建同名组织", async () => {
    const org_id1 = await hostOrgCreate("test.com"),
      org_id2 = await hostOrgCreate("test.com");
    expect(org_id2.toString()).toBe(org_id1.toString());

    const [org] = await SDB("SELECT * FROM ONLY org WHERE id=type::record('org',$org_id)", {
      org_id: org_id1
    });
    expect(org.name).toBe("test.com");
  });

  test("hostOrgBind 为组织绑定额外域名", async () => {
    const org_id = await hostOrgCreate("main-org.com"),
      host_id = await hostOrgBind(org_id, "extra.main-org.com");
    expect(host_id).toBeDefined();

    const queried_org = await hostOrg("extra.main-org.com");
    expect(queried_org.toString()).toBe(org_id.toString());

    // 重复绑定相同域名抛出异常
    expect(hostOrgBind(org_id, "extra.main-org.com")).rejects.toThrow();
  });

  test("orgUser 添加用户到组织并设置权限级别", async () => {
    const org_id = await hostOrgCreate("org-test.com"),
      uid = await mailNew("orguser@org-test.com"),
      db = orgDb(org_id);

    const org_uid_rec_id = await orgUser(db, org_id, uid, OWNER, "OrgUser", {
      password: "password123",
      mail: uid
    });
    expect(org_uid_rec_id).toBeDefined();

    const [rec] = await db("SELECT *, mail.*, mail.host.* FROM ONLY type::record('user',$uid)", {
      uid
    });
    expect(rec).toBeDefined();
    expect(rec.level).toBe(OWNER);
    expect(rec.name).toBe("OrgUser");
    expect(rec.mail.id.id).toBe(uid);
    expect(rec.mail.prefix).toBe("orguser");
    expect(rec.mail.host.host).toBe("org-test.com");

    const name = await orgUserName(org_id, uid);
    expect(name).toBe("OrgUser");

    const name_li = await orgUserNameLi(org_id, [uid, 99999]);
    expect(name_li).toEqual(["OrgUser", null]);

    const level = await orgUserLevel(org_id, uid);
    expect(level).toBe(OWNER);

    const pwd = await orgUserPassword(org_id, uid);
    expect(pwd).toBeDefined();
    expect(pwd.length).toBe(48);

    await orgUser(db, org_id, uid, ADMIN, "OrgUser2");
    const [rec_again] = await db("SELECT * FROM ONLY type::record('user',$uid)", { uid });
    expect(rec_again.level).toBe(OWNER);

    // 验证相同 mail 不能绑定给其他 user_id
    expect(
      orgUser(db, org_id, 99998, USER, "OtherUser", {
        mail: uid
      })
    ).rejects.toThrow();
  });
});
