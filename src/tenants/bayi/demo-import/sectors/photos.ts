/**
 * Sektör + kategori bazlı sabit Unsplash foto URL haritası.
 *
 * Picsum random KULLANILMAZ — boya kategorisinde plaj çıkma riski var.
 * Unsplash'ten manuel seçilmiş, kategoriye uygun fotoğraflar.
 *
 * Kullanım: getCategoryPhoto(sector, category, idx) → URL döner.
 * idx: 0..3 — kategori başına 4 farklı görsel (1 ürün=1 sabit görsel).
 */

const W = "?w=400&h=400&fit=crop&auto=format";

const PHOTOS: Record<string, Record<string, string[]>> = {
  boya: {
    "İç Cephe Boyaları": [
      `https://images.unsplash.com/photo-1562259949-e8e7689d7828${W}`,
      `https://images.unsplash.com/photo-1589939705384-5185137a7f0f${W}`,
      `https://images.unsplash.com/photo-1581858726788-75bc0f6a952d${W}`,
      `https://images.unsplash.com/photo-1572297999441-4fc15ea75355${W}`,
    ],
    "Dış Cephe Boyaları": [
      `https://images.unsplash.com/photo-1503387762-592deb58ef4e${W}`,
      `https://images.unsplash.com/photo-1507089947368-19c1da9775ae${W}`,
      `https://images.unsplash.com/photo-1530124566582-a618bc2615dc${W}`,
      `https://images.unsplash.com/photo-1604251405906-26abc40b06d0${W}`,
    ],
    "Vernikler & Cilalar": [
      `https://images.unsplash.com/photo-1580893207010-f00078902770${W}`,
      `https://images.unsplash.com/photo-1572025442646-866d16c84a54${W}`,
      `https://images.unsplash.com/photo-1543248939-ff40856f65d4${W}`,
      `https://images.unsplash.com/photo-1503387837-b154d5074bd2${W}`,
    ],
    "Boyama Aletleri": [
      `https://images.unsplash.com/photo-1562259929-b4e1fd3aef09${W}`,
      `https://images.unsplash.com/photo-1581791534023-23a1bff34054${W}`,
      `https://images.unsplash.com/photo-1573804633927-bfcbcd909acd${W}`,
      `https://images.unsplash.com/photo-1581094794329-c8112a89af12${W}`,
    ],
    "Yardımcı Malzemeler": [
      `https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c${W}`,
      `https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc${W}`,
      `https://images.unsplash.com/photo-1542013936693-884638332954${W}`,
      `https://images.unsplash.com/photo-1620712943543-bcc4688e7485${W}`,
    ],
  },
  gida: {
    "Bakliyat": [
      `https://images.unsplash.com/photo-1515543237350-b3eea1ec8082${W}`,
      `https://images.unsplash.com/photo-1622485831248-3f8a3f8a6d72${W}`,
      `https://images.unsplash.com/photo-1589923188900-85dae523342b${W}`,
      `https://images.unsplash.com/photo-1591868574820-9d22cb29f2cc${W}`,
    ],
    "Un & Bulgur": [
      `https://images.unsplash.com/photo-1568254183919-78a4f43a2877${W}`,
      `https://images.unsplash.com/photo-1574323347407-f5e1c1c7c3a0${W}`,
      `https://images.unsplash.com/photo-1620570329265-c97ce85ad2b1${W}`,
      `https://images.unsplash.com/photo-1612257999691-c85f0022d8a8${W}`,
    ],
    "Pirinç & Makarna": [
      `https://images.unsplash.com/photo-1536304929831-ee1ca9d44906${W}`,
      `https://images.unsplash.com/photo-1551462147-37885acc36f1${W}`,
      `https://images.unsplash.com/photo-1551462147-ff29053bfc14${W}`,
      `https://images.unsplash.com/photo-1612874742237-6526221588e3${W}`,
    ],
    "Yağ & Sıvılar": [
      `https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5${W}`,
      `https://images.unsplash.com/photo-1601001815853-3835274ea2bc${W}`,
      `https://images.unsplash.com/photo-1631209121759-cb2d0eb01eaa${W}`,
      `https://images.unsplash.com/photo-1582281298055-e25b84a30b0c${W}`,
    ],
    "Salça & Konserve": [
      `https://images.unsplash.com/photo-1590301249220-ed1ad08ce3fa${W}`,
      `https://images.unsplash.com/photo-1588791832230-a0bd6052e4a2${W}`,
      `https://images.unsplash.com/photo-1563566023-12d3a5fc1eaf${W}`,
      `https://images.unsplash.com/photo-1542838132-92c53300491e${W}`,
    ],
  },
  hirdavat: {
    "El Aletleri": [
      `https://images.unsplash.com/photo-1530124566582-a618bc2615dc${W}`,
      `https://images.unsplash.com/photo-1581244277943-fe4a9c777189${W}`,
      `https://images.unsplash.com/photo-1581783898377-1c85bf937427${W}`,
      `https://images.unsplash.com/photo-1572981779307-38b8cabb2407${W}`,
    ],
    "Vida & Bağlantı": [
      `https://images.unsplash.com/photo-1609205807490-89c0f1ab1f12${W}`,
      `https://images.unsplash.com/photo-1582139329536-e7284fece509${W}`,
      `https://images.unsplash.com/photo-1607400201515-c2c41c07d307${W}`,
      `https://images.unsplash.com/photo-1581092916357-7189a5a3e3a8${W}`,
    ],
    "Sarf Malzeme": [
      `https://images.unsplash.com/photo-1581094794329-c8112a89af12${W}`,
      `https://images.unsplash.com/photo-1581094277421-65f64a8c5f0e${W}`,
      `https://images.unsplash.com/photo-1572297999441-4fc15ea75355${W}`,
      `https://images.unsplash.com/photo-1582139329536-e7284fece509${W}`,
    ],
    "Boya Aletleri": [
      `https://images.unsplash.com/photo-1562259929-b4e1fd3aef09${W}`,
      `https://images.unsplash.com/photo-1581791534023-23a1bff34054${W}`,
      `https://images.unsplash.com/photo-1573804633927-bfcbcd909acd${W}`,
      `https://images.unsplash.com/photo-1573804633927-bfcbcd909acd${W}`,
    ],
    "Güvenlik": [
      `https://images.unsplash.com/photo-1580552921036-26d35b8cb3a8${W}`,
      `https://images.unsplash.com/photo-1605000797499-95a51c5269ae${W}`,
      `https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0${W}`,
      `https://images.unsplash.com/photo-1605000797499-95a51c5269ae${W}`,
    ],
  },
  tekstil: {
    "Pamuklu Kumaşlar": [
      `https://images.unsplash.com/photo-1558769132-cb1aea458c5e${W}`,
      `https://images.unsplash.com/photo-1581539250439-c96689b516dd${W}`,
      `https://images.unsplash.com/photo-1606293459257-65cdd1b5b1a4${W}`,
      `https://images.unsplash.com/photo-1604176354204-9268737828e4${W}`,
    ],
    "Polyester & Karışım": [
      `https://images.unsplash.com/photo-1503342217505-b0a15ec3261c${W}`,
      `https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77${W}`,
      `https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5${W}`,
      `https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2${W}`,
    ],
    "Aksesuar": [
      `https://images.unsplash.com/photo-1591348122449-02525d70379b${W}`,
      `https://images.unsplash.com/photo-1611652022419-a9419f74343d${W}`,
      `https://images.unsplash.com/photo-1582142306909-195724d0a735${W}`,
      `https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf${W}`,
    ],
    "Dikiş Malzeme": [
      `https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0${W}`,
      `https://images.unsplash.com/photo-1604881744042-f9a36f57e87c${W}`,
      `https://images.unsplash.com/photo-1517677208171-0bc6725a3e60${W}`,
      `https://images.unsplash.com/photo-1583120155060-a44090eb5d8b${W}`,
    ],
    "Astar": [
      `https://images.unsplash.com/photo-1564859228273-274232fdb516${W}`,
      `https://images.unsplash.com/photo-1620799140408-edc6dcb6d633${W}`,
      `https://images.unsplash.com/photo-1583846783214-7229a91b20ed${W}`,
      `https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77${W}`,
    ],
  },
  temizlik: {
    "Sabun & Şampuan": [
      `https://images.unsplash.com/photo-1556228720-195a672e8a03${W}`,
      `https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d${W}`,
      `https://images.unsplash.com/photo-1571781926291-c477ebfd024b${W}`,
      `https://images.unsplash.com/photo-1607006677443-c8a6a86fdfa3${W}`,
    ],
    "Deterjan": [
      `https://images.unsplash.com/photo-1610557892470-55d9e80c0bce${W}`,
      `https://images.unsplash.com/photo-1583947581924-860bda6a26df${W}`,
      `https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b${W}`,
      `https://images.unsplash.com/photo-1582735689369-4fe89db7114c${W}`,
    ],
    "Yüzey Temizlik": [
      `https://images.unsplash.com/photo-1583907659441-addbe699e921${W}`,
      `https://images.unsplash.com/photo-1581622558663-b2e33377dfb2${W}`,
      `https://images.unsplash.com/photo-1584464491033-06628f3a6b7b${W}`,
      `https://images.unsplash.com/photo-1610557892470-55d9e80c0bce${W}`,
    ],
    "Kağıt Ürünleri": [
      `https://images.unsplash.com/photo-1584556812952-905ffd0c611a${W}`,
      `https://images.unsplash.com/photo-1612225330812-01a9c6b355ec${W}`,
      `https://images.unsplash.com/photo-1583947582886-f40ec98dc468${W}`,
      `https://images.unsplash.com/photo-1604335398480-1e9b65c069f1${W}`,
    ],
    "Dezenfektan": [
      `https://images.unsplash.com/photo-1584473457409-ce95a9c00bb1${W}`,
      `https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f${W}`,
      `https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0${W}`,
      `https://images.unsplash.com/photo-1605000797499-95a51c5269ae${W}`,
    ],
  },
};

const FALLBACK = `https://images.unsplash.com/photo-1556228720-195a672e8a03${W}`;

export function getCategoryPhoto(sector: string, category: string, idx: number): string {
  const sectorMap = PHOTOS[sector];
  if (!sectorMap) return FALLBACK;
  const arr = sectorMap[category];
  if (!arr || arr.length === 0) return FALLBACK;
  return arr[idx % arr.length];
}
