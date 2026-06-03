-- Bayi #6.3 — B2B iç sevkiyat akışı (DHL/PostNL API yok)
--
-- Sipariş status='shipped' veya sonrasında shipment_status alt-tracking aktif.
-- shipment_status değeri Türkçe; status (lifecycle) ile EŞZAMANLI çalışır.
--   shipment_status='teslim_edildi' → endpoint status='delivered' + delivered_at damgalar.
--   shipment_status='iade' sadece işaret — refund akışı bu sprint'te değil.
--
-- Storage bucket bayi-deliveries upload-route içinde auto-create (mevcut
-- bayi-product-photos pattern'i). Burada sadece kolon eklenir.

ALTER TABLE bayi_dealer_orders
  ADD COLUMN IF NOT EXISTS shipment_status TEXT NULL
    CHECK (shipment_status IN ('hazirlandi','yola_cikti','teslim_edildi','iade')),
  ADD COLUMN IF NOT EXISTS tracking_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS driver_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS vehicle_plate TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivered_photo_url TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_dealer_orders_shipment_status
  ON bayi_dealer_orders(tenant_id, shipment_status)
  WHERE shipment_status IS NOT NULL;
