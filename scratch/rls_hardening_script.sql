-- =========================================================
-- TAPX RLS HARDENING MIGRATION & POLICY VERIFICATION
-- =========================================================

BEGIN;

-- 1. Enable RLS on all core tables
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tapx_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tapx_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tapx_client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_module_configs ENABLE ROW LEVEL SECURITY;

-- 2. Unique Constraints
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_device_code_unique;
ALTER TABLE public.devices ADD CONSTRAINT devices_device_code_unique UNIQUE (device_code);

-- 3. DEVICES POLICIES
DROP POLICY IF EXISTS "Public read devices" ON public.devices;
CREATE POLICY "Public read devices" ON public.devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow device update" ON public.devices;
CREATE POLICY "Allow device update" ON public.devices FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow device insert" ON public.devices;
CREATE POLICY "Allow device insert" ON public.devices FOR INSERT WITH CHECK (true);

-- 4. BUSINESSES POLICIES
DROP POLICY IF EXISTS "Public read businesses" ON public.businesses;
CREATE POLICY "Public read businesses" ON public.businesses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow business update" ON public.businesses;
CREATE POLICY "Allow business update" ON public.businesses FOR UPDATE USING (true);

-- 5. INTERACTIONS POLICIES
DROP POLICY IF EXISTS "Public read interactions" ON public.interactions;
CREATE POLICY "Public read interactions" ON public.interactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert interactions" ON public.interactions;
CREATE POLICY "Public insert interactions" ON public.interactions FOR INSERT WITH CHECK (true);

-- 6. CUSTOMER REQUESTS POLICIES (Hotel, Hardware, Service Requests)
DROP POLICY IF EXISTS "Public select customer_requests" ON public.customer_requests;
CREATE POLICY "Public select customer_requests" ON public.customer_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert customer_requests" ON public.customer_requests;
CREATE POLICY "Public insert customer_requests" ON public.customer_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update customer_requests" ON public.customer_requests;
CREATE POLICY "Public update customer_requests" ON public.customer_requests FOR UPDATE USING (true);

-- 7. TAPX APPOINTMENTS POLICIES
DROP POLICY IF EXISTS "Public select tapx_appointments" ON public.tapx_appointments;
CREATE POLICY "Public select tapx_appointments" ON public.tapx_appointments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert tapx_appointments" ON public.tapx_appointments;
CREATE POLICY "Public insert tapx_appointments" ON public.tapx_appointments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update tapx_appointments" ON public.tapx_appointments;
CREATE POLICY "Public update tapx_appointments" ON public.tapx_appointments FOR UPDATE USING (true);

-- 8. TAPX CLIENT USERS POLICIES
DROP POLICY IF EXISTS "Public select tapx_client_users" ON public.tapx_client_users;
CREATE POLICY "Public select tapx_client_users" ON public.tapx_client_users FOR SELECT USING (true);

COMMIT;
