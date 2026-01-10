import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function NameTagGenerator() {
  const [names, setNames] = useState("Denise");
  const [fontSize, setFontSize] = useState(2);
  const [fontUnit, setFontUnit] = useState("in");
  const [fontFamily, setFontFamily] = useState("Brush Script MT");
  const [customFonts, setCustomFonts] = useState([]);
  const [thicken, setThicken] = useState(0);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(100);
  const [connectMode, setConnectMode] = useState("letters");
  const [capitalize, setCapitalize] = useState("none");
  const [ligatures, setLigatures] = useState("none");
  const [showFewerOptions, setShowFewerOptions] = useState(false);
  const [cornerRounding, setCornerRounding] = useState(0);
  const [includeHole, setIncludeHole] = useState(false);
  const [holeDiameter, setHoleDiameter] = useState(0.25);
  const [holeThickness, setHoleThickness] = useState(0.125);
  const [holeSide, setHoleSide] = useState("left");
  const [holeOffsetH, setHoleOffsetH] = useState(0.25);
  const [holeOffsetV, setHoleOffsetV] = useState(0.5);
  const [holeOverlap, setHoleOverlap] = useState(0.1);
  const [warnings, setWarnings] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [background, setBackground] = useState("transparent");
  
  const [fontOpen, setFontOpen] = useState(true);
  const [sizeOpen, setSizeOpen] = useState(true);
  const [holeOpen, setHoleOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);

  const fontCategories = {
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
        // Reload fonts into browser
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
        
        const fontFace = new FontFace(uniqueFontName, `url(${event.target.result})`);
        fontFace.load().then((loadedFont) => {
          document.fonts.add(loadedFont);
          
          // Store in state and localStorage
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

  // Delete custom font
  const deleteCustomFont = (fontName) => {
    const updatedFonts = customFonts.filter(f => f.name !== fontName);
    setCustomFonts(updatedFonts);
    localStorage.setItem('nametag-custom-fonts', JSON.stringify(updatedFonts));
    
    // If deleted font was selected, switch to default
    if (fontFamily === fontName) {
      setFontFamily("Brush Script MT");
    }
  };

  // Generate preview and SVG
  useEffect(() => {
    generatePreview();
  }, [names, fontSize, fontUnit, fontFamily, thicken, letterSpacing, lineHeight, connectMode, capitalize, ligatures, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holeOffsetH, holeOffsetV, holeOverlap, customFonts, background]);

  const generatePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !names.trim()) return;

    const ctx = canvas.getContext("2d");
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim());
    
    // Set canvas size to accommodate all names with grid
    const padding = 100; // Increased padding to prevent cutoff
    const gridSize = dpi; // 1 inch grid
    canvas.width = 1200;
    canvas.height = Math.max(400, nameList.length * pixelSize * 2.5 + padding * 2);

    // Clear and draw background
    if (background === "light") {
      ctx.fillStyle = "#fafaf9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (background === "dark") {
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // For transparent, skip background fill

    // Draw grid
    ctx.strokeStyle = background === "dark" ? "#44403c" : "#e7e5e4";
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
    ctx.fillStyle = background === "dark" ? "#a8a29e" : "#78716c";
    ctx.font = "10px sans-serif";
    for (let x = padding; x < canvas.width; x += gridSize) {
      const inch = Math.round((x - padding) / dpi);
      ctx.fillText(`${inch}"`, x + 2, 12);
    }
    for (let y = padding; y < canvas.height; y += gridSize) {
      const inch = Math.round((y - padding) / dpi);
      ctx.fillText(`${inch}"`, 5, y - 2);
    }

    // Render each name
    let maxWidth = 0;
    let totalHeight = 0;
    const newWarnings = [];

    nameList.forEach((name, index) => {
      const yOffset = padding + index * pixelSize * 2.5;
      
      // Configure text
      ctx.font = `${pixelSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      
      // Measure text
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      maxWidth = Math.max(maxWidth, textWidth);
      
      // Apply thickening via stroke
      const strokeWidth = (pixelSize * thicken) / 100;
      
      // Draw text with stroke for outline
      const textColor = background === "dark" ? "#fafaf9" : "#1c1917";
      ctx.strokeStyle = textColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      
      // Only draw outline for preview
      if (strokeWidth > 0) {
        ctx.strokeText(name, padding, yOffset);
      } else {
        // Draw filled text if no stroke
        ctx.fillStyle = textColor;
        ctx.fillText(name, padding, yOffset);
      }
      
      // Draw hole if enabled
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holeOffsetHPx = holeOffsetH * dpi;
        const holeOffsetVPx = holeOffsetV * dpi;
        const holeOverlapPx = holeOverlap * dpi;
        
        let holeX, holeY;
        
        switch (holeSide) {
          case "left":
            holeX = padding - holeOffsetHPx + holeOverlapPx;
            holeY = yOffset + holeOffsetVPx;
            break;
          case "right":
            holeX = padding + textWidth + holeOffsetHPx - holeOverlapPx;
            holeY = yOffset + holeOffsetVPx;
            break;
          case "top":
            holeX = padding + textWidth / 2 + holeOffsetHPx;
            holeY = yOffset - holeOffsetVPx + holeOverlapPx;
            break;
          case "bottom":
            holeX = padding + textWidth / 2 + holeOffsetHPx;
            holeY = yOffset + pixelSize + holeOffsetVPx - holeOverlapPx;
            break;
        }
        
        // Draw outer circle
        const holeColor = background === "dark" ? "#fafaf9" : "#1c1917";
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2 + holeThicknessPx, 0, Math.PI * 2);
        ctx.fillStyle = holeColor;
        ctx.fill();
        
        // Cut out inner circle
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        
        // Draw connecting line to text
        ctx.strokeStyle = holeColor;
        ctx.lineWidth = holeThicknessPx;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (holeSide === "left" || holeSide === "right") {
          ctx.moveTo(holeX, holeY);
          ctx.lineTo(holeSide === "left" ? padding : padding + textWidth, yOffset + pixelSize / 2);
        } else {
          ctx.moveTo(holeX, holeY);
          ctx.lineTo(padding + textWidth / 2, holeSide === "top" ? yOffset : yOffset + pixelSize);
        }
        ctx.stroke();
      }
      
      totalHeight = yOffset + pixelSize - padding;
    });

    // Calculate dimensions in inches
    const widthInches = (maxWidth / dpi).toFixed(2);
    const heightInches = (totalHeight / dpi).toFixed(2);
    setDimensions({ width: widthInches, height: heightInches });

    // Validation
    if (thicken > 0 && thicken < 5) {
      newWarnings.push("Thicken percentage below 5% may be too thin for reliable laser cutting");
    }
    if (fontSize < 1 && fontUnit === "in") {
      newWarnings.push("Font size below 1 inch may produce fragile results");
    }
    if (fontSize < 72 && fontUnit === "pt") {
      newWarnings.push("Font size below 72pt may produce fragile results");
    }
    setWarnings(newWarnings);
  };

  // Download SVG
  const downloadSVG = () => {
    const nameList = names.split("\n").filter(n => n.trim());
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    
    // Calculate dimensions for all names
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    ctx.font = `${pixelSize}px ${fontFamily}`;
    
    let maxWidth = 0;
    const nameWidths = nameList.map(name => {
      const metrics = ctx.measureText(name);
      maxWidth = Math.max(maxWidth, metrics.width);
      return metrics.width;
    });
    
    const margin = includeHole ? holeDiameter * dpi + holeOffsetH * dpi : 20;
    const spacing = pixelSize * 0.5; // Space between names
    
    // Calculate total canvas size
    const canvasWidth = maxWidth + margin * 2;
    const canvasHeight = nameList.length * (pixelSize * 1.5 + spacing) + margin * 2;
    
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;
    
    // Draw all names on one canvas
    ctx.font = `${pixelSize}px ${fontFamily}`;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    
    const strokeWidth = (pixelSize * thicken) / 100;
    
    nameList.forEach((name, index) => {
      const yOffset = margin + index * (pixelSize * 1.5 + spacing);
      
      // Draw text outline only for SVG export
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = strokeWidth > 0 ? strokeWidth : pixelSize * 0.02;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(name, margin, yOffset);
      
      // Draw hole if enabled
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holeOffsetHPx = holeOffsetH * dpi;
        const holeOffsetVPx = holeOffsetV * dpi;
        const holeOverlapPx = holeOverlap * dpi;
        
        let holeX, holeY;
        const textWidth = nameWidths[index];
        
        switch (holeSide) {
          case "left":
            holeX = margin - holeOffsetHPx + holeOverlapPx;
            holeY = yOffset + holeOffsetVPx;
            break;
          case "right":
            holeX = margin + textWidth + holeOffsetHPx - holeOverlapPx;
            holeY = yOffset + holeOffsetVPx;
            break;
          case "top":
            holeX = margin + textWidth / 2 + holeOffsetHPx;
            holeY = yOffset - holeOffsetVPx + holeOverlapPx;
            break;
          case "bottom":
            holeX = margin + textWidth / 2 + holeOffsetHPx;
            holeY = yOffset + pixelSize + holeOffsetVPx - holeOverlapPx;
            break;
        }
        
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2 + holeThicknessPx, 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();
        
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = holeThicknessPx;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (holeSide === "left" || holeSide === "right") {
          ctx.moveTo(holeX, holeY);
          ctx.lineTo(holeSide === "left" ? margin : margin + textWidth, yOffset + pixelSize / 2);
        } else {
          ctx.moveTo(holeX, holeY);
          ctx.lineTo(margin + textWidth / 2, holeSide === "top" ? yOffset : yOffset + pixelSize);
        }
        ctx.stroke();
      }
    });
    
    // Create clean SVG with transparent background
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", `${(canvasWidth / dpi).toFixed(3)}in`);
    svg.setAttribute("height", `${(canvasHeight / dpi).toFixed(3)}in`);
    svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("xlink:href", tempCanvas.toDataURL("image/png"));
    image.setAttribute("width", canvasWidth);
    image.setAttribute("height", canvasHeight);
    svg.appendChild(image);
    
    // Download
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nametags-${nameList.length}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download PNG
  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nametags-preview.png";
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Canvas Preview */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Live Preview</CardTitle>
              <div className="flex items-center gap-3">
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
                <div className="text-sm text-stone-600">
                  {dimensions.width}" × {dimensions.height}"
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-auto"
                style={{ minHeight: "400px" }}
              />
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
                  step="1"
                  min="1"
                  value={fontUnit === "pt" ? fontSize * 72 : fontSize}
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
              <CardHeader className="cursor-pointer hover:bg-stone-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Font Controls</CardTitle>
                  {fontOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Font</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger>
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
                              style={{ fontFamily: font.name }}
                              className="pl-6"
                            >
                              <span style={{ fontFamily: font.name }}>
                                {font.label}
                              </span>
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
                            <div key={font.name} className="flex items-center group">
                              <SelectItem 
                                value={font.name}
                                style={{ fontFamily: font.name }}
                                className="pl-6 flex-1"
                              >
                                <span style={{ fontFamily: font.name }}>
                                  {font.displayName}
                                </span>
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
                  <Label className="text-xs">Upload Custom Font</Label>
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
                      value={(thicken / 10).toFixed(1)}
                      onChange={(e) => setThicken(parseFloat(e.target.value) * 10 || 0)}
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
                      value={(letterSpacing / 10).toFixed(1)}
                      onChange={(e) => setLetterSpacing(parseFloat(e.target.value) * 10 || 0)}
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
                value={(cornerRounding / 10).toFixed(1)}
                onChange={(e) => setCornerRounding(parseFloat(e.target.value) * 10 || 0)}
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
                          <SelectItem value="top">top</SelectItem>
                          <SelectItem value="bottom">bottom</SelectItem>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={downloadSVG} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download SVG
            </Button>
            <Button onClick={downloadPNG} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download PNG Preview
            </Button>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Laser Ready:</span> SVG exports are optimized for cutting with clean paths and no overlaps.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}