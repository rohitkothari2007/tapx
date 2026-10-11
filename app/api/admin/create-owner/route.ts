import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY is missing from environment variables." },
        { status: 500 }
      );
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. AUTHENTICATION CHECK: Caller must provide valid session token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing session token." },
        { status: 401 }
      );
    }

    // Authenticated client representing the caller (TAPX admin)
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser(token);

    if (authError || !caller) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session." },
        { status: 401 }
      );
    }

    // 2. ADMIN CHECK: Check membership in tapx_admin_users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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

    // 3. PARSE & VALIDATE REQUEST BODY
    const body = await req.json();
    const { businessId, ownerEmail, password } = body;

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

    // Verify target business exists using callerClient (authenticated admin) or supabaseAdmin
    let business: { id: string; name: string } | null = null;

    const { data: bCaller } = await callerClient
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .maybeSingle();

    if (bCaller) {
      business = bCaller;
    } else {
      const { data: bAdmin } = await supabaseAdmin
        .from("businesses")
        .select("id, name")
        .eq("id", businessId)
        .maybeSingle();
      if (bAdmin) {
        business = bAdmin;
      }
    }

    if (!business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    // Always update business table email field
    await callerClient
      .from("businesses")
      .update({ email: cleanEmail })
      .eq("id", businessId);

    // 4. FIND OR CREATE AUTH USER IN SUPABASE AUTH
    let targetUserId: string | null = null;
    let isNewUser = false;
    const cleanPassword = password && typeof password === "string" && password.trim().length > 0
      ? password.trim()
      : "Password123!";

    // Query auth users list
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.warn("listUsers notice:", listError);
    }

    const existingUser = (listData?.users || []).find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (existingUser) {
      targetUserId = existingUser.id;
      const updatePayload: any = { email_confirm: true };
      if (cleanPassword) {
        updatePayload.password = cleanPassword;
      }
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        updatePayload
      );
      if (updateErr) {
        console.error("updateUserById error:", updateErr);
        return NextResponse.json(
          { error: `Failed to update owner credentials: ${updateErr.message}` },
          { status: 500 }
        );
      }
    } else {
      isNewUser = true;
      const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: { role: "owner", business_id: businessId },
      });

      if (createdData?.user?.id) {
        targetUserId = createdData.user.id;
      } else if (createError) {
        console.warn("createUser error, attempting recovery:", createError);
        // If user already exists (race condition or duplicate email in auth)
        const { data: retryList } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const retryUser = (retryList?.users || []).find(
          (u: any) => u.email?.toLowerCase() === cleanEmail
        );
        if (retryUser) {
          targetUserId = retryUser.id;
          await supabaseAdmin.auth.admin.updateUserById(retryUser.id, {
            email_confirm: true,
            password: cleanPassword,
          });
        } else {
          return NextResponse.json(
            { error: `Failed to create owner user: ${createError.message}` },
            { status: 500 }
          );
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Could not create or resolve owner account in Supabase Auth." },
        { status: 500 }
      );
    }

    // 5. MAP USER TO BUSINESS IN tapx_client_users (using supabaseAdmin service role)
    await supabaseAdmin
      .from("tapx_client_users")
      .delete()
      .eq("business_id", businessId);

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
      console.error("Client user mapping error:", mapError);
      return NextResponse.json(
        { error: `Owner auth prepared, but linking to business workspace failed: ${mapError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isNewUser
        ? `Owner account created and activated for ${cleanEmail}.`
        : `Owner login email and password updated for ${cleanEmail} (${business.name}).`,
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
