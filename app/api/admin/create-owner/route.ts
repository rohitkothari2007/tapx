import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    // 1. STRICT ENVIRONMENT CHECK: SUPABASE_SERVICE_ROLE_KEY MUST be present
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
      return NextResponse.json(
        { error: "Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables." },
        { status: 500 }
      );
    }

    // 2. AUTHENTICATION CHECK: Caller must provide valid session token
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

    // 3. ADMIN CHECK: Service Role Client checks membership in tapx_admin_users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: adminRow, error: adminLookupError } = await supabaseAdmin
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

    // 4. PARSE & VALIDATE REQUEST BODY
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
    const { data: business, error: businessError } = await supabaseAdmin
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

    // 5. EXISTING USER VS NEW USER INVITATION
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("Error listing auth users:", listError);
      return NextResponse.json(
        { error: "Failed to query authentication directory." },
        { status: 500 }
      );
    }

    const existingUser = (listData?.users || []).find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    let targetUserId: string;
    let isNewUser = false;

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
          redirectTo: origin + "/client/set-password",
        });

      if (inviteError || !inviteData.user) {
        console.error("Invite error:", inviteError);
        return NextResponse.json(
          { error: "Failed to send invite: " + (inviteError?.message || "Unknown error") },
          { status: 500 }
        );
      }

      targetUserId = inviteData.user.id;
    }

    // 6. LINK USER TO BUSINESS IN tapx_client_users (UPSERT)
    const { error: mapError } = await supabaseAdmin
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
        { error: "Failed to link owner access: " + mapError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isNewUser
        ? "Owner invitation sent to " + cleanEmail + "."
        : "User " + cleanEmail + " linked to business " + business.name + ".",
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
