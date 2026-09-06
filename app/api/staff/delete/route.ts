import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { staff_id } = body

    if (!staff_id) {
      return NextResponse.json({ error: "Staff ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    // 1. Identify caller and verify permission
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    // Load caller's staff profile
    let { data: callerStaff } = await admin
      .from("staff")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (!callerStaff && user.email) {
      const { data: callerByEmail } = await admin
        .from("staff")
        .select("*")
        .eq("email", user.email)
        .maybeSingle()
      if (callerByEmail) callerStaff = callerByEmail
    }

    if (!callerStaff) {
      return NextResponse.json({ error: "Access denied. Caller profile not found." }, { status: 403 })
    }

    // Check custom roles in site_settings
    let customRolesMap: Record<string, string> = {}
    try {
      const { data: settingRow } = await admin
        .from("site_settings")
        .select("value")
        .eq("key", "staff_custom_roles")
        .maybeSingle()
      if (settingRow?.value) {
        customRolesMap = JSON.parse(settingRow.value)
      }
    } catch {}

    const callerRole = customRolesMap[callerStaff.id] || callerStaff.role

    if (!["owner", "branch_director", "super_manager"].includes(callerRole)) {
      return NextResponse.json(
        { error: "Access denied. Only Owners, Branch Directors, and Super Managers can delete staff members." },
        { status: 403 }
      )
    }

    // 2. Load target staff profile
    const { data: targetStaff, error: targetErr } = await admin
      .from("staff")
      .select("*")
      .eq("id", staff_id)
      .maybeSingle()

    if (targetErr || !targetStaff) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 })
    }

    const targetRole = customRolesMap[targetStaff.id] || targetStaff.role

    // Prevent deleting own account
    if (targetStaff.id === callerStaff.id) {
      return NextResponse.json({ error: "You cannot delete your own staff account." }, { status: 400 })
    }

    // Never delete Owner
    if (targetRole === "owner") {
      return NextResponse.json({ error: "Owner accounts cannot be deleted." }, { status: 400 })
    }

    // Branch Director & Super Manager hierarchy checks
    if (callerRole === "branch_director" || callerRole === "super_manager") {
      if (["owner", "branch_director", "super_manager"].includes(targetRole)) {
        return NextResponse.json(
          { error: "You do not have permission to delete executive staff members." },
          { status: 403 }
        )
      }

      // Check branch scope overlap
      let branchAssignmentsMap: Record<string, string[]> = {}
      try {
        const { data: bRow } = await admin
          .from("site_settings")
          .select("value")
          .eq("key", "staff_branch_assignments")
          .maybeSingle()
        if (bRow?.value) {
          branchAssignmentsMap = JSON.parse(bRow.value)
        }
      } catch {}

      const callerBranches: string[] = branchAssignmentsMap[callerStaff.id] ||
        callerStaff.branch_ids ||
        (callerStaff.branch_id ? [callerStaff.branch_id] : [])

      const targetBranches: string[] = branchAssignmentsMap[targetStaff.id] ||
        targetStaff.branch_ids ||
        (targetStaff.branch_id ? [targetStaff.branch_id] : [])

      if (callerBranches.length > 0 && targetBranches.length > 0) {
        const sharesBranch = targetBranches.some(bId => callerBranches.includes(bId))
        if (!sharesBranch) {
          return NextResponse.json(
            { error: "You can only delete staff members belonging to your assigned branches." },
            { status: 403 }
          )
        }
      }
    }

    // 3. Foreign Key Reference Mitigation
    // Find an owner or admin to reassign courses where teacher_id is NOT NULL
    try {
      const { data: ownerRow } = await admin
        .from("staff")
        .select("id")
        .eq("role", "owner")
        .limit(1)
        .maybeSingle()
      const fallbackOwnerId = ownerRow?.id || callerStaff.id

      await admin.from("courses").update({ teacher_id: fallbackOwnerId }).eq("teacher_id", staff_id)
    } catch (e) {
      console.warn("Could not reassign courses before staff delete:", e)
    }

    // Nullify or clean up optional foreign keys
    try {
      await admin.from("batches").update({ teacher_id: null }).eq("teacher_id", staff_id)
    } catch (e) {}

    try {
      await admin.from("payments").update({ received_by: null }).eq("received_by", staff_id)
      await admin.from("payments").update({ approved_by: null }).eq("approved_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("expenses").update({ created_by: null }).eq("created_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("enrollments").update({ enrolled_by: null }).eq("enrolled_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("exam_marks").update({ marked_by: null }).eq("marked_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("attendance").update({ entered_by: null }).eq("entered_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("certificates").update({ issued_by: null }).eq("issued_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("salary_payments").update({ paid_by: null }).eq("paid_by", staff_id)
    } catch (e) {}

    try {
      await admin.from("notifications").delete().eq("user_id", staff_id)
    } catch (e) {}

    try {
      await admin.from("staff_salaries").delete().eq("staff_id", staff_id)
    } catch (e) {}

    try {
      await admin.from("staff_branches").delete().eq("staff_id", staff_id)
    } catch (e) {}

    // 4. Remove from persistent site_settings maps
    try {
      const { data: bRow } = await admin
        .from("site_settings")
        .select("value")
        .eq("key", "staff_branch_assignments")
        .maybeSingle()
      if (bRow?.value) {
        const bMap = JSON.parse(bRow.value)
        if (bMap[staff_id]) {
          delete bMap[staff_id]
          await admin
            .from("site_settings")
            .upsert({ key: "staff_branch_assignments", value: JSON.stringify(bMap), updated_at: new Date().toISOString() })
        }
      }
    } catch (e) {}

    try {
      const { data: rRow } = await admin
        .from("site_settings")
        .select("value")
        .eq("key", "staff_custom_roles")
        .maybeSingle()
      if (rRow?.value) {
        const rMap = JSON.parse(rRow.value)
        if (rMap[staff_id]) {
          delete rMap[staff_id]
          await admin
            .from("site_settings")
            .upsert({ key: "staff_custom_roles", value: JSON.stringify(rMap), updated_at: new Date().toISOString() })
        }
      }
    } catch (e) {}

    // 5. Delete from staff table
    let hardDeleteSuccess = false
    const { error: deleteErr } = await admin.from("staff").delete().eq("id", staff_id)

    if (!deleteErr) {
      hardDeleteSuccess = true
    } else {
      console.warn("Hard delete from staff table failed, falling back to soft delete:", deleteErr)
      // Soft-delete fallback
      await admin
        .from("staff")
        .update({
          is_active: false,
          name: `[Deleted] ${targetStaff.name}`,
        })
        .eq("id", staff_id)
    }

    // 6. Delete auth user if exists
    if (targetStaff.auth_user_id) {
      try {
        await admin.auth.admin.deleteUser(targetStaff.auth_user_id)
      } catch (authDeleteErr) {
        console.warn("Could not delete auth user:", authDeleteErr)
      }
    }

    return NextResponse.json({
      success: true,
      hard_deleted: hardDeleteSuccess,
      message: `Staff member "${targetStaff.name}" has been deleted successfully.`,
    })
  } catch (err: any) {
    console.error("Error deleting staff member:", err)
    return NextResponse.json({ error: err.message || "Failed to delete staff member" }, { status: 500 })
  }
}
