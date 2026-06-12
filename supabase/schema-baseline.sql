


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."sy_maintenance_category" AS ENUM (
    'elektrik',
    'su',
    'asansor',
    'mekanik',
    'diger'
);


ALTER TYPE "public"."sy_maintenance_category" OWNER TO "postgres";


CREATE TYPE "public"."sy_maintenance_priority" AS ENUM (
    'acil',
    'yuksek',
    'normal',
    'dusuk'
);


ALTER TYPE "public"."sy_maintenance_priority" OWNER TO "postgres";


CREATE TYPE "public"."sy_maintenance_status" AS ENUM (
    'acik',
    'atandi',
    'tamamlandi'
);


ALTER TYPE "public"."sy_maintenance_status" OWNER TO "postgres";


CREATE TYPE "public"."sy_resident_type" AS ENUM (
    'owner',
    'tenant'
);


ALTER TYPE "public"."sy_resident_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bayi_apply_stock_change"("p_tenant" "uuid", "p_warehouse" "uuid", "p_product" "uuid", "p_delta" numeric, "p_movement_type" "text", "p_reason" "text" DEFAULT NULL::"text", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_unit_cost" numeric DEFAULT NULL::numeric, "p_supplier_name" "text" DEFAULT NULL::"text", "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("warehouse_qty" numeric, "product_total" numeric, "product_name" "text", "min_threshold" numeric, "max_threshold" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_wh_qty NUMERIC;
  v_total  NUMERIC;
  v_name   TEXT;
  v_min    NUMERIC;
  v_max    NUMERIC;
BEGIN
  -- 1) Atomik upsert — DB-level increment (race-safe)
  INSERT INTO public.bayi_warehouse_stock (tenant_id, warehouse_id, product_id, quantity)
  VALUES (p_tenant, p_warehouse, p_product, GREATEST(0, p_delta))
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET
    quantity   = GREATEST(0, public.bayi_warehouse_stock.quantity + p_delta),
    updated_at = NOW()
  RETURNING quantity INTO v_wh_qty;

  -- 2) Hareket/audit kaydı
  INSERT INTO public.bayi_stock_movements
    (tenant_id, warehouse_id, product_id, movement_type, quantity, reason,
     reference_type, reference_id, unit_cost, supplier_name, created_by)
  VALUES
    (p_tenant, p_warehouse, p_product, p_movement_type, ABS(p_delta), p_reason,
     p_reference_type, p_reference_id, p_unit_cost, p_supplier_name, p_created_by);

  -- 3) Ürün toplamı = tüm depolardaki kantite (denormalize cache)
  SELECT COALESCE(SUM(quantity), 0) INTO v_total
  FROM public.bayi_warehouse_stock
  WHERE tenant_id = p_tenant AND product_id = p_product;

  UPDATE public.bayi_products
  SET stock_quantity = v_total, updated_at = NOW()
  WHERE tenant_id = p_tenant AND id = p_product
  RETURNING name, low_stock_threshold, max_stock_threshold
  INTO v_name, v_min, v_max;

  RETURN QUERY SELECT v_wh_qty, v_total, v_name, v_min, v_max;
END;
$$;


ALTER FUNCTION "public"."bayi_apply_stock_change"("p_tenant" "uuid", "p_warehouse" "uuid", "p_product" "uuid", "p_delta" numeric, "p_movement_type" "text", "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_unit_cost" numeric, "p_supplier_name" "text", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bayi_consume_order_reservations"("p_order_id" "uuid", "p_changed_by_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_consumed INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, product_id, tenant_id, quantity
      FROM public.bayi_stock_reservations
     WHERE order_id = p_order_id AND status = 'active'
     FOR UPDATE
  LOOP
    UPDATE public.bayi_products
       SET stock_quantity = stock_quantity - r.quantity,
           updated_at = NOW()
     WHERE id = r.product_id;

    INSERT INTO public.bayi_stock_movements
      (tenant_id, product_id, movement_type, quantity, reason, reference_id, reference_type, created_by)
    VALUES
      (r.tenant_id, r.product_id, 'out', r.quantity, 'order_confirmed', p_order_id, 'bayi_dealer_orders', p_changed_by_user_id);

    UPDATE public.bayi_stock_reservations
       SET status = 'consumed',
           consumed_at = NOW()
     WHERE id = r.id;

    v_consumed := v_consumed + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'consumed_count', v_consumed);
END;
$$;


ALTER FUNCTION "public"."bayi_consume_order_reservations"("p_order_id" "uuid", "p_changed_by_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bayi_create_dealer_order_v2"("p_tenant_id" "uuid", "p_dealer_user_id" "uuid", "p_items" "jsonb", "p_notes" "text", "p_total" numeric, "p_reservation_ttl_minutes" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order_id UUID := gen_random_uuid();
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_product_name TEXT;
  v_stock INTEGER;
  v_reserved INTEGER;
  v_available INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_reservation_ttl_minutes > 0 THEN
    v_expires_at := NOW() + (p_reservation_ttl_minutes || ' minutes')::INTERVAL;
  END IF;

  -- Faz 1: TÜM ürünleri kilitle + stok kontrol et. Herhangi biri
  -- yetersizse, hiç bir şey yazmadan hata dön (function-scope rollback).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_product_name := v_item->>'product_name';

    IF v_product_id IS NOT NULL THEN
      SELECT stock_quantity INTO v_stock
        FROM public.bayi_products
       WHERE id = v_product_id AND tenant_id = p_tenant_id
       FOR UPDATE;

      IF v_stock IS NULL THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'product_not_found',
          'product_id', v_product_id,
          'product_name', v_product_name
        );
      END IF;

      SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
        FROM public.bayi_stock_reservations
       WHERE product_id = v_product_id AND status = 'active';

      v_available := v_stock - v_reserved;
      IF v_available < v_qty THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'insufficient_stock',
          'product_id', v_product_id,
          'product_name', v_product_name,
          'available', v_available,
          'requested', v_qty,
          'stock_quantity', v_stock,
          'reserved_total', v_reserved
        );
      END IF;
    END IF;
  END LOOP;

  -- Faz 2: order + items + reservations atomik yazılır.
  INSERT INTO public.bayi_dealer_orders (id, tenant_id, dealer_user_id, status, total_amount, notes)
    VALUES (v_order_id, p_tenant_id, p_dealer_user_id, 'pending', p_total, p_notes);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := (v_item->>'line_total')::NUMERIC;
    v_product_name := v_item->>'product_name';

    INSERT INTO public.bayi_dealer_order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (v_order_id, v_product_id, v_product_name, v_unit_price, v_qty, v_line_total);

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.bayi_stock_reservations
        (tenant_id, product_id, order_id, quantity, status, created_by_user_id, expires_at)
      VALUES
        (p_tenant_id, v_product_id, v_order_id, v_qty, 'active', p_dealer_user_id, v_expires_at);
    END IF;
  END LOOP;

  INSERT INTO public.bayi_dealer_order_status_history (order_id, old_status, new_status, changed_by_user_id)
    VALUES (v_order_id, NULL, 'pending', p_dealer_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'total', p_total
  );
END;
$$;


ALTER FUNCTION "public"."bayi_create_dealer_order_v2"("p_tenant_id" "uuid", "p_dealer_user_id" "uuid", "p_items" "jsonb", "p_notes" "text", "p_total" numeric, "p_reservation_ttl_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bayi_release_order_reservations"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_released INTEGER;
BEGIN
  UPDATE public.bayi_stock_reservations
     SET status = 'released',
         released_at = NOW()
   WHERE order_id = p_order_id AND status = 'active';

  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'released_count', v_released);
END;
$$;


ALTER FUNCTION "public"."bayi_release_order_reservations"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mkt_top_selling_products"("p_tenant_id" "uuid", "p_days" integer DEFAULT 7, "p_limit" integer DEFAULT 10) RETURNS TABLE("product_name" "text", "total_quantity" numeric, "total_revenue" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$ SELECT product_name, SUM(quantity) AS total_quantity, SUM(total_amount) AS total_revenue FROM mkt_sales WHERE tenant_id = p_tenant_id AND sold_at >= NOW() - (p_days || ' days')::INTERVAL GROUP BY product_name ORDER BY total_quantity DESC LIMIT p_limit; $$;


ALTER FUNCTION "public"."mkt_top_selling_products"("p_tenant_id" "uuid", "p_days" integer, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_agent_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN INSERT INTO agent_events (tenant_id, user_id, event_type, source_table, source_id, payload) VALUES (COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'), NEW.user_id, TG_OP, TG_TABLE_NAME, NEW.id::text, row_to_json(NEW)::jsonb); RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_agent_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otel_user_can_see_hotel"("target_hotel_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND '*' = ANY(p.capabilities)
        AND EXISTS (SELECT 1 FROM otel_user_hotels ouh WHERE ouh.user_id = p.id AND ouh.hotel_id = target_hotel_id)
    )
    OR EXISTS (
      SELECT 1 FROM hotel_employees he
      WHERE he.profile_id = auth.uid() AND he.hotel_id = target_hotel_id
    );
$$;


ALTER FUNCTION "public"."otel_user_can_see_hotel"("target_hotel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_set_is_platform_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.is_platform_admin := (NEW.role = 'admin' AND NEW.tenant_id IS NULL);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."profiles_set_is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sy_is_admin_of_building"("p_building_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN public.sy_buildings b ON b.manager_id = p.id
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role IN ('yonetici','admin','employee')
      AND (b.id = p_building_id OR p_building_id = ANY (public.sy_user_building_ids(auth.uid())))
  );
$$;


ALTER FUNCTION "public"."sy_is_admin_of_building"("p_building_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sy_is_denetci_of_building"("p_building_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'denetci'
      AND p_building_id = ANY (public.sy_user_building_ids(auth.uid()))
  );
$$;


ALTER FUNCTION "public"."sy_is_denetci_of_building"("p_building_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sy_is_muhasebeci_of_building"("p_building_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'muhasebeci_site'
      AND p_building_id = ANY (public.sy_user_building_ids(auth.uid()))
  );
$$;


ALTER FUNCTION "public"."sy_is_muhasebeci_of_building"("p_building_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sy_is_sakin_of_building"("p_building_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.auth_user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'sakin'
      AND p_building_id = ANY (public.sy_user_building_ids(auth.uid()))
  );
$$;


ALTER FUNCTION "public"."sy_is_sakin_of_building"("p_building_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sy_user_building_ids"("p_user_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(array_agg(DISTINCT building_id), ARRAY[]::uuid[])
  FROM public.sy_user_residents
  WHERE user_id = p_user_id;
$$;


ALTER FUNCTION "public"."sy_user_building_ids"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sy_user_building_ids"("p_user_id" "uuid") IS 'Kullanıcının sy_user_residents bridge tablosunda eşleştirildiği bina ID listesi. RLS policy'' lerinde sakin/yönetici scope''u belirlemek için.';



CREATE OR REPLACE FUNCTION "public"."sy_user_role"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.auth_user_id = p_user_id
     OR p.id = p_user_id
  ORDER BY (CASE WHEN p.role IN ('yonetici','denetci','muhasebeci_site','sakin') THEN 0 ELSE 1 END)
  LIMIT 1;
$$;


ALTER FUNCTION "public"."sy_user_role"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sy_user_role"("p_user_id" "uuid") IS 'auth.uid()''den siteyonetim profili role''unu döner. Aynı auth_user_id''ye sahip multi-tenant profillerden site-rolü önceliklenir (sakin/yonetici/denetci/muhasebeci_site).';



CREATE OR REPLACE FUNCTION "public"."sy_user_unit_ids"("p_user_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(array_agg(DISTINCT r.unit_id), ARRAY[]::uuid[])
  FROM public.sy_user_residents ur
  JOIN public.sy_residents r ON r.id = ur.resident_id
  WHERE ur.user_id = p_user_id;
$$;


ALTER FUNCTION "public"."sy_user_unit_ids"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sy_user_unit_ids"("p_user_id" "uuid") IS 'Kullanıcının sy_user_residents üzerinden eşleştirildiği daire (sy_units) ID listesi. Sakin RLS policy''lerinde kullanılır.';



CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_rst_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_rst_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_test_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "virtual_phone" "text" NOT NULL,
    "display_name" "text",
    "target_tenant" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_otp_code" "text",
    "last_otp_at" timestamp with time zone,
    CONSTRAINT "admin_test_identities_virtual_phone_check" CHECK (("virtual_phone" ~ '^[0-9]+$'::"text"))
);


ALTER TABLE "public"."admin_test_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_key" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "setup_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "tool_use_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_conversations_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'tool'::"text"])))
);


ALTER TABLE "public"."agent_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "source_table" "text",
    "source_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_learnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_key" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "learning" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "confidence" real DEFAULT 0.5,
    "source_task_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_learnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_key" "text" NOT NULL,
    "task_id" "uuid",
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_messages_role_check" CHECK (("role" = ANY (ARRAY['system'::"text", 'assistant'::"text", 'user'::"text", 'tool_result'::"text"])))
);


ALTER TABLE "public"."agent_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_plans" (
    "key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "monthly_message_limit" integer NOT NULL,
    "monthly_price_eur" numeric(8,2),
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_profiles" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "display_name" "text",
    "custom_prompt" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "last_active" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_key" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "agent_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."agent_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_quotas" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_key" "text" DEFAULT 'free'::"text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "used_messages" integer DEFAULT 0 NOT NULL,
    "used_input_tokens" bigint DEFAULT 0 NOT NULL,
    "used_output_tokens" bigint DEFAULT 0 NOT NULL,
    "cache_read_tokens" bigint DEFAULT 0 NOT NULL,
    "estimated_cost_usd" numeric(10,4) DEFAULT 0 NOT NULL,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_quotas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_key" "text" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "trigger_event" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "current_step" integer DEFAULT 0,
    "max_steps" integer DEFAULT 10,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "plan" "jsonb" DEFAULT '[]'::"jsonb",
    "execution_log" "jsonb" DEFAULT '[]'::"jsonb",
    "pending_proposal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "error" "text",
    CONSTRAINT "agent_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'thinking'::"text", 'acting'::"text", 'waiting_human'::"text", 'done'::"text", 'failed'::"text"]))),
    CONSTRAINT "agent_tasks_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['cron'::"text", 'webhook'::"text", 'whatsapp'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."agent_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "input_tokens" integer NOT NULL,
    "output_tokens" integer NOT NULL,
    "cache_read_tokens" integer DEFAULT 0,
    "cache_write_tokens" integer DEFAULT 0,
    "tool_calls" "text"[],
    "model" "text" NOT NULL,
    "cost_usd" numeric(10,6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_usage_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_websites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "photo_url" "text",
    "slogan" "text",
    "bio" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "theme" "text" DEFAULT 'blue'::"text",
    "experience_years" integer,
    "total_sales" integer,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_websites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "agent_type" "text",
    "model" "text",
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "target_table" "text",
    "target_id" "uuid",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "notes" "text",
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "confirmed_at" timestamp with time zone,
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "shipment_status" "text",
    "tracking_number" "text",
    "driver_name" "text",
    "vehicle_plate" "text",
    "delivered_photo_url" "text",
    CONSTRAINT "bayi_dealer_orders_shipment_status_check" CHECK (("shipment_status" = ANY (ARRAY['hazirlandi'::"text", 'yola_cikti'::"text", 'teslim_edildi'::"text", 'iade'::"text"]))),
    CONSTRAINT "bayi_dealer_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'preparing'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."bayi_dealer_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "invoice_no" "text" NOT NULL,
    "issue_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "pdf_url" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "external_ref" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bayi_invoices_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "bayi_invoices_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."bayi_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "payment_date" "date" NOT NULL,
    "dekont_url" "text",
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by_user_id" "uuid",
    "approved_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "provider" "text",
    "provider_payment_id" "text",
    "checkout_url" "text",
    "paid_at" timestamp with time zone,
    "order_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "bayi_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "bayi_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."bayi_payments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bayi_account_statement" AS
 SELECT 'order'::"text" AS "entry_type",
    "o"."id" AS "reference_id",
    "o"."dealer_user_id",
    "o"."tenant_id",
    "o"."created_at" AS "entry_date",
    "o"."total_amount" AS "debit",
    (0)::numeric AS "credit",
    ('Sipariş #'::"text" || "substring"(("o"."id")::"text", 1, 8)) AS "description"
   FROM "public"."bayi_dealer_orders" "o"
  WHERE ("o"."status" <> ALL (ARRAY['cancelled'::"text", 'rejected'::"text"]))
UNION ALL
 SELECT 'invoice'::"text" AS "entry_type",
    "i"."id" AS "reference_id",
    "i"."dealer_user_id",
    "i"."tenant_id",
    ("i"."issue_date")::timestamp with time zone AS "entry_date",
    "i"."amount" AS "debit",
    (0)::numeric AS "credit",
    ('Fatura '::"text" || "i"."invoice_no") AS "description"
   FROM "public"."bayi_invoices" "i"
  WHERE ("i"."status" <> 'cancelled'::"text")
UNION ALL
 SELECT 'payment'::"text" AS "entry_type",
    "p"."id" AS "reference_id",
    "p"."dealer_user_id",
    "p"."tenant_id",
    ("p"."payment_date")::timestamp with time zone AS "entry_date",
    (0)::numeric AS "debit",
    "p"."amount" AS "credit",
    ('Tahsilat '::"text" || COALESCE("p"."notes", ("p"."payment_date")::"text")) AS "description"
   FROM "public"."bayi_payments" "p"
  WHERE ("p"."status" = 'approved'::"text");


ALTER VIEW "public"."bayi_account_statement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_campaign_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trigger_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid",
    "target_user_id" "uuid",
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" NOT NULL,
    "payload_snapshot" "jsonb",
    "error" "text"
);


ALTER TABLE "public"."bayi_campaign_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_campaign_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "rule_type" "text" NOT NULL,
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_campaign_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_campaign_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_campaign_targets_target_type_check" CHECK (("target_type" = ANY (ARRAY['all'::"text", 'segment'::"text", 'region'::"text", 'dealer'::"text"])))
);


ALTER TABLE "public"."bayi_campaign_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_campaign_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "event_type" "text" NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cooldown_days" integer DEFAULT 30 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_campaign_triggers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "max_usage" integer,
    "per_dealer_max_usage" integer,
    "coupon_code" "text",
    "created_by_profile_id" "uuid",
    CONSTRAINT "bayi_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'ended'::"text"]))),
    CONSTRAINT "bayi_campaigns_type_check" CHECK ((("type" IS NULL) OR ("type" = ANY (ARRAY['percent_discount'::"text", 'volume_discount'::"text", 'coupon'::"text", 'gift_product'::"text", 'free_shipping'::"text"]))))
);


ALTER TABLE "public"."bayi_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cart_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_cart_items_quantity_check" CHECK (("quantity" >= 1))
);


ALTER TABLE "public"."bayi_cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "coupon_code" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_carts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'checked_out'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."bayi_carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "dealer_id" "uuid" NOT NULL,
    "transaction_type_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "reference_number" "text",
    "order_id" "uuid",
    "description" "text" NOT NULL,
    "notes" "text",
    "transaction_date" "date" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_dealer_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "company_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "contact_name" "text",
    "city" "text",
    "district" "text",
    "tax_no" "text",
    "founded_year" "text",
    "product_group" "text",
    "balance" numeric DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "name" "text",
    "address_line" "text",
    "tax_number" "text",
    "tax_office" "text",
    "iban" "text",
    "credit_limit" numeric(14,2),
    "payment_term_days" integer,
    "discount_rate" numeric(5,2),
    "risk_status" "text" DEFAULT 'clean'::"text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "segment" "text",
    "region" "text",
    CONSTRAINT "bayi_dealers_segment_check" CHECK (("segment" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text"])))
);


ALTER TABLE "public"."bayi_dealers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "order_number" "text" NOT NULL,
    "dealer_id" "uuid",
    "status_id" "uuid",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "discount_amount" numeric DEFAULT 0,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "vehicle_plate" "text",
    "driver_name" "text",
    "driver_phone" "text",
    "cargo_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "reject_reason" "text",
    "approved_by_profile_id" "uuid",
    "coupon_code" "text",
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "invoice_id" "uuid",
    "shipment_carrier" "text",
    "shipment_tracking_no" "text",
    "shipment_status" "text",
    "shipped_at" timestamp with time zone,
    "visit_id" "uuid",
    CONSTRAINT "bayi_orders_payment_status_check" CHECK ((("payment_status" IS NULL) OR ("payment_status" = ANY (ARRAY['unpaid'::"text", 'pending'::"text", 'paid'::"text", 'refunded'::"text", 'failed'::"text"])))),
    CONSTRAINT "bayi_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'preparing'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."bayi_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bayi_churn_signals" AS
 WITH "last_orders" AS (
         SELECT "o"."dealer_id",
            "o"."tenant_id",
            "max"("o"."created_at") AS "last_order_at",
            "count"(*) FILTER (WHERE ("o"."created_at" > ("now"() - '30 days'::interval))) AS "orders_last_30d",
            "count"(*) FILTER (WHERE (("o"."created_at" >= ("now"() - '60 days'::interval)) AND ("o"."created_at" <= ("now"() - '30 days'::interval)))) AS "orders_prev_30d",
            "count"(*) FILTER (WHERE ("o"."created_at" > ("now"() - '90 days'::interval))) AS "orders_last_90d"
           FROM "public"."bayi_orders" "o"
          GROUP BY "o"."dealer_id", "o"."tenant_id"
        ), "overdue" AS (
         SELECT "t"."dealer_id",
            "max"(GREATEST(0, (EXTRACT(day FROM ("now"() - ("t"."due_date")::timestamp with time zone)))::integer)) AS "max_overdue_days"
           FROM "public"."bayi_dealer_transactions" "t"
          WHERE (("t"."due_date" IS NOT NULL) AND ("t"."due_date" < "now"()))
          GROUP BY "t"."dealer_id"
        )
 SELECT "d"."id" AS "dealer_id",
    "d"."tenant_id",
    "d"."name" AS "dealer_name",
    "d"."company_name",
    COALESCE("d"."balance", (0)::numeric) AS "balance",
    "lo"."last_order_at",
    (EXTRACT(day FROM ("now"() - COALESCE("lo"."last_order_at", "d"."created_at"))))::integer AS "days_since_last_order",
    COALESCE("lo"."orders_last_30d", (0)::bigint) AS "orders_last_30d",
    COALESCE("lo"."orders_prev_30d", (0)::bigint) AS "orders_prev_30d",
    COALESCE("lo"."orders_last_90d", (0)::bigint) AS "orders_last_90d",
    COALESCE("ov"."max_overdue_days", 0) AS "max_overdue_days",
        CASE
            WHEN ((COALESCE("ov"."max_overdue_days", 0) >= 30) OR ((EXTRACT(day FROM ("now"() - COALESCE("lo"."last_order_at", "d"."created_at"))))::integer >= 60)) THEN 'risk'::"text"
            WHEN ((COALESCE("ov"."max_overdue_days", 0) >= 7) OR ((EXTRACT(day FROM ("now"() - COALESCE("lo"."last_order_at", "d"."created_at"))))::integer >= 30) OR ((COALESCE("lo"."orders_prev_30d", (0)::bigint) > 0) AND ((COALESCE("lo"."orders_last_30d", (0)::bigint))::numeric < ((COALESCE("lo"."orders_prev_30d", (0)::bigint))::numeric / 2.0)))) THEN 'watch'::"text"
            ELSE 'ok'::"text"
        END AS "risk_level"
   FROM (("public"."bayi_dealers" "d"
     LEFT JOIN "last_orders" "lo" ON (("lo"."dealer_id" = "d"."id")))
     LEFT JOIN "overdue" "ov" ON (("ov"."dealer_id" = "d"."id")))
  WHERE ("d"."is_active" IS NOT FALSE);


ALTER VIEW "public"."bayi_churn_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_collection_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "dealer_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "notes" "text",
    "amount_expected" numeric,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_collection_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_credit_limit_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "changed_by_user_id" "uuid",
    "old_limit" numeric(14,2),
    "new_limit" numeric(14,2),
    "reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_credit_limit_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_credit_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "delta" numeric(12,2) NOT NULL,
    "source" "text" NOT NULL,
    "reference_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "bayi_credit_movements_source_check" CHECK (("source" = ANY (ARRAY['referral_earn'::"text", 'order_apply'::"text", 'manual_adjust'::"text", 'expire'::"text"])))
);


