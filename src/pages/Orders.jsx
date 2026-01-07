import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Search, Download, ShoppingBag, DollarSign, CreditCard } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";

export default function Orders() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  const { data: etsyOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["etsy-orders"],
    queryFn: () => base44.entities.EtsyOrder.list("-sale_date", 1000),
  });

  const { data: orderFees = [] } = useQuery({
    queryKey: ["order-fees"],
    queryFn: () => base44.entities.OrderFee.list(),
  });

  const { data: etsyLedgerEntries = [] } = useQuery({
    queryKey: ["etsy-ledger-entries"],
    queryFn: () => base44.entities.EtsyLedgerEntry.list("-entry_date", 1000),
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const filteredOrders = useMemo(() => {
    return etsyOrders.filter(order => {
      const matchesSearch = !search || 
        order.order_id?.toLowerCase().includes(search.toLowerCase()) ||
        order.buyer_username?.toLowerCase().includes(search.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter !== "all") {
        const orderDate = new Date(order.sale_date);
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        
        if (dateFilter === "30days") {
          matchesDate = orderDate >= thirtyDaysAgo;
        } else if (dateFilter === "90days") {
          matchesDate = orderDate >= ninetyDaysAgo;
        }
      }
      
      return matchesSearch && matchesDate;
    });
  }, [etsyOrders, search, dateFilter]);

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.order_value || 0), 0);
  const totalFees = orderFees
    .filter(f => filteredOrders.some(o => o.id === f.order_id))
    .reduce((sum, f) => sum + (f.total_fees || 0), 0);

  const exportOrders = () => {
    const data = filteredOrders.map(o => {
      const fees = orderFees.find(f => f.order_id === o.id);
      return {
        "Order ID": o.order_id,
        "Date": o.sale_date,
        "Buyer": o.buyer_username,
        "Items": o.number_of_items,
        "Order Value": o.order_value,
        "Shipping": o.shipping_charged,
        "Sales Tax": o.sales_tax,
        "Total Fees": fees?.total_fees || 0,
        "Net": o.order_net,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `etsy-orders-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const columns = [
    {
      header: "Order ID",
      render: (row) => (
        <div>
          <p className="font-medium text-stone-900">#{row.order_id}</p>
          <p className="text-sm text-stone-500">{row.sale_date}</p>
        </div>
      ),
    },
    {
      header: "Buyer",
      render: (row) => (
        <div className="max-w-48">
          <p className="font-medium text-stone-900 truncate">{row.buyer_username || "-"}</p>
          <p className="text-sm text-stone-500">{row.number_of_items} item(s)</p>
        </div>
      ),
    },
    {
      header: "Order Value",
      render: (row) => (
        <span className="font-medium text-stone-900">
          {formatCurrency(row.order_value || 0)}
        </span>
      ),
    },
    {
      header: "Shipping",
      render: (row) => (
        <span className="text-stone-600">
          {formatCurrency(row.shipping_charged || 0)}
        </span>
      ),
    },
    {
      header: "Fees",
      render: (row) => {
        const fees = orderFees.find(f => f.order_id === row.id);
        return (
          <span className="text-rose-600">
            {formatCurrency(fees?.total_fees || 0)}
          </span>
        );
      },
    },
    {
      header: "Net",
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(row.order_net || 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Etsy Orders" description="View imported Etsy sales data">
        <Button variant="outline" onClick={exportOrders}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button
          onClick={() => window.location.href = createPageUrl("MonthlySummary")}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import Orders
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Orders</p>
                <p className="text-2xl font-bold text-stone-900">
                  {filteredOrders.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Revenue</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-stone-500">Total Fees</p>
                <p className="text-2xl font-bold text-stone-900">
                  {formatCurrency(totalFees)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search by order ID or buyer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="90days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {etsyOrders.length === 0 && !ordersLoading ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders imported"
          description="Import your Etsy orders from Monthly Summary to view them here."
          actionLabel="Go to Monthly Summary"
          onAction={() => window.location.href = createPageUrl("MonthlySummary")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredOrders}
          isLoading={ordersLoading}
          emptyMessage="No orders match your filters"
        />
      )}
    </div>
  );
}