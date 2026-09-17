import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to check UUID format
const isUUID = (val: any): boolean => {
  if (typeof val !== "string") return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
}

// Helper to resolve target batch details and all related batch IDs across branches
async function getRelatedBatches(admin: any, batchId: string): Promise<{ allBatchIds: string[]; currentBatch: any }> {
  const ids = new Set<string>([batchId])
  let currentBatch: any = null

  try {
    const { data: b } = await admin
      .from("batches")
      .select("id, name, branch_id, origin_batch_id, current_seats, max_seats")
      .eq("id", batchId)
      .maybeSingle()

    if (b) {
      currentBatch = b
      if (b.origin_batch_id) ids.add(b.origin_batch_id)

      // Query sibling batches safely
      try {
        const query = b.origin_batch_id
          ? `origin_batch_id.eq.${batchId},origin_batch_id.eq.${b.origin_batch_id},id.eq.${b.origin_batch_id}`
          : `origin_batch_id.eq.${batchId}`
        const { data: siblings } = await admin.from("batches").select("id").or(query)
        siblings?.forEach((s: any) => ids.add(s.id))
      } catch (err) {
        console.warn("Could not query siblings via OR:", err)
      }

      // Query same-named batches across branches
      if (b.name && b.name.trim()) {
        try {
          const { data: nameMatches } = await admin
            .from("batches")
            .select("id")
            .ilike("name", b.name.trim())
          nameMatches?.forEach((m: any) => ids.add(m.id))
        } catch (err) {
          console.warn("Could not query same-named batches:", err)
        }
      }
    }
  } catch (err) {
    console.warn("Could not query batch details:", err)
  }

  return { allBatchIds: Array.from(ids), currentBatch }
}

// Safely fetch students and index by both UUID (s.id) and student code (s.student_id)
async function fetchStudentMap(admin: any, rawIds: (string | null | undefined)[]): Promise<Map<string, any>> {
  const studentMap = new Map<string, any>()
  const cleanIds = Array.from(new Set(rawIds.map(x => (x ? String(x).trim() : "")).filter(Boolean)))
  if (cleanIds.length === 0) return studentMap

  const uuidIds = cleanIds.filter(isUUID)
  const codeIds = cleanIds.filter(id => !isUUID(id))

  if (uuidIds.length > 0) {
    try {
      const { data: byUuid } = await admin
        .from("students")
        .select("id, student_id, name, roll_no, batch_roll, created_at")
        .in("id", uuidIds)
      byUuid?.forEach((s: any) => {
        if (s.id) studentMap.set(String(s.id), s)
        if (s.student_id) studentMap.set(String(s.student_id), s)
      })
    } catch (e) {
      console.warn("Could not fetch students by UUID:", e)
    }
  }

  if (codeIds.length > 0) {
    try {
      const { data: byCode } = await admin
        .from("students")
        .select("id, student_id, name, roll_no, batch_roll, created_at")
        .in("student_id", codeIds)
      byCode?.forEach((s: any) => {
        if (s.id) studentMap.set(String(s.id), s)
        if (s.student_id) studentMap.set(String(s.student_id), s)
      })
    } catch (e) {
      console.warn("Could not fetch students by code:", e)
    }
  }

  return studentMap
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

    // 1. Resolve batch record and related batch IDs (for cross-branch batch sync)
    const { allBatchIds, currentBatch } = await getRelatedBatches(admin, batchId)

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

    // 3. Dual-indexed student map (by UUID and by human student code e.g. MS-XXXXX)
    const rawStudentIds = enrollments.map((e) => e.student_id)
    const studentMap = await fetchStudentMap(admin, rawStudentIds)

    // 4. Determine highest previous roll
    const currentSeats = Number(currentBatch?.current_seats || 0)
    const enrolledStudentsCount = enrollments.length

    // If batch has 0 enrollments and 0 current_seats, roll starts with 1
    if (enrolledStudentsCount === 0 && currentSeats === 0) {
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

    // Sort enrollments deterministically by enrollment/student creation date
    enrollments.sort((a, b) => {
      const sA = a.student_id ? studentMap.get(String(a.student_id)) : null
      const sB = b.student_id ? studentMap.get(String(b.student_id)) : null
      const tA = (a.created_at ? new Date(a.created_at).getTime() : 0) || (sA?.created_at ? new Date(sA.created_at).getTime() : 0)
      const tB = (b.created_at ? new Date(b.created_at).getTime() : 0) || (sB?.created_at ? new Date(sB.created_at).getTime() : 0)
      if (tA !== tB) return tA - tB
      return String(a.id || "").localeCompare(String(b.id || ""))
    })

    // Inspect all rolls across enrollments and student records
    const rollCounts = new Map<number, number>()
    let hasDuplicates = false
    let hasMissingOrInvalid = false
    let maxRoll = 0

    for (const e of enrollments) {
      const s = e.student_id ? studentMap.get(String(e.student_id)) : null
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

    // 5. If autoFix is enabled and duplicates or missing rolls exist, re-sequence to 1, 2, 3... N
    if (autoFix && enrollments.length > 0 && (hasDuplicates || hasMissingOrInvalid)) {
      const updatedEnrollments: any[] = []

      for (let i = 0; i < enrollments.length; i++) {
        const assignedRoll = i + 1
        const e = enrollments[i]
        const s = e.student_id ? studentMap.get(String(e.student_id)) : null

        const currentEnrRoll = Number(e.roll_no)
        const currentStuRoll = Number(s?.roll_no ?? s?.batch_roll)

        if (currentEnrRoll !== assignedRoll || currentStuRoll !== assignedRoll) {
          // Update enrollment roll_no
          await admin
            .from("enrollments")
            .update({ roll_no: assignedRoll })
            .eq("id", e.id)

          // Update student primary roll_no and batch_roll
          if (s?.id) {
            await admin
              .from("students")
              .update({ roll_no: assignedRoll, batch_roll: assignedRoll })
              .eq("id", s.id)
          } else if (e.student_id) {
            const stuQuery = isUUID(e.student_id)
              ? admin.from("students").update({ roll_no: assignedRoll, batch_roll: assignedRoll }).eq("id", e.student_id)
              : admin.from("students").update({ roll_no: assignedRoll, batch_roll: assignedRoll }).eq("student_id", e.student_id)
            await stuQuery
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

      const previousMaximum = Math.max(enrollments.length, currentSeats)
      const nextRoll = previousMaximum + 1

      return NextResponse.json({
        success: true,
        batch_id: batchId,
        next_roll: nextRoll,
        previous_maximum: previousMaximum,
        total_students: enrollments.length,
        resequenced: true,
        updated_enrollments: updatedEnrollments
      })
    }

    // 6. Standard calculation: previous_maximum is max of (maxRoll, enrollments count, current_seats)
    const previousMaximum = Math.max(maxRoll, enrolledStudentsCount, currentSeats)
    const nextRoll = previousMaximum > 0 ? previousMaximum + 1 : 1

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      next_roll: nextRoll,
      previous_maximum: previousMaximum,
      total_students: enrolledStudentsCount,
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
      const { allBatchIds } = await getRelatedBatches(admin, batch_id)
      batchIds = allBatchIds
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

      const sMap = await fetchStudentMap(admin, enrs.map((e) => e.student_id))

      enrs.sort((a, b) => {
        const sA = a.student_id ? sMap.get(String(a.student_id)) : null
        const sB = b.student_id ? sMap.get(String(b.student_id)) : null
        const tA = (a.created_at ? new Date(a.created_at).getTime() : 0) || (sA?.created_at ? new Date(sA.created_at).getTime() : 0)
        const tB = (b.created_at ? new Date(b.created_at).getTime() : 0) || (sB?.created_at ? new Date(sB.created_at).getTime() : 0)
        if (tA !== tB) return tA - tB
        return String(a.id || "").localeCompare(String(b.id || ""))
      })

      let batchModifiedCount = 0
      for (let i = 0; i < enrs.length; i++) {
        const assignedRoll = i + 1
        const e = enrs[i]
        const s = e.student_id ? sMap.get(String(e.student_id)) : null

        if (Number(e.roll_no) !== assignedRoll || Number(s?.roll_no) !== assignedRoll) {
          await admin.from("enrollments").update({ roll_no: assignedRoll }).eq("id", e.id)
          if (s?.id) {
            await admin
              .from("students")
              .update({ roll_no: assignedRoll, batch_roll: assignedRoll })
              .eq("id", s.id)
          } else if (e.student_id) {
            const stuQuery = isUUID(e.student_id)
              ? admin.from("students").update({ roll_no: assignedRoll, batch_roll: assignedRoll }).eq("id", e.student_id)
              : admin.from("students").update({ roll_no: assignedRoll, batch_roll: assignedRoll }).eq("student_id", e.student_id)
            await stuQuery
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
