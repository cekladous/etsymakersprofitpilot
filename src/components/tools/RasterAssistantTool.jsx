import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Zap, Lightbulb, CheckCircle2, AlertCircle, Database, ExternalLink } from "lucide-react";

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

const operations = [
  { value: "engrave", label: "Engrave" },
  { value: "cut", label: "Cut" },
  { value: "score", label: "Score" },
];



export default function RasterAssistantTool() {
  const [material, setMaterial] = useState("");
  const [machineBrand, setMachineBrand] = useState("");
  const [machineModel, setMachineModel] = useState("");
  const [laserType, setLaserType] = useState("");
  const [operation, setOperation] = useState("");

  const selectedMachine = machines.find(m => m.brand === machineBrand);
  const availableTypes = selectedMachine?.types || [];
  
  React.useEffect(() => {
    if (selectedMachine && availableTypes.length === 1) {
      setLaserType(availableTypes[0]);
    } else if (selectedMachine && !availableTypes.includes(laserType)) {
      setLaserType("");
    }
  }, [machineBrand]);

  // Fetch laser settings from database
  const { data: allSettings = [], isLoading } = useQuery({
    queryKey: ["laser-settings"],
    queryFn: () => base44.entities.LaserSetting.list(),
  });

  // Smart fallback matching system
  const { filteredSettings, matchType } = React.useMemo(() => {
    if (!material || !laserType || !operation) {
      return { filteredSettings: [], matchType: null };
    }

    // Normalize laser_type and operation for comparison
    const normalizeLaserType = (type) => type?.toLowerCase();
    const normalizeOperation = (op) => op?.toLowerCase();

    // Helper to check material match
    const materialMatches = (setting, searchMaterial) => {
      const matCat = setting.material_category?.toLowerCase() || '';
      const matName = setting.material_name?.toLowerCase() || '';
      const search = searchMaterial.toLowerCase();
      return matCat.includes(search) || matName.includes(search) || search.includes(matCat);
    };

    // Level 1: Exact match (brand + model + laser type + material + thickness + operation)
    if (machineBrand && machineModel) {
      const exact = allSettings.filter(s => 
        s.brand?.toLowerCase() === machineBrand.toLowerCase() &&
        s.model === machineModel &&
        normalizeLaserType(s.laser_type) === normalizeLaserType(laserType) &&
        materialMatches(s, material) &&
        normalizeOperation(s.operation) === normalizeOperation(operation) &&
        s.active !== false
      );
      if (exact.length > 0) return { filteredSettings: exact, matchType: 'exact' };
    }

    // Level 2: Ignore thickness
    if (machineBrand && machineModel) {
      const noThickness = allSettings.filter(s => 
        s.brand?.toLowerCase() === machineBrand.toLowerCase() &&
        s.model === machineModel &&
        normalizeLaserType(s.laser_type) === normalizeLaserType(laserType) &&
        materialMatches(s, material) &&
        normalizeOperation(s.operation) === normalizeOperation(operation) &&
        s.active !== false
      );
      if (noThickness.length > 0) return { filteredSettings: noThickness, matchType: 'exact' };
    }

    // Level 3: Brand match (ignore model)
    if (machineBrand) {
      const brandMatch = allSettings.filter(s =>
        s.brand?.toLowerCase() === machineBrand.toLowerCase() &&
        normalizeLaserType(s.laser_type) === normalizeLaserType(laserType) &&
        materialMatches(s, material) &&
        normalizeOperation(s.operation) === normalizeOperation(operation) &&
        s.active !== false
      );
      if (brandMatch.length > 0) return { filteredSettings: brandMatch, matchType: 'brand' };
    }

    // Level 4: Laser type + material category (ignore brand)
    const laserMatch = allSettings.filter(s =>
      normalizeLaserType(s.laser_type) === normalizeLaserType(laserType) &&
      materialMatches(s, material) &&
      normalizeOperation(s.operation) === normalizeOperation(operation) &&
      s.active !== false
    );
    if (laserMatch.length > 0) return { filteredSettings: laserMatch, matchType: 'generic' };

    // Level 5: Generic rows
    const genericMatch = allSettings.filter(s =>
      s.source_type === 'Generic' &&
      normalizeLaserType(s.laser_type) === normalizeLaserType(laserType) &&
      materialMatches(s, material) &&
      normalizeOperation(s.operation) === normalizeOperation(operation) &&
      s.active !== false
    );
    if (genericMatch.length > 0) return { filteredSettings: genericMatch, matchType: 'generic' };

    return { filteredSettings: [], matchType: null };
  }, [material, machineBrand, machineModel, laserType, operation, allSettings]);

  // Get operation counts for hints (but don't use this to disable operations)
  const operationCounts = React.useMemo(() => {
    if (!machineBrand || !laserType || !material) return {};
    
    const matchingSettings = allSettings.filter(setting => {
      if (setting.brand?.toLowerCase() !== machineBrand.toLowerCase()) return false;
      if (machineModel && setting.model !== machineModel) return false;
      if (setting.laser_type?.toLowerCase() !== laserType.toLowerCase()) return false;
      const matCat = setting.material_category?.toLowerCase() || '';
      const matName = setting.material_name?.toLowerCase() || '';
      if (!matCat.includes(material.toLowerCase()) && !matName.includes(material.toLowerCase())) return false;
      return setting.active !== false;
    });

    const counts = {};
    matchingSettings.forEach(s => {
      const op = s.operation?.toLowerCase();
      counts[op] = (counts[op] || 0) + 1;
    });
    return counts;
  }, [machineBrand, machineModel, laserType, material, allSettings]);

  // Check if all required fields are selected
  const allFieldsSelected = material && machineBrand && laserType && operation;
  const showResults = allFieldsSelected && filteredSettings.length > 0;
  const showNoResults = allFieldsSelected && filteredSettings.length === 0;

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
                <CardTitle>Operation Type</CardTitle>
                <CardDescription>What do you want to do?</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Label>Operation</Label>
            <div className="space-y-3 mt-2">
              {operations.map((op) => {
                const isDisabled = !material || !machineBrand || !laserType;
                const count = operationCounts[op.value] || 0;
                return (
                  <button
                    key={op.value}
                    onClick={() => !isDisabled && setOperation(op.value)}
                    disabled={isDisabled}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      operation === op.value && !isDisabled
                        ? "border-emerald-500 bg-emerald-50"
                        : !isDisabled
                        ? "border-stone-200 hover:border-stone-300 bg-white"
                        : "border-stone-100 bg-stone-50 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`font-semibold ${!isDisabled ? "text-stone-900" : "text-stone-400"}`}>
                        {op.label}
                      </div>
                      {!isDisabled && count > 0 && (
                        <span className="text-xs text-emerald-600 font-medium">{count} setting{count !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {isDisabled && (
                      <div className="text-xs text-stone-400 mt-1">Select material, machine, and laser type first</div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        {isLoading ? (
          <Card className="border-2 border-stone-200">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Database className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">Loading Settings...</h3>
            </CardContent>
          </Card>
        ) : showResults ? (
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white sticky top-8">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Database className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-emerald-900 flex items-center gap-2">
                    Manufacturer Settings Library
                    {matchType === 'exact' && (
                      <Badge className="bg-emerald-600 text-white">Exact Match</Badge>
                    )}
                    {matchType === 'brand' && (
                      <Badge className="bg-blue-600 text-white">Closest Match</Badge>
                    )}
                    {matchType === 'generic' && (
                      <Badge className="bg-amber-600 text-white">Generic Starting Point</Badge>
                    )}
                    {matchType === 'category' && (
                      <Badge className="bg-violet-600 text-white">Similar Material</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {filteredSettings.length} setting{filteredSettings.length !== 1 ? 's' : ''} found
                    {matchType !== 'exact' && (
                      <span className="text-amber-600 ml-1">• Using fallback match</span>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {matchType !== 'exact' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Using Fallback Match</p>
                      <p className="text-xs mt-1">
                        {matchType === 'brand' && "No exact model match found. Showing settings for other models from the same brand."}
                        {matchType === 'generic' && "No brand-specific settings found. Showing generic settings for this laser type and material."}
                        {matchType === 'category' && "No exact material match found. Showing settings for similar materials."}
                        {" "}Always test on scrap material and adjust as needed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {filteredSettings[0]?.source_type === 'Manufacturer' ? 'Manufacturer-Recommended Defaults' : 'Safe Starting Point'}
                    </p>
                    <p className="text-xs mt-1">
                      {filteredSettings[0]?.source_type === 'Manufacturer' 
                        ? 'These are starting points based on official documentation.' 
                        : 'Generic baseline settings for this laser type and material.'}
                      {' '}Always test on scrap material and adjust for your specific conditions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50">
                      <TableHead>Material</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Speed</TableHead>
                      <TableHead>Power</TableHead>
                      <TableHead>Passes</TableHead>
                      <TableHead>DPI/LPI</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSettings.map((setting, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          <div>{setting.material_name || setting.material_category}</div>
                          {setting.thickness_mm && (
                            <div className="text-xs text-stone-500">{setting.thickness_mm}mm</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {setting.operation}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {setting.speed_mm_s ? `${setting.speed_mm_s} mm/s` : <span className="text-stone-400">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {setting.power_min_pct && setting.power_max_pct 
                              ? (setting.power_min_pct === setting.power_max_pct 
                                  ? `${setting.power_max_pct}%`
                                  : `${setting.power_min_pct}-${setting.power_max_pct}%`)
                              : setting.power_max_pct 
                                ? `${setting.power_max_pct}%`
                                : <span className="text-stone-400">—</span>
                            }
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{setting.passes || 1}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {setting.dpi_lpi ? `${setting.dpi_lpi}` : <span className="text-stone-400">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-xs text-stone-600">
                            {setting.notes}
                            {setting.frequency_hz && (
                              <div className="text-stone-500 mt-1">Freq: {setting.frequency_hz} Hz</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {setting.source_reference ? (
                            <a
                              href={setting.source_reference}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Source
                            </a>
                          ) : (
                            <span className="text-xs text-stone-400">Generic</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>



              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-amber-900 text-sm">Tips</span>
                </div>
                <ul className="space-y-1 text-xs text-amber-800">
                  <li>• Always run test cuts on scrap material first</li>
                  <li>• Material variations affect results - adjust as needed</li>
                  <li>• Clean your lens and mirrors regularly for consistent results</li>
                  <li>• Document your successful settings for future reference</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : showNoResults ? (
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">No Manufacturer Settings Found</h3>
              <p className="text-stone-600 max-w-sm mx-auto mb-4">
                We don't have official settings for this specific combination of material, machine, and operation.
              </p>
              <div className="bg-white rounded-lg p-4 max-w-md mx-auto text-left">
                <p className="text-sm font-semibold text-stone-900 mb-2">Suggestions:</p>
                <ul className="text-sm text-stone-600 space-y-1">
                  <li>• Try a different material or machine</li>
                  <li>• Check the "Other" model option</li>
                  <li>• Look for similar materials (e.g., plywood instead of wood)</li>
                  <li>• Consult your machine's manual for starting parameters</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-stone-200">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">Select Your Parameters</h3>
              <p className="text-stone-500 max-w-sm mx-auto">
                Choose your machine, material, and operation to see manufacturer-recommended settings from our library
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}