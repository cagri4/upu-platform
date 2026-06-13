import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Calendar, BedDouble, Phone } from "lucide-react";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ locale: string; slug: string; id: string }> }

export default async function OnayPage({ params }: Props) {
  const { locale, slug, id } = await params;
  const sb = getServiceClient();

  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, slug, public_settings")
    .eq("slug", slug.toLowerCase())
    .eq("web_published", true)
    .single();
  if (!hotel) notFound();

  const { data: rez } = await sb
    .from("otel_reservations")
    .select("id, hotel_id, guest_name, check_in, check_out, status, total_price, otel_rooms(name, room_type)")
    .eq("id", id)
    .eq("hotel_id", hotel.id)
    .single();
  if (!rez) notFound();

  const settings = (hotel.public_settings as any) || {};
  const contact = settings.contact || {};
  const room = (rez.otel_rooms as any)?.name || "—";

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Talebiniz Alındı</h1>
          <p className="text-sm text-slate-600 mb-6">
            Rezervasyon talebiniz başarıyla kaydedildi. {hotel.name} sizi en kısa sürede onay için arayacak.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 text-left text-sm space-y-2 mb-6">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 mt-0.5" />
              <div>
                <div className="text-xs text-slate-500">Tarih</div>
                <div className="font-medium text-slate-900">{rez.check_in} → {rez.check_out}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <BedDouble className="w-4 h-4 text-emerald-600 mt-0.5" />
              <div>
                <div className="text-xs text-slate-500">Oda</div>
                <div className="font-medium text-slate-900">{room}</div>
              </div>
            </div>
            {rez.total_price != null && (
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5">₺</span>
                <div>
                  <div className="text-xs text-slate-500">Toplam</div>
                  <div className="font-medium text-slate-900">{Number(rez.total_price).toLocaleString("tr-TR")} ₺</div>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 mb-2">Rezervasyon kodu</div>
          <div className="font-mono text-xs text-slate-700 mb-6 bg-slate-100 rounded px-2 py-1 inline-block">{rez.id.slice(0, 8)}</div>

          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 mb-3">
              <Phone className="w-4 h-4" /> Oteli Ara: {contact.phone}
            </a>
          )}

          <div className="pt-4 border-t border-slate-200 mt-4">
            <Link href={`/${locale}/o/${slug}`} className="text-xs text-emerald-700 hover:text-emerald-900">
              ← {hotel.name} ana sayfaya dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
