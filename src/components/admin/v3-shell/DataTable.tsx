"use client";

/**
 * V3 DataTable — dense tablo (zebra hover + sortable).
 *
 * Generic — kolonlar render callback ile. Stateful sort: client-side
 * (server'dan sıralı veri gelmiyorsa). Server-side sort istenirse caller
 * sortKey/onSortChange ile kontrol eder.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  /** Server-side sort için aktif kolonu üst component'ten bildir */
  sortValue?: (row: T) => string | number | null | undefined;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  emptyText = "Kayıt bulunamadı.",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * mul;
      if (va > vb) return 1 * mul;
      return 0;
    });
  }, [rows, columns, sortKey, sortDir]);

  function handleSortClick(col: DataTableColumn<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  }

  const alignCls = (a: DataTableColumn<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-left">
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase ${alignCls(
                    col.align,
                  )} ${col.sortable ? "cursor-pointer select-none hover:text-slate-700" : ""} ${
                    col.className ?? ""
                  }`}
                  onClick={() => handleSortClick(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="flex flex-col leading-none">
                        <ChevronUp
                          className={`h-3 w-3 ${isSorted && sortDir === "asc" ? "text-emerald-600" : "text-slate-300"}`}
                        />
                        <ChevronDown
                          className={`-mt-1 h-3 w-3 ${isSorted && sortDir === "desc" ? "text-emerald-600" : "text-slate-300"}`}
                        />
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-10 text-center text-sm text-slate-500"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, idx) => (
              <tr
                key={rowKey(row)}
                className={`transition-colors hover:bg-slate-50/60 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-3 ${alignCls(col.align)} ${col.className ?? ""}`}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
