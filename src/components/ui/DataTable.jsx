import React, { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

function ColumnFilterHeader({ label, values, selected, filtered, isSorted, sortDirection, onToggle, onClear, onSortAsc, onSortDesc }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 hover:bg-stone-100 rounded -mx-1 px-1 py-0.5">
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc'
              ? <ArrowUp className="w-3.5 h-3.5 text-stone-700" />
              : <ArrowDown className="w-3.5 h-3.5 text-stone-700" />
          ) : null}
          <Filter className={`w-3.5 h-3.5 ${filtered ? "text-emerald-600" : "opacity-40"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-1 border-b border-stone-100">
          <button onClick={onSortAsc} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-stone-100">
            <ArrowUp className="w-3.5 h-3.5" /> Sort A to Z
          </button>
          <button onClick={onSortDesc} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-stone-100">
            <ArrowDown className="w-3.5 h-3.5" /> Sort Z to A
          </button>
        </div>
        <div className="max-h-56 overflow-auto p-1">
          {values.length === 0 ? (
            <p className="text-xs text-stone-400 px-2 py-2">No values</p>
          ) : values.map((v) => {
            const checked = selected.includes(v);
            return (
              <label key={v} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-stone-100 cursor-pointer text-sm">
                <Checkbox checked={checked} onCheckedChange={() => onToggle(v)} />
                <span className="truncate capitalize">{v}</span>
              </label>
            );
          })}
        </div>
        {filtered && (
          <div className="p-1 border-t border-stone-100">
            <button onClick={onClear} className="w-full text-xs text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100">
              Clear filter
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function DataTable({
  columns,
  data,
  isLoading,
  onRowClick,
  emptyMessage = "No data found"
}) {
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [currentRow, setCurrentRow] = useState(null);
  const scrollContainerRef = React.useRef(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const [columnFilters, setColumnFilters] = useState({}); // colIndex -> array of allowed values

  const handleSort = (colIndex) => {
    if (sortColumn === colIndex) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colIndex);
      setSortDirection('asc');
    }
  };

  const setColumnSort = (colIndex, direction) => {
    setSortColumn(colIndex);
    setSortDirection(direction);
  };

  const getColumnValues = (colIndex) => {
    const col = columns[colIndex];
    if (!col || !col.filterValue) return [];
    const vals = new Set();
    data.forEach((row) => {
      const v = col.filterValue(row);
      if (v != null && v !== "") vals.add(String(v));
    });
    return Array.from(vals).sort((a, b) => a.localeCompare(b));
  };

  const selectedValues = (colIndex) => {
    const f = columnFilters[colIndex];
    return f && f.length > 0 ? f : getColumnValues(colIndex);
  };

  const isColumnFiltered = (colIndex) => {
    const f = columnFilters[colIndex];
    return !!f && f.length < getColumnValues(colIndex).length;
  };

  const toggleFilter = (colIndex, value) => {
    setColumnFilters((prev) => {
      const all = getColumnValues(colIndex);
      const current = prev[colIndex] && prev[colIndex].length > 0 ? prev[colIndex] : all;
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const updated = { ...prev };
      if (next.length === 0 || next.length === all.length) {
        delete updated[colIndex]; // no filter
      } else {
        updated[colIndex] = next;
      }
      return updated;
    });
  };

  const clearFilter = (colIndex) =>
    setColumnFilters((prev) => {
      const updated = { ...prev };
      delete updated[colIndex];
      return updated;
    });

  const filteredData = useMemo(() => {
    return data.filter((row) =>
      columns.every((col, colIndex) => {
        if (!col.filterable || !col.filterValue) return true;
        const f = columnFilters[colIndex];
        if (!f || f.length === 0) return true;
        return f.includes(String(col.filterValue(row) ?? ""));
      })
    );
  }, [data, columns, columnFilters]);

  const sortedData = useMemo(() => {
    if (sortColumn === null) return filteredData;
    const col = columns[sortColumn];
    if (!col || !col.sortValue) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = col.sortValue(a);
      const bVal = col.sortValue(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  const getNumericValue = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[$,]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const isNumericColumn = (colIndex) => {
    // Check if column header suggests numeric data
    const col = columns[colIndex];
    const header = typeof col.header === 'function' ? col.header() : col.header;
    if (!header) return false;
    
    const numericKeywords = ['amount', 'total', 'value', 'shipping', 'fees', 'cost', 'price', 'net', 'revenue'];
    return numericKeywords.some(keyword => header.toLowerCase().includes(keyword));
  };

  const getCellKey = (rowIndex, colIndex) => `${rowIndex}-${colIndex}`;

  const handleCellMouseDown = (e, rowIndex, colIndex) => {
    // Don't start cell selection when clicking on interactive elements (checkbox, button, input, select, dropdowns)
    if (e.target.closest('button, input, select, textarea, [role="checkbox"], [role="button"], [role="combobox"], [role="listbox"], [role="option"], a, label, summary, [data-radix-select-trigger], [data-radix-collection-item]')) {
      e.stopPropagation();
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectedCells(new Set([getCellKey(rowIndex, colIndex)]));
  };

  const handleCellMouseEnter = (rowIndex, colIndex) => {
    if (!isSelecting || !selectionStart) return;
    setCurrentRow(rowIndex);
    updateSelection(rowIndex, colIndex);
  };

  const updateSelection = (rowIndex, colIndex) => {
    const minRow = Math.min(selectionStart.row, rowIndex);
    const maxRow = Math.max(selectionStart.row, rowIndex);
    const minCol = Math.min(selectionStart.col, colIndex);
    const maxCol = Math.max(selectionStart.col, colIndex);

    const newSelection = new Set();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        newSelection.add(getCellKey(r, c));
      }
    }
    setSelectedCells(newSelection);
  };

  React.useEffect(() => {
    if (!isSelecting || !selectionStart) return;

    const handleMouseMove = (e) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      // Auto-scroll near bottom
      if (y > rect.height - 50 && container.scrollTop < container.scrollHeight - container.clientHeight) {
        container.scrollTop += 10;
      }
      // Auto-scroll near top
      else if (y < 50 && container.scrollTop > 0) {
        container.scrollTop -= 10;
      }
    };

    const handleMouseUp = () => {
      setIsSelecting(false);
      setSelectedCells(new Set());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, selectionStart]);

  const calculateTotal = () => {
    let total = 0;
    selectedCells.forEach(cellKey => {
      const [rowIndex, colIndex] = cellKey.split('-').map(Number);
      const row = data[rowIndex];
      if (!row) return;
      const col = columns[colIndex];
      if (!col) return;
      let cellValue = col.render ? col.render(row) : row[col.accessor];
      
      // Extract text content from React elements
      if (React.isValidElement(cellValue)) {
        cellValue = cellValue.props?.children || '';
      }
      
      total += getNumericValue(cellValue);
    });
    return total;
  };

  const calculateColumnTotals = () => {
    const totals = {};
    selectedCells.forEach(cellKey => {
      const [rowIndex, colIndex] = cellKey.split('-').map(Number);
      const row = data[rowIndex];
      if (!row) return;
      const col = columns[colIndex];
      if (!col) return;
      
      if (!totals[colIndex]) {
        totals[colIndex] = 0;
      }
      
      let cellValue = col.render ? col.render(row) : row[col.accessor];
      if (React.isValidElement(cellValue)) {
        cellValue = cellValue.props?.children || '';
      }
      
      totals[colIndex] += getNumericValue(cellValue);
    });
    return totals;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // ---- Mobile card layout ----
  const getHeaderLabel = (col) => (typeof col.header === "function" ? col.header() : col.header);

  if (isMobile) {
    if (isLoading) {
      return (
        <div className="space-y-3 md:hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-100 p-4">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      );
    }
    if (!data || data.length === 0) {
      return (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center md:hidden">
          <p className="text-stone-500">{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3 md:hidden">
        {sortedData.map((row, rowIndex) => {
          const primary = columns[0];
          const primaryContent = primary?.render ? primary.render(row, rowIndex) : row[primary?.accessor];
          const rest = columns.slice(1);
          const fields = rest.filter((c) => String(getHeaderLabel(c) ?? "").trim() !== "");
          const actions = rest.filter((c) => String(getHeaderLabel(c) ?? "").trim() === "");
          return (
            <div
              key={row.id || rowIndex}
              onClick={() => onRowClick?.(row)}
              className={`bg-white rounded-2xl border border-stone-100 p-4 ${onRowClick ? "cursor-pointer active:bg-stone-50" : ""}`}
            >
              {primaryContent != null && (
                <div className="font-medium text-stone-900 text-sm mb-3 pb-3 border-b border-stone-100">
                  {primaryContent}
                </div>
              )}
              {fields.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {fields.map((col, colIndex) => {
                    const label = getHeaderLabel(col);
                    const value = col.render ? col.render(row, rowIndex) : row[col.accessor];
                    return (
                      <div key={colIndex} className="flex flex-col">
                        <dt className="text-[11px] uppercase tracking-wide text-stone-400 font-medium">{label}</dt>
                        <dd className="text-stone-800">{value}</dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-stone-100">
                  {actions.map((col, colIndex) => {
                    const value = col.render ? col.render(row, rowIndex) : row[col.accessor];
                    return <React.Fragment key={colIndex}>{value}</React.Fragment>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  // ---- End mobile card layout ----

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow className="bg-stone-50">
              {columns.map((col, i) => (
                <TableHead key={i} className="text-stone-600 font-medium">
                  {typeof col.header === 'function' ? col.header() : col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                {columns.map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
        <p className="text-stone-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="overflow-auto max-h-[60vh]" ref={scrollContainerRef}>
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow className="bg-stone-50 hover:bg-stone-50 sticky top-0 z-10">
              {columns.map((col, i) => {
                const isSortable = !!col.sortValue;
                const isFilterable = !!col.filterable;
                const isSorted = sortColumn === i;
                const headerLabel = typeof col.header === 'function' ? col.header() : col.header;
                if (isFilterable) {
                  return (
                    <TableHead key={i} className={`text-stone-600 font-medium ${col.className || ""}`}>
                      <ColumnFilterHeader
                        label={headerLabel}
                        values={getColumnValues(i)}
                        selected={selectedValues(i)}
                        filtered={isColumnFiltered(i)}
                        isSorted={isSorted}
                        sortDirection={sortDirection}
                        onToggle={(v) => toggleFilter(i, v)}
                        onClear={() => clearFilter(i)}
                        onSortAsc={() => setColumnSort(i, 'asc')}
                        onSortDesc={() => setColumnSort(i, 'desc')}
                      />
                    </TableHead>
                  );
                }
                return (
                  <TableHead
                    key={i}
                    className={`text-stone-600 font-medium ${col.className || ""} ${isSortable ? "cursor-pointer select-none hover:bg-stone-100" : ""}`}
                    onClick={isSortable ? () => handleSort(i) : undefined}
                  >
                    <div className="inline-flex items-center gap-1">
                      {headerLabel}
                      {isSortable && (
                        isSorted ? (
                          sortDirection === 'asc'
                            ? <ArrowUp className="w-3.5 h-3.5" />
                            : <ArrowDown className="w-3.5 h-3.5" />
                        ) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, rowIndex) => (
              <TableRow
                key={row.id || rowIndex}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "cursor-pointer hover:bg-stone-50" : ""}
              >
                {columns.map((col, colIndex) => {
                  const cellKey = getCellKey(rowIndex, colIndex);
                  const isSelected = selectedCells.has(cellKey);
                  return (
                    <TableCell
                      key={colIndex}
                      className={`${col.cellClassName || ""} ${isSelected ? 'bg-blue-100' : ''}`}
                      onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                      style={{ userSelect: 'none' }}
                    >
                      {col.render ? col.render(row, rowIndex) : row[col.accessor]}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
      {selectedCells.size > 0 && (
        <div className="bg-stone-50 border-t border-stone-100 px-6 py-3">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-stone-200">
            <span className="text-sm text-stone-600">
              {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="grid grid-cols-12 gap-4 text-sm">
            {columns.map((col, colIndex) => {
              const columnTotal = calculateColumnTotals()[colIndex];
              const hasTotal = columnTotal !== 0 && columnTotal !== undefined;
              return hasTotal && isNumericColumn(colIndex) ? (
                <div key={colIndex} className="flex flex-col">
                  <span className="text-stone-600 text-xs mb-1">
                    {typeof col.header === 'function' ? col.header() : col.header}
                  </span>
                  <span className={`font-semibold ${columnTotal < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(Math.abs(columnTotal))}
                  </span>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}