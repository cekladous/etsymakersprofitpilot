import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Resolve an unmatched Etsy statement line
 * Supports: auto-match, manual match, or mark-as-excluded
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      lineId,
      resolutionType, // 'auto_match' | 'manual_match' | 'exclude'
      matchedEntityId,
      matchedEntityType,
      notes
    } = await req.json();

    const line = await base44.entities.EtsyStatementLine.get(lineId);

    if (line.owner_user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData = {
      resolution_status: resolutionType === 'exclude' ? 'approved_for_exclusion' : 
                         resolutionType === 'auto' ? 'auto_matched' : 'manually_resolved',
      matched: true,
      resolution_notes: notes || '',
      resolved_at: new Date().toISOString(),
      resolved_by: user.email
    };

    if (matchedEntityId && matchedEntityType) {
      updateData.matched_entity_id = matchedEntityId;
      updateData.matched_entity_type = matchedEntityType;
    }

    await base44.entities.EtsyStatementLine.update(lineId, updateData);

    return Response.json({ 
      success: true,
      message: `Line resolved as ${updateData.resolution_status.replace(/_/g, ' ')}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});