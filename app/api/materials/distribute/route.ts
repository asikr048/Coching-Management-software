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

    // Gather student IDs (supporting UUIDs, student codes, and phone numbers)
    let targetStudentIds: string[] = []
    const rawIds: string[] = []
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      student_ids.forEach((sid: any) => {
        if (sid) rawIds.push(String(sid).trim())
      })
    } else if (student_id) {
      rawIds.push(String(student_id).trim())
    }

    const uuidList = rawIds.filter(id => uuidRegex.test(id))
    const nonUuidList = rawIds.filter(id => !uuidRegex.test(id))
    targetStudentIds = [...uuidList]

    if (nonUuidList.length > 0) {
      const { data: foundStudents } = await admin
        .from("students")
        .select("id")
        .in("student_id", nonUuidList)
      if (foundStudents) {
        foundStudents.forEach((s: any) => {
          if (s.id && !targetStudentIds.includes(s.id)) {
            targetStudentIds.push(s.id)
          }
        })
      }
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json({ error: "At least one valid student ID is required." }, { status: 400 })
    }

    // Resolve material
    let targetMaterial: any = null
    if (material_id && uuidRegex.test(String(material_id))) {
      const { data } = await admin.from("materials").select("*").eq("id", material_id).maybeSingle()
      if (data) targetMaterial = data
    }

    // Fallback if material_id was a legacy id or title match
    const candidateName = body.material_name || body.name
    if (!targetMaterial && candidateName) {
      const { data } = await admin.from("materials").select("*").ilike("name", String(candidateName).trim()).maybeSingle()
      if (data) targetMaterial = data
    }

    if (!targetMaterial) {
      return NextResponse.json({ error: "Material not found in database. Please save the material first." }, { status: 404 })
    }

    const validBatchId = batch_id && uuidRegex.test(String(batch_id))
      ? String(batch_id)
      : (targetMaterial.batch_id || null)

    const validIssuedBy = issued_by && uuidRegex.test(String(issued_by)) ? String(issued_by) : null
    const nowIso = new Date().toISOString()

    // Filter out students who already have an active issue for this material
    const { data: existingIssues } = await admin
      .from("material_issues")
      .select("student_id")
      .eq("material_id", targetMaterial.id)
      .in("student_id", targetStudentIds)
      .eq("status", "issued")

    const existingStudentSet = new Set((existingIssues || []).map((i: any) => i.student_id))
    const studentsToIssue = targetStudentIds.filter(sid => !existingStudentSet.has(sid))

    if (studentsToIssue.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All selected students have already received this material.",
        issued_count: 0
      })
    }

    const rowsToInsert = studentsToIssue.map(stId => ({
      material_id: targetMaterial.id,
      student_id: stId,
      batch_id: validBatchId,
      issued_by: validIssuedBy,
      issued_at: nowIso,
      status: "issued",
      notes: notes || "Distributed via Admin Panel",
      return_due_date: return_due_date || null
    }))

    const { data: insertedIssues, error: issueErr } = await admin
      .from("material_issues")
      .insert(rowsToInsert)
      .select()

    if (issueErr) {
      console.error("Error inserting material issues:", issueErr)
      return NextResponse.json({ error: issueErr.message || "Failed to record distribution" }, { status: 500 })
    }

    // Decrement available stock
    const newStock = Math.max(0, (targetMaterial.available_stock ?? targetMaterial.total_stock) - studentsToIssue.length)
    await admin
      .from("materials")
      .update({ available_stock: newStock, updated_at: nowIso })
      .eq("id", targetMaterial.id)

    return NextResponse.json({
      success: true,
      issued_count: studentsToIssue.length,
      available_stock: newStock,
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
