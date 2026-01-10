import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Upload, RotateCcw, ChevronDown, Maximize2 } from "lucide-react";

export default function NameTagGenerator() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [names, setNames] = useState("Denise");
  const [fontSize, setFontSize] = useState(2.0); // Default in inches
  const [fontUnit, setFontUnit] = useState("in"); // Default to inches
  
  // Clamp font size to prevent blank preview
  const clampedFontSize = Math.max(0.25, Math.min(12, fontSize));
  const [fontFamily, setFontFamily] = useState("Tempting");
  const [customFont, setCustomFont] = useState(null);
  const [thicken, setThicken] = useState(1.5);
  const [connectMode, setConnectMode] = useState("dots and letters");
  const [cornerRounding, setCornerRounding] = useState(0.5);
  
  const [includeHole, setIncludeHole] = useState(false);
  const [holeDiameter, setHoleDiameter] = useState(0.19);
  const [holeThickness, setHoleThickness] = useState(0.12);
  const [holeSide, setHoleSide] = useState("left");
  const [holeOffsetH, setHoleOffsetH] = useState(-0.50);
  const [holeOffsetV, setHoleOffsetV] = useState(0.05);
  const [holeOverlap, setHoleOverlap] = useState(0.05);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [debugInfo, setDebugInfo] = useState(null);

  const scriptFonts = [
    "Tempting",
    "Brush Script MT",
    "Lucida Handwriting",
    "cursive",
    "serif",
    "sans-serif",
  ];

  const getFontSizeInPixels = () => {
    const dpi = 96;
    const size = clampedFontSize;
    if (fontUnit === "pt") {
      return (size * dpi) / 72;
    } else {
      return size * dpi;
    }
  };

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
    
    // Validate pixelSize
    if (!pixelSize || !isFinite(pixelSize) || pixelSize <= 0) {
      console.error("Invalid pixel size:", pixelSize);
      return;
    }
    
    // STEP 1: Measure all text and compute FINAL geometry bounds
    ctx.font = `italic ${pixelSize}px ${fontFamily}`;
    
    const tags = nameList.map((name, index) => {
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      const textHeight = pixelSize;
      
      // Apply thickness offset (simulate path expansion)
      const thicknessOffset = (pixelSize * thicken) / 100;
      
      // Base text bounds with thickness
      let minX = -thicknessOffset;
      let minY = -thicknessOffset;
      let maxX = textWidth + thicknessOffset;
      let maxY = textHeight + thicknessOffset;
      
      // Include hole bounds if enabled
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holeOffsetHPx = holeOffsetH * dpi;
        const holeOffsetVPx = holeOffsetV * dpi;
        const holeRadius = holeDiameterPx / 2 + holeThicknessPx;
        
        let holeX = 0, holeY = 0;
        switch (holeSide) {
          case "left":
            holeX = holeOffsetHPx;
            holeY = textHeight * 0.4 + holeOffsetVPx;
            break;
          case "right":
            holeX = textWidth + holeOffsetHPx;
            holeY = textHeight * 0.4 + holeOffsetVPx;
            break;
          case "top":
            holeX = textWidth / 2 + holeOffsetHPx;
            holeY = -holeOffsetVPx;
            break;
          case "bottom":
            holeX = textWidth / 2 + holeOffsetHPx;
            holeY = textHeight + holeOffsetVPx;
            break;
        }
        
        minX = Math.min(minX, holeX - holeRadius);
        minY = Math.min(minY, holeY - holeRadius);
        maxX = Math.max(maxX, holeX + holeRadius);
        maxY = Math.max(maxY, holeY + holeRadius);
      }
      
      return {
        name,
        textWidth,
        textHeight,
        bounds: { minX, minY, maxX, maxY },
        yOffset: index * (pixelSize * 2.2)
      };
    });
    
    // STEP 2: Compute overall bounding box
    let globalMinX = Infinity, globalMinY = Infinity;
    let globalMaxX = -Infinity, globalMaxY = -Infinity;
    
    tags.forEach(tag => {
      globalMinX = Math.min(globalMinX, tag.bounds.minX);
      globalMinY = Math.min(globalMinY, tag.bounds.minY + tag.yOffset);
      globalMaxX = Math.max(globalMaxX, tag.bounds.maxX);
      globalMaxY = Math.max(globalMaxY, tag.bounds.maxY + tag.yOffset);
    });
    
    const contentWidth = globalMaxX - globalMinX;
    const contentHeight = globalMaxY - globalMinY;
    
    // Validate bounding box
    if (!isFinite(contentWidth) || !isFinite(contentHeight) || contentWidth <= 0 || contentHeight <= 0) {
      console.error("Invalid bbox:", { contentWidth, contentHeight, globalMinX, globalMinY, globalMaxX, globalMaxY });
      // Fallback to safe defaults
      canvas.width = 800;
      canvas.height = 500;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ef4444";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Error: Unable to compute preview", canvas.width / 2, canvas.height / 2);
      return;
    }
    
    // STEP 3: Add padding (max of 0.35in or 8% of largest dimension)
    const paddingIn = Math.max(0.35, 0.08 * Math.max(contentWidth / dpi, contentHeight / dpi));
    const padding = paddingIn * dpi;
    
    // STEP 4: Set canvas size to fit all content with padding
    canvas.width = Math.max(800, Math.min(4000, contentWidth + padding * 2));
    canvas.height = Math.max(500, Math.min(4000, contentHeight + padding * 2));
    
    // STEP 5: Clear and setup background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid (5 inch major, 1 inch minor)
    const gridSize = dpi * 5;
    ctx.strokeStyle = "#d6d3d1";
    ctx.lineWidth = 1.5;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Minor grid
    ctx.strokeStyle = "#e7e5e4";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += dpi) {
      if (x % gridSize !== 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    }
    for (let y = 0; y < canvas.height; y += dpi) {
      if (y % gridSize !== 0) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }
    
    // Ruler marks
    ctx.fillStyle = "#57534e";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    for (let x = 0; x < canvas.width; x += dpi) {
      const inch = Math.round(x / dpi);
      ctx.fillText(`${inch}in`, x, 14);
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, 25);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    ctx.textAlign = "right";
    for (let y = 0; y < canvas.height; y += dpi) {
      const inch = Math.round(y / dpi);
      ctx.fillText(`${inch}in`, 35, y + 4);
      ctx.beginPath();
      ctx.moveTo(38, y);
      ctx.lineTo(45, y);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // STEP 6: Calculate transform to center content
    const offsetX = padding - globalMinX;
    const offsetY = padding - globalMinY;
    
    // STEP 7: Render each tag with proper thickness
    tags.forEach((tag) => {
      const x = offsetX;
      const y = offsetY + tag.yOffset;
      
      ctx.font = `italic ${pixelSize}px ${fontFamily}`;
      ctx.textBaseline = "alphabetic";
      
      // Calculate effective stroke width based on thickness
      const baseStrokeWidth = pixelSize * 0.05;
      const strokeWidth = baseStrokeWidth + (baseStrokeWidth * thicken / 10); // Scale properly
      
      // Draw text outline (RED)
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(tag.name, x, y + pixelSize * 0.75);
      
      // Connect dots with SOLID bridges (no floating islands)
      if (connectMode === "dots and letters") {
        const chars = tag.name.split("");
        let xPos = x;
        
        chars.forEach((char) => {
          const charWidth = ctx.measureText(char).width;
          const lowerChar = char.toLowerCase();
          
          if (lowerChar === "i" || lowerChar === "j" || char === "!") {
            const dotCenterX = xPos + charWidth / 2;
            const dotCenterY = y + pixelSize * 0.15;
            const dotRadius = strokeWidth * 1.8;
            const stemTopY = y + pixelSize * 0.42;
            const bridgeWidth = Math.max(strokeWidth * 1.5, 0.08 * dpi);
            
            // Draw FILLED bridge (solid connection)
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.rect(
              dotCenterX - bridgeWidth / 2,
              dotCenterY + dotRadius,
              bridgeWidth,
              stemTopY - (dotCenterY + dotRadius)
            );
            ctx.fill();
            
            // Draw FILLED dot
            ctx.beginPath();
            ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw outline
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = strokeWidth * 0.3;
            ctx.beginPath();
            ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          xPos += charWidth;
        });
      }
      
      // Draw hole with SOLID bridge connector (no floating islands)
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holeOffsetHPx = holeOffsetH * dpi;
        const holeOffsetVPx = holeOffsetV * dpi;
        
        let holeX, holeY, connectionX, connectionY;
        
        switch (holeSide) {
          case "left":
            holeX = x + holeOffsetHPx;
            holeY = y + pixelSize * 0.4 + holeOffsetVPx;
            connectionX = x;
            connectionY = y + pixelSize * 0.4;
            break;
          case "right":
            holeX = x + tag.textWidth + holeOffsetHPx;
            holeY = y + pixelSize * 0.4 + holeOffsetVPx;
            connectionX = x + tag.textWidth;
            connectionY = y + pixelSize * 0.4;
            break;
          case "top":
            holeX = x + tag.textWidth / 2 + holeOffsetHPx;
            holeY = y - holeOffsetVPx;
            connectionX = x + tag.textWidth / 2;
            connectionY = y + pixelSize * 0.2;
            break;
          case "bottom":
            holeX = x + tag.textWidth / 2 + holeOffsetHPx;
            holeY = y + pixelSize + holeOffsetVPx;
            connectionX = x + tag.textWidth / 2;
            connectionY = y + pixelSize * 0.8;
            break;
        }
        
        const outerRadius = holeDiameterPx / 2 + holeThicknessPx;
        const innerRadius = holeDiameterPx / 2;
        const bridgeWidth = Math.max(holeThicknessPx * 1.5, 0.08 * dpi);
        
        // Draw FILLED ring
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(holeX, holeY, outerRadius, 0, Math.PI * 2);
        ctx.arc(holeX, holeY, innerRadius, 0, Math.PI * 2, true);
        ctx.fill();
        
        // Draw FILLED bridge connector (solid, no gaps)
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        if (holeSide === "left" || holeSide === "right") {
          const edgeX = holeX + (holeSide === "left" ? outerRadius : -outerRadius);
          ctx.rect(
            Math.min(edgeX, connectionX),
            holeY - bridgeWidth / 2,
            Math.abs(connectionX - edgeX),
            bridgeWidth
          );
        } else {
          const edgeY = holeY + (holeSide === "top" ? outerRadius : -outerRadius);
          ctx.rect(
            holeX - bridgeWidth / 2,
            Math.min(edgeY, connectionY),
            bridgeWidth,
            Math.abs(connectionY - edgeY)
          );
        }
        ctx.fill();
        
        // Draw outlines
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = strokeWidth * 0.3;
        ctx.beginPath();
        ctx.arc(holeX, holeY, outerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(holeX, holeY, innerRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Green indicator
        ctx.fillStyle = "#22c55e";
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(holeX, holeY, outerRadius + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    
    // Update dimensions display
    const widthInches = (contentWidth / dpi).toFixed(2);
    const heightInches = (contentHeight / dpi).toFixed(2);
    const widthMm = (contentWidth / dpi * 25.4).toFixed(1);
    const heightMm = (contentHeight / dpi * 25.4).toFixed(1);
    
    setDimensions({ 
      width: widthInches, 
      height: heightInches,
      widthMm,
      heightMm
    });
    
    // Draw dimensions
    ctx.fillStyle = "#57534e";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`↔ ${widthInches} in (${widthMm} mm)   ↕ ${heightInches} in (${heightMm} mm)`, 10, canvas.height - 10);
    
    // Debug info
    setDebugInfo({
      bbox: `(${globalMinX.toFixed(1)}, ${globalMinY.toFixed(1)}) → (${globalMaxX.toFixed(1)}, ${globalMaxY.toFixed(1)})`,
      padding: `${paddingIn.toFixed(2)} in`,
      thickness: `${thicken.toFixed(1)}%`,
      tags: tags.length
    });
  };

  const downloadSVG = () => {
    alert("SVG export with proper path offsetting coming soon!");
  };

  const handleZoomToFit = () => {
    generatePreview();
  };

  return (
    <div className="space-y-4">
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
        <p className="text-xs text-stone-700">
          Make single layer stocking or gift tags. Or size down for earrings! You can list multiple names to generate multiple tags. Dots on i's are connected and customizable hole is placed automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Live Preview - LEFT */}
        <Card>
          <CardContent className="p-4">
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white relative" style={{ height: "500px" }}>
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "auto" }}
              />
              <Button
                onClick={handleZoomToFit}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                size="icon"
                variant="outline"
                title="Zoom to Fit"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <div className="text-xs text-stone-600">
                {debugInfo && (
                  <details className="cursor-pointer">
                    <summary className="hover:text-stone-900">Debug Info</summary>
                    <pre className="mt-1 text-[10px] bg-stone-100 p-2 rounded">
{`BBox: ${debugInfo.bbox}
Padding: ${debugInfo.padding}
Thickness: ${debugInfo.thickness}
Tags: ${debugInfo.tags}`}
                    </pre>
                  </details>
                )}
              </div>
              <Button onClick={downloadSVG} className="bg-cyan-500 hover:bg-cyan-600">
                <Download className="w-4 h-4 mr-2" />
                Download SVG
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Controls - RIGHT */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Names */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">Names</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => setNames("Denise")}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
                placeholder="Enter names..."
                rows={3}
                className="text-lg font-medium resize-none"
              />
              <p className="text-xs text-stone-500 mt-1">
                You can create multiple keychains by listing names on separate lines.
              </p>
            </div>

            {/* Size */}
            <div>
              <Label className="text-sm font-medium">Size</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  step={fontUnit === "pt" ? "1" : "0.1"}
                  min={fontUnit === "pt" ? "18" : "0.25"}
                  max={fontUnit === "pt" ? "864" : "12"}
                  value={fontUnit === "pt" ? Math.round(fontSize * 72) : fontSize.toFixed(1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.25;
                    const inchVal = fontUnit === "pt" ? val / 72 : val;
                    setFontSize(Math.max(0.25, Math.min(12, inchVal)));
                  }}
                  className="flex-1 bg-green-100"
                />
                <Select value={fontUnit} onValueChange={(v) => {
                  if (v === "in" && fontUnit === "pt") {
                    // Converting from pt to in, keep same value
                  } else if (v === "pt" && fontUnit === "in") {
                    // Converting from in to pt, keep same value
                  }
                  setFontUnit(v);
                }}>
                  <SelectTrigger className="w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="pt">pt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {fontUnit === "in" 
                  ? `≈ ${Math.round(clampedFontSize * 72)} pt` 
                  : `≈ ${clampedFontSize.toFixed(2)} in`}
                {clampedFontSize !== fontSize && (
                  <span className="text-amber-600 ml-1">(clamped to valid range)</span>
                )}
              </p>
              <p className="text-xs text-stone-500">
                Font size for the connected text. Range: 0.25–12 in
              </p>
            </div>

            {/* Font */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-stone-700 hover:text-stone-900">
                <span>Font</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs">Font</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="flex-1 bg-green-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scriptFonts.map(font => (
                          <SelectItem key={font} value={font}>
                            {font === "Tempting" ? "Tempting (Regular)" : font}
                          </SelectItem>
                        ))}
                        {customFont && (
                          <SelectItem value={customFont}>Custom Font</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".ttf,.otf"
                      onChange={handleFontUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="bg-cyan-500 text-white hover:bg-cyan-600"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setFontFamily("Tempting");
                        setThicken(1.5);
                      }}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">Thicken: {thicken.toFixed(1)}%</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Slider
                      value={[thicken]}
                      onValueChange={([v]) => setThicken(v)}
                      min={0}
                      max={20}
                      step={0.1}
                      className="flex-1"
                      onWheel={(e) => {
                        e.preventDefault();
                        const delta = e.deltaY < 0 ? 0.1 : -0.1;
                        setThicken(Math.max(0, Math.min(20, thicken + delta)));
                      }}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => setThicken(1.5)}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Scroll over slider to adjust thickness
                  </p>
                </div>
                
                <div>
                  <Label className="text-xs">Connect</Label>
                  <Select value={connectMode} onValueChange={setConnectMode}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="letters">Letters Only</SelectItem>
                      <SelectItem value="dots and letters">Dots and Letters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Collapsible>
                  <CollapsibleTrigger className="text-xs font-medium text-stone-600 cursor-pointer hover:text-stone-900">
                    Show More Options
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <Label className="text-xs">Corner Rounding: {cornerRounding.toFixed(1)}%</Label>
                    <Slider
                      value={[cornerRounding]}
                      onValueChange={([v]) => setCornerRounding(v)}
                      min={0}
                      max={10}
                      step={0.1}
                      className="mt-2"
                    />
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>

            {/* Hole Options */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-stone-700 hover:text-stone-900 border-t pt-3">
                <span>Hole Size</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Include Hole</Label>
                  <input
                    type="checkbox"
                    checked={includeHole}
                    onChange={(e) => setIncludeHole(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                </div>

                {includeHole && (
                  <>
                    <div>
                      <Label className="text-xs">Hole Size</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={holeDiameter}
                          onChange={(e) => setHoleDiameter(parseFloat(e.target.value) || 0)}
                          className="flex-1"
                        />
                        <Select value="in" disabled>
                          <SelectTrigger className="w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in">in</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">Size (diameter) of the opening.</p>
                    </div>

                    <div>
                      <Label className="text-xs">Hole Thickness</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={holeThickness}
                          onChange={(e) => setHoleThickness(parseFloat(e.target.value) || 0)}
                          className="flex-1"
                        />
                        <Select value="in" disabled>
                          <SelectTrigger className="w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in">in</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">Amount of material around the hole.</p>
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger className="text-xs font-medium text-stone-600 cursor-pointer hover:text-stone-900">
                        Hole Position
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        <div>
                          <Label className="text-xs">Hole Side</Label>
                          <Select value={holeSide} onValueChange={setHoleSide}>
                            <SelectTrigger className="mt-1">
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
                          <div className="flex gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.1"
                              value={holeOffsetH}
                              onChange={(e) => setHoleOffsetH(parseFloat(e.target.value) || 0)}
                              className="flex-1"
                            />
                            <Select value="in" disabled>
                              <SelectTrigger className="w-16">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="in">in</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Hole Overlap</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={holeOverlap}
                              onChange={(e) => setHoleOverlap(parseFloat(e.target.value) || 0)}
                              className="flex-1"
                            />
                            <Select value="in" disabled>
                              <SelectTrigger className="w-16">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="in">in</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}