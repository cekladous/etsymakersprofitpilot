import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function AILaborEstimator({
  projectName,
  materials,
  machines,
  machineDetails,
  quantity,
  onEstimate
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [size, setSize] = useState('');
  const [sizeUnit, setSizeUnit] = useState('inches');
  const [aiEstimate, setAiEstimate] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const qty = parseFloat(quantity) || 1;

  const generateEstimate = async () => {
    setIsLoading(true);
    setAiEstimate(null);
    try {
      const materialsText = Array.isArray(materials)
        ? materials.map(m => `${m.quantity || 1}x ${m.name || m.material_type || 'material'}`).join(', ')
        : materials || 'None specified';

      const machinesText = Array.isArray(machineDetails) && machineDetails.length > 0
        ? machineDetails.map(m => {
            const parts = [m.name || m.model || 'machine'];
            if (m.brand || m.model) parts.push(`(${[m.brand, m.model].filter(Boolean).join(' ')})`);
            if (m.wattage) parts.push(`${m.wattage}W`);
            if (m.type) parts.push(m.type);
            return parts.join(' ');
          }).join(', ')
        : Array.isArray(machines) && machines.length > 0
          ? machines.map(m => m.name || 'machine').join(', ')
          : 'Standard laser/CNC equipment';

      const sizeText = size ? `Size/Dimensions: ${size} ${sizeUnit}` : 'Size not specified';
      const qtyText = `Batch quantity: ${qty} unit${qty === 1 ? '' : 's'}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert Etsy seller and maker estimating realistic production time for custom handmade products.

Project: ${projectName || 'Custom handmade item'}
Materials: ${materialsText}
Machines: ${machinesText}
${sizeText}
${qtyText}

Based on 2026 Etsy market standards and professional maker experience, estimate realistic time for a SINGLE unit of this item (except design time, which is a one-time cost for the whole batch):
1. Design/planning time (digital design, layout, test cuts) - ONE-TIME for the whole batch, not per unit
2. Manual labor time PER UNIT (assembly, finishing, packaging, quality check)
3. Engrave time PER UNIT - time the selected machine spends engraving/marking one unit, based on the machine's wattage/type if provided
4. Cut time PER UNIT - time the selected machine spends cutting out one unit, based on the machine's wattage/type if provided

Guidelines:
- Small items (under 4 inches): design 10-20min, labor 5-15min/unit, engrave 1-3min/unit, cut 0.5-2min/unit
- Medium items (4-12 inches): design 15-30min, labor 10-25min/unit, engrave 2-6min/unit, cut 1-4min/unit
- Large/complex items (12+ inches): design 30-60min, labor 20-60min/unit, engrave 5-15min/unit, cut 2-10min/unit
- Personalized/custom text adds 1-3min/unit to engrave time
- Packaging and quality check: add 2-5min/unit to labor
- Higher wattage machines cut/engrave faster than lower wattage machines
- Larger batch quantities typically have slightly lower per-unit labor time due to production efficiency

Respond with ONLY a JSON object, no explanation:`,
        response_json_schema: {
          type: "object",
          properties: {
            design_hours: { type: "number" },
            design_minutes: { type: "number" },
            labor_hours: { type: "number" },
            labor_minutes: { type: "number" },
            engrave_minutes_per_unit: { type: "number" },
            cut_minutes_per_unit: { type: "number" },
            reasoning: { type: "string" }
          },
          required: ["design_hours", "design_minutes", "labor_hours", "labor_minutes", "engrave_minutes_per_unit", "cut_minutes_per_unit"]
        }
      });

      setAiEstimate(response);
    } catch (error) {
      console.error("Error getting labor estimate:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyEstimate = () => {
    if (aiEstimate) {
      onEstimate({
        design_hours: aiEstimate.design_hours,
        design_minutes: aiEstimate.design_minutes,
        labor_hours: aiEstimate.labor_hours,
        labor_minutes: aiEstimate.labor_minutes,
        engrave_minutes_per_unit: aiEstimate.engrave_minutes_per_unit,
        cut_minutes_per_unit: aiEstimate.cut_minutes_per_unit,
      });
    }
  };

  const laborMinsPerUnit = aiEstimate ? (aiEstimate.labor_hours * 60 + aiEstimate.labor_minutes) : 0;
  const machineMinsPerUnit = aiEstimate ? (aiEstimate.engrave_minutes_per_unit + aiEstimate.cut_minutes_per_unit) : 0;
  const designMins = aiEstimate ? (aiEstimate.design_hours * 60 + aiEstimate.design_minutes) : 0;
  const totalMins = aiEstimate
    ? designMins + laborMinsPerUnit * qty + machineMinsPerUnit * qty
    : 0;

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-sm text-blue-900">Not sure? Estimate time with AI</CardTitle>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-blue-500" />}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3">
          <p className="text-xs text-blue-700">
            Optional: get a quick starting-point estimate for design (one-time), labor, engrave, and cut time (per unit) based on your project details and selected machine. You can always adjust the numbers above after applying.
          </p>

          {/* Size field */}
          <div className="space-y-1">
            <Label className="text-xs text-stone-700">Size / Dimensions (optional)</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. 6x4 or 12x8x2"
                className="h-9 text-sm flex-1"
              />
              <Select value={sizeUnit} onValueChange={setSizeUnit}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inches">inches</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            onClick={generateEstimate}
            disabled={isLoading || !projectName}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Estimating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {aiEstimate ? 'Re-estimate' : 'Estimate Design, Labor & Machine Time'}
              </>
            )}
          </Button>

          {/* AI Results — shown inline, user reviews before applying */}
          {aiEstimate && (
            <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI Suggested Times
              </p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-blue-50 rounded p-2 text-center">
                  <p className="text-stone-500 font-medium">Design</p>
                  <p className="font-bold text-blue-800">
                    {aiEstimate.design_hours > 0 ? `${aiEstimate.design_hours}h ` : ''}
                    {aiEstimate.design_minutes}m
                  </p>
                  <p className="text-stone-400">one-time</p>
                </div>
                <div className="bg-emerald-50 rounded p-2 text-center">
                  <p className="text-stone-500 font-medium">Labor</p>
                  <p className="font-bold text-emerald-800">
                    {aiEstimate.labor_hours > 0 ? `${aiEstimate.labor_hours}h ` : ''}
                    {aiEstimate.labor_minutes}m
                  </p>
                  <p className="text-stone-400">per unit</p>
                </div>
                <div className="bg-amber-50 rounded p-2 text-center">
                  <p className="text-stone-500 font-medium">Engrave</p>
                  <p className="font-bold text-amber-800">
                    {aiEstimate.engrave_minutes_per_unit}m
                  </p>
                  <p className="text-stone-400">per unit</p>
                </div>
                <div className="bg-orange-50 rounded p-2 text-center">
                  <p className="text-stone-500 font-medium">Cut</p>
                  <p className="font-bold text-orange-800">
                    {aiEstimate.cut_minutes_per_unit}m
                  </p>
                  <p className="text-stone-400">per unit</p>
                </div>
              </div>
              {aiEstimate.reasoning && (
                <p className="text-xs text-stone-500 italic">{aiEstimate.reasoning}</p>
              )}
              <p className="text-xs text-stone-400">
                Total estimated time for {qty} unit{qty === 1 ? '' : 's'}: {Math.floor(totalMins / 60) > 0 ? `${Math.floor(totalMins / 60)}h ` : ''}{Math.round(totalMins % 60)}m
              </p>
              <Button
                type="button"
                onClick={handleApplyEstimate}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Apply This Estimate
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
