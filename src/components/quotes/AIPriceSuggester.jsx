import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader, AlertCircle } from "lucide-react";

export default function AIPriceSuggester({ 
  materialsTotal,
  projectName,
  materials,
  onSuggestedPrice 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const generatePriceSuggestion = async () => {
    setIsLoading(true);
    try {
      const materialsDesc = materials.map(m => `${m.name || m.type}`).join(", ") || "Custom item";
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a pricing expert for handmade and custom products sold on Etsy.

Analyze the user's shop: craftedxdesignco.etsy.com

Project Details:
- Name: ${projectName}
- Materials: ${materialsDesc}
- Material Cost: $${materialsTotal.toFixed(2)}

Based on:
1. Similar products on their Etsy shop
2. Industry standard pricing for custom handmade items
3. Fair profit margins (typically 2-3x material cost for handmade goods)
4. What they appear to be selling successfully

Suggest a fair retail price that:
- Covers all costs with reasonable profit
- Aligns with their shop's pricing
- Is competitive but not underpriced
- Doesn't overprice compared to similar items

Provide ONLY a realistic price suggestion, not inflated. Be conservative if uncertain.

Return a JSON response with:
- suggested_price: the recommended retail price
- reasoning: brief 1-2 sentence explanation

Keep it simple and fair.`,
        response_json_schema: {
          type: "object",
          properties: {
            suggested_price: { type: "number" },
            reasoning: { type: "string" }
          },
          required: ["suggested_price", "reasoning"]
        },
        add_context_from_internet: true
      });

      setSuggestion({
        price: response.suggested_price,
        reasoning: response.reasoning
      });
    } catch (error) {
      console.error("Error generating price suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 mb-4">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <Button
            type="button"
            onClick={generatePriceSuggestion}
            disabled={isLoading || !projectName}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Analyzing your shop...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Suggest Price Based on Your Etsy Shop
              </>
            )}
          </Button>

          {suggestion && (
            <div className="bg-white rounded-lg p-3 border border-emerald-200 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-600">Suggested Price:</span>
                <span className="text-2xl font-bold text-emerald-700">${suggestion.price.toFixed(2)}</span>
              </div>
              <p className="text-xs text-stone-500">{suggestion.reasoning}</p>
              <Button
                type="button"
                onClick={() => {
                  onSuggestedPrice(suggestion.price);
                  setSuggestion(null);
                }}
                className="w-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Use This Price
              </Button>
            </div>
          )}

          {!suggestion && !isLoading && (
            <div className="flex items-start gap-2 p-2 bg-emerald-50 rounded border border-emerald-200">
              <AlertCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-700">
                AI will analyze your Etsy shop and past sales to suggest a fair price based on similar items you've sold.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}