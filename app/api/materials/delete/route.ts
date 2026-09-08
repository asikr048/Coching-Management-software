import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: "Material ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    const idStr = String(id).trim()
    const nameStr = body.name ? String(body.name).trim() : null

    if (uuidRegex.test(idStr)) {
      // 1. Delete all distribution logs for this material first
      await admin.from("material_issues").delete().eq("material_id", idStr)

      // 2. Delete the material itself
      const { error } = await admin.from("materials").delete().eq("id", idStr)
      if (error) {
        console.error("Error deleting material from database:", error)
        return NextResponse.json({ error: error.message || "Failed to delete material" }, { status: 500 })
      }
    } else if (nameStr) {
      // If id is not a valid UUID (e.g. legacy id), search and delete by name
      const { data: found } = await admin.from("materials").select("id").ilike("name", nameStr).maybeSingle()
      if (found?.id) {
        await admin.from("material_issues").delete().eq("material_id", found.id)
        await admin.from("materials").delete().eq("id", found.id)
      }
    }

    return NextResponse.json({
      success: true,
      deleted_id: id,
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
