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

export default function NameTagGenerator() {
  const [names, setNames] = useState("Christina");
  const [fontSize, setFontSize] = useState(2);
  const [fontUnit, setFontUnit] = useState("in");
  const [fontFamily, setFontFamily] = useState("cursive");
  const [customFonts, setCustomFonts] = useState([]);
  const [loadedFonts, setLoadedFonts] = useState({});
  
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
  const [svgPaths, setSvgPaths] = useState("");
  
  const [fontOpen, setFontOpen] = useState(true);
  const [holeOpen, setHoleOpen] = useState(false);
  
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);

  const DPI = 96;

  // Load custom fonts from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('nametag-custom-fonts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCustomFonts(parsed);
        // Load fonts
        parsed.forEach(font => {
          loadCustomFont(font);
        });
      } catch (e) {
        console.error("Failed to load custom fonts:", e);
      }
    }
  }, []);

  const loadCustomFont = async (fontData) => {
    try {
      const response = await fetch(fontData.data);
      const arrayBuffer = await response.arrayBuffer();
      const font = opentype.parse(arrayBuffer);
      setLoadedFonts(prev => ({ ...prev, [fontData.name]: font }));
    } catch (e) {
      console.error("Failed to parse font:", e);
    }
  };

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
        loadCustomFont(newFont);
        setFontFamily(uniqueFontName);
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteCustomFont = (fontName) => {
    const updatedFonts = customFonts.filter(f => f.name !== fontName);
    setCustomFonts(updatedFonts);
    localStorage.setItem('nametag-custom-fonts', JSON.stringify(updatedFonts));
    const newLoadedFonts = { ...loadedFonts };
    delete newLoadedFonts[fontName];
    setLoadedFonts(newLoadedFonts);
    if (fontFamily === fontName) {
      setFontFamily("cursive");
    }
  };

  const getFontSizeInPixels = () => {
    if (fontUnit === "pt") {
      return (fontSize * DPI) / 72;
    } else {
      return fontSize * DPI;
    }
  };

  const applyCapitalization = (text) => {
    switch (capitalize) {
      case "uppercase": return text.toUpperCase();
      case "lowercase": return text.toLowerCase();
      case "title": return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      default: return text;
    }
  };

  // Generate preview whenever inputs change
  useEffect(() => {
    generatePreview();
  }, [names, fontSize, fontUnit, fontFamily, thicken, letterSpacing, lineHeight, connectMode, capitalize, ligatures, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holePosition, holeOverlap, loadedFonts]);

  const generatePreview = async () => {
    if (!names.trim()) {
      setSvgPaths("");
      setDimensions({ width: 0, height: 0 });
      return;
    }

    const nameList = names.split("\n").filter(n => n.trim()).map(n => applyCapitalization(n.trim()));
    const pixelSize = getFontSizeInPixels();
    
    try {
      // Generate SVG paths for all names
      let allPaths = [];
      let maxWidth = 0;
      let yOffset = 0;

      for (let i = 0; i < nameList.length; i++) {
        const name = nameList[i];
        const pathData = await generateTextPath(name, 0, yOffset, pixelSize);
        
        if (pathData) {
          allPaths.push(pathData);
          maxWidth = Math.max(maxWidth, pathData.width);
          yOffset += pixelSize * (lineHeight / 100) * 1.2;
        }
      }

      // Calculate dimensions
      const totalHeight = yOffset;
      const widthInches = (maxWidth / DPI).toFixed(2);
      const heightInches = (totalHeight / DPI).toFixed(2);
      setDimensions({ width: widthInches, height: heightInches });

      // Create SVG paths string
      const pathsString = allPaths.map(p => p.path).join('\n');
      setSvgPaths(pathsString);
      
    } catch (error) {
      console.error("Preview generation failed:", error);
    }
  };

  const generateTextPath = async (text, x, y, size) => {
    // Measure text width
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${size}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const width = metrics.width * (1 + letterSpacing / 100);

    // Render text with proper styling - using dominant-baseline for better positioning
    const letterSpacingValue = letterSpacing * size / 100;
    
    return {
      path: `<text x="${x}" y="${y + size}" font-family="${fontFamily}" font-size="${size}" fill="none" stroke="#ef4444" stroke-width="2" letter-spacing="${letterSpacingValue}" dominant-baseline="alphabetic">${text}</text>`,
      width: width,
      height: size
    };
  };

  const downloadSVG = () => {
    if (!svgPaths) {
      alert("No SVG to download. Please generate a preview first.");
      return;
    }

    const margin = 20;
    const width = parseFloat(dimensions.width) * DPI + margin * 2;
    const height = parseFloat(dimensions.height) * DPI + margin * 2;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${dimensions.width}in" height="${dimensions.height}in" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${margin}, ${margin})">
    ${svgPaths}
  </g>
</svg>`;
    
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const nameList = names.split("\n").filter(n => n.trim());
    link.download = `nametags-${nameList.length}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const ptEquivalent = fontUnit === "in" ? Math.round(fontSize * 72) : Math.round(fontSize);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Canvas Preview */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative bg-white">
              <svg 
                ref={svgRef}
                width="100%" 
                height="500" 
                viewBox="0 0 1200 500"
                className="w-full"
                style={{ backgroundColor: '#fafafa' }}
              >
                {/* Grid */}
                <defs>
                  <pattern id="grid" width={DPI} height={DPI} patternUnits="userSpaceOnUse">
                    <path d={`M ${DPI} 0 L 0 0 0 ${DPI}`} fill="none" stroke="#d4d4d8" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                
                {/* Rulers - horizontal */}
                {[...Array(13)].map((_, i) => (
                  <text key={`ruler-h-${i}`} x={i * DPI + 2} y="12" fontSize="9" fill="#a8a29e" fontFamily="monospace">{i}"</text>
                ))}
                
                {/* Rulers - vertical */}
                {[...Array(6)].map((_, i) => (
                  <text key={`ruler-v-${i}`} x="2" y={i * DPI + 12} fontSize="9" fill="#a8a29e" fontFamily="monospace">{i}"</text>
                ))}
                
                {/* Preview content */}
                <g transform="translate(50, 50)" dangerouslySetInnerHTML={{ __html: svgPaths }} />
                
                {/* Dimensions readout - bottom left */}
                <text x="10" y="485" fontSize="11" fill="#78716c" fontFamily="monospace">
                  {dimensions.width}" × {dimensions.height}"
                </text>
              </svg>
              
              {/* Download button overlay */}
              <div className="absolute bottom-4 right-4">
                <Button onClick={downloadSVG} size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download SVG
                </Button>
              </div>
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
              {fontUnit === "in" ? `${ptEquivalent} pt` : `${(fontSize).toFixed(2)} in`} • Font size for the connected text
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
                      <SelectItem value="cursive">Cursive</SelectItem>
                      <SelectItem value="'Brush Script MT'">Brush Script</SelectItem>
                      <SelectItem value="'Lucida Handwriting'">Lucida Handwriting</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      
                      {customFonts.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-stone-500 uppercase">
                            Custom Fonts
                          </div>
                          {customFonts.map(font => (
                            <div key={font.name} className="flex items-center group">
                              <SelectItem value={font.name} className="pl-6 flex-1">
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
                        </>
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
                      <SelectItem value="connect all (welded)">connect all (welded)</SelectItem>
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