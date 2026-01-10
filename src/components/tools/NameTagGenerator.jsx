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
  
  const [names, setNames] = useState("Name");
  const [fontSize, setFontSize] = useState(2.0); // inches
  const [fontUnit, setFontUnit] = useState("in");
  const [fontFamily, setFontFamily] = useState("Tempting");
  const [customFont, setCustomFont] = useState(null);
  const [thicken, setThicken] = useState(1.5);
  const [connectMode, setConnectMode] = useState("dots and letters");
  const [cornerRounding, setCornerRounding] = useState(0.5);
  
  const [includeHole, setIncludeHole] = useState(false);
  const [holeDiameter, setHoleDiameter] = useState(0.19);
  const [holeThickness, setHoleThickness] = useState(0.12);
  const [holeSide, setHoleSide] = useState("left");
  const [holePosition, setHolePosition] = useState(-0.50);
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
    const size = Math.max(0.25, Math.min(12, fontSize));
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
  }, [names, fontSize, fontUnit, fontFamily, thicken, connectMode, cornerRounding, includeHole, holeDiameter, holeThickness, holeSide, holePosition, holeOverlap]);

  const generatePreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !names.trim()) return;

    const ctx = canvas.getContext("2d");
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim());
    
    if (!pixelSize || !isFinite(pixelSize) || pixelSize <= 0) {
      console.error("Invalid pixel size:", pixelSize);
      return;
    }
    
    // Measure all text
    ctx.font = `italic ${pixelSize}px ${fontFamily}`;
    
    const tags = nameList.map((name, index) => {
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      const textHeight = pixelSize;
      const thicknessOffset = (pixelSize * thicken) / 100;
      
      let minX = -thicknessOffset;
      let minY = -thicknessOffset;
      let maxX = textWidth + thicknessOffset;
      let maxY = textHeight + thicknessOffset;
      
      // Include hole bounds
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holePositionPx = holePosition * dpi;
        const holeRadius = holeDiameterPx / 2 + holeThicknessPx;
        
        let holeX = 0, holeY = 0;
        if (holeSide === "left") {
          holeX = holePositionPx;
          holeY = textHeight * 0.4;
        } else if (holeSide === "right") {
          holeX = textWidth + holePositionPx;
          holeY = textHeight * 0.4;
        } else if (holeSide === "top") {
          holeX = textWidth / 2;
          holeY = holePositionPx;
        } else if (holeSide === "bottom") {
          holeX = textWidth / 2;
          holeY = textHeight + holePositionPx;
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
    
    // Compute overall bounding box
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
    
    if (!isFinite(contentWidth) || !isFinite(contentHeight) || contentWidth <= 0 || contentHeight <= 0) {
      console.error("Invalid bbox:", { contentWidth, contentHeight });
      return;
    }
    
    // Add padding
    const paddingIn = Math.max(0.35, 0.08 * Math.max(contentWidth / dpi, contentHeight / dpi));
    const padding = paddingIn * dpi;
    
    // Set canvas size
    canvas.width = Math.max(800, Math.min(4000, contentWidth + padding * 2));
    canvas.height = Math.max(500, Math.min(4000, contentHeight + padding * 2));
    
    // Clear and setup
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid (5 inch major)
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
    
    // Minor grid (1 inch)
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
    
    // Calculate transform
    const offsetX = padding - globalMinX;
    const offsetY = padding - globalMinY;
    
    // Render each tag
    tags.forEach((tag) => {
      const x = offsetX;
      const y = offsetY + tag.yOffset;
      
      ctx.font = `italic ${pixelSize}px ${fontFamily}`;
      ctx.textBaseline = "alphabetic";
      
      const baseStrokeWidth = pixelSize * 0.05;
      const strokeWidth = baseStrokeWidth + (baseStrokeWidth * thicken / 10);
      
      // Draw text outline
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(tag.name, x, y + pixelSize * 0.75);
      
      // Connect dots
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
            const bridgeWidth = Math.max(0.08 * dpi, strokeWidth * 1.2);
            
            // Draw bridge (filled)
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(
              dotCenterX - bridgeWidth / 2,
              dotCenterY + dotRadius,
              bridgeWidth,
              stemTopY - (dotCenterY + dotRadius)
            );
            
            // Draw dot (filled)
            ctx.beginPath();
            ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
          
          xPos += charWidth;
        });
      }
      
      // Draw hole
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holePositionPx = holePosition * dpi;
        
        let holeX, holeY, connectionX, connectionY;
        
        if (holeSide === "left") {
          holeX = x + holePositionPx;
          holeY = y + pixelSize * 0.4;
          connectionX = x;
          connectionY = y + pixelSize * 0.4;
        } else if (holeSide === "right") {
          holeX = x + tag.textWidth + holePositionPx;
          holeY = y + pixelSize * 0.4;
          connectionX = x + tag.textWidth;
          connectionY = y + pixelSize * 0.4;
        } else if (holeSide === "top") {
          holeX = x + tag.textWidth / 2;
          holeY = y + holePositionPx;
          connectionX = x + tag.textWidth / 2;
          connectionY = y + pixelSize * 0.2;
        } else if (holeSide === "bottom") {
          holeX = x + tag.textWidth / 2;
          holeY = y + pixelSize + holePositionPx;
          connectionX = x + tag.textWidth / 2;
          connectionY = y + pixelSize * 0.8;
        }
        
        const outerRadius = holeDiameterPx / 2 + holeThicknessPx;
        const innerRadius = holeDiameterPx / 2;
        const bridgeWidth = Math.max(0.08 * dpi, holeThicknessPx * 1.2);
        
        // Draw filled ring
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(holeX, holeY, outerRadius, 0, Math.PI * 2);
        ctx.arc(holeX, holeY, innerRadius, 0, Math.PI * 2, true);
        ctx.fill();
        
        // Draw bridge connector
        ctx.fillStyle = "#ef4444";
        if (holeSide === "left" || holeSide === "right") {
          const edgeX = holeX + (holeSide === "left" ? outerRadius : -outerRadius);
          const startX = Math.min(edgeX, connectionX);
          const distance = Math.abs(connectionX - edgeX);
          ctx.fillRect(startX, holeY - bridgeWidth / 2, distance, bridgeWidth);
        } else {
          const edgeY = holeY + (holeSide === "top" ? outerRadius : -outerRadius);
          const startY = Math.min(edgeY, connectionY);
          const distance = Math.abs(connectionY - edgeY);
          ctx.fillRect(holeX - bridgeWidth / 2, startY, bridgeWidth, distance);
        }
      }
    });
    
    // Update dimensions
    const widthInches = (contentWidth / dpi).toFixed(2);
    const heightInches = (contentHeight / dpi).toFixed(2);
    
    setDimensions({ 
      width: widthInches, 
      height: heightInches
    });
    
    // Draw dimensions
    ctx.fillStyle = "#57534e";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`↔ ${widthInches} in  ↕ ${heightInches} in`, 10, canvas.height - 10);
  };

  const downloadSVG = () => {
    if (!names.trim()) return;
    
    const dpi = 96;
    const pixelSize = getFontSizeInPixels();
    const nameList = names.split("\n").filter(n => n.trim());
    
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    ctx.font = `italic ${pixelSize}px ${fontFamily}`;
    
    const tags = nameList.map((name, index) => {
      const metrics = ctx.measureText(name);
      const textWidth = metrics.width;
      const textHeight = pixelSize;
      const thicknessOffset = (pixelSize * thicken) / 100;
      
      let minX = -thicknessOffset;
      let minY = -thicknessOffset;
      let maxX = textWidth + thicknessOffset;
      let maxY = textHeight + thicknessOffset;
      
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holePositionPx = holePosition * dpi;
        const holeRadius = holeDiameterPx / 2 + holeThicknessPx;
        
        let holeX = 0, holeY = 0;
        if (holeSide === "left") {
          holeX = holePositionPx;
          holeY = textHeight * 0.4;
        } else if (holeSide === "right") {
          holeX = textWidth + holePositionPx;
          holeY = textHeight * 0.4;
        } else if (holeSide === "top") {
          holeX = textWidth / 2;
          holeY = holePositionPx;
        } else if (holeSide === "bottom") {
          holeX = textWidth / 2;
          holeY = textHeight + holePositionPx;
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
    const paddingIn = Math.max(0.35, 0.08 * Math.max(contentWidth / dpi, contentHeight / dpi));
    const padding = paddingIn * dpi;
    
    const svgWidth = contentWidth + padding * 2;
    const svgHeight = contentHeight + padding * 2;
    const offsetX = padding - globalMinX;
    const offsetY = padding - globalMinY;
    
    let svgPaths = [];
    const strokeWidth = pixelSize * 0.05 + (pixelSize * 0.05 * thicken / 10);
    
    tags.forEach((tag) => {
      const x = offsetX;
      const y = offsetY + tag.yOffset;
      
      svgPaths.push(`<text x="${x}" y="${y + pixelSize * 0.75}" font-family="${fontFamily}" font-size="${pixelSize}" font-style="italic" fill="none" stroke="#ef4444" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${tag.name}</text>`);
      
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
            const bridgeWidth = Math.max(0.08 * dpi, strokeWidth * 1.2);
            
            svgPaths.push(`<rect x="${dotCenterX - bridgeWidth/2}" y="${dotCenterY + dotRadius}" width="${bridgeWidth}" height="${stemTopY - (dotCenterY + dotRadius)}" fill="#ef4444"/>`);
            svgPaths.push(`<circle cx="${dotCenterX}" cy="${dotCenterY}" r="${dotRadius}" fill="#ef4444"/>`);
          }
          
          xPos += charWidth;
        });
      }
      
      if (includeHole) {
        const holeDiameterPx = holeDiameter * dpi;
        const holeThicknessPx = holeThickness * dpi;
        const holePositionPx = holePosition * dpi;
        
        let holeX, holeY, connectionX, connectionY;
        
        if (holeSide === "left") {
          holeX = x + holePositionPx;
          holeY = y + pixelSize * 0.4;
          connectionX = x;
          connectionY = y + pixelSize * 0.4;
        } else if (holeSide === "right") {
          holeX = x + tag.textWidth + holePositionPx;
          holeY = y + pixelSize * 0.4;
          connectionX = x + tag.textWidth;
          connectionY = y + pixelSize * 0.4;
        } else if (holeSide === "top") {
          holeX = x + tag.textWidth / 2;
          holeY = y + holePositionPx;
          connectionX = x + tag.textWidth / 2;
          connectionY = y + pixelSize * 0.2;
        } else if (holeSide === "bottom") {
          holeX = x + tag.textWidth / 2;
          holeY = y + pixelSize + holePositionPx;
          connectionX = x + tag.textWidth / 2;
          connectionY = y + pixelSize * 0.8;
        }
        
        const outerRadius = holeDiameterPx / 2 + holeThicknessPx;
        const innerRadius = holeDiameterPx / 2;
        const bridgeWidth = Math.max(0.08 * dpi, holeThicknessPx * 1.2);
        
        svgPaths.push(`<circle cx="${holeX}" cy="${holeY}" r="${outerRadius}" fill="#ef4444"/>`);
        svgPaths.push(`<circle cx="${holeX}" cy="${holeY}" r="${innerRadius}" fill="#ffffff"/>`);
        
        if (holeSide === "left" || holeSide === "right") {
          const edgeX = holeX + (holeSide === "left" ? outerRadius : -outerRadius);
          const startX = Math.min(edgeX, connectionX);
          const distance = Math.abs(connectionX - edgeX);
          svgPaths.push(`<rect x="${startX}" y="${holeY - bridgeWidth/2}" width="${distance}" height="${bridgeWidth}" fill="#ef4444"/>`);
        } else {
          const edgeY = holeY + (holeSide === "top" ? outerRadius : -outerRadius);
          const startY = Math.min(edgeY, connectionY);
          const distance = Math.abs(connectionY - edgeY);
          svgPaths.push(`<rect x="${holeX - bridgeWidth/2}" y="${startY}" width="${bridgeWidth}" height="${distance}" fill="#ef4444"/>`);
        }
      }
    });
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <g id="name-tags">
    ${svgPaths.join("\n    ")}
  </g>
