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

    const body = await req.json();
    const { email, newPassword, requestId } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Bad Request: Missing or invalid email address." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Mark customer request as completed if requestId provided
    if (requestId) {
      await supabaseAdmin
        .from("customer_requests")
        .update({ status: "completed" })
        .eq("id", requestId);
    }

    // Direct password update if newPassword provided and service key available
    let passwordUpdated = false;
    if (newPassword && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        const targetUser = (listData?.users || []).find(
          (u: any) => u.email?.toLowerCase() === cleanEmail
        );

        if (targetUser) {
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
            targetUser.id,
            {
              password: newPassword,
              email_confirm: true,
            }
          );
          if (!updateErr) passwordUpdated = true;
        }
      } catch (adminErr) {
        console.warn("Admin password update notice:", adminErr);
      }
    }

    // Send password reset email link via Supabase Auth
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(
      cleanEmail,
      {
        redirectTo: `${origin}/client/set-password`,
      }
    );

    return NextResponse.json({
      success: true,
      message: passwordUpdated
        ? `Password for ${cleanEmail} updated successfully and reset link sent.`
        : `Password reset link sent to ${cleanEmail}.`,
      passwordUpdated,
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error("Unhandled error in reset-password API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