ALTER TABLE "public"."bayi_credit_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_cross_sell_pairs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_a_id" "uuid" NOT NULL,
    "product_b_id" "uuid" NOT NULL,
    "co_occurrence_count" integer DEFAULT 0 NOT NULL,
    "dealer_count" integer DEFAULT 0 NOT NULL,
    "score" numeric(6,3) DEFAULT 0 NOT NULL,
    "last_computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_cross_sell_pairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_credits" (
    "dealer_user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "lifetime_earned" numeric(12,2) DEFAULT 0 NOT NULL,
    "lifetime_used" numeric(12,2) DEFAULT 0 NOT NULL,
    "last_movement_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_dealer_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "invoice_date" "date" NOT NULL,
    "total_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_dealer_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(12,2) NOT NULL,
    CONSTRAINT "bayi_dealer_order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."bayi_dealer_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by_user_id" "uuid",
    "reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_dealer_order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_price_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "price_list_id" "uuid" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_dealer_price_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "score_total" numeric(5,2) NOT NULL,
    "sub_volume" numeric(5,2) NOT NULL,
    "sub_regularity" numeric(5,2) NOT NULL,
    "sub_collection" numeric(5,2) NOT NULL,
    "sub_trend" numeric(5,2) NOT NULL,
    "signals" "jsonb" DEFAULT '{}'::"jsonb",
    "snapshot_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_dealer_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_dealer_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "dealer_id" "uuid" NOT NULL,
    "planned_date" "date" NOT NULL,
    "actual_date" "date",
    "visit_type" "text" DEFAULT 'Ziyaret'::"text" NOT NULL,
    "outcome" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_dealer_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_drip_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "audience" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "enrollment_mode" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "bayi_drip_campaigns_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'both'::"text"]))),
    CONSTRAINT "bayi_drip_campaigns_enrollment_mode_check" CHECK (("enrollment_mode" = ANY (ARRAY['manual'::"text", 'auto'::"text", 'one_time'::"text"])))
);


ALTER TABLE "public"."bayi_drip_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_drip_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_step" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "next_send_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "bayi_drip_enrollments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'paused'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."bayi_drip_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_drip_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "step_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "error_message" "text",
    "payload" "jsonb",
    CONSTRAINT "bayi_drip_sends_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."bayi_drip_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_drip_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "step_order" integer NOT NULL,
    "delay_days" integer DEFAULT 0 NOT NULL,
    "channel" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "send_condition" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_drip_steps_delay_days_check" CHECK (("delay_days" >= 0))
);


ALTER TABLE "public"."bayi_drip_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_invite_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "created_by" "uuid",
    "code" "text" NOT NULL,
    "role" "text" DEFAULT 'dealer'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "max_uses" integer,
    "used_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_invite_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "vitrine_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text",
    "customer_email" "text",
    "customer_message" "text",
    "items" "jsonb",
    "est_total" numeric(12,2),
    "currency" "text" DEFAULT 'TRY'::"text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "source" "text" DEFAULT 'vitrine'::"text",
    "converted_order_id" "uuid",
    "ip_hash" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contacted_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "bayi_leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'converted'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."bayi_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "order_id" "uuid",
    "product_id" "uuid",
    "product_code" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "total_price" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "line_discount" numeric(14,2) DEFAULT 0,
    "campaign_id" "uuid"
);


ALTER TABLE "public"."bayi_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by_profile_id" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_order_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_order_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_price_list_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "price_list_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "unit_price" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_price_list_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_price_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "valid_from" "date",
    "valid_until" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_user_id" "uuid"
);


ALTER TABLE "public"."bayi_price_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_price_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "price_list_item_id" "uuid" NOT NULL,
    "min_quantity" integer NOT NULL,
    "discount_percent" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_price_tiers_discount_percent_check" CHECK ((("discount_percent" >= (0)::numeric) AND ("discount_percent" <= (100)::numeric))),
    CONSTRAINT "bayi_price_tiers_min_quantity_check" CHECK (("min_quantity" >= 1))
);


ALTER TABLE "public"."bayi_price_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_product_visibility" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "visible" boolean DEFAULT true NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by_user_id" "uuid"
);


ALTER TABLE "public"."bayi_product_visibility" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "base_price" numeric DEFAULT 0 NOT NULL,
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 10,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "category_id" "uuid",
    "sku" "text",
    "unit" "text" DEFAULT 'adet'::"text",
    "unit_price" numeric,
    "min_order" integer DEFAULT 1,
    "barcode" "text",
    "specs" "jsonb" DEFAULT '{}'::"jsonb",
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "weight" numeric,
    "brand" "text",
    "category" "text",
    "max_stock_threshold" numeric(12,3)
);


ALTER TABLE "public"."bayi_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_purchase_order_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "po_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "received_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "unit_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_purchase_order_lines_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."bayi_purchase_order_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "supplier_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_amount" numeric DEFAULT 0,
    "notes" "text",
    "ordered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "po_number" "text",
    "expected_date" "date",
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "sent_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_referral_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "max_uses" integer,
    "current_uses" integer DEFAULT 0 NOT NULL,
    "reward_amount" numeric(12,2) DEFAULT 100.00 NOT NULL,
    "reward_currency" "text" DEFAULT 'TRY'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."bayi_referral_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "referrer_dealer_id" "uuid" NOT NULL,
    "referred_dealer_id" "uuid",
    "referred_phone" "text",
    "referred_name" "text",
    "code_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reward_amount" numeric(12,2),
    "reward_currency" "text" DEFAULT 'TRY'::"text",
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "earned_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "first_order_id" "uuid",
    "notes" "text",
    CONSTRAINT "bayi_referrals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'earned'::"text", 'expired'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."bayi_referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_sales_rep_dealers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sales_rep_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_sales_rep_dealers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_sales_reps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "region" "text",
    "user_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_sales_reps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_sales_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "dealer_id" "uuid" NOT NULL,
    "target_amount" numeric NOT NULL,
    "achieved_amount" numeric DEFAULT 0 NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_sales_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "reason" "text",
    "reference_id" "uuid",
    "reference_type" "text",
    "unit_cost" numeric(12,2),
    "supplier_name" "text",
    "expected_arrival" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "warehouse_id" "uuid",
    CONSTRAINT "bayi_stock_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['in'::"text", 'out'::"text", 'adjust'::"text", 'supplier_order'::"text"])))
);


ALTER TABLE "public"."bayi_stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_stock_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "quantity" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "reserved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "consumed_at" timestamp with time zone,
    "released_at" timestamp with time zone,
    "created_by_user_id" "uuid",
    CONSTRAINT "bayi_stock_reservations_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "bayi_stock_reservations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'consumed'::"text", 'released'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."bayi_stock_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_stock_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "from_warehouse_id" "uuid" NOT NULL,
    "to_warehouse_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_stock_transfers_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."bayi_stock_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_stocktake_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "expected_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "counted_qty" numeric(12,3),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_stocktake_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_stocktake_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "category_id" "uuid",
    "brand" "text",
    "note" "text",
    "started_by" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone
);


ALTER TABLE "public"."bayi_stocktake_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_supplier_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "po_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "method" "text",
    "note" "text",
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bayi_supplier_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."bayi_supplier_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tax_no" "text",
    "address" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "payment_term_days" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_transaction_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "balance_effect" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bayi_transaction_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_visit_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "visit_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_visit_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_visit_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sales_rep_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "planned_date" "date" NOT NULL,
    "planned_time" "text",
    "note" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_visit_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sales_rep_id" "uuid" NOT NULL,
    "dealer_id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "check_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "check_out_at" timestamp with time zone,
    "gps_lat" numeric(9,6),
    "gps_lng" numeric(9,6),
    "photo_url" "text",
    "note" "text",
    "client_uuid" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_vitrines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "dealer_user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text",
    "subtitle" "text",
    "logo_url" "text",
    "accent_color" "text" DEFAULT '#4f46e5'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "show_prices" boolean DEFAULT true NOT NULL,
    "visible_product_ids" "jsonb",
    "theme" "jsonb" DEFAULT '{}'::"jsonb",
    "view_count" integer DEFAULT 0 NOT NULL,
    "lead_count" integer DEFAULT 0 NOT NULL,
    "conversion_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_vitrines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_warehouse_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" numeric(12,3) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_warehouse_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bayi_warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "manager_user_id" "uuid",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bayi_warehouses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bot_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "bot_type" "text",
    "action" "text",
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bot_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "title" "text",
    "description" "text",
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "start_date" "date",
    "end_date" "date",
    "conditions" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."command_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid",
    "command" "text" NOT NULL,
    "current_step" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."command_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "property_id" "uuid",
    "type" "text" DEFAULT 'yetkilendirme'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "sign_token" "text",
    "contract_data" "jsonb" DEFAULT '{}'::"jsonb",
    "pdf_url" "text",
    "owner_signature_url" "text",
    "signed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dealer_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "distributor_tenant_id" "uuid" NOT NULL,
    "distributor_user_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "name" "text" NOT NULL,
    "store_name" "text" NOT NULL,
    "store_address" "text",
    "tax_no" "text",
    "note" "text",
    "invite_code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dealer_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."distributor_slugs" (
    "slug" "text" NOT NULL,
    "distributor_user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_slug" "text" NOT NULL
);


ALTER TABLE "public"."distributor_slugs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message_template" "text",
    "related_customer_id" "uuid",
    "related_property_id" "uuid",
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_calendar_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."emlak_calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_contact_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."emlak_contact_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_customer_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_type" "text" NOT NULL,
    "note" "text",
    "result" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."emlak_customer_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "listing_type" "text",
    "property_type" "text"[],
    "rooms" "text",
    "budget_min" numeric,
    "budget_max" numeric,
    "location" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pipeline_stage" "text" DEFAULT 'yeni'::"text",
    "last_contact_date" timestamp with time zone,
    "next_followup_date" timestamp with time zone,
    "contact_count" integer DEFAULT 0,
    "looking_for" "text"[],
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."emlak_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_daily_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "listing_type" "text" NOT NULL,
    "price" bigint,
    "area" integer,
    "rooms" "text",
    "location_city" "text",
    "location_district" "text",
    "location_neighborhood" "text",
    "listing_date" "date",
    "image_url" "text",
    "owner_name" "text",
    "owner_phone" "text",
    "owner_enriched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."emlak_daily_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_lead_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "note" "text",
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."emlak_lead_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_monitoring_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "criteria" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."emlak_monitoring_criteria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_presentations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "property_ids" "uuid"[] NOT NULL,
    "title" "text",
    "magic_token" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_summary" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "viewed_at" timestamp with time zone,
    "view_count" integer DEFAULT 0,
    "feedback_score" integer,
    "feedback_text" "text",
    "follow_up_status" "text",
    "follow_up_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."emlak_presentations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "title" "text",
    "description" "text",
    "ai_description" "text",
    "type" "text",
    "listing_type" "text",
    "price" numeric,
    "area" numeric,
    "net_area" numeric,
    "rooms" "text",
    "floor" "text",
    "total_floors" "text",
    "building_age" "text",
    "location_city" "text",
    "location_district" "text",
    "location_neighborhood" "text",
    "heating" "text",
    "parking" "text",
    "elevator" boolean,
    "balcony" boolean,
    "bathroom_count" "text",
    "kitchen_type" "text",
    "housing_type" "text",
    "facade" "text",
    "features" "text"[],
    "interior_features" "text"[],
    "exterior_features" "text"[],
    "neighborhood_features" "text"[],
    "view_features" "text"[],
    "disability_features" "text"[],
    "transportation" "text"[],
    "deed_type" "text",
    "usage_status" "text",
    "swap" boolean,
    "image_url" "text",
    "status" "text" DEFAULT 'aktif'::"text",
    "source_url" "text",
    "source_portal" "text",
    "source_id" "text",
    "listing_date" "text",
    "listing_updated_date" "text",
    "shared_in_network" boolean DEFAULT false,
    "network_commission_note" "text",
    "sales_advice" "text",
    "ai_description_drafts" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "listed_by" "text",
    "owner_phone" "text",
    "owner_name" "text",
    "owner_enriched_at" timestamp with time zone
);


ALTER TABLE "public"."emlak_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_property_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "property_id" "uuid",
    "url" "text" NOT NULL,
    "storage_path" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."emlak_property_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_publishing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "property_id" "uuid",
    "portal" "text",
    "status" "text",
    "external_url" "text",
    "published_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."emlak_publishing_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emlak_tracking_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "neighborhoods" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "property_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "listing_type" "text",
    "price_min" bigint,
    "price_max" bigint,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" DEFAULT 'İlk takibim'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "chk_tracking_status" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."emlak_tracking_criteria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."extension_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."extension_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hotel_employees" (
    "hotel_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "capabilities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "position" "text",
    "shift_hours" "text",
    "assigned_floors" integer[] DEFAULT '{}'::integer[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hotel_employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "invited_by" "uuid",
    "expires_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invite_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "role" "text" DEFAULT 'admin'::"text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "max_uses" integer,
    "used_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invite_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."magic_link_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "purpose" "text"
);


ALTER TABLE "public"."magic_link_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mkt_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "discount_percent" numeric(5,2) NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mkt_campaigns_discount_percent_check" CHECK ((("discount_percent" > (0)::numeric) AND ("discount_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."mkt_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mkt_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unit_price" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mkt_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mkt_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mkt_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."mkt_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mkt_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "quantity" numeric(10,2) DEFAULT 0 NOT NULL,
    "unit" "text" DEFAULT 'adet'::"text" NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "low_stock_threshold" numeric(10,2),
    "expiry_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mkt_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mkt_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_amount" numeric(10,2) GENERATED ALWAYS AS (("quantity" * "unit_price")) STORED,
    "sold_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mkt_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mkt_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mkt_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time" "text",
    "subject" "text",
    "notes" "text",
    "mukellef_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_beyanname_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "beyanname_type" "text" NOT NULL,
    "period" "text",
    "status" "text" DEFAULT 'bekliyor'::"text",
    "deadline_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_beyanname_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "vendor_name" "text",
    "receiver_name" "text",
    "invoice_no" "text",
    "invoice_date" "date",
    "due_date" "date",
    "amount" numeric(15,2),
    "vkn" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_mukellefler" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "vkn" "text",
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_mukellefler" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "mukellef_name" "text",
    "amount" numeric(15,2) NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE,
    "method" "text" DEFAULT 'nakit'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'genel'::"text",
    "message" "text",
    "deadline_date" "date",
    "status" "text" DEFAULT 'aktif'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_tahsilat_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "reminder_type" "text" DEFAULT 'manual'::"text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "email_sent" boolean DEFAULT false
);


ALTER TABLE "public"."muh_tahsilat_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."muh_tax_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "category" "text" NOT NULL,
    "name" "text" NOT NULL,
    "rate" numeric(6,2) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."muh_tax_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "channel" "text" DEFAULT 'wa'::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "payload" "jsonb",
    "is_read" boolean DEFAULT false NOT NULL,
    "channels_sent" "text"[] DEFAULT ARRAY[]::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notifications_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notifications_id_seq" OWNED BY "public"."notifications"."id";



CREATE TABLE IF NOT EXISTS "public"."onboarding_state" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "current_step" "text",
    "business_info" "jsonb" DEFAULT '{}'::"jsonb",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_key" "text"
);


ALTER TABLE "public"."onboarding_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_guest_hotels" (
    "profile_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "first_visit" "date",
    "last_visit" "date",
    "total_stays" integer DEFAULT 0 NOT NULL,
    "total_spend" numeric(12,2),
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otel_guest_hotels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_guest_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "guest_phone" "text" NOT NULL,
    "guest_name" "text",
    "direction" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "is_escalation" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otel_guest_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."otel_guest_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_hotels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "country" "text" DEFAULT 'Turkiye'::"text",
    "timezone" "text" DEFAULT 'Europe/Istanbul'::"text" NOT NULL,
    "contact_email" "text",
    "contact_phone" "text",
    "room_count" integer,
    "check_in_time" "text" DEFAULT '15:00'::"text",
    "check_out_time" "text" DEFAULT '11:00'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."otel_hotels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_housekeeping_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "room_id" "uuid",
    "task_type" "text" DEFAULT 'cleaning'::"text" NOT NULL,
    "priority" integer DEFAULT 2 NOT NULL,
    "assigned_to" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "queue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otel_housekeeping_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text"]))),
    CONSTRAINT "otel_housekeeping_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['cleaning'::"text", 'maintenance'::"text", 'inspection'::"text"])))
);


ALTER TABLE "public"."otel_housekeeping_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_pre_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "guest_profile_id" "uuid",
    "id_photo_url" "text",
    "signature_url" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "kvkk_accepted_at" timestamp with time zone,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otel_pre_checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "room_id" "uuid",
    "guest_name" "text" NOT NULL,
    "guest_phone" "text",
    "guest_email" "text",
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "total_price" numeric(10,2),
    "notes" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pre_checkin_complete" boolean DEFAULT false NOT NULL,
    "guest_profile_id" "uuid",
    CONSTRAINT "otel_reservations_check_dates" CHECK (("check_out" > "check_in")),
    CONSTRAINT "otel_reservations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'checked_in'::"text", 'checked_out'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."otel_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "room_type" "text" DEFAULT 'standard'::"text" NOT NULL,
    "bed_type" "text",
    "max_occupancy" integer,
    "description" "text",
    "amenities" "text"[],
    "base_price" numeric(10,2),
    "status" "text" DEFAULT 'clean'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otel_rooms_status_check" CHECK (("status" = ANY (ARRAY['clean'::"text", 'dirty'::"text", 'inspected'::"text", 'out_of_order'::"text", 'occupied'::"text"])))
);


ALTER TABLE "public"."otel_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otel_user_hotels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hotel_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otel_user_hotels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "code" "text" NOT NULL,
    "purpose" "text" NOT NULL,
    "tenant_id" "uuid",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "verified_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:05:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "otp_codes_purpose_check" CHECK (("purpose" = ANY (ARRAY['login'::"text", 'signup'::"text", '2fa'::"text", 'recovery'::"text"])))
);


ALTER TABLE "public"."otp_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."panel_qr_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "claimed_user_id" "uuid",
    "claimed_tenant" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "claimed_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_qr_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'claimed'::"text", 'finished'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."panel_qr_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "user_id" "uuid",
    "tenant_id" "uuid",
    "tenant_key" "text",
    "phone" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_key" "text" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text",
    "category" "text" NOT NULL,
    "mission_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "emoji" "text",
    "points" integer DEFAULT 10,
    "sort_order" integer DEFAULT 0,
    "is_repeatable" boolean DEFAULT false,
    "trigger_check" "text",
    "next_mission" "text",
    "notification_template" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_key" "text",
    "xp_reward" integer DEFAULT 20,
    "chapter" integer,
    "chapter_order" integer
);


