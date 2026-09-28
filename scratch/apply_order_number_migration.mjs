import fs from "fs";

const envText = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of envText.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    envVars[k] = v;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function applyOrderNumberMigration() {
  console.log("Applying order_number migration to Supabase database...");

  const sql = `
    -- 1. Add order_number column to tapx_orders
    ALTER TABLE public.tapx_orders
    ADD COLUMN IF NOT EXISTS order_number BIGINT;

    -- 2. Create business_order_sequences table
    CREATE TABLE IF NOT EXISTS public.business_order_sequences (
      business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
      last_order_number BIGINT NOT NULL DEFAULT 0
    );

    GRANT ALL ON public.business_order_sequences TO postgres, service_role, anon, authenticated;

    -- 3. Create atomic get_next_order_number function with row lock
    CREATE OR REPLACE FUNCTION public.get_next_order_number(p_business_id UUID)
    RETURNS BIGINT
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      next_num BIGINT;
    BEGIN
      INSERT INTO public.business_order_sequences (business_id, last_order_number)
      VALUES (p_business_id, 1)
      ON CONFLICT (business_id)
      DO UPDATE SET last_order_number = public.business_order_sequences.last_order_number + 1
      RETURNING last_order_number INTO next_num;

      RETURN next_num;
    END;
    $$;

    -- 4. Create trigger to automatically assign order_number before insert
    CREATE OR REPLACE FUNCTION public.set_tapx_order_number()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      IF NEW.order_number IS NULL THEN
        NEW.order_number := public.get_next_order_number(NEW.business_id);
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trigger_set_tapx_order_number ON public.tapx_orders;
    CREATE TRIGGER trigger_set_tapx_order_number
    BEFORE INSERT ON public.tapx_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_tapx_order_number();

    -- 5. Backfill existing orders sequentially per business by created_at ASC
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY created_at ASC) as seq
      FROM public.tapx_orders
    )
    UPDATE public.tapx_orders o
    SET order_number = n.seq
    FROM numbered n
    WHERE o.id = n.id AND o.order_number IS NULL;

    -- 6. Sync business_order_sequences with max order_number
    INSERT INTO public.business_order_sequences (business_id, last_order_number)
    SELECT business_id, COALESCE(MAX(order_number), 0)
    FROM public.tapx_orders
    GROUP BY business_id
    ON CONFLICT (business_id)
    DO UPDATE SET last_order_number = EXCLUDED.last_order_number;
  `;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      sql_query: sql
    })
  });

  console.log("RPC Status:", res.status);
  const text = await res.text();
  console.log("RPC Response:", text);
}

applyOrderNumberMigration();
