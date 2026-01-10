import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, AlertTriangle, Lock, Unlock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function NameTagGenerator() {
  const [text, setText] = useState("NAME");
  const [fontFamily, setFontFamily] = useState("cursive");
  const [customFont, setCustomFont] = useState(null);
  const [thickness, setThickness] = useState(3);
  const [height, setHeight] = useState(100);
  const [width, setWidth] = useState(300);
  const [lockAspect, setLockAspect] = useState(false);
  const [spacing, setSpacing] = useState(0);
  const [topConnector, setTopConnector] = useState(false);
  const [bottomConnector, setBottomConnector] = useState(true);
  const [background, setBackground] = useState("light");
  const [warnings, setWarnings] = useState([]);
  
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const aspectRatio = useRef(width / height);

  // Font presets
  const fontOptions = [
    { value: "cursive", label: "Script", font: "cursive" },
    { value: "serif", label: "Serif", font: "serif" },
    { value: "sans-serif", label: "Modern", font: "sans-serif" },
    { value: "monospace", label: "Bold Mono", font: "monospace" },
    { value: "custom", label: "Custom Font", font: customFont || "sans-serif" },
  ];

  // Update canvas when inputs change
  useEffect(() => {
    generatePreview();
  }, [text, fontFamily, customFont, thickness, height, width, spacing, topConnector, bottomConnector]);

  // Handle custom font upload
  const handleFontUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith(".ttf") || file.name.endsWith(".otf"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fontFace = new FontFace("CustomFont", `url(${event.target.result})`);
        fontFace.load().then((loadedFont) => {
          document.fonts.add(loadedFont);
          setCustomFont("CustomFont");
          setFontFamily("custom");
        }).catch((err) => {
          console.error("Font loading failed:", err);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate preview
  const generatePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;

    const ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set background based on mode
    if (background === "light") {
      ctx.fillStyle = "#f5f5f4";
    } else if (background === "dark") {
      ctx.fillStyle = "#1c1917";
    }
    if (background !== "transparent") {
      ctx.fillRect(0, 0, width, height);
    }

    // Get font family
    const selectedFont = fontOptions.find(f => f.value === fontFamily);
    const actualFont = selectedFont?.value === "custom" ? customFont : selectedFont?.font;

    // Configure text
    const fontSize = height * 0.7;
    ctx.font = `bold ${fontSize}px ${actualFont || "cursive"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = background === "dark" ? "#fafaf9" : "#1c1917";
    ctx.strokeStyle = background === "dark" ? "#fafaf9" : "#1c1917";
    ctx.lineWidth = thickness;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Calculate text metrics
    const textWidth = ctx.measureText(text).width;
    const charSpacing = spacing * 5;

    // Draw text with spacing
    if (spacing === 0) {
      ctx.fillText(text, width / 2, height / 2);
      ctx.strokeText(text, width / 2, height / 2);
    } else {
      // Draw each character with spacing
      const chars = text.split("");
      const totalWidth = textWidth + (chars.length - 1) * charSpacing;
      let xOffset = (width - totalWidth) / 2;

      chars.forEach((char, i) => {
        const charWidth = ctx.measureText(char).width;
        ctx.fillText(char, xOffset + charWidth / 2, height / 2);
        ctx.strokeText(char, xOffset + charWidth / 2, height / 2);
        xOffset += charWidth + charSpacing;
      });
    }

    // Draw connectors
    const connectorHeight = 10;
    const padding = 20;

    if (topConnector) {
      ctx.fillRect(padding, connectorHeight, width - padding * 2, thickness);
    }

    if (bottomConnector) {
      ctx.fillRect(padding, height - connectorHeight - thickness, width - padding * 2, thickness);
    }

    // Validate and set warnings
    const newWarnings = [];
    if (thickness < 2) {
      newWarnings.push("Thickness below 2px may be too thin for laser cutting");
    }
    if (spacing > 10) {
      newWarnings.push("High letter spacing may cause disconnected paths");
    }
    if (!topConnector && !bottomConnector && text.length > 1) {
      newWarnings.push("Consider adding a connector bar for stability");
    }
    setWarnings(newWarnings);
  };

  // Handle dimension changes with aspect ratio lock
  const handleHeightChange = (value) => {
    setHeight(value);
    if (lockAspect) {
      setWidth(Math.round(value * aspectRatio.current));
    }
  };

  const handleWidthChange = (value) => {
    setWidth(value);
    if (lockAspect) {
      setHeight(Math.round(value / aspectRatio.current));
    } else {
      aspectRatio.current = value / height;
    }
  };

  const toggleAspectLock = () => {
    if (!lockAspect) {
      aspectRatio.current = width / height;
    }
    setLockAspect(!lockAspect);
  };

  // Download as SVG
  const downloadSVG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL();
    const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("href", dataUrl);
    image.setAttribute("width", width);
    image.setAttribute("height", height);
    svg.appendChild(image);

    // Serialize and download
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${text.toLowerCase().replace(/\s+/g, "-")}-nametag.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download as PNG
  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${text.toLowerCase().replace(/\s+/g, "-")}-nametag.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const formatDimension = (px) => {
    const inches = (px / 96).toFixed(2);
    const mm = (px * 0.264583).toFixed(1);
    return `${inches}" / ${mm}mm`;
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Connected Text Name Tag Generator"
          description="Design laser-cut name tags with connected letters and custom styling"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Text & Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Your Text</Label>
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value.toUpperCase())}
                    placeholder="Enter name or word"
                    className="text-lg font-medium"
                    maxLength={20}
                  />
                  <p className="text-xs text-stone-500 mt-1">{text.length}/20 characters</p>
                </div>

                <div>
                  <Label>Font Style</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Upload Custom Font (TTF/OTF)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ttf,.otf"
                    onChange={handleFontUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full mt-1"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Font File
                  </Button>
                  {customFont && (
                    <p className="text-xs text-emerald-600 mt-1">✓ Custom font loaded</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dimensions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Width: {width}px ({formatDimension(width)})</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAspectLock}
                      className="h-8 w-8 p-0"
                    >
                      {lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Slider
                    value={[width]}
                    onValueChange={([v]) => handleWidthChange(v)}
                    min={100}
                    max={800}
                    step={10}
                  />
                </div>

                <div>
                  <Label>Height: {height}px ({formatDimension(height)})</Label>
                  <Slider
                    value={[height]}
                    onValueChange={([v]) => handleHeightChange(v)}
                    min={50}
                    max={400}
                    step={10}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Line Thickness: {thickness}px</Label>
                  <Slider
                    value={[thickness]}
                    onValueChange={([v]) => setThickness(v)}
                    min={1}
                    max={10}
                    step={0.5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Letter Spacing: {spacing}</Label>
                  <Slider
                    value={[spacing]}
                    onValueChange={([v]) => setSpacing(v)}
                    min={0}
                    max={15}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connector Bars</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Top Connector Bar</Label>
                    <p className="text-xs text-stone-500">Adds stability at top</p>
                  </div>
                  <Switch checked={topConnector} onCheckedChange={setTopConnector} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Bottom Base Bar</Label>
                    <p className="text-xs text-stone-500">Adds stability at bottom</p>
                  </div>
                  <Switch checked={bottomConnector} onCheckedChange={setBottomConnector} />
                </div>
              </CardContent>
            </Card>

            {warnings.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    {warnings.map((warning, i) => (
                      <p key={i} className="text-xs text-amber-800">{warning}</p>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Preview</CardTitle>
                  <Select value={background} onValueChange={setBackground}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="transparent">Transparent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-stone-300 rounded-lg p-4 bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                    style={{ maxHeight: "500px", objectFit: "contain" }}
                  />
                </div>

                <div className="mt-4 p-3 bg-stone-100 rounded-lg">
                  <p className="text-xs text-stone-600 font-medium mb-1">Final Dimensions:</p>
                  <p className="text-sm text-stone-900">
                    Width: {formatDimension(width)}
                  </p>
                  <p className="text-sm text-stone-900">
                    Height: {formatDimension(height)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={downloadSVG} className="w-full" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download SVG (Laser Ready)
                </Button>
                <Button onClick={downloadPNG} variant="outline" className="w-full" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG Preview
                </Button>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <p className="text-xs text-blue-800">
                    <span className="font-semibold">Laser Cutting Tip:</span> The SVG is optimized for cutting. Ensure your laser settings match your material thickness.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}