</svg>`;
    
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `name-tag-${names.split("\n")[0].replace(/\s+/g, "-").toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            <div className="border-2 border-stone-300 rounded-lg overflow-auto bg-white relative" style={{ height: "600px" }}>
              <canvas
                ref={canvasRef}
                style={{ display: "block", maxWidth: "none" }}
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={downloadSVG} className="bg-cyan-500 hover:bg-cyan-600 text-white">
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
              <Label className="text-sm font-medium">Names</Label>
              <Textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
                placeholder="Enter names..."
                rows={2}
                className="mt-1 text-lg font-medium resize-none bg-green-100"
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
                  className="flex-1"
                />
                <Select value={fontUnit} onValueChange={setFontUnit}>
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
                Font size for the connected text.
              </p>
            </div>

            {/* Font */}
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-medium">Font</Label>
              
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
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Thicken: {thicken.toFixed(1)}%</Label>
                <Slider
                  value={[thicken]}
                  onValueChange={([v]) => setThicken(v)}
                  min={0}
                  max={20}
                  step={0.1}
                  className="mt-1"
                />
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
            </div>

            {/* Hole Size */}
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Hole Size</Label>
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
                            value={holePosition}
                            onChange={(e) => setHolePosition(parseFloat(e.target.value) || 0)}
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}