import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Adaptive notice save with automatic schema detection and column fallback
async function saveNoticeAdaptive(
  adminClient: any,
  noticeId: string | undefined,
  initialPayload: Record<string, any>
) {
  let currentPayload = { ...initialPayload }

  // Clean out null/undefined/empty arrays that might cause schema issues if column is missing
  while (true) {
    const query = noticeId
      ? adminClient.from("notices").update(currentPayload).eq("id", noticeId).select("*").maybeSingle()
      : adminClient.from("notices").insert([currentPayload]).select("*").maybeSingle()

    const { data, error } = await query

    if (!error && data) {
      return data
    }

    const errMsg = (error?.message || "").toLowerCase()
    console.warn(
      `Notice save failed with keys [${Object.keys(currentPayload).join(", ")}]. Error: ${error?.message}`
    )

    // Strip branch_ids if not supported
    if (errMsg.includes("branch_ids") && "branch_ids" in currentPayload) {
      delete currentPayload.branch_ids
      continue
    }

    // Strip branch_id if not supported
    if (errMsg.includes("branch_id") && "branch_id" in currentPayload) {
      delete currentPayload.branch_id
      continue
    }

    // Strip notice_date if not supported
    if (errMsg.includes("notice_date") && "notice_date" in currentPayload) {
      delete currentPayload.notice_date
      continue
    }

    // If general schema error (e.g. PGRST204 or 42703), peel off non-core columns in order
    if ("branch_ids" in currentPayload) {
      delete currentPayload.branch_ids
      continue
    }
    if ("branch_id" in currentPayload) {
      delete currentPayload.branch_id
      continue
    }
    if ("notice_date" in currentPayload) {
      delete currentPayload.notice_date
      continue
    }

    // If only basic columns { title, content, is_active } remain and it still failed, throw
    throw error || new Error("Failed to save notice row in database.")
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      title,
      content = "",
      is_global = false,
      branch_ids = [],
      notice_date,
      is_active = true,
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Notice title is required (শিরোনাম আবশ্যক)." }, { status: 400 })
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

    // Retrieve custom roles and persistent maps from site_settings
    let customRolesMap: Record<string, string> = {}
    let branchAssignmentsMap: Record<string, string[]> = {}
    let noticeBranchAssignments: Record<string, string[]> = {}
    let noticeDatesMap: Record<string, string> = {}

    try {
      const { data: settingRows } = await admin
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "staff_custom_roles",
          "staff_branch_assignments",
          "notice_branch_assignments",
          "notice_dates",
        ])

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
          if (row.key === "notice_dates" && row.value) {
            try { noticeDatesMap = JSON.parse(row.value) } catch {}
          }
        })
      }
    } catch {}

    const callerRole = (callerStaff?.id && customRolesMap[callerStaff.id]) || callerStaff?.role || "owner"

    // 3. Determine branch permissions for caller
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

    // 4. Validate branch access against user request
    const requestedBranchIds: string[] = Array.isArray(branch_ids) ? branch_ids.filter(Boolean) : []
    const requestedIsGlobal = is_global === true || (isAllBranchesPermitted && requestedBranchIds.length === 0)

    if (!isAllBranchesPermitted) {
      if (requestedIsGlobal) {
        return NextResponse.json(
          {
            error:
              "আপনার সকল শাখায় নোটিশ বা নোটিফিকেশন পাঠানোর অনুমতি নেই (Permission denied: You cannot send global notices to all branches).",
          },
          { status: 403 }
        )
      }

      if (requestedBranchIds.length === 0) {
        return NextResponse.json(
          {
            error:
              "অনুগ্রহ করে আপনার অনুমোদিত অন্তত একটি শাখা নির্বাচন করুন (Please select at least one of your permitted branches).",
          },
          { status: 400 }
        )
      }

      // Check if any requested branch is outside caller's permitted branches
      const unauthorizedBranches = requestedBranchIds.filter(bId => !permittedBranchIds.includes(bId))
      if (unauthorizedBranches.length > 0) {
        return NextResponse.json(
          {
            error:
              "আপনার অনুমোদিত শাখা ব্যতীত অন্য শাখায় নোটিশ পাঠানোর অনুমতি নেই (Permission denied: You cannot send notifications to other branches).",
          },
          { status: 403 }
        )
      }

      // If editing an existing notice, check that the existing notice belongs to caller's permitted branches
      if (id) {
        const { data: existingNotice } = await admin
          .from("notices")
          .select("*")
          .eq("id", id)
          .maybeSingle()

        if (existingNotice) {
          const existingAssigned =
            noticeBranchAssignments[id] ||
            (existingNotice.branch_ids || (existingNotice.branch_id ? [existingNotice.branch_id] : []))
          if (existingAssigned.length === 0) {
            // It was a global notice!
            return NextResponse.json(
              {
                error:
                  "সার্বজনীন (Global) নোটিশ সম্পাদনা করার অনুমতি শুধুমাত্র প্রধান অ্যাডমিনের আছে (You cannot edit global notices).",
              },
              { status: 403 }
            )
          }
          const hasOverlap = existingAssigned.some((b: string) => permittedBranchIds.includes(b))
          if (!hasOverlap) {
            return NextResponse.json(
              {
                error:
                  "অন্য শাখার নোটিশ সম্পাদনা করার অনুমতি আপনার নেই (You cannot edit notices of other branches).",
              },
              { status: 403 }
            )
          }
        }
      }
    }

    // 5. Build full payload for notices table
    const primaryBranchId = requestedIsGlobal ? null : (requestedBranchIds[0] || null)
    const effectiveNoticeDate = notice_date || new Date().toISOString().split("T")[0]

    const fullPayload: Record<string, any> = {
      title: title.trim(),
      content: (content || "").trim(),
      branch_id: primaryBranchId,
      branch_ids: requestedIsGlobal ? [] : requestedBranchIds,
      notice_date: effectiveNoticeDate,
      is_active: !!is_active,
    }

    // Save with adaptive column pruning fallback
    const savedNotice = await saveNoticeAdaptive(admin, id, fullPayload)

    // 6. Update notice_branch_assignments and notice_dates in site_settings for guaranteed persistence
    try {
      noticeBranchAssignments[savedNotice.id] = requestedIsGlobal ? [] : requestedBranchIds
      noticeDatesMap[savedNotice.id] = effectiveNoticeDate

      await Promise.all([
        admin.from("site_settings").upsert(
          {
            key: "notice_branch_assignments",
            value: JSON.stringify(noticeBranchAssignments),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        ),
        admin.from("site_settings").upsert(
          {
            key: "notice_dates",
            value: JSON.stringify(noticeDatesMap),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        ),
      ])
    } catch (settingErr) {
      console.warn("Could not persist notice metadata in site_settings:", settingErr)
    }

    // 7. Enrich saved notice with branch metadata
    const { data: allBranches } = await admin.from("branches").select("id, name")
    const branchesMap = new Map((allBranches || []).map((b: any) => [b.id, b.name]))

    const finalBranchIds = requestedIsGlobal ? [] : requestedBranchIds
    const enrichedNotice = {
      ...savedNotice,
      notice_date: savedNotice.notice_date || effectiveNoticeDate,
      branch_id: primaryBranchId,
      branch_ids: finalBranchIds,
      branch_names: finalBranchIds.map(bId => branchesMap.get(bId) || bId),
      is_global: requestedIsGlobal,
      branch:
        primaryBranchId && branchesMap.has(primaryBranchId)
          ? { id: primaryBranchId, name: branchesMap.get(primaryBranchId)! }
          : null,
    }

    return NextResponse.json({
      success: true,
      notice: enrichedNotice,
    })
  } catch (err: any) {
    console.error("Notice save error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to save notice" },
      { status: 500 }
    )
  }
}
