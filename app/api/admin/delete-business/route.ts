import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

    // 1. Authenticate caller
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing session token." },
        { status: 401 }
      );
    }

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAuthClient.auth.getUser(token);

    if (authError || !caller) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session." },
        { status: 401 }
      );
    }

    // 2. Strict admin check via tapx_admin_users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminRow, error: adminLookupError } = await supabaseAdmin
      .from("tapx_admin_users")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (adminLookupError || !adminRow) {
      return NextResponse.json(
        { error: "Forbidden: Caller is not a TAPX admin." },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const { businessId } = body;

    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json(
        { error: "Bad Request: Missing or invalid businessId." },
        { status: 400 }
      );
    }

    // Verify target business exists
    const { data: targetBiz, error: targetErr } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (targetErr || !targetBiz) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    // 4. CASCADE CLEANUP OF ALL TIED DATA

    // A. Devices: return to unassigned inventory (status = 'unassigned')
    const { error: devErr } = await supabaseAdmin
      .from("devices")
      .update({
        business_id: null,
        status: "unassigned",
        assigned_at: null,
      })
      .eq("business_id", businessId);

    if (devErr) {
      return NextResponse.json(
        { error: `Failed to unassign devices: ${devErr.message}` },
        { status: 500 }
      );
    }

    // B. tapx_client_users mapping
    const { error: cuErr } = await supabaseAdmin
      .from("tapx_client_users")
      .delete()
      .eq("business_id", businessId);

    if (cuErr) {
      console.warn("Error deleting tapx_client_users mapping:", cuErr.message);
    }

    // C. business_features
    const { error: bfErr } = await supabaseAdmin
      .from("business_features")
      .delete()
      .eq("business_id", businessId);

    if (bfErr) {
      console.warn("Error deleting business_features:", bfErr.message);
    }

    // D. business_module_configs
    const { error: bmcErr } = await supabaseAdmin
      .from("business_module_configs")
      .delete()
      .eq("business_id", businessId);

    if (bmcErr) {
      console.warn("Error deleting business_module_configs:", bmcErr.message);
    }

    // E. interactions
    const { error: intErr } = await supabaseAdmin
      .from("interactions")
      .delete()
      .eq("business_id", businessId);

    if (intErr) {
      console.warn("Error deleting interactions:", intErr.message);
    }

    // F. tapx_orders
    const { error: ordErr } = await supabaseAdmin
      .from("tapx_orders")
      .delete()
      .eq("business_id", businessId);

    if (ordErr) {
      console.warn("Error deleting tapx_orders:", ordErr.message);
    }

    // G. loyalty_memberships & loyalty_transactions
    try {
      await supabaseAdmin
        .from("loyalty_transactions")
        .delete()
        .eq("business_id", businessId);
    } catch (e) {}

    try {
      await supabaseAdmin
        .from("loyalty_memberships")
        .delete()
        .eq("business_id", businessId);
    } catch (e) {}

    // H. Optional tables that reference business_id
    const optionalTables = [
      "offers",
      "customer_requests",
      "customer_feedback",
      "tapx_appointments",
      "hardware_requests",
      "hotel_requests",
      "hotel_services",
      "hotel_categories",
    ];

    for (const table of optionalTables) {
      try {
        await supabaseAdmin.from(table).delete().eq("business_id", businessId);
      } catch (e) {
        // Table may not exist or not have business_id column
      }
    }

    // I. Call RPC delete_tapx_business as safety fallback
    try {
      await supabaseAdmin.rpc("delete_tapx_business", { p_business_id: businessId });
    } catch (e) {
      // Ignore RPC errors if tables were already cleaned
    }

    // J. Finally, delete the business row itself
    const { error: deleteBizErr } = await supabaseAdmin
      .from("businesses")
      .delete()
      .eq("id", businessId);

    if (deleteBizErr) {
      return NextResponse.json(
        { error: `Failed to delete business: ${deleteBizErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Business "${targetBiz.name}" and all associated data deleted successfully.`,
    });
  } catch (err: any) {
    console.error("Unhandled error in delete-business API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
