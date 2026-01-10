import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Download, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import opentype from "opentype.js";
import paper from "paper";

export default function NameTagGenerator() {
  const [names, setNames] = useState("Christina");
  const [fontSize, setFontSize] = useState(2);
  const [fontUnit, setFontUnit] = useState("in");
  const [fontFamily, setFontFamily] = useState("Brush Script MT");
  const [customFonts, setCustomFonts] = useState([]);
  const [loadedFont, setLoadedFont] = useState(null);
  
  const [thicken, setThicken] = useState(1.2);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(100);
  const [connectMode, setConnectMode] = useState("dots and letters");
  const [capitalize, setCapitalize] = useState("none");
  const [ligatures, setLigatures] = useState("none");
  const [showFewerOptions, setShowFewerOptions] = useState(true);
  const [cornerRounding, setCornerRounding] = useState(0.5);
  
  const [includeHole, setIncludeHole] = useState(true);
  const [holeDiameter, setHoleDiameter] = useState(0.19);
  const [holeThickness, setHoleThickness] = useState(0.12);
  const [holeSide, setHoleSide] = useState("left");
  const [holePosition, setHolePosition] = useState(-0.5);
  const [holeOverlap, setHoleOverlap] = useState(0.85);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [svgOutput, setSvgOutput] = useState("");
  
  const [fontOpen, setFontOpen] = useState(true);
  const [holeOpen, setHoleOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const paperScope = useRef(null);

  const fontCategories = {
    script: [
      { name: "Brush Script MT", label: "Brush Script" },
      { name: "Lucida Handwriting", label: "Lucida Handwriting" },
      { name: "Edwardian Script ITC", label: "Edwardian Script" },
      { name: "Freestyle Script", label: "Freestyle Script" },
      { name: "French Script MT", label: "French Script" },
      { name: "Mistral", label: "Mistral" },
    ],
    cursive: [
      { name: "cursive", label: "Default Cursive" },
    ],
    serif: [
      { name: "Georgia", label: "Georgia" },
      { name: "Times New Roman", label: "Times New Roman" },
    ],
    modern: [
      { name: "Arial", label: "Arial" },
      { name: "Helvetica", label: "Helvetica" },
    ]
  };

  // Load custom fonts
  useEffect(() => {
    const stored = localStorage.getItem('nametag-custom-fonts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCustomFonts(parsed);
      } catch (e) {
        console.error("Failed to load custom fonts:", e);
      }
    }
  }, []);

  // Initialize paper.js
  useEffect(() => {
    if (canvasRef.current) {
      paperScope.current = new paper.PaperScope();
      paperScope.current.setup(canvasRef.current);
    }
  }, []);

  // Convert font size to pixels
  const getFontSizeInPixels = () => {
    const dpi = 96;
    if (fontUnit === "pt") {
      return (fontSize * dpi) / 72;
    } else {
      return fontSize * dpi;
    }
  };

  // Handle custom font upload
  const handleFontUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith(".ttf") || file.name.endsWith(".otf"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fontName = file.name.replace(/\.(ttf|otf)$/, '').replace(/[^a-zA-Z0-9]/g, '');
        const uniqueFontName = `Custom_${fontName}_${Date.now()}`;
        
        const newFont = {
          name: uniqueFontName,
          displayName: file.name.replace(/\.(ttf|otf)$/, ''),
          data: event.target.result,
          uploadedAt: new Date().toISOString()
        };
        
        const updatedFonts = [...customFonts, newFont];
        setCustomFonts(updatedFonts);
        localStorage.setItem('nametag-custom-fonts', JSON.stringify(updatedFonts));
        setFontFamily(uniqueFontName);
      };
      reader.readAsDataURL(file);
    }
  };

  // Delete custom font
  const deleteCustomFont = (fontName) => {
    const updatedFonts = customFonts.filter(f => f.name !== fontName);
    setCustomFonts(updatedFonts);
    localStorage.setItem('nametag-custom-fonts', JSON.stringify(updatedFonts));
    if (fontFamily === fontName) {
      setFontFamily("Brush Script MT");
    }
  };

  // Generate preview and SVG
  useEffect(() => {
    generatePreview();
  }, [names, fontSize, fontUnit, fontFamily, thicken, letterSpacing, lineHeight, connectMode, capitalize, ligatures, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holePosition, holeOverlap, customFonts]);

  const applyCapitalization = (text) => {
    switch (capitalize) {
      case "uppercase": return text.toUpperCase();
      case "lowercase": return text.toLowerCase();
      case "title": return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      default: return text;
    }
  };

  const generatePreview = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !names.trim() || !paperScope.current) return;

    const ctx = canvas.getContext("2d");
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim()).map(n => applyCapitalization(n));
    
    // Set canvas size
    const padding = 100;
    const gridSize = dpi;
    canvas.width = 1200;
    canvas.height = Math.max(400, nameList.length * pixelSize * (lineHeight / 100) * 1.5 + padding * 2);

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#e7e5e4";
    ctx.lineWidth = 1;
    for (let x = padding; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = padding; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw ruler marks
    ctx.fillStyle = "#78716c";
    ctx.font = "10px sans-serif";
    for (let x = padding; x < canvas.width; x += gridSize) {
      const inch = Math.round((x - padding) / dpi);
      ctx.fillText(`${inch}"`, x + 2, 12);
    }
    for (let y = padding; y < canvas.height; y += gridSize) {
      const inch = Math.round((y - padding) / dpi);
      ctx.fillText(`${inch}"`, 5, y - 2);
    }

    // Draw text outlines in red
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    let maxWidth = 0;
    let totalHeight = 0;

    nameList.forEach((name, index) => {
      const yOffset = padding + index * pixelSize * (lineHeight / 100) * 1.5;
      
      ctx.font = `${pixelSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      maxWidth = Math.max(maxWidth, textWidth);
      
      // Draw red outline
      ctx.strokeText(name, padding, yOffset);
      
      // Draw hole if enabled
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holePositionPx = holePosition * dpi;
        const holeOverlapPx = holeOverlap * dpi;
        
        let holeX, holeY;
        
        if (holeSide === "left") {
          holeX = padding + holePositionPx;
          holeY = yOffset + pixelSize / 2;
        } else {
          holeX = padding + textWidth + holePositionPx;
          holeY = yOffset + pixelSize / 2;
        }
        
        // Draw outer circle
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2 + holeThicknessPx, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw inner circle
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw connecting line
        ctx.beginPath();
        if (holeSide === "left") {
          ctx.moveTo(holeX + holeDiameterPx / 2 + holeThicknessPx, holeY);
          ctx.lineTo(padding, yOffset + pixelSize / 2);
        } else {
          ctx.moveTo(holeX - holeDiameterPx / 2 - holeThicknessPx, holeY);
          ctx.lineTo(padding + textWidth, yOffset + pixelSize / 2);
        }
        ctx.stroke();
      }
      
      totalHeight = yOffset + pixelSize - padding;
    });

    // Calculate dimensions
    const widthInches = (maxWidth / dpi).toFixed(2);
    const heightInches = (totalHeight / dpi).toFixed(2);
    setDimensions({ width: widthInches, height: heightInches });

    // Generate SVG for export
    await generateSVG(nameList, maxWidth, totalHeight, dpi, pixelSize);
  };

  const generateSVG = async (nameList, maxWidth, totalHeight, dpi, pixelSize) => {
    try {
      // Create SVG with proper viewBox
      const margin = 20;
      const svgWidth = maxWidth + margin * 2;
      const svgHeight = totalHeight + margin * 2;
      
      let svgPaths = '';
      
      nameList.forEach((name, index) => {
        const yOffset = margin + index * pixelSize * (lineHeight / 100) * 1.5;
        
        // For now, use text elements (will be replaced with proper path conversion)
        svgPaths += `<text x="${margin}" y="${yOffset + pixelSize * 0.8}" font-family="${fontFamily}" font-size="${pixelSize}" fill="black" stroke="none">${name}</text>\n`;
        
        // Add hole if enabled
        if (includeHole) {
          const holeDiameterPx = holeDiameter * dpi;
          const holeThicknessPx = holeThickness * dpi;
          const holePositionPx = holePosition * dpi;
          
          let holeX, holeY;
          const textWidth = maxWidth;
          
          if (holeSide === "left") {
            holeX = margin + holePositionPx;
            holeY = yOffset + pixelSize / 2;
          } else {
            holeX = margin + textWidth + holePositionPx;
            holeY = yOffset + pixelSize / 2;
          }
          
          // Create hole as a ring
          const outerRadius = holeDiameterPx / 2 + holeThicknessPx;
          const innerRadius = holeDiameterPx / 2;
          
          svgPaths += `<circle cx="${holeX}" cy="${holeY}" r="${outerRadius}" fill="black" />\n`;
          svgPaths += `<circle cx="${holeX}" cy="${holeY}" r="${innerRadius}" fill="white" />\n`;
          
          // Add connecting line
          if (holeSide === "left") {
            svgPaths += `<line x1="${holeX + outerRadius}" y1="${holeY}" x2="${margin}" y2="${yOffset + pixelSize / 2}" stroke="black" stroke-width="${holeThicknessPx}" stroke-linecap="round" />\n`;
          } else {
            svgPaths += `<line x1="${holeX - outerRadius}" y1="${holeY}" x2="${margin + textWidth}" y2="${yOffset + pixelSize / 2}" stroke="black" stroke-width="${holeThicknessPx}" stroke-linecap="round" />\n`;
          }
        }
      });
      
      const svg = `<svg width="${(svgWidth / dpi).toFixed(3)}in" height="${(svgHeight / dpi).toFixed(3)}in" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
${svgPaths}
</svg>`;
      
      setSvgOutput(svg);
    } catch (error) {
      console.error("SVG generation failed:", error);
      setSvgOutput("");
    }
  };

  const downloadSVG = () => {
    if (!svgOutput) {
      alert("No SVG to download. Please generate a preview first.");
      return;
    }
    
    const blob = new Blob([svgOutput], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const nameList = names.split("\n").filter(n => n.trim());
    link.download = `nametags-${nameList.length}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const ptEquivalent = fontUnit === "in" ? (fontSize * 72).toFixed(0) : fontSize.toFixed(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Canvas Preview */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-auto"
                style={{ minHeight: "400px" }}
              />
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-stone-600">
                {dimensions.width}" × {dimensions.height}"
              </div>
              <Button onClick={downloadSVG}>
                <Download className="w-4 h-4 mr-2" />
                Download SVG
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Names</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder="Enter names (one per line)"
              className="font-mono"
              rows={3}
            />
            <p className="text-xs text-stone-400 mt-2">
              You can create multiple keychains by listing names on separate lines.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={fontUnit === "pt" ? ptEquivalent : fontSize}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    setFontSize(fontUnit === "pt" ? val / 72 : val);
                  }}
                  className="h-9"
                />
              </div>
              <Select value={fontUnit} onValueChange={setFontUnit}>
                <SelectTrigger className="w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">in</SelectItem>
                  <SelectItem value="pt">pt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-stone-400">
              {fontUnit === "in" ? `${ptEquivalent} pt` : `${(fontSize * 72).toFixed(2)} in`} • Font size for the connected text. This determines the overall size for the item.
            </p>
          </CardContent>
        </Card>

        <Card>
          <Collapsible open={fontOpen} onOpenChange={setFontOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-stone-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Font</CardTitle>
                  {fontOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Font</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-96">
                      {Object.entries(fontCategories).map(([category, fonts]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-stone-500 uppercase">
                            {category}
                          </div>
                          {fonts.map(font => (
                            <SelectItem 
                              key={font.name} 
                              value={font.name}
                              className="pl-6"
                            >
                              {font.label}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                      
                      {customFonts.length > 0 && (
                        <div>
                          <div className="px-2 py-1.5 text-xs font-semibold text-stone-500 uppercase">
                            Custom Fonts
                          </div>
                          {customFonts.map(font => (
                            <div key={font.name} className="flex items-center group">
                              <SelectItem 
                                value={font.name}
                                className="pl-6 flex-1"
                              >
                                {font.displayName}
                              </SelectItem>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteCustomFont(font.name);
                                }}
                                className="opacity-0 group-hover:opacity-100 px-2 py-1 text-red-600 hover:text-red-700 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
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
                    className="w-full h-8 text-xs"
                  >
                    <Upload className="w-3 h-3 mr-2" />
                    MY FONT
                  </Button>
                </div>

                <div>
                  <Label className="text-xs">Thicken</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={thicken}
                      onChange={(e) => setThicken(parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                    <span className="text-xs text-stone-500">%</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Letter Spacing</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="0.1"
                      value={letterSpacing}
                      onChange={(e) => setLetterSpacing(parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                    <span className="text-xs text-stone-500">%</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Line Height</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      step="1"
                      min="50"
                      max="200"
                      value={lineHeight}
                      onChange={(e) => setLineHeight(parseFloat(e.target.value) || 100)}
                      className="h-8"
                    />
                    <span className="text-xs text-stone-500">%</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Connect</Label>
                  <Select value={connectMode} onValueChange={setConnectMode}>
                    <SelectTrigger className="h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="letters">letters</SelectItem>
                      <SelectItem value="dots and letters">dots and letters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!showFewerOptions && (
                  <>
                    <div>
                      <Label className="text-xs">Capitalize</Label>
                      <Select value={capitalize} onValueChange={setCapitalize}>
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">none</SelectItem>
                          <SelectItem value="uppercase">UPPERCASE</SelectItem>
                          <SelectItem value="lowercase">lowercase</SelectItem>
                          <SelectItem value="title">Title Case</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Ligatures</Label>
                      <Select value={ligatures} onValueChange={setLigatures}>
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">none</SelectItem>
                          <SelectItem value="standard">standard</SelectItem>
                          <SelectItem value="discretionary">discretionary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFewerOptions(!showFewerOptions)}
                  className="w-full text-xs text-stone-500 hover:text-stone-700"
                >
                  {showFewerOptions ? "Show More Options" : "Show Fewer Options"}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corner Rounding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={cornerRounding}
                onChange={(e) => setCornerRounding(parseFloat(e.target.value) || 0)}
                className="h-8"
              />
              <span className="text-xs text-stone-500">%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <Collapsible open={holeOpen} onOpenChange={setHoleOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-stone-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Hole Size</CardTitle>
                  {holeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Include Hole</Label>
                  <Switch checked={includeHole} onCheckedChange={setIncludeHole} />
                </div>

                {includeHole && (
                  <>
                    <div>
                      <Label className="text-xs">Hole Size</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={holeDiameter}
                          onChange={(e) => setHoleDiameter(parseFloat(e.target.value) || 0.19)}
                          className="h-8"
                        />
                        <span className="text-xs text-stone-500">in</span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1">Size (diameter) of the opening.</p>
                    </div>

                    <div>
                      <Label className="text-xs">Hole Thickness</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={holeThickness}
                          onChange={(e) => setHoleThickness(parseFloat(e.target.value) || 0.12)}
                          className="h-8"
                        />
                        <span className="text-xs text-stone-500">in</span>
                      </div>
                      <p className="text-xs text-stone-400 mt-1">Amount of material around the hole.</p>
                    </div>

                    <div className="pt-2">
                      <Label className="text-xs font-semibold text-stone-600">Hole Position</Label>
                    </div>

                    <div>
                      <Label className="text-xs">Hole Side</Label>
                      <Select value={holeSide} onValueChange={setHoleSide}>
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">left</SelectItem>
                          <SelectItem value="right">right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Hole Position</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={holePosition}
                          onChange={(e) => setHolePosition(parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                        <span className="text-xs text-stone-500">in</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Hole Overlap</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={holeOverlap}
                          onChange={(e) => setHoleOverlap(parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                        <span className="text-xs text-stone-500">in</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
}