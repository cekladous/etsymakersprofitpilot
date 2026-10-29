import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

// Generates a product image for a material the caller owns.
// Security order matters: authenticate, then verify ownership, and only then run
// the paid AI work. No caller can spend AI credits or touch another seller's
// material by guessing an id.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { material_type_id, name, supplier, category, reorder_url } = body || {};
    if (!material_type_id || !name) {
      return Response.json({ error: "material_type_id and name are required" }, { status: 400 });
    }

    // Ownership is checked BEFORE any AI call. The read goes through the
    // user-scoped client, so the entity's row-level rules already hide other
    // sellers' materials; the explicit compare below is a second guard.
    const owned = await base44.entities.MaterialType.filter({ id: material_type_id }).catch(() => []);
    const material = Array.isArray(owned) ? owned[0] : null;
    if (!material) {
      return Response.json({ error: "Material not found" }, { status: 404 });
    }
    if (material.owner_user_id !== user.id) {
      return Response.json({ error: "Not allowed to update this material" }, { status: 403 });
    }

    // If a reorder link is provided, read the actual product page so the
    // generated image matches the real color, texture and finish.
    let visualDescription = "";
    if (typeof reorder_url === "string" && /^https?:\/\//i.test(reorder_url)) {
      try {
        const descRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Visit this product page URL: ${String(reorder_url).slice(0, 500)}\nThe product is a crafting/laser material called "${name}". In one or two sentences, describe only its visible appearance for a product photo: color, texture, finish (matte/gloss), thickness look, and sheet form. Do not invent details; if the page is unavailable, return an empty description.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: { description: { type: "string" } },
          },
        });
        visualDescription = String(descRes?.description || "").slice(0, 600).trim();
      } catch (_e) {
        visualDescription = "";
      }
    }

    const categoryDesc = category || "crafting";
    const supplierDesc = supplier ? ` from ${supplier}` : "";
    const appearance = visualDescription ? ` It looks like: ${visualDescription}.` : "";
    const prompt = `A clean, professional product photograph of a single sheet of ${name}${supplierDesc}, a ${categoryDesc} material used for laser cutting and engraving.${appearance} Studio lighting, plain light background, top-down view, realistic texture and accurate color, no text, no watermark, no people.`;

    const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
    const image_url = result?.url || result?.file_url;
    if (!image_url) {
      return Response.json({ error: "Image generation returned no URL" }, { status: 500 });
    }

    await base44.entities.MaterialType.update(material_type_id, { image_url });

    return Response.json({ image_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}