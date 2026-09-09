import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name } = body

    if (!id && !name) {
      return NextResponse.json({ error: "Material ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    let targetId = id ? String(id).trim() : ""

    // If ID is not a valid UUID, search by exact name to find the single matching row's UUID
    if (!uuidRegex.test(targetId) && name) {
      const { data: found } = await admin
        .from("materials")
        .select("id")
        .eq("name", String(name).trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (found?.id) {
        targetId = found.id
      }
    }

    if (!targetId || !uuidRegex.test(targetId)) {
      return NextResponse.json({ error: "Valid Material ID could not be resolved." }, { status: 400 })
    }

    // 1. Delete distribution logs for THIS SPECIFIC MATERIAL ONLY
    await admin.from("material_issues").delete().eq("material_id", targetId)

    // 2. Delete THIS SPECIFIC MATERIAL ONLY from materials table
    const { error: matErr } = await admin.from("materials").delete().eq("id", targetId)
    if (matErr) {
      console.error("Error deleting material by id:", matErr)
      return NextResponse.json({ error: matErr.message || "Failed to delete material" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted_id: targetId,
      message: "Material deleted successfully."
    })
  } catch (err: any) {
    console.error("Unexpected error in /api/materials/delete:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error deleting material" },
      { status: 500 }
    )
  }
}
