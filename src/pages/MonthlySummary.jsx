import React, { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Download, Plus, Calendar, BarChart3, Table as TableIcon } from "lucide-react";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, parse } from "date-fns";
import * as XLSX from "xlsx";
import MonthlySummaryKPIs from "../components/monthly/MonthlySummaryKPIs";
import MonthlySummaryTable from "../components/monthly/MonthlySummaryTable";
import BudgetTab from "../components/monthly/BudgetTab";
import EtsyOrderImportDialog from "../components/monthly/EtsyOrderImportDialog";
import CustomSaleDialog from "../components/monthly/CustomSaleDialog";
import BusinessExpenseDialog from "../components/monthly/BusinessExpenseDialog";
import TransferDialog from "../components/monthly/TransferDialog";

export default function MonthlySummary() {
  const [activeTab, setActiveTab] = useState("summary");
  const [viewMode, setViewMode] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [customSaleDialogOpen, setCustomSaleDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: etsyOrders = [] } = useQuery({
    queryKey: ["etsy-orders"],
    queryFn: () => base44.entities.EtsyOrder.list("-sale_date", 1000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees"],
    queryFn: () => base44.entities.OrderFee.list(),
  });

  const { data: customSales = [] } = useQuery({
    queryKey: ["custom-sales"],
    queryFn: () => base44.entities.CustomSale.list("-date", 1000),
  });

  const { data: businessExpenses = [] } = useQuery({
    queryKey: ["business-expenses"],
    queryFn: () => base44.entities.BusinessExpense.list("-date", 1000),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => base44.entities.Transfer.list("-date", 1000),
  });

  const { data: materialPurchases = [] } = useQuery({
    queryKey: ["material-purchases"],
    queryFn: () => base44.entities.MaterialPurchase.list("-purchase_date", 1000),
  });

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    let start, end;
    if (viewMode === "month") {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    } else if (viewMode === "quarter") {
      start = startOfQuarter(selectedDate);
      end = endOfQuarter(selectedDate);
    } else {
      start = startOfYear(selectedDate);
      end = endOfYear(selectedDate);
    }
    return { start, end };
  }, [viewMode, selectedDate]);

  // Filter data by date range
  const filteredData = useMemo(() => {
    const { start, end } = dateRange;
    
    const filterByDate = (items, dateField) => {
      return items.filter(item => {
        const itemDate = new Date(item[dateField]);
        return itemDate >= start && itemDate <= end;
      });
    };

    return {
      etsyOrders: filterByDate(etsyOrders, "sale_date"),
      customSales: filterByDate(customSales, "date"),
      businessExpenses: filterByDate(businessExpenses, "date"),
      transfers: filterByDate(transfers, "date"),
      materialPurchases: filterByDate(materialPurchases, "purchase_date"),
      orderFees: orderFees,
    };
  }, [etsyOrders, customSales, businessExpenses, transfers, orderFees, dateRange]);

  // Export function
  const handleExport = () => {
    // Create summary data for export
    const exportData = {
      "Period": `${format(dateRange.start, "MMM yyyy")} - ${format(dateRange.end, "MMM yyyy")}`,
      "Total Revenue": calculateTotalRevenue(),
      "Total Expenses": calculateTotalExpenses(),
      "Net Profit": calculateNetProfit(),
      // Add more summary rows as needed
    };

    const worksheet = XLSX.utils.json_to_sheet([exportData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
    XLSX.writeFile(workbook, `monthly-summary-${format(selectedDate, "yyyy-MM")}.xlsx`);
  };

  const calculateTotalRevenue = () => {
    const etsySales = filteredData.etsyOrders.reduce((sum, o) => sum + (o.order_value || 0), 0);
    const etsyTax = filteredData.etsyOrders.reduce((sum, o) => sum + (o.sales_tax || 0), 0);
    const etsyRefunds = 0; // TODO: handle refunds
    const customA = filteredData.customSales.filter(s => s.sale_type === "A").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
    const customB = filteredData.customSales.filter(s => s.sale_type === "B").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
    const customC = filteredData.customSales.filter(s => s.sale_type === "C").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
    const customD = filteredData.customSales.filter(s => s.sale_type === "D").reduce((sum, s) => sum + (s.gross_sale || 0), 0);
    
    return etsySales + etsyTax - etsyRefunds + customA + customB + customC + customD;
  };

  const calculateTotalExpenses = () => {
    return filteredData.businessExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  const calculateNetProfit = () => {
    return calculateTotalRevenue() - calculateTotalExpenses();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Monthly Summary</h1>
          <p className="text-stone-500 mt-1">Track revenue, expenses, and profit by period</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Etsy Orders
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* View Mode & Date Selection */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          <Button
            variant={viewMode === "quarter" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("quarter")}
          >
            Quarter
          </Button>
          <Button
            variant={viewMode === "year" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("year")}
          >
            Year
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-500" />
          <Select
            value={format(selectedDate, "yyyy-MM")}
            onValueChange={(v) => setSelectedDate(parse(v + "-01", "yyyy-MM-dd", new Date()))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                return (
                  <SelectItem key={i} value={format(date, "yyyy-MM")}>
                    {format(date, "MMMM yyyy")}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <MonthlySummaryKPIs
        filteredData={filteredData}
        dateRange={dateRange}
        viewMode={viewMode}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="summary">
            <TableIcon className="w-4 h-4 mr-2" />
            Net Profit
          </TabsTrigger>
          <TabsTrigger value="budget">
            <BarChart3 className="w-4 h-4 mr-2" />
            Budget vs Actual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-6">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setCustomSaleDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Sale
            </Button>
            <Button variant="outline" onClick={() => setExpenseDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
            <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transfer
            </Button>
          </div>

          {/* Summary Table */}
          <MonthlySummaryTable
            filteredData={filteredData}
            viewMode={viewMode}
          />
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <BudgetTab
            viewMode={viewMode}
            dateRange={dateRange}
            filteredData={filteredData}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EtsyOrderImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
      <CustomSaleDialog
        open={customSaleDialogOpen}
        onOpenChange={setCustomSaleDialogOpen}
      />
      <BusinessExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
      />
      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
      />
    </div>
  );
}