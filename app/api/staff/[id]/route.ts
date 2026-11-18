import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/server/supabaseAdmin";
import { requireBusinessOwner } from "../../../lib/server/staffAuth";

// PATCH /api/staff/[id]
export async function PATCH(
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

    // Require ownership of this staff member's business
    const auth = await requireBusinessOwner(req, staff.business_id);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { name, role, is_active } = body || {};

    const updateFields: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName || trimmedName.length > 80) {
        return NextResponse.json(
          { error: "Staff name is required (max 80 characters)." },
          { status: 400 }
        );
      }
      updateFields.name = trimmedName;
    }

    if (role !== undefined) {
      if (role !== "waiter" && role !== "kitchen") {
        return NextResponse.json(
          { error: "Invalid role. Must be 'waiter' or 'kitchen'." },
          { status: 400 }
        );
      }
      updateFields.role = role;
    }

    if (is_active !== undefined) {
      const activeBool = Boolean(is_active);
      updateFields.is_active = activeBool;

      if (!activeBool) {
        // Deactivating: ban auth user for long duration to invalidate sessions
        await admin.auth.admin.updateUserById(staff.user_id, {
          ban_duration: "876000h",
        });
      } else {
        // Reactivating: verify phone is not active in another account
        const { data: existingActive } = await admin
          .from("tapx_staff")
          .select("id")
          .eq("phone", staff.phone)
          .eq("is_active", true)
          .neq("id", id)
          .maybeSingle();

        if (existingActive) {
          return NextResponse.json(
            { error: "Cannot reactivate: mobile number is already in use by another active staff member." },
            { status: 400 }
          );
        }

        // Unban auth user
        await admin.auth.admin.updateUserById(staff.user_id, {
          ban_duration: "none",
        });
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No fields provided to update." }, { status: 400 });
    }

    const { data: updatedStaff, error: updateErr } = await admin
      .from("tapx_staff")
      .update(updateFields)
      .eq("id", id)
      .select("id, name, phone, role, is_active, last_login_at, locked_until, created_at")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ staff: updatedStaff });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
