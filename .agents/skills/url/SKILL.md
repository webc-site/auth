---
name: url
---

## 接口开发流程

1. proto 定义

- 函数 proto：在 `src/${pkg}/proto/${函数名}.proto` 中定义响应消息、错误枚举（按需）及请求消息（仅有入参时定义）
- 路由 proto：在 `src/${pkg}/url.proto` 中 `import "proto/${函数名}.proto";` 并向 `message Call` 添加字段与 tag（无入参时使用公共 `Empty`）

2. 代码生成

- 运行 `./gen.js` 自动生成：
  - `src/${pkg}/gen/` 编解码器
  - `src/${pkg}/url.js` 与 `src/url.js` 路由索引
  - `api/js/${pkg}/` 客户端请求函数与 TypeScript 类型定义
  - `api/js/${pkg}/enum/` 客户端枚举常量

3. 服务端实现

- 在 `src/${pkg}/url/${函数名}.js` 中编写业务逻辑函数（`url.js` 路由映射由 `gen.js` 自动生成，无需手动维护）
- 执行上下文：函数内 `this` 指向请求上下文 Proxy（`reqCtx`），可自动惰性求值并缓存：
  - `this.host`：当前请求的主机域名
  - `this.lang`：请求首选语言
  - `this.org_id`：当前域名所属组织 ID（Promise）
  - `this.org_db`：当前组织对应的 SurrealDB 无状态查询函数（Promise，底层直接通过 Header 指定 `Surreal-DB`，零网络开销）
- **无状态数据库操作**：
  - 组织数据库完全无状态（基于自研 HTTP 驱动），切换库无任何握手开销
  - 组织级数据库函数接收 `db` 查询函数（如 `(db, org_id, user_id, level, name, conf)`），业务接口中可通过 `await this.org_db` 直接传入
- 返回值：必须使用生成的响应编码器 `${名称}E([data,err])` 编码为二进制返回

4. 验证测试

- 编写测试用例并运行 `./test.sh`

## Proto 规范与命名规则

- 文件归属与命名：每个接口对应一个 proto 文件，位于 `src/${pkg}/proto/${函数名}.proto`，文件名为小驼峰（如 `userNewByMail.proto`、`get.proto`）
- 基础名称：动词与名词组合，大驼峰风格（如 `UserNewByMail`、`Get`）
- 请求消息：
  - **有入参**：定义 `${名称}Req`（如 `UserNewByMailReq`、`InfoReq`）
  - **无入参**：业务 proto 中**无需**声明任何 Req 消息，在 `url.proto` 中直接使用公共的 `Empty`，生成器会自动生成 0 参数的客户端函数
- 错误枚举：`${名称}Err`（如 `UserNewByMailErr`，首项为 `OK=0`，错误项如 `ERR_MAIL_EXIST=1`）；**若无需校验参数或无业务错误分支，可省略错误枚举**
- 响应消息：`${名称}`（如 `UserNewByMail`、`Get`，包含数据字段与可选的 `optional ${名称}Err err`；无错误枚举时无需包含 `err` 字段）
- 路由定义：`src/${pkg}/url.proto` 中的 `message Call` 内 `oneof req` 字段为下划线风格（`snake_case`，如 `user_new_by_mail`、`get`），tag 从 1 开始自增；若无入参使用 `Empty`

### 示例

`src/auth/proto/get.proto`（无入参示例）：

```proto
syntax="proto3";

package auth;

enum AuthType {
  PHONE=1;
  GOOGLE=2;
  APPLE=3;
  MICROSOFT=4;
  WECHAT=5;
  GITHUB=6;
}

message User {
  uint64 id=1;
  string name=2;
}

message Get {
  repeated AuthType auth_type_li=1;
  repeated User user_li=2;
}
```

`src/auth/proto/userNewByMail.proto`（有入参示例）：

```proto
syntax="proto3";

package auth;

message UserNewByMailReq {
  string mail=1;
  string name=2;
  string password=3;
  string code=4;
}

enum UserNewByMailErr {
  OK=0;
  ERR_MAIL_EXIST=1;
  ERR_VERIFY_CODE=2;
}

message UserNewByMail {
  optional uint64 uid=1;
  optional UserNewByMailErr err=2;
}
```

`src/auth/url.proto`：

```proto
syntax="proto3";

package auth;

import "proto/userNewByMail.proto";
import "proto/lang.proto";
import "proto/get.proto";
import "proto/info.proto";

message Empty {}

message Call {
  oneof req {
    UserNewByMailReq user_new_by_mail=1;
    Empty lang=2;
    Empty get=3;
    InfoReq info=4;
  }
}
```

## 映射对应关系

- tag 序号与 url.js：`Call` 中的 tag 对应 `src/${pkg}/url.js` 数组下标（`tag - 1`）
- 命名映射：
  - proto 字段 `snake_case`（如 `user_new_by_mail`、`get`）
  - proto 文件名 `camelCase`（如 `userNewByMail.proto`、`get.proto`）
  - 函数实现文件名 `camelCase`（如 `src/${pkg}/url/userNewByMail.js`、`src/${pkg}/url/get.js`）
  - 客户端请求函数 `camelCase`（如 `api/js/${pkg}/userNewByMail.js`、`api/js/${pkg}/get.js`）
- 代码生成产物：
  - `src/${pkg}/gen/${名称}ReqE.js` / `src/${pkg}/gen/EmptyE.js`（请求编码）
  - `src/${pkg}/gen/${名称}D.js`（响应解码）
  - `api/js/${pkg}/${函数名}.js`（客户端请求函数，如 `req("${pkg}")(tag,ReqE,ResD)`）
  - `api/js/${pkg}/${函数名}.d.ts`（客户端类型定义）
  - `api/js/${pkg}/enum/${枚举名}.js`（客户端枚举定义）

## 数据库建表与表结构更新（SurrealDB）

项目数据库采用 **SurrealDB**。

### 1. 配置与建表定义

在 `docker/sdb/sdb.surql` 中编写 SurrealQL 语句（按字母序维护）：

- 自增序列：`DEFINE SEQUENCE ${表名} BATCH 1000 START 1;`
- 严格表模式：`DEFINE TABLE ${表名} SCHEMAFULL;`
- 字段与默认主键：
  - 主键：`DEFINE FIELD id ON ${表名} DEFAULT type::record('${表名}',\`sequence\`::nextval('${表名}'));`
  - 记录/实体引用：类型为 `record<目标表>` 时直接以实体/表名命名，**不加 `_id` 后缀**（如 `DEFINE FIELD host ON ${表名} TYPE record<host>;`、`DEFINE FIELD org ON host TYPE record<org>;`、`DEFINE FIELD user ON orgUser TYPE record<user>;`），保持图导航语法自然、极简
  - 普通类型：`DEFINE FIELD ${字段名} ON ${表名} TYPE int | string | bytes | bool;`
- 索引：`DEFINE INDEX ${索引名} ON ${表名} FIELDS ${字段1},${字段2} UNIQUE;`

### 2. 更新表结构

修改 `docker/sdb/sdb.surql` 后，运行更新脚本增量应用变更：

```bash
bun ./docker/sdb/updateSchema.js
```

- 该脚本会逐条执行 `sdb.surql` 中的语句，自动忽略已存在的表与索引（`already exists`）。
- 全量初始化数据库使用 `bun ./docker/sdb/init.js`（仅负责连接并执行 `sdb.surql` 初始化）。
- 重置数据库与表结构：运行 `./docker/reset.sh` 彻底重置 Docker 容器、清空数据并重新初始化。
