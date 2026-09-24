import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

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

    // STRICT ADMIN CHECK via tapx_admin_users
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

    // Query tapx_client_users mappings
    const { data: clientUsers, error: cuError } = await supabaseAdmin
      .from("tapx_client_users")
      .select("business_id, user_id, role");

    if (cuError) {
      return NextResponse.json({ error: cuError.message }, { status: 500 });
    }

    const owners: Record<string, string> = {};

    // Try resolving emails via auth.admin if service role available
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    }).catch(() => ({ data: null }));

    const userEmailMap = new Map<string, string>();
    if (listData?.users) {
      listData.users.forEach((u) => {
        if (u.id && u.email) {
          userEmailMap.set(u.id, u.email);
        }
      });
    }

    // Also fallback to businesses table emails if auth list unavailable
    const { data: businessRows } = await supabaseAdmin.from("businesses").select("id, email");
    const businessEmailMap = new Map<string, string>();
    (businessRows || []).forEach((b) => {
      if (b.id && b.email) businessEmailMap.set(b.id, b.email);
    });

    (clientUsers || []).forEach((cu) => {
      const emailFromAuth = userEmailMap.get(cu.user_id);
      const emailFromBiz = businessEmailMap.get(cu.business_id);
      const resolvedEmail = emailFromAuth || emailFromBiz;
      if (resolvedEmail) {
        owners[cu.business_id] = resolvedEmail;
      }
    });

    return NextResponse.json({ owners });
  } catch (err: any) {
    console.error("Unhandled error in client-owners API:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
