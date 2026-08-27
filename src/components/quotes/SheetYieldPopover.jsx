import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

// Sheet yield calculator: pieces per sheet × waste-adjusted cost per piece.
// Math is unit-agnostic (ratios), so the in/cm toggle only labels the inputs
// and keeps sheet & piece dimensions in a consistent unit.
export default function SheetYieldPopover({
  material,
  currencySymbol,
  onFieldChange,
  onApply,
}) {
  const [open, setOpen] = useState(false);

  const unit = material.sheet_unit === "cm" ? "cm" : "in";
  const sw = parseFloat(material.sheet_width) || 0;
  const sh = parseFloat(material.sheet_height) || 0;
  const iw = parseFloat(material.item_width) || 0;
  const ih = parseFloat(material.item_height) || 0;
  const sheetCost = parseFloat(material.sheet_cost) || 0;
  const waste = Math.max(0, Math.min(100, parseFloat(material.waste_percent) || 0));

  const perRow = iw > 0 ? Math.floor(sw / iw) : 0;
  const perCol = ih > 0 ? Math.floor(sh / ih) : 0;
  const piecesPerSheet = perRow * perCol;
  const effective = piecesPerSheet * (1 - waste / 100);
  // Guard against divide-by-zero and zero pieces per sheet
  const canCompute = piecesPerSheet > 0 && effective > 0;
  const costPerPiece = canCompute ? sheetCost / effective : 0;

  const handleApply = () => {
    if (!canCompute) return;
    onApply(Math.round(costPerPiece * 100) / 100);
    setOpen(false);
  };

  const inputCls = "mt-1 h-8 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          <Calculator className="w-3 h-3" />
          Calculate from sheet
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-800">Sheet yield</p>
            <div className="flex rounded-md border border-stone-200 overflow-hidden">
              {["in", "cm"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onFieldChange("sheet_unit", u)}
                  className={`px-2 py-0.5 text-xs ${
                    unit === u
                      ? "bg-stone-800 text-white"
                      : "bg-white text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-stone-600">Sheet Cost ({currencySymbol})</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={material.sheet_cost || ""}
              onChange={(e) => onFieldChange("sheet_cost", e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-stone-600">Sheet Width ({unit})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={material.sheet_width || ""}
                onChange={(e) => onFieldChange("sheet_width", e.target.value)}
                placeholder="18"
                className={inputCls}
              />
            </div>
            <div>
              <Label className="text-xs text-stone-600">Sheet Height ({unit})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={material.sheet_height || ""}
                onChange={(e) => onFieldChange("sheet_height", e.target.value)}
                placeholder="24"
                className={inputCls}
              />
            </div>
            <div>
              <Label className="text-xs text-stone-600">Piece Width ({unit})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={material.item_width || ""}
                onChange={(e) => onFieldChange("item_width", e.target.value)}
                placeholder="4"
                className={inputCls}
              />
            </div>
            <div>
              <Label className="text-xs text-stone-600">Piece Height ({unit})</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={material.item_height || ""}
                onChange={(e) => onFieldChange("item_height", e.target.value)}
                placeholder="4"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-stone-600">Waste %</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={material.waste_percent ?? ""}
              onChange={(e) => onFieldChange("waste_percent", e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>

          <div className="rounded-md bg-stone-50 border border-stone-200 p-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Pieces per sheet</span>
              <span className="font-semibold text-stone-800">
                {canCompute || piecesPerSheet > 0 ? piecesPerSheet : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Cost per piece</span>
              <span className="font-semibold text-emerald-700">
                {canCompute ? `${currencySymbol}${costPerPiece.toFixed(2)}` : "—"}
              </span>
            </div>
            {!canCompute && (
              <p className="text-stone-400 italic">
                {piecesPerSheet === 0
                  ? "Enter sheet & piece dimensions"
                  : "Waste must be below 100%"}
              </p>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!canCompute}
            onClick={handleApply}
          >
            Apply to unit cost
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}