import React, { useState } from "react";
import {
  Table,
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

  const getNumericValue = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.replace(/[$,]/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const getCellKey = (rowIndex, colIndex) => `${rowIndex}-${colIndex}`;

  const handleCellMouseDown = (rowIndex, colIndex) => {
    setIsSelecting(true);
    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectedCells(new Set([getCellKey(rowIndex, colIndex)]));
  };

  const handleCellMouseEnter = (rowIndex, colIndex) => {
    if (!isSelecting || !selectionStart) return;

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

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const calculateTotal = () => {
    let total = 0;
    selectedCells.forEach(cellKey => {
      const [rowIndex, colIndex] = cellKey.split('-').map(Number);
      const row = data[rowIndex];
      const col = columns[colIndex];
      let cellValue = col.render ? col.render(row) : row[col.accessor];
      
      // Extract text content from React elements
      if (React.isValidElement(cellValue)) {
        cellValue = cellValue.props?.children || '';
      }
      
      total += getNumericValue(cellValue);
    });
    return total;
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
        <Table>
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
        </Table>
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
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden" onMouseLeave={handleMouseUp}>
      <div className="overflow-x-auto" onMouseUp={handleMouseUp}>
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50 hover:bg-stone-50">
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  className={`text-stone-600 font-medium ${col.className || ""}`}
                >
                  {typeof col.header === 'function' ? col.header() : col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
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
                      onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                      style={{ userSelect: 'none' }}
                    >
                      {col.render ? col.render(row) : row[col.accessor]}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selectedCells.size > 0 && (
        <div className="bg-stone-50 border-t border-stone-100 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-stone-600">
            {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
          </span>
          <span className="text-sm font-semibold text-stone-900">
            Total: <span className="text-emerald-600">{formatCurrency(calculateTotal())}</span>
          </span>
        </div>
      )}
    </div>
  );
}