import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Normalises an Indian mobile number.
 * Strips non-digits, drops leading 91 (if 12 digits) or 0 (if 11 digits).
 * Returns exactly 10 digits starting with 6-9, or null if invalid.
 */
export function normalizeStaffPhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  let digits = input.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (/^[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}

/**
 * Generates synthetic auth email for Supabase Auth.
 * Format: s<phone>.<first 8 chars of business id>@staff.tapx.example.com
 */
export function makeStaffAuthEmail(phone10: string, businessId: string): string {
  const cleanBiz = businessId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return `s${phone10}.${cleanBiz}@staff.tapx.example.com`;
}

/**
 * Generates a random 6-digit PIN.
 * Avoids trivial sequences (e.g. 123456, 654321) and identical digits (e.g. 000000, 111111).
 */
export function generateStaffPin(): string {
  const disallowed = new Set([
    "000000", "111111", "222222", "333333", "444444",
    "555555", "666666", "777777", "888888", "999999",
    "123456", "234567", "345678", "456789", "567890",
    "654321", "765432", "876543", "987654", "098765",
  ]);

  while (true) {
    const num = crypto.randomInt(100000, 1000000);
    const pin = num.toString().padStart(6, "0");
    if (!disallowed.has(pin)) {
      return pin;
    }
  }
}

export type BusinessOwnerAuthSuccess = {
  user: User;
  businessId: string;
};

/**
 * Validates that the request caller is authorized as an owner of the given businessId.
 * Validates Bearer token, allows if:
 *  - row in tapx_admin_users;
 *  - row in tapx_client_users with role='owner' for businessId;
 *  - businesses.email equals caller's email (case-insensitive).
 * Rejects staff accounts with 403.
 * Returns { user, businessId } on success, or a NextResponse on failure.
 */
export async function requireBusinessOwner(
  req: NextRequest,
  businessId: string
): Promise<BusinessOwnerAuthSuccess | NextResponse> {
  if (!businessId || typeof businessId !== "string") {
    return NextResponse.json(
      { error: "Bad Request: businessId is required." },
      { status: 400 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

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

  // Reject staff accounts immediately: staff must never access owner routes
  if (caller.email?.includes("@staff.tapx.example.com")) {
    return NextResponse.json(
      { error: "Forbidden: Staff accounts cannot access owner APIs." },
      { status: 403 }
    );
  }

  let adminClient;
  try {
    adminClient = supabaseAdmin();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Service key error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Double check if caller is registered in tapx_staff
  const { data: staffRow } = await adminClient
    .from("tapx_staff")
    .select("id")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (staffRow) {
    return NextResponse.json(
      { error: "Forbidden: Staff accounts cannot access owner APIs." },
      { status: 403 }
    );
  }

  // 1. Check if caller is TAPX Admin
  const { data: adminRow } = await adminClient
    .from("tapx_admin_users")
    .select("id")
    .eq("user_id", caller.id)
    .maybeSingle();

  if (adminRow) {
    return { user: caller, businessId };
  }

  // 2. Check if caller has role='owner' in tapx_client_users for this business
  const { data: clientUserRow } = await adminClient
    .from("tapx_client_users")
    .select("id, role")
    .eq("user_id", caller.id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (clientUserRow && clientUserRow.role === "owner") {
    return { user: caller, businessId };
  }

  // 3. Check if businesses.email matches caller email (case-insensitive)
  if (caller.email) {
    const { data: bizRow } = await adminClient
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .ilike("email", caller.email)
      .maybeSingle();

    if (bizRow) {
      return { user: caller, businessId };
    }
  }

  return NextResponse.json(
    { error: "Forbidden: You are not authorized to manage this business." },
    { status: 403 }
  );
}
