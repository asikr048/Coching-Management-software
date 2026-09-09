import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name } = body

    if (!id && !name) {
      return NextResponse.json({ error: "Material ID or Name is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const idStr = id ? String(id).trim() : ""
    const nameStr = name ? String(name).trim() : ""

    const targetMaterialIds = new Set<string>()
    if (idStr && uuidRegex.test(idStr)) {
      targetMaterialIds.add(idStr)
    }

    // 1. Search for all materials matching name (catches duplicates or legacy items)
    if (nameStr) {
      const { data: matsByName } = await admin
        .from("materials")
        .select("id")
        .ilike("name", nameStr)
      if (matsByName && matsByName.length > 0) {
        matsByName.forEach((m: any) => {
          if (m.id) targetMaterialIds.add(m.id)
        })
      }
    }

    const idList = Array.from(targetMaterialIds)

    // 2. Cascade delete all distribution logs (material_issues)
    if (idList.length > 0) {
      const { error: issErr } = await admin
        .from("material_issues")
        .delete()
        .in("material_id", idList)
      if (issErr) {
        console.warn("Notice: deleting material_issues by id list:", issErr)
      }
    }
    if (idStr && uuidRegex.test(idStr)) {
      try {
        await admin.from("material_issues").delete().eq("material_id", idStr)
      } catch {}
    }

    // 3. Delete the material itself from materials table
    if (idList.length > 0) {
      const { error: matErr } = await admin
        .from("materials")
        .delete()
        .in("id", idList)
      if (matErr) {
        console.error("Error deleting materials by id list:", matErr)
      }
    }
    if (idStr && uuidRegex.test(idStr)) {
      try {
        await admin.from("materials").delete().eq("id", idStr)
      } catch {}
    }
    if (nameStr) {
      try {
        await admin.from("materials").delete().ilike("name", nameStr)
      } catch {}
    }

    return NextResponse.json({
      success: true,
      deleted_ids: idList,
      deleted_id: idStr,
      deleted_name: nameStr,
      message: "Material and all its distribution records deleted successfully."
    })
  } catch (err: any) {
    console.error("Unexpected error in /api/materials/delete:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error deleting material" },
      { status: 500 }
    )
  }
}
