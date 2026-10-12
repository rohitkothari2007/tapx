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

    const body = await req.json();
    const { membershipId, businessId } = body;

    if (!membershipId || !businessId) {
      return NextResponse.json(
        { error: "Bad Request: Missing membershipId or businessId." },
        { status: 400 }
      );
    }

    // 1. Primary path: Invoke SECURITY DEFINER RPC function
    try {
      const { data: rpcSuccess, error: rpcError } = await userClient.rpc(
        "delete_tapx_loyalty_member",
        {
          p_membership_id: membershipId,
          p_business_id: businessId,
        }
      );

      if (!rpcError) {
        return NextResponse.json({
          success: true,
          message: "Loyalty member removed successfully.",
        });
      }
      console.warn("delete_tapx_loyalty_member RPC returned:", rpcError.message);
    } catch (e: any) {
      console.warn("delete_tapx_loyalty_member RPC exception:", e?.message);
    }

    // 2. Secondary path: If SUPABASE_SERVICE_ROLE_KEY is set in environment, use adminClient
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      );

      try {
        await adminClient
          .from("loyalty_rewards")
          .delete()
          .eq("membership_id", membershipId);
      } catch (e) {}

      try {
        await adminClient
          .from("loyalty_transactions")
          .delete()
          .eq("membership_id", membershipId);
      } catch (e) {}

      const { error: adminDelError } = await adminClient
        .from("loyalty_memberships")
        .delete()
        .eq("id", membershipId)
        .eq("business_id", businessId);

      if (!adminDelError) {
        return NextResponse.json({
          success: true,
          message: "Loyalty member removed successfully via admin service role.",
        });
      }
      console.warn("Admin service client delete error:", adminDelError.message);
    }

    // 3. Fallback path: Direct delete via authenticated userClient
    try {
      await userClient
        .from("loyalty_rewards")
        .delete()
        .eq("membership_id", membershipId);
    } catch (e) {}

    try {
      await userClient
        .from("loyalty_transactions")
        .delete()
        .eq("membership_id", membershipId);
    } catch (e) {}

    const { error: userDelError } = await userClient
      .from("loyalty_memberships")
      .delete()
      .eq("id", membershipId)
      .eq("business_id", businessId);

    if (!userDelError) {
      return NextResponse.json({
        success: true,
        message: "Loyalty member removed successfully.",
      });
    }

    console.error("All loyalty delete attempts failed:", userDelError);
    return NextResponse.json(
      {
        error:
          userDelError.message ||
          "Failed to delete loyalty membership. Please ensure the SQL migration in Supabase has been run.",
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("Unexpected error in remove-member route:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
