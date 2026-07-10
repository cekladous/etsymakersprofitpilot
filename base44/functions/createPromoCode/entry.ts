import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthenticated = await base44.auth.isAuthenticated();
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();

    // SECURITY: Whitelist only allowed fields — never pass the raw body to create()
    const allowedFields = ['code', 'plan_id', 'discount_type', 'discount_value', 'duration_months', 'max_uses', 'expires_at', 'is_active', 'description'];
    const sanitized = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) sanitized[key] = body[key];
    }

    // Validate required fields
    if (!sanitized.code || !sanitized.plan_id) {
      return Response.json({ error: 'code and plan_id are required' }, { status: 400 });
    }

    // Always start with 0 uses — never trust client-provided current_uses
    sanitized.current_uses = 0;

    const promo = await base44.entities.PromoCode.create(sanitized);
    
    return Response.json({ success: true, data: promo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});