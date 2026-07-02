import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, Users, Mail, Phone, Building, List, Grid3x3, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import CustomerFormDialog from "@/components/customers/CustomerFormDialog";
import CustomerDetailSheet from "@/components/customers/CustomerDetailSheet";
import CustomerGridView from "@/components/customers/CustomerGridView";
import { format } from "date-fns";

export default function CustomersPage() {
  const { user, loading } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Customer.filter({
      owner_user_id: user.id,
    }, "-created_date", 10000),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleView = (customer) => {
    setDetailCustomer(customer);
    setDetailOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this customer? Their quotes and orders will remain.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    if (sortBy === "created_date") {
      aVal = aVal ? new Date(aVal) : new Date(0);
      bVal = bVal ? new Date(bVal) : new Date(0);
    } else if (typeof aVal === "string" && typeof bVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";
    
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const columns = [
    {
      key: "name",
      label: "Customer",
      render: (customer) => (
        <div>
          <div className="font-medium cursor-pointer hover:text-emerald-600" onClick={() => handleView(customer)}>
            {customer.name}
          </div>
          {customer.company && (
            <div className="text-xs text-stone-500 flex items-center gap-1 mt-1">
              <Building className="w-3 h-3" />
              {customer.company}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "email",
      label: "Contact",
      render: (customer) => (
        <div className="space-y-1">
          {customer.email && (
            <div className="text-sm flex items-center gap-1">
              <Mail className="w-3 h-3 text-stone-400" />
              {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="text-sm flex items-center gap-1">
              <Phone className="w-3 h-3 text-stone-400" />
              {customer.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "created_date",
      label: "Added",
      render: (customer) => (
        <span className="text-sm text-stone-600">
          {format(new Date(customer.created_date), "MMM dd, yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (customer) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleView(customer)}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(customer)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDelete(customer.id)}
            className="text-rose-600 hover:text-rose-700"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please log in to continue.</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Customers"
        description="Manage customer contacts and view their quote and order history"
      >
        <div className="flex gap-3 items-center">
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-white text-stone-900" : ""}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-white text-stone-900" : ""}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setSortDir("asc"); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Sort by Name</SelectItem>
              <SelectItem value="email">Sort by Contact</SelectItem>
              <SelectItem value="created_date">Sort by Date Added</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="px-2"
          >
            {sortDir === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </Button>

          <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Customer
          </Button>
        </div>
      </PageHeader>

      <Card className="flex-1 flex flex-col overflow-visible mt-0 rounded-none border-0">
        <CardContent className="p-6 flex-1 overflow-visible">
           {viewMode === "grid" ? (
            <CustomerGridView 
              customers={sortedCustomers} 
              onView={handleView}
              onEdit={handleEdit}
              onDelete={(customer) => handleDelete(customer.id)}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
            />
           ) : (
            sortedCustomers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-stone-300 mb-3" />
                <p className="text-stone-500 mb-4">No customers yet</p>
                <Button onClick={handleNew} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Customer
                </Button>
              </div>
            ) : (
              <DataTable data={sortedCustomers} columns={columns} />
            )
           )}
        </CardContent>
      </Card>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={selectedCustomer}
      />

      <CustomerDetailSheet
        customer={detailCustomer}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}