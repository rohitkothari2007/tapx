import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/server/supabaseAdmin";
import {
  normalizeStaffPhone,
  makeStaffAuthEmail,
  generateStaffPin,
  requireBusinessOwner,
} from "../../lib/server/staffAuth";

// GET /api/staff?businessId=...
export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter." }, { status: 400 });
    }

    const auth = await requireBusinessOwner(req, businessId);
    if (auth instanceof NextResponse) return auth;

    const admin = supabaseAdmin();
    const { data: staffList, error } = await admin
      .from("tapx_staff")
      .select("id, name, phone, role, is_active, last_login_at, locked_until, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({
          staff: [],
          warning: "Staff feature is not enabled on the server yet.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ staff: staffList || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/staff
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, name, phone, role, pin } = body || {};

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
    }

    const auth = await requireBusinessOwner(req, businessId);
    if (auth instanceof NextResponse) return auth;

    // Validate name
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName || trimmedName.length > 80) {
      return NextResponse.json(
        { error: "Staff name is required (max 80 characters)." },
        { status: 400 }
      );
    }

    // Validate phone
    const cleanPhone = normalizeStaffPhone(phone);
    if (!cleanPhone) {
      return NextResponse.json(
        { error: "Invalid mobile number. Please enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== "waiter" && role !== "kitchen") {
      return NextResponse.json(
        { error: "Invalid role. Role must be 'waiter' or 'kitchen'." },
        { status: 400 }
      );
    }

    // Validate or generate PIN
    let resolvedPin: string;
    if (pin && typeof pin === "string" && pin.trim()) {
      const trimmedPin = pin.trim();
      if (!/^\d{6}$/.test(trimmedPin)) {
        return NextResponse.json(
          { error: "PIN must be exactly 6 numeric digits." },
          { status: 400 }
        );
      }
      resolvedPin = trimmedPin;
    } else {
      resolvedPin = generateStaffPin();
    }

    const admin = supabaseAdmin();

    // 1. Check if phone is in use by an active staff member anywhere across the platform
    const { data: activeStaff } = await admin
      .from("tapx_staff")
      .select("id, business_id")
      .eq("phone", cleanPhone)
      .eq("is_active", true)
      .maybeSingle();

    if (activeStaff) {
      return NextResponse.json(
        { error: "This mobile number is already in use by an active staff member." },
        { status: 400 }
      );
    }

    // 2. Check if phone already exists INACTIVE in this same business
    const { data: inactiveStaff } = await admin
      .from("tapx_staff")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (inactiveStaff) {
      // Reactivate existing row in this business
      // Update auth user with new password and unban
      const { error: authUpdateErr } = await admin.auth.admin.updateUserById(
        inactiveStaff.user_id,
        {
          password: resolvedPin,
          ban_duration: "none",
          user_metadata: {
            role: "staff",
            business_id: businessId,
            name: trimmedName,
          },
        }
      );

      if (authUpdateErr) {
        return NextResponse.json(
          { error: `Failed to update staff credentials: ${authUpdateErr.message}` },
          { status: 500 }
        );
      }

      // Update tapx_staff row
      const { data: reactivated, error: updateErr } = await admin
        .from("tapx_staff")
        .update({
          name: trimmedName,
          role,
          is_active: true,
          failed_attempts: 0,
          locked_until: null,
          created_by: auth.user.id,
        })
        .eq("id", inactiveStaff.id)
        .select("id, name, phone, role, is_active, last_login_at, locked_until, created_at")
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ staff: reactivated, pin: resolvedPin }, { status: 200 });
    }

    // 3. New staff account: create auth user with synthetic email
    const syntheticEmail = makeStaffAuthEmail(cleanPhone, businessId);

    const { data: authUser, error: authCreateErr } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: resolvedPin,
      email_confirm: true,
      user_metadata: {
        role: "staff",
        business_id: businessId,
        name: trimmedName,
      },
    });

    if (authCreateErr || !authUser?.user?.id) {
      return NextResponse.json(
        { error: authCreateErr?.message || "Failed to create staff auth user." },
        { status: 400 }
      );
    }

    // 4. Insert row into tapx_staff
    const { data: newStaff, error: insertErr } = await admin
      .from("tapx_staff")
      .insert({
        business_id: businessId,
        user_id: authUser.user.id,
        name: trimmedName,
        phone: cleanPhone,
        role,
        is_active: true,
        failed_attempts: 0,
        created_by: auth.user.id,
      })
      .select("id, name, phone, role, is_active, last_login_at, locked_until, created_at")
      .single();

    if (insertErr) {
      // Clean up orphaned auth user
      await admin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: `Database error: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ staff: newStaff, pin: resolvedPin }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
