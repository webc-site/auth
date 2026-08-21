import Redis from "ioredis";
import CONF from "../../conf/KV.js";

const KV = new Redis(CONF);

export default KV;
