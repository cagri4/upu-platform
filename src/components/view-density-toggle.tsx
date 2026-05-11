"use client";

/**
 * ViewDensityToggle — kart/liste + sütun yoğunluğu seçici.
 *
 * Sayfa başına ya da global "panel görünüm tercihi" olarak çalışır.
 * Tercih localStorage'a yazılır — bir sonraki açılışta hatırlanır.
 *
 * Mobil viewport'ta otomatik 1-2 sütuna düşer (grid responsive override),
 * kullanıcının seçimi geniş ekranda devreye girer.
 *
 * Kullanım:
 *   const { view, columns, setView, setColumns, gridClasses } =
 *     useViewDensity("emlak-mulklerim");
 *   ...
 *   <ViewDensityToggle view={view} columns={columns}
 *     onViewChange={setView} onColumnsChange={setColumns} />
 *   <div className={gridClasses}>...kartlar...</div>
 */

import { useEffect, useState } from "react";

export type ViewMode = "grid" | "list";
export type ColumnCount = 1 | 2 | 3 | 4;

interface ViewDensityPref {
  view: ViewMode;
  columns: ColumnCount;
}

const DEFAULT_PREF: ViewDensityPref = { view: "grid", columns: 2 };

function loadPref(storageKey: string): ViewDensityPref {
  if (typeof window === "undefined") return DEFAULT_PREF;
  try {
    const raw = window.localStorage.getItem(`upu-view:${storageKey}`);
    if (!raw) return DEFAULT_PREF;
    const parsed = JSON.parse(raw) as Partial<ViewDensityPref>;
    const view: ViewMode = parsed.view === "list" ? "list" : "grid";
    const columns: ColumnCount =
      parsed.columns === 1 || parsed.columns === 2 ||
      parsed.columns === 3 || parsed.columns === 4
        ? parsed.columns
        : 2;
    return { view, columns };
  } catch {
    return DEFAULT_PREF;
  }
}

function savePref(storageKey: string, pref: ViewDensityPref) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`upu-view:${storageKey}`, JSON.stringify(pref));
  } catch {
    /* quota / private mode — sessizce yut */
  }
}

/**
 * Sütun sayısı kullanıcının seçimini birebir uygular — mobil/desktop fark
 * etmez. Çok dar kartlar oluşursa kullanıcı istediği zaman sütun sayısını
 * azaltır. Önceki responsive override ("mobil'de 1, sm'den itibaren N")
 * kaldırıldı çünkü kullanıcı tarafında "seçim etkisiz" hissi yaratıyordu.
 */
const GRID_CLASS_MAP: Record<ColumnCount, string> = {
  1: "grid grid-cols-1 gap-3",
  2: "grid grid-cols-2 gap-2 sm:gap-3",
  3: "grid grid-cols-3 gap-2 sm:gap-3",
  4: "grid grid-cols-4 gap-2 sm:gap-3",
};

const LIST_CLASS = "flex flex-col gap-2";

export function getContainerClasses(pref: ViewDensityPref): string {
  if (pref.view === "list") return LIST_CLASS;
  return GRID_CLASS_MAP[pref.columns];
}

export function useViewDensity(storageKey: string) {
  // SSR'da DEFAULT_PREF, mount sonrası localStorage'dan oku
  const [pref, setPref] = useState<ViewDensityPref>(DEFAULT_PREF);

  useEffect(() => {
    setPref(loadPref(storageKey));
  }, [storageKey]);

  function setView(view: ViewMode) {
    setPref((p) => {
      const next = { ...p, view };
      savePref(storageKey, next);
      return next;
    });
  }

  function setColumns(columns: ColumnCount) {
    setPref((p) => {
      const next = { ...p, columns };
      savePref(storageKey, next);
      return next;
    });
  }

  return {
    view: pref.view,
    columns: pref.columns,
    setView,
    setColumns,
    gridClasses: getContainerClasses(pref),
  };
}

interface ViewDensityToggleProps {
  /** Geriye uyum için tutuluyor; component artık view kullanmıyor. */
  view?: ViewMode;
  columns: ColumnCount;
  /** Geriye uyum için tutuluyor; component artık view değiştirmiyor. */
  onViewChange?: (v: ViewMode) => void;
  onColumnsChange: (c: ColumnCount) => void;
}

export function ViewDensityToggle({
  columns,
  onColumnsChange,
}: ViewDensityToggleProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-lg p-1 text-xs">
      <span className="text-slate-500 text-[11px] pl-1">Sütun:</span>
      <div className="inline-flex rounded-md overflow-hidden">
        {([1, 2, 3, 4] as ColumnCount[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColumnsChange(c)}
            aria-pressed={columns === c}
            aria-label={`${c} sütun`}
            title={`${c} sütun yan yana`}
            className={`px-2.5 py-1.5 transition font-medium ${
              columns === c
                ? "bg-slate-900 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
