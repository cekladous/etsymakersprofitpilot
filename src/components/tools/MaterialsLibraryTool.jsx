import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Database, ExternalLink, Copy, Filter, Pencil, Plus, Upload, Download, FolderOpen, ChevronDown } from "lucide-react";
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (settings) => {
      return base44.entities.LaserSetting.bulkCreate(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["laser-settings"] });
      alert("Settings imported successfully!");
    },
    onError: (error) => {
      alert(`Import failed: ${error.message}`);
    },
  });

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Transform data to match LaserSetting schema
        const settings = jsonData.map((row) => ({
          brand: row.brand || row.Brand,
          model: row.model || row.Model,
          laser_type: row.laser_type || row["Laser Type"] || row.laser_type?.toLowerCase(),
          material_category: row.material_category || row["Material Category"],
          material_name: row.material_name || row["Material Name"],
          thickness_mm: row.thickness_mm || row["Thickness (mm)"] ? parseFloat(row.thickness_mm || row["Thickness (mm)"]) : null,
          operation: row.operation || row.Operation?.toLowerCase(),
          speed_mm_s: row.speed_mm_s || row["Speed (mm/s)"] ? parseFloat(row.speed_mm_s || row["Speed (mm/s)"]) : null,
          power_min_pct: row.power_min_pct || row["Power Min (%)"] ? parseFloat(row.power_min_pct || row["Power Min (%)"]) : null,
          power_max_pct: row.power_max_pct || row["Power Max (%)"] ? parseFloat(row.power_max_pct || row["Power Max (%)"]) : null,
          passes: row.passes || row.Passes ? parseInt(row.passes || row.Passes) : 1,
          dpi_lpi: row.dpi_lpi || row["DPI/LPI"] ? parseFloat(row.dpi_lpi || row["DPI/LPI"]) : null,
          frequency_hz: row.frequency_hz || row["Frequency (Hz)"] ? parseFloat(row.frequency_hz || row["Frequency (Hz)"]) : null,
          notes: row.notes || row.Notes || "",
          source_type: "User",
          active: true,
        }));

        importMutation.mutate(settings);
      } catch (error) {
        alert(`Failed to parse file: ${error.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleExport = (format = "xlsx") => {
    const exportData = allSettings.map((setting) => ({
      "Brand": setting.brand,
      "Model": setting.model,
      "Laser Type": setting.laser_type,
      "Material Category": setting.material_category,
      "Material Name": setting.material_name,
      "Thickness (mm)": setting.thickness_mm || "",
      "Operation": setting.operation,
      "Speed (mm/s)": setting.speed_mm_s || "",
      "Power Min (%)": setting.power_min_pct || "",
      "Power Max (%)": setting.power_max_pct || "",
      "Passes": setting.passes || 1,
      "DPI/LPI": setting.dpi_lpi || "",
      "Frequency (Hz)": setting.frequency_hz || "",
      "Notes": setting.notes || "",
      "Source Type": setting.source_type,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laser Settings");

    if (format === "csv") {
      XLSX.writeFile(workbook, "laser-settings-export.csv", { bookType: "csv" });
    } else {
      XLSX.writeFile(workbook, "laser-settings-export.xlsx", { bookType: "xlsx" });
    }
  };



  const { data: allSettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["laser-settings"],
    queryFn: () => base44.entities.LaserSetting.list(),
  });

  const { data: userMachines = [], isLoading: machinesLoading } = useQuery({
    queryKey: ["machines"],
    queryFn: () => base44.entities.Machine.list(),
  });

  const filteredSettings = allSettings.filter(setting => {
    const sourceMatch = sourceFilter === "Manufacturer" 
      ? setting.source_type === "Manufacturer"
      : sourceFilter === "User"
      ? setting.source_type === "User"
      : true;
    
    const categoryMatch = categoryFilter === "all" 
      ? true 
      : setting.material_category?.toLowerCase() === categoryFilter.toLowerCase();
    
    return sourceMatch && categoryMatch;
  });

  // Get unique material categories for dropdown
  const materialCategories = [...new Set(allSettings.map(s => s.material_category).filter(Boolean))].sort();

  // Group settings by user's machines
  const settingsByMachine = React.useMemo(() => {
    const machineGroups = {};
    
    userMachines.forEach(machine => {
      const machineKey = `${machine.name}`;
      machineGroups[machineKey] = {
        machine: machine,
        settings: []
      };
      
      // Find settings for this machine with filters applied
      let machineSettings = filteredSettings.filter(s => {
        const brandMatch = s.brand?.toLowerCase() === machine.name?.toLowerCase().split(' ')[0];
        return brandMatch && s.active !== false;
      });

      machineGroups[machineKey].settings = machineSettings;
    });

    return machineGroups;
  }, [userMachines, filteredSettings]);

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
          <div className="flex items-center justify-between flex-wrap gap-4">
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
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={handleImport}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                    Export as Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    Export as CSV (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Categories
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                    All Categories
                  </DropdownMenuItem>
                  {materialCategories.map((category) => (
                    <DropdownMenuItem 
                      key={category} 
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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