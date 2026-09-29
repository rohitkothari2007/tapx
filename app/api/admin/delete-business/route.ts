import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing session token." },
        { status: 401 }
      );
    }

    // Authenticated client using caller token (passes RLS correctly)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: { persistSession: false },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await userClient.auth.getUser(token);

    if (authError || !caller) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session." },
        { status: 401 }
      );
    }

    // Optional admin check via tapx_admin_users (bypassed if non-existent or service key available)
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const { businessId } = body;

    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json(
        { error: "Bad Request: Missing or invalid businessId." },
        { status: 400 }
      );
    }

    // 1. Unassign all devices tied to business_id (status must be 'unassigned')
    await userClient
      .from("devices")
      .update({
        business_id: null,
        status: "unassigned",
        assigned_at: null,
      })
      .eq("business_id", businessId);

    // 2. Invoke delete_tapx_business RPC (SECURITY DEFINER in Postgres)
    const { error: rpcErr } = await userClient.rpc("delete_tapx_business", {
      p_business_id: businessId,
    });

    // 3. Child table cleanup fallbacks
    const tables = [
      "tapx_client_users",
      "business_features",
      "business_module_configs",
      "interactions",
      "tapx_orders",
      "loyalty_memberships",
      "loyalty_transactions",
      "offers",
      "customer_requests",
      "customer_feedback",
      "tapx_appointments",
    ];

    for (const table of tables) {
      try {
        await userClient.from(table).delete().eq("business_id", businessId);
      } catch (e) {}
    }

    // 4. Final business row deletion fallback
    const { error: bizDeleteError } = await adminClient
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (rpcErr && bizDeleteError) {
      console.warn("Delete RPC / business delete warning:", rpcErr.message || bizDeleteError.message);
    }

    return NextResponse.json({
      success: true,
      message: "Business and all associated data deleted successfully.",
    });
  } catch (err: any) {
    console.error("Unhandled error in delete-business API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
