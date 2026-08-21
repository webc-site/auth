---
name: kv
---

所有数据必须完整存储在 surrealdb 中 ( src/lib/SDB.js )

kvrocks 只用来提升查询性能 ( src/lib/KV.js )

存储时，先写入 surrealdb，然后写入 kvrocks

查询时，只查询 kvrocks ，不查询 surrealdb

尽量用二进制提升查询性能，比如数字值可以用下面函数转换为二进制

import u64Bin from "@3-/intbin/u64Bin.js";
import binU64 from "@3-/intbin/binU64.js";

如果是键名中间部分包含数字可以用

import u64B255 from "@3-/intbin/u64B255.js";

b255 编码不会包含:，可以避免键冲突
