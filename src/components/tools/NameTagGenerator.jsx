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
  const [connectMode, setConnectMode] = useState("letters");

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
  }, [names, fontSize, fontUnit, fontFamily, thicken, connectMode, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holeOffsetH, holeOffsetV, holeOverlap, customFonts, background]);

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
      
      // Draw text with connection logic
      if (connectMode === "letters" || connectMode === "dots and letters") {
        const textColor = background === "dark" ? "#fafaf9" : "#1c1917";
        ctx.fillStyle = textColor;
        ctx.strokeStyle = textColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        
        // Draw the full text as one connected piece
        ctx.fillText(name, padding, yOffset);
        if (strokeWidth > 0) {
          ctx.strokeText(name, padding, yOffset);
        }
        
        // Connect dots for i, j, ! if mode is "dots and letters"
        if (connectMode === "dots and letters") {
          const chars = name.split("");
          let xPos = padding;
          chars.forEach((char) => {
            const charWidth = ctx.measureText(char).width;
            if (char.toLowerCase() === "i" || char.toLowerCase() === "j") {
              // Draw thin vertical line connecting dot to stem
              ctx.beginPath();
              ctx.moveTo(xPos + charWidth / 2, yOffset + pixelSize * 0.25);
              ctx.lineTo(xPos + charWidth / 2, yOffset + pixelSize * 0.05);
              ctx.lineWidth = Math.max(pixelSize * 0.03, 2);
              ctx.strokeStyle = textColor;
              ctx.lineCap = "round";
              ctx.stroke();
            }
            xPos += charWidth;
          });
        }
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
      
      // Draw text as connected
      ctx.fillText(name, margin, yOffset);
      
      if (strokeWidth > 0) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeText(name, margin, yOffset);
      }
      
      // Connect dots for i, j if mode is "dots and letters"
      if (connectMode === "dots and letters") {
        const chars = name.split("");
        let xPos = margin;
        chars.forEach((char) => {
          const charWidth = ctx.measureText(char).width;
          if (char.toLowerCase() === "i" || char.toLowerCase() === "j") {
            // Draw thin vertical line connecting dot to stem
            ctx.beginPath();
            ctx.moveTo(xPos + charWidth / 2, yOffset + pixelSize * 0.25);
            ctx.lineTo(xPos + charWidth / 2, yOffset + pixelSize * 0.05);
            ctx.lineWidth = Math.max(pixelSize * 0.03, 2);
            ctx.strokeStyle = "#000000";
            ctx.lineCap = "round";
            ctx.stroke();
          }
          xPos += charWidth;
        });
      }
      
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
              rows={6}
            />
            <p className="text-xs text-stone-500 mt-2">
              Each line generates a separate tag
            </p>
          </CardContent>
        </Card>

        <Card>
          <Collapsible open={sizeOpen} onOpenChange={setSizeOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-stone-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Sizing</CardTitle>
                  {sizeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Font Size</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseFloat(e.target.value) || 1)}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Unit</Label>
                    <Select value={fontUnit} onValueChange={setFontUnit}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">in</SelectItem>
                        <SelectItem value="pt">pt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
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
                  <Label className="text-xs">Thicken: {thicken}%</Label>
                  <Slider
                    value={[thicken]}
                    onValueChange={([v]) => setThicken(v)}
                    min={0}
                    max={50}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-xs">Connect Mode</Label>
                  <Select value={connectMode} onValueChange={setConnectMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="letters">Letters Only</SelectItem>
                      <SelectItem value="dots and letters">Connect All (Welded)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-stone-500 mt-1">
                    {connectMode === "dots and letters" ? "Bridges connect letters for single-cut path" : "Individual letters"}
                  </p>
                </div>



                <div>
                  <Label className="text-xs">Corner Rounding: {cornerRounding}%</Label>
                  <Slider
                    value={[cornerRounding]}
                    onValueChange={([v]) => setCornerRounding(v)}
                    min={0}
                    max={100}
                    step={10}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={holeOpen} onOpenChange={setHoleOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-stone-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Hole Options</CardTitle>
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
                      <Label className="text-xs">Hole Diameter (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        min="0.125"
                        value={holeDiameter}
                        onChange={(e) => setHoleDiameter(parseFloat(e.target.value) || 0.25)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Hole Thickness (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        min="0.0625"
                        value={holeThickness}
                        onChange={(e) => setHoleThickness(parseFloat(e.target.value) || 0.125)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Position</Label>
                      <Select value={holeSide} onValueChange={setHoleSide}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Horizontal Offset (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        value={holeOffsetH}
                        onChange={(e) => setHoleOffsetH(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Vertical Offset (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        value={holeOffsetV}
                        onChange={(e) => setHoleOffsetV(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Overlap (in)</Label>
                      <Input
                        type="number"
                        step="0.0625"
                        min="0"
                        value={holeOverlap}
                        onChange={(e) => setHoleOverlap(parseFloat(e.target.value) || 0)}
                      />
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