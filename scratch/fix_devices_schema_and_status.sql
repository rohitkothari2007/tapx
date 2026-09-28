-- TAPX IDEMPOTENT MIGRATION SCRIPT (SAFE TO RUN MULTIPLE TIMES)
-- Copy and run this entire script in Supabase SQL Editor (https://supabase.com/dashboard)

-- Step 1: Drop old constraint FIRST so status updates are permitted
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_status_check;

-- Step 2: Update existing data from 'available' to 'unassigned'
UPDATE public.devices SET status = 'unassigned' WHERE status = 'available';

-- Step 3: Add new constraint (succeeds because all rows match allowed values)
ALTER TABLE public.devices ADD CONSTRAINT devices_status_check 
  CHECK (status IN ('unassigned', 'active', 'inactive', 'faulty', 'retired'));

-- Step 4: Restore assigned_at column on public.devices table
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Step 5: Backfill assigned_at timestamp for assigned devices
UPDATE public.devices 
SET assigned_at = COALESCE(updated_at, created_at) 
WHERE business_id IS NOT NULL AND assigned_at IS NULL;

-- Step 6: Set default value for future device creation to 'unassigned'
ALTER TABLE public.devices ALTER COLUMN status SET DEFAULT 'unassigned';

-- Step 7: Idempotent Supabase Realtime Publication Setup (Ignores 42710 duplicate errors)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tapx_orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tapx_appointments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_feedback;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_rewards;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
