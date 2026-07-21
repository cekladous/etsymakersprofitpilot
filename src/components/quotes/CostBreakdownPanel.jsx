import React from "react";
import { Package, Clock, Wrench, Layers, DollarSign, TrendingUp, Percent, Truck } from "lucide-react";

export default function CostBreakdownPanel({
  materialsTotal,
  laborTotal,
  machineTotal,
  shippingCost = 0,
  overheadPerItem,
  overheadManualOverride,
  onOverheadOverrideToggle,
  onOverheadChange,
  desiredMargin,
  onMarginChange,
  currencySymbol,
  quantity = 1,
  pricePerUnit,
}) {
  const overhead = parseFloat(overheadPerItem) || 0;
  const shipping = parseFloat(shippingCost) || 0;
  const margin = parseFloat(desiredMargin) || 0;
  const totalCOGS = materialsTotal + laborTotal + machineTotal + overhead + shipping;
  const suggestedPrice = margin > 0 && margin < 100 ? totalCOGS / (1 - margin / 100) : totalCOGS;
  const profitAmount = suggestedPrice - totalCOGS;
  const actualMargin = suggestedPrice > 0 ? (profitAmount / suggestedPrice) * 100 : 0;
  const perUnit = typeof pricePerUnit === "number" ? pricePerUnit : suggestedPrice / (parseFloat(quantity) || 1);

  const Row = ({ icon: Icon, label, value }) => (
    <div className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-stone-400" />
        <span className="text-sm text-stone-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-stone-900">
        {currencySymbol}{value.toFixed(2)}
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-600" />
        Cost Breakdown
      </h3>

      <div className="space-y-0">
        <Row icon={Package} label="Materials" value={materialsTotal} />
        <Row icon={Clock} label="Labor (hrs × rate)" value={laborTotal} />
        <Row icon={Wrench} label="Machine Time" value={machineTotal} />
        <Row icon={Truck} label="Shipping" value={shipping} />

        <div className="flex items-center justify-between py-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-400" />
            <div>
              <span className="text-sm text-stone-600">Overhead</span>
              <button
                type="button"
                onClick={() => onOverheadOverrideToggle && onOverheadOverrideToggle(!overheadManualOverride)}
                className="block text-[11px] text-emerald-600 hover:underline"
              >
                {overheadManualOverride ? "Using manual amount – switch to auto-calculate" : "Auto-calculated from Settings – override manually"}
              </button>
            </div>
          </div>
          {overheadManualOverride ? (
            <input
              type="number"
              value={overheadPerItem}
              onChange={(e) => onOverheadChange(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-24 text-right text-sm font-semibold text-stone-900 border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
            />
          ) : (
            <span className="text-sm font-semibold text-stone-900">{currencySymbol}{overhead.toFixed(2)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between py-3 mt-2 bg-stone-50 rounded-lg px-3">
        <span className="text-sm font-semibold text-stone-700">Total COGS</span>
        <span className="text-lg font-bold text-stone-900">{currencySymbol}{totalCOGS.toFixed(2)}</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-stone-600 flex items-center gap-1">
            <Percent className="w-3 h-3" />
            Desired Margin %
          </label>
          <input
            type="number"
            value={desiredMargin}
            onChange={(e) => onMarginChange(e.target.value)}
            placeholder="40"
            min="0"
            max="100"
            className="w-20 text-right text-sm font-semibold border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center justify-between py-3 bg-emerald-50 rounded-lg px-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">Suggested Price{quantity > 1 ? ` (for ${quantity})` : ""}</span>
          </div>
          <span className="text-lg font-bold text-emerald-700">{currencySymbol}{suggestedPrice.toFixed(2)}</span>
        </div>

        {quantity > 1 && (
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm text-stone-600">Price per unit</span>
            <span className="text-sm font-bold text-stone-900">{currencySymbol}{perUnit.toFixed(2)}</span>
          </div>
        )}

        <div className="flex items-center justify-between py-2 px-3">
          <span className="text-sm text-stone-600">Profit Margin</span>
          <span className="text-sm font-bold text-emerald-600">{actualMargin.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}