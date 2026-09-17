import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Notice ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    // 1. Identify caller
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    // 2. Fetch caller staff info
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

    let customRolesMap: Record<string, string> = {}
    let branchAssignmentsMap: Record<string, string[]> = {}
    let noticeBranchAssignments: Record<string, string[]> = {}

    try {
      const { data: settingRows } = await admin
        .from("site_settings")
        .select("key, value")
        .in("key", ["staff_custom_roles", "staff_branch_assignments", "notice_branch_assignments"])

      if (settingRows) {
        settingRows.forEach(row => {
          if (row.key === "staff_custom_roles" && row.value) {
            try { customRolesMap = JSON.parse(row.value) } catch {}
          }
          if (row.key === "staff_branch_assignments" && row.value) {
            try { branchAssignmentsMap = JSON.parse(row.value) } catch {}
          }
          if (row.key === "notice_branch_assignments" && row.value) {
            try { noticeBranchAssignments = JSON.parse(row.value) } catch {}
          }
        })
      }
    } catch {}

    const callerRole = (callerStaff?.id && customRolesMap[callerStaff.id]) || callerStaff?.role || "owner"

    // Determine branch permissions for caller
    let isAllBranchesPermitted = false
    let permittedBranchIds: string[] = []

    if (callerRole === "owner") {
      isAllBranchesPermitted = true
    } else {
      const staffBranches: string[] = []
      if (callerStaff?.branch_id) staffBranches.push(callerStaff.branch_id)
      if (Array.isArray(callerStaff?.branch_ids)) {
        callerStaff.branch_ids.forEach((b: string) => {
          if (!staffBranches.includes(b)) staffBranches.push(b)
        })
      }
      if (callerStaff?.id && Array.isArray(branchAssignmentsMap[callerStaff.id])) {
        branchAssignmentsMap[callerStaff.id].forEach((b: string) => {
          if (!staffBranches.includes(b)) staffBranches.push(b)
        })
      }

      if (callerRole === "super_manager" && staffBranches.length === 0) {
        isAllBranchesPermitted = true
      } else {
        isAllBranchesPermitted = false
        permittedBranchIds = staffBranches
      }
    }

    // 3. If caller is restricted, verify they have permission to delete this notice
    if (!isAllBranchesPermitted) {
      const { data: existingNotice } = await admin
        .from("notices")
        .select("*")
        .eq("id", id)
        .maybeSingle()

      if (!existingNotice) {
        return NextResponse.json({ error: "Notice not found." }, { status: 404 })
      }

      const assignedBranches = noticeBranchAssignments[id] || (existingNotice.branch_ids || (existingNotice.branch_id ? [existingNotice.branch_id] : []))
      if (assignedBranches.length === 0) {
        // Global notice cannot be deleted by restricted staff
        return NextResponse.json(
          {
            error: "সার্বজনীন (Global) নোটিশ মুছে ফেলার অনুমতি শুধুমাত্র প্রধান প্রশাসকের আছে।",
          },
          { status: 403 }
        )
      }

      const hasOverlap = assignedBranches.some((b: string) => permittedBranchIds.includes(b))
      if (!hasOverlap) {
        return NextResponse.json(
          {
            error: "অন্য শাখার নোটিশ মুছে ফেলার অনুমতি আপনার নেই।",
          },
          { status: 403 }
        )
      }
    }

    // 4. Delete the notice
    const { error: deleteError } = await admin.from("notices").delete().eq("id", id)
    if (deleteError) throw deleteError

    // 5. Remove from notice_branch_assignments in site_settings
    if (noticeBranchAssignments[id]) {
      delete noticeBranchAssignments[id]
      try {
        await admin.from("site_settings").upsert({
          key: "notice_branch_assignments",
          value: JSON.stringify(noticeBranchAssignments),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" })
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Notice delete error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to delete notice" },
      { status: 500 }
    )
  }
}