ALTER TABLE "public"."platform_missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "email" "text",
    "display_name" "text",
    "phone" "text",
    "role" "text" DEFAULT 'user'::"text",
    "telegram_chat_id" bigint,
    "whatsapp_phone" "text",
    "preferred_locale" "text" DEFAULT 'tr'::"text",
    "favorite_commands" "text"[],
    "kvkk_consent_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dealer_id" "uuid",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "invited_by" "uuid",
    "capabilities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "google_email" "text",
    "google_sub" "text",
    "kvkk_consent_version" "text",
    "billing_address" "jsonb",
    "auth_user_id" "uuid" NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "onboarding_step" integer DEFAULT 0 NOT NULL,
    "onboarding_skipped_at" timestamp with time zone,
    "onboarding_completed_at" timestamp with time zone,
    "is_platform_admin" boolean DEFAULT false NOT NULL,
    "sessions_revoked_at" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'employee'::"text", 'dealer'::"text", 'system'::"text", 'user'::"text", 'guest'::"text", 'sakin'::"text", 'yonetici'::"text", 'denetci'::"text", 'muhasebeci_site'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_key" "text" NOT NULL,
    "code" "text" NOT NULL,
    "title_template" "text" NOT NULL,
    "body_template" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "severity" "text" DEFAULT 'normal'::"text" NOT NULL,
    "cooldown_hours" integer DEFAULT 24 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_evaluated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recommendation_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rule_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "action_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "target_ids" "jsonb",
    "severity" "text" DEFAULT 'normal'::"text" NOT NULL,
    "score" numeric(6,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "acted_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recommendation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "topic" "text",
    "message" "text",
    "due_at" timestamp with time zone NOT NULL,
    "sent" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_b2c_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "customer_email" "text",
    "delivery_type" "text" NOT NULL,
    "delivery_address" "jsonb",
    "table_id" "uuid",
    "items" "jsonb" NOT NULL,
    "notes" "text",
    "subtotal" numeric(10,2) NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending_payment'::"text" NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "mollie_payment_id" "text",
    "mollie_checkout_url" "text",
    "loyalty_member_id" "uuid",
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "estimated_ready_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rst_b2c_orders_delivery_type_check" CHECK (("delivery_type" = ANY (ARRAY['delivery'::"text", 'pickup'::"text", 'dine_in'::"text"]))),
    CONSTRAINT "rst_b2c_orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['ideal'::"text", 'card'::"text", 'cash_on_delivery'::"text", 'card_on_delivery'::"text", 'dine_in_later'::"text"]))),
    CONSTRAINT "rst_b2c_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'expired'::"text"]))),
    CONSTRAINT "rst_b2c_orders_source_check" CHECK (("source" = ANY (ARRAY['web'::"text", 'qr'::"text"]))),
    CONSTRAINT "rst_b2c_orders_status_check" CHECK (("status" = ANY (ARRAY['pending_payment'::"text", 'received'::"text", 'preparing'::"text", 'ready'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."rst_b2c_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text",
    "quantity" numeric(10,3) DEFAULT 0 NOT NULL,
    "low_threshold" numeric(10,3),
    "supplier_name" "text",
    "supplier_phone" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rst_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_loyalty_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "guest_phone" "text" NOT NULL,
    "guest_name" "text",
    "birthday" "text",
    "email" "text",
    "notes" "text",
    "first_visit_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_visit_at" timestamp with time zone,
    "visit_count" integer DEFAULT 0 NOT NULL,
    "total_spent" numeric(10,2) DEFAULT 0 NOT NULL,
    "favorite_items" "jsonb" DEFAULT '[]'::"jsonb",
    "marketing_opt_in" boolean DEFAULT true NOT NULL,
    "source" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rst_loyalty_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_loyalty_visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "visit_type" "text" DEFAULT 'visit'::"text" NOT NULL,
    "spent" numeric(10,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rst_loyalty_visits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_menu_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rst_menu_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_menu_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "restaurant_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."rst_menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "cost" numeric(10,2),
    "is_available" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "image_url" "text",
    "prep_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "restaurant_id" "uuid",
    "category_id" "uuid",
    "allergens" "text"[] DEFAULT '{}'::"text"[],
    "calories" integer,
    "is_vegetarian" boolean DEFAULT false NOT NULL,
    "is_vegan" boolean DEFAULT false NOT NULL,
    "is_spicy" boolean DEFAULT false NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "upsell_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL
);


ALTER TABLE "public"."rst_menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_menu_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price_diff" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rst_menu_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid",
    "item_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rst_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "order_number" "text" NOT NULL,
    "table_id" "uuid",
    "table_label" "text",
    "order_type" "text" DEFAULT 'dine_in'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "guest_count" integer,
    "notes" "text",
    "created_by" "uuid",
    "served_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guest_phone" "text",
    "loyalty_member_id" "uuid"
);


ALTER TABLE "public"."rst_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "guest_name" "text" NOT NULL,
    "guest_phone" "text",
    "guest_email" "text",
    "party_size" integer DEFAULT 1 NOT NULL,
    "reserved_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 90 NOT NULL,
    "table_id" "uuid",
    "table_label" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "loyalty_member_id" "uuid"
);


ALTER TABLE "public"."rst_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "owner_user_id" "uuid",
    "slug" "text" NOT NULL,
    "brand_name" "text" NOT NULL,
    "tagline" "text",
    "logo_url" "text",
    "hero_image_url" "text",
    "primary_color" "text" DEFAULT '#d97706'::"text" NOT NULL,
    "secondary_color" "text" DEFAULT '#0f172a'::"text" NOT NULL,
    "font_family" "text" DEFAULT 'Inter'::"text" NOT NULL,
    "address" "text",
    "city" "text",
    "country" "text" DEFAULT 'NL'::"text" NOT NULL,
    "phone" "text",
    "email" "text",
    "opening_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "social" "jsonb" DEFAULT '{}'::"jsonb",
    "is_published" boolean DEFAULT false NOT NULL,
    "accepts_online_payment" boolean DEFAULT true NOT NULL,
    "accepts_cash_on_delivery" boolean DEFAULT true NOT NULL,
    "accepts_dine_in" boolean DEFAULT true NOT NULL,
    "delivery_zones" "jsonb" DEFAULT '[]'::"jsonb",
    "estimated_prep_minutes" integer DEFAULT 30 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enabled_languages" "text"[] DEFAULT ARRAY['tr'::"text", 'nl'::"text", 'en'::"text"] NOT NULL,
    "default_language" "text" DEFAULT 'tr'::"text" NOT NULL,
    "menu_greeting" "text"
);


ALTER TABLE "public"."rst_restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_table_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ack_at" timestamp with time zone,
    "ack_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rst_table_calls_reason_check" CHECK (("reason" = ANY (ARRAY['call'::"text", 'bill_request'::"text", 'complaint'::"text", 'other'::"text"]))),
    CONSTRAINT "rst_table_calls_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'acknowledged'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."rst_table_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rst_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "capacity" integer,
    "zone" "text",
    "status" "text" DEFAULT 'free'::"text" NOT NULL,
    "current_check_amount" numeric(10,2) DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "qr_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid"
);


ALTER TABLE "public"."rst_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saas_active_session" (
    "phone" "text" NOT NULL,
    "active_saas_key" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "view_as_role" "text"
);


ALTER TABLE "public"."saas_active_session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saas_phone_registry" (
    "phone" "text" NOT NULL,
    "saas_key" "text" NOT NULL,
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saas_phone_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasonal_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "tenant_key" "text",
    "bonus_xp_multiplier" numeric DEFAULT 1.5 NOT NULL,
    "employee_focus" "text"[],
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."seasonal_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."step_up_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "verified_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:05:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."step_up_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "plan" "text" DEFAULT 'trial'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "amount" numeric,
    "currency" "text" DEFAULT 'TRY'::"text",
    "payment_provider" "text",
    "provider_customer_id" "text",
    "provider_subscription_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cancel_at_period_end" boolean DEFAULT false,
    "canceled_at" timestamp with time zone
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" bigint NOT NULL,
    "ticket_id" bigint NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_id" "uuid",
    "message" "text" NOT NULL,
    "internal_note" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."support_messages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."support_messages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."support_messages_id_seq" OWNED BY "public"."support_messages"."id";



CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'replied'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."support_tickets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."support_tickets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."support_tickets_id_seq" OWNED BY "public"."support_tickets"."id";



CREATE TABLE IF NOT EXISTS "public"."sy_announcement_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_announcement_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "target_scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "target_block" "text",
    "target_role" "text",
    "channels" "text"[] DEFAULT ARRAY['inbox'::"text"] NOT NULL,
    "wa_template_id" "text",
    "wa_template_vars" "jsonb" DEFAULT '{}'::"jsonb",
    "scheduled_for" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "sent_by" "uuid",
    "total_recipients" integer DEFAULT 0 NOT NULL,
    "read_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sy_announcements_target_role_check" CHECK ((("target_role" IS NULL) OR ("target_role" = ANY (ARRAY['sakin'::"text", 'yonetici'::"text", 'denetci'::"text", 'muhasebeci_site'::"text"])))),
    CONSTRAINT "sy_announcements_target_scope_check" CHECK (("target_scope" = ANY (ARRAY['all'::"text", 'block'::"text", 'role'::"text"])))
);


ALTER TABLE "public"."sy_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_budget_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "year" integer NOT NULL,
    "yearly_planned_kurus" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_budget_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_buildings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "manager_id" "uuid",
    "name" "text" NOT NULL,
    "total_units" integer DEFAULT 0 NOT NULL,
    "has_blocks" boolean DEFAULT false NOT NULL,
    "amenities" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "access_code" "text",
    "setup_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "arsa_payi_denominator" integer
);


ALTER TABLE "public"."sy_buildings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sy_buildings"."arsa_payi_denominator" IS 'Binanın toplam arsa payı (KMK 634 çoğunluk hesaplama). Yönetici tarafından girilir; sy_units.arsa_payi_numerator toplamı ile eşleşmeli.';



CREATE TABLE IF NOT EXISTS "public"."sy_dues_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "building_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "amount" integer NOT NULL,
    "paid_amount" integer DEFAULT 0 NOT NULL,
    "is_paid" boolean DEFAULT false NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "paid_at" timestamp with time zone,
    "description" "text" DEFAULT 'Aylik aidat'::"text",
    "late_charge_kurus" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_dues_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_income_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "building_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount_kurus" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_income_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_maintenance_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "period_days" integer NOT NULL,
    "last_done_at" timestamp with time zone,
    "next_due_at" timestamp with time zone NOT NULL,
    "assigned_supplier_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "legal_basis" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sy_maintenance_schedule_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'done'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."sy_maintenance_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_maintenance_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "building_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "reported_by_user_id" "uuid",
    "category" "public"."sy_maintenance_category" NOT NULL,
    "priority" "public"."sy_maintenance_priority" DEFAULT 'normal'::"public"."sy_maintenance_priority" NOT NULL,
    "description" "text" NOT NULL,
    "suggested_action" "text",
    "status" "public"."sy_maintenance_status" DEFAULT 'acik'::"public"."sy_maintenance_status" NOT NULL,
    "assigned_to" "text",
    "resolved_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_maintenance_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_meeting_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "agenda_item_no" integer NOT NULL,
    "madde" "text" NOT NULL,
    "lehte_arsa_payi" numeric(10,2) DEFAULT 0 NOT NULL,
    "aleyhte_arsa_payi" numeric(10,2) DEFAULT 0 NOT NULL,
    "cekimser_arsa_payi" numeric(10,2) DEFAULT 0 NOT NULL,
    "sonuc" "text" DEFAULT 'ertelendi'::"text" NOT NULL,
    "karar_metni" "text",
    "voted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sy_meeting_decisions_sonuc_check" CHECK (("sonuc" = ANY (ARRAY['kabul'::"text", 'red'::"text", 'ertelendi'::"text"])))
);


ALTER TABLE "public"."sy_meeting_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "meeting_type" "text" DEFAULT 'olagan'::"text" NOT NULL,
    "agenda" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "location" "text",
    "invitees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attendees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "quorum_required_percent" integer DEFAULT 51 NOT NULL,
    "quorum_actual_percent" numeric(5,2),
    "status" "text" DEFAULT 'cagrildi'::"text" NOT NULL,
    "karar_defteri_pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sy_meetings_meeting_type_check" CHECK (("meeting_type" = ANY (ARRAY['olagan'::"text", 'olaganustu'::"text"]))),
    CONSTRAINT "sy_meetings_status_check" CHECK (("status" = ANY (ARRAY['cagrildi'::"text", 'yapildi'::"text", 'iptal'::"text"])))
);


ALTER TABLE "public"."sy_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_personnel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "phone" "text",
    "monthly_salary_kurus" integer,
    "sgk_no" "text",
    "start_date" "date",
    "contract_end" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "contract_pdf_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_personnel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_residents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "resident_type" "public"."sy_resident_type" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "moved_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "moved_out_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_residents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "sector" "text" NOT NULL,
    "contact_name" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "service" "text",
    "monthly_fee_kurus" integer,
    "contract_start" "date",
    "contract_end" "date",
    "contract_pdf_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "building_id" "uuid" NOT NULL,
    "unit_number" "text" NOT NULL,
    "block" "text",
    "floor" integer,
    "arsa_payi_numerator" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sy_user_residents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resident_id" "uuid" NOT NULL,
    "building_id" "uuid" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sy_user_residents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_integration_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "secrets" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "last_sync_status" "text",
    "last_sync_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_integration_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "saas_type" "text" NOT NULL,
    "plan" "text" DEFAULT 'trial'::"text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_demo" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_daily_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_key" "text" NOT NULL,
    "task_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "emoji" "text",
    "command" "text",
    "entity_id" "text",
    "points" integer DEFAULT 5,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_key" "text",
    "xp_reward" integer DEFAULT 5
);


ALTER TABLE "public"."user_daily_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_employee_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "employee_key" "text" NOT NULL,
    "tier" integer DEFAULT 1 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "total_xp_earned" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_employee_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_favorites" (
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "command_keys" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "inviter_user_id" "uuid" NOT NULL,
    "invitee_phone" "text" NOT NULL,
    "invitee_name" "text",
    "role" "text" NOT NULL,
    "invite_token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "accepted_at" timestamp with time zone,
    "accepted_user_id" "uuid",
    CONSTRAINT "user_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'muhasebe'::"text", 'depocu'::"text", 'satis'::"text"]))),
    CONSTRAINT "user_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_mission_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid",
    "status" "text" DEFAULT 'locked'::"text",
    "completed_at" timestamp with time zone,
    "points_earned" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_mission_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_prefs" (
    "user_id" "uuid" NOT NULL,
    "tips_enabled" boolean DEFAULT true NOT NULL,
    "tips_per_day" integer DEFAULT 3 NOT NULL,
    "quiet_start_hour" integer DEFAULT 22 NOT NULL,
    "quiet_end_hour" integer DEFAULT 9 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_notification_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_key" "text" NOT NULL,
    "week_start" "date" NOT NULL,
    "tasks_completed" integer DEFAULT 0,
    "tasks_total" integer DEFAULT 0,
    "stars" integer DEFAULT 0,
    "points_earned" integer DEFAULT 0,
    "highlights" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_quest_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_key" "text" NOT NULL,
    "current_chapter" integer DEFAULT 1 NOT NULL,
    "active_mission_key" "text",
    "commands_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "chapter_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_quest_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_streaks" (
    "user_id" "uuid" NOT NULL,
    "current_streak" integer DEFAULT 0,
    "longest_streak" integer DEFAULT 0,
    "last_active_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_test_snapshots" (
    "user_id" "uuid" NOT NULL,
    "tenant_key" "text",
    "data" "jsonb" NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_test_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tips_shown" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_key" "text" DEFAULT 'emlak'::"text" NOT NULL,
    "tip_key" "text" NOT NULL,
    "shown_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clicked_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone
);


ALTER TABLE "public"."user_tips_shown" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."xp_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "employee_key" "text" NOT NULL,
    "amount" integer NOT NULL,
    "source" "text" NOT NULL,
    "source_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."xp_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."notifications" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notifications_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."support_messages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."support_messages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."support_tickets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."support_tickets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_test_identities"
    ADD CONSTRAINT "admin_test_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_test_identities"
    ADD CONSTRAINT "admin_test_identities_virtual_phone_key" UNIQUE ("virtual_phone");



ALTER TABLE ONLY "public"."agent_config"
    ADD CONSTRAINT "agent_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_config"
    ADD CONSTRAINT "agent_config_user_id_agent_key_key" UNIQUE ("user_id", "agent_key");



ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_events"
    ADD CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_learnings"
    ADD CONSTRAINT "agent_learnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_messages"
    ADD CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_plans"
    ADD CONSTRAINT "agent_plans_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."agent_profiles"
    ADD CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."agent_proposals"
    ADD CONSTRAINT "agent_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_quotas"
    ADD CONSTRAINT "agent_quotas_pkey" PRIMARY KEY ("user_id", "period_start");



ALTER TABLE ONLY "public"."agent_tasks"
    ADD CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_usage_events"
    ADD CONSTRAINT "agent_usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_websites"
    ADD CONSTRAINT "agent_websites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_websites"
    ADD CONSTRAINT "agent_websites_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_campaign_executions"
    ADD CONSTRAINT "bayi_campaign_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_campaign_rules"
    ADD CONSTRAINT "bayi_campaign_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_campaign_targets"
    ADD CONSTRAINT "bayi_campaign_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_campaign_triggers"
    ADD CONSTRAINT "bayi_campaign_triggers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_campaigns"
    ADD CONSTRAINT "bayi_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_cart_items"
    ADD CONSTRAINT "bayi_cart_items_cart_id_product_id_key" UNIQUE ("cart_id", "product_id");



ALTER TABLE ONLY "public"."bayi_cart_items"
    ADD CONSTRAINT "bayi_cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_carts"
    ADD CONSTRAINT "bayi_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_categories"
    ADD CONSTRAINT "bayi_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_collection_activities"
    ADD CONSTRAINT "bayi_collection_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_companies"
    ADD CONSTRAINT "bayi_companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_credit_limit_audit"
    ADD CONSTRAINT "bayi_credit_limit_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_credit_movements"
    ADD CONSTRAINT "bayi_credit_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_cross_sell_pairs"
    ADD CONSTRAINT "bayi_cross_sell_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_cross_sell_pairs"
    ADD CONSTRAINT "bayi_cross_sell_pairs_tenant_id_product_a_id_product_b_id_key" UNIQUE ("tenant_id", "product_a_id", "product_b_id");



ALTER TABLE ONLY "public"."bayi_dealer_credits"
    ADD CONSTRAINT "bayi_dealer_credits_pkey" PRIMARY KEY ("dealer_user_id");



ALTER TABLE ONLY "public"."bayi_dealer_invoices"
    ADD CONSTRAINT "bayi_dealer_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_order_items"
    ADD CONSTRAINT "bayi_dealer_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_order_status_history"
    ADD CONSTRAINT "bayi_dealer_order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_orders"
    ADD CONSTRAINT "bayi_dealer_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_price_assignments"
    ADD CONSTRAINT "bayi_dealer_price_assignments_dealer_id_price_list_id_key" UNIQUE ("dealer_id", "price_list_id");



ALTER TABLE ONLY "public"."bayi_dealer_price_assignments"
    ADD CONSTRAINT "bayi_dealer_price_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_scores"
    ADD CONSTRAINT "bayi_dealer_scores_dealer_id_period_start_key" UNIQUE ("dealer_id", "period_start");



ALTER TABLE ONLY "public"."bayi_dealer_scores"
    ADD CONSTRAINT "bayi_dealer_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_transactions"
    ADD CONSTRAINT "bayi_dealer_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealer_visits"
    ADD CONSTRAINT "bayi_dealer_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_dealers"
    ADD CONSTRAINT "bayi_dealers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_drip_campaigns"
    ADD CONSTRAINT "bayi_drip_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_drip_enrollments"
    ADD CONSTRAINT "bayi_drip_enrollments_campaign_id_dealer_user_id_key" UNIQUE ("campaign_id", "dealer_user_id");



ALTER TABLE ONLY "public"."bayi_drip_enrollments"
    ADD CONSTRAINT "bayi_drip_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_drip_sends"
    ADD CONSTRAINT "bayi_drip_sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_drip_steps"
    ADD CONSTRAINT "bayi_drip_steps_campaign_id_step_order_key" UNIQUE ("campaign_id", "step_order");



ALTER TABLE ONLY "public"."bayi_drip_steps"
    ADD CONSTRAINT "bayi_drip_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_favorites"
    ADD CONSTRAINT "bayi_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_favorites"
    ADD CONSTRAINT "bayi_favorites_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."bayi_invite_links"
    ADD CONSTRAINT "bayi_invite_links_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."bayi_invite_links"
    ADD CONSTRAINT "bayi_invite_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_invoices"
    ADD CONSTRAINT "bayi_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_invoices"
    ADD CONSTRAINT "bayi_invoices_tenant_id_invoice_no_key" UNIQUE ("tenant_id", "invoice_no");



ALTER TABLE ONLY "public"."bayi_leads"
    ADD CONSTRAINT "bayi_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_order_items"
    ADD CONSTRAINT "bayi_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_order_status_history"
    ADD CONSTRAINT "bayi_order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_order_statuses"
    ADD CONSTRAINT "bayi_order_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_orders"
    ADD CONSTRAINT "bayi_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_payments"
    ADD CONSTRAINT "bayi_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_price_list_items"
    ADD CONSTRAINT "bayi_price_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_price_list_items"
    ADD CONSTRAINT "bayi_price_list_items_price_list_id_product_id_key" UNIQUE ("price_list_id", "product_id");



ALTER TABLE ONLY "public"."bayi_price_lists"
    ADD CONSTRAINT "bayi_price_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_price_tiers"
    ADD CONSTRAINT "bayi_price_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_price_tiers"
    ADD CONSTRAINT "bayi_price_tiers_price_list_item_id_min_quantity_key" UNIQUE ("price_list_item_id", "min_quantity");



ALTER TABLE ONLY "public"."bayi_product_visibility"
    ADD CONSTRAINT "bayi_product_visibility_dealer_id_product_id_key" UNIQUE ("dealer_id", "product_id");



ALTER TABLE ONLY "public"."bayi_product_visibility"
    ADD CONSTRAINT "bayi_product_visibility_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_products"
    ADD CONSTRAINT "bayi_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_purchase_order_lines"
    ADD CONSTRAINT "bayi_purchase_order_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_purchase_orders"
    ADD CONSTRAINT "bayi_purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_referral_codes"
    ADD CONSTRAINT "bayi_referral_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."bayi_referral_codes"
    ADD CONSTRAINT "bayi_referral_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_referrals"
    ADD CONSTRAINT "bayi_referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_sales_rep_dealers"
    ADD CONSTRAINT "bayi_sales_rep_dealers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_sales_rep_dealers"
    ADD CONSTRAINT "bayi_sales_rep_dealers_sales_rep_id_dealer_id_key" UNIQUE ("sales_rep_id", "dealer_id");



ALTER TABLE ONLY "public"."bayi_sales_reps"
    ADD CONSTRAINT "bayi_sales_reps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_sales_reps"
    ADD CONSTRAINT "bayi_sales_reps_tenant_id_phone_key" UNIQUE ("tenant_id", "phone");



ALTER TABLE ONLY "public"."bayi_sales_targets"
    ADD CONSTRAINT "bayi_sales_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_stock_movements"
    ADD CONSTRAINT "bayi_stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_stock_reservations"
    ADD CONSTRAINT "bayi_stock_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_stock_transfers"
    ADD CONSTRAINT "bayi_stock_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_stocktake_items"
    ADD CONSTRAINT "bayi_stocktake_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_stocktake_items"
    ADD CONSTRAINT "bayi_stocktake_items_session_id_product_id_key" UNIQUE ("session_id", "product_id");



ALTER TABLE ONLY "public"."bayi_stocktake_sessions"
    ADD CONSTRAINT "bayi_stocktake_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_supplier_payments"
    ADD CONSTRAINT "bayi_supplier_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_suppliers"
    ADD CONSTRAINT "bayi_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_transaction_types"
    ADD CONSTRAINT "bayi_transaction_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_visit_orders"
    ADD CONSTRAINT "bayi_visit_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_visit_orders"
    ADD CONSTRAINT "bayi_visit_orders_visit_id_order_id_key" UNIQUE ("visit_id", "order_id");



ALTER TABLE ONLY "public"."bayi_visit_plans"
    ADD CONSTRAINT "bayi_visit_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_visits"
    ADD CONSTRAINT "bayi_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_visits"
    ADD CONSTRAINT "bayi_visits_tenant_id_client_uuid_key" UNIQUE ("tenant_id", "client_uuid");



ALTER TABLE ONLY "public"."bayi_vitrines"
    ADD CONSTRAINT "bayi_vitrines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_vitrines"
    ADD CONSTRAINT "bayi_vitrines_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."bayi_warehouse_stock"
    ADD CONSTRAINT "bayi_warehouse_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bayi_warehouse_stock"
    ADD CONSTRAINT "bayi_warehouse_stock_warehouse_id_product_id_key" UNIQUE ("warehouse_id", "product_id");



ALTER TABLE ONLY "public"."bayi_warehouses"
    ADD CONSTRAINT "bayi_warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bot_activity"
    ADD CONSTRAINT "bot_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."command_sessions"
    ADD CONSTRAINT "command_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_sign_token_key" UNIQUE ("sign_token");



ALTER TABLE ONLY "public"."dealer_invitations"
    ADD CONSTRAINT "dealer_invitations_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."dealer_invitations"
    ADD CONSTRAINT "dealer_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."distributor_slugs"
    ADD CONSTRAINT "distributor_slugs_pkey" PRIMARY KEY ("tenant_slug", "slug");



