-- TAPX STRICT SECURE RLS MIGRATION FOR CUSTOMER_REQUESTS
-- Execute this script in Supabase SQL Editor (https://supabase.com/dashboard)

-- Step 1: Revoke all anonymous access
REVOKE ALL ON public.customer_requests FROM anon;

-- Step 2: Grant table privileges ONLY to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.customer_requests TO authenticated;

-- Step 3: Remove all insecure / loose policies
DROP POLICY IF EXISTS "Allow INSERT customer_requests" ON public.customer_requests;
DROP POLICY IF EXISTS "Allow SELECT customer_requests" ON public.customer_requests;
DROP POLICY IF EXISTS "Allow UPDATE customer_requests" ON public.customer_requests;
DROP POLICY IF EXISTS "Owner INSERT customer_requests" ON public.customer_requests;
DROP POLICY IF EXISTS "Admin and Owner SELECT customer_requests" ON public.customer_requests;
DROP POLICY IF EXISTS "Admin UPDATE customer_requests" ON public.customer_requests;

-- Step 4: Strict Owner INSERT Policy (Owner can ONLY submit requests for their own business)
CREATE POLICY "Owner INSERT customer_requests" ON public.customer_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu 
      WHERE tcu.user_id = auth.uid() 
        AND tcu.business_id = customer_requests.business_id
    )
  );

-- Step 5: Strict Admin & Owner SELECT Policy (Admin sees all, Owner sees ONLY their business)
CREATE POLICY "Admin and Owner SELECT customer_requests" ON public.customer_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.tapx_client_users tcu 
      WHERE tcu.user_id = auth.uid() 
        AND tcu.business_id = customer_requests.business_id
    )
  );

-- Step 6: Strict Admin UPDATE Policy (ONLY TAPX Admins can mark requests as fulfilled/rejected)
CREATE POLICY "Admin UPDATE customer_requests" ON public.customer_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tapx_admin_users au WHERE au.user_id = auth.uid())
  );
