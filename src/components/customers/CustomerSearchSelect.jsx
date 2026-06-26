import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Search, Plus, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CustomerSearchSelect({ value, onChange, placeholder = "Search customers..." }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Customer.filter({ owner_user_id: user.id }),
  });

  const selectedCustomer = customers.find(c => c.id === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setShowAddForm(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search
    ? customers.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.company?.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  const handleSelect = (customer) => {
    onChange(customer);
    setSearch("");
    setOpen(false);
  };

  const handleAddNew = async () => {
    if (!newCustomer.name) return;
    setIsCreating(true);
    const created = await base44.entities.Customer.create({ ...newCustomer, owner_user_id: user.id });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    handleSelect(created);
    setNewCustomer({ name: "", email: "", phone: "" });
    setShowAddForm(false);
    setIsCreating(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        <Input
          value={open ? search : (selectedCustomer?.name || "")}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
        {selectedCustomer && !open && (
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(true); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {filtered.length > 0 && !showAddForm && (
            <>
              {filtered.slice(0, 50).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-50 text-left border-b border-stone-50 last:border-0"
                >
                  <User className="w-4 h-4 text-stone-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{c.name}</p>
                    {c.email && <p className="text-xs text-stone-500 truncate">{c.email}</p>}
                  </div>
                </button>
              ))}
            </>
          )}

          {filtered.length === 0 && !showAddForm && (
            <p className="px-3 py-3 text-sm text-stone-500">
              {search ? `No matches for "${search}"` : "No customers yet"}
            </p>
          )}

          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50 text-emerald-700 border-t border-stone-100 sticky bottom-0 bg-white"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">
                {search ? `Add "${search}" as new customer` : "Add New Customer"}
              </span>
            </button>
          )}

          {showAddForm && (
            <div className="p-3 space-y-2 border-t border-stone-100">
              <Input
                placeholder="Name *"
                value={showAddForm && search && !newCustomer.name ? search : newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="h-8 text-sm"
                autoFocus
              />
              <Input
                type="email"
                placeholder="Email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(false)} className="flex-1 h-8">
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNew}
                  disabled={!newCustomer.name || isCreating}
                  className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700"
                >
                  {isCreating ? "Adding..." : "Add Customer"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}