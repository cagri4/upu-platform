"use client";

/**
 * Item Add Modal — edit mode'da "+ Ekle" placeholder tıklandığında açılır.
 * Katalogdaki tüm item'lar checkbox listesi olarak gösterilir; toggle
 * anında parent state'e yansır + caller PATCH eder.
 */

import { type LucideIcon, X, Check } from "lucide-react";

export interface ItemAddModalItem {
  key: string;
  label: string;
  Icon: LucideIcon;
}

interface ItemAddModalProps {
  open: boolean;
  title: string;
  items: ItemAddModalItem[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  onClose: () => void;
}

export function ItemAddModal({
  open,
  title,
  items,
  selectedKeys,
  onToggle,
  onClose,
}: ItemAddModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="overflow-y-auto p-2">
          {items.map((it) => {
            const selected = selectedKeys.includes(it.key);
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => onToggle(it.key)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                >
                  <span className="w-9 h-9 flex-shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <it.Icon className="w-4 h-4 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {it.label}
                  </span>
                  <span
                    className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center border-2 transition ${
                      selected
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <Check className="w-4 h-4" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 transition"
          >
            Bitti
          </button>
        </div>
      </div>
    </div>
  );
}
