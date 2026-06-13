import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ChevronLeft } from "lucide-react";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ locale: string; slug: string; id: string }> }

const STATUS_META: Record<string, { Icon: any; title: string; color: string; msg: string }> = {
  paid:    { Icon: CheckCircle2, title: "Ödeme tamamlandı", color: "emerald", msg: "Teşekkürler, ödemeniz başarıyla alındı." },
  pending: { Icon: Clock,        title: "Ödeme onay bekliyor", color: "amber", msg: "Bankanızla iletişimdeyiz, biraz sonra durum güncellenecek." },
  open:    { Icon: Clock,        title: "Ödeme bekleniyor", color: "cyan",  msg: "Ödeme süreci tamamlanmadı. Linke geri dönerek tekrar deneyebilirsiniz." },
  failed:  { Icon: XCircle,      title: "Ödeme başarısız",  color: "rose",  msg: "Ödeme alınamadı. Lütfen tekrar deneyin veya oteli arayın." },
  canceled:{ Icon: XCircle,      title: "Ödeme iptal",      color: "slate", msg: "Ödeme iptal edildi." },
  expired: { Icon: AlertTriangle,title: "Süre doldu",       color: "amber", msg: "Ödeme süresi doldu. Lütfen yeniden başlatın." },
  refunded:{ Icon: CheckCircle2, title: "Ödeme iade edildi",color: "violet",msg: "Ödemeniz iade edildi." },
};

export default async function OdemePage({ params }: Props) {
  const { locale, slug, id } = await params;
  const sb = getServiceClient();

  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, slug, public_settings")
    .eq("slug", slug.toLowerCase())
    .eq("web_published", true)
    .single();
  if (!hotel) notFound();

  const { data: payment } = await sb
    .from("otel_payments")
    .select("id, amount, currency, status, payment_type, description, otel_reservations(guest_name, check_in, check_out)")
    .eq("id", id)
    .eq("hotel_id", hotel.id)
    .single();
  if (!payment) notFound();

  const meta = STATUS_META[payment.status] || STATUS_META.pending;
  const Icon = meta.Icon;
  const rez = payment.otel_reservations as any;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Link href={`/${locale}/o/${slug}`} className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 mb-4">
          <ChevronLeft className="w-4 h-4" /> {hotel.name}
        </Link>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center">
          <div className={`w-16 h-16 mx-auto rounded-full bg-${meta.color}-50 text-${meta.color}-600 flex items-center justify-center mb-4`}>
            <Icon className="w-10 h-10" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{meta.title}</h1>
          <p className="text-sm text-slate-600 mb-6">{meta.msg}</p>

          <div className="bg-slate-50 rounded-2xl p-4 text-left text-sm space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-slate-500">Misafir</span>
              <span className="font-medium text-slate-900">{rez?.guest_name || "—"}</span>
            </div>
            {rez && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tarih</span>
                <span className="font-medium text-slate-900">{rez.check_in} → {rez.check_out}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Tutar</span>
              <span className="font-bold text-slate-900">{Number(payment.amount).toLocaleString("tr-TR")} ₺</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tipi</span>
              <span className="font-medium text-slate-900">{payment.payment_type === "deposit" ? "Kapora" : payment.payment_type === "full" ? "Tam ödeme" : payment.payment_type}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
