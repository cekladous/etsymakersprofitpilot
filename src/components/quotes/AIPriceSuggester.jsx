import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader } from "lucide-react";

export default function AIPriceSuggester({ 
  materialsTotal, 
  laborTotal, 
  machineTotal, 
  desiredMargin, 
  onSuggestedPrice 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [customMargin, setCustomMargin] = useState(desiredMargin || 40);
  const [suggestedPrice, setSuggestedPrice] = useState(null);
  const [reasoning, setReasoning] = useState("");

  const totalCost = materialsTotal + laborTotal + machineTotal;

  const generateSuggestion = async () => {
    setIsLoading(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a pricing expert for custom manufacturing/craft businesses. Based on the following production costs, suggest an optimal sale price considering the desired profit margin and market competitiveness.

Production Costs Breakdown:
- Materials: $${materialsTotal.toFixed(2)}
- Labor/Services: $${laborTotal.toFixed(2)}
- Machine Time: $${machineTotal.toFixed(2)}
- Total Cost: $${totalCost.toFixed(2)}

Desired Profit Margin: ${customMargin}%

Please provide:
1. A suggested sale price that includes the desired profit margin
2. The actual profit margin percentage at that price
3. Brief reasoning for the suggestion (2-3 sentences considering market factors like craftsmanship premium, custom work, etc.)

Format your response as JSON with keys: suggested_price, actual_margin, reasoning`,
        response_json_schema: {
          type: "object",
          properties: {
            suggested_price: { type: "number" },
            actual_margin: { type: "number" },
            reasoning: { type: "string" }
          },
          required: ["suggested_price", "actual_margin", "reasoning"]
        }
      });

      setSuggestedPrice(response.suggested_price);
      setReasoning(response.reasoning);
      onSuggestedPrice(response.suggested_price);
    } catch (error) {
      console.error("Error getting price suggestion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <CardTitle className="text-base">AI Price Suggester</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Total Production Cost:</span>
            <span className="font-semibold">${totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-stone-500">
            <span className="pl-3">Materials:</span>
            <span>${materialsTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-stone-500">
            <span className="pl-3">Labor/Services:</span>
            <span>${laborTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-stone-500">
            <span className="pl-3">Machine Time:</span>
            <span>${machineTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <Label className="text-xs text-stone-600">Desired Profit Margin (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="5"
            value={customMargin}
            onChange={(e) => setCustomMargin(parseFloat(e.target.value))}
            className="mt-1 h-9"
          />
          <div className="text-xs text-stone-500 mt-1">
            Minimum price needed: ${(totalCost * (1 + customMargin / 100)).toFixed(2)}
          </div>
        </div>

        <Button
          onClick={generateSuggestion}
          disabled={isLoading || totalCost === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Get AI Price Suggestion
            </>
          )}
        </Button>

        {suggestedPrice && (
          <div className="bg-white rounded-lg p-3 space-y-2 border-2 border-purple-300">
            <div className="flex justify-between items-center">
              <span className="text-stone-600">Suggested Price:</span>
              <span className="text-2xl font-bold text-purple-600">${suggestedPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Estimated Profit:</span>
              <span className="font-semibold">${(suggestedPrice - totalCost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Profit Margin:</span>
              <span className="font-semibold">{(((suggestedPrice - totalCost) / suggestedPrice) * 100).toFixed(1)}%</span>
            </div>
            <div className="text-xs text-stone-500 italic mt-3 p-2 bg-stone-50 rounded">
              "{reasoning}"
            </div>
            <Button
              size="sm"
              onClick={() => onSuggestedPrice(suggestedPrice)}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700"
            >
              Use This Price
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}