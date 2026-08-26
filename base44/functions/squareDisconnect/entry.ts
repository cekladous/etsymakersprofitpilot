import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { revokeConnection } from "../../shared/squareOauth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const conns = await base44.asServiceRole.entities.SquareConnection.filter({
      owner_user_id: user.id,
      status: "active",
    });
    for (const c of conns || []) {
      await revokeConnection(base44, c);
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}