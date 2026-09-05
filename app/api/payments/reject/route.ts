import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { submissionId, staffId, reason } = body

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required." }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const updatePayload: Record<string, any> = {
      status: "rejected",
      rejection_reason: reason.trim(),
      approved_by: staffId || null,
      approved_at: nowIso,
      reviewed_by: staffId || null,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }

    const { error } = await admin
      .from("payment_submissions")
      .update(updatePayload)
      .eq("id", submissionId)

    if (error) {
      // Fallback update with minimal columns
      const { error: fallbackErr } = await admin
        .from("payment_submissions")
        .update({
          status: "rejected",
          rejection_reason: reason.trim(),
        })
        .eq("id", submissionId)

      if (fallbackErr) {
        throw fallbackErr
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment submission rejected.",
    })
  } catch (error: any) {
    console.error("Payment rejection exception:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to reject payment." },
      { status: 500 }
    )
  }
}
