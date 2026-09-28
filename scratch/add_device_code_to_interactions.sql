-- Migration: Add device_code column to public.interactions
ALTER TABLE public.interactions 
  ADD COLUMN IF NOT EXISTS device_code text;

-- Backfill device_code for existing interaction rows from public.devices
UPDATE public.interactions i
SET device_code = d.device_code
FROM public.devices d
WHERE i.device_id = d.id
  AND i.device_code IS NULL;

-- Verify updated rows
SELECT id, device_id, device_code, business_id, interaction_type, created_at
FROM public.interactions
WHERE business_id = '8ac05e2a-9942-4727-abbe-b98973e69a1e'
ORDER BY created_at DESC
LIMIT 10;
