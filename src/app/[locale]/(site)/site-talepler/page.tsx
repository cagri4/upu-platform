"use client";

/**
 * /tr/site-talepler — Arıza & şikayet talepleri (banking style).
 *
 * Sekme: Açık / Tümü / Kapalı. ListCard her talep için kategori ikonuyla.
 * Üstte 3 StatCard (Açık / Acil / Kapatılan).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Wrench,
  AlertTriangle,
  Droplets,
  Zap,
  ArrowUpDown,
  Shield,
  Building,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { HeroBanner, ListCard, Skeleton, StatCard } from "@/components/banking";

interface Ticket {
  id: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  created_at: string | null;
  unit_number: string | null;
}

interface Summary {
  open: number;
  urgent: number;
  closed: number;
}

type Tab = "acik" | "tum" | "kapali";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  asansor: ArrowUpDown,
  su: Droplets,
  elektrik: Zap,
  guvenlik: Shield,
  temizlik: Building,
  diger: Wrench,
};

const PRIORITY_LABEL: Record<string, string> = {
  acil: "🔴 Acil",
  normal: "🟡 Normal",
  dusuk: "🟢 Düşük",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

export default function SiteTaleplerPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [tab, setTab] = useState<Tab>("acik");
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("filter", tab);
    if (token) params.set("t", token);
    fetch(`/api/site/talepler?${params.toString()}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error);
          return;
        }
        setTickets(d.tickets || []);
        setSummary(d.summary || null);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [tab, token]);

  const arizaBildirHref = token
    ? `/api/panel/start?cmd=bakim&t=${encodeURIComponent(token)}`
    : "#";

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Wrench}
        title="Şikayet & Arıza Talepleri"
        subtitle="Bina için açılmış tüm arıza, bakım ve şikayet kayıtları."
        ctaLabel="Arıza Bildir"
        ctaHref={arizaBildirHref}
      />

      <div className="grid grid-cols-3 gap-3">
        {loading || !summary ? (
          <>
            <Skeleton height="h-28" />
            <Skeleton height="h-28" />
            <Skeleton height="h-28" />
          </>
        ) : (
          <>
            <StatCard
              Icon={AlertTriangle}
              value={summary.open}
              label="Açık Talep"
            />
            <StatCard
              Icon={AlertTriangle}
              value={summary.urgent}
              label="Acil"
            />
            <StatCard
              Icon={CheckCircle2}
              value={summary.closed}
              label="Kapatılan"
            />
          </>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-1.5 inline-flex shadow-sm">
        <TabButton active={tab === "acik"} onClick={() => setTab("acik")}>
          Açık
        </TabButton>
        <TabButton active={tab === "tum"} onClick={() => setTab("tum")}>
          Tümü
        </TabButton>
        <TabButton active={tab === "kapali"} onClick={() => setTab("kapali")}>
          Kapalı
        </TabButton>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="h-16" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
            ⚠ {error}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          tickets.map((t) => {
            const Icon = CATEGORY_ICON[t.category] || Wrench;
            const where = t.unit_number ? `Daire ${t.unit_number}` : "Ortak alan";
            const when = formatRelative(t.created_at);
            return (
              <ListCard
                key={t.id}
                Icon={Icon}
                title={t.description.length > 60
                  ? `${t.description.slice(0, 60)}…`
                  : t.description}
                subtitle={`${where}${when ? ` · ${when}` : ""}`}
                rightLabel={PRIORITY_LABEL[t.priority] || t.priority}
                href={arizaBildirHref}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const COPY: Record<Tab, { emoji: string; title: string; body: string }> = {
    acik: {
      emoji: "✅",
      title: "Açık talep yok",
      body: "Şu an binada bekleyen şikayet veya arıza kaydı bulunmuyor.",
    },
    tum: {
      emoji: "📋",
      title: "Henüz talep yok",
      body: "Sakinlerden veya yöneticiden gelen şikayet/arıza kaydı yok.",
    },
    kapali: {
      emoji: "📦",
      title: "Kapatılan talep yok",
      body: "Henüz çözümlenip kapatılmış bir talep bulunmuyor.",
    },
  };
  const c = COPY[tab];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
      <div className="text-4xl">{c.emoji}</div>
      <div className="font-semibold text-slate-900 dark:text-white">{c.title}</div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{c.body}</p>
    </div>
  );
}
