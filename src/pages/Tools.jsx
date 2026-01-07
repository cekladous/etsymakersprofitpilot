import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Zap, Settings as SettingsIcon, Database } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

// Import tool components
import CalculatorTool from "@/components/tools/CalculatorTool";
import RasterAssistantTool from "@/components/tools/RasterAssistantTool";
import SettingsTool from "@/components/tools/SettingsTool";
import MaterialsLibraryTool from "@/components/tools/MaterialsLibraryTool";

export default function Tools() {
  const [activeTab, setActiveTab] = useState("calculator");

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Tools" 
        description="Profit calculator, raster settings, and business configuration"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Calculator</span>
          </TabsTrigger>
          <TabsTrigger value="raster" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Raster</span>
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Materials Library</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="mt-6">
          <CalculatorTool />
        </TabsContent>

        <TabsContent value="raster" className="mt-6">
          <RasterAssistantTool />
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          <MaterialsLibraryTool />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsTool />
        </TabsContent>
      </Tabs>
    </div>
  );
}