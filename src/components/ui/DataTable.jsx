import React, { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

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

  const handleSort = (colIndex) => {
    if (sortColumn === colIndex) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colIndex);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (sortColumn === null) return data;
    const col = columns[sortColumn];
    if (!col || !col.sortValue) return data;
    return [...data].sort((a, b) => {
      const aVal = col.sortValue(a);
      const bVal = col.sortValue(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortColumn, sortDirection, columns]);

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
                const isSorted = sortColumn === i;
                return (
                  <TableHead
                    key={i}
                    className={`text-stone-600 font-medium ${col.className || ""} ${isSortable ? "cursor-pointer select-none hover:bg-stone-100" : ""}`}
                    onClick={isSortable ? () => handleSort(i) : undefined}
                  >
                    <div className="inline-flex items-center gap-1">
                      {typeof col.header === 'function' ? col.header() : col.header}
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