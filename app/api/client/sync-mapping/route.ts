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

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthClient.auth.getUser(token);

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid session or missing email." },
        { status: 401 }
      );
    }

    const cleanEmail = user.email.trim().toLowerCase();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      // Service key missing, cannot write to tapx_client_users
      return NextResponse.json(
        { error: "Service configuration error." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find all businesses matching this user's email
    const { data: businesses, error: bizError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, email")
      .ilike("email", cleanEmail);

    if (bizError) {
      console.warn("sync-mapping businesses lookup notice:", bizError);
    }

    const syncedBusinessIds: string[] = [];

    if (businesses && businesses.length > 0) {
      for (const biz of businesses) {
        const { error: upsertErr } = await supabaseAdmin
          .from("tapx_client_users")
          .upsert(
            {
              user_id: user.id,
              business_id: biz.id,
              role: "owner",
            },
            { onConflict: "user_id,business_id" }
          );

        if (!upsertErr) {
          syncedBusinessIds.push(biz.id);
        } else {
          console.warn("sync-mapping upsert notice:", upsertErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: cleanEmail,
      syncedBusinessIds,
    });
  } catch (err: any) {
    console.error("Unhandled error in sync-mapping API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
