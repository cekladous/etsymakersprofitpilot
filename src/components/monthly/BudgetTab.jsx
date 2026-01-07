import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2 } from "lucide-react";
import { startOfMonth, format, addMonths, startOfQuarter, startOfYear } from "date-fns";
import * as XLSX from "xlsx";
import { EXPENSE_CATEGORY_GROUPS } from "@/components/shared/expenseCategories";
import LineItemDrillDown from "./LineItemDrillDown";

export default function BudgetTab({ viewMode, dateRange, financialData }) {
  // Extract raw filtered data for compatibility
  const filteredData = financialData._rawData;
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownData, setDrillDownData] = useState({ title: "", items: [] });
  const [editingCell, setEditingCell] = useState(null);
  const queryClient = useQueryClient();

  const { data: budgetPlans = [] } = useQuery({
    queryKey: ["budget-plans"],
    queryFn: () => base44.entities.BudgetPlan.list(),
  });

  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget-lines"],
    queryFn: () => base44.entities.BudgetLine.list(),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases"],
    queryFn: () => base44.entities.MaterialPurchase.list("-purchase_date", 1000),
  });

  // Get or create active plan
  const activePlan = budgetPlans.find(p => p.is_active) || budgetPlans[0];

  const createPlanMutation = useMutation({
    mutationFn: () => base44.entities.BudgetPlan.create({ name: "Default Budget", is_active: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budget-plans"] }),
  });

  React.useEffect(() => {
    if (budgetPlans.length === 0) {
      createPlanMutation.mutate();
    }
  }, [budgetPlans]);

  // Generate period columns
  const periods = useMemo(() => {
    const cols = [];
    if (viewMode === "month") {
      for (let i = 0; i < 12; i++) {
        const periodStart = startOfMonth(addMonths(startOfYear(dateRange.start), i));
        cols.push({
          label: format(periodStart, "MMM-yy"),
          start: periodStart,
        });
      }
    } else if (viewMode === "quarter") {
      for (let i = 0; i < 4; i++) {
        const periodStart = startOfQuarter(addMonths(startOfYear(dateRange.start), i * 3));
        cols.push({
          label: `Q${i + 1}`,
          start: periodStart,
        });
      }
    } else {
      cols.push({
        label: "Year",
        start: startOfYear(dateRange.start),
      });
    }
    return cols;
  }, [viewMode, dateRange]);

  // Get budget for a specific category and period
  const getBudget = (categoryName, periodStart) => {
    if (!activePlan) return 0;
    const line = budgetLines.find(
      l => l.plan_id === activePlan.id &&
           l.category_name === categoryName &&
           l.period_start === format(periodStart, "yyyy-MM-dd")
    );
    return line?.budget_amount || 0;
  };

  // Get actual for a specific category and period
  const getActual = (categoryName, periodStart) => {
    const periodEnd = viewMode === "month"
      ? addMonths(periodStart, 1)
      : viewMode === "quarter"
      ? addMonths(periodStart, 3)
      : addMonths(periodStart, 12);

    const filterByPeriod = (items, dateField) => {
      return items.filter(item => {
        const d = new Date(item[dateField]);
        return d >= periodStart && d < periodEnd;
      });
    };

    let total = 0;

    // Materials & Supplies includes MaterialPurchase
    if (categoryName === "materials_supplies") {
      const purchases = filterByPeriod(materialPurchases, "purchase_date");
      total += purchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);
    }

    // Add BusinessExpense
    const expenses = filterByPeriod(filteredData.businessExpenses || [], "date");
    total += expenses.filter(e => e.category_name === categoryName).reduce((sum, e) => sum + (e.amount || 0), 0);

    // Add EtsyLedgerEntry (matched to this category)
    const ledgerEntries = filterByPeriod(filteredData.etsyLedgerEntries || [], "entry_date");
    total += ledgerEntries.filter(e => e.matched_category === categoryName).reduce((sum, e) => sum + Math.abs(e.net || 0), 0);

    return total;
  };

  // Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: async ({ categoryName, categoryGroup, periodStart, amount }) => {
      if (!activePlan) return;
      
      const existing = budgetLines.find(
        l => l.plan_id === activePlan.id &&
             l.category_name === categoryName &&
             l.period_start === format(periodStart, "yyyy-MM-dd")
      );

      if (existing) {
        return base44.entities.BudgetLine.update(existing.id, { budget_amount: amount });
      } else {
        return base44.entities.BudgetLine.create({
          plan_id: activePlan.id,
          category_group: categoryGroup,
          category_name: categoryName,
          period_start: format(periodStart, "yyyy-MM-dd"),
          budget_amount: amount,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-lines"] });
      setEditingCell(null);
    },
  });

  const handleCellClick = (categoryName, categoryGroup, periodStart) => {
    setEditingCell({ categoryName, categoryGroup, periodStart });
  };

  const handleCellBlur = (value, categoryName, categoryGroup, periodStart) => {
    const amount = parseFloat(value) || 0;
    updateBudgetMutation.mutate({ categoryName, categoryGroup, periodStart, amount });
  };

  const handleDrillDown = (label, categoryName, periodStart) => {
    const periodEnd = viewMode === "month"
      ? addMonths(periodStart, 1)
      : viewMode === "quarter"
      ? addMonths(periodStart, 3)
      : addMonths(periodStart, 12);

    const filterByPeriod = (items, dateField) => {
      return items.filter(item => {
        const d = new Date(item[dateField]);
        return d >= periodStart && d < periodEnd;
      });
    };

    let items = [];

    // Include MaterialPurchase if materials_supplies
    if (categoryName === "materials_supplies") {
      const purchases = filterByPeriod(materialPurchases, "purchase_date");
      items.push(...purchases.map(p => ({
        date: p.purchase_date,
        description: p.material_name,
        vendor: p.vendor,
        payment_source: p.payment_method,
        amount: p.total_cost,
      })));
    }

    // Add BusinessExpense
    const expenses = filterByPeriod(filteredData.businessExpenses || [], "date");
    items.push(...expenses.filter(e => e.category_name === categoryName).map(e => ({
      date: e.date,
      description: e.description,
      vendor: e.vendor,
      payment_source: e.payment_source,
      amount: e.amount,
    })));

    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    setDrillDownData({ title: `${label} - ${format(periodStart, "MMM yyyy")}`, items });
    setDrillDownOpen(true);
  };

  const handleExport = (fileType) => {
    const data = [];
    
    // Header row
    const headerRow = ["", ...periods.map(p => p.label), "Year"];
    data.push(headerRow);

    // Build rows
    Object.entries(EXPENSE_CATEGORY_GROUPS).forEach(([groupKey, group]) => {
      // Group header
      data.push([group.label]);

      group.categories.forEach(cat => {
        // Budget row
        const budgetRow = [cat.label + " Budget"];
        let yearBudget = 0;
        periods.forEach(p => {
          const budget = getBudget(cat.name, p.start);
          budgetRow.push(budget);
          yearBudget += budget;
        });
        budgetRow.push(yearBudget);
        data.push(budgetRow);

        // Actual row
        const actualRow = [cat.label + " Actual"];
        let yearActual = 0;
        periods.forEach(p => {
          const actual = getActual(cat.name, p.start);
          actualRow.push(actual);
          yearActual += actual;
        });
        actualRow.push(yearActual);
        data.push(actualRow);
      });
    });

    // Totals
    const totalBudgetRow = ["Total Spending Budget"];
    const totalActualRow = ["Total Spending Actual"];
    const differenceRow = ["Difference"];
    
    let yearTotalBudget = 0;
    let yearTotalActual = 0;
    
    periods.forEach(p => {
      let periodBudget = 0;
      let periodActual = 0;
      
      Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
        group.categories.forEach(cat => {
          periodBudget += getBudget(cat.name, p.start);
          periodActual += getActual(cat.name, p.start);
        });
      });
      
      totalBudgetRow.push(periodBudget);
      totalActualRow.push(periodActual);
      differenceRow.push(periodBudget - periodActual);
      
      yearTotalBudget += periodBudget;
      yearTotalActual += periodActual;
    });
    
    totalBudgetRow.push(yearTotalBudget);
    totalActualRow.push(yearTotalActual);
    differenceRow.push(yearTotalBudget - yearTotalActual);
    
    data.push(totalBudgetRow);
    data.push(totalActualRow);
    data.push(differenceRow);

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Budget");
    
    if (fileType === "csv") {
      XLSX.writeFile(workbook, `budget-${format(dateRange.start, "yyyy-MM")}.csv`);
    } else {
      XLSX.writeFile(workbook, `budget-${format(dateRange.start, "yyyy-MM")}.xlsx`);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const BudgetCell = ({ categoryName, categoryGroup, period }) => {
    const budget = getBudget(categoryName, period.start);
    const isEditing = editingCell?.categoryName === categoryName && 
                      editingCell?.periodStart?.getTime() === period.start.getTime();

    if (isEditing) {
      return (
        <Input
          type="number"
          step="0.01"
          defaultValue={budget}
          autoFocus
          onBlur={(e) => handleCellBlur(e.target.value, categoryName, categoryGroup, period.start)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
            if (e.key === "Escape") {
              setEditingCell(null);
            }
          }}
          className="h-8 text-xs text-center"
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(categoryName, categoryGroup, period.start)}
        className="text-xs text-center py-1 cursor-pointer hover:bg-blue-50 rounded transition-colors"
      >
        {budget > 0 ? formatCurrency(budget) : "—"}
      </div>
    );
  };

  const ActualCell = ({ categoryName, period, label }) => {
    const actual = getActual(categoryName, period.start);

    return (
      <div
        onClick={() => actual > 0 && handleDrillDown(label, categoryName, period.start)}
        className={`text-xs text-center py-1 ${actual > 0 ? "cursor-pointer hover:bg-emerald-50" : ""} rounded transition-colors`}
      >
        {actual > 0 ? formatCurrency(actual) : "—"}
      </div>
    );
  };

  if (!activePlan) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400 mx-auto mb-3" />
        <p className="text-stone-500">Setting up budget...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}>
          <Download className="w-4 h-4 mr-2" />
          Export XLSX
        </Button>
      </div>

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Business Budget</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-stone-100 border-b-2 border-stone-300">
                <th className="text-left p-2 font-semibold sticky left-0 bg-stone-100 z-10"></th>
                {periods.map((p, idx) => (
                  <th key={idx} className="text-center p-2 font-semibold min-w-[100px]">
                    {p.label}
                  </th>
                ))}
                <th className="text-center p-2 font-semibold min-w-[100px] bg-stone-200">
                  Year
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-stone-50">
                <td colSpan={periods.length + 2} className="p-2 font-semibold">
                  Expenses
                </td>
              </tr>

              {Object.entries(EXPENSE_CATEGORY_GROUPS).map(([groupKey, group]) => (
                <React.Fragment key={groupKey}>
                  {/* Group Header */}
                  <tr className={group.color}>
                    <td colSpan={periods.length + 2} className="p-2 font-medium">
                      {group.label}
                    </td>
                  </tr>

                  {/* Category Rows */}
                  {group.categories.map(cat => {
                    let yearBudget = 0;
                    let yearActual = 0;
                    periods.forEach(p => {
                      yearBudget += getBudget(cat.name, p.start);
                      yearActual += getActual(cat.name, p.start);
                    });

                    return (
                      <React.Fragment key={cat.name}>
                        {/* Budget Row */}
                        <tr className="border-b border-stone-200">
                          <td className="p-2 pl-6 text-stone-700 sticky left-0 bg-white">
                            {cat.label} Budget
                          </td>
                          {periods.map((p, idx) => (
                            <td key={idx} className="border-l border-stone-200">
                              <BudgetCell
                                categoryName={cat.name}
                                categoryGroup={groupKey}
                                period={p}
                              />
                            </td>
                          ))}
                          <td className="border-l-2 border-stone-300 bg-stone-50">
                            <div className="text-xs text-center py-1 font-semibold">
                              {yearBudget > 0 ? formatCurrency(yearBudget) : "—"}
                            </div>
                          </td>
                        </tr>

                        {/* Actual Row */}
                        <tr className="border-b border-stone-200 bg-stone-50">
                          <td className="p-2 pl-6 text-stone-600 sticky left-0 bg-stone-50">
                            {cat.label} Actual
                          </td>
                          {periods.map((p, idx) => (
                            <td key={idx} className="border-l border-stone-200">
                              <ActualCell
                                categoryName={cat.name}
                                period={p}
                                label={cat.label}
                              />
                            </td>
                          ))}
                          <td className="border-l-2 border-stone-300 bg-stone-100">
                            <div
                              onClick={() => yearActual > 0 && handleDrillDown(cat.label, cat.name, dateRange.start)}
                              className={`text-xs text-center py-1 font-semibold ${yearActual > 0 ? "cursor-pointer hover:bg-emerald-100" : ""}`}
                            >
                              {yearActual > 0 ? formatCurrency(yearActual) : "—"}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Totals */}
              <tr className="bg-stone-200 border-t-2 border-stone-400 font-semibold">
                <td className="p-2 sticky left-0 bg-stone-200">Total Spending Budget</td>
                {periods.map((p, idx) => {
                  let total = 0;
                  Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
                    group.categories.forEach(cat => {
                      total += getBudget(cat.name, p.start);
                    });
                  });
                  return (
                    <td key={idx} className="border-l border-stone-300 text-center p-2">
                      {total > 0 ? formatCurrency(total) : "—"}
                    </td>
                  );
                })}
                <td className="border-l-2 border-stone-400 text-center p-2 bg-stone-300">
                  {formatCurrency(
                    periods.reduce((sum, p) => {
                      Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
                        group.categories.forEach(cat => {
                          sum += getBudget(cat.name, p.start);
                        });
                      });
                      return sum;
                    }, 0)
                  )}
                </td>
              </tr>

              <tr className="bg-stone-200 font-semibold">
                <td className="p-2 sticky left-0 bg-stone-200">Total Spending Actual</td>
                {periods.map((p, idx) => {
                  let total = 0;
                  Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
                    group.categories.forEach(cat => {
                      total += getActual(cat.name, p.start);
                    });
                  });
                  return (
                    <td key={idx} className="border-l border-stone-300 text-center p-2">
                      {total > 0 ? formatCurrency(total) : "—"}
                    </td>
                  );
                })}
                <td className="border-l-2 border-stone-400 text-center p-2 bg-stone-300">
                  {formatCurrency(
                    periods.reduce((sum, p) => {
                      Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
                        group.categories.forEach(cat => {
                          sum += getActual(cat.name, p.start);
                        });
                      });
                      return sum;
                    }, 0)
                  )}
                </td>
              </tr>

              <tr className="bg-amber-50 border-t border-stone-300 font-semibold">
                <td className="p-2 sticky left-0 bg-amber-50">Difference</td>
                {periods.map((p, idx) => {
                  let budget = 0;
                  let actual = 0;
                  Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
                    group.categories.forEach(cat => {
                      budget += getBudget(cat.name, p.start);
                      actual += getActual(cat.name, p.start);
                    });
                  });
                  const diff = budget - actual;
                  return (
                    <td key={idx} className={`border-l border-stone-300 text-center p-2 ${diff < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {diff !== 0 ? formatCurrency(diff) : "—"}
                    </td>
                  );
                })}
                <td className={`border-l-2 border-stone-400 text-center p-2 bg-amber-100`}>
                  {(() => {
                    let totalBudget = 0;
                    let totalActual = 0;
                    periods.forEach(p => {
                      Object.values(EXPENSE_CATEGORY_GROUPS).forEach(group => {
                        group.categories.forEach(cat => {
                          totalBudget += getBudget(cat.name, p.start);
                          totalActual += getActual(cat.name, p.start);
                        });
                      });
                    });
                    const diff = totalBudget - totalActual;
                    return (
                      <span className={diff < 0 ? "text-rose-600" : "text-emerald-600"}>
                        {formatCurrency(diff)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Drill-down Dialog */}
      <LineItemDrillDown
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        title={drillDownData.title}
        items={drillDownData.items}
      />
    </div>
  );
}