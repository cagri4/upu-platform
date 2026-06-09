"use client";

/**
 * Kategori ağacı CRUD — recursive tree render + inline add/delete.
 * "Yeni Kategori" üst panel'den; alt kategori "+ alt" butonundan.
 */

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown, FolderTree } from "lucide-react";
import { StatusBadge } from "@/components/admin/v3-shell";

interface CategoryNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
}

export default function KategorilerPage() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState<CategoryNode[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dagitici/kategoriler", {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setTree(d.tree || []);
      setFlat(d.flat || []);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dagitici/kategoriler", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          parent_id: newParent || null,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Eklenemedi.");
      } else {
        setNewName("");
        setNewParent("");
        await load();
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu kategoriyi sil?")) return;
    const res = await fetch(`/api/dagitici/kategoriler/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const d = await res.json();
    if (!res.ok || !d.success) {
      alert(d.error || "Silinemedi.");
    } else {
      await load();
    }
  }

  async function handleAddChild(parentId: string) {
    const name = prompt("Alt kategori adı:");
    if (!name || !name.trim()) return;
    const res = await fetch("/api/dagitici/kategoriler", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), parent_id: parentId }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) {
      alert(d.error || "Eklenemedi.");
    } else {
      await load();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Kategoriler</h1>
        <p className="mt-1 text-sm text-slate-600">
          {flat.length} kategori · hiyerarşik ağaç
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Yeni Kategori</h2>
        <form
          onSubmit={handleCreate}
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            type="text"
            placeholder="Kategori adı (örn. Gıda)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
            required
          />
          <select
            value={newParent}
            onChange={(e) => setNewParent(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">— Üst kategori (kök) —</option>
            {flat.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Ekle
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-rose-700">{error}</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <FolderTree className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              Henüz kategori yok. Üstten ilk kategoriyi ekle.
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  onAddChild,
  onDelete,
}: {
  node: CategoryNode;
  depth: number;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-500 hover:text-slate-700"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <span className="flex-1 text-slate-900">{node.name}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {node.productCount} ürün
        </span>
        {!node.isActive && <StatusBadge tone="neutral">Pasif</StatusBadge>}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Alt kategori ekle"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="rounded-md p-1 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
            title="Sil"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
