import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { staff_id, branch_ids = [] } = body

    if (!staff_id) {
      return NextResponse.json({ error: "Staff ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const selectedBranches: string[] = Array.isArray(branch_ids) ? branch_ids : []
    const primaryBranchId = selectedBranches.length > 0 ? selectedBranches[0] : null

    // 1. Attempt to update staff with both branch_id and branch_ids
    let updateSuccess = false
    try {
      const { error: fullUpdateErr } = await admin
        .from("staff")
        .update({
          branch_id: primaryBranchId,
          branch_ids: selectedBranches.length > 0 ? selectedBranches : null,
        })
        .eq("id", staff_id)

      if (!fullUpdateErr) {
        updateSuccess = true
      }
    } catch (e) {
      // Ignore and proceed to fallback
    }

    // 2. If full update failed (e.g. branch_ids column does not exist in schema cache), update branch_id only
    if (!updateSuccess) {
      const { error: fallbackErr } = await admin
        .from("staff")
        .update({
          branch_id: primaryBranchId,
        })
        .eq("id", staff_id)

      if (fallbackErr) {
        console.error("Failed to update staff branch_id:", fallbackErr)
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 })
      }
    }

    // 3. Always persist multi-branch assignments in site_settings as persistent store
    try {
      const { data: settingRow } = await admin
        .from("site_settings")
        .select("value")
        .eq("key", "staff_branch_assignments")
        .maybeSingle()

      let map: Record<string, string[]> = {}
      if (settingRow?.value) {
        try {
          map = JSON.parse(settingRow.value)
        } catch {}
      }
      map[staff_id] = selectedBranches

      await admin
        .from("site_settings")
        .upsert({
          key: "staff_branch_assignments",
          value: JSON.stringify(map),
          updated_at: new Date().toISOString(),
        })
    } catch (settingErr) {
      console.warn("Could not save to site_settings staff_branch_assignments:", settingErr)
    }

    // 4. Also sync staff_branches junction table if it exists
    try {
      await admin.from("staff_branches").delete().eq("staff_id", staff_id)
      if (selectedBranches.length > 0) {
        await admin.from("staff_branches").insert(
          selectedBranches.map(bId => ({ staff_id, branch_id: bId }))
        )
      }
    } catch (sbErr) {
      // staff_branches table may not exist, which is fine
    }

    return NextResponse.json({
      success: true,
      staff_id,
      branch_id: primaryBranchId,
      branch_ids: selectedBranches,
      message: "Branch access permissions updated successfully",
    })
  } catch (err: any) {
    console.error("Error in /api/staff/branches:", err)
    return NextResponse.json({ error: err.message || "Failed to update branch access" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staff_id")

    const { data: settingRow } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "staff_branch_assignments")
      .maybeSingle()

    let map: Record<string, string[]> = {}
    if (settingRow?.value) {
      try {
        map = JSON.parse(settingRow.value)
      } catch {}
    }

    if (staffId) {
      return NextResponse.json({
        staff_id: staffId,
        branch_ids: map[staffId] || [],
      })
    }

    return NextResponse.json({
      assignments: map,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
