import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showFewerOptions, setShowFewerOptions] = useState(false);
  const [cornerRounding, setCornerRounding] = useState(0.5);
  const [includeHole, setIncludeHole] = useState(false);
  const [holeDiameter, setHoleDiameter] = useState(0.19);
  const [holeThickness, setHoleThickness] = useState(0.12);
  const [holeSide, setHoleSide] = useState("left");
  const [holeOffsetV, setHoleOffsetV] = useState(-0.5);
  const [holeOverlap, setHoleOverlap] = useState(0.05);
  const [warnings, setWarnings] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const [fontOpen, setFontOpen] = useState(true);
  const [holeOpen, setHoleOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const paperScopeRef = useRef(null);

  const systemFonts = {
    script: [
      { name: "Brush Script MT", label: "Brush Script" },
      { name: "Lucida Handwriting", label: "Lucida Handwriting" },
      { name: "Edwardian Script ITC", label: "Edwardian Script" },
      { name: "Freestyle Script", label: "Freestyle Script" },
      { name: "French Script MT", label: "French Script" },
      { name: "Kunstler Script", label: "Kunstler Script" },
      { name: "Mistral", label: "Mistral" },
      { name: "Script MT Bold", label: "Script Bold" },
    ],
    cursive: [
      { name: "cursive", label: "Default Cursive" },
    ],
    serif: [
      { name: "serif", label: "Serif" },
      { name: "Georgia", label: "Georgia" },
    ],
    modern: [
      { name: "sans-serif", label: "Sans Serif" },
      { name: "Arial", label: "Arial" },
    ]
  };

  // Load custom fonts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('nametag-custom-fonts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCustomFonts(parsed);
        parsed.forEach(font => {
          const fontFace = new FontFace(font.name, `url(${font.data})`);
          fontFace.load().then(loadedFont => {
            document.fonts.add(loadedFont);
          }).catch(err => console.error("Font reload failed:", err));
        });
      } catch (e) {
        console.error("Failed to load custom fonts:", e);
      }
    }
  }, []);

  // Initialize Paper.js
  useEffect(() => {
    if (canvasRef.current && !paperScopeRef.current) {
      paperScopeRef.current = new paper.PaperScope();
      paperScopeRef.current.setup(canvasRef.current);
    }
  }, []);

  // Load font for vector rendering
  useEffect(() => {
    const customFont = customFonts.find(f => f.name === fontFamily);
    if (customFont) {
      fetch(customFont.data)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          const font = opentype.parse(buffer);
          setLoadedFont(font);
        })
        .catch(err => console.error("Failed to load custom font:", err));
    } else {
      setLoadedFont(null);
    }
  }, [fontFamily, customFonts]);

  const getFontSizeInPixels = () => {
    const dpi = 96;
    if (fontUnit === "pt") {
      return (fontSize * dpi) / 72;
    } else {
      return fontSize * dpi;
    }
  };

  const handleFontUpload = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith(".ttf") || file.name.endsWith(".otf"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const fontName = file.name.replace(/\.(ttf|otf)$/, '').replace(/[^a-zA-Z0-9]/g, '');
        const uniqueFontName = `Custom_${fontName}_${Date.now()}`;
        
        const fontFace = new FontFace(uniqueFontName, `url(${event.target.result})`);
        fontFace.load().then((loadedFont) => {
          document.fonts.add(loadedFont);
          
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
        }).catch((err) => {
          console.error("Font loading failed:", err);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteCustomFont = (fontName) => {
    const updatedFonts = customFonts.filter(f => f.name !== fontName);
    setCustomFonts(updatedFonts);
    localStorage.setItem('nametag-custom-fonts', JSON.stringify(updatedFonts));
    
    if (fontFamily === fontName) {
      setFontFamily("Brush Script MT");
    }
  };

  const applyCapitalization = (text) => {
    if (capitalize === "uppercase") return text.toUpperCase();
    if (capitalize === "lowercase") return text.toLowerCase();
    if (capitalize === "title") return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return text;
  };

  useEffect(() => {
    generatePreview();
  }, [names, fontSize, fontUnit, fontFamily, thicken, letterSpacing, lineHeight, connectMode, capitalize, ligatures, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holeOffsetV, holeOverlap, loadedFont]);

  const generatePreview = () => {
    const canvas = canvasRef.current;
    const scope = paperScopeRef.current;
    if (!canvas || !scope || !names.trim()) return;

    const ctx = canvas.getContext("2d");
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim()).map(n => applyCapitalization(n));
    
    const padding = dpi; // 1 inch padding
    const gridSize = dpi; // 1 inch grid
    
    canvas.width = 1200;
    canvas.height = Math.max(400, nameList.length * pixelSize * (lineHeight / 100) * 1.5 + padding * 2);

    // Clear canvas with white background
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

    // Render each name with red outline
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
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = Math.max(2, pixelSize * (thicken / 100));
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(name, padding, yOffset);
      
      totalHeight = yOffset + pixelSize - padding;
    });

    const widthInches = (maxWidth / dpi).toFixed(2);
    const heightInches = (totalHeight / dpi).toFixed(2);
    setDimensions({ width: widthInches, height: heightInches });

    // Validation
    const newWarnings = [];
    if (thicken < 0.5) {
      newWarnings.push("Thicken percentage below 0.5% may be too thin for reliable laser cutting");
    }
    if (fontSize < 1 && fontUnit === "in") {
      newWarnings.push("Font size below 1 inch may produce fragile results");
    }
    setWarnings(newWarnings);
  };

  const downloadSVG = () => {
    if (!paperScopeRef.current || !names.trim()) return;

    const scope = paperScopeRef.current;
    scope.activate();
    scope.project.clear();

    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim()).map(n => applyCapitalization(n));
    
    const padding = 20;
    const spacing = pixelSize * (lineHeight / 100) * 1.5;
    
    let allShapes = [];
    let maxWidth = 0;
    let totalHeight = 0;

    nameList.forEach((name, index) => {
      const yOffset = padding + index * spacing;
      
      // Create text path using canvas measurement as fallback
      const tempCanvas = document.createElement("canvas");
      const ctx = tempCanvas.getContext("2d");
      ctx.font = `${pixelSize}px ${fontFamily}`;
      const textWidth = ctx.measureText(name).width;
      maxWidth = Math.max(maxWidth, textWidth);
      
      // Create text as compound path
      const textPath = new scope.CompoundPath({
        children: []
      });
      
      // Draw each character
      let xPos = padding;
      for (let i = 0; i < name.length; i++) {
        const char = name[i];
        const charPath = new scope.PointText({
          point: [xPos, yOffset],
          content: char,
          fontSize: pixelSize,
          fontFamily: fontFamily
        });
        
        const outline = charPath.toPath(false);
        if (outline) {
          textPath.addChild(outline);
        }
        charPath.remove();
        
        const charWidth = ctx.measureText(char).width;
        xPos += charWidth * (1 + letterSpacing / 100);
      }
      
      // Apply thickening via offset
      if (thicken > 0) {
        const offsetAmount = (pixelSize * thicken) / 100;
        const expanded = textPath.unite(textPath.clone().scale(1 + offsetAmount / 100));
        textPath.remove();
        allShapes.push(expanded);
      } else {
        allShapes.push(textPath);
      }
      
      totalHeight = yOffset + pixelSize;
    });

    // Unite all shapes if "connect all" mode
    let finalShape;
    if (connectMode === "dots and letters" && allShapes.length > 0) {
      finalShape = allShapes[0];
      for (let i = 1; i < allShapes.length; i++) {
        const united = finalShape.unite(allShapes[i]);
        finalShape.remove();
        allShapes[i].remove();
        finalShape = united;
      }
    } else {
      finalShape = new scope.Group(allShapes);
    }

    // Export as SVG
    const svgString = scope.project.exportSVG({ asString: true });
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nametags-${nameList.length}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    
    scope.project.clear();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Canvas Preview */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-4">
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white relative">
              <canvas
                ref={canvasRef}
                className="w-full h-auto"
                style={{ minHeight: "400px" }}
              />
              <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs font-mono border border-stone-300">
                {dimensions.width}" × {dimensions.height}"
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={downloadSVG} className="w-full bg-blue-500 hover:bg-blue-600">
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Names</CardTitle>
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={fontUnit === "pt" ? Math.round(fontSize * 72) : fontSize}
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
                  <SelectItem value="pt">pt</SelectItem>
                  <SelectItem value="in">in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-stone-400">
              Font size for the connected text. This determines the overall size for the item.
            </p>
          </CardContent>
        </Card>

        <Card>
          <Collapsible open={fontOpen} onOpenChange={setFontOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-stone-50 pb-3">
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
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-96">
                      {Object.entries(systemFonts).map(([category, fonts]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-stone-500 uppercase">
                            {category}
                          </div>
                          {fonts.map(font => (
                            <SelectItem 
                              key={font.name} 
                              value={font.name}
                              style={{ fontFamily: font.name }}
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
                            My Custom Fonts
                          </div>
                          {customFonts.map(font => (
                            <SelectItem 
                              key={font.name}
                              value={font.name}
                              style={{ fontFamily: font.name }}
                              className="pl-6"
                            >
                              {font.displayName}
                            </SelectItem>
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
                    className="w-full"
                    size="sm"
                  >
                    <Upload className="w-3 h-3 mr-2" />
                    Upload TTF/OTF
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
                      value={thicken.toFixed(1)}
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
                      value={letterSpacing.toFixed(1)}
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Corner Rounding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={cornerRounding.toFixed(1)}
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
              <CardHeader className="cursor-pointer hover:bg-stone-50 pb-3">
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
                          value={holeOffsetV}
                          onChange={(e) => setHoleOffsetV(parseFloat(e.target.value) || 0)}
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
    </div>
  );
}