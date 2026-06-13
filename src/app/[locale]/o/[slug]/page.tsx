import { notFound } from "next/navigation";
import Link from "next/link";
import { BedDouble, Users, Phone, Mail, MapPin, Wifi, Coffee, Car, Calendar } from "lucide-react";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ locale: string; slug: string }> }

interface RoomType {
  room_type: string;
  min_price: number;
  max_occupancy: number;
  count: number;
  bed_type: string | null;
}

const AMENITY_ICON: Record<string, any> = {
  wifi: Wifi, breakfast: Coffee, parking: Car,
};

export default async function OtelLanding({ params }: Props) {
  const { locale, slug } = await params;
  const sb = getServiceClient();

  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, slug, public_settings, web_published")
    .eq("slug", slug.toLowerCase())
    .eq("web_published", true)
    .single();

  if (!hotel) notFound();

  const { data: rooms } = await sb
    .from("otel_rooms")
    .select("id, name, room_type, bed_type, max_occupancy, base_price")
    .eq("hotel_id", hotel.id)
    .neq("status", "out_of_order")
    .order("sort_order", { ascending: true });

  const typeMap = new Map<string, RoomType>();
  for (const r of rooms || []) {
    const existing = typeMap.get(r.room_type);
    if (!existing) {
      typeMap.set(r.room_type, {
        room_type: r.room_type,
        min_price: Number(r.base_price) || 0,
        max_occupancy: r.max_occupancy || 2,
        count: 1,
        bed_type: r.bed_type,
      });
    } else {
      existing.count += 1;
      if (r.base_price && Number(r.base_price) < existing.min_price) existing.min_price = Number(r.base_price);
    }
  }
  const roomTypes = Array.from(typeMap.values());

  const settings = (hotel.public_settings as any) || {};
  const heroTitle = settings.hero_title || hotel.name;
  const heroSubtitle = settings.hero_subtitle || "Konforlu konaklama için bugün rezervasyon yapın";
  const description = settings.description || null;
  const gallery: string[] = settings.gallery_urls || [];
  const amenities: string[] = settings.amenities || [];
  const contact = settings.contact || {};
  const address = settings.address || null;

  const bookingHref = `/${locale}/o/${slug}/rezervasyon`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-emerald-700 via-emerald-600 to-cyan-600 text-white">
        {gallery[0] && (
          <div className="absolute inset-0 opacity-30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gallery[0]} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">{heroTitle}</h1>
          <p className="text-base md:text-lg text-white/90 mb-6 max-w-2xl">{heroSubtitle}</p>
          {address && (
            <div className="inline-flex items-center gap-2 text-sm text-white/80 mb-6">
              <MapPin className="w-4 h-4" /> {address}
            </div>
          )}
          <div className="mt-6">
            <Link
              href={bookingHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-emerald-700 font-semibold shadow-lg hover:scale-[1.02] transition"
            >
              <Calendar className="w-5 h-5" /> Rezervasyon Yap
            </Link>
          </div>
        </div>
      </section>

      {/* Description */}
      {description && (
        <section className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Hakkımızda</h2>
          <p className="text-slate-700 leading-relaxed whitespace-pre-line">{description}</p>
        </section>
      )}

      {/* Room types */}
      {roomTypes.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Oda Tipleri</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roomTypes.map((rt) => (
              <div key={rt.room_type} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <BedDouble className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold capitalize text-slate-900 mb-1">{rt.room_type}</h3>
                <div className="text-xs text-slate-500 mb-3 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {rt.max_occupancy} kişi</span>
                  {rt.bed_type && <span>· {rt.bed_type}</span>}
                  <span>· {rt.count} oda</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Gecelik fiyat </span>
                    <span className="text-lg font-bold text-slate-900">{Math.round(rt.min_price).toLocaleString("tr-TR")} ₺</span>
                  </div>
                  <Link href={bookingHref} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">Rezerve et →</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {gallery.length > 1 && (
        <section className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Galeri</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.slice(0, 9).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Görsel ${i + 1}`} className="w-full h-48 object-cover rounded-2xl shadow-sm" />
            ))}
          </div>
        </section>
      )}

      {/* Amenities */}
      {amenities.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Olanaklar</h2>
          <div className="flex flex-wrap gap-3">
            {amenities.map((a) => {
              const Icon = AMENITY_ICON[a.toLowerCase()] || BedDouble;
              return (
                <div key={a} className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-sm text-slate-700">
                  <Icon className="w-4 h-4 text-emerald-600" /> {a}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Contact + CTA */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-200">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-8 md:p-10 shadow-lg">
          <h2 className="text-2xl font-bold mb-3">Rezervasyon için iletişime geçin</h2>
          <p className="text-white/80 mb-6">Sorularınız için bize ulaşın veya direkt online rezervasyon yapın.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-3 text-white/90 hover:text-white">
                <Phone className="w-5 h-5 text-emerald-400" /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-3 text-white/90 hover:text-white">
                <Mail className="w-5 h-5 text-emerald-400" /> {contact.email}
              </a>
            )}
          </div>
          <Link href={bookingHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition">
            <Calendar className="w-5 h-5" /> Şimdi Rezerve Et
          </Link>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-6 text-center text-xs text-slate-400">
        Powered by UPU Otel · {hotel.name}
      </footer>
    </div>
  );
}
