import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, ArrowRight, Lightbulb } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const materials = [
  { value: "wood", label: "Wood" },
  { value: "plywood", label: "Plywood" },
  { value: "mdf", label: "MDF" },
  { value: "acrylic", label: "Acrylic" },
  { value: "leather", label: "Leather" },
  { value: "paper", label: "Paper" },
  { value: "cardboard", label: "Cardboard" },
  { value: "fabric", label: "Fabric" },
  { value: "foam", label: "Foam" },
  { value: "rubber", label: "Rubber" },
  { value: "glass", label: "Glass" },
  { value: "metal", label: "Metal" },
  { value: "stone", label: "Stone" },
  { value: "tile", label: "Tile" },
  { value: "food", label: "Food" },
];

const laserTypes = [
  { value: "diode", label: "Diode" },
  { value: "co2", label: "CO2" },
];

const resultTypes = [
  { 
    value: "light", 
    label: "Light Marking",
    description: "Subtle surface etching, minimal depth"
  },
  { 
    value: "standard", 
    label: "Standard Engraving",
    description: "Good contrast and visibility"
  },
  { 
    value: "deep", 
    label: "Deep/Dark Contrast",
    description: "Maximum contrast, deeper engraving"
  },
];

const getRecommendations = (material, laserType, result) => {
  // CO2 Wood recommendations
  if (laserType === "co2" && material === "wood") {
    if (result === "light") {
      return {
        dpiMin: 200,
        dpiMax: 300,
        dotMin: 100,
        dotMax: 150,
        tips: ["Start with lower power settings", "Good for detailed images"]
      };
    } else if (result === "standard") {
      return {
        dpiMin: 300,
        dpiMax: 400,
        dotMin: 150,
        dotMax: 250,
        tips: ["Classic CO2 wood engraving settings", "Ideal for photos"]
      };
    } else {
      return {
        dpiMin: 400,
        dpiMax: 500,
        dotMin: 250,
        dotMax: 350,
        tips: ["Use slower speeds", "Higher power for deeper burns"]
      };
    }
  }

  // CO2 Acrylic
  if (laserType === "co2" && material === "acrylic") {
    if (result === "light") {
      return {
        dpiMin: 300,
        dpiMax: 400,
        dotMin: 120,
        dotMax: 180,
        tips: ["Keep power low to avoid melting", "Multiple passes work better"]
      };
    } else if (result === "standard") {
      return {
        dpiMin: 400,
        dpiMax: 500,
        dotMin: 180,
        dotMax: 250,
        tips: ["Good for frosted effect", "Experiment with defocus"]
      };
    } else {
      return {
        dpiMin: 500,
        dpiMax: 600,
        dotMin: 250,
        dotMax: 350,
        tips: ["High DPI for best frosting", "May need multiple passes"]
      };
    }
  }

  // Diode Wood
  if (laserType === "diode" && material === "wood") {
    if (result === "light") {
      return {
        dpiMin: 250,
        dpiMax: 350,
        dotMin: 150,
        dotMax: 200,
        tips: ["Lighter woods work better", "Use jarvis dithering"]
      };
    } else if (result === "standard") {
      return {
        dpiMin: 350,
        dpiMax: 450,
        dotMin: 200,
        dotMax: 300,
        tips: ["Good for most hardwoods", "Slower speeds recommended"]
      };
    } else {
      return {
        dpiMin: 450,
        dpiMax: 600,
        dotMin: 300,
        dotMax: 400,
        tips: ["Very slow speeds", "Multiple passes may be needed"]
      };
    }
  }

  // Default generic recommendations
  if (result === "light") {
    return {
      dpiMin: 200,
      dpiMax: 300,
      dotMin: 100,
      dotMax: 200,
      tips: ["Start with test engravings", "Adjust based on material response"]
    };
  } else if (result === "standard") {
    return {
      dpiMin: 300,
      dpiMax: 450,
      dotMin: 150,
      dotMax: 250,
      tips: ["General purpose settings", "Works for most materials"]
    };
  } else {
    return {
      dpiMin: 400,
      dpiMax: 600,
      dotMin: 200,
      dotMax: 350,
      tips: ["Slower speeds required", "May need multiple passes"]
    };
  }
};

export default function RasterAssistant() {
  const [material, setMaterial] = useState("");
  const [laserType, setLaserType] = useState("");
  const [result, setResult] = useState("");

  const showResults = material && laserType && result;
  const recommendations = showResults ? getRecommendations(material, laserType, result) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Raster Settings Assistant"
        description="Get recommended DPI and dot duration settings based on your material and laser"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="space-y-6">
          {/* Material Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl font-bold text-amber-700">
                  1
                </div>
                <div>
                  <CardTitle>Select Material</CardTitle>
                  <CardDescription>What material are you engraving?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Material Category</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select material..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((mat) => (
                      <SelectItem key={mat.value} value={mat.value}>
                        {mat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Laser Type */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
                  2
                </div>
                <div>
                  <CardTitle>Select Laser</CardTitle>
                  <CardDescription>What type of laser?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Laser Type</Label>
                <Select value={laserType} onValueChange={setLaserType}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select laser type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {laserTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Result Type */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-xl font-bold text-violet-700">
                  3
                </div>
                <div>
                  <CardTitle>Desired Result</CardTitle>
                  <CardDescription>Choose the type of engraving result</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resultTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setResult(type.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      result === type.value
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-stone-200 hover:border-stone-300 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-stone-900">{type.label}</div>
                    <div className="text-sm text-stone-500 mt-1">{type.description}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div>
          {showResults ? (
            <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white sticky top-8">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Zap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-emerald-900">Recommended Settings</CardTitle>
                    <CardDescription>
                      {materials.find(m => m.value === material)?.label} • {laserTypes.find(l => l.value === laserType)?.label} • {resultTypes.find(r => r.value === result)?.label}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* DPI Range */}
                <div className="bg-white rounded-xl p-5 border border-emerald-100">
                  <div className="text-sm text-stone-600 mb-2">DPI Range</div>
                  <div className="text-3xl font-bold text-emerald-700">
                    {recommendations.dpiMin} – {recommendations.dpiMax}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    ≈ {Math.round(recommendations.dpiMin / 2.54)} – {Math.round(recommendations.dpiMax / 2.54)} lines/cm
                  </div>
                </div>

                {/* Dot Duration */}
                <div className="bg-white rounded-xl p-5 border border-emerald-100">
                  <div className="text-sm text-stone-600 mb-2">Dot Duration</div>
                  <div className="text-3xl font-bold text-emerald-700">
                    {recommendations.dotMin} – {recommendations.dotMax} μs
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    For xTool F1/F1 Ultra bitmap engraving
                  </div>
                </div>

                {/* Tips */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold text-amber-900">Tips</span>
                  </div>
                  <ul className="space-y-2 text-sm text-amber-800">
                    {recommendations.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Note */}
                <div className="text-xs text-stone-500 text-center">
                  Use these as starting points and adjust based on your results
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-stone-200">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  Select Your Settings
                </h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Choose your material, laser type, and desired result to get personalized recommendations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}