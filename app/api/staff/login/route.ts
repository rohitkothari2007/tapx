import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin";
import { normalizeStaffPhone, makeStaffAuthEmail } from "../../../lib/server/staffAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// In-memory rate limiting map for IP brute-force protection
// Limitation: In-memory store resets on serverless function cold restart or across multiple serverless instances
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || now > record.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (record.count >= 20) {
    return false;
  }
  record.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Check IP rate limit
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    if (!checkIpRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts from this network. Try again later in 10 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { phone, pin } = body || {};

    const cleanPhone = normalizeStaffPhone(phone);
    const trimmedPin = typeof pin === "string" ? pin.trim() : "";

    // Always generic error if format is invalid
    if (!cleanPhone || !/^\d{6}$/.test(trimmedPin)) {
      return NextResponse.json(
        { error: "Wrong mobile number or PIN" },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = supabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: "Staff service not configured" },
        { status: 500 }
      );
    }

    // 2. Look up active staff row
    const { data: staff, error: fetchErr } = await admin
      .from("tapx_staff")
      .select("id, business_id, user_id, name, phone, role, is_active, failed_attempts, locked_until")
      .eq("phone", cleanPhone)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchErr) {
      if (fetchErr.message?.includes("does not exist") || fetchErr.code === "42P01") {
        return NextResponse.json(
          { error: "Staff feature is not enabled on the server yet." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Wrong mobile number or PIN" }, { status: 400 });
    }

    if (!staff) {
      // User not found or inactive: generic error (no enumeration)
      return NextResponse.json(
        { error: "Wrong mobile number or PIN" },
        { status: 400 }
      );
    }

    // 3. Check account lockout
    if (staff.locked_until) {
      const lockTime = new Date(staff.locked_until).getTime();
      const now = Date.now();
      if (lockTime > now) {
        const remainingMinutes = Math.max(1, Math.ceil((lockTime - now) / 60000));
        return NextResponse.json(
          { error: `Too many attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.` },
          { status: 429 }
        );
      }
    }

    // 4. Verify PIN with Supabase Auth using synthetic email
    let syntheticEmail: string;
    try {
      syntheticEmail = makeStaffAuthEmail(cleanPhone, staff.business_id);
    } catch {
      return NextResponse.json(
        { error: "Staff service not configured" },
        { status: 500 }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: trimmedPin,
    });

    if (authErr || !authData.session) {
      // Wrong PIN: increment failed attempts
      const currentFailed = staff.failed_attempts || 0;
      const nextFailed = currentFailed + 1;
      const updates: Record<string, unknown> = { failed_attempts: nextFailed };

      if (nextFailed >= 5) {
        updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      await admin.from("tapx_staff").update(updates).eq("id", staff.id);

      if (nextFailed >= 5) {
        return NextResponse.json(
          { error: "Too many attempts. Try again in 15 minutes." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Wrong mobile number or PIN" },
        { status: 400 }
      );
    }

    // 5. Success: reset counters & record last login
    await admin
      .from("tapx_staff")
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq("id", staff.id);

    // Fetch business name
    const { data: biz } = await admin
      .from("businesses")
      .select("name")
      .eq("id", staff.business_id)
      .maybeSingle();

    return NextResponse.json({
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      role: staff.role,
      name: staff.name,
      businessName: biz?.name || "Restaurant",
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message?.includes("STAFF_AUTH_SECRET")) {
      return NextResponse.json({ error: "Staff service not configured" }, { status: 500 });
    }
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
