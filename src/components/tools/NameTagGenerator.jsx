import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Upload, RotateCcw, ChevronDown } from "lucide-react";

export default function NameTagGenerator() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [names, setNames] = useState("Denise");
  const [fontSize, setFontSize] = useState(144);
  const [fontUnit, setFontUnit] = useState("pt");
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
    
    const padding = 80;
    const gridSize = dpi * 5;
    
    ctx.font = `italic ${pixelSize}px ${fontFamily}`;
    let maxTextWidth = 0;
    nameList.forEach(name => {
      const width = ctx.measureText(name).width;
      maxTextWidth = Math.max(maxTextWidth, width);
    });
    
    const holeSpace = includeHole ? (holeDiameter + Math.abs(holeOffsetH) + holeThickness) * dpi * 2 : 0;
    
    canvas.width = Math.max(1000, maxTextWidth + padding * 2 + holeSpace);
    canvas.height = Math.max(600, nameList.length * (pixelSize * 1.8) + padding * 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw major grid lines (5 inch)
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

    // Draw minor grid lines (1 inch)
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

    // Draw ruler marks
    ctx.fillStyle = "#57534e";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    for (let x = padding; x < canvas.width; x += dpi) {
      const inch = Math.round((x - padding) / dpi);
      ctx.fillText(`${inch}in`, x, 14);
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, 25);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    ctx.textAlign = "right";
    for (let y = padding; y < canvas.height; y += dpi) {
      const inch = Math.round((y - padding) / dpi);
      ctx.fillText(`${inch}in`, 35, y + 4);
      ctx.beginPath();
      ctx.moveTo(38, y);
      ctx.lineTo(45, y);
      ctx.strokeStyle = "#78716c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    let maxWidth = 0;

    nameList.forEach((name, index) => {
      const yOffset = padding + index * (pixelSize * 1.8);
      
      ctx.font = `italic ${pixelSize}px ${fontFamily}`;
      ctx.textBaseline = "alphabetic";
      
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      maxWidth = Math.max(maxWidth, textWidth);
      
      const baseStrokeWidth = pixelSize * 0.05;
      const strokeWidth = baseStrokeWidth + (baseStrokeWidth * thicken / 100);
      
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(name, padding, yOffset + pixelSize * 0.75);
      
      if (connectMode === "dots and letters") {
        const chars = name.split("");
        let xPos = padding;
        
        chars.forEach((char) => {
          const charWidth = ctx.measureText(char).width;
          const lowerChar = char.toLowerCase();
          
          if (lowerChar === "i" || lowerChar === "j" || char === "!") {
            const dotCenterX = xPos + charWidth / 2;
            const dotCenterY = yOffset + pixelSize * 0.15;
            const dotRadius = strokeWidth * 1.2;
            const stemTopY = yOffset + pixelSize * 0.4;
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
            
            ctx.beginPath();
            ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          xPos += charWidth;
        });
      }
      
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holeOffsetHPx = holeOffsetH * dpi;
        const holeOffsetVPx = holeOffsetV * dpi;
        
        let holeX, holeY, connectionX, connectionY;
        
        switch (holeSide) {
          case "left":
            holeX = padding + holeOffsetHPx;
            holeY = yOffset + holeOffsetVPx + pixelSize * 0.4;
            connectionX = padding;
            connectionY = yOffset + pixelSize * 0.4;
            break;
          case "right":
            holeX = padding + textWidth + holeOffsetHPx;
            holeY = yOffset + holeOffsetVPx + pixelSize * 0.4;
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
        
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2 + holeThicknessPx, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(holeX, holeY, holeDiameterPx / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        const bridgeWidth = holeThicknessPx * 0.8;
        ctx.beginPath();
        if (holeSide === "left" || holeSide === "right") {
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
    });

    const widthInches = (maxWidth / dpi).toFixed(2);
    const heightInches = ((nameList.length * pixelSize * 1.2) / dpi).toFixed(2);
    setDimensions({ width: widthInches, height: heightInches });
    
    ctx.fillStyle = "#57534e";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`↔ ${widthInches} in   ↕ ${heightInches} in`, 50, canvas.height - 20);
  };

  const downloadSVG = () => {
    alert("SVG export coming soon!");
  };

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
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white" style={{ height: "500px" }}>
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </div>
            <div className="mt-3 flex justify-end">
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
                  <Button variant="ghost" size="icon" className="h-6 w-6">
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
                  step="1"
                  min="1"
                  value={fontUnit === "pt" ? fontSize : Math.round(fontSize * 72)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    setFontSize(fontUnit === "pt" ? val : val / 72);
                  }}
                  className="flex-1 bg-green-100"
                />
                <Select value={fontUnit} onValueChange={(v) => {
                  if (v === "in" && fontUnit === "pt") {
                    setFontSize(fontSize / 72);
                  } else if (v === "pt" && fontUnit === "in") {
                    setFontSize(fontSize * 72);
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
                {fontUnit === "pt" ? `${(fontSize / 72).toFixed(1)} in` : `${Math.round(fontSize * 72)} pt`}
              </p>
              <p className="text-xs text-stone-500">
                Font size for the connected text. This determines the overall size for the item.
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
                    <Button variant="ghost" size="icon">
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
                      max={10}
                      step={0.1}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </div>
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