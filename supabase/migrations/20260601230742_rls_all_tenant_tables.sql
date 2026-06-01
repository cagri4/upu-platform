-- RLS Adım B — kalan multi-tenant tablolar (2026-06-01)
--
-- Adım A pilot (bayi_dealers) doğrulandıktan sonra kalan 79 tabloyu
-- kapsar. Pattern sy_buildings / bayi_dealers ile aynı:
--   tenant_id IN (SELECT tenant_id FROM profiles WHERE auth_user_id = auth.uid())
--
-- Service role otomatik bypass eder (Supabase davranışı); tüm /api/*
-- endpoint'leri service client kullandığı için backend regression yok.
--
-- profiles + onboarding_state: own-profile/own-user policy (kullanıcı
-- kendi satırını görür, başkasını DEĞİL).
--
-- 9 tablo SKIP — service-only veya anon-needed (her birinin sebebi
-- aşağıda yorumla belgelendi).

BEGIN;

-- ── STANDARD TENANT-SCOPED TABLES (68) ──────────────────────────

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_conversations;
CREATE POLICY "tenant_isolation" ON public.agent_conversations
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.agent_learnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_learnings;
CREATE POLICY "tenant_isolation" ON public.agent_learnings
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_profiles;
CREATE POLICY "tenant_isolation" ON public.agent_profiles
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_proposals;
CREATE POLICY "tenant_isolation" ON public.agent_proposals
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.agent_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_quotas;
CREATE POLICY "tenant_isolation" ON public.agent_quotas
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.agent_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_usage_events;
CREATE POLICY "tenant_isolation" ON public.agent_usage_events
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.ai_usage;
CREATE POLICY "tenant_isolation" ON public.ai_usage
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_campaigns;
CREATE POLICY "tenant_isolation" ON public.bayi_campaigns
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_categories;
CREATE POLICY "tenant_isolation" ON public.bayi_categories
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_collection_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_collection_activities;
CREATE POLICY "tenant_isolation" ON public.bayi_collection_activities
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_companies;
CREATE POLICY "tenant_isolation" ON public.bayi_companies
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_credit_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_credit_movements;
CREATE POLICY "tenant_isolation" ON public.bayi_credit_movements
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_dealer_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_credits;
CREATE POLICY "tenant_isolation" ON public.bayi_dealer_credits
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_dealer_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_invoices;
CREATE POLICY "tenant_isolation" ON public.bayi_dealer_invoices
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_dealer_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_orders;
CREATE POLICY "tenant_isolation" ON public.bayi_dealer_orders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_dealer_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_transactions;
CREATE POLICY "tenant_isolation" ON public.bayi_dealer_transactions
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_dealer_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_visits;
CREATE POLICY "tenant_isolation" ON public.bayi_dealer_visits
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_drip_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_drip_campaigns;
CREATE POLICY "tenant_isolation" ON public.bayi_drip_campaigns
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_drip_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_drip_enrollments;
CREATE POLICY "tenant_isolation" ON public.bayi_drip_enrollments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_invite_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_invite_links;
CREATE POLICY "tenant_isolation" ON public.bayi_invite_links
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_invoices;
CREATE POLICY "tenant_isolation" ON public.bayi_invoices
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_order_items;
CREATE POLICY "tenant_isolation" ON public.bayi_order_items
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_orders;
CREATE POLICY "tenant_isolation" ON public.bayi_orders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_payments;
CREATE POLICY "tenant_isolation" ON public.bayi_payments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_products;
CREATE POLICY "tenant_isolation" ON public.bayi_products
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_purchase_orders;
CREATE POLICY "tenant_isolation" ON public.bayi_purchase_orders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_referral_codes;
CREATE POLICY "tenant_isolation" ON public.bayi_referral_codes
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_referrals;
CREATE POLICY "tenant_isolation" ON public.bayi_referrals
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_sales_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_sales_targets;
CREATE POLICY "tenant_isolation" ON public.bayi_sales_targets
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.bayi_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_suppliers;
CREATE POLICY "tenant_isolation" ON public.bayi_suppliers
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.campaigns;
CREATE POLICY "tenant_isolation" ON public.campaigns
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.contracts;
CREATE POLICY "tenant_isolation" ON public.contracts
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_contact_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_contact_actions;
CREATE POLICY "tenant_isolation" ON public.emlak_contact_actions
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_customers;
CREATE POLICY "tenant_isolation" ON public.emlak_customers
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_monitoring_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_monitoring_criteria;
CREATE POLICY "tenant_isolation" ON public.emlak_monitoring_criteria
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_presentations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_presentations;
CREATE POLICY "tenant_isolation" ON public.emlak_presentations
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_properties;
CREATE POLICY "tenant_isolation" ON public.emlak_properties
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_property_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_property_photos;
CREATE POLICY "tenant_isolation" ON public.emlak_property_photos
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.emlak_publishing_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_publishing_history;
CREATE POLICY "tenant_isolation" ON public.emlak_publishing_history
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.mkt_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_campaigns;
CREATE POLICY "tenant_isolation" ON public.mkt_campaigns
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.mkt_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_order_items;
CREATE POLICY "tenant_isolation" ON public.mkt_order_items
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.mkt_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_orders;
CREATE POLICY "tenant_isolation" ON public.mkt_orders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.mkt_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_products;
CREATE POLICY "tenant_isolation" ON public.mkt_products
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.mkt_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_sales;
CREATE POLICY "tenant_isolation" ON public.mkt_sales
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.mkt_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_suppliers;
CREATE POLICY "tenant_isolation" ON public.mkt_suppliers
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_appointments;
CREATE POLICY "tenant_isolation" ON public.muh_appointments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_beyanname_statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_beyanname_statuses;
CREATE POLICY "tenant_isolation" ON public.muh_beyanname_statuses
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_invoices;
CREATE POLICY "tenant_isolation" ON public.muh_invoices
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_mukellefler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_mukellefler;
CREATE POLICY "tenant_isolation" ON public.muh_mukellefler
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_payments;
CREATE POLICY "tenant_isolation" ON public.muh_payments
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_reminders;
CREATE POLICY "tenant_isolation" ON public.muh_reminders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.muh_tahsilat_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_tahsilat_reminders;
CREATE POLICY "tenant_isolation" ON public.muh_tahsilat_reminders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.otel_guest_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_guest_messages;
CREATE POLICY "tenant_isolation" ON public.otel_guest_messages
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.otel_hotels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_hotels;
CREATE POLICY "tenant_isolation" ON public.otel_hotels
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.otel_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_rooms;
CREATE POLICY "tenant_isolation" ON public.otel_rooms
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.otel_user_hotels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_user_hotels;
CREATE POLICY "tenant_isolation" ON public.otel_user_hotels
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.reminders;
CREATE POLICY "tenant_isolation" ON public.reminders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_inventory;
CREATE POLICY "tenant_isolation" ON public.rst_inventory
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_loyalty_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_loyalty_members;
CREATE POLICY "tenant_isolation" ON public.rst_loyalty_members
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_loyalty_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_loyalty_visits;
CREATE POLICY "tenant_isolation" ON public.rst_loyalty_visits
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_menu_items;
CREATE POLICY "tenant_isolation" ON public.rst_menu_items
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_order_items;
CREATE POLICY "tenant_isolation" ON public.rst_order_items
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_orders;
CREATE POLICY "tenant_isolation" ON public.rst_orders
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_reservations;
CREATE POLICY "tenant_isolation" ON public.rst_reservations
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.rst_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_tables;
CREATE POLICY "tenant_isolation" ON public.rst_tables
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.user_employee_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.user_employee_progress;
CREATE POLICY "tenant_isolation" ON public.user_employee_progress
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.user_favorites;
CREATE POLICY "tenant_isolation" ON public.user_favorites
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON public.user_invitations;
CREATE POLICY "tenant_isolation" ON public.user_invitations
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE auth_user_id = auth.uid()));


-- ── SPECIAL: profiles (kendi profile, multi-tenant uyumlu) ───────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_profile_select" ON public.profiles;
DROP POLICY IF EXISTS "own_profile_update" ON public.profiles;
CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid());
CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR auth_user_id = auth.uid())
  WITH CHECK (id = auth.uid() OR auth_user_id = auth.uid());
-- INSERT/DELETE: service-role only (signup + admin actions).

-- ── SPECIAL: onboarding_state (user_id anchor) ───────────────────────
ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_onboarding" ON public.onboarding_state;
CREATE POLICY "own_onboarding" ON public.onboarding_state
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()));

-- ── SKIP (9): aşağıda her tablo + sebep ───────────────────────────────
--   audit_log: append-only system writes, service-role only
--   bot_activity: system writes (WA bot telemetry), service-role only
--   command_sessions: WA bot phone-state, no auth.uid() (no Supabase session)
--   distributor_slugs: anon-needed: /d/<slug> public redirect → tenant lookup
--   invite_codes: anon-needed: invite code verification before signup
--   invite_links: anon-needed: invite link claim before signup
--   muh_tax_rates: platform-shared (tenant_id IS NULL satırlar)
--   platform_events: system writes (audit + analytics), service-role only
--   saas_phone_registry: cross-tenant phone lookup (router), service-role only

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- ROLLBACK PLAN (regression halinde hazır):
--   BEGIN;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_conversations; ALTER TABLE public.agent_conversations DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_learnings; ALTER TABLE public.agent_learnings DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_profiles; ALTER TABLE public.agent_profiles DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_proposals; ALTER TABLE public.agent_proposals DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_quotas; ALTER TABLE public.agent_quotas DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.agent_usage_events; ALTER TABLE public.agent_usage_events DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.ai_usage; ALTER TABLE public.ai_usage DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_campaigns; ALTER TABLE public.bayi_campaigns DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_categories; ALTER TABLE public.bayi_categories DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_collection_activities; ALTER TABLE public.bayi_collection_activities DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_companies; ALTER TABLE public.bayi_companies DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_credit_movements; ALTER TABLE public.bayi_credit_movements DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_credits; ALTER TABLE public.bayi_dealer_credits DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_invoices; ALTER TABLE public.bayi_dealer_invoices DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_orders; ALTER TABLE public.bayi_dealer_orders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_transactions; ALTER TABLE public.bayi_dealer_transactions DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_dealer_visits; ALTER TABLE public.bayi_dealer_visits DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_drip_campaigns; ALTER TABLE public.bayi_drip_campaigns DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_drip_enrollments; ALTER TABLE public.bayi_drip_enrollments DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_invite_links; ALTER TABLE public.bayi_invite_links DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_invoices; ALTER TABLE public.bayi_invoices DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_order_items; ALTER TABLE public.bayi_order_items DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_orders; ALTER TABLE public.bayi_orders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_payments; ALTER TABLE public.bayi_payments DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_products; ALTER TABLE public.bayi_products DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_purchase_orders; ALTER TABLE public.bayi_purchase_orders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_referral_codes; ALTER TABLE public.bayi_referral_codes DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_referrals; ALTER TABLE public.bayi_referrals DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_sales_targets; ALTER TABLE public.bayi_sales_targets DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.bayi_suppliers; ALTER TABLE public.bayi_suppliers DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.campaigns; ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.contracts; ALTER TABLE public.contracts DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_contact_actions; ALTER TABLE public.emlak_contact_actions DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_customers; ALTER TABLE public.emlak_customers DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_monitoring_criteria; ALTER TABLE public.emlak_monitoring_criteria DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_presentations; ALTER TABLE public.emlak_presentations DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_properties; ALTER TABLE public.emlak_properties DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_property_photos; ALTER TABLE public.emlak_property_photos DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.emlak_publishing_history; ALTER TABLE public.emlak_publishing_history DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_campaigns; ALTER TABLE public.mkt_campaigns DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_order_items; ALTER TABLE public.mkt_order_items DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_orders; ALTER TABLE public.mkt_orders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_products; ALTER TABLE public.mkt_products DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_sales; ALTER TABLE public.mkt_sales DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.mkt_suppliers; ALTER TABLE public.mkt_suppliers DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_appointments; ALTER TABLE public.muh_appointments DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_beyanname_statuses; ALTER TABLE public.muh_beyanname_statuses DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_invoices; ALTER TABLE public.muh_invoices DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_mukellefler; ALTER TABLE public.muh_mukellefler DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_payments; ALTER TABLE public.muh_payments DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_reminders; ALTER TABLE public.muh_reminders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.muh_tahsilat_reminders; ALTER TABLE public.muh_tahsilat_reminders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_guest_messages; ALTER TABLE public.otel_guest_messages DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_hotels; ALTER TABLE public.otel_hotels DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_rooms; ALTER TABLE public.otel_rooms DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.otel_user_hotels; ALTER TABLE public.otel_user_hotels DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.reminders; ALTER TABLE public.reminders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_inventory; ALTER TABLE public.rst_inventory DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_loyalty_members; ALTER TABLE public.rst_loyalty_members DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_loyalty_visits; ALTER TABLE public.rst_loyalty_visits DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_menu_items; ALTER TABLE public.rst_menu_items DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_order_items; ALTER TABLE public.rst_order_items DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_orders; ALTER TABLE public.rst_orders DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_reservations; ALTER TABLE public.rst_reservations DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.rst_tables; ALTER TABLE public.rst_tables DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.user_employee_progress; ALTER TABLE public.user_employee_progress DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.user_favorites; ALTER TABLE public.user_favorites DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "tenant_isolation" ON public.user_invitations; ALTER TABLE public.user_invitations DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "own_profile_select" ON public.profiles;
--     DROP POLICY IF EXISTS "own_profile_update" ON public.profiles;
--     ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
--     DROP POLICY IF EXISTS "own_onboarding" ON public.onboarding_state;
--     ALTER TABLE public.onboarding_state DISABLE ROW LEVEL SECURITY;
--   COMMIT;
-- ──────────────────────────────────────────────────────────────────────
