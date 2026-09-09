import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      material_id,
      student_ids = [],
      student_id,
      batch_id,
      issued_by,
      notes = "Distributed via Admin Panel",
      return_due_date,
    } = body

    const admin = createAdminClient()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    // 1. Gather raw student IDs / codes / phones
    const rawIds: string[] = []
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      student_ids.forEach((sid: any) => {
        if (sid) rawIds.push(String(sid).trim())
      })
    } else if (student_id) {
      rawIds.push(String(student_id).trim())
    }

    if (rawIds.length === 0) {
      return NextResponse.json({ error: "At least one valid student ID is required." }, { status: 400 })
    }

    const uuidList = rawIds.filter(id => uuidRegex.test(id))
    const nonUuidList = rawIds.filter(id => !uuidRegex.test(id))
    let candidateStudentIds = [...uuidList]

    // Resolve non-UUIDs (student_id code or phone)
    if (nonUuidList.length > 0) {
      const { data: foundStudents } = await admin
        .from("students")
        .select("id, student_id, phone")
        .or(`student_id.in.(${nonUuidList.join(",")}),phone.in.(${nonUuidList.join(",")})`)
      if (foundStudents) {
        foundStudents.forEach((s: any) => {
          if (s.id && !candidateStudentIds.includes(s.id)) {
            candidateStudentIds.push(s.id)
          }
        })
      }
    }

    // Crucial: Verify all student IDs actually exist in public.students(id) to prevent FK violation
    const { data: verifiedStudentRows } = await admin
      .from("students")
      .select("id")
      .in("id", candidateStudentIds)

    const verifiedStudentIds = (verifiedStudentRows || []).map((s: any) => s.id)

    if (verifiedStudentIds.length === 0) {
      return NextResponse.json({ error: "No registered students found matching the provided IDs." }, { status: 404 })
    }

    // 2. Resolve material
    let targetMaterial: any = null
    if (material_id && uuidRegex.test(String(material_id))) {
      const { data } = await admin.from("materials").select("*").eq("id", material_id).maybeSingle()
      if (data) targetMaterial = data
    }

    // Fallback if material_id was not a valid UUID or not found: match by name
    const candidateName = body.material_name || body.name
    if (!targetMaterial && candidateName) {
      const { data } = await admin.from("materials").select("*").ilike("name", String(candidateName).trim()).maybeSingle()
      if (data) targetMaterial = data
    }

    if (!targetMaterial) {
      return NextResponse.json({ error: "Material not found in database. Please save the material first." }, { status: 404 })
    }

    // 3. Verify issued_by against public.staff(id) to avoid FK constraint violation
    let verifiedIssuedBy: string | null = null
    if (issued_by && uuidRegex.test(String(issued_by))) {
      const { data: staffRow } = await admin
        .from("staff")
        .select("id")
        .eq("id", issued_by)
        .maybeSingle()

      if (staffRow?.id) {
        verifiedIssuedBy = staffRow.id
      } else {
        // Check if issued_by was passed as auth_user_id
        const { data: staffByAuth } = await admin
          .from("staff")
          .select("id")
          .eq("auth_user_id", issued_by)
          .maybeSingle()
        if (staffByAuth?.id) {
          verifiedIssuedBy = staffByAuth.id
        }
      }
    }

    // 4. Verify batch_id against public.batches(id) to avoid FK constraint violation
    let verifiedBatchId: string | null = null
    const candidateBatchId = (batch_id && uuidRegex.test(String(batch_id)))
      ? String(batch_id)
      : (targetMaterial.batch_id && uuidRegex.test(String(targetMaterial.batch_id)) ? String(targetMaterial.batch_id) : null)

    if (candidateBatchId) {
      const { data: batchRow } = await admin
        .from("batches")
        .select("id")
        .eq("id", candidateBatchId)
        .maybeSingle()
      if (batchRow?.id) {
        verifiedBatchId = batchRow.id
      }
    }

    // 5. Sanitize return_due_date
    let validDueDate: string | null = null
    if (return_due_date && typeof return_due_date === "string" && return_due_date.trim() !== "") {
      const d = new Date(return_due_date)
      if (!isNaN(d.getTime())) {
        validDueDate = d.toISOString().split("T")[0]
      }
    }

    const nowIso = new Date().toISOString()

    // 6. Filter out students who already have an active issue for this material
    const { data: existingIssues } = await admin
      .from("material_issues")
      .select("student_id")
      .eq("material_id", targetMaterial.id)
      .in("student_id", verifiedStudentIds)
      .eq("status", "issued")

    const existingStudentSet = new Set((existingIssues || []).map((i: any) => i.student_id))
    const studentsToIssue = verifiedStudentIds.filter(sid => !existingStudentSet.has(sid))

    if (studentsToIssue.length === 0) {
      // Return current dynamic available stock even if already issued
      const { count: currentActiveCount } = await admin
        .from("material_issues")
        .select("*", { count: "exact", head: true })
        .eq("material_id", targetMaterial.id)
        .eq("status", "issued")

      const totalStock = Number(targetMaterial.total_stock) || 0
      const currentAvailable = Math.max(0, totalStock - (currentActiveCount || 0))

      return NextResponse.json({
        success: true,
        message: "All selected students have already received this material.",
        issued_count: 0,
        available_stock: currentAvailable,
        issues: existingIssues || []
      })
    }

    // 7. Insert new issues with automatic resilient fallback
    const rowsToInsert = studentsToIssue.map(stId => ({
      material_id: targetMaterial.id,
      student_id: stId,
      batch_id: verifiedBatchId,
      issued_by: verifiedIssuedBy,
      issued_at: nowIso,
      status: "issued",
      notes: notes || "Distributed via Admin Panel",
      return_due_date: validDueDate
    }))

    let insertedIssues: any[] = []
    const { data: firstTry, error: firstErr } = await admin
      .from("material_issues")
      .insert(rowsToInsert)
      .select()

    if (!firstErr && firstTry) {
      insertedIssues = firstTry
    } else {
      console.warn("First insert attempt had constraint warning, retrying with safe minimal fields:", firstErr)
      // Fallback: minimal insert without optional foreign keys
      const fallbackRows = studentsToIssue.map(stId => ({
        material_id: targetMaterial.id,
        student_id: stId,
        issued_at: nowIso,
        status: "issued",
        notes: notes || "Distributed via Admin Panel"
      }))

      const { data: secondTry, error: secondErr } = await admin
        .from("material_issues")
        .insert(fallbackRows)
        .select()

      if (secondErr) {
        console.error("Critical: Failed to insert material issues even on fallback:", secondErr)
        return NextResponse.json({ error: secondErr.message || "Failed to record distribution" }, { status: 500 })
      }
      insertedIssues = secondTry || []
    }

    // 8. EXACT dynamic stock recalculation based on actual DB records
    const { count: totalActiveCount } = await admin
      .from("material_issues")
      .select("*", { count: "exact", head: true })
      .eq("material_id", targetMaterial.id)
      .eq("status", "issued")

    const totalStock = Number(targetMaterial.total_stock) || 0
    const activeCount = typeof totalActiveCount === "number" ? totalActiveCount : studentsToIssue.length
    const newAvailableStock = Math.max(0, totalStock - activeCount)

    await admin
      .from("materials")
      .update({ available_stock: newAvailableStock, updated_at: nowIso })
      .eq("id", targetMaterial.id)

    return NextResponse.json({
      success: true,
      issued_count: studentsToIssue.length,
      available_stock: newAvailableStock,
      issues: insertedIssues,
      message: `Successfully distributed ${studentsToIssue.length} copies of "${targetMaterial.name}"!`
    })
  } catch (err: any) {
    console.error("Unexpected error in /api/materials/distribute:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error distributing material" },
      { status: 500 }
    )
  }
}
