import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { issue_id, material_id } = body

    if (!issue_id) {
      return NextResponse.json({ error: "issue_id is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    let targetMatId = material_id

    // If issue_id is a valid UUID, find the issue first
    if (uuidRegex.test(String(issue_id))) {
      const { data: issue } = await admin
        .from("material_issues")
        .select("material_id")
        .eq("id", issue_id)
        .maybeSingle()

      if (issue?.material_id) {
        targetMatId = issue.material_id
      }

      await admin.from("material_issues").delete().eq("id", issue_id)
    }

    // Dynamically recalculate available stock based on remaining active issues in DB
    let newStock = 0
    if (targetMatId && uuidRegex.test(String(targetMatId))) {
      const { data: mat } = await admin
        .from("materials")
        .select("total_stock")
        .eq("id", targetMatId)
        .maybeSingle()

      if (mat) {
        const { count: remainingActiveCount } = await admin
          .from("material_issues")
          .select("*", { count: "exact", head: true })
          .eq("material_id", targetMatId)
          .eq("status", "issued")

        const totalStock = Number(mat.total_stock) || 0
        const activeCount = typeof remainingActiveCount === "number" ? remainingActiveCount : 0
        newStock = Math.max(0, totalStock - activeCount)
        await admin
          .from("materials")
          .update({ available_stock: newStock, updated_at: new Date().toISOString() })
          .eq("id", targetMatId)
      }
    }

    return NextResponse.json({
      success: true,
      available_stock: newStock,
      message: "Distribution revoked and stock restored."
    })
  } catch (err: any) {
    console.error("Unexpected error in /api/materials/revoke:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error revoking material" },
      { status: 500 }
    )
  }
}
