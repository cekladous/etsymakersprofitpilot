import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Lightbulb } from "lucide-react";

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

const machines = [
  { brand: "atomstack", label: "Atomstack", types: ["diode"], models: ["A5 M50", "A10 Pro", "A20 Pro", "X7 Pro", "S10 Pro", "P7 M40", "Other"] },
  { brand: "boss", label: "Boss Laser", types: ["co2"], models: ["LS-1416", "LS-1630", "HP-1610", "HP-2440", "LS-2436", "Other"] },
  { brand: "creality", label: "Creality", types: ["diode"], models: ["Falcon", "Falcon 2", "CV-30", "Other"] },
  { brand: "epilog", label: "Epilog", types: ["co2"], models: ["Zing 16", "Zing 24", "Fusion Pro", "Fusion Edge", "Other"] },
  { brand: "fsl", label: "Full Spectrum Laser", types: ["co2", "diode"], models: ["Muse", "H-Series", "Pro Series", "Other"] },
  { brand: "generic", label: "Generic/K40", types: ["co2", "diode"], models: ["K40", "Generic CO2", "Generic Diode", "Other"] },
  { brand: "glowforge", label: "Glowforge", types: ["co2"], models: ["Basic", "Plus", "Pro", "Aura", "Other"] },
  { brand: "laserpecker", label: "LaserPecker", types: ["diode"], models: ["LP3", "LP4", "L1 Pro", "L2", "Other"] },
  { brand: "longer", label: "Longer", types: ["diode"], models: ["Ray5", "Laser B1", "Other"] },
  { brand: "monport", label: "Monport", types: ["co2", "diode"], models: ["40W", "50W", "60W", "80W", "100W", "Other"] },
  { brand: "omtech", label: "OMTech", types: ["co2"], models: ["40W", "50W", "60W", "80W", "100W", "130W", "Other"] },
  { brand: "ortur", label: "Ortur", types: ["diode"], models: ["LM2", "LM3", "Laser Master 3", "H10", "Other"] },
  { brand: "thunder", label: "Thunder Laser", types: ["co2"], models: ["Nova 24", "Nova 35", "Nova 51", "Odin", "Other"] },
  { brand: "trotec", label: "Trotec", types: ["co2"], models: ["Speedy 100", "Speedy 300", "Speedy 400", "SP500", "Other"] },
  { brand: "wecreat", label: "WeCreat", types: ["diode"], models: ["Vision", "Other"] },
  { brand: "xtool", label: "xTool", types: ["co2", "diode"], models: ["D1", "D1 Pro", "M1", "P2", "P3", "S1", "F1", "F1 Ultra", "Other"] },
  { brand: "other", label: "Other", types: ["co2", "diode"], models: ["Custom"] },
];

const laserTypes = [
  { value: "diode", label: "Diode" },
  { value: "co2", label: "CO2" },
];

const resultTypes = [
  { value: "light", label: "Light Marking", description: "Subtle surface etching, minimal depth" },
  { value: "standard", label: "Standard Engraving", description: "Good contrast and visibility" },
  { value: "deep", label: "Deep/Dark Contrast", description: "Maximum contrast, deeper engraving" },
];

const getRecommendations = (material, laserType, result) => {
  if (laserType === "co2" && material === "wood") {
    if (result === "light") return { dpiMin: 200, dpiMax: 300, dotMin: 100, dotMax: 150, tips: ["Start with lower power settings", "Good for detailed images"] };
    else if (result === "standard") return { dpiMin: 300, dpiMax: 400, dotMin: 150, dotMax: 250, tips: ["Classic CO2 wood engraving settings", "Ideal for photos"] };
    else return { dpiMin: 400, dpiMax: 500, dotMin: 250, dotMax: 350, tips: ["Use slower speeds", "Higher power for deeper burns"] };
  }
  if (laserType === "co2" && material === "acrylic") {
    if (result === "light") return { dpiMin: 300, dpiMax: 400, dotMin: 120, dotMax: 180, tips: ["Keep power low to avoid melting", "Multiple passes work better"] };
    else if (result === "standard") return { dpiMin: 400, dpiMax: 500, dotMin: 180, dotMax: 250, tips: ["Good for frosted effect", "Experiment with defocus"] };
    else return { dpiMin: 500, dpiMax: 600, dotMin: 250, dotMax: 350, tips: ["High DPI for best frosting", "May need multiple passes"] };
  }
  if (laserType === "diode" && material === "wood") {
    if (result === "light") return { dpiMin: 250, dpiMax: 350, dotMin: 150, dotMax: 200, tips: ["Lighter woods work better", "Use jarvis dithering"] };
    else if (result === "standard") return { dpiMin: 350, dpiMax: 450, dotMin: 200, dotMax: 300, tips: ["Good for most hardwoods", "Slower speeds recommended"] };
    else return { dpiMin: 450, dpiMax: 600, dotMin: 300, dotMax: 400, tips: ["Very slow speeds", "Multiple passes may be needed"] };
  }
  if (result === "light") return { dpiMin: 200, dpiMax: 300, dotMin: 100, dotMax: 200, tips: ["Start with test engravings", "Adjust based on material response"] };
  else if (result === "standard") return { dpiMin: 300, dpiMax: 450, dotMin: 150, dotMax: 250, tips: ["General purpose settings", "Works for most materials"] };
  else return { dpiMin: 400, dpiMax: 600, dotMin: 200, dotMax: 350, tips: ["Slower speeds required", "May need multiple passes"] };
};

