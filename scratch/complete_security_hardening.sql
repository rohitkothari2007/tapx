BEGIN;

-- =========================================================
-- 1. TAPX ADMIN USERS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tapx_admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tapx_admin_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tapx_admin_users TO authenticated, service_role;
DROP POLICY IF EXISTS "Public select tapx_admin_users" ON public.tapx_admin_users;
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.tapx_admin_users;
CREATE POLICY "Users can check their own admin status" ON public.tapx_admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.tapx_client_users TO authenticated, service_role;
DROP POLICY IF EXISTS "Users can check their own client status" ON public.tapx_client_users;
CREATE POLICY "Users can check their own client status" ON public.tapx_client_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 2. COMPOSITE UNIQUE CONSTRAINT ON tapx_client_users
-- =========================================================
ALTER TABLE public.tapx_client_users 
  DROP CONSTRAINT IF EXISTS tapx_client_users_user_id_business_id_key;

ALTER TABLE public.tapx_client_users 
  ADD CONSTRAINT tapx_client_users_user_id_business_id_key 
  UNIQUE (user_id, business_id);

-- =========================================================
-- 3. SECURITY DEFINER RPC FOR ANONYMOUS TAP RESOLUTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.resolve_tap_device(p_device_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_device record;
  v_business record;
  v_features jsonb;
  v_configs jsonb;
  v_result jsonb;
BEGIN
  SELECT id, device_code, label, location, business_id, status
  INTO v_device
  FROM public.devices
  WHERE device_code = p_device_code
  LIMIT 1;

  IF v_device IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, name, category, phone, email, address, city, state, logo_url, instagram_url, google_review_url, whatsapp_number, payment_url, upi_id, payment_enabled, status
  INTO v_business
  FROM public.businesses
  WHERE id = v_device.business_id
  LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'feature_id', feature_id,
    'enabled', enabled,
    'status', status
  )), '[]'::jsonb)
  INTO v_features
  FROM public.business_features
  WHERE business_id = v_device.business_id AND enabled = true;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'feature_id', feature_id,
    'module_key', module_key,
    'config', config,
    'status', status
  )), '[]'::jsonb)
  INTO v_configs
  FROM public.business_module_configs
  WHERE business_id = v_device.business_id;

  v_result := jsonb_build_object(
    'device', to_jsonb(v_device),
    'business', to_jsonb(v_business),
    'enabled_features', v_features,
    'module_configs', v_configs
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tap_device(text) TO anon, authenticated, service_role;

-- =========================================================
-- 4. BUSINESSES POLICIES
-- =========================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read businesses" ON public.businesses;
DROP POLICY IF EXISTS "Allow business update" ON public.businesses;
DROP POLICY IF EXISTS "Allow business insert" ON public.businesses;
DROP POLICY IF EXISTS "Admin and Owner SELECT businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admin INSERT businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admin and Owner UPDATE businesses" ON public.businesses;

CREATE POLICY "Admin and Owner SELECT businesses" ON public.businesses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.tapx_client_users tcu WHERE tcu.user_id = auth.uid() AND tcu.business_id = businesses.id)
  );

CREATE POLICY "Admin INSERT businesses" ON public.businesses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY "Admin and Owner UPDATE businesses" ON public.businesses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.tapx_client_users tcu WHERE tcu.user_id = auth.uid() AND tcu.business_id = businesses.id)
  );

-- =========================================================
-- 5. DEVICES POLICIES
-- =========================================================
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read devices" ON public.devices;
DROP POLICY IF EXISTS "Allow device update" ON public.devices;
DROP POLICY IF EXISTS "Allow device insert" ON public.devices;
DROP POLICY IF EXISTS "Admin and Owner SELECT devices" ON public.devices;
DROP POLICY IF EXISTS "Admin INSERT devices" ON public.devices;
DROP POLICY IF EXISTS "Admin and Owner UPDATE devices" ON public.devices;

CREATE POLICY "Admin and Owner SELECT devices" ON public.devices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = devices.business_id
    )
  );

CREATE POLICY "Admin INSERT devices" ON public.devices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY "Admin and Owner UPDATE devices" ON public.devices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = devices.business_id
    )
  );

-- =========================================================
-- 6. BUSINESS_FEATURES POLICIES
-- =========================================================
ALTER TABLE public.business_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read business_features" ON public.business_features;
DROP POLICY IF EXISTS "Admin and Owner business_features" ON public.business_features;

CREATE POLICY "Admin and Owner business_features" ON public.business_features
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = business_features.business_id
    )
  );

-- =========================================================
-- 7. BUSINESS_MODULE_CONFIGS POLICIES
-- =========================================================
ALTER TABLE public.business_module_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read business_module_configs" ON public.business_module_configs;
DROP POLICY IF EXISTS "Admin and Owner business_module_configs" ON public.business_module_configs;

CREATE POLICY "Admin and Owner business_module_configs" ON public.business_module_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = business_module_configs.business_id
    )
  );

-- =========================================================
-- 8. TAPX_ORDERS POLICIES
-- =========================================================
ALTER TABLE public.tapx_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select tapx_orders" ON public.tapx_orders;
DROP POLICY IF EXISTS "Admin and Owner SELECT tapx_orders" ON public.tapx_orders;

CREATE POLICY "Admin and Owner SELECT tapx_orders" ON public.tapx_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = tapx_orders.business_id
    )
  );

-- =========================================================
-- 9. LOYALTY_MEMBERSHIPS POLICIES
-- =========================================================
ALTER TABLE public.loyalty_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select loyalty_memberships" ON public.loyalty_memberships;
DROP POLICY IF EXISTS "Admin and Owner SELECT loyalty_memberships" ON public.loyalty_memberships;

CREATE POLICY "Admin and Owner SELECT loyalty_memberships" ON public.loyalty_memberships
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = loyalty_memberships.business_id
    )
  );

-- =========================================================
-- 10. CUSTOMER_FEEDBACK POLICIES
-- =========================================================
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select customer_feedback" ON public.customer_feedback;
DROP POLICY IF EXISTS "Admin and Owner SELECT customer_feedback" ON public.customer_feedback;
DROP POLICY IF EXISTS "Public INSERT customer_feedback" ON public.customer_feedback;

CREATE POLICY "Admin and Owner SELECT customer_feedback" ON public.customer_feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = customer_feedback.business_id
    )
  );

CREATE POLICY "Public INSERT customer_feedback" ON public.customer_feedback
  FOR INSERT WITH CHECK (true);

-- =========================================================
-- 11. INTERACTIONS POLICIES
-- =========================================================
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read interactions" ON public.interactions;
DROP POLICY IF EXISTS "Admin and Owner SELECT interactions" ON public.interactions;
DROP POLICY IF EXISTS "Public INSERT interactions" ON public.interactions;

CREATE POLICY "Admin and Owner SELECT interactions" ON public.interactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu
      WHERE tcu.user_id = auth.uid() AND tcu.business_id = interactions.business_id
    )
  );

CREATE POLICY "Public INSERT interactions" ON public.interactions
  FOR INSERT WITH CHECK (true);

COMMIT;