ALTER TABLE ONLY "public"."emlak_calendar_events"
    ADD CONSTRAINT "emlak_calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_contact_actions"
    ADD CONSTRAINT "emlak_contact_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_customer_contacts"
    ADD CONSTRAINT "emlak_customer_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_customers"
    ADD CONSTRAINT "emlak_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_daily_leads"
    ADD CONSTRAINT "emlak_daily_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_lead_calls"
    ADD CONSTRAINT "emlak_lead_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_monitoring_criteria"
    ADD CONSTRAINT "emlak_monitoring_criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_presentations"
    ADD CONSTRAINT "emlak_presentations_magic_token_key" UNIQUE ("magic_token");



ALTER TABLE ONLY "public"."emlak_presentations"
    ADD CONSTRAINT "emlak_presentations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_properties"
    ADD CONSTRAINT "emlak_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_property_photos"
    ADD CONSTRAINT "emlak_property_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_publishing_history"
    ADD CONSTRAINT "emlak_publishing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emlak_tracking_criteria"
    ADD CONSTRAINT "emlak_tracking_criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."extension_tokens"
    ADD CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."extension_tokens"
    ADD CONSTRAINT "extension_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."hotel_employees"
    ADD CONSTRAINT "hotel_employees_pkey" PRIMARY KEY ("hotel_id", "profile_id");



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invite_links"
    ADD CONSTRAINT "invite_links_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invite_links"
    ADD CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_link_tokens"
    ADD CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magic_link_tokens"
    ADD CONSTRAINT "magic_link_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."mkt_campaigns"
    ADD CONSTRAINT "mkt_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mkt_order_items"
    ADD CONSTRAINT "mkt_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mkt_orders"
    ADD CONSTRAINT "mkt_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mkt_products"
    ADD CONSTRAINT "mkt_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mkt_products"
    ADD CONSTRAINT "mkt_products_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."mkt_sales"
    ADD CONSTRAINT "mkt_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mkt_suppliers"
    ADD CONSTRAINT "mkt_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mkt_suppliers"
    ADD CONSTRAINT "mkt_suppliers_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."muh_appointments"
    ADD CONSTRAINT "muh_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_beyanname_statuses"
    ADD CONSTRAINT "muh_beyanname_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_invoices"
    ADD CONSTRAINT "muh_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_mukellefler"
    ADD CONSTRAINT "muh_mukellefler_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_payments"
    ADD CONSTRAINT "muh_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_reminders"
    ADD CONSTRAINT "muh_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_tahsilat_reminders"
    ADD CONSTRAINT "muh_tahsilat_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."muh_tax_rates"
    ADD CONSTRAINT "muh_tax_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_type_channel_key" UNIQUE ("user_id", "type", "channel");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."otel_guest_hotels"
    ADD CONSTRAINT "otel_guest_hotels_pkey" PRIMARY KEY ("profile_id", "hotel_id");



ALTER TABLE ONLY "public"."otel_guest_messages"
    ADD CONSTRAINT "otel_guest_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_hotels"
    ADD CONSTRAINT "otel_hotels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_housekeeping_tasks"
    ADD CONSTRAINT "otel_housekeeping_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_pre_checkins"
    ADD CONSTRAINT "otel_pre_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_reservations"
    ADD CONSTRAINT "otel_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_rooms"
    ADD CONSTRAINT "otel_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_user_hotels"
    ADD CONSTRAINT "otel_user_hotels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otel_user_hotels"
    ADD CONSTRAINT "otel_user_hotels_user_id_hotel_id_key" UNIQUE ("user_id", "hotel_id");



ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panel_qr_tokens"
    ADD CONSTRAINT "panel_qr_tokens_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."panel_qr_tokens"
    ADD CONSTRAINT "panel_qr_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_events"
    ADD CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_missions"
    ADD CONSTRAINT "platform_missions_mission_key_key" UNIQUE ("mission_key");



ALTER TABLE ONLY "public"."platform_missions"
    ADD CONSTRAINT "platform_missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_tenant_unique" UNIQUE ("auth_user_id", "tenant_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendation_rules"
    ADD CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendation_rules"
    ADD CONSTRAINT "recommendation_rules_tenant_key_code_key" UNIQUE ("tenant_key", "code");



ALTER TABLE ONLY "public"."recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_b2c_orders"
    ADD CONSTRAINT "rst_b2c_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_inventory"
    ADD CONSTRAINT "rst_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_loyalty_members"
    ADD CONSTRAINT "rst_loyalty_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_loyalty_visits"
    ADD CONSTRAINT "rst_loyalty_visits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_menu_addons"
    ADD CONSTRAINT "rst_menu_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_menu_categories"
    ADD CONSTRAINT "rst_menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_menu_items"
    ADD CONSTRAINT "rst_menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_menu_variants"
    ADD CONSTRAINT "rst_menu_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_order_items"
    ADD CONSTRAINT "rst_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_orders"
    ADD CONSTRAINT "rst_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_reservations"
    ADD CONSTRAINT "rst_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_restaurants"
    ADD CONSTRAINT "rst_restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_restaurants"
    ADD CONSTRAINT "rst_restaurants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."rst_table_calls"
    ADD CONSTRAINT "rst_table_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rst_tables"
    ADD CONSTRAINT "rst_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saas_active_session"
    ADD CONSTRAINT "saas_active_session_pkey" PRIMARY KEY ("phone");



ALTER TABLE ONLY "public"."saas_phone_registry"
    ADD CONSTRAINT "saas_phone_registry_pkey" PRIMARY KEY ("phone", "saas_key");



ALTER TABLE ONLY "public"."seasonal_events"
    ADD CONSTRAINT "seasonal_events_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."seasonal_events"
    ADD CONSTRAINT "seasonal_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."step_up_challenges"
    ADD CONSTRAINT "step_up_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_announcement_reads"
    ADD CONSTRAINT "sy_announcement_reads_announcement_id_user_id_key" UNIQUE ("announcement_id", "user_id");



ALTER TABLE ONLY "public"."sy_announcement_reads"
    ADD CONSTRAINT "sy_announcement_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_announcements"
    ADD CONSTRAINT "sy_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_budget_categories"
    ADD CONSTRAINT "sy_budget_categories_building_id_category_year_key" UNIQUE ("building_id", "category", "year");



ALTER TABLE ONLY "public"."sy_budget_categories"
    ADD CONSTRAINT "sy_budget_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_buildings"
    ADD CONSTRAINT "sy_buildings_access_code_key" UNIQUE ("access_code");



ALTER TABLE ONLY "public"."sy_buildings"
    ADD CONSTRAINT "sy_buildings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_dues_ledger"
    ADD CONSTRAINT "sy_dues_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_income_expenses"
    ADD CONSTRAINT "sy_income_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_maintenance_schedule"
    ADD CONSTRAINT "sy_maintenance_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_maintenance_tickets"
    ADD CONSTRAINT "sy_maintenance_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_meeting_decisions"
    ADD CONSTRAINT "sy_meeting_decisions_meeting_id_agenda_item_no_key" UNIQUE ("meeting_id", "agenda_item_no");



ALTER TABLE ONLY "public"."sy_meeting_decisions"
    ADD CONSTRAINT "sy_meeting_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_meetings"
    ADD CONSTRAINT "sy_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_personnel"
    ADD CONSTRAINT "sy_personnel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_residents"
    ADD CONSTRAINT "sy_residents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_suppliers"
    ADD CONSTRAINT "sy_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_units"
    ADD CONSTRAINT "sy_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_user_residents"
    ADD CONSTRAINT "sy_user_residents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sy_user_residents"
    ADD CONSTRAINT "sy_user_residents_user_id_resident_id_key" UNIQUE ("user_id", "resident_id");



ALTER TABLE ONLY "public"."tenant_integration_settings"
    ADD CONSTRAINT "tenant_integration_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_integration_settings"
    ADD CONSTRAINT "tenant_integration_settings_tenant_id_provider_key" UNIQUE ("tenant_id", "provider");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."emlak_daily_leads"
    ADD CONSTRAINT "uq_daily_leads_source_snapshot" UNIQUE ("source_id", "snapshot_date");



ALTER TABLE ONLY "public"."emlak_lead_calls"
    ADD CONSTRAINT "uq_lead_calls_user_source" UNIQUE ("user_id", "source_id");



ALTER TABLE ONLY "public"."rst_b2c_orders"
    ADD CONSTRAINT "uq_rst_b2c_orders_restaurant_number" UNIQUE ("restaurant_id", "order_number");



ALTER TABLE ONLY "public"."rst_loyalty_members"
    ADD CONSTRAINT "uq_rst_loyalty_tenant_phone" UNIQUE ("tenant_id", "guest_phone");



ALTER TABLE ONLY "public"."rst_menu_categories"
    ADD CONSTRAINT "uq_rst_menu_categories_restaurant_name" UNIQUE ("restaurant_id", "name");



ALTER TABLE ONLY "public"."rst_orders"
    ADD CONSTRAINT "uq_rst_orders_tenant_number" UNIQUE ("tenant_id", "order_number");



ALTER TABLE ONLY "public"."rst_restaurants"
    ADD CONSTRAINT "uq_rst_restaurants_tenant" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."rst_tables"
    ADD CONSTRAINT "uq_rst_tables_qr_token" UNIQUE ("qr_token");



ALTER TABLE ONLY "public"."rst_tables"
    ADD CONSTRAINT "uq_rst_tables_tenant_label" UNIQUE ("tenant_id", "label");



ALTER TABLE ONLY "public"."user_daily_tasks"
    ADD CONSTRAINT "user_daily_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_employee_progress"
    ADD CONSTRAINT "user_employee_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_employee_progress"
    ADD CONSTRAINT "user_employee_progress_user_id_employee_key_key" UNIQUE ("user_id", "employee_key");



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_prefs"
    ADD CONSTRAINT "user_notification_prefs_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_performance"
    ADD CONSTRAINT "user_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_quest_state"
    ADD CONSTRAINT "user_quest_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_quest_state"
    ADD CONSTRAINT "user_quest_state_user_id_tenant_key_key" UNIQUE ("user_id", "tenant_key");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_test_snapshots"
    ADD CONSTRAINT "user_test_snapshots_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_tips_shown"
    ADD CONSTRAINT "user_tips_shown_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."xp_events"
    ADD CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_test_identities_admin" ON "public"."admin_test_identities" USING "btree" ("admin_user_id");



CREATE INDEX "idx_agent_conv_tenant" ON "public"."agent_conversations" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_agent_conv_user" ON "public"."agent_conversations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_agent_events_unprocessed" ON "public"."agent_events" USING "btree" ("processed", "created_at") WHERE ("processed" = false);



CREATE INDEX "idx_agent_messages_task" ON "public"."agent_messages" USING "btree" ("task_id");



CREATE INDEX "idx_agent_messages_user" ON "public"."agent_messages" USING "btree" ("user_id", "agent_key", "created_at" DESC);



CREATE INDEX "idx_agent_tasks_active" ON "public"."agent_tasks" USING "btree" ("status") WHERE ("status" <> ALL (ARRAY['done'::"text", 'failed'::"text"]));



CREATE INDEX "idx_agent_tasks_user_agent" ON "public"."agent_tasks" USING "btree" ("user_id", "agent_key");



CREATE INDEX "idx_ai_tenant" ON "public"."ai_usage" USING "btree" ("tenant_id");



CREATE INDEX "idx_al_agent" ON "public"."agent_learnings" USING "btree" ("agent_key");



CREATE INDEX "idx_al_agent_user" ON "public"."agent_learnings" USING "btree" ("agent_key", "user_id");



CREATE INDEX "idx_al_user" ON "public"."agent_learnings" USING "btree" ("user_id");



CREATE INDEX "idx_audit_tenant" ON "public"."audit_log" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_campaign_rules_campaign" ON "public"."bayi_campaign_rules" USING "btree" ("campaign_id");



CREATE INDEX "idx_bayi_campaign_rules_tenant" ON "public"."bayi_campaign_rules" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_campaign_targets_campaign" ON "public"."bayi_campaign_targets" USING "btree" ("campaign_id");



CREATE INDEX "idx_bayi_campaign_targets_dealer_lookup" ON "public"."bayi_campaign_targets" USING "btree" ("target_type", "target_value");



CREATE INDEX "idx_bayi_campaign_targets_tenant" ON "public"."bayi_campaign_targets" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_campaigns_coupon" ON "public"."bayi_campaigns" USING "btree" ("tenant_id", "coupon_code") WHERE ("coupon_code" IS NOT NULL);



CREATE INDEX "idx_bayi_campaigns_tenant" ON "public"."bayi_campaigns" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_campaigns_tenant_status" ON "public"."bayi_campaigns" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_bayi_cart_items_cart" ON "public"."bayi_cart_items" USING "btree" ("cart_id");



CREATE INDEX "idx_bayi_cart_items_product" ON "public"."bayi_cart_items" USING "btree" ("product_id");



CREATE INDEX "idx_bayi_cart_items_tenant" ON "public"."bayi_cart_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_carts_dealer" ON "public"."bayi_carts" USING "btree" ("dealer_id");



CREATE INDEX "idx_bayi_carts_tenant" ON "public"."bayi_carts" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_dealer_price_assignments_dealer" ON "public"."bayi_dealer_price_assignments" USING "btree" ("dealer_id", "priority");



CREATE INDEX "idx_bayi_dealer_price_assignments_list" ON "public"."bayi_dealer_price_assignments" USING "btree" ("price_list_id");



CREATE INDEX "idx_bayi_dealer_price_assignments_tenant" ON "public"."bayi_dealer_price_assignments" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_dealers_region" ON "public"."bayi_dealers" USING "btree" ("tenant_id", "region");



CREATE INDEX "idx_bayi_dealers_risk_status" ON "public"."bayi_dealers" USING "btree" ("risk_status");



CREATE INDEX "idx_bayi_dealers_segment" ON "public"."bayi_dealers" USING "btree" ("tenant_id", "segment");



CREATE INDEX "idx_bayi_dealers_tags" ON "public"."bayi_dealers" USING "gin" ("tags");



CREATE INDEX "idx_bayi_dealers_tenant" ON "public"."bayi_dealers" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_favorites_dealer" ON "public"."bayi_favorites" USING "btree" ("dealer_id");



CREATE INDEX "idx_bayi_favorites_tenant" ON "public"."bayi_favorites" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_favorites_user" ON "public"."bayi_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_bayi_leads_dealer_status" ON "public"."bayi_leads" USING "btree" ("dealer_user_id", "status", "created_at" DESC);



CREATE INDEX "idx_bayi_leads_tenant_created" ON "public"."bayi_leads" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_bayi_leads_vitrine" ON "public"."bayi_leads" USING "btree" ("vitrine_id");



CREATE INDEX "idx_bayi_order_items_order" ON "public"."bayi_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_bayi_order_status_history_order" ON "public"."bayi_order_status_history" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "idx_bayi_order_status_history_tenant" ON "public"."bayi_order_status_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_orders_dealer" ON "public"."bayi_orders" USING "btree" ("dealer_id");



CREATE INDEX "idx_bayi_orders_dealer_created" ON "public"."bayi_orders" USING "btree" ("dealer_id", "created_at" DESC);



CREATE INDEX "idx_bayi_orders_invoice" ON "public"."bayi_orders" USING "btree" ("invoice_id") WHERE ("invoice_id" IS NOT NULL);



CREATE INDEX "idx_bayi_orders_tenant" ON "public"."bayi_orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_orders_tenant_status" ON "public"."bayi_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_bayi_orders_tracking" ON "public"."bayi_orders" USING "btree" ("shipment_carrier", "shipment_tracking_no") WHERE ("shipment_tracking_no" IS NOT NULL);



CREATE INDEX "idx_bayi_orders_visit" ON "public"."bayi_orders" USING "btree" ("visit_id");



CREATE INDEX "idx_bayi_payments_order" ON "public"."bayi_payments" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE INDEX "idx_bayi_payments_provider_payment_id" ON "public"."bayi_payments" USING "btree" ("provider", "provider_payment_id") WHERE ("provider_payment_id" IS NOT NULL);



CREATE INDEX "idx_bayi_po_lines_po" ON "public"."bayi_purchase_order_lines" USING "btree" ("po_id");



CREATE INDEX "idx_bayi_po_lines_tenant" ON "public"."bayi_purchase_order_lines" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_po_status" ON "public"."bayi_purchase_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_bayi_po_supplier" ON "public"."bayi_purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_bayi_po_tenant" ON "public"."bayi_purchase_orders" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_bayi_price_list_items_list" ON "public"."bayi_price_list_items" USING "btree" ("price_list_id");



CREATE INDEX "idx_bayi_price_list_items_product" ON "public"."bayi_price_list_items" USING "btree" ("product_id");



CREATE INDEX "idx_bayi_price_list_items_tenant" ON "public"."bayi_price_list_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_price_lists_active" ON "public"."bayi_price_lists" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_bayi_price_lists_tenant" ON "public"."bayi_price_lists" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_price_tiers_item" ON "public"."bayi_price_tiers" USING "btree" ("price_list_item_id", "min_quantity");



CREATE INDEX "idx_bayi_price_tiers_tenant" ON "public"."bayi_price_tiers" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_products_tenant" ON "public"."bayi_products" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_rep_dealers_dealer" ON "public"."bayi_sales_rep_dealers" USING "btree" ("dealer_id");



CREATE INDEX "idx_bayi_rep_dealers_rep" ON "public"."bayi_sales_rep_dealers" USING "btree" ("sales_rep_id");



CREATE INDEX "idx_bayi_rep_dealers_tenant" ON "public"."bayi_sales_rep_dealers" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_sales_reps_active" ON "public"."bayi_sales_reps" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_bayi_sales_reps_tenant" ON "public"."bayi_sales_reps" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_sales_reps_user" ON "public"."bayi_sales_reps" USING "btree" ("user_id");



CREATE INDEX "idx_bayi_stocktake_items_session" ON "public"."bayi_stocktake_items" USING "btree" ("session_id");



CREATE INDEX "idx_bayi_stocktake_items_tenant" ON "public"."bayi_stocktake_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_stocktake_tenant" ON "public"."bayi_stocktake_sessions" USING "btree" ("tenant_id", "started_at" DESC);



CREATE INDEX "idx_bayi_stocktake_warehouse_open" ON "public"."bayi_stocktake_sessions" USING "btree" ("warehouse_id", "status");



CREATE INDEX "idx_bayi_supplier_payments_supplier" ON "public"."bayi_supplier_payments" USING "btree" ("supplier_id", "paid_at" DESC);



CREATE INDEX "idx_bayi_supplier_payments_tenant" ON "public"."bayi_supplier_payments" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_suppliers_active" ON "public"."bayi_suppliers" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_bayi_suppliers_tenant" ON "public"."bayi_suppliers" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_transactions_dealer" ON "public"."bayi_dealer_transactions" USING "btree" ("dealer_id");



CREATE INDEX "idx_bayi_transfers_tenant" ON "public"."bayi_stock_transfers" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_bayi_visit_orders_tenant" ON "public"."bayi_visit_orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_visit_orders_visit" ON "public"."bayi_visit_orders" USING "btree" ("visit_id");



CREATE INDEX "idx_bayi_visit_plans_rep_date" ON "public"."bayi_visit_plans" USING "btree" ("sales_rep_id", "planned_date");



CREATE INDEX "idx_bayi_visit_plans_tenant" ON "public"."bayi_visit_plans" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_visits_dealer" ON "public"."bayi_dealer_visits" USING "btree" ("dealer_id");



CREATE INDEX "idx_bayi_visits_rep" ON "public"."bayi_visits" USING "btree" ("sales_rep_id", "check_in_at" DESC);



CREATE INDEX "idx_bayi_visits_tenant" ON "public"."bayi_visits" USING "btree" ("tenant_id", "check_in_at" DESC);



CREATE INDEX "idx_bayi_vitrines_dealer" ON "public"."bayi_vitrines" USING "btree" ("dealer_user_id");



CREATE INDEX "idx_bayi_vitrines_tenant_active" ON "public"."bayi_vitrines" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_bayi_warehouses_active" ON "public"."bayi_warehouses" USING "btree" ("tenant_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_bayi_warehouses_tenant" ON "public"."bayi_warehouses" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_wh_stock_product" ON "public"."bayi_warehouse_stock" USING "btree" ("product_id");



CREATE INDEX "idx_bayi_wh_stock_tenant" ON "public"."bayi_warehouse_stock" USING "btree" ("tenant_id");



CREATE INDEX "idx_bayi_wh_stock_warehouse" ON "public"."bayi_warehouse_stock" USING "btree" ("warehouse_id");



CREATE INDEX "idx_botact_tenant" ON "public"."bot_activity" USING "btree" ("tenant_id");



CREATE INDEX "idx_calendar_pending_scheduled" ON "public"."emlak_calendar_events" USING "btree" ("status", "scheduled_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_calendar_user_scheduled" ON "public"."emlak_calendar_events" USING "btree" ("user_id", "scheduled_at" DESC);



CREATE INDEX "idx_camp_exec_tenant" ON "public"."bayi_campaign_executions" USING "btree" ("tenant_id", "executed_at" DESC);



CREATE INDEX "idx_camp_exec_trigger_dealer" ON "public"."bayi_campaign_executions" USING "btree" ("trigger_id", "dealer_id", "executed_at" DESC);



CREATE INDEX "idx_camp_tenant" ON "public"."campaigns" USING "btree" ("tenant_id");



CREATE INDEX "idx_camp_triggers_tenant_active" ON "public"."bayi_campaign_triggers" USING "btree" ("tenant_id", "is_active", "last_run_at");



CREATE INDEX "idx_cmd_tenant" ON "public"."command_sessions" USING "btree" ("tenant_id");



CREATE INDEX "idx_cmd_user" ON "public"."command_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_contracts_sign" ON "public"."contracts" USING "btree" ("sign_token");



CREATE INDEX "idx_contracts_tenant" ON "public"."contracts" USING "btree" ("tenant_id");



CREATE INDEX "idx_credit_audit_dealer" ON "public"."bayi_credit_limit_audit" USING "btree" ("dealer_id", "changed_at" DESC);



CREATE INDEX "idx_credit_audit_tenant" ON "public"."bayi_credit_limit_audit" USING "btree" ("tenant_id", "changed_at" DESC);



CREATE INDEX "idx_credit_mov_dealer" ON "public"."bayi_credit_movements" USING "btree" ("dealer_user_id", "created_at" DESC);



CREATE INDEX "idx_credit_mov_tenant" ON "public"."bayi_credit_movements" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_cross_sell_a" ON "public"."bayi_cross_sell_pairs" USING "btree" ("tenant_id", "product_a_id", "score" DESC);



CREATE INDEX "idx_cross_sell_b" ON "public"."bayi_cross_sell_pairs" USING "btree" ("tenant_id", "product_b_id", "score" DESC);



CREATE INDEX "idx_customer_contacts_customer" ON "public"."emlak_customer_contacts" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_contacts_user" ON "public"."emlak_customer_contacts" USING "btree" ("user_id");



CREATE INDEX "idx_daily_leads_district" ON "public"."emlak_daily_leads" USING "btree" ("location_district", "location_neighborhood");



CREATE INDEX "idx_daily_leads_owner_enrich" ON "public"."emlak_daily_leads" USING "btree" ("owner_enriched_at") WHERE ("owner_enriched_at" IS NULL);



CREATE INDEX "idx_daily_leads_snapshot" ON "public"."emlak_daily_leads" USING "btree" ("snapshot_date" DESC);



CREATE INDEX "idx_daily_leads_type" ON "public"."emlak_daily_leads" USING "btree" ("type", "listing_type");



CREATE INDEX "idx_dealer_credits_tenant" ON "public"."bayi_dealer_credits" USING "btree" ("tenant_id");



CREATE INDEX "idx_dealer_inv_code" ON "public"."dealer_invitations" USING "btree" ("invite_code");



CREATE INDEX "idx_dealer_inv_distributor" ON "public"."dealer_invitations" USING "btree" ("distributor_tenant_id", "status");



CREATE INDEX "idx_dealer_inv_phone" ON "public"."dealer_invitations" USING "btree" ("phone");



CREATE INDEX "idx_dealer_order_items_order" ON "public"."bayi_dealer_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_dealer_order_status_history" ON "public"."bayi_dealer_order_status_history" USING "btree" ("order_id", "changed_at");



CREATE INDEX "idx_dealer_orders_dealer" ON "public"."bayi_dealer_orders" USING "btree" ("dealer_user_id");



CREATE INDEX "idx_dealer_orders_shipment_status" ON "public"."bayi_dealer_orders" USING "btree" ("tenant_id", "shipment_status") WHERE ("shipment_status" IS NOT NULL);



CREATE INDEX "idx_dealer_orders_tenant_status" ON "public"."bayi_dealer_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_dealer_scores_dealer" ON "public"."bayi_dealer_scores" USING "btree" ("dealer_id", "period_start" DESC);



CREATE INDEX "idx_dealer_scores_tenant_period" ON "public"."bayi_dealer_scores" USING "btree" ("tenant_id", "period_start" DESC);



CREATE INDEX "idx_dealer_scores_total" ON "public"."bayi_dealer_scores" USING "btree" ("tenant_id", "score_total" DESC, "period_start" DESC);



CREATE INDEX "idx_drip_camp_tenant_active" ON "public"."bayi_drip_campaigns" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_drip_enrol_dealer" ON "public"."bayi_drip_enrollments" USING "btree" ("dealer_user_id");



CREATE INDEX "idx_drip_enrol_next" ON "public"."bayi_drip_enrollments" USING "btree" ("status", "next_send_at");



CREATE INDEX "idx_drip_sends_enrol" ON "public"."bayi_drip_sends" USING "btree" ("enrollment_id", "sent_at" DESC);



CREATE INDEX "idx_drip_steps_campaign" ON "public"."bayi_drip_steps" USING "btree" ("campaign_id", "step_order");



CREATE INDEX "idx_ecust_tenant" ON "public"."emlak_customers" USING "btree" ("tenant_id");



CREATE INDEX "idx_ecust_user" ON "public"."emlak_customers" USING "btree" ("user_id");



CREATE INDEX "idx_emlak_contact_actions_prop" ON "public"."emlak_contact_actions" USING "btree" ("property_id");



CREATE INDEX "idx_emlak_contact_actions_user" ON "public"."emlak_contact_actions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_emlak_customers_deleted_at" ON "public"."emlak_customers" USING "btree" ("user_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_emlak_customers_looking_for" ON "public"."emlak_customers" USING "gin" ("looking_for");



CREATE UNIQUE INDEX "idx_emlak_properties_source_id" ON "public"."emlak_properties" USING "btree" ("source_id") WHERE ("source_id" IS NOT NULL);



CREATE INDEX "idx_emon_user" ON "public"."emlak_monitoring_criteria" USING "btree" ("user_id");



CREATE INDEX "idx_ep_customer" ON "public"."emlak_presentations" USING "btree" ("customer_id");



CREATE INDEX "idx_ep_status" ON "public"."emlak_presentations" USING "btree" ("status");



CREATE INDEX "idx_ep_token" ON "public"."emlak_presentations" USING "btree" ("magic_token");



CREATE INDEX "idx_ep_user" ON "public"."emlak_presentations" USING "btree" ("user_id");



CREATE INDEX "idx_ephoto_prop" ON "public"."emlak_property_photos" USING "btree" ("property_id");



CREATE INDEX "idx_eprop_status" ON "public"."emlak_properties" USING "btree" ("status");



CREATE INDEX "idx_eprop_tenant" ON "public"."emlak_properties" USING "btree" ("tenant_id");



CREATE INDEX "idx_eprop_user" ON "public"."emlak_properties" USING "btree" ("user_id");



CREATE INDEX "idx_epub_prop" ON "public"."emlak_publishing_history" USING "btree" ("property_id");



CREATE INDEX "idx_events_tenant_created" ON "public"."agent_usage_events" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_events_user_created" ON "public"."agent_usage_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_hotel_employees_hotel" ON "public"."hotel_employees" USING "btree" ("hotel_id");



CREATE INDEX "idx_hotel_employees_profile" ON "public"."hotel_employees" USING "btree" ("profile_id");



CREATE INDEX "idx_invite_code" ON "public"."invite_codes" USING "btree" ("code");



CREATE INDEX "idx_invite_links_code" ON "public"."invite_links" USING "btree" ("code");



CREATE INDEX "idx_invite_links_tenant" ON "public"."invite_links" USING "btree" ("tenant_id");



CREATE INDEX "idx_invite_tenant" ON "public"."invite_codes" USING "btree" ("tenant_id");



CREATE INDEX "idx_invoices_dealer_status" ON "public"."bayi_invoices" USING "btree" ("dealer_user_id", "status");



CREATE INDEX "idx_invoices_due_date" ON "public"."bayi_invoices" USING "btree" ("due_date");



CREATE INDEX "idx_lead_calls_source" ON "public"."emlak_lead_calls" USING "btree" ("source_id");



CREATE INDEX "idx_lead_calls_user" ON "public"."emlak_lead_calls" USING "btree" ("user_id");



CREATE INDEX "idx_magic_token" ON "public"."magic_link_tokens" USING "btree" ("token");



CREATE INDEX "idx_mkt_campaigns_product_ends" ON "public"."mkt_campaigns" USING "btree" ("product_id", "ends_at");



CREATE INDEX "idx_mkt_campaigns_tenant_id" ON "public"."mkt_campaigns" USING "btree" ("tenant_id");



CREATE INDEX "idx_mkt_order_items_order_id" ON "public"."mkt_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_mkt_order_items_tenant_id" ON "public"."mkt_order_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_mkt_orders_tenant_id" ON "public"."mkt_orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_mkt_orders_tenant_status" ON "public"."mkt_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_mkt_products_tenant_id" ON "public"."mkt_products" USING "btree" ("tenant_id");



CREATE INDEX "idx_mkt_products_tenant_name" ON "public"."mkt_products" USING "btree" ("tenant_id", "name");



CREATE INDEX "idx_mkt_sales_tenant_id" ON "public"."mkt_sales" USING "btree" ("tenant_id");



CREATE INDEX "idx_mkt_sales_tenant_product" ON "public"."mkt_sales" USING "btree" ("tenant_id", "product_id");



CREATE INDEX "idx_mkt_sales_tenant_sold_at" ON "public"."mkt_sales" USING "btree" ("tenant_id", "sold_at");



CREATE INDEX "idx_mkt_suppliers_tenant_id" ON "public"."mkt_suppliers" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_appointments_tenant" ON "public"."muh_appointments" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_beyanname_tenant" ON "public"."muh_beyanname_statuses" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_invoices_tenant" ON "public"."muh_invoices" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_mukellefler_tenant" ON "public"."muh_mukellefler" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_payments_tenant" ON "public"."muh_payments" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_reminders_tenant" ON "public"."muh_reminders" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_tahsilat_reminders_tenant" ON "public"."muh_tahsilat_reminders" USING "btree" ("tenant_id");



CREATE INDEX "idx_muh_tax_rates_tenant" ON "public"."muh_tax_rates" USING "btree" ("tenant_id");



CREATE INDEX "idx_notification_prefs_type_enabled" ON "public"."notification_preferences" USING "btree" ("type", "channel", "enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_notification_prefs_user" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_tenant_user" ON "public"."notifications" USING "btree" ("tenant_id", "user_id");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type", "created_at" DESC);



CREATE INDEX "idx_notifications_user_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_onb_tenant" ON "public"."onboarding_state" USING "btree" ("tenant_id");



CREATE INDEX "idx_otel_guest_hotels_hotel" ON "public"."otel_guest_hotels" USING "btree" ("hotel_id");



CREATE INDEX "idx_otel_guest_hotels_last_visit" ON "public"."otel_guest_hotels" USING "btree" ("last_visit");



CREATE INDEX "idx_otel_guest_messages_hotel" ON "public"."otel_guest_messages" USING "btree" ("hotel_id", "created_at");



CREATE INDEX "idx_otel_guest_messages_tenant" ON "public"."otel_guest_messages" USING "btree" ("tenant_id");



CREATE INDEX "idx_otel_hotels_tenant" ON "public"."otel_hotels" USING "btree" ("tenant_id");



CREATE INDEX "idx_otel_housekeeping_hotel_date" ON "public"."otel_housekeeping_tasks" USING "btree" ("hotel_id", "queue_date");



CREATE INDEX "idx_otel_housekeeping_tasks_assigned" ON "public"."otel_housekeeping_tasks" USING "btree" ("assigned_to") WHERE ("assigned_to" IS NOT NULL);



CREATE INDEX "idx_otel_housekeeping_tenant" ON "public"."otel_housekeeping_tasks" USING "btree" ("tenant_id");



CREATE INDEX "idx_otel_pre_checkins_guest" ON "public"."otel_pre_checkins" USING "btree" ("guest_profile_id");



CREATE INDEX "idx_otel_pre_checkins_hotel" ON "public"."otel_pre_checkins" USING "btree" ("hotel_id");



CREATE INDEX "idx_otel_pre_checkins_rez" ON "public"."otel_pre_checkins" USING "btree" ("reservation_id");



CREATE INDEX "idx_otel_reservations_guest_profile" ON "public"."otel_reservations" USING "btree" ("guest_profile_id") WHERE ("guest_profile_id" IS NOT NULL);



CREATE INDEX "idx_otel_reservations_hotel_dates" ON "public"."otel_reservations" USING "btree" ("hotel_id", "check_in", "check_out");



CREATE INDEX "idx_otel_reservations_status" ON "public"."otel_reservations" USING "btree" ("hotel_id", "status");



CREATE INDEX "idx_otel_reservations_tenant" ON "public"."otel_reservations" USING "btree" ("tenant_id");



CREATE INDEX "idx_otel_rooms_hotel" ON "public"."otel_rooms" USING "btree" ("hotel_id");



CREATE INDEX "idx_otel_rooms_tenant" ON "public"."otel_rooms" USING "btree" ("tenant_id");



CREATE INDEX "idx_otel_user_hotels_user" ON "public"."otel_user_hotels" USING "btree" ("user_id");



CREATE INDEX "idx_payments_dealer" ON "public"."bayi_payments" USING "btree" ("dealer_user_id");



CREATE INDEX "idx_payments_tenant_status" ON "public"."bayi_payments" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_pe_created" ON "public"."platform_events" USING "btree" ("created_at");



CREATE INDEX "idx_pe_tenant" ON "public"."platform_events" USING "btree" ("tenant_key");



CREATE INDEX "idx_pe_type" ON "public"."platform_events" USING "btree" ("event_type");



CREATE INDEX "idx_pe_user" ON "public"."platform_events" USING "btree" ("user_id");



CREATE INDEX "idx_product_visibility_dealer_hidden" ON "public"."bayi_product_visibility" USING "btree" ("dealer_id", "product_id") WHERE ("visible" = false);



CREATE INDEX "idx_product_visibility_product" ON "public"."bayi_product_visibility" USING "btree" ("product_id");



CREATE INDEX "idx_product_visibility_tenant" ON "public"."bayi_product_visibility" USING "btree" ("tenant_id");



CREATE INDEX "idx_profiles_auth_user_id" ON "public"."profiles" USING "btree" ("auth_user_id");



CREATE INDEX "idx_profiles_auth_user_tenant" ON "public"."profiles" USING "btree" ("auth_user_id", "tenant_id");



CREATE INDEX "idx_profiles_capabilities" ON "public"."profiles" USING "gin" ("capabilities");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_is_platform_admin" ON "public"."profiles" USING "btree" ("is_platform_admin") WHERE ("is_platform_admin" = true);



CREATE INDEX "idx_profiles_onboarding_incomplete" ON "public"."profiles" USING "btree" ("tenant_id") WHERE ("onboarding_completed" = false);



CREATE INDEX "idx_profiles_tenant" ON "public"."profiles" USING "btree" ("tenant_id");



CREATE INDEX "idx_profiles_whatsapp" ON "public"."profiles" USING "btree" ("whatsapp_phone");



CREATE INDEX "idx_profiles_whatsapp_phone" ON "public"."profiles" USING "btree" ("whatsapp_phone");



CREATE INDEX "idx_qr_code_status" ON "public"."panel_qr_tokens" USING "btree" ("code", "status");



CREATE INDEX "idx_qr_expires_at" ON "public"."panel_qr_tokens" USING "btree" ("expires_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'claimed'::"text"]));



CREATE INDEX "idx_quotas_period_end" ON "public"."agent_quotas" USING "btree" ("period_end");



CREATE INDEX "idx_quotas_tenant" ON "public"."agent_quotas" USING "btree" ("tenant_id");



CREATE INDEX "idx_quotas_user" ON "public"."agent_quotas" USING "btree" ("user_id");



CREATE INDEX "idx_rec_runs_expires" ON "public"."recommendation_runs" USING "btree" ("expires_at") WHERE ("status" = 'open'::"text");



CREATE INDEX "idx_rec_runs_tenant_rule" ON "public"."recommendation_runs" USING "btree" ("tenant_id", "rule_code", "created_at" DESC);



CREATE INDEX "idx_rec_runs_user_open" ON "public"."recommendation_runs" USING "btree" ("user_id", "status", "score" DESC, "created_at" DESC);



CREATE INDEX "idx_referral_codes_dealer" ON "public"."bayi_referral_codes" USING "btree" ("dealer_user_id");



CREATE INDEX "idx_referral_codes_tenant_active" ON "public"."bayi_referral_codes" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_referrals_referred" ON "public"."bayi_referrals" USING "btree" ("referred_dealer_id");



CREATE INDEX "idx_referrals_referrer" ON "public"."bayi_referrals" USING "btree" ("referrer_dealer_id", "status");



CREATE INDEX "idx_referrals_tenant" ON "public"."bayi_referrals" USING "btree" ("tenant_id", "status", "invited_at" DESC);



CREATE INDEX "idx_rem_due" ON "public"."reminders" USING "btree" ("due_at") WHERE (NOT "sent");



CREATE INDEX "idx_rem_tenant" ON "public"."reminders" USING "btree" ("tenant_id");



CREATE INDEX "idx_rst_b2c_orders_customer_phone" ON "public"."rst_b2c_orders" USING "btree" ("restaurant_id", "customer_phone");



CREATE INDEX "idx_rst_b2c_orders_mollie_payment" ON "public"."rst_b2c_orders" USING "btree" ("mollie_payment_id") WHERE ("mollie_payment_id" IS NOT NULL);



CREATE INDEX "idx_rst_b2c_orders_restaurant_status" ON "public"."rst_b2c_orders" USING "btree" ("restaurant_id", "status", "created_at" DESC);



CREATE INDEX "idx_rst_inventory_tenant_low" ON "public"."rst_inventory" USING "btree" ("tenant_id", "quantity") WHERE ("is_active" = true);



CREATE INDEX "idx_rst_loyalty_birthday" ON "public"."rst_loyalty_members" USING "btree" ("tenant_id", "birthday") WHERE (("is_active" = true) AND ("birthday" IS NOT NULL));



CREATE INDEX "idx_rst_loyalty_tenant_active" ON "public"."rst_loyalty_members" USING "btree" ("tenant_id", "last_visit_at" DESC) WHERE ("is_active" = true);



CREATE INDEX "idx_rst_loyalty_visits_member" ON "public"."rst_loyalty_visits" USING "btree" ("member_id", "created_at" DESC);



CREATE INDEX "idx_rst_menu_addons_item" ON "public"."rst_menu_addons" USING "btree" ("menu_item_id", "order_index");



CREATE INDEX "idx_rst_menu_categories_restaurant_order" ON "public"."rst_menu_categories" USING "btree" ("restaurant_id", "order_index") WHERE ("is_available" = true);



CREATE INDEX "idx_rst_menu_items_restaurant_category" ON "public"."rst_menu_items" USING "btree" ("restaurant_id", "category_id", "order_index") WHERE ("is_active" = true);



CREATE INDEX "idx_rst_menu_tenant_category" ON "public"."rst_menu_items" USING "btree" ("tenant_id", "category") WHERE ("is_active" = true);



CREATE INDEX "idx_rst_menu_variants_item" ON "public"."rst_menu_variants" USING "btree" ("menu_item_id", "order_index");



CREATE INDEX "idx_rst_order_items_order" ON "public"."rst_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_rst_orders_loyalty" ON "public"."rst_orders" USING "btree" ("loyalty_member_id") WHERE ("loyalty_member_id" IS NOT NULL);



CREATE INDEX "idx_rst_orders_table" ON "public"."rst_orders" USING "btree" ("table_id") WHERE ("status" = ANY (ARRAY['new'::"text", 'preparing'::"text", 'ready'::"text", 'served'::"text"]));



CREATE INDEX "idx_rst_orders_tenant_status" ON "public"."rst_orders" USING "btree" ("tenant_id", "status", "created_at" DESC);



CREATE INDEX "idx_rst_reservations_loyalty" ON "public"."rst_reservations" USING "btree" ("loyalty_member_id") WHERE ("loyalty_member_id" IS NOT NULL);



CREATE INDEX "idx_rst_reservations_status" ON "public"."rst_reservations" USING "btree" ("tenant_id", "status", "reserved_at");



CREATE INDEX "idx_rst_reservations_tenant_date" ON "public"."rst_reservations" USING "btree" ("tenant_id", "reserved_at");



CREATE INDEX "idx_rst_restaurants_slug_published" ON "public"."rst_restaurants" USING "btree" ("slug") WHERE ("is_published" = true);



CREATE INDEX "idx_rst_table_calls_restaurant_pending" ON "public"."rst_table_calls" USING "btree" ("restaurant_id", "status", "called_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_rst_tables_tenant_status" ON "public"."rst_tables" USING "btree" ("tenant_id", "status") WHERE ("is_active" = true);



CREATE INDEX "idx_stock_mov_product" ON "public"."bayi_stock_movements" USING "btree" ("product_id", "created_at" DESC);



CREATE INDEX "idx_stock_mov_tenant_product" ON "public"."bayi_stock_movements" USING "btree" ("tenant_id", "product_id", "created_at" DESC);



CREATE INDEX "idx_stock_mov_type" ON "public"."bayi_stock_movements" USING "btree" ("tenant_id", "movement_type", "created_at" DESC);



CREATE INDEX "idx_stock_mov_warehouse" ON "public"."bayi_stock_movements" USING "btree" ("warehouse_id", "created_at" DESC);



CREATE INDEX "idx_stock_reservations_expires" ON "public"."bayi_stock_reservations" USING "btree" ("expires_at") WHERE (("status" = 'active'::"text") AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_stock_reservations_order" ON "public"."bayi_stock_reservations" USING "btree" ("order_id");



CREATE INDEX "idx_stock_reservations_product_active" ON "public"."bayi_stock_reservations" USING "btree" ("product_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_stock_reservations_tenant" ON "public"."bayi_stock_reservations" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_subs_provider_sub" ON "public"."subscriptions" USING "btree" ("provider_subscription_id") WHERE ("provider_subscription_id" IS NOT NULL);



CREATE INDEX "idx_subs_status" ON "public"."subscriptions" USING "btree" ("status", "current_period_end");



CREATE INDEX "idx_subs_tenant" ON "public"."subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_subs_trial" ON "public"."subscriptions" USING "btree" ("plan", "trial_ends_at") WHERE ("plan" = 'trial'::"text");



CREATE INDEX "idx_subs_user" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_support_messages_ticket" ON "public"."support_messages" USING "btree" ("ticket_id", "created_at");



CREATE INDEX "idx_support_tickets_status" ON "public"."support_tickets" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_support_tickets_user" ON "public"."support_tickets" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_tenant_integration_settings_active" ON "public"."tenant_integration_settings" USING "btree" ("tenant_id", "provider") WHERE ("is_active" = true);



CREATE INDEX "idx_tenant_integration_settings_tenant" ON "public"."tenant_integration_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenants_is_demo" ON "public"."tenants" USING "btree" ("is_demo") WHERE ("is_demo" = true);



CREATE INDEX "idx_tenants_saas_type" ON "public"."tenants" USING "btree" ("saas_type");



CREATE INDEX "idx_tenants_slug" ON "public"."tenants" USING "btree" ("slug");



CREATE INDEX "idx_tracking_active" ON "public"."emlak_tracking_criteria" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "idx_tracking_user" ON "public"."emlak_tracking_criteria" USING "btree" ("user_id");



CREATE INDEX "idx_tracking_user_created" ON "public"."emlak_tracking_criteria" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_uep_employee" ON "public"."user_employee_progress" USING "btree" ("employee_key");



CREATE INDEX "idx_uep_user" ON "public"."user_employee_progress" USING "btree" ("user_id");



CREATE INDEX "idx_user_inv_status" ON "public"."user_invitations" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_user_inv_tenant_phone" ON "public"."user_invitations" USING "btree" ("tenant_id", "invitee_phone");



CREATE INDEX "idx_user_inv_token" ON "public"."user_invitations" USING "btree" ("invite_token");



CREATE INDEX "idx_user_quest_state_user" ON "public"."user_quest_state" USING "btree" ("user_id");



CREATE INDEX "idx_user_tips_user_key" ON "public"."user_tips_shown" USING "btree" ("user_id", "tip_key");



CREATE INDEX "idx_user_tips_user_shown" ON "public"."user_tips_shown" USING "btree" ("user_id", "shown_at" DESC);



CREATE INDEX "idx_uts_user" ON "public"."user_test_snapshots" USING "btree" ("user_id");



CREATE INDEX "idx_xpe_created" ON "public"."xp_events" USING "btree" ("created_at");



CREATE INDEX "idx_xpe_user" ON "public"."xp_events" USING "btree" ("user_id");



CREATE INDEX "otp_codes_ip_recent_idx" ON "public"."otp_codes" USING "btree" ("ip_address", "created_at" DESC) WHERE ("ip_address" IS NOT NULL);



CREATE INDEX "otp_codes_phone_purpose_active_idx" ON "public"."otp_codes" USING "btree" ("phone", "purpose", "expires_at" DESC) WHERE ("verified_at" IS NULL);



CREATE INDEX "otp_codes_phone_recent_idx" ON "public"."otp_codes" USING "btree" ("phone", "created_at" DESC);



CREATE INDEX "profiles_google_email_idx" ON "public"."profiles" USING "btree" ("lower"("google_email")) WHERE ("google_email" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_google_sub_unique" ON "public"."profiles" USING "btree" ("google_sub") WHERE ("google_sub" IS NOT NULL);



CREATE INDEX "step_up_challenges_profile_active_idx" ON "public"."step_up_challenges" USING "btree" ("profile_id", "expires_at") WHERE ("verified_at" IS NULL);



CREATE INDEX "step_up_challenges_profile_recent_idx" ON "public"."step_up_challenges" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "sy_announcement_reads_user_idx" ON "public"."sy_announcement_reads" USING "btree" ("user_id");



CREATE INDEX "sy_announcements_building_idx" ON "public"."sy_announcements" USING "btree" ("building_id", "created_at" DESC);



CREATE INDEX "sy_announcements_scheduled_idx" ON "public"."sy_announcements" USING "btree" ("scheduled_for") WHERE ("scheduled_for" IS NOT NULL);



CREATE INDEX "sy_announcements_tenant_idx" ON "public"."sy_announcements" USING "btree" ("tenant_id");



CREATE INDEX "sy_budget_categories_building_year_idx" ON "public"."sy_budget_categories" USING "btree" ("building_id", "year");



CREATE INDEX "sy_maintenance_schedule_building_idx" ON "public"."sy_maintenance_schedule" USING "btree" ("building_id");



CREATE INDEX "sy_maintenance_schedule_due_idx" ON "public"."sy_maintenance_schedule" USING "btree" ("next_due_at");



CREATE INDEX "sy_maintenance_schedule_status_idx" ON "public"."sy_maintenance_schedule" USING "btree" ("status");



CREATE INDEX "sy_meeting_decisions_meeting_idx" ON "public"."sy_meeting_decisions" USING "btree" ("meeting_id");



CREATE INDEX "sy_meetings_building_idx" ON "public"."sy_meetings" USING "btree" ("building_id", "scheduled_at" DESC);



CREATE INDEX "sy_meetings_status_idx" ON "public"."sy_meetings" USING "btree" ("status");



CREATE INDEX "sy_personnel_active_idx" ON "public"."sy_personnel" USING "btree" ("building_id") WHERE ("is_active" = true);



CREATE INDEX "sy_personnel_building_idx" ON "public"."sy_personnel" USING "btree" ("building_id");



CREATE INDEX "sy_personnel_contract_end_idx" ON "public"."sy_personnel" USING "btree" ("contract_end") WHERE ("contract_end" IS NOT NULL);



CREATE INDEX "sy_suppliers_active_idx" ON "public"."sy_suppliers" USING "btree" ("building_id") WHERE ("is_active" = true);



CREATE INDEX "sy_suppliers_building_idx" ON "public"."sy_suppliers" USING "btree" ("building_id");



CREATE INDEX "sy_suppliers_contract_end_idx" ON "public"."sy_suppliers" USING "btree" ("contract_end") WHERE ("contract_end" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_dist_slugs_user" ON "public"."distributor_slugs" USING "btree" ("distributor_user_id", "tenant_id");



CREATE UNIQUE INDEX "uniq_profiles_whatsapp_phone_global" ON "public"."profiles" USING "btree" ("whatsapp_phone") WHERE ("whatsapp_phone" IS NOT NULL);



CREATE UNIQUE INDEX "uq_bayi_carts_open_per_user" ON "public"."bayi_carts" USING "btree" ("user_id") WHERE ("status" = 'open'::"text");



CREATE OR REPLACE TRIGGER "subs_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "support_tickets_updated_at" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_agent_tasks_updated_at" BEFORE UPDATE ON "public"."agent_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contracts_agent" AFTER INSERT OR UPDATE ON "public"."contracts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_agent_event"();



CREATE OR REPLACE TRIGGER "trg_customers_agent" AFTER INSERT ON "public"."emlak_customers" FOR EACH ROW EXECUTE FUNCTION "public"."notify_agent_event"();



CREATE OR REPLACE TRIGGER "trg_notification_prefs_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."touch_notification_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_is_platform_admin" BEFORE INSERT OR UPDATE OF "role", "tenant_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_set_is_platform_admin"();



CREATE OR REPLACE TRIGGER "trg_properties_agent" AFTER INSERT ON "public"."emlak_properties" FOR EACH ROW EXECUTE FUNCTION "public"."notify_agent_event"();



CREATE OR REPLACE TRIGGER "trg_reminders_agent" AFTER INSERT ON "public"."reminders" FOR EACH ROW EXECUTE FUNCTION "public"."notify_agent_event"();



CREATE OR REPLACE TRIGGER "trg_rst_b2c_orders_updated_at" BEFORE UPDATE ON "public"."rst_b2c_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_rst_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rst_menu_categories_updated_at" BEFORE UPDATE ON "public"."rst_menu_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_rst_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rst_restaurants_updated_at" BEFORE UPDATE ON "public"."rst_restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."update_rst_updated_at"();



ALTER TABLE ONLY "public"."admin_test_identities"
    ADD CONSTRAINT "admin_test_identities_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_messages"
    ADD CONSTRAINT "agent_messages_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id");



ALTER TABLE ONLY "public"."agent_profiles"
    ADD CONSTRAINT "agent_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_quotas"
    ADD CONSTRAINT "agent_quotas_plan_key_fkey" FOREIGN KEY ("plan_key") REFERENCES "public"."agent_plans"("key");



ALTER TABLE ONLY "public"."agent_quotas"
    ADD CONSTRAINT "agent_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_usage_events"
    ADD CONSTRAINT "agent_usage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_campaign_executions"
    ADD CONSTRAINT "bayi_campaign_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaign_executions"
    ADD CONSTRAINT "bayi_campaign_executions_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "public"."bayi_campaign_triggers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaign_rules"
    ADD CONSTRAINT "bayi_campaign_rules_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bayi_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaign_rules"
    ADD CONSTRAINT "bayi_campaign_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaign_targets"
    ADD CONSTRAINT "bayi_campaign_targets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bayi_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaign_targets"
    ADD CONSTRAINT "bayi_campaign_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaign_triggers"
    ADD CONSTRAINT "bayi_campaign_triggers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_campaigns"
    ADD CONSTRAINT "bayi_campaigns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_campaigns"
    ADD CONSTRAINT "bayi_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_cart_items"
    ADD CONSTRAINT "bayi_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."bayi_carts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_cart_items"
    ADD CONSTRAINT "bayi_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_cart_items"
    ADD CONSTRAINT "bayi_cart_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_carts"
    ADD CONSTRAINT "bayi_carts_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_carts"
    ADD CONSTRAINT "bayi_carts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_categories"
    ADD CONSTRAINT "bayi_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."bayi_categories"("id");



ALTER TABLE ONLY "public"."bayi_categories"
    ADD CONSTRAINT "bayi_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_collection_activities"
    ADD CONSTRAINT "bayi_collection_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_collection_activities"
    ADD CONSTRAINT "bayi_collection_activities_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id");



ALTER TABLE ONLY "public"."bayi_collection_activities"
    ADD CONSTRAINT "bayi_collection_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_companies"
    ADD CONSTRAINT "bayi_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_credit_limit_audit"
    ADD CONSTRAINT "bayi_credit_limit_audit_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_credit_limit_audit"
    ADD CONSTRAINT "bayi_credit_limit_audit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_credit_movements"
    ADD CONSTRAINT "bayi_credit_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_cross_sell_pairs"
    ADD CONSTRAINT "bayi_cross_sell_pairs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_credits"
    ADD CONSTRAINT "bayi_dealer_credits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_invoices"
    ADD CONSTRAINT "bayi_dealer_invoices_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id");



ALTER TABLE ONLY "public"."bayi_dealer_invoices"
    ADD CONSTRAINT "bayi_dealer_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_order_items"
    ADD CONSTRAINT "bayi_dealer_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_dealer_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_order_status_history"
    ADD CONSTRAINT "bayi_dealer_order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_dealer_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_orders"
    ADD CONSTRAINT "bayi_dealer_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_price_assignments"
    ADD CONSTRAINT "bayi_dealer_price_assignments_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_price_assignments"
    ADD CONSTRAINT "bayi_dealer_price_assignments_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."bayi_price_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_price_assignments"
    ADD CONSTRAINT "bayi_dealer_price_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_scores"
    ADD CONSTRAINT "bayi_dealer_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_transactions"
    ADD CONSTRAINT "bayi_dealer_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_dealer_transactions"
    ADD CONSTRAINT "bayi_dealer_transactions_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id");



ALTER TABLE ONLY "public"."bayi_dealer_transactions"
    ADD CONSTRAINT "bayi_dealer_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_orders"("id");



ALTER TABLE ONLY "public"."bayi_dealer_transactions"
    ADD CONSTRAINT "bayi_dealer_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealer_transactions"
    ADD CONSTRAINT "bayi_dealer_transactions_transaction_type_id_fkey" FOREIGN KEY ("transaction_type_id") REFERENCES "public"."bayi_transaction_types"("id");



ALTER TABLE ONLY "public"."bayi_dealer_visits"
    ADD CONSTRAINT "bayi_dealer_visits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_dealer_visits"
    ADD CONSTRAINT "bayi_dealer_visits_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id");



ALTER TABLE ONLY "public"."bayi_dealer_visits"
    ADD CONSTRAINT "bayi_dealer_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_dealers"
    ADD CONSTRAINT "bayi_dealers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_dealers"
    ADD CONSTRAINT "bayi_dealers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_drip_campaigns"
    ADD CONSTRAINT "bayi_drip_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_drip_enrollments"
    ADD CONSTRAINT "bayi_drip_enrollments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bayi_drip_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_drip_sends"
    ADD CONSTRAINT "bayi_drip_sends_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."bayi_drip_enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_drip_sends"
    ADD CONSTRAINT "bayi_drip_sends_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."bayi_drip_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_drip_steps"
    ADD CONSTRAINT "bayi_drip_steps_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bayi_drip_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_favorites"
    ADD CONSTRAINT "bayi_favorites_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_favorites"
    ADD CONSTRAINT "bayi_favorites_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_favorites"
    ADD CONSTRAINT "bayi_favorites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_invite_links"
    ADD CONSTRAINT "bayi_invite_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_invoices"
    ADD CONSTRAINT "bayi_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_leads"
    ADD CONSTRAINT "bayi_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_leads"
    ADD CONSTRAINT "bayi_leads_vitrine_id_fkey" FOREIGN KEY ("vitrine_id") REFERENCES "public"."bayi_vitrines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_order_items"
    ADD CONSTRAINT "bayi_order_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."bayi_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_order_items"
    ADD CONSTRAINT "bayi_order_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_order_items"
    ADD CONSTRAINT "bayi_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_orders"("id");



ALTER TABLE ONLY "public"."bayi_order_items"
    ADD CONSTRAINT "bayi_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id");



ALTER TABLE ONLY "public"."bayi_order_items"
    ADD CONSTRAINT "bayi_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_order_status_history"
    ADD CONSTRAINT "bayi_order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_order_status_history"
    ADD CONSTRAINT "bayi_order_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_orders"
    ADD CONSTRAINT "bayi_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_orders"
    ADD CONSTRAINT "bayi_orders_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id");



ALTER TABLE ONLY "public"."bayi_orders"
    ADD CONSTRAINT "bayi_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."bayi_invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_orders"
    ADD CONSTRAINT "bayi_orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."bayi_order_statuses"("id");



ALTER TABLE ONLY "public"."bayi_orders"
    ADD CONSTRAINT "bayi_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_payments"
    ADD CONSTRAINT "bayi_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_payments"
    ADD CONSTRAINT "bayi_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_price_list_items"
    ADD CONSTRAINT "bayi_price_list_items_price_list_id_fkey" FOREIGN KEY ("price_list_id") REFERENCES "public"."bayi_price_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_price_list_items"
    ADD CONSTRAINT "bayi_price_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_price_list_items"
    ADD CONSTRAINT "bayi_price_list_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_price_lists"
    ADD CONSTRAINT "bayi_price_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_price_tiers"
    ADD CONSTRAINT "bayi_price_tiers_price_list_item_id_fkey" FOREIGN KEY ("price_list_item_id") REFERENCES "public"."bayi_price_list_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_price_tiers"
    ADD CONSTRAINT "bayi_price_tiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_product_visibility"
    ADD CONSTRAINT "bayi_product_visibility_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_product_visibility"
    ADD CONSTRAINT "bayi_product_visibility_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_product_visibility"
    ADD CONSTRAINT "bayi_product_visibility_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_products"
    ADD CONSTRAINT "bayi_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_products"
    ADD CONSTRAINT "bayi_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_purchase_order_lines"
    ADD CONSTRAINT "bayi_purchase_order_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."bayi_purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_purchase_order_lines"
    ADD CONSTRAINT "bayi_purchase_order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_purchase_order_lines"
    ADD CONSTRAINT "bayi_purchase_order_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_purchase_orders"
    ADD CONSTRAINT "bayi_purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_purchase_orders"
    ADD CONSTRAINT "bayi_purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."bayi_suppliers"("id");



ALTER TABLE ONLY "public"."bayi_purchase_orders"
    ADD CONSTRAINT "bayi_purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_referral_codes"
    ADD CONSTRAINT "bayi_referral_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_referrals"
    ADD CONSTRAINT "bayi_referrals_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "public"."bayi_referral_codes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_referrals"
    ADD CONSTRAINT "bayi_referrals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_sales_rep_dealers"
    ADD CONSTRAINT "bayi_sales_rep_dealers_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_sales_rep_dealers"
    ADD CONSTRAINT "bayi_sales_rep_dealers_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."bayi_sales_reps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_sales_rep_dealers"
    ADD CONSTRAINT "bayi_sales_rep_dealers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_sales_reps"
    ADD CONSTRAINT "bayi_sales_reps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_sales_targets"
    ADD CONSTRAINT "bayi_sales_targets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_sales_targets"
    ADD CONSTRAINT "bayi_sales_targets_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id");



ALTER TABLE ONLY "public"."bayi_sales_targets"
    ADD CONSTRAINT "bayi_sales_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_movements"
    ADD CONSTRAINT "bayi_stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_reservations"
    ADD CONSTRAINT "bayi_stock_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_dealer_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_reservations"
    ADD CONSTRAINT "bayi_stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_reservations"
    ADD CONSTRAINT "bayi_stock_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_transfers"
    ADD CONSTRAINT "bayi_stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."bayi_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_transfers"
    ADD CONSTRAINT "bayi_stock_transfers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_transfers"
    ADD CONSTRAINT "bayi_stock_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stock_transfers"
    ADD CONSTRAINT "bayi_stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."bayi_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stocktake_items"
    ADD CONSTRAINT "bayi_stocktake_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stocktake_items"
    ADD CONSTRAINT "bayi_stocktake_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."bayi_stocktake_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stocktake_items"
    ADD CONSTRAINT "bayi_stocktake_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stocktake_sessions"
    ADD CONSTRAINT "bayi_stocktake_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_stocktake_sessions"
    ADD CONSTRAINT "bayi_stocktake_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."bayi_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_supplier_payments"
    ADD CONSTRAINT "bayi_supplier_payments_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."bayi_purchase_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_supplier_payments"
    ADD CONSTRAINT "bayi_supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."bayi_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_supplier_payments"
    ADD CONSTRAINT "bayi_supplier_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_suppliers"
    ADD CONSTRAINT "bayi_suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."bayi_companies"("id");



ALTER TABLE ONLY "public"."bayi_suppliers"
    ADD CONSTRAINT "bayi_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visit_orders"
    ADD CONSTRAINT "bayi_visit_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."bayi_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visit_orders"
    ADD CONSTRAINT "bayi_visit_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visit_orders"
    ADD CONSTRAINT "bayi_visit_orders_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."bayi_visits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visit_plans"
    ADD CONSTRAINT "bayi_visit_plans_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visit_plans"
    ADD CONSTRAINT "bayi_visit_plans_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."bayi_sales_reps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visit_plans"
    ADD CONSTRAINT "bayi_visit_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visits"
    ADD CONSTRAINT "bayi_visits_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "public"."bayi_dealers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visits"
    ADD CONSTRAINT "bayi_visits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."bayi_visit_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bayi_visits"
    ADD CONSTRAINT "bayi_visits_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."bayi_sales_reps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_visits"
    ADD CONSTRAINT "bayi_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_vitrines"
    ADD CONSTRAINT "bayi_vitrines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_warehouse_stock"
    ADD CONSTRAINT "bayi_warehouse_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."bayi_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_warehouse_stock"
    ADD CONSTRAINT "bayi_warehouse_stock_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_warehouse_stock"
    ADD CONSTRAINT "bayi_warehouse_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."bayi_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bayi_warehouses"
    ADD CONSTRAINT "bayi_warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bot_activity"
    ADD CONSTRAINT "bot_activity_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bot_activity"
    ADD CONSTRAINT "bot_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."command_sessions"
    ADD CONSTRAINT "command_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."command_sessions"
    ADD CONSTRAINT "command_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dealer_invitations"
    ADD CONSTRAINT "dealer_invitations_distributor_tenant_id_fkey" FOREIGN KEY ("distributor_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."distributor_slugs"
    ADD CONSTRAINT "distributor_slugs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_calendar_events"
    ADD CONSTRAINT "emlak_calendar_events_related_customer_id_fkey" FOREIGN KEY ("related_customer_id") REFERENCES "public"."emlak_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emlak_calendar_events"
    ADD CONSTRAINT "emlak_calendar_events_related_property_id_fkey" FOREIGN KEY ("related_property_id") REFERENCES "public"."emlak_properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emlak_calendar_events"
    ADD CONSTRAINT "emlak_calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_customer_contacts"
    ADD CONSTRAINT "emlak_customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."emlak_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_customers"
    ADD CONSTRAINT "emlak_customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_customers"
    ADD CONSTRAINT "emlak_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emlak_lead_calls"
    ADD CONSTRAINT "emlak_lead_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_monitoring_criteria"
    ADD CONSTRAINT "emlak_monitoring_criteria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_monitoring_criteria"
    ADD CONSTRAINT "emlak_monitoring_criteria_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emlak_presentations"
    ADD CONSTRAINT "emlak_presentations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."emlak_customers"("id");



ALTER TABLE ONLY "public"."emlak_properties"
    ADD CONSTRAINT "emlak_properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_properties"
    ADD CONSTRAINT "emlak_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."emlak_property_photos"
    ADD CONSTRAINT "emlak_property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."emlak_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_property_photos"
    ADD CONSTRAINT "emlak_property_photos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_publishing_history"
    ADD CONSTRAINT "emlak_publishing_history_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."emlak_properties"("id");



ALTER TABLE ONLY "public"."emlak_publishing_history"
    ADD CONSTRAINT "emlak_publishing_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emlak_tracking_criteria"
    ADD CONSTRAINT "emlak_tracking_criteria_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_employees"
    ADD CONSTRAINT "hotel_employees_hotel_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hotel_employees"
    ADD CONSTRAINT "hotel_employees_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_codes"
    ADD CONSTRAINT "invite_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invite_links"
    ADD CONSTRAINT "invite_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invite_links"
    ADD CONSTRAINT "invite_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magic_link_tokens"
    ADD CONSTRAINT "magic_link_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mkt_campaigns"
    ADD CONSTRAINT "mkt_campaigns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."mkt_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_campaigns"
    ADD CONSTRAINT "mkt_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_order_items"
    ADD CONSTRAINT "mkt_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."mkt_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_order_items"
    ADD CONSTRAINT "mkt_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."mkt_products"("id");



ALTER TABLE ONLY "public"."mkt_order_items"
    ADD CONSTRAINT "mkt_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_orders"
    ADD CONSTRAINT "mkt_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."mkt_suppliers"("id");



ALTER TABLE ONLY "public"."mkt_orders"
    ADD CONSTRAINT "mkt_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_products"
    ADD CONSTRAINT "mkt_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_sales"
    ADD CONSTRAINT "mkt_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."mkt_products"("id");



ALTER TABLE ONLY "public"."mkt_sales"
    ADD CONSTRAINT "mkt_sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mkt_suppliers"
    ADD CONSTRAINT "mkt_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_appointments"
    ADD CONSTRAINT "muh_appointments_mukellef_id_fkey" FOREIGN KEY ("mukellef_id") REFERENCES "public"."muh_mukellefler"("id");



ALTER TABLE ONLY "public"."muh_appointments"
    ADD CONSTRAINT "muh_appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_beyanname_statuses"
    ADD CONSTRAINT "muh_beyanname_statuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_invoices"
    ADD CONSTRAINT "muh_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_mukellefler"
    ADD CONSTRAINT "muh_mukellefler_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_payments"
    ADD CONSTRAINT "muh_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."muh_invoices"("id");



ALTER TABLE ONLY "public"."muh_payments"
    ADD CONSTRAINT "muh_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_reminders"
    ADD CONSTRAINT "muh_reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."muh_tahsilat_reminders"
    ADD CONSTRAINT "muh_tahsilat_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."muh_invoices"("id");



ALTER TABLE ONLY "public"."muh_tahsilat_reminders"
    ADD CONSTRAINT "muh_tahsilat_reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_state"
    ADD CONSTRAINT "onboarding_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_guest_hotels"
    ADD CONSTRAINT "otel_guest_hotels_hotel_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_guest_hotels"
    ADD CONSTRAINT "otel_guest_hotels_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_guest_messages"
    ADD CONSTRAINT "otel_guest_messages_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_guest_messages"
    ADD CONSTRAINT "otel_guest_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_hotels"
    ADD CONSTRAINT "otel_hotels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_housekeeping_tasks"
    ADD CONSTRAINT "otel_housekeeping_tasks_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_housekeeping_tasks"
    ADD CONSTRAINT "otel_housekeeping_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."otel_rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otel_housekeeping_tasks"
    ADD CONSTRAINT "otel_housekeeping_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_pre_checkins"
    ADD CONSTRAINT "otel_pre_checkins_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otel_pre_checkins"
    ADD CONSTRAINT "otel_pre_checkins_hotel_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_pre_checkins"
    ADD CONSTRAINT "otel_pre_checkins_rez_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."otel_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_reservations"
    ADD CONSTRAINT "otel_reservations_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otel_reservations"
    ADD CONSTRAINT "otel_reservations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_reservations"
    ADD CONSTRAINT "otel_reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."otel_rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otel_reservations"
    ADD CONSTRAINT "otel_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_rooms"
    ADD CONSTRAINT "otel_rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_rooms"
    ADD CONSTRAINT "otel_rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_user_hotels"
    ADD CONSTRAINT "otel_user_hotels_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "public"."otel_hotels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_user_hotels"
    ADD CONSTRAINT "otel_user_hotels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otel_user_hotels"
    ADD CONSTRAINT "otel_user_hotels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."panel_qr_tokens"
    ADD CONSTRAINT "panel_qr_tokens_claimed_user_id_fkey" FOREIGN KEY ("claimed_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommendation_runs"
    ADD CONSTRAINT "recommendation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_b2c_orders"
    ADD CONSTRAINT "rst_b2c_orders_loyalty_member_id_fkey" FOREIGN KEY ("loyalty_member_id") REFERENCES "public"."rst_loyalty_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_b2c_orders"
    ADD CONSTRAINT "rst_b2c_orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."rst_restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_b2c_orders"
    ADD CONSTRAINT "rst_b2c_orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."rst_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_b2c_orders"
    ADD CONSTRAINT "rst_b2c_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_inventory"
    ADD CONSTRAINT "rst_inventory_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_loyalty_members"
    ADD CONSTRAINT "rst_loyalty_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_loyalty_visits"
    ADD CONSTRAINT "rst_loyalty_visits_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."rst_loyalty_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_loyalty_visits"
    ADD CONSTRAINT "rst_loyalty_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_menu_addons"
    ADD CONSTRAINT "rst_menu_addons_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."rst_menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_menu_categories"
    ADD CONSTRAINT "rst_menu_categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."rst_restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_menu_categories"
    ADD CONSTRAINT "rst_menu_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_menu_items"
    ADD CONSTRAINT "rst_menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."rst_menu_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_menu_items"
    ADD CONSTRAINT "rst_menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."rst_restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_menu_items"
    ADD CONSTRAINT "rst_menu_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_menu_variants"
    ADD CONSTRAINT "rst_menu_variants_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."rst_menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_order_items"
    ADD CONSTRAINT "rst_order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."rst_menu_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_order_items"
    ADD CONSTRAINT "rst_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."rst_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_order_items"
    ADD CONSTRAINT "rst_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_orders"
    ADD CONSTRAINT "rst_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_orders"
    ADD CONSTRAINT "rst_orders_loyalty_member_id_fkey" FOREIGN KEY ("loyalty_member_id") REFERENCES "public"."rst_loyalty_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_orders"
    ADD CONSTRAINT "rst_orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."rst_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_orders"
    ADD CONSTRAINT "rst_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_reservations"
    ADD CONSTRAINT "rst_reservations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_reservations"
    ADD CONSTRAINT "rst_reservations_loyalty_member_id_fkey" FOREIGN KEY ("loyalty_member_id") REFERENCES "public"."rst_loyalty_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_reservations"
    ADD CONSTRAINT "rst_reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."rst_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_reservations"
    ADD CONSTRAINT "rst_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_restaurants"
    ADD CONSTRAINT "rst_restaurants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_restaurants"
    ADD CONSTRAINT "rst_restaurants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_table_calls"
    ADD CONSTRAINT "rst_table_calls_ack_by_fkey" FOREIGN KEY ("ack_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rst_table_calls"
    ADD CONSTRAINT "rst_table_calls_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."rst_restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_table_calls"
    ADD CONSTRAINT "rst_table_calls_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."rst_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_table_calls"
    ADD CONSTRAINT "rst_table_calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_tables"
    ADD CONSTRAINT "rst_tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."rst_restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rst_tables"
    ADD CONSTRAINT "rst_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saas_phone_registry"
    ADD CONSTRAINT "saas_phone_registry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_up_challenges"
    ADD CONSTRAINT "step_up_challenges_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_announcement_reads"
    ADD CONSTRAINT "sy_announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."sy_announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_announcements"
    ADD CONSTRAINT "sy_announcements_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_announcements"
    ADD CONSTRAINT "sy_announcements_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sy_budget_categories"
    ADD CONSTRAINT "sy_budget_categories_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_buildings"
    ADD CONSTRAINT "sy_buildings_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sy_buildings"
    ADD CONSTRAINT "sy_buildings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_dues_ledger"
    ADD CONSTRAINT "sy_dues_ledger_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_dues_ledger"
    ADD CONSTRAINT "sy_dues_ledger_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."sy_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_income_expenses"
    ADD CONSTRAINT "sy_income_expenses_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_maintenance_schedule"
    ADD CONSTRAINT "sy_maintenance_schedule_assigned_supplier_id_fkey" FOREIGN KEY ("assigned_supplier_id") REFERENCES "public"."sy_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sy_maintenance_schedule"
    ADD CONSTRAINT "sy_maintenance_schedule_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_maintenance_tickets"
    ADD CONSTRAINT "sy_maintenance_tickets_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_maintenance_tickets"
    ADD CONSTRAINT "sy_maintenance_tickets_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sy_maintenance_tickets"
    ADD CONSTRAINT "sy_maintenance_tickets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."sy_units"("id");



ALTER TABLE ONLY "public"."sy_meeting_decisions"
    ADD CONSTRAINT "sy_meeting_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."sy_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_meetings"
    ADD CONSTRAINT "sy_meetings_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_personnel"
    ADD CONSTRAINT "sy_personnel_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_residents"
    ADD CONSTRAINT "sy_residents_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_residents"
    ADD CONSTRAINT "sy_residents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."sy_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_suppliers"
    ADD CONSTRAINT "sy_suppliers_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_units"
    ADD CONSTRAINT "sy_units_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_user_residents"
    ADD CONSTRAINT "sy_user_residents_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."sy_buildings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_user_residents"
    ADD CONSTRAINT "sy_user_residents_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "public"."sy_residents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sy_user_residents"
    ADD CONSTRAINT "sy_user_residents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_integration_settings"
    ADD CONSTRAINT "tenant_integration_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_mission_progress"
    ADD CONSTRAINT "user_mission_progress_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."platform_missions"("id");



ALTER TABLE ONLY "public"."user_quest_state"
    ADD CONSTRAINT "user_quest_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."agent_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_events_deny_anon" ON "public"."agent_events" USING (("auth"."role"() <> 'anon'::"text"));



CREATE POLICY "agent_events_service_all" ON "public"."agent_events" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_learnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_messages_deny_anon" ON "public"."agent_messages" USING (("auth"."role"() <> 'anon'::"text"));



CREATE POLICY "agent_messages_service_all" ON "public"."agent_messages" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_quotas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_tasks_deny_anon" ON "public"."agent_tasks" USING (("auth"."role"() <> 'anon'::"text"));



CREATE POLICY "agent_tasks_service_all" ON "public"."agent_tasks" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_campaign_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_campaign_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_campaign_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_campaign_triggers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_carts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_collection_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_credit_limit_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_credit_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_cross_sell_pairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_price_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealer_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_dealers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_drip_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_drip_enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_invite_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bayi_leads_anon_insert" ON "public"."bayi_leads" FOR INSERT WITH CHECK (true);



CREATE POLICY "bayi_leads_owner_read" ON "public"."bayi_leads" FOR SELECT USING (("dealer_user_id" IN ( SELECT "p"."id"
   FROM "public"."profiles" "p"
  WHERE ("p"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."bayi_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_price_list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_price_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_price_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_product_visibility" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_purchase_order_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_referral_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_sales_rep_dealers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_sales_reps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_sales_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_stock_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_stock_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_stocktake_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_stocktake_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_supplier_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_visit_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_visit_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_vitrines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bayi_vitrines_public_read" ON "public"."bayi_vitrines" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."bayi_warehouse_stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bayi_warehouses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_contact_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_monitoring_criteria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_presentations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_property_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emlak_publishing_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hotel_employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hotel_employees_modify" ON "public"."hotel_employees" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ('*'::"text" = ANY ("p"."capabilities")) AND (EXISTS ( SELECT 1
           FROM "public"."otel_user_hotels" "ouh"
          WHERE (("ouh"."user_id" = "p"."id") AND ("ouh"."hotel_id" = "hotel_employees"."hotel_id")))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ('*'::"text" = ANY ("p"."capabilities")) AND (EXISTS ( SELECT 1
           FROM "public"."otel_user_hotels" "ouh"
          WHERE (("ouh"."user_id" = "p"."id") AND ("ouh"."hotel_id" = "hotel_employees"."hotel_id"))))))));



CREATE POLICY "hotel_employees_select" ON "public"."hotel_employees" FOR SELECT USING ((("profile_id" = "auth"."uid"()) OR "public"."otel_user_can_see_hotel"("hotel_id")));



ALTER TABLE "public"."mkt_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mkt_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mkt_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mkt_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mkt_sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mkt_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_beyanname_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_mukellefler" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."muh_tahsilat_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otel_guest_hotels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otel_guest_hotels_select" ON "public"."otel_guest_hotels" FOR SELECT USING ((("profile_id" = "auth"."uid"()) OR "public"."otel_user_can_see_hotel"("hotel_id")));



ALTER TABLE "public"."otel_guest_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otel_hotels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otel_housekeeping_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otel_housekeeping_tasks_modify" ON "public"."otel_housekeeping_tasks" USING ("public"."otel_user_can_see_hotel"("hotel_id")) WITH CHECK ("public"."otel_user_can_see_hotel"("hotel_id"));



CREATE POLICY "otel_housekeeping_tasks_select" ON "public"."otel_housekeeping_tasks" FOR SELECT USING ("public"."otel_user_can_see_hotel"("hotel_id"));



ALTER TABLE "public"."otel_pre_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otel_pre_checkins_modify" ON "public"."otel_pre_checkins" USING (("public"."otel_user_can_see_hotel"("hotel_id") OR ("guest_profile_id" = "auth"."uid"()))) WITH CHECK (("public"."otel_user_can_see_hotel"("hotel_id") OR ("guest_profile_id" = "auth"."uid"())));



CREATE POLICY "otel_pre_checkins_select" ON "public"."otel_pre_checkins" FOR SELECT USING (("public"."otel_user_can_see_hotel"("hotel_id") OR ("guest_profile_id" = "auth"."uid"())));



ALTER TABLE "public"."otel_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otel_reservations_modify" ON "public"."otel_reservations" USING ("public"."otel_user_can_see_hotel"("hotel_id")) WITH CHECK ("public"."otel_user_can_see_hotel"("hotel_id"));



CREATE POLICY "otel_reservations_select" ON "public"."otel_reservations" FOR SELECT USING (("public"."otel_user_can_see_hotel"("hotel_id") OR ("guest_profile_id" = "auth"."uid"())));



ALTER TABLE "public"."otel_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otel_user_hotels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otp_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_onboarding" ON "public"."onboarding_state" TO "authenticated" USING (("user_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("user_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "own_profile_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("auth_user_id" = "auth"."uid"())));



CREATE POLICY "own_profile_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("auth_user_id" = "auth"."uid"()))) WITH CHECK ((("id" = "auth"."uid"()) OR ("auth_user_id" = "auth"."uid"())));



CREATE POLICY "p_rst_b2c_orders_anon_insert" ON "public"."rst_b2c_orders" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rst_restaurants" "r"
  WHERE (("r"."id" = "rst_b2c_orders"."restaurant_id") AND ("r"."is_published" = true)))));



CREATE POLICY "p_rst_b2c_orders_public_read_by_id" ON "public"."rst_b2c_orders" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "p_rst_menu_addons_public_read" ON "public"."rst_menu_addons" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."rst_menu_items" "i"
     JOIN "public"."rst_restaurants" "r" ON (("r"."id" = "i"."restaurant_id")))
  WHERE (("i"."id" = "rst_menu_addons"."menu_item_id") AND ("r"."is_published" = true)))));



CREATE POLICY "p_rst_menu_categories_public_read" ON "public"."rst_menu_categories" FOR SELECT TO "authenticated", "anon" USING ((("is_available" = true) AND (EXISTS ( SELECT 1
   FROM "public"."rst_restaurants" "r"
  WHERE (("r"."id" = "rst_menu_categories"."restaurant_id") AND ("r"."is_published" = true))))));



CREATE POLICY "p_rst_menu_variants_public_read" ON "public"."rst_menu_variants" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."rst_menu_items" "i"
     JOIN "public"."rst_restaurants" "r" ON (("r"."id" = "i"."restaurant_id")))
  WHERE (("i"."id" = "rst_menu_variants"."menu_item_id") AND ("r"."is_published" = true)))));



CREATE POLICY "p_rst_restaurants_public_read" ON "public"."rst_restaurants" FOR SELECT TO "authenticated", "anon" USING (("is_published" = true));



CREATE POLICY "p_rst_table_calls_anon_insert" ON "public"."rst_table_calls" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rst_restaurants" "r"
  WHERE (("r"."id" = "rst_table_calls"."restaurant_id") AND ("r"."is_published" = true)))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_b2c_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_loyalty_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_loyalty_visits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_menu_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_menu_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_menu_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_restaurants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_table_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rst_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sy_announcement_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_announcement_reads_sakin_all" ON "public"."sy_announcement_reads" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "sy_announcement_reads_service" ON "public"."sy_announcement_reads" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_announcement_reads_yonetici_read" ON "public"."sy_announcement_reads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sy_announcements" "a"
  WHERE (("a"."id" = "sy_announcement_reads"."announcement_id") AND "public"."sy_is_admin_of_building"("a"."building_id")))));



ALTER TABLE "public"."sy_announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_announcements_sakin_read" ON "public"."sy_announcements" FOR SELECT TO "authenticated" USING (("public"."sy_is_sakin_of_building"("building_id") AND ("sent_at" IS NOT NULL)));



CREATE POLICY "sy_announcements_service" ON "public"."sy_announcements" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_announcements_yonetici_all" ON "public"."sy_announcements" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_budget_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_budget_categories_denetci_read" ON "public"."sy_budget_categories" FOR SELECT TO "authenticated" USING ("public"."sy_is_denetci_of_building"("building_id"));



CREATE POLICY "sy_budget_categories_muhasebeci_all" ON "public"."sy_budget_categories" TO "authenticated" USING ("public"."sy_is_muhasebeci_of_building"("building_id")) WITH CHECK ("public"."sy_is_muhasebeci_of_building"("building_id"));



CREATE POLICY "sy_budget_categories_service" ON "public"."sy_budget_categories" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_budget_categories_yonetici_all" ON "public"."sy_budget_categories" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_buildings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_buildings_denetci_read" ON "public"."sy_buildings" FOR SELECT TO "authenticated" USING ("public"."sy_is_denetci_of_building"("id"));



CREATE POLICY "sy_buildings_muhasebeci_read" ON "public"."sy_buildings" FOR SELECT TO "authenticated" USING ("public"."sy_is_muhasebeci_of_building"("id"));



CREATE POLICY "sy_buildings_sakin_read" ON "public"."sy_buildings" FOR SELECT TO "authenticated" USING ("public"."sy_is_sakin_of_building"("id"));



CREATE POLICY "sy_buildings_service" ON "public"."sy_buildings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_buildings_yonetici_all" ON "public"."sy_buildings" TO "authenticated" USING ("public"."sy_is_admin_of_building"("id")) WITH CHECK ("public"."sy_is_admin_of_building"("id"));



ALTER TABLE "public"."sy_dues_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_dues_ledger_denetci_read" ON "public"."sy_dues_ledger" FOR SELECT TO "authenticated" USING ("public"."sy_is_denetci_of_building"("building_id"));



CREATE POLICY "sy_dues_ledger_muhasebeci_all" ON "public"."sy_dues_ledger" TO "authenticated" USING ("public"."sy_is_muhasebeci_of_building"("building_id")) WITH CHECK ("public"."sy_is_muhasebeci_of_building"("building_id"));



CREATE POLICY "sy_dues_ledger_sakin_read" ON "public"."sy_dues_ledger" FOR SELECT TO "authenticated" USING ((("unit_id" = ANY ("public"."sy_user_unit_ids"("auth"."uid"()))) AND "public"."sy_is_sakin_of_building"("building_id")));



CREATE POLICY "sy_dues_ledger_service" ON "public"."sy_dues_ledger" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_dues_ledger_yonetici_all" ON "public"."sy_dues_ledger" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_income_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_income_expenses_denetci_read" ON "public"."sy_income_expenses" FOR SELECT TO "authenticated" USING ("public"."sy_is_denetci_of_building"("building_id"));



CREATE POLICY "sy_income_expenses_muhasebeci_all" ON "public"."sy_income_expenses" TO "authenticated" USING ("public"."sy_is_muhasebeci_of_building"("building_id")) WITH CHECK ("public"."sy_is_muhasebeci_of_building"("building_id"));



CREATE POLICY "sy_income_expenses_service" ON "public"."sy_income_expenses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_income_expenses_yonetici_all" ON "public"."sy_income_expenses" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_maintenance_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_maintenance_schedule_sakin_read" ON "public"."sy_maintenance_schedule" FOR SELECT TO "authenticated" USING ("public"."sy_is_sakin_of_building"("building_id"));



CREATE POLICY "sy_maintenance_schedule_service" ON "public"."sy_maintenance_schedule" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_maintenance_schedule_yonetici_all" ON "public"."sy_maintenance_schedule" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_maintenance_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_maintenance_tickets_sakin_insert" ON "public"."sy_maintenance_tickets" FOR INSERT TO "authenticated" WITH CHECK (("public"."sy_is_sakin_of_building"("building_id") AND ("reported_by_user_id" = "auth"."uid"()) AND (("unit_id" IS NULL) OR ("unit_id" = ANY ("public"."sy_user_unit_ids"("auth"."uid"()))))));



CREATE POLICY "sy_maintenance_tickets_sakin_read" ON "public"."sy_maintenance_tickets" FOR SELECT TO "authenticated" USING (("public"."sy_is_sakin_of_building"("building_id") AND (("unit_id" IS NULL) OR ("unit_id" = ANY ("public"."sy_user_unit_ids"("auth"."uid"()))) OR ("reported_by_user_id" = "auth"."uid"()))));



CREATE POLICY "sy_maintenance_tickets_service" ON "public"."sy_maintenance_tickets" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_maintenance_tickets_yonetici_all" ON "public"."sy_maintenance_tickets" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_meeting_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_meeting_decisions_sakin_read" ON "public"."sy_meeting_decisions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sy_meetings" "m"
  WHERE (("m"."id" = "sy_meeting_decisions"."meeting_id") AND "public"."sy_is_sakin_of_building"("m"."building_id")))));



CREATE POLICY "sy_meeting_decisions_service" ON "public"."sy_meeting_decisions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_meeting_decisions_yonetici_all" ON "public"."sy_meeting_decisions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sy_meetings" "m"
  WHERE (("m"."id" = "sy_meeting_decisions"."meeting_id") AND "public"."sy_is_admin_of_building"("m"."building_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sy_meetings" "m"
  WHERE (("m"."id" = "sy_meeting_decisions"."meeting_id") AND "public"."sy_is_admin_of_building"("m"."building_id")))));



ALTER TABLE "public"."sy_meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_meetings_sakin_read" ON "public"."sy_meetings" FOR SELECT TO "authenticated" USING ("public"."sy_is_sakin_of_building"("building_id"));



CREATE POLICY "sy_meetings_service" ON "public"."sy_meetings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_meetings_yonetici_all" ON "public"."sy_meetings" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_personnel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_personnel_denetci_read" ON "public"."sy_personnel" FOR SELECT TO "authenticated" USING ("public"."sy_is_denetci_of_building"("building_id"));



CREATE POLICY "sy_personnel_service" ON "public"."sy_personnel" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_personnel_yonetici_all" ON "public"."sy_personnel" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_residents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_residents_sakin_read" ON "public"."sy_residents" FOR SELECT TO "authenticated" USING ("public"."sy_is_sakin_of_building"("building_id"));



CREATE POLICY "sy_residents_service" ON "public"."sy_residents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_residents_yonetici_all" ON "public"."sy_residents" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_suppliers_denetci_read" ON "public"."sy_suppliers" FOR SELECT TO "authenticated" USING ("public"."sy_is_denetci_of_building"("building_id"));



CREATE POLICY "sy_suppliers_muhasebeci_read" ON "public"."sy_suppliers" FOR SELECT TO "authenticated" USING ("public"."sy_is_muhasebeci_of_building"("building_id"));



CREATE POLICY "sy_suppliers_service" ON "public"."sy_suppliers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_suppliers_yonetici_all" ON "public"."sy_suppliers" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_units_sakin_read" ON "public"."sy_units" FOR SELECT TO "authenticated" USING ("public"."sy_is_sakin_of_building"("building_id"));



CREATE POLICY "sy_units_service" ON "public"."sy_units" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_units_yonetici_all" ON "public"."sy_units" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."sy_user_residents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sy_user_residents_self_read" ON "public"."sy_user_residents" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "sy_user_residents_service" ON "public"."sy_user_residents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sy_user_residents_yonetici_all" ON "public"."sy_user_residents" TO "authenticated" USING ("public"."sy_is_admin_of_building"("building_id")) WITH CHECK ("public"."sy_is_admin_of_building"("building_id"));



ALTER TABLE "public"."tenant_integration_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."agent_conversations" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."agent_learnings" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."agent_profiles" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."agent_proposals" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."agent_quotas" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."agent_usage_events" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."ai_usage" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_campaign_rules" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_campaign_targets" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_campaigns" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_cart_items" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_carts" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_categories" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_collection_activities" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_companies" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_credit_limit_audit" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_credit_movements" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealer_credits" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealer_invoices" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealer_orders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealer_price_assignments" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealer_transactions" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealer_visits" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_dealers" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_drip_campaigns" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_drip_enrollments" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_favorites" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_invite_links" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_invoices" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_order_items" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_order_status_history" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_orders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_payments" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_price_list_items" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_price_lists" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_price_tiers" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_product_visibility" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_products" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_purchase_order_lines" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_purchase_orders" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_referral_codes" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_referrals" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_sales_rep_dealers" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_sales_reps" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_sales_targets" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_stock_reservations" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_stock_transfers" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_stocktake_items" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_stocktake_sessions" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_supplier_payments" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_suppliers" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_visit_orders" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_visit_plans" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_visits" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_warehouse_stock" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."bayi_warehouses" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."campaigns" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."contracts" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_contact_actions" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_customers" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_monitoring_criteria" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_presentations" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_properties" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_property_photos" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."emlak_publishing_history" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."mkt_campaigns" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."mkt_order_items" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."mkt_orders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."mkt_products" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."mkt_sales" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."mkt_suppliers" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_appointments" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_beyanname_statuses" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_invoices" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_mukellefler" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_payments" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_reminders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."muh_tahsilat_reminders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."otel_guest_messages" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."otel_hotels" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."otel_rooms" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."otel_user_hotels" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."reminders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_inventory" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_loyalty_members" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_loyalty_visits" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_menu_items" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_order_items" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_orders" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_reservations" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."rst_tables" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."tenant_integration_settings" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE (("profiles"."auth_user_id" = "auth"."uid"()) OR ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "tenant_isolation" ON "public"."user_employee_progress" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."user_favorites" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation" ON "public"."user_invitations" TO "authenticated" USING (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_employee_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete_own" ON "public"."notification_preferences" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_insert_messages_on_own" ON "public"."support_messages" FOR INSERT WITH CHECK ((("sender_type" = 'user'::"text") AND ("internal_note" = false) AND (EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_messages"."ticket_id") AND ("t"."user_id" = "auth"."uid"()))))));



CREATE POLICY "users_insert_own" ON "public"."notification_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_insert_own_tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_messages" ON "public"."support_messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_messages"."ticket_id") AND ("t"."user_id" = "auth"."uid"())))) AND ("internal_note" = false)));



CREATE POLICY "users_read_own" ON "public"."notification_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own" ON "public"."subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own_notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own_recs" ON "public"."recommendation_runs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_read_own_tickets" ON "public"."support_tickets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_update_own" ON "public"."notification_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_update_own_notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_update_own_recs" ON "public"."recommendation_runs" FOR UPDATE USING (("user_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."bayi_apply_stock_change"("p_tenant" "uuid", "p_warehouse" "uuid", "p_product" "uuid", "p_delta" numeric, "p_movement_type" "text", "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_unit_cost" numeric, "p_supplier_name" "text", "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bayi_apply_stock_change"("p_tenant" "uuid", "p_warehouse" "uuid", "p_product" "uuid", "p_delta" numeric, "p_movement_type" "text", "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_unit_cost" numeric, "p_supplier_name" "text", "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bayi_apply_stock_change"("p_tenant" "uuid", "p_warehouse" "uuid", "p_product" "uuid", "p_delta" numeric, "p_movement_type" "text", "p_reason" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_unit_cost" numeric, "p_supplier_name" "text", "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bayi_consume_order_reservations"("p_order_id" "uuid", "p_changed_by_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bayi_consume_order_reservations"("p_order_id" "uuid", "p_changed_by_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bayi_consume_order_reservations"("p_order_id" "uuid", "p_changed_by_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bayi_create_dealer_order_v2"("p_tenant_id" "uuid", "p_dealer_user_id" "uuid", "p_items" "jsonb", "p_notes" "text", "p_total" numeric, "p_reservation_ttl_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."bayi_create_dealer_order_v2"("p_tenant_id" "uuid", "p_dealer_user_id" "uuid", "p_items" "jsonb", "p_notes" "text", "p_total" numeric, "p_reservation_ttl_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bayi_create_dealer_order_v2"("p_tenant_id" "uuid", "p_dealer_user_id" "uuid", "p_items" "jsonb", "p_notes" "text", "p_total" numeric, "p_reservation_ttl_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."bayi_release_order_reservations"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bayi_release_order_reservations"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bayi_release_order_reservations"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mkt_top_selling_products"("p_tenant_id" "uuid", "p_days" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."mkt_top_selling_products"("p_tenant_id" "uuid", "p_days" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mkt_top_selling_products"("p_tenant_id" "uuid", "p_days" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_agent_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_agent_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_agent_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."otel_user_can_see_hotel"("target_hotel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."otel_user_can_see_hotel"("target_hotel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."otel_user_can_see_hotel"("target_hotel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_set_is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_set_is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_set_is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_is_admin_of_building"("p_building_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_is_admin_of_building"("p_building_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_is_admin_of_building"("p_building_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_is_denetci_of_building"("p_building_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_is_denetci_of_building"("p_building_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_is_denetci_of_building"("p_building_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_is_muhasebeci_of_building"("p_building_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_is_muhasebeci_of_building"("p_building_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_is_muhasebeci_of_building"("p_building_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_is_sakin_of_building"("p_building_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_is_sakin_of_building"("p_building_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_is_sakin_of_building"("p_building_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_user_building_ids"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_user_building_ids"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_user_building_ids"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_user_role"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_user_role"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_user_role"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sy_user_unit_ids"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sy_user_unit_ids"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sy_user_unit_ids"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_notification_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_notification_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_notification_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_rst_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_rst_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rst_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_test_identities" TO "anon";
GRANT ALL ON TABLE "public"."admin_test_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_test_identities" TO "service_role";



GRANT ALL ON TABLE "public"."agent_config" TO "anon";
GRANT ALL ON TABLE "public"."agent_config" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_config" TO "service_role";



GRANT ALL ON TABLE "public"."agent_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."agent_events" TO "anon";
GRANT ALL ON TABLE "public"."agent_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_events" TO "service_role";



GRANT ALL ON TABLE "public"."agent_learnings" TO "anon";
GRANT ALL ON TABLE "public"."agent_learnings" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_learnings" TO "service_role";



GRANT ALL ON TABLE "public"."agent_messages" TO "anon";
GRANT ALL ON TABLE "public"."agent_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_messages" TO "service_role";



GRANT ALL ON TABLE "public"."agent_plans" TO "anon";
GRANT ALL ON TABLE "public"."agent_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_plans" TO "service_role";



GRANT ALL ON TABLE "public"."agent_profiles" TO "anon";
GRANT ALL ON TABLE "public"."agent_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."agent_proposals" TO "anon";
GRANT ALL ON TABLE "public"."agent_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."agent_quotas" TO "anon";
GRANT ALL ON TABLE "public"."agent_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_quotas" TO "service_role";



GRANT ALL ON TABLE "public"."agent_tasks" TO "anon";
GRANT ALL ON TABLE "public"."agent_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."agent_usage_events" TO "anon";
GRANT ALL ON TABLE "public"."agent_usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_usage_events" TO "service_role";



GRANT ALL ON TABLE "public"."agent_websites" TO "anon";
GRANT ALL ON TABLE "public"."agent_websites" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_websites" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_orders" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_orders" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_invoices" TO "anon";
GRANT ALL ON TABLE "public"."bayi_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_payments" TO "anon";
GRANT ALL ON TABLE "public"."bayi_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_payments" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_account_statement" TO "anon";
GRANT ALL ON TABLE "public"."bayi_account_statement" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_account_statement" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_campaign_executions" TO "anon";
GRANT ALL ON TABLE "public"."bayi_campaign_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_campaign_executions" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_campaign_rules" TO "anon";
GRANT ALL ON TABLE "public"."bayi_campaign_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_campaign_rules" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_campaign_targets" TO "anon";
GRANT ALL ON TABLE "public"."bayi_campaign_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_campaign_targets" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_campaign_triggers" TO "anon";
GRANT ALL ON TABLE "public"."bayi_campaign_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_campaign_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."bayi_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_cart_items" TO "anon";
GRANT ALL ON TABLE "public"."bayi_cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_carts" TO "anon";
GRANT ALL ON TABLE "public"."bayi_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_carts" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_categories" TO "anon";
GRANT ALL ON TABLE "public"."bayi_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_categories" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_transactions" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealers" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealers" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealers" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_orders" TO "anon";
GRANT ALL ON TABLE "public"."bayi_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_orders" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_churn_signals" TO "anon";
GRANT ALL ON TABLE "public"."bayi_churn_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_churn_signals" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_collection_activities" TO "anon";
GRANT ALL ON TABLE "public"."bayi_collection_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_collection_activities" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_companies" TO "anon";
GRANT ALL ON TABLE "public"."bayi_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_companies" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_credit_limit_audit" TO "anon";
GRANT ALL ON TABLE "public"."bayi_credit_limit_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_credit_limit_audit" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_credit_movements" TO "anon";
GRANT ALL ON TABLE "public"."bayi_credit_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_credit_movements" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_cross_sell_pairs" TO "anon";
GRANT ALL ON TABLE "public"."bayi_cross_sell_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_cross_sell_pairs" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_credits" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_credits" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_invoices" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_order_items" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_price_assignments" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_price_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_price_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_scores" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_scores" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_dealer_visits" TO "anon";
GRANT ALL ON TABLE "public"."bayi_dealer_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_dealer_visits" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_drip_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."bayi_drip_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_drip_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_drip_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."bayi_drip_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_drip_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_drip_sends" TO "anon";
GRANT ALL ON TABLE "public"."bayi_drip_sends" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_drip_sends" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_drip_steps" TO "anon";
GRANT ALL ON TABLE "public"."bayi_drip_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_drip_steps" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_favorites" TO "anon";
GRANT ALL ON TABLE "public"."bayi_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_invite_links" TO "anon";
GRANT ALL ON TABLE "public"."bayi_invite_links" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_invite_links" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_leads" TO "anon";
GRANT ALL ON TABLE "public"."bayi_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_leads" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_order_items" TO "anon";
GRANT ALL ON TABLE "public"."bayi_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."bayi_order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_order_statuses" TO "anon";
GRANT ALL ON TABLE "public"."bayi_order_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_order_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_price_list_items" TO "anon";
GRANT ALL ON TABLE "public"."bayi_price_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_price_list_items" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_price_lists" TO "anon";
GRANT ALL ON TABLE "public"."bayi_price_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_price_lists" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_price_tiers" TO "anon";
GRANT ALL ON TABLE "public"."bayi_price_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_price_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_product_visibility" TO "anon";
GRANT ALL ON TABLE "public"."bayi_product_visibility" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_product_visibility" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_products" TO "anon";
GRANT ALL ON TABLE "public"."bayi_products" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_products" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_purchase_order_lines" TO "anon";
GRANT ALL ON TABLE "public"."bayi_purchase_order_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_purchase_order_lines" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."bayi_purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_referral_codes" TO "anon";
GRANT ALL ON TABLE "public"."bayi_referral_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_referral_codes" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_referrals" TO "anon";
GRANT ALL ON TABLE "public"."bayi_referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_referrals" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_sales_rep_dealers" TO "anon";
GRANT ALL ON TABLE "public"."bayi_sales_rep_dealers" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_sales_rep_dealers" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_sales_reps" TO "anon";
GRANT ALL ON TABLE "public"."bayi_sales_reps" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_sales_reps" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_sales_targets" TO "anon";
GRANT ALL ON TABLE "public"."bayi_sales_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_sales_targets" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."bayi_stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_stock_reservations" TO "anon";
GRANT ALL ON TABLE "public"."bayi_stock_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_stock_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_stock_transfers" TO "anon";
GRANT ALL ON TABLE "public"."bayi_stock_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_stock_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_stocktake_items" TO "anon";
GRANT ALL ON TABLE "public"."bayi_stocktake_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_stocktake_items" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_stocktake_sessions" TO "anon";
GRANT ALL ON TABLE "public"."bayi_stocktake_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_stocktake_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_supplier_payments" TO "anon";
GRANT ALL ON TABLE "public"."bayi_supplier_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_supplier_payments" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."bayi_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_transaction_types" TO "anon";
GRANT ALL ON TABLE "public"."bayi_transaction_types" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_transaction_types" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_visit_orders" TO "anon";
GRANT ALL ON TABLE "public"."bayi_visit_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_visit_orders" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_visit_plans" TO "anon";
GRANT ALL ON TABLE "public"."bayi_visit_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_visit_plans" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_visits" TO "anon";
GRANT ALL ON TABLE "public"."bayi_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_visits" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_vitrines" TO "anon";
GRANT ALL ON TABLE "public"."bayi_vitrines" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_vitrines" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_warehouse_stock" TO "anon";
GRANT ALL ON TABLE "public"."bayi_warehouse_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_warehouse_stock" TO "service_role";



GRANT ALL ON TABLE "public"."bayi_warehouses" TO "anon";
GRANT ALL ON TABLE "public"."bayi_warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."bayi_warehouses" TO "service_role";



GRANT ALL ON TABLE "public"."bot_activity" TO "anon";
GRANT ALL ON TABLE "public"."bot_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."bot_activity" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."command_sessions" TO "anon";
GRANT ALL ON TABLE "public"."command_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."command_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."contracts" TO "anon";
GRANT ALL ON TABLE "public"."contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."contracts" TO "service_role";



GRANT ALL ON TABLE "public"."dealer_invitations" TO "anon";
GRANT ALL ON TABLE "public"."dealer_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."dealer_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."distributor_slugs" TO "anon";
GRANT ALL ON TABLE "public"."distributor_slugs" TO "authenticated";
GRANT ALL ON TABLE "public"."distributor_slugs" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."emlak_calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_contact_actions" TO "anon";
GRANT ALL ON TABLE "public"."emlak_contact_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_contact_actions" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_customer_contacts" TO "anon";
GRANT ALL ON TABLE "public"."emlak_customer_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_customer_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_customers" TO "anon";
GRANT ALL ON TABLE "public"."emlak_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_customers" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_daily_leads" TO "anon";
GRANT ALL ON TABLE "public"."emlak_daily_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_daily_leads" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_lead_calls" TO "anon";
GRANT ALL ON TABLE "public"."emlak_lead_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_lead_calls" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_monitoring_criteria" TO "anon";
GRANT ALL ON TABLE "public"."emlak_monitoring_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_monitoring_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_presentations" TO "anon";
GRANT ALL ON TABLE "public"."emlak_presentations" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_presentations" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_properties" TO "anon";
GRANT ALL ON TABLE "public"."emlak_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_properties" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_property_photos" TO "anon";
GRANT ALL ON TABLE "public"."emlak_property_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_property_photos" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_publishing_history" TO "anon";
GRANT ALL ON TABLE "public"."emlak_publishing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_publishing_history" TO "service_role";



GRANT ALL ON TABLE "public"."emlak_tracking_criteria" TO "anon";
GRANT ALL ON TABLE "public"."emlak_tracking_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."emlak_tracking_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."extension_tokens" TO "anon";
GRANT ALL ON TABLE "public"."extension_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."extension_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."hotel_employees" TO "anon";
GRANT ALL ON TABLE "public"."hotel_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."hotel_employees" TO "service_role";



GRANT ALL ON TABLE "public"."invite_codes" TO "anon";
GRANT ALL ON TABLE "public"."invite_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_codes" TO "service_role";



GRANT ALL ON TABLE "public"."invite_links" TO "anon";
GRANT ALL ON TABLE "public"."invite_links" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_links" TO "service_role";



GRANT ALL ON TABLE "public"."magic_link_tokens" TO "anon";
GRANT ALL ON TABLE "public"."magic_link_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."magic_link_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."mkt_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."mkt_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."mkt_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."mkt_order_items" TO "anon";
GRANT ALL ON TABLE "public"."mkt_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."mkt_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."mkt_orders" TO "anon";
GRANT ALL ON TABLE "public"."mkt_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."mkt_orders" TO "service_role";



GRANT ALL ON TABLE "public"."mkt_products" TO "anon";
GRANT ALL ON TABLE "public"."mkt_products" TO "authenticated";
GRANT ALL ON TABLE "public"."mkt_products" TO "service_role";



GRANT ALL ON TABLE "public"."mkt_sales" TO "anon";
GRANT ALL ON TABLE "public"."mkt_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."mkt_sales" TO "service_role";



GRANT ALL ON TABLE "public"."mkt_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."mkt_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."mkt_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."muh_appointments" TO "anon";
GRANT ALL ON TABLE "public"."muh_appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_appointments" TO "service_role";



GRANT ALL ON TABLE "public"."muh_beyanname_statuses" TO "anon";
GRANT ALL ON TABLE "public"."muh_beyanname_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_beyanname_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."muh_invoices" TO "anon";
GRANT ALL ON TABLE "public"."muh_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."muh_mukellefler" TO "anon";
GRANT ALL ON TABLE "public"."muh_mukellefler" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_mukellefler" TO "service_role";



GRANT ALL ON TABLE "public"."muh_payments" TO "anon";
GRANT ALL ON TABLE "public"."muh_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_payments" TO "service_role";



GRANT ALL ON TABLE "public"."muh_reminders" TO "anon";
GRANT ALL ON TABLE "public"."muh_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."muh_tahsilat_reminders" TO "anon";
GRANT ALL ON TABLE "public"."muh_tahsilat_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_tahsilat_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."muh_tax_rates" TO "anon";
GRANT ALL ON TABLE "public"."muh_tax_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."muh_tax_rates" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_state" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_state" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_state" TO "service_role";



GRANT ALL ON TABLE "public"."otel_guest_hotels" TO "anon";
GRANT ALL ON TABLE "public"."otel_guest_hotels" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_guest_hotels" TO "service_role";



GRANT ALL ON TABLE "public"."otel_guest_messages" TO "anon";
GRANT ALL ON TABLE "public"."otel_guest_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_guest_messages" TO "service_role";



GRANT ALL ON TABLE "public"."otel_hotels" TO "anon";
GRANT ALL ON TABLE "public"."otel_hotels" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_hotels" TO "service_role";



GRANT ALL ON TABLE "public"."otel_housekeeping_tasks" TO "anon";
GRANT ALL ON TABLE "public"."otel_housekeeping_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_housekeeping_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."otel_pre_checkins" TO "anon";
GRANT ALL ON TABLE "public"."otel_pre_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_pre_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."otel_reservations" TO "anon";
GRANT ALL ON TABLE "public"."otel_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."otel_rooms" TO "anon";
GRANT ALL ON TABLE "public"."otel_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."otel_user_hotels" TO "anon";
GRANT ALL ON TABLE "public"."otel_user_hotels" TO "authenticated";
GRANT ALL ON TABLE "public"."otel_user_hotels" TO "service_role";



GRANT ALL ON TABLE "public"."otp_codes" TO "anon";
GRANT ALL ON TABLE "public"."otp_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_codes" TO "service_role";



GRANT ALL ON TABLE "public"."panel_qr_tokens" TO "anon";
GRANT ALL ON TABLE "public"."panel_qr_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."panel_qr_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."platform_events" TO "anon";
GRANT ALL ON TABLE "public"."platform_events" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_events" TO "service_role";



GRANT ALL ON TABLE "public"."platform_missions" TO "anon";
GRANT ALL ON TABLE "public"."platform_missions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_missions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_rules" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."recommendation_runs" TO "anon";
GRANT ALL ON TABLE "public"."recommendation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."reminders" TO "anon";
GRANT ALL ON TABLE "public"."reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."reminders" TO "service_role";



GRANT ALL ON TABLE "public"."rst_b2c_orders" TO "anon";
GRANT ALL ON TABLE "public"."rst_b2c_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_b2c_orders" TO "service_role";



GRANT ALL ON TABLE "public"."rst_inventory" TO "anon";
GRANT ALL ON TABLE "public"."rst_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."rst_loyalty_members" TO "anon";
GRANT ALL ON TABLE "public"."rst_loyalty_members" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_loyalty_members" TO "service_role";



GRANT ALL ON TABLE "public"."rst_loyalty_visits" TO "anon";
GRANT ALL ON TABLE "public"."rst_loyalty_visits" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_loyalty_visits" TO "service_role";



GRANT ALL ON TABLE "public"."rst_menu_addons" TO "anon";
GRANT ALL ON TABLE "public"."rst_menu_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_menu_addons" TO "service_role";



GRANT ALL ON TABLE "public"."rst_menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."rst_menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."rst_menu_items" TO "anon";
GRANT ALL ON TABLE "public"."rst_menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."rst_menu_variants" TO "anon";
GRANT ALL ON TABLE "public"."rst_menu_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_menu_variants" TO "service_role";



GRANT ALL ON TABLE "public"."rst_order_items" TO "anon";
GRANT ALL ON TABLE "public"."rst_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."rst_orders" TO "anon";
GRANT ALL ON TABLE "public"."rst_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_orders" TO "service_role";



GRANT ALL ON TABLE "public"."rst_reservations" TO "anon";
GRANT ALL ON TABLE "public"."rst_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."rst_restaurants" TO "anon";
GRANT ALL ON TABLE "public"."rst_restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."rst_table_calls" TO "anon";
GRANT ALL ON TABLE "public"."rst_table_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_table_calls" TO "service_role";



GRANT ALL ON TABLE "public"."rst_tables" TO "anon";
GRANT ALL ON TABLE "public"."rst_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."rst_tables" TO "service_role";



GRANT ALL ON TABLE "public"."saas_active_session" TO "anon";
GRANT ALL ON TABLE "public"."saas_active_session" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_active_session" TO "service_role";



GRANT ALL ON TABLE "public"."saas_phone_registry" TO "anon";
GRANT ALL ON TABLE "public"."saas_phone_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."saas_phone_registry" TO "service_role";



GRANT ALL ON TABLE "public"."seasonal_events" TO "anon";
GRANT ALL ON TABLE "public"."seasonal_events" TO "authenticated";
GRANT ALL ON TABLE "public"."seasonal_events" TO "service_role";



GRANT ALL ON TABLE "public"."step_up_challenges" TO "anon";
GRANT ALL ON TABLE "public"."step_up_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."step_up_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."support_messages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."support_messages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."support_messages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."support_tickets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."support_tickets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."support_tickets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sy_announcement_reads" TO "anon";
GRANT ALL ON TABLE "public"."sy_announcement_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_announcement_reads" TO "service_role";



GRANT ALL ON TABLE "public"."sy_announcements" TO "anon";
GRANT ALL ON TABLE "public"."sy_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."sy_budget_categories" TO "anon";
GRANT ALL ON TABLE "public"."sy_budget_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_budget_categories" TO "service_role";



GRANT ALL ON TABLE "public"."sy_buildings" TO "anon";
GRANT ALL ON TABLE "public"."sy_buildings" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_buildings" TO "service_role";



GRANT ALL ON TABLE "public"."sy_dues_ledger" TO "anon";
GRANT ALL ON TABLE "public"."sy_dues_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_dues_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."sy_income_expenses" TO "anon";
GRANT ALL ON TABLE "public"."sy_income_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_income_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."sy_maintenance_schedule" TO "anon";
GRANT ALL ON TABLE "public"."sy_maintenance_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_maintenance_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."sy_maintenance_tickets" TO "anon";
GRANT ALL ON TABLE "public"."sy_maintenance_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_maintenance_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."sy_meeting_decisions" TO "anon";
GRANT ALL ON TABLE "public"."sy_meeting_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_meeting_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."sy_meetings" TO "anon";
GRANT ALL ON TABLE "public"."sy_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."sy_personnel" TO "anon";
GRANT ALL ON TABLE "public"."sy_personnel" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_personnel" TO "service_role";



GRANT ALL ON TABLE "public"."sy_residents" TO "anon";
GRANT ALL ON TABLE "public"."sy_residents" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_residents" TO "service_role";



GRANT ALL ON TABLE "public"."sy_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."sy_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."sy_units" TO "anon";
GRANT ALL ON TABLE "public"."sy_units" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_units" TO "service_role";



GRANT ALL ON TABLE "public"."sy_user_residents" TO "anon";
GRANT ALL ON TABLE "public"."sy_user_residents" TO "authenticated";
GRANT ALL ON TABLE "public"."sy_user_residents" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_integration_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_integration_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_integration_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."user_daily_tasks" TO "anon";
GRANT ALL ON TABLE "public"."user_daily_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_daily_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_employee_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_employee_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_employee_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_favorites" TO "anon";
GRANT ALL ON TABLE "public"."user_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."user_mission_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_mission_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_mission_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_notification_prefs" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_prefs" TO "service_role";



GRANT ALL ON TABLE "public"."user_performance" TO "anon";
GRANT ALL ON TABLE "public"."user_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."user_performance" TO "service_role";



GRANT ALL ON TABLE "public"."user_quest_state" TO "anon";
GRANT ALL ON TABLE "public"."user_quest_state" TO "authenticated";
GRANT ALL ON TABLE "public"."user_quest_state" TO "service_role";



GRANT ALL ON TABLE "public"."user_streaks" TO "anon";
GRANT ALL ON TABLE "public"."user_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_streaks" TO "service_role";



GRANT ALL ON TABLE "public"."user_test_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."user_test_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."user_test_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."user_tips_shown" TO "anon";
GRANT ALL ON TABLE "public"."user_tips_shown" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tips_shown" TO "service_role";



GRANT ALL ON TABLE "public"."xp_events" TO "anon";
GRANT ALL ON TABLE "public"."xp_events" TO "authenticated";
GRANT ALL ON TABLE "public"."xp_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
