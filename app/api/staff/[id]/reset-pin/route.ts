import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/server/supabaseAdmin";
import { generateStaffPin, requireBusinessOwner } from "../../../../lib/server/staffAuth";

// POST /api/staff/[id]/reset-pin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing staff id parameter." }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: staff, error: fetchErr } = await admin
      .from("tapx_staff")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

    const auth = await requireBusinessOwner(req, staff.business_id);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const { pin } = body || {};

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

    // Update auth user password & ensure not banned
    const { error: authErr } = await admin.auth.admin.updateUserById(staff.user_id, {
      password: resolvedPin,
      ban_duration: "none",
    });

    if (authErr) {
      return NextResponse.json(
        { error: `Failed to update credentials: ${authErr.message}` },
        { status: 500 }
      );
    }

    // Reset failed attempts and lockout on tapx_staff
    const { error: updateErr } = await admin
      .from("tapx_staff")
      .update({
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, pin: resolvedPin });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