export default function RasterAssistantTool() {
  const [material, setMaterial] = useState("");
  const [machineBrand, setMachineBrand] = useState("");
  const [machineModel, setMachineModel] = useState("");
  const [laserType, setLaserType] = useState("");
  const [result, setResult] = useState("");

  const selectedMachine = machines.find(m => m.brand === machineBrand);
  const availableTypes = selectedMachine?.types || [];
  
  React.useEffect(() => {
    if (selectedMachine && availableTypes.length === 1) {
      setLaserType(availableTypes[0]);
    } else if (selectedMachine && !availableTypes.includes(laserType)) {
      setLaserType("");
    }
  }, [machineBrand]);

  const showResults = material && machineBrand && laserType && result;
  const recommendations = showResults ? getRecommendations(material, laserType, result) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl font-bold text-amber-700">1</div>
              <div>
                <CardTitle>Select Material</CardTitle>
                <CardDescription>What material are you engraving?</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Label>Material Category</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger className="h-11 mt-2">
                <SelectValue placeholder="Select material..." />
              </SelectTrigger>
              <SelectContent>
                {materials.map((mat) => (
                  <SelectItem key={mat.value} value={mat.value}>{mat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">2</div>
              <div>
                <CardTitle>Select Machine Brand</CardTitle>
                <CardDescription>What laser machine do you have?</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Label>Machine Brand</Label>
            <Select value={machineBrand} onValueChange={(v) => { setMachineBrand(v); setMachineModel(""); }}>
              <SelectTrigger className="h-11 mt-2">
                <SelectValue placeholder="Select machine..." />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine.brand} value={machine.brand}>{machine.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {machineBrand && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-xl font-bold text-violet-700">3</div>
                <div>
                  <CardTitle>Select Model</CardTitle>
                  <CardDescription>Which model do you have?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Label>Machine Model</Label>
              <Select value={machineModel} onValueChange={setMachineModel}>
                <SelectTrigger className="h-11 mt-2">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedMachine?.models.map((model) => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {machineBrand && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">4</div>
                <div>
                  <CardTitle>Laser Type</CardTitle>
                  <CardDescription>CO2 or Diode laser?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {laserTypes.map((type) => {
                  const isAvailable = availableTypes.includes(type.value);
                  return (
                    <button
                      key={type.value}
                      onClick={() => isAvailable && setLaserType(type.value)}
                      disabled={!isAvailable}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        laserType === type.value && isAvailable
                          ? "border-emerald-500 bg-emerald-50"
                          : isAvailable
                          ? "border-stone-200 hover:border-stone-300 bg-white"
                          : "border-stone-100 bg-stone-50 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className={`font-semibold ${isAvailable ? "text-stone-900" : "text-stone-400"}`}>{type.label}</div>
                      {!isAvailable && <div className="text-xs text-stone-400 mt-1">Not available for this machine</div>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-xl font-bold text-pink-700">5</div>
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
                    result === type.value ? "border-emerald-500 bg-emerald-50" : "border-stone-200 hover:border-stone-300 bg-white"
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
                    {materials.find(m => m.value === material)?.label} • {machines.find(m => m.brand === machineBrand)?.label} • {laserTypes.find(l => l.value === laserType)?.label} • {resultTypes.find(r => r.value === result)?.label}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-white rounded-xl p-5 border border-emerald-100">
                <div className="text-sm text-stone-600 mb-2">DPI Range</div>
                <div className="text-3xl font-bold text-emerald-700">
                  {recommendations.dpiMin} – {recommendations.dpiMax}
                </div>
                <div className="text-xs text-stone-500 mt-1">
                  ≈ {Math.round(recommendations.dpiMin / 2.54)} – {Math.round(recommendations.dpiMax / 2.54)} lines/cm
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-emerald-100">
                <div className="text-sm text-stone-600 mb-2">Dot Duration</div>
                <div className="text-3xl font-bold text-emerald-700">
                  {recommendations.dotMin} – {recommendations.dotMax} μs
                </div>
                {(machineModel === "F1" || machineModel === "F1 Ultra") && (
                  <div className="text-xs text-stone-500 mt-1">
                    For xTool F1/F1 Ultra bitmap engraving
                  </div>
                )}
              </div>

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
              <h3 className="text-lg font-semibold text-stone-900 mb-2">Select Your Settings</h3>
              <p className="text-stone-500 max-w-sm mx-auto">
                Choose your material, machine, laser type, and desired result to get personalized recommendations
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}