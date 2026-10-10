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

    // 2. ADMIN CHECK: Check membership in tapx_admin_users
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

    // Always update business table email field
    await supabaseAdmin
      .from("businesses")
      .update({ email: cleanEmail })
      .eq("id", businessId);

    // 4. FIND OR RESOLVE AUTH USER
    let targetUserId: string | null = null;
    let isNewUser = false;

    // A) Service Role Client (if SUPABASE_SERVICE_ROLE_KEY is present)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
          const updatePayload: any = { email_confirm: true };
          if (password && typeof password === "string" && password.trim().length > 0) {
            updatePayload.password = password.trim();
          }
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);
        } else {
          isNewUser = true;
          const initialPassword = password || "Password123!";
          const { data: createdData } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: initialPassword,
            email_confirm: true,
            user_metadata: { role: "owner", business_id: businessId },
          });

          if (createdData?.user?.id) {
            targetUserId = createdData.user.id;
          }
        }
      } catch (adminAuthErr) {
        console.warn("Admin Auth API notice:", adminAuthErr);
      }
    }

    // B) Try signInWithPassword (for existing users with known password)
    if (!targetUserId) {
      const initialPassword = password || "Password123!";
      const { data: signInData } = await supabaseAuthClient.auth.signInWithPassword({
        email: cleanEmail,
        password: initialPassword,
      });

      if (signInData?.user?.id) {
        targetUserId = signInData.user.id;
      }
    }

    // C) Try signUp (for new users)
    if (!targetUserId) {
      const initialPassword = password || "Password123!";
      const { data: signUpData } = await supabaseAuthClient.auth.signUp({
        email: cleanEmail,
        password: initialPassword,
      });

      if (signUpData?.user?.id) {
        targetUserId = signUpData.user.id;
        isNewUser = true;
      }
    }

    // D) Fallback: Check existing mappings in tapx_client_users for any matching business
    if (!targetUserId) {
      const { data: existingBiz } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .ilike("email", cleanEmail);

      if (existingBiz && existingBiz.length > 0) {
        const bizIds = existingBiz.map((b) => b.id);
        const { data: existingMap } = await supabaseAdmin
          .from("tapx_client_users")
          .select("user_id")
          .in("business_id", bizIds)
          .maybeSingle();

        if (existingMap?.user_id) {
          targetUserId = existingMap.user_id;
        }
      }
    }

    // E) If targetUserId is resolved, map it in tapx_client_users
    if (targetUserId) {
      // Clear old mappings for this business first to prevent duplicate owners
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
        console.warn("Client user mapping notice:", mapError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: targetUserId
        ? (isNewUser ? `Owner account created for ${cleanEmail}.` : `Owner login email updated to ${cleanEmail} for ${business.name}.`)
        : `Owner email set to ${cleanEmail} for ${business.name}. Account will auto-link on first login.`,
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
