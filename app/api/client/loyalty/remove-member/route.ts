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

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 1. Delete associated rewards for this membership if any
    try {
      await adminClient
        .from("loyalty_rewards")
        .delete()
        .eq("membership_id", membershipId);
    } catch (e) {
      console.warn("loyalty_rewards delete note:", e);
    }

    // 2. Delete from loyalty_transactions if table exists
    try {
      await adminClient
        .from("loyalty_transactions")
        .delete()
        .eq("membership_id", membershipId);
    } catch (e) {
      // Ignore if table does not exist or has different schema
    }

    // 3. Delete the loyalty_memberships row
    const { error: delError } = await adminClient
      .from("loyalty_memberships")
      .delete()
      .eq("id", membershipId)
      .eq("business_id", businessId);

    if (delError) {
      console.error("Error deleting loyalty membership:", delError);
      return NextResponse.json(
        { error: delError.message || "Failed to delete loyalty membership." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Loyalty member removed successfully.",
    });
  } catch (err: any) {
    console.error("Unexpected error in remove-member route:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
