const supabaseUrl = "https://nzxmwerhrauqidinktgp.supabase.co";
const supabaseAnonKey = "sb_publishable_GrBbQ2JntO_aq1hSGajPYA_xoEpxR8Q";

async function addAssignedAtColumn() {
  console.log("Adding assigned_at column to devices table...");
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      sql_query: `
        ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
        UPDATE public.devices SET assigned_at = COALESCE(updated_at, created_at) WHERE business_id IS NOT NULL AND assigned_at IS NULL;
      `
    })
  });

  console.log("RPC Status:", res.status);
  const text = await res.text();
  console.log("RPC Response:", text);
}

addAssignedAtColumn();
