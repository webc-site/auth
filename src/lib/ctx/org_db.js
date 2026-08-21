import orgDb from "../../db/orgDb.js";

export default async (ctx) => orgDb(await ctx.org_id);
