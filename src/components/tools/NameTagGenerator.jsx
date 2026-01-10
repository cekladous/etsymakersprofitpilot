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
  const [customFont, setCustomFont] = useState(null);
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
  
  const [fontOpen, setFontOpen] = useState(true);
  const [sizeOpen, setSizeOpen] = useState(true);
  const [holeOpen, setHoleOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const fileInputRef = useRef(null);

  const scriptFonts = [
    "Brush Script MT",
    "Lucida Handwriting",
    "Edwardian Script ITC",
    "Freestyle Script",
    "French Script MT",
    "Kunstler Script",
    "Mistral",
    "Script MT Bold",
    "cursive",
  ];

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
        const fontFace = new FontFace("CustomUploadedFont", `url(${event.target.result})`);
        fontFace.load().then((loadedFont) => {
          document.fonts.add(loadedFont);
          setCustomFont("CustomUploadedFont");
          setFontFamily("CustomUploadedFont");
        }).catch((err) => {
          console.error("Font loading failed:", err);
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate preview and SVG
  useEffect(() => {
    generatePreview();
  }, [names, fontSize, fontUnit, fontFamily, thicken, connectMode, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holeOffsetH, holeOffsetV, holeOverlap]);

  const generatePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !names.trim()) return;

    const ctx = canvas.getContext("2d");
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim());
    
    // Calculate required canvas size
    const padding = 80;
    const gridSize = dpi * 5; // 5 inch grid
    
    // Measure maximum text width
    ctx.font = `italic ${pixelSize}px ${fontFamily}`;
    let maxTextWidth = 0;
    nameList.forEach(name => {
      const width = ctx.measureText(name).width;
      maxTextWidth = Math.max(maxTextWidth, width);
    });
    
    // Add extra space for holes if enabled
    const holeSpace = includeHole ? (holeDiameter + holeOffsetH + holeThickness) * dpi * 2 : 0;
    
    canvas.width = Math.max(1000, maxTextWidth + padding * 2 + holeSpace);
    canvas.height = Math.max(600, nameList.length * (pixelSize * 1.8) + padding * 2);

    // Clear and draw background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw major grid lines (5 inch intervals)
    ctx.strokeStyle = "#d6d3d1";
    ctx.lineWidth = 1.5;
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

    // Draw minor grid lines (1 inch intervals)
    ctx.strokeStyle = "#e7e5e4";
    ctx.lineWidth = 0.5;
    for (let x = padding; x < canvas.width; x += dpi) {
      if ((x - padding) % gridSize !== 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    }
    for (let y = padding; y < canvas.height; y += dpi) {
      if ((y - padding) % gridSize !== 0) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw ruler marks on top
    ctx.fillStyle = "#57534e";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    for (let x = padding; x < canvas.width; x += dpi) {
      const inch = Math.round((x - padding) / dpi);
      ctx.fillText(`${inch}in`, x, 14);
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, 25);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Draw ruler marks on left
    ctx.textAlign = "right";
    for (let y = padding; y < canvas.height; y += dpi) {
      const inch = Math.round((y - padding) / dpi);
      ctx.fillText(`${inch}in`, 35, y + 4);
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(38, y);
      ctx.lineTo(45, y);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Render each name
    let maxWidth = 0;
    let totalHeight = 0;
    const newWarnings = [];

    nameList.forEach((name, index) => {
      const yOffset = padding + index * (pixelSize * 1.8);
      
      // Configure text
      ctx.font = `italic ${pixelSize}px ${fontFamily}`;
      ctx.textBaseline = "alphabetic";
      
      // Measure text
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      maxWidth = Math.max(maxWidth, textWidth);
      
      // Calculate stroke width based on thicken
      const baseStrokeWidth = pixelSize * 0.05; // Base stroke
      const strokeWidth = baseStrokeWidth + (baseStrokeWidth * thicken / 100);
      
      // Draw text as RED OUTLINE only (like reference)
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(name, padding, yOffset + pixelSize * 0.75);
      
      // Connect dots for i, j, and ! to letter body with bridge
      if (connectMode === "dots and letters") {
        const chars = name.split("");
        let xPos = padding;
        
        chars.forEach((char, charIndex) => {
          const charWidth = ctx.measureText(char).width;
          const lowerChar = char.toLowerCase();
          
          if (lowerChar === "i" || lowerChar === "j" || char === "!") {
            const dotCenterX = xPos + charWidth / 2;
            const dotCenterY = yOffset + pixelSize * 0.15;
            const dotRadius = strokeWidth * 1.2;
            
            // Find connection point on letter body (top of stem)
            const stemTopY = yOffset + pixelSize * 0.4;
            
            // Draw bridge connector (small nub from dot to letter)
            const bridgeWidth = strokeWidth * 0.6;
            ctx.beginPath();
            ctx.moveTo(dotCenterX - bridgeWidth / 2, dotCenterY + dotRadius);
            ctx.lineTo(dotCenterX - bridgeWidth / 2, stemTopY);
            ctx.lineTo(dotCenterX + bridgeWidth / 2, stemTopY);
            ctx.lineTo(dotCenterX + bridgeWidth / 2, dotCenterY + dotRadius);
            ctx.closePath();
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
            
            // Draw the dot outline
            ctx.beginPath();
            ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          xPos += charWidth;
        });
      }
      
      // Draw hole with bridge connector if enabled
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holeOffsetHPx = holeOffsetH * dpi;
        const holeOffsetVPx = holeOffsetV * dpi;
        const holeOverlapPx = holeOverlap * dpi;
        
        let holeX, holeY, connectionX, connectionY;
        
        switch (holeSide) {
          case "left":
            holeX = padding - holeOffsetHPx;
            holeY = yOffset + holeOffsetVPx;
            connectionX = padding;
            connectionY = yOffset + pixelSize * 0.4;
            break;
          case "right":
            holeX = padding + textWidth + holeOffsetHPx;
            holeY = yOffset + holeOffsetVPx;
            connectionX = padding + textWidth;
            connectionY = yOffset + pixelSize * 0.4;
            break;
          case "top":
            holeX = padding + textWidth / 2 + holeOffsetHPx;
            holeY = yOffset - holeOffsetVPx;
            connectionX = padding + textWidth / 2;
            connectionY = yOffset + pixelSize * 0.2;
            break;
          case "bottom":
            holeX = padding + textWidth / 2 + holeOffsetHPx;
            holeY = yOffset + pixelSize + holeOffsetVPx;
            connectionX = padding + textWidth / 2;
            connectionY = yOffset + pixelSize * 0.8;
            break;
        }
        
        // Draw outer circle outline
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2 + holeThicknessPx, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw inner circle (the actual hole)
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw bridge connector (small tab connecting hole to text)
        const bridgeWidth = holeThicknessPx * 0.8;
        ctx.beginPath();
        if (holeSide === "left" || holeSide === "right") {
          const midX = (holeX + connectionX) / 2;
          ctx.moveTo(holeX + (holeSide === "left" ? (holeDiameterPx / 2 + holeThicknessPx) : -(holeDiameterPx / 2 + holeThicknessPx)), holeY - bridgeWidth / 2);
          ctx.lineTo(connectionX, connectionY - bridgeWidth / 2);
          ctx.lineTo(connectionX, connectionY + bridgeWidth / 2);
          ctx.lineTo(holeX + (holeSide === "left" ? (holeDiameterPx / 2 + holeThicknessPx) : -(holeDiameterPx / 2 + holeThicknessPx)), holeY + bridgeWidth / 2);
        } else {
          ctx.moveTo(holeX - bridgeWidth / 2, holeY + (holeSide === "top" ? (holeDiameterPx / 2 + holeThicknessPx) : -(holeDiameterPx / 2 + holeThicknessPx)));
          ctx.lineTo(connectionX - bridgeWidth / 2, connectionY);
          ctx.lineTo(connectionX + bridgeWidth / 2, connectionY);
          ctx.lineTo(holeX + bridgeWidth / 2, holeY + (holeSide === "top" ? (holeDiameterPx / 2 + holeThicknessPx) : -(holeDiameterPx / 2 + holeThicknessPx)));
        }
        ctx.closePath();
        ctx.stroke();
        
        // Draw hole indicator (green circle like in reference)
        ctx.fillStyle = "#22c55e";
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2 + holeThicknessPx + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      totalHeight = yOffset + pixelSize - padding;
    });

    // Calculate dimensions in inches (actual text bounds)
    const widthInches = (maxWidth / dpi).toFixed(2);
    const heightInches = ((nameList.length * pixelSize * 1.2) / dpi).toFixed(2);
    setDimensions({ width: widthInches, height: heightInches });
    
    // Draw dimensions at bottom left
    ctx.fillStyle = "#57534e";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`↔ ${widthInches} in   ↕ ${heightInches} in`, 50, canvas.height - 20);

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const nameList = names.split("\n").filter(n => n.trim());
    const dpi = 96;
    
    // Create SVG for each name
    nameList.forEach((name, index) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const pixelSize = getFontSizeInPixels();
      const tempCanvas = document.createElement("canvas");
      const ctx = tempCanvas.getContext("2d");
      
      // Set up temporary canvas
      ctx.font = `${pixelSize}px ${fontFamily}`;
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      const margin = includeHole ? holeDiameter * dpi + holeOffsetH * dpi : 20;
      
      tempCanvas.width = textWidth + margin * 2;
      tempCanvas.height = pixelSize * 1.5 + margin * 2;
      
      // Redraw on temp canvas
      ctx.font = `${pixelSize}px ${fontFamily}`;
      ctx.fillStyle = "#000000";
      ctx.fillText(name, margin, margin);
      
      const strokeWidth = (pixelSize * thicken) / 100;
      if (strokeWidth > 0) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeText(name, margin, margin);
      }
      
      // Convert to SVG
      svg.setAttribute("width", tempCanvas.width);
      svg.setAttribute("height", tempCanvas.height);
      svg.setAttribute("viewBox", `0 0 ${tempCanvas.width} ${tempCanvas.height}`);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      
      const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
      image.setAttribute("href", tempCanvas.toDataURL());
      image.setAttribute("width", tempCanvas.width);
      image.setAttribute("height", tempCanvas.height);
      svg.appendChild(image);
      
      // Download
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.toLowerCase().replace(/\s+/g, "-")}-nametag.svg`;
      link.click();
      URL.revokeObjectURL(url);
    });
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
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white" style={{ maxHeight: "600px" }}>
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "auto" }}
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
                <div>
                  <Label className="text-xs">Size</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={Math.round(fontSize * (fontUnit === "pt" ? 72 : 1))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        setFontSize(fontUnit === "pt" ? val / 72 : val);
                      }}
                      className="flex-1"
                    />
                    <Select value={fontUnit} onValueChange={(v) => {
                      if (v === "pt" && fontUnit === "in") {
                        setFontSize(fontSize * 72);
                      } else if (v === "in" && fontUnit === "pt") {
                        setFontSize(fontSize / 72);
                      }
                      setFontUnit(v);
                    }}>
                      <SelectTrigger className="w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">pt</SelectItem>
                        <SelectItem value="in">in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {fontUnit === "pt" ? `${(fontSize / 72).toFixed(2)} in` : `${Math.round(fontSize * 72)} pt`}
                  </p>
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
                    <SelectContent>
                      {scriptFonts.map(font => (
                        <SelectItem key={font} value={font}>{font}</SelectItem>
                      ))}
                      {customFont && (
                        <SelectItem value={customFont}>Custom Font</SelectItem>
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
                      <SelectItem value="dots and letters">Dots and Letters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <details className="mt-2">
                  <summary className="text-xs font-medium cursor-pointer text-stone-700 hover:text-stone-900">
                    Show More Options
                  </summary>
                  <div className="mt-3">
                    <Label className="text-xs">Corner Rounding: {cornerRounding}%</Label>
                    <Slider
                      value={[cornerRounding]}
                      onValueChange={([v]) => setCornerRounding(v)}
                      min={0}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                  </div>
                </details>
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