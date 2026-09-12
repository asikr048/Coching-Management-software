import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper to check UUID format
const isUUID = (val: any): boolean => {
  if (typeof val !== "string") return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
}

/**
 * GET /api/student/enrollment?batch_id=xxx
 * Returns highest roll and next roll (highest + 1) for a batch
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const batchId = searchParams.get("batch_id")

    if (!batchId || !isUUID(batchId)) {
      return NextResponse.json({ error: "Valid batch_id is required" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Query all enrollments for this batch
    const { data: enrs, error } = await admin
      .from("enrollments")
      .select("id, roll_no, status")
      .eq("batch_id", batchId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let highestRoll = 0
    let studentCount = 0

    if (enrs && enrs.length > 0) {
      studentCount = enrs.length
      for (const e of enrs) {
        const r = Number(e.roll_no)
        if (!isNaN(r) && r > highestRoll) {
          highestRoll = r
        }
      }
    }

    const nextRoll = highestRoll > 0 ? highestRoll + 1 : 1

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      highest_roll: highestRoll,
      next_roll: nextRoll,
      student_count: studentCount
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to calculate roll" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/student/enrollment
 * Handles:
 * 1. action: "change_batch" - switches student from current batch to new batch (roll = prev highest + 1)
 * 2. action: "add_enrollment" - enrolls student into an additional batch
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action = "change_batch", student_id, enrollment_id, new_batch_id, batch_id, custom_roll_no } = body

    const admin = createAdminClient()

    if (!student_id) {
      return NextResponse.json({ error: "student_id is required." }, { status: 400 })
    }

    // --- ACTION: CHANGE BATCH ---
    if (action === "change_batch") {
      if (!enrollment_id || !new_batch_id) {
        return NextResponse.json(
          { error: "enrollment_id and new_batch_id are required for change_batch." },
          { status: 400 }
        )
      }

      // 1. Fetch current enrollment
      const { data: existingEnr, error: enrErr } = await admin
        .from("enrollments")
        .select("*, batch:batches(id, name)")
        .eq("id", enrollment_id)
        .maybeSingle()

      if (enrErr || !existingEnr) {
        return NextResponse.json({ error: "Enrollment not found." }, { status: 404 })
      }

      const oldBatchId = existingEnr.batch_id

      if (oldBatchId === new_batch_id) {
        return NextResponse.json(
          { error: "Target batch is the same as the current batch." },
          { status: 400 }
        )
      }

      // 2. Fetch new batch info
      const { data: newBatch, error: nbErr } = await admin
        .from("batches")
        .select("id, name, branch_id, current_seats, max_seats")
        .eq("id", new_batch_id)
        .maybeSingle()

      if (nbErr || !newBatch) {
        return NextResponse.json({ error: "New batch not found." }, { status: 404 })
      }

      // 3. Verify student is not already actively enrolled in new batch
      const { data: alreadyEnrolled } = await admin
        .from("enrollments")
        .select("id")
        .eq("student_id", student_id)
        .eq("batch_id", new_batch_id)
        .eq("status", "active")
        .maybeSingle()

      if (alreadyEnrolled) {
        return NextResponse.json(
          { error: `Student is already enrolled in batch "${newBatch.name}".` },
          { status: 400 }
        )
      }

      // 4. Calculate previous highest roll in new batch: next_roll = highest + 1
      const { data: newBatchEnrs } = await admin
        .from("enrollments")
        .select("id, roll_no")
        .eq("batch_id", new_batch_id)

      let highestRoll = 0
      if (newBatchEnrs && newBatchEnrs.length > 0) {
        for (const e of newBatchEnrs) {
          const r = Number(e.roll_no)
          if (!isNaN(r) && r > highestRoll) {
            highestRoll = r
          }
        }
      }

      const autoRoll = highestRoll > 0 ? highestRoll + 1 : 1
      const finalRoll =
        custom_roll_no && Number(custom_roll_no) > 0 ? Number(custom_roll_no) : autoRoll

      // 5. Update the existing enrollment record to point to the new batch
      const { data: updatedEnr, error: updateErr } = await admin
        .from("enrollments")
        .update({
          batch_id: new_batch_id,
          branch_id: newBatch.branch_id || null,
          roll_no: finalRoll,
          status: "active"
        })
        .eq("id", enrollment_id)
        .select("*, batch:batches(name, subject, monthly_fee, admission_fee, class_level)")
        .single()

      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message || "Failed to update enrollment batch." },
          { status: 500 }
        )
      }

      // 6. Recalculate seats for both old and new batches
      const { count: oldSeats } = await admin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", oldBatchId)
        .eq("status", "active")
      await admin.from("batches").update({ current_seats: oldSeats || 0 }).eq("id", oldBatchId)

      const { count: newSeats } = await admin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", new_batch_id)
        .eq("status", "active")
      await admin.from("batches").update({ current_seats: newSeats || 0 }).eq("id", new_batch_id)

      // 7. Update student table roll_no and batch_roll
      await admin
        .from("students")
        .update({
          roll_no: finalRoll,
          batch_roll: finalRoll,
          updated_at: new Date().toISOString()
        })
        .eq("id", student_id)

      return NextResponse.json({
        success: true,
        message: `Student transferred to "${newBatch.name}". New Roll is #${finalRoll}.`,
        enrollment: updatedEnr,
        roll_no: finalRoll,
        previous_highest_roll: highestRoll
      })
    }

    // --- ACTION: ADD ENROLLMENT ---
    if (action === "add_enrollment") {
      const targetBatchId = batch_id || new_batch_id
      if (!targetBatchId) {
        return NextResponse.json({ error: "batch_id is required." }, { status: 400 })
      }

      // Verify batch exists
      const { data: batch, error: bErr } = await admin
        .from("batches")
        .select("id, name, branch_id, current_seats, max_seats")
        .eq("id", targetBatchId)
        .maybeSingle()

      if (bErr || !batch) {
        return NextResponse.json({ error: "Batch not found." }, { status: 404 })
      }

      // Check if already enrolled
      const { data: existing } = await admin
        .from("enrollments")
        .select("id")
        .eq("student_id", student_id)
        .eq("batch_id", targetBatchId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: `Already enrolled in ${batch.name}` }, { status: 400 })
      }

      // Calculate next roll
      const { data: batchEnrs } = await admin
        .from("enrollments")
        .select("roll_no")
        .eq("batch_id", targetBatchId)

      let highestRoll = 0
      if (batchEnrs && batchEnrs.length > 0) {
        for (const e of batchEnrs) {
          const r = Number(e.roll_no)
          if (!isNaN(r) && r > highestRoll) {
            highestRoll = r
          }
        }
      }

      const autoRoll = highestRoll > 0 ? highestRoll + 1 : 1
      const finalRoll = custom_roll_no && Number(custom_roll_no) > 0 ? Number(custom_roll_no) : autoRoll

      const { data: newEnr, error: insErr } = await admin
        .from("enrollments")
        .insert({
          student_id,
          batch_id: targetBatchId,
          branch_id: batch.branch_id || null,
          roll_no: finalRoll,
          status: "active"
        })
        .select("*, batch:batches(name, subject, monthly_fee, admission_fee, class_level)")
        .single()

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }

      // Update seats
      const { count: seatsCount } = await admin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", targetBatchId)
        .eq("status", "active")
      await admin.from("batches").update({ current_seats: seatsCount || 0 }).eq("id", targetBatchId)

      // Check student table roll
      const { data: stu } = await admin.from("students").select("roll_no, batch_roll").eq("id", student_id).single()
      if (!stu?.roll_no && !stu?.batch_roll) {
        await admin.from("students").update({ roll_no: finalRoll, batch_roll: finalRoll }).eq("id", student_id)
      }

      return NextResponse.json({
        success: true,
        message: `Student enrolled in "${batch.name}" with Roll #${finalRoll}`,
        enrollment: newEnr,
        roll_no: finalRoll
      })
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 })
  } catch (err: unknown) {
    console.error("Error in /api/student/enrollment POST:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/student/enrollment
 * Removes an enrolled batch from a student.
 * - The student's roll in that batch will be no one (freed).
 * - If student has other active batches, primary roll syncs to the remaining batch.
 * - If student has no other active batches, primary roll is cleared to null.
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { enrollment_id, student_id } = body

    if (!enrollment_id || !student_id) {
      return NextResponse.json(
        { error: "enrollment_id and student_id are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 1. Verify enrollment exists
    const { data: enr, error: fetchErr } = await admin
      .from("enrollments")
      .select("id, student_id, batch_id, roll_no, batch:batches(name)")
      .eq("id", enrollment_id)
      .maybeSingle()

    if (fetchErr || !enr) {
      return NextResponse.json({ error: "Enrollment not found." }, { status: 404 })
    }

    const batchId = enr.batch_id
    const batchName = (enr.batch as any)?.name || "Batch"
    const removedRoll = enr.roll_no

    // 2. Unlink any payments referencing this enrollment
    try {
      await admin
        .from("payments")
        .update({ enrollment_id: null })
        .eq("enrollment_id", enrollment_id)
    } catch (e) {
      console.warn("Could not unlink payments referencing enrollment:", e)
    }

    // 3. Delete the enrollment record
    const { error: delErr } = await admin
      .from("enrollments")
      .delete()
      .eq("id", enrollment_id)

    if (delErr) {
      return NextResponse.json(
        { error: delErr.message || "Failed to delete enrollment." },
        { status: 500 }
      )
    }

    // 4. Update batch seats
    if (batchId) {
      const { count: activeCount } = await admin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .eq("status", "active")
      await admin.from("batches").update({ current_seats: activeCount || 0 }).eq("id", batchId)
    }

    // 5. Update student's primary roll_no and batch_roll:
    // If student has other active enrolled batches, sync to first remaining;
    // If no other batches remain, clear roll_no to null ("will be no one").
    const { data: remainingEnrs } = await admin
      .from("enrollments")
      .select("id, roll_no, batch_id")
      .eq("student_id", student_id)
      .eq("status", "active")
      .order("created_at", { ascending: true })

    if (remainingEnrs && remainingEnrs.length > 0) {
      const newRoll = remainingEnrs[0].roll_no ?? null
      await admin
        .from("students")
        .update({ roll_no: newRoll, batch_roll: newRoll, updated_at: new Date().toISOString() })
        .eq("id", student_id)
    } else {
      // No enrolled batches remaining: roll is completely removed
      await admin
        .from("students")
        .update({ roll_no: null, batch_roll: null, updated_at: new Date().toISOString() })
        .eq("id", student_id)
    }

    return NextResponse.json({
      success: true,
      message: `Enrollment in "${batchName}" (Roll #${removedRoll || "-"}) has been removed.`,
      deleted_enrollment_id: enrollment_id,
      freed_roll: removedRoll
    })
  } catch (err: unknown) {
    console.error("Error in /api/student/enrollment DELETE:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 }
    )
  }
}
