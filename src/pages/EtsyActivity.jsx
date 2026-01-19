import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, DollarSign, CreditCard, TrendingUp, Upload } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import UnifiedEtsyStatementImport from "@/components/imports/UnifiedEtsyStatementImport";

export default function EtsyActivity() {
  const [search, setSearch] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("fees");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: fees = [], isLoading: feesLoading } = useQuery({
    queryKey: ["fees"],
    queryFn: () => base44.entities.Fee.list("-transaction_date", 5000),
  });

  const { data: etsyStatementImports = [] } = useQuery({
    queryKey: ["etsy-statement-imports"],
    queryFn: () => base44.entities.EtsyStatementImport.list("-imported_at"),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => base44.entities.Transfer.list("-date", 1000),
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Filter fees from active imports only
  const activeFees = useMemo(() => {
    return fees.filter(fee => {
      if (!fee.import_id) return true;
      const feeImport = etsyStatementImports.find(imp => imp.id === fee.import_id);
      return !feeImport || feeImport.status !== 'replaced';
    });
  }, [fees, etsyStatementImports]);

  const filteredFees = useMemo(() => {
    let filtered = activeFees;

    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-");
      const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const end = endOfMonth(start);
      
      filtered = filtered.filter(f => {
        const date = new Date(f.transaction_date);
        return date >= start && date <= end;
      });
    }

    return filtered.filter(fee => {
      const matchesSearch = !search || 
        fee.description?.toLowerCase().includes(search.toLowerCase()) ||
        fee.order_id?.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = feeTypeFilter === "all" || fee.fee_type === feeTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [activeFees, search, feeTypeFilter, selectedMonth]);

  const etsyDeposits = useMemo(() => {
    let deposits = transfers.filter(t => t.type === "etsy_deposit");

    if (selectedMonth !== "all") {
      const [year, month] = selectedMonth.split("-");
      const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const end = endOfMonth(start);
      
      deposits = deposits.filter(d => {
        const date = new Date(d.date);
        return date >= start && date <= end;
      });
    }

    return deposits;
  }, [transfers, selectedMonth]);

  const feeTypeLabels = {
    listing: "Listing Fee",
    transaction: "Transaction Fee",
    processing: "Processing Fee",
    share_save_credit: "Share & Save Credit",
    other_fee: "Other Fee",
    etsy_ads: "Etsy Ads",
    offsite_ads: "Offsite Ads",
    shipping_label: "Shipping Label",
    other_postage: "Other Postage",
  };

  const totalFees = filteredFees.reduce((sum, f) => sum + Math.abs(f.amount || 0), 0);
  const totalDeposits = etsyDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Get available months from imports
  const availableMonths = useMemo(() => {
    const months = new Set(etsyStatementImports.map(imp => imp.statement_month));
    return Array.from(months).sort().reverse();
  }, [etsyStatementImports]);

  const exportFees = () => {
    const data = filteredFees.map(f => ({
      "Date": f.transaction_date,
      "Order ID": f.order_id || "—",
      "Fee Type": feeTypeLabels[f.fee_type] || f.fee_type,
      "Amount": f.amount,
      "Description": f.description,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Etsy Fees");
    XLSX.writeFile(wb, `etsy-fees-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const feeColumns = [
    {
      header: "Date",
      render: (row) => row.transaction_date || "—",
    },
    {
      header: "Order ID",
      render: (row) => (
        <div className="max-w-32 truncate">
          {row.order_id ? (
            <span className="text-blue-600">#{row.order_id}</span>
          ) : (
            <span className="text-stone-400">—</span>
          )}
        </div>
      ),
    },
    {
      header: "Fee Type",
      render: (row) => (
        <span className="text-sm">
          {feeTypeLabels[row.fee_type] || row.fee_type}
        </span>
      ),
    },
    {
      header: "Description",
      render: (row) => (
        <div className="max-w-xs truncate text-stone-600 text-sm">
          {row.description || "—"}
        </div>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className={`font-semibold ${row.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {formatCurrency(row.amount || 0)}
        </span>
      ),
    },
  ];

  const depositColumns = [
    {
      header: "Date",
      render: (row) => row.date || "—",
    },
    {
      header: "Description",
      render: (row) => (
        <div className="text-stone-600">
          {row.description || "Etsy Deposit"}
        </div>
      ),
    },
    {
      header: "Amount",
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(row.amount || 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Etsy Activity" 
        description="Fees, ads, shipping labels, and deposits from Etsy statements"
      >
        <Button 
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setImportDialogOpen(true)}
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Etsy Statement
        </Button>
      </PageHeader>

      {/* Helper Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>📊 Import your Etsy Monthly Statement</strong> to automatically populate Orders, Fees, Ads, Shipping Labels, and Deposits. 
          This is the single source of truth for all Etsy financial data.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Fees & Charges</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalFees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Deposits</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalDeposits)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Filter */}
      <div className="flex gap-3 items-center">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {format(new Date(month + "-01"), "MMMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={exportFees} size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="fees">Fees & Charges</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
        </TabsList>

        <TabsContent value="fees" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Search by order ID or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={feeTypeFilter} onValueChange={setFeeTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Fee Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fee Types</SelectItem>
                {Object.keys(feeTypeLabels).map((type) => (
                  <SelectItem key={type} value={type}>
                    {feeTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {fees.length === 0 && !feesLoading ? (
            <EmptyState
              icon={CreditCard}
              title="No fees imported"
              description="Import an Etsy Monthly Statement to view fees, ads, and shipping charges."
              actionLabel="Import Statement"
              onAction={() => setImportDialogOpen(true)}
            />
          ) : (
            <DataTable
              columns={feeColumns}
              data={filteredFees}
              isLoading={feesLoading}
              emptyMessage="No fees match your filters"
            />
          )}
        </TabsContent>

        <TabsContent value="deposits">
          {etsyDeposits.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No deposits recorded"
              description="Deposits are tracked separately as cashflow, not revenue."
            />
          ) : (
            <DataTable
              columns={depositColumns}
              data={etsyDeposits}
              emptyMessage="No deposits for selected period"
            />
          )}
        </TabsContent>
      </Tabs>

      <UnifiedEtsyStatementImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}