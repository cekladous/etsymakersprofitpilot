import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Download, RotateCcw } from "lucide-react";

export default function SVGConverterTool() {
  const [image, setImage] = useState(null);
  const [settings, setSettings] = useState({
    layers: 2,
    noiseReduction: 64,
    linePrecision: 4,
    curveSmoothness: 4,
    blurRadius: 5,
    scale: 2,
  });
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const resetDefaults = () => {
    setSettings({
      layers: 2,
      noiseReduction: 64,
      linePrecision: 4,
      curveSmoothness: 4,
      blurRadius: 5,
      scale: 2,
    });
  };

  const handleConvert = async () => {
    setConverting(true);
    // Placeholder for actual conversion logic
    setTimeout(() => {
      setConverting(false);
      alert("Conversion complete! (Integration with vectorization library needed)");
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-stone-900">SVG Converter</h1>
        <p className="text-stone-500 mt-1">Convert raster images to laser-ready vectors</p>
      </div>

      <div className="flex gap-3 mb-6">
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="bg-white"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
        <Button
          onClick={handleConvert}
          disabled={!image || converting}
          className="bg-stone-700 hover:bg-stone-800"
        >
          <Download className="w-4 h-4 mr-2" />
          {converting ? "Converting..." : "Save to Library"}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-stone-900">Detection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-stone-700">
                  Layers / Colors ({settings.layers})
                </Label>
              </div>
              <Slider
                value={[settings.layers]}
                onValueChange={(value) => setSettings({ ...settings, layers: value[0] })}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">Number of separation layers</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-stone-700">
                  Noise Reduction (Omit: {settings.noiseReduction})
                </Label>
              </div>
              <Slider
                value={[settings.noiseReduction]}
                onValueChange={(value) => setSettings({ ...settings, noiseReduction: value[0] })}
                min={0}
                max={255}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">Discard paths smaller than this noise reduction</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-stone-700">
                  Line Precision ({settings.linePrecision})
                </Label>
              </div>
              <Slider
                value={[settings.linePrecision]}
                onValueChange={(value) => setSettings({ ...settings, linePrecision: value[0] })}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">Lower = more detailed edges</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-stone-700">
                  Curve Smoothness ({settings.curveSmoothness})
                </Label>
              </div>
              <Slider
                value={[settings.curveSmoothness]}
                onValueChange={(value) => setSettings({ ...settings, curveSmoothness: value[0] })}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">Higher = smoother curves</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-stone-700">
                  Blur Radius ({settings.blurRadius})
                </Label>
              </div>
              <Slider
                value={[settings.blurRadius]}
                onValueChange={(value) => setSettings({ ...settings, blurRadius: value[0] })}
                min={0}
                max={20}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">Smoothing before tracing</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-stone-700">
                  Scale ({settings.scale}x)
                </Label>
              </div>
              <Slider
                value={[settings.scale]}
                onValueChange={(value) => setSettings({ ...settings, scale: value[0] })}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-stone-500 mt-1">Higher resolution (slower)</p>
            </div>

            <Button
              onClick={resetDefaults}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Defaults
            </Button>
          </CardContent>
        </Card>

        {/* Right Side - Upload Area */}
        <Card>
          <CardContent className="p-6">
            {!image ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 rounded-lg p-12 text-center cursor-pointer hover:border-stone-400 hover:bg-stone-50 transition-colors min-h-[500px] flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-stone-500" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  Upload Image to Convert
                </h3>
                <p className="text-stone-500 mb-4">
                  Drag and drop or click to upload PNG or JPG
                </p>
                <Button className="bg-stone-700 hover:bg-stone-800">
                  Select File
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border-2 border-stone-200 rounded-lg overflow-hidden">
                  <img
                    src={image}
                    alt="Uploaded"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setImage(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleConvert}
                    disabled={converting}
                    className="flex-1 bg-stone-700 hover:bg-stone-800"
                  >
                    {converting ? "Converting..." : "Convert to SVG"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}