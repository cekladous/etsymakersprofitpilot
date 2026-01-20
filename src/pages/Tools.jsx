import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Zap, Database, Tag, FileImage } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

// Import tool components
import CalculatorTool from "@/components/tools/CalculatorTool";
import RasterAssistantTool from "@/components/tools/RasterAssistantTool";
import MaterialsLibraryTool from "@/components/tools/MaterialsLibraryTool";
import NameTagGenerator from "@/components/tools/NameTagGenerator";
import SVGConverterTool from "@/components/tools/SVGConverterTool";

export default function Tools() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("calculator");

  const { data: settings = [] } = useQuery({
    queryKey: ["settings", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Settings.filter({ owner_user_id: user.id }),
  });

  const settingsData = settings[0] || {};
  const nameTagsEnabled = settingsData.tool_name_tags_enabled || false;
  const svgEnabled = settingsData.tool_svg_enabled || false;
  const rasterEnabled = settingsData.tool_raster_enabled || false;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Tools" 
        description="Profit calculator, raster settings, and business configuration"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-4xl ${
          nameTagsEnabled && svgEnabled && rasterEnabled 
            ? "grid-cols-6" 
            : nameTagsEnabled || svgEnabled || rasterEnabled
            ? "grid-cols-5"
            : "grid-cols-3"
        }`}>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Calculator</span>
          </TabsTrigger>
          {nameTagsEnabled && (
            <TabsTrigger value="nametag" className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Name Tags</span>
            </TabsTrigger>
          )}
          {svgEnabled && (
            <TabsTrigger value="svg" className="flex items-center gap-2">
              <FileImage className="w-4 h-4" />
              <span className="hidden sm:inline">SVG</span>
            </TabsTrigger>
          )}
          {rasterEnabled && (
            <TabsTrigger value="raster" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Raster</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Material Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="mt-6">
          <CalculatorTool />
        </TabsContent>

        {nameTagsEnabled && (
          <TabsContent value="nametag" className="mt-6">
            <NameTagGenerator />
          </TabsContent>
        )}

        {svgEnabled && (
          <TabsContent value="svg" className="mt-6">
            <SVGConverterTool />
          </TabsContent>
        )}

        {rasterEnabled && (
          <TabsContent value="raster" className="mt-6">
            <RasterAssistantTool />
          </TabsContent>
        )}

        <TabsContent value="materials" className="mt-6">
          <MaterialsLibraryTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}