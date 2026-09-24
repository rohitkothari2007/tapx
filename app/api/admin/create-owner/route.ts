import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    // 1. ENVIRONMENT CHECK: Use SUPABASE_SERVICE_ROLE_KEY if present, fallback to ANON key
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

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

    if (adminLookupError || !adminRow) {
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

    // Update business table email field
    await supabaseAdmin
      .from("businesses")
      .update({ email: cleanEmail })
      .eq("id", businessId);

    // 5. EXISTING USER VS NEW USER INVITATION
    let targetUserId: string | null = null;
    let isNewUser = false;

    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      const existingUser = (listData?.users || []).find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );

      if (existingUser) {
        targetUserId = existingUser.id;
      } else if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        isNewUser = true;
        const origin =
          req.headers.get("origin") ||
          req.headers.get("referer") ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "http://localhost:3000";

        const { data: inviteData } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
            redirectTo: origin + "/client/set-password",
          });

        if (inviteData?.user?.id) {
          targetUserId = inviteData.user.id;
        }
      }
    } catch (err) {
      console.warn("Auth admin lookup skipped:", err);
    }

    if (!targetUserId) {
      targetUserId = caller.id;
    }

    // 6. RE-MAP USER TO BUSINESS IN tapx_client_users
    // Clear old mappings for this business first
    try {
      await supabaseAdmin
        .from("tapx_client_users")
        .delete()
        .eq("business_id", businessId);

      await supabaseAdmin
        .from("tapx_client_users")
        .insert({
          user_id: targetUserId,
          business_id: businessId,
          role: "owner",
        });
    } catch (mapErr) {
      console.warn("Client user mapping table update:", mapErr);
    }

    return NextResponse.json({
      success: true,
      message: isNewUser
        ? "Owner invitation sent to " + cleanEmail + "."
        : "Owner login email updated to " + cleanEmail + " for business " + business.name + ".",
      userId: targetUserId,
      isNewUser,
      businessId,
      ownerEmail: cleanEmail,
    });
  } catch (err: any) {
    console.error("Unhandled error in create-owner API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
