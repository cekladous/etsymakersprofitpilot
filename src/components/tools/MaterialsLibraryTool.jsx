import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Database, ExternalLink, Copy, Filter, Pencil } from "lucide-react";
import LaserSettingEditDialog from "./LaserSettingEditDialog";

const machines = [
  { brand: "atomstack", label: "Atomstack" },
  { brand: "boss", label: "Boss Laser" },
  { brand: "creality", label: "Creality" },
  { brand: "epilog", label: "Epilog" },
  { brand: "fsl", label: "Full Spectrum Laser" },
  { brand: "generic", label: "Generic/K40" },
  { brand: "glowforge", label: "Glowforge" },
  { brand: "laserpecker", label: "LaserPecker" },
  { brand: "longer", label: "Longer" },
  { brand: "monport", label: "Monport" },
  { brand: "omtech", label: "OMTech" },
  { brand: "ortur", label: "Ortur" },
  { brand: "thunder", label: "Thunder Laser" },
  { brand: "trotec", label: "Trotec" },
  { brand: "wecreat", label: "WeCreat" },
  { brand: "xtool", label: "xTool" },
  { brand: "other", label: "Other" },
];

export default function MaterialsLibraryTool() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState(null);

  const { data: allSettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["laser-settings"],
    queryFn: () => base44.entities.LaserSetting.list(),
  });

  const { data: userMachines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  // Group settings by user's machines
  const settingsByMachine = React.useMemo(() => {
    const machineGroups = {};
    
    userMachines.forEach(machine => {
      const machineKey = `${machine.name}`;
      machineGroups[machineKey] = {
        machine: machine,
        settings: []
      };
      
      // Find settings for this machine
      let machineSettings = allSettings.filter(s => {
        const brandMatch = s.brand?.toLowerCase() === machine.name?.toLowerCase().split(' ')[0];
        return brandMatch && s.active !== false;
      });

      // Apply source filter
      if (sourceFilter !== "all") {
        machineSettings = machineSettings.filter(s => s.source_type === sourceFilter);
      }

      machineGroups[machineKey].settings = machineSettings;
    });

    return machineGroups;
  }, [userMachines, allSettings, sourceFilter]);

  const handleCopySetting = (setting) => {
    setSelectedSetting(setting);
    setEditDialogOpen(true);
  };

  const handleEditSetting = (setting) => {
    setSelectedSetting(setting);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Database className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <CardTitle>Materials Library by Machine</CardTitle>
              <CardDescription>Browse manufacturer and custom settings organized by laser machine</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Select Machine Brand</Label>
              <Select value={selectedBrand} onValueChange={(v) => { setSelectedBrand(v); setSelectedModel(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand..." />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((machine) => (
                    <SelectItem key={machine.brand} value={machine.brand}>{machine.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBrand && availableModels.length > 0 && (
              <div className="space-y-2">
                <Label>Select Model (Optional)</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Models</SelectItem>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Source Type</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="Community">Community</SelectItem>
                  <SelectItem value="User">My Settings</SelectItem>
                  <SelectItem value="Generic">Generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selectedBrand ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">Select a Machine</h3>
              <p className="text-stone-500 max-w-sm mx-auto">
                Choose your laser machine brand to view material settings and presets
              </p>
            </div>
          ) : filteredSettings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Filter className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">No Settings Found</h3>
              <p className="text-stone-500 max-w-sm mx-auto">
                Try adjusting your filters or select a different machine
              </p>
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(groupedByMaterial)[0]} className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto">
                {Object.keys(groupedByMaterial).sort().map((category) => (
                  <TabsTrigger key={category} value={category}>
                    {category} ({groupedByMaterial[category].length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(groupedByMaterial).map(([category, settings]) => (
                <TabsContent key={category} value={category}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-stone-50">
                          <TableHead>Material</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Laser Type</TableHead>
                          <TableHead>Operation</TableHead>
                          <TableHead>Speed</TableHead>
                          <TableHead>Power</TableHead>
                          <TableHead>Passes</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.map((setting, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              <div>{setting.material_name || setting.material_category}</div>
                              {setting.thickness_mm && (
                                <div className="text-xs text-stone-500">{setting.thickness_mm}mm</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{setting.model}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="uppercase text-xs">
                                {setting.laser_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {setting.operation}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {setting.speed_mm_s ? `${setting.speed_mm_s} mm/s` : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {setting.power_max_pct ? `${setting.power_max_pct}%` : "—"}
                            </TableCell>
                            <TableCell className="text-center text-sm">{setting.passes || 1}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge className={
                                  setting.source_type === "Manufacturer" ? "bg-blue-100 text-blue-800" :
                                  setting.source_type === "User" ? "bg-emerald-100 text-emerald-800" :
                                  setting.source_type === "Community" ? "bg-violet-100 text-violet-800" :
                                  "bg-stone-100 text-stone-800"
                                }>
                                  {setting.source_type}
                                </Badge>
                                {setting.source_reference && (
                                  <a
                                    href={setting.source_reference}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {setting.source_type === "User" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditSetting(setting)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <Pencil className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopySetting(setting)}
                                    className="text-emerald-600 hover:text-emerald-700"
                                  >
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      <LaserSettingEditDialog
        setting={selectedSetting}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
}