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
  const [sourceFilter, setSourceFilter] = useState("Manufacturer");
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
      machineSettings = machineSettings.filter(s => s.source_type === sourceFilter);

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Label>Filter by Source:</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="User">My Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                setSelectedSetting(null);
                setEditDialogOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Setting
            </Button>
          </div>

          {machinesLoading || settingsLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Database className="w-8 h-8 text-stone-400" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">Loading...</h3>
            </div>
          ) : userMachines.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">No Machines Configured</h3>
              <p className="text-stone-500 max-w-sm mx-auto mb-4">
                Add your laser machines in Settings to see material libraries organized by your equipment
              </p>
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(settingsByMachine)[0]} className="w-full">
              <TabsList className="w-full justify-start flex-wrap h-auto">
                {Object.entries(settingsByMachine).map(([machineKey, data]) => (
                  <TabsTrigger key={machineKey} value={machineKey}>
                    {data.machine.name} ({data.settings.length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(settingsByMachine).map(([machineKey, data]) => (
                <TabsContent key={machineKey} value={machineKey}>
                  {data.settings.length === 0 ? (
                    <div className="text-center py-12 bg-stone-50 rounded-lg">
                      <Filter className="w-12 h-12 text-stone-400 mx-auto mb-3" />
                      <p className="text-stone-500">No settings found for this machine with current filters</p>
                    </div>
                  ) : (
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
                            <TableHead>Source</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.settings.map((setting, idx) => (
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
                              <TableCell className="text-sm">
                                {setting.speed_mm_s ? `${setting.speed_mm_s} mm/s` : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {setting.power_max_pct ? `${setting.power_max_pct}%` : "—"}
                              </TableCell>
                              <TableCell className="text-center text-sm">{setting.passes || 1}</TableCell>
                              <TableCell className="text-sm">
                                {setting.dpi_lpi || "—"}
                              </TableCell>
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
                  )}
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