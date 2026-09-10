import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

// GET: Calculate next available batch roll (highest + 1) and auto-resequence duplicates
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get("batch_id")
    const autoFix = searchParams.get("auto_fix") !== "false"

    if (!batchId) {
      return NextResponse.json({ error: "batch_id is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    // 1. Query all enrollments strictly for this batch
    let enrollments: any[] = []
    const { data: enrData, error: enrErr } = await admin
      .from("enrollments")
      .select("id, student_id, batch_id, roll_no, created_at, status")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true })

    if (!enrErr && enrData && enrData.length > 0) {
      enrollments = enrData
    } else {
      const { data: fbEnr } = await supabase
        .from("enrollments")
        .select("id, student_id, batch_id, roll_no, created_at, status")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: true })
      if (fbEnr) enrollments = fbEnr
    }

    // If batch has no enrollments, start with Roll 1
    if (enrollments.length === 0) {
      return NextResponse.json({
        success: true,
        batch_id: batchId,
        next_roll: 1,
        max_roll: 0,
        total_students: 0,
        resequenced: false,
        updated_enrollments: []
      })
    }

    // Sort enrollments deterministically by creation date, then id
    enrollments.sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0
      if (tA !== tB) return tA - tB
      return String(a.id || "").localeCompare(String(b.id || ""))
    })

    // Check for duplicate roll numbers, non-positive rolls, or unassigned rolls
    const rollCounts = new Map<number, number>()
    let hasDuplicates = false
    let hasMissingOrInvalid = false
    let maxRoll = 0

    for (const e of enrollments) {
      const r = Number(e.roll_no)
      if (isNaN(r) || r <= 0) {
        hasMissingOrInvalid = true
      } else {
        rollCounts.set(r, (rollCounts.get(r) || 0) + 1)
        if ((rollCounts.get(r) || 0) > 1) {
          hasDuplicates = true
        }
        if (r > maxRoll) maxRoll = r
      }
    }

    // If autoFix is enabled and duplicates or missing rolls exist, re-sequence to 1, 2, 3...
    if (autoFix && (hasDuplicates || hasMissingOrInvalid)) {
      const updatedEnrollments: any[] = []

      for (let i = 0; i < enrollments.length; i++) {
        const assignedRoll = i + 1
        const e = enrollments[i]
        const currentRoll = Number(e.roll_no)

        if (currentRoll !== assignedRoll) {
          // Update enrollment roll_no
          await admin
            .from("enrollments")
            .update({ roll_no: assignedRoll })
            .eq("id", e.id)

          // Also update student primary roll_no and batch_roll
          if (e.student_id) {
            await admin
              .from("students")
              .update({ roll_no: assignedRoll, batch_roll: assignedRoll })
              .eq("id", e.student_id)
          }

          updatedEnrollments.push({
            id: e.id,
            student_id: e.student_id,
            roll_no: assignedRoll
          })
        } else {
          updatedEnrollments.push({
            id: e.id,
            student_id: e.student_id,
            roll_no: assignedRoll
          })
        }
      }

      maxRoll = enrollments.length
      const nextRoll = maxRoll + 1

      return NextResponse.json({
        success: true,
        batch_id: batchId,
        next_roll: nextRoll,
        max_roll: maxRoll,
        total_students: enrollments.length,
        resequenced: true,
        updated_enrollments: updatedEnrollments
      })
    }

    // Standard case: rolls are clean, next roll is highest roll + 1
    const nextRoll = Math.max(maxRoll, enrollments.length) + 1

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      next_roll: nextRoll,
      max_roll: maxRoll,
      total_students: enrollments.length,
      resequenced: false,
      updated_enrollments: []
    })
  } catch (error: any) {
    console.error("Error calculating next roll:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to calculate next roll", next_roll: 1 },
      { status: 500 }
    )
  }
}

// POST: Resequence duplicate rolls across one or all batches
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const admin = createAdminClient()
    const { batch_id, resequence_all } = body

    if (!batch_id && !resequence_all) {
      return NextResponse.json({ error: "batch_id or resequence_all is required" }, { status: 400 })
    }

    let batchIds: string[] = []
    if (batch_id) {
      batchIds = [batch_id]
    } else {
      const { data: batches } = await admin.from("batches").select("id")
      batchIds = (batches || []).map((b) => b.id)
    }

    let totalFixedEnrollments = 0
    const fixedBatches: any[] = []

    for (const bId of batchIds) {
      const { data: enrs } = await admin
        .from("enrollments")
        .select("id, student_id, batch_id, roll_no, created_at")
        .eq("batch_id", bId)
        .order("created_at", { ascending: true })

      if (!enrs || enrs.length === 0) continue

      enrs.sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0
        if (tA !== tB) return tA - tB
        return String(a.id || "").localeCompare(String(b.id || ""))
      })

      let batchModifiedCount = 0
      for (let i = 0; i < enrs.length; i++) {
        const assignedRoll = i + 1
        const e = enrs[i]
        if (Number(e.roll_no) !== assignedRoll) {
          await admin.from("enrollments").update({ roll_no: assignedRoll }).eq("id", e.id)
          if (e.student_id) {
            await admin
              .from("students")
              .update({ roll_no: assignedRoll, batch_roll: assignedRoll })
              .eq("id", e.student_id)
          }
          batchModifiedCount++
          totalFixedEnrollments++
        }
      }

      if (batchModifiedCount > 0) {
        fixedBatches.push({
          batch_id: bId,
          students_resequenced: batchModifiedCount,
          total_students: enrs.length
        })
      }
    }

    return NextResponse.json({
      success: true,
      fixed_batches_count: fixedBatches.length,
      total_fixed_enrollments: totalFixedEnrollments,
      fixed_batches: fixedBatches
    })
  } catch (error: any) {
    console.error("Error resequencing batch rolls:", error)
    return NextResponse.json({ error: error?.message || "Failed to resequence rolls" }, { status: 500 })
  }
}
