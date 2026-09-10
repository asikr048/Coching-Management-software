import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to resolve all related batch IDs (origin batch, branch clones, and same-named batches)
async function getRelatedBatchIds(admin: any, batchId: string): Promise<string[]> {
  const ids = new Set<string>([batchId])
  try {
    const { data: b } = await admin
      .from("batches")
      .select("id, name, origin_batch_id")
      .eq("id", batchId)
      .maybeSingle()

    if (b) {
      if (b.origin_batch_id) ids.add(b.origin_batch_id)
      
      // Look for child batches or sibling batches with same name or origin_batch_id
      const { data: siblings } = await admin
        .from("batches")
        .select("id")
        .or(`origin_batch_id.eq.${batchId}${b.origin_batch_id ? `,origin_batch_id.eq.${b.origin_batch_id},id.eq.${b.origin_batch_id}` : ""}`)

      siblings?.forEach((s: any) => ids.add(s.id))

      if (b.name) {
        const { data: nameMatches } = await admin
          .from("batches")
          .select("id")
          .ilike("name", b.name.trim())
        nameMatches?.forEach((m: any) => ids.add(m.id))
      }
    }
  } catch (err) {
    console.warn("Could not query sibling batches:", err)
  }
  return Array.from(ids)
}

// GET: Calculate next available batch roll (strictly previous_maximum + 1) and auto-resequence duplicates
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

    // 1. Resolve all related batch IDs (handles multi-branch batch cloning)
    const allBatchIds = await getRelatedBatchIds(admin, batchId)

    // 2. Query all enrollments across these batch IDs
    let enrollments: any[] = []
    const { data: enrData, error: enrErr } = await admin
      .from("enrollments")
      .select("id, student_id, batch_id, roll_no, created_at, status")
      .in("batch_id", allBatchIds)
      .order("created_at", { ascending: true })

    if (!enrErr && enrData && enrData.length > 0) {
      enrollments = enrData
    } else {
      const { data: fbEnr } = await supabase
        .from("enrollments")
        .select("id, student_id, batch_id, roll_no, created_at, status")
        .in("batch_id", allBatchIds)
        .order("created_at", { ascending: true })
      if (fbEnr) enrollments = fbEnr
    }

    // 3. Fetch student records for all enrollments to resolve real roll_no and batch_roll
    const studentIds = enrollments.map((e) => e.student_id).filter(Boolean)
    const studentMap = new Map<string, any>()
    if (studentIds.length > 0) {
      const { data: stuData } = await admin
        .from("students")
        .select("id, student_id, name, roll_no, batch_roll, created_at")
        .in("id", studentIds)
      stuData?.forEach((s: any) => studentMap.set(s.id, s))
    }

    // Keep only valid enrollments that belong to an existing student
    const validEnrollments = enrollments.filter((e) => e.student_id && studentMap.has(e.student_id))

    // If batch has no valid student enrollments, roll starts with 1
    if (validEnrollments.length === 0) {
      return NextResponse.json({
        success: true,
        batch_id: batchId,
        next_roll: 1,
        previous_maximum: 0,
        total_students: 0,
        resequenced: false,
        updated_enrollments: []
      })
    }

    // Sort valid enrollments deterministically by enrollment/student creation date
    validEnrollments.sort((a, b) => {
      const sA = studentMap.get(a.student_id)
      const sB = studentMap.get(b.student_id)
      const tA = (a.created_at ? new Date(a.created_at).getTime() : 0) || (sA?.created_at ? new Date(sA.created_at).getTime() : 0)
      const tB = (b.created_at ? new Date(b.created_at).getTime() : 0) || (sB?.created_at ? new Date(sB.created_at).getTime() : 0)
      if (tA !== tB) return tA - tB
      return String(a.id || "").localeCompare(String(b.id || ""))
    })

    // Check for duplicate roll numbers, non-positive rolls, or unassigned rolls
    const rollCounts = new Map<number, number>()
    let hasDuplicates = false
    let hasMissingOrInvalid = false
    let maxRoll = 0

    for (const e of validEnrollments) {
      const s = studentMap.get(e.student_id)
      const r = (e.roll_no != null && Number(e.roll_no) > 0)
        ? Number(e.roll_no)
        : (s?.roll_no != null && Number(s.roll_no) > 0)
        ? Number(s.roll_no)
        : (s?.batch_roll != null && Number(s.batch_roll) > 0)
        ? Number(s.batch_roll)
        : null

      if (r == null || r <= 0) {
        hasMissingOrInvalid = true
      } else {
        rollCounts.set(r, (rollCounts.get(r) || 0) + 1)
        if ((rollCounts.get(r) || 0) > 1) {
          hasDuplicates = true
        }
        if (r > maxRoll) maxRoll = r
      }
    }

    // If autoFix is enabled and duplicates or missing rolls exist, re-sequence to 1, 2, 3... N
    if (autoFix && (hasDuplicates || hasMissingOrInvalid)) {
      const updatedEnrollments: any[] = []

      for (let i = 0; i < validEnrollments.length; i++) {
        const assignedRoll = i + 1
        const e = validEnrollments[i]
        const s = studentMap.get(e.student_id)

        const currentEnrRoll = Number(e.roll_no)
        const currentStuRoll = Number(s?.roll_no ?? s?.batch_roll)

        if (currentEnrRoll !== assignedRoll || currentStuRoll !== assignedRoll) {
          // Update enrollment roll_no
          await admin
            .from("enrollments")
            .update({ roll_no: assignedRoll })
            .eq("id", e.id)

          // Update student primary roll_no and batch_roll
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

      const previousMaximum = validEnrollments.length
      const nextRoll = previousMaximum + 1

      return NextResponse.json({
        success: true,
        batch_id: batchId,
        next_roll: nextRoll,
        previous_maximum: previousMaximum,
        total_students: validEnrollments.length,
        resequenced: true,
        updated_enrollments: updatedEnrollments
      })
    }

    // Standard case: rolls are clean, next roll is strictly previous_maximum + 1
    const previousMaximum = Math.max(maxRoll, validEnrollments.length)
    const nextRoll = previousMaximum + 1

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      next_roll: nextRoll,
      previous_maximum: previousMaximum,
      total_students: validEnrollments.length,
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
      batchIds = await getRelatedBatchIds(admin, batch_id)
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

      const sIds = enrs.map((e) => e.student_id).filter(Boolean)
      const { data: sData } = await admin.from("students").select("id, roll_no, batch_roll, created_at").in("id", sIds)
      const sMap = new Map((sData || []).map((s: any) => [s.id, s]))

      const valEnrs = enrs.filter((e) => e.student_id && sMap.has(e.student_id))
      if (valEnrs.length === 0) continue

      valEnrs.sort((a, b) => {
        const sA = sMap.get(a.student_id)
        const sB = sMap.get(b.student_id)
        const tA = (a.created_at ? new Date(a.created_at).getTime() : 0) || (sA?.created_at ? new Date(sA.created_at).getTime() : 0)
        const tB = (b.created_at ? new Date(b.created_at).getTime() : 0) || (sB?.created_at ? new Date(sB.created_at).getTime() : 0)
        if (tA !== tB) return tA - tB
        return String(a.id || "").localeCompare(String(b.id || ""))
      })

      let batchModifiedCount = 0
      for (let i = 0; i < valEnrs.length; i++) {
        const assignedRoll = i + 1
        const e = valEnrs[i]
        const s = sMap.get(e.student_id)

        if (Number(e.roll_no) !== assignedRoll || Number(s?.roll_no) !== assignedRoll) {
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
          total_students: valEnrs.length
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
