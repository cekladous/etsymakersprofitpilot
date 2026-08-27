import React, { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Search, Plus, User, X, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CustomerSearchSelect({
  value,
  onChange,
  placeholder = "Search customers...",
  // When true, the "+ Create new customer" form does NOT persist immediately;
  // it emits a pending-new customer object and the parent creates the
  // Customer record when the owning record (e.g. a quote) is saved.
  deferCreateNewCustomer = false,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "" });
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.id],
    enabled: !!user,
    queryFn: () => base44.entities.Customer.filter({ owner_user_id: user.id }),
  });

  // `value` may be a customer id (string) or a full object (existing or pending-new)
  const selected =
    value && typeof value === "object"
      ? value
      : customers.find((c) => c.id === value) || null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setShowAddForm(false);
        setEditMode(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.email?.toLowerCase().includes(search.toLowerCase()) ||
          c.company?.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  const handleSelect = (customer) => {
    onChange(customer);
    setSearch("");
    setOpen(false);
    setShowAddForm(false);
  };

  const startAddNew = () => {
    setShowAddForm(true);
    setDraft({ name: search || "", email: "", phone: "" });
  };

  const confirmNew = async () => {
    if (!draft.name) return;
    if (deferCreateNewCustomer) {
      handleSelect({ name: draft.name, email: draft.email, phone: draft.phone, _isNew: true });
      return;
    }
    setIsCreating(true);
    try {
      const created = await base44.entities.Customer.create({
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        owner_user_id: user.id,
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      handleSelect(created);
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = () => {
    setEditMode(true);
    setDraft({
      name: selected?.name || "",
      email: selected?.email || "",
      phone: selected?.phone || "",
    });
    setOpen(false);
    setShowAddForm(false);
  };

  const saveEdit = () => {
    if (!draft.name) return;
    onChange({
      ...(selected || {}),
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      _isNew: !!selected?._isNew,
    });
    setEditMode(false);
  };

  const clearSelection = () => {
    onChange(null);
    setSearch("");
    setEditMode(false);
    setShowAddForm(false);
  };

  // ---- Compact selected card ----
  if (selected && !open && !showAddForm && !editMode) {
    return (
      <div
        ref={containerRef}
        className="flex items-start gap-3 p-3 bg-stone-50 border border-stone-200 rounded-lg"
      >
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 truncate">
            {selected.name}
            {selected._isNew && (
              <span className="ml-2 text-[10px] font-normal text-emerald-600 align-middle">
                new
              </span>
            )}
          </p>
          <div className="text-xs text-stone-500 space-y-0.5 mt-0.5">
            {selected.email && (
              <p className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                {selected.email}
              </p>
            )}
            {selected.phone && (
              <p className="flex items-center gap-1 truncate">
                <Phone className="w-3 h-3 flex-shrink-0" />
                {selected.phone}
              </p>
            )}
            {!selected.email && !selected.phone && (
              <p className="italic">No contact info</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs text-stone-500 hover:text-emerald-700 font-medium px-2 py-1 rounded hover:bg-white"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-white rounded"
            aria-label="Clear customer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ---- Inline edit form ----
  if (editMode && selected) {
    return (
      <div
        ref={containerRef}
        className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-2"
      >
        <Input
          placeholder="Name *"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-8 text-sm"
          autoFocus
        />
        <Input
          type="email"
          placeholder="Email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Phone"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditMode(false)}
            className="flex-1 h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveEdit}
            disabled={!draft.name}
            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700"
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  // ---- Search combobox ----
  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            setShowAddForm(false);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {filtered.length > 0 && !showAddForm && (
            filtered.slice(0, 50).map((c) => (
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
            ))
          )}

          {filtered.length === 0 && !showAddForm && (
            <p className="px-3 py-3 text-sm text-stone-500">
              {search ? `No matches for "${search}"` : "No customers yet"}
            </p>
          )}

          {!showAddForm && (
            <button
              type="button"
              onClick={startAddNew}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50 text-emerald-700 border-t border-stone-100 sticky bottom-0 bg-white"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">+ Create new customer</span>
            </button>
          )}

          {showAddForm && (
            <div className="p-3 space-y-2 border-t border-stone-100">
              <Input
                placeholder="Name *"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="h-8 text-sm"
                autoFocus
              />
              <Input
                type="email"
                placeholder="Email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Phone"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={confirmNew}
                  disabled={!draft.name || isCreating}
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