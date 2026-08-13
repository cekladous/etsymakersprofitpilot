import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { material_type_id, name, supplier, category } = body || {};
    if (!material_type_id || !name) {
      return Response.json({ error: 'material_type_id and name are required' }, { status: 400 });
    }

    const categoryDesc = category || 'crafting';
    const supplierDesc = supplier ? ` from ${supplier}` : '';
    const prompt = `A clean, professional product photograph of a single sheet of ${name}${supplierDesc}, a ${categoryDesc} material used for laser cutting and engraving. Studio lighting, plain light background, top-down view, realistic texture and accurate color, no text, no watermark, no people.`;

    // Verify the caller owns this material before mutating it (service-role read,
    // manual ownership check so RLS filtering never hides the record from its owner)
    const existing = await base44.asServiceRole.entities.MaterialType.filter({ id: material_type_id });
    const material = existing?.[0];
    if (!material) {
      return Response.json({ error: 'Material not found' }, { status: 404 });
    }
    if (material.owner_user_id && material.owner_user_id !== user.id) {
      return Response.json({ error: 'Not allowed to update this material' }, { status: 403 });
    }

    const result = await base44.integrations.Core.GenerateImage({ prompt });
    const image_url = result?.url || result?.file_url;
    if (!image_url) {
      return Response.json({ error: 'Image generation returned no URL' }, { status: 500 });
    }

    await base44.asServiceRole.entities.MaterialType.update(material_type_id, { image_url });

    return Response.json({ image_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}