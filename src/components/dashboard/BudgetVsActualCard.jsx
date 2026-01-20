import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EXPENSE_CATEGORY_GROUPS } from "@/components/shared/expenseCategories";

export default function BudgetVsActualCard({ dateRange }) {
  const { user } = useAuth();
  const { data: budgetPlans = [] } = useQuery({
    queryKey: ["budget-plans", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BudgetPlan.filter({ owner_user_id: user.id })
  });

  const { data: budgetLines = [] } = useQuery({
    queryKey: ["budget-lines", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BudgetLine.filter({ owner_user_id: user.id })
  });

  const { data: businessExpenses = [] } = useQuery({
    queryKey: ["business-expenses", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.BusinessExpense.filter({ owner_user_id: user.id }, "-date", 1000)
  });

  const activePlan = budgetPlans.find(p => p.is_active) || budgetPlans[0];
  const periodStart = new Date(dateRange?.start);
  const periodEnd = new Date(dateRange?.end);

  const comparison = useMemo(() => {
    if (!activePlan || !periodStart || !periodEnd) return [];

    const categories = [];

    EXPENSE_CATEGORY_GROUPS.selling_expenses.categories.slice(0, 3).forEach(cat => {
      const budgetLine = budgetLines.find(
        l => l.plan_id === activePlan.id &&
             l.category_name === cat.name &&
             l.period_start === periodStart.toISOString().split('T')[0]
      );

      const actual = businessExpenses
        .filter(e => e.category_name === cat.name && new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd)
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const budget = budgetLine?.budget_amount || 0;

      categories.push({
        name: cat.label,
        budget,
        actual,
        variance: budget - actual,
        percentUsed: budget > 0 ? (actual / budget * 100) : 0,
        overBudget: actual > budget
      });
    });

    return categories;
  }, [activePlan, budgetLines, businessExpenses, periodStart, periodEnd]);

  if (!activePlan || comparison.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget vs Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-stone-500">No budget data for this period</p>
        </CardContent>
      </Card>
    );
  }

  const totalBudget = comparison.reduce((sum, c) => sum + c.budget, 0);
  const totalActual = comparison.reduce((sum, c) => sum + c.actual, 0);
  const totalVariance = totalBudget - totalActual;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs Actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comparison.map(item => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-stone-700">{item.name}</span>
              <span className={item.overBudget ? "text-rose-600 font-medium" : "text-stone-600"}>
                ${item.actual.toFixed(0)} / ${item.budget.toFixed(0)}
              </span>
            </div>
            <Progress
              value={Math.min(item.percentUsed, 100)}
              className={item.overBudget ? "bg-rose-100" : "bg-emerald-100"}
            />
            {item.overBudget && (
              <p className="text-xs text-rose-600">Over by ${(item.actual - item.budget).toFixed(2)}</p>
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-stone-200 mt-4">
          <div className="flex justify-between text-sm font-medium">
            <span>Total</span>
            <span className={totalActual > totalBudget ? "text-rose-600" : "text-emerald-600"}>
              ${totalActual.toFixed(0)} / ${totalBudget.toFixed(0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}