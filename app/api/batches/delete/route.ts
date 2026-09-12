import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, cascade = true } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Batch ID is required." }, { status: 400 })
    }

    const cleanId = id.trim()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(cleanId)) {
      return NextResponse.json({ error: "Invalid Batch UUID format." }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Check if the batch exists
    const { data: batch, error: fetchErr } = await admin
      .from("batches")
      .select("id, name, current_seats, branch_id")
      .eq("id", cleanId)
      .maybeSingle()

    if (fetchErr || !batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 })
    }

    // 2. Count active enrollments
    const { count: enrCount } = await admin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", cleanId)

    if (!cascade && enrCount && enrCount > 0) {
      return NextResponse.json(
        {
          error: "BATCH_HAS_ENROLLMENTS",
          message: `This batch has ${enrCount} student(s) enrolled. Enable cascade deletion to proceed.`,
          enrollmentCount: enrCount
        },
        { status: 400 }
      )
    }

    // 3. Safe cascade cleanup of all foreign key dependencies:
    
    // a. Unlink any child branches that reference this batch as origin_batch_id
    try {
      await admin
        .from("batches")
        .update({ origin_batch_id: null })
        .eq("origin_batch_id", cleanId)
    } catch (e) {
      console.warn("Could not unlink origin_batch_id:", e)
    }

    // b. Retrieve all enrollment IDs and student IDs for this batch
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("id, student_id")
      .eq("batch_id", cleanId)
    const enrollmentIds = (enrollments || []).map(e => e.id)
    const enrolledStudentIds = Array.from(
      new Set((enrollments || []).map(e => e.student_id).filter(Boolean))
    )

    // c. Delete payments that reference these enrollments
    if (enrollmentIds.length > 0) {
      try {
        await admin
          .from("payments")
          .delete()
          .in("enrollment_id", enrollmentIds)
      } catch (e) {
        console.warn("Could not delete payments by enrollment_id:", e)
      }
    }

    // d. Delete payments referencing this batch
    try {
      await admin
        .from("payments")
        .delete()
        .eq("batch_id", cleanId)
    } catch (e) {
      console.warn("Could not delete payments for batch:", e)
    }

    // e. Delete payment_submissions associated with this batch
    try {
      // First clean submissions pointing to this batch's fee_dues
      const { data: batchDues } = await admin
        .from("fee_dues")
        .select("id")
        .eq("batch_id", cleanId)
      const dueIds = (batchDues || []).map(d => d.id)
      if (dueIds.length > 0) {
        await admin
          .from("payment_submissions")
          .delete()
          .in("fee_due_id", dueIds)
      }

      // Delete payment_submissions directly referencing this batch
      const { error: psErr } = await admin
        .from("payment_submissions")
        .delete()
        .eq("batch_id", cleanId)
      if (psErr) {
        console.error("Error deleting payment_submissions for batch:", psErr)
      }
    } catch (e) {
      console.warn("Could not delete payment_submissions:", e)
    }

    // f. Materials: nullify batch_id and filter out from batch_ids array
    try {
      await admin
        .from("materials")
        .update({ batch_id: null })
        .eq("batch_id", cleanId)

      const { data: mats } = await admin
        .from("materials")
        .select("id, batch_ids")
      if (mats) {
        for (const m of mats) {
          if (Array.isArray(m.batch_ids) && m.batch_ids.includes(cleanId)) {
            const updated = m.batch_ids.filter((bId: string) => bId !== cleanId)
            await admin.from("materials").update({ batch_ids: updated }).eq("id", m.id)
          }
        }
      }
    } catch (e) {
      console.warn("Could not unlink materials:", e)
    }

    // g. Exams: nullify batch_id and filter out from batch_ids array
    try {
      await admin
        .from("exams")
        .update({ batch_id: null })
        .eq("batch_id", cleanId)

      const { data: examsList } = await admin
        .from("exams")
        .select("id, batch_ids")
      if (examsList) {
        for (const ex of examsList) {
          if (Array.isArray(ex.batch_ids) && ex.batch_ids.includes(cleanId)) {
            const updated = ex.batch_ids.filter((bId: string) => bId !== cleanId)
            await admin.from("exams").update({ batch_ids: updated }).eq("id", ex.id)
          }
        }
      }
    } catch (e) {
      console.warn("Could not unlink exams:", e)
    }

    // h. Delete fee_structures for this batch
    try {
      await admin
        .from("fee_structures")
        .delete()
        .eq("batch_id", cleanId)
    } catch (e) {
      console.warn("Could not delete fee_structures:", e)
    }

    // i. Delete attendance records for this batch
    try {
      await admin
        .from("attendance")
        .delete()
        .eq("batch_id", cleanId)
    } catch (e) {
      console.warn("Could not delete attendance:", e)
    }

    // j. Delete fee_dues for this batch
    try {
      await admin
        .from("fee_dues")
        .delete()
        .eq("batch_id", cleanId)
    } catch (e) {
      console.warn("Could not delete fee_dues:", e)
    }

    // k. Delete enrollments for this batch & reset/sync rolls for all affected students
    try {
      await admin
        .from("enrollments")
        .delete()
        .eq("batch_id", cleanId)

      // Clean up rolls for all students enrolled in this deleted batch
      for (const sId of enrolledStudentIds) {
        // Query other active enrollments for this student
        const { data: otherEnrs } = await admin
          .from("enrollments")
          .select("id, roll_no, batch_id")
          .eq("student_id", sId)
          .neq("batch_id", cleanId)
          .eq("status", "active")
          .order("created_at", { ascending: true })

        if (otherEnrs && otherEnrs.length > 0) {
          const newPrimaryRoll = otherEnrs[0].roll_no ?? null
          await admin
            .from("students")
            .update({ roll_no: newPrimaryRoll, batch_roll: newPrimaryRoll, updated_at: new Date().toISOString() })
            .eq("id", sId)
        } else {
          // Student was only enrolled in this deleted batch: their roll is now deleted ("no one")
          await admin
            .from("students")
            .update({ roll_no: null, batch_roll: null, updated_at: new Date().toISOString() })
            .eq("id", sId)
        }
      }
    } catch (e) {
      console.warn("Could not delete enrollments or update student rolls:", e)
    }

    // l. Finally, delete the batch record itself
    const { error: delErr } = await admin
      .from("batches")
      .delete()
      .eq("id", cleanId)

    if (delErr) {
      console.error("Failed to delete batch row:", delErr)
      return NextResponse.json(
        { error: delErr.message || "Failed to delete batch from database." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted_id: cleanId,
      message: `Batch "${batch.name}" and associated enrollments were successfully deleted.`
    })
  } catch (err: unknown) {
    console.error("Unexpected error in /api/batches/delete:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error deleting batch." },
      { status: 500 }
    )
  }
}
