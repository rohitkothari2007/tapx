import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. AUTHENTICATION CHECK: Caller must provide bearer token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing session token." },
        { status: 401 }
      );
    }

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

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

    // Determine database client: prefer service key if available, fallback to caller's authenticated client
    const supabaseDb = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabaseAuthClient;

    // 2. ADMIN CHECK: Caller must be in tapx_admin_users
    const { data: adminRow, error: adminLookupError } = await supabaseDb
      .from("tapx_admin_users")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (adminLookupError) {
      console.error("Admin lookup failed:", adminLookupError);
      return NextResponse.json(
        { error: "Server error verifying admin access." },
        { status: 500 }
      );
    }

    if (!adminRow) {
      return NextResponse.json(
        { error: "Forbidden: Caller is not a TAPX admin." },
        { status: 403 }
      );
    }

    // 3. PARSE & VALIDATE REQUEST BODY
    const body = await req.json();
    const { businessId, ownerEmail } = body;

    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json(
        { error: "Bad Request: Missing or invalid businessId." },
        { status: 400 }
      );
    }

    if (!ownerEmail || typeof ownerEmail !== "string" || !ownerEmail.includes("@")) {
      return NextResponse.json(
        { error: "Bad Request: Missing or invalid ownerEmail." },
        { status: 400 }
      );
    }

    const cleanEmail = ownerEmail.trim().toLowerCase();

    // Verify target business exists
    const { data: business, error: businessError } = await supabaseDb
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    let targetUserId: string | null = null;
    let isNewUser = false;

    // Special Case: Caller is assigning themselves (e.g. Admin is also the Business Owner)
    if (caller.email?.toLowerCase() === cleanEmail) {
      targetUserId = caller.id;
    } else if (supabaseServiceKey) {
      // Use Admin API to lookup existing user or invite new user
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      const existingUser = (listData?.users || []).find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );

      if (existingUser) {
        targetUserId = existingUser.id;
      } else {
        isNewUser = true;
        const origin =
          req.headers.get("origin") ||
          req.headers.get("referer") ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "http://localhost:3000";

        const { data: inviteData, error: inviteError } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
            redirectTo: `${origin}/client/set-password`,
          });

        if (inviteError || !inviteData.user) {
          console.error("Invite error:", inviteError);
          return NextResponse.json(
            { error: `Failed to send invite: ${inviteError?.message}` },
            { status: 500 }
          );
        }

        targetUserId = inviteData.user.id;
      }
    } else {
      // Service key not present: check if user is caller or return instructions
      return NextResponse.json(
        {
          error:
            "Admin service key missing. To invite a new user, SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables.",
        },
        { status: 500 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Unable to resolve target user ID for owner email." },
        { status: 400 }
      );
    }

    // 4. LINK USER TO BUSINESS IN tapx_client_users (UPSERT)
    const { error: mapError } = await supabaseDb
      .from("tapx_client_users")
      .upsert(
        {
          user_id: targetUserId,
          business_id: businessId,
          role: "owner",
        },
        { onConflict: "user_id,business_id" }
      );

    if (mapError) {
      console.error("Error mapping client user:", mapError);
      return NextResponse.json(
        { error: `Failed to link owner access: ${mapError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isNewUser
        ? `Owner invitation sent to ${cleanEmail}.`
        : `User ${cleanEmail} linked to business ${business.name}.`,
      userId: targetUserId,
      isNewUser,
      businessId,
    });
  } catch (err: any) {
    console.error("Unhandled error in create-owner API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
