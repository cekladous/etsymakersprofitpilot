import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader } from "lucide-react";

export default function AILaborEstimator({ 
  projectName, 
  materials, 
  machines,
  onEstimate 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const generateEstimate = async () => {
    setIsLoading(true);
    try {
      const materialsText = materials.map(m => `${m.name || m.type}: $${m.cost}`).join(", ");
      const machinesText = machines.map(m => m.name || "Unknown").join(", ");

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert in custom Etsy product manufacturing. Estimate the labor and machine time needed for this project based on current Etsy market standards.

Project Name: ${projectName}
Materials: ${materialsText || "None specified"}
Machines Available: ${machinesText || "Standard equipment"}

Research current Etsy average pricing for similar items and work backwards to suggest realistic production times.

Please provide realistic estimates for:
1. Design/Planning hours and minutes (total time for design work)
2. Manual labor hours and minutes (hands-on assembly, finishing, packaging)
3. Machine operating time in hours and minutes (laser, CNC, etc.)

Base estimates on:
- What Etsy sellers typically charge for similar items (2026 market rates)
- Industry-standard production times for handmade goods
- Material type (acrylic, wood, leather, etc.)
- Professional-level efficiency

Format as JSON with keys: design_hours, design_minutes, labor_hours, labor_minutes, machine_hours, machine_minutes`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            design_hours: { type: "number" },
            design_minutes: { type: "number" },
            labor_hours: { type: "number" },
            labor_minutes: { type: "number" },
            machine_hours: { type: "number" },
            machine_minutes: { type: "number" }
          },
          required: ["design_hours", "design_minutes", "labor_hours", "labor_minutes", "machine_hours", "machine_minutes"]
        }
      });

      onEstimate({
        design_hours: response.design_hours,
        design_minutes: response.design_minutes,
        labor_hours: response.labor_hours,
        labor_minutes: response.labor_minutes,
        machine_hours: response.machine_hours,
        machine_minutes: response.machine_minutes
      });
    } catch (error) {
      console.error("Error getting labor estimate:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-sm">AI Labor & Machine Time Estimator</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-stone-600 mb-3">
          Automatically estimate labor hours and machine time based on your project details.
        </p>
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
              Estimate Labor & Machine Time
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}