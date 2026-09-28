-- TAPX GRANT & RLS POLICY MIGRATION FOR CUSTOMER_REQUESTS TABLE
-- Execute this script in Supabase SQL Editor (https://supabase.com/dashboard)

-- Step 1: Grant full table privileges to authenticated and anon roles
GRANT ALL ON public.customer_requests TO authenticated;
GRANT ALL ON public.customer_requests TO anon;

-- Step 2: Ensure INSERT policy allows client portal owners to submit requests
DROP POLICY IF EXISTS "Allow INSERT customer_requests" ON public.customer_requests;
CREATE POLICY "Allow INSERT customer_requests" ON public.customer_requests
  FOR INSERT WITH CHECK (true);

-- Step 3: Ensure SELECT policy allows reading requests
DROP POLICY IF EXISTS "Allow SELECT customer_requests" ON public.customer_requests;
CREATE POLICY "Allow SELECT customer_requests" ON public.customer_requests
  FOR SELECT USING (true);

-- Step 4: Ensure UPDATE policy allows updating status (fulfilled/rejected)
DROP POLICY IF EXISTS "Allow UPDATE customer_requests" ON public.customer_requests;
CREATE POLICY "Allow UPDATE customer_requests" ON public.customer_requests
  FOR UPDATE USING (true);
