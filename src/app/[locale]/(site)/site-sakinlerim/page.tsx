"use client";

/**
 * /tr/site-sakinlerim — Sakin listesi (banking style).
 *
 * Aktif binadaki tüm sakinleri daire numarasına göre listeler. ListCard
 * paterni — sol User ikonu, başlık = ad, alt = daire + telefon, sağ chip
 * = aktif/pasif. Tıklanınca WA'da fiş açar (henüz detail page yok).
 *
 * Bina yoksa Forbidden/empty state göster.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Phone, Building2, UserPlus } from "lucide-react";
import { HeroBanner, ListCard, Skeleton, InfoChip } from "@/components/banking";

interface Resident {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  unit_number: string;
}

interface BuildingMeta {
  id: string;
  name: string;
}

export default function SiteSakinlerimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState<BuildingMeta | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/sakinler${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error);
          return;
        }
        setBuilding(d.building ?? null);
        setResidents(d.residents ?? []);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [token]);

  const activeCount = residents.filter((r) => r.is_active).length;
  const totalCount = residents.length;

  const inviteHref = token
    ? `/api/panel/start?cmd=binakodu&t=${encodeURIComponent(token)}`
    : "#";

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Building2}
        title={building?.name ?? "Sakinlerim"}
        subtitle={
          building
            ? `${activeCount} aktif sakin · ${totalCount} kayıt`
            : "Binanızdaki sakinler"
        }
        ctaLabel="Bina Kodu Paylaş"
        ctaHref={inviteHref}
      />

      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Sakin Listesi
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="h-16" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
            ⚠ {error}
          </div>
        ) : residents.length === 0 ? (
          <EmptyState inviteHref={inviteHref} />
        ) : (
          <div className="space-y-2">
            {residents.map((r) => (
              <ListCard
                key={r.id}
                Icon={User}
                title={r.name}
                subtitle={
                  r.phone
                    ? `Daire ${r.unit_number} · ${formatPhone(r.phone)}`
                    : `Daire ${r.unit_number}`
                }
                rightLabel={r.is_active ? "Aktif" : "Pasif"}
                href={
                  r.phone
                    ? `https://wa.me/${r.phone.replace(/\D/g, "")}`
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Bilgilendirme */}
      {!loading && !error && residents.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            Hızlı Aksiyon
          </div>
          <InfoChip
            Icon={UserPlus}
            text="Yeni sakin eklemek için bina kodunu paylaşın"
            href={inviteHref}
          />
          <InfoChip
            Icon={Phone}
            text="Sakine WhatsApp mesaj göndermek için karta tıklayın"
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({ inviteHref }: { inviteHref: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-3">
      <div className="text-4xl">🏢</div>
      <div className="font-semibold text-slate-900 dark:text-white">
        Henüz sakin yok
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Bina kodunuzu sakinlerinizle paylaşın — kayıt olduklarında burada
        görünür.
      </p>
      <a
        href={inviteHref}
        className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
      >
        Bina Kodu Al
      </a>
    </div>
  );
}

function formatPhone(p: string): string {
  // 905001000001 → 0500 100 00 01
  const digits = p.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("90")) {
    const rest = digits.slice(2);
    return `0${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`;
  }
  return p;
}
