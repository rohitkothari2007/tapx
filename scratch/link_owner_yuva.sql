-- SQL Migration to link rohitjkothari12@gmail.com to YUVA SELECTION in tapx_client_users
INSERT INTO public.tapx_client_users (user_id, business_id, role)
SELECT 
  au.id AS user_id, 
  b.id AS business_id, 
  'owner' AS role
FROM auth.users au
CROSS JOIN public.businesses b
WHERE au.email = 'rohitjkothari12@gmail.com'
  AND b.name = 'YUVA SELECTION'
ON CONFLICT (user_id, business_id) DO UPDATE SET role = 'owner';

-- Verify the inserted row
SELECT 
  tcu.id,
  tcu.user_id,
  au.email,
  b.name AS business_name,
  tcu.role,
  tcu.created_at
FROM public.tapx_client_users tcu
JOIN auth.users au ON au.id = tcu.user_id
JOIN public.businesses b ON b.id = tcu.business_id
WHERE b.name = 'YUVA SELECTION';
