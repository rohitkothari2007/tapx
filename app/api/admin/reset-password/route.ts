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

    const body = await req.json();
    const { email, newPassword, requestId, businessId } = body;

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

    // Direct password update / user provisioning if newPassword provided
    let passwordUpdated = false;
    let targetUserId: string | null = null;

    if (newPassword && typeof newPassword === "string" && newPassword.trim().length > 0) {
      const cleanPassword = newPassword.trim();

      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      const targetUser = (listData?.users || []).find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );

      if (targetUser) {
        targetUserId = targetUser.id;
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
          targetUser.id,
          {
            password: cleanPassword,
            email_confirm: true,
          }
        );
        if (!updateErr) {
          passwordUpdated = true;
        } else {
          console.error("Admin updateUserById error:", updateErr);
          return NextResponse.json(
            { error: `Failed to update password: ${updateErr.message}` },
            { status: 500 }
          );
        }
      } else {
        // Create user if not existing in auth.users
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: { role: "owner" },
        });

        if (newUser?.user?.id) {
          targetUserId = newUser.user.id;
          passwordUpdated = true;
        } else {
          console.error("Admin createUser error in reset-password:", createErr);
          return NextResponse.json(
            { error: `Failed to provision user: ${createErr?.message || "Unknown error"}` },
            { status: 500 }
          );
        }
      }

      // Auto-link owner into tapx_client_users for all matching businesses
      if (targetUserId) {
        let matchingBizIds: string[] = [];

        if (businessId) {
          matchingBizIds.push(businessId);
        }

        // Also query businesses with matching email using callerClient
        const { data: bizList } = await callerClient
          .from("businesses")
          .select("id")
          .ilike("email", cleanEmail);

        if (bizList) {
          bizList.forEach((b) => {
            if (!matchingBizIds.includes(b.id)) matchingBizIds.push(b.id);
          });
        }

        try {
          for (const bId of matchingBizIds) {
            await supabaseAdmin.from("tapx_client_users").upsert(
              {
                user_id: targetUserId,
                business_id: bId,
                role: "owner",
              },
              { onConflict: "user_id,business_id" }
            );
          }
        } catch (mapErr) {
          console.warn("reset-password tapx_client_users mapping notice:", mapErr);
        }
      }
    } else {
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

      if (resetErr) {
        console.warn("resetPasswordForEmail notice:", resetErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: passwordUpdated
        ? `Password for ${cleanEmail} updated successfully and account activated.`
        : `Password reset link sent to ${cleanEmail}.`,
      passwordUpdated,
      email: cleanEmail,
      userId: targetUserId,
    });
  } catch (err: any) {
    console.error("Unhandled error in reset-password API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
