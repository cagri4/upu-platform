-- İter 2 İş #2 — Davet link format /davet/<tenant>/<slug>
--
-- distributor_slugs tablosuna tenant_slug column eklenir. Eski yapıda
-- slug yalın PRIMARY KEY (tek bir global namespace), yeni yapıda
-- (tenant_slug, slug) composite — farklı firmalar aynı dağıtıcı slug'ı
-- kullanabilir.
--
-- Eski kayıtlar için tenant_slug = slug backfill (geriye uyumluluk;
-- single-tenant pre-İter2 davetler kırılmasın).

ALTER TABLE distributor_slugs ADD COLUMN IF NOT EXISTS tenant_slug TEXT;

UPDATE distributor_slugs SET tenant_slug = slug WHERE tenant_slug IS NULL;

ALTER TABLE distributor_slugs ALTER COLUMN tenant_slug SET NOT NULL;

-- Eski yalın slug PK düşür → composite (tenant_slug, slug).
ALTER TABLE distributor_slugs DROP CONSTRAINT IF EXISTS distributor_slugs_pkey;
ALTER TABLE distributor_slugs ADD PRIMARY KEY (tenant_slug, slug);

-- Geri uyumluluk: bir dağıtıcının tek slug'ı olsun (per tenant)
-- — zaten önceki migration'dan UNIQUE INDEX (distributor_user_id, tenant_id) var.
