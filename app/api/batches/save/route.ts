import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      name,
      status = "ongoing",
      branch_id,
      selected_branch_ids = [],
      branch_seats = {},
      subject,
      class_level,
      max_seats = 30,
      monthly_fee = 0,
      admission_fee = 0,
      fee_type = "monthly",
      schedule_days,
      schedule_time,
      description,
      classroom,
      teacher_id,
      is_active = true,
      approval_status = "approved"
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Batch name is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const cleanName = name.trim()
    const cleanStatus = status || "ongoing"
    const parsedMaxSeats = parseInt(String(max_seats)) || 30
    const parsedMonthlyFee = parseFloat(String(monthly_fee)) || 0
    const parsedAdmissionFee = parseFloat(String(admission_fee)) || 0
    const cleanClassroom = typeof classroom === "string" ? classroom.trim() : ""

    // Prepare core payload
    const basePayload: Record<string, any> = {
      name: cleanName,
      status: cleanStatus,
      subject: subject?.trim() || null,
      class_level: class_level?.trim() || null,
      teacher_id: teacher_id || null,
      max_seats: parsedMaxSeats,
      monthly_fee: parsedMonthlyFee,
      admission_fee: parsedAdmissionFee,
      fee_type: fee_type || "monthly",
      schedule_days: schedule_days?.trim() || null,
      schedule_time: schedule_time?.trim() || null,
      description: description?.trim() || null,
      is_active: cleanStatus !== "finished",
    }

    if (branch_id) {
      basePayload.branch_id = branch_id
    }

    // Optional columns: classroom, branch_seats, approval_status
    const extendedPayload = {
      ...basePayload,
      classroom: cleanClassroom,
      branch_seats: typeof branch_seats === "object" ? branch_seats : {},
      approval_status: approval_status || "approved"
    }

    let savedBatchId = id

    if (id) {
      // 1. UPDATE EXISTING BATCH
      let updateError: any = null
      
      // Try with extended payload first
      const res1 = await admin
        .from("batches")
        .update(extendedPayload)
        .eq("id", id)
        .select()

      if (res1.error) {
        // Fallback without classroom and branch_seats if columns not yet migrated
        const res2 = await admin
          .from("batches")
          .update(basePayload)
          .eq("id", id)
          .select()

        if (res2.error) {
          updateError = res2.error
        }
      }

      if (updateError) {
        console.error("Batch update error:", updateError)
        return NextResponse.json(
          { error: updateError.message || "Failed to update batch in database." },
          { status: 500 }
        )
      }

      // Handle multi-branch updates / additions
      if (Array.isArray(selected_branch_ids) && selected_branch_ids.length > 0) {
        const otherBranchIds = selected_branch_ids.filter(bId => bId && bId !== branch_id)
        
        for (const targetBranchId of otherBranchIds) {
          const branchSpecificSeats = parseInt(String(branch_seats[targetBranchId])) || parsedMaxSeats
          
          // Check if cloned batch row already exists for this branch
          const { data: existingChild } = await admin
            .from("batches")
            .select("id")
            .eq("origin_batch_id", id)
            .eq("branch_id", targetBranchId)
            .maybeSingle()

          if (existingChild) {
            // Update child batch
            await admin
              .from("batches")
              .update({
                name: cleanName,
                status: cleanStatus,
                subject: basePayload.subject,
                class_level: basePayload.class_level,
                max_seats: branchSpecificSeats,
                monthly_fee: parsedMonthlyFee,
                admission_fee: parsedAdmissionFee,
                schedule_days: basePayload.schedule_days,
                schedule_time: basePayload.schedule_time,
                description: basePayload.description,
                classroom: cleanClassroom,
                is_active: cleanStatus !== "finished"
              })
              .eq("id", existingChild.id)
          } else {
            // Create new child batch for this branch
            await admin
              .from("batches")
              .insert({
                ...basePayload,
                branch_id: targetBranchId,
                max_seats: branchSpecificSeats,
                classroom: cleanClassroom,
                origin_branch_id: branch_id || null,
                origin_batch_id: id,
                approval_status: "approved",
                is_active: true
              })
          }
        }
      }
    } else {
      // 2. CREATE NEW BATCH
      let createRes = await admin
        .from("batches")
        .insert(extendedPayload)
        .select()
        .single()

      if (createRes.error) {
        // Fallback without extended fields
        createRes = await admin
          .from("batches")
          .insert(basePayload)
          .select()
          .single()
      }

      if (createRes.error || !createRes.data) {
        console.error("Batch creation error:", createRes.error)
        return NextResponse.json(
          { error: createRes.error?.message || "Failed to create batch in database." },
          { status: 500 }
        )
      }

      savedBatchId = createRes.data.id

      // Create linked batches for any other selected branches
      if (Array.isArray(selected_branch_ids) && selected_branch_ids.length > 0) {
        const otherBranchIds = selected_branch_ids.filter(bId => bId && bId !== branch_id)
        for (const targetBranchId of otherBranchIds) {
          const branchSpecificSeats = parseInt(String(branch_seats[targetBranchId])) || parsedMaxSeats
          await admin
            .from("batches")
            .insert({
              ...basePayload,
              branch_id: targetBranchId,
              max_seats: branchSpecificSeats,
              classroom: cleanClassroom,
              origin_branch_id: branch_id || null,
              origin_batch_id: savedBatchId,
              approval_status: "approved",
              is_active: true
            })
        }
      }
    }

    // Fetch the final saved batch with teacher and branch details cleanly
    const { data: finalBatch, error: fetchErr } = await admin
      .from("batches")
      .select("*")
      .eq("id", savedBatchId)
      .single()

    if (fetchErr || !finalBatch) {
      return NextResponse.json({ success: true, id: savedBatchId })
    }

    // Attach teacher info
    let teacherObj = null
    if (finalBatch.teacher_id) {
      const { data: tData } = await admin
        .from("staff")
        .select("id, name, subject")
        .eq("id", finalBatch.teacher_id)
        .maybeSingle()
      teacherObj = tData
    }

    // Attach branch info
    let branchObj = null
    if (finalBatch.branch_id) {
      const { data: brData } = await admin
        .from("branches")
        .select("id, name")
        .eq("id", finalBatch.branch_id)
        .maybeSingle()
      branchObj = brData
    }

    return NextResponse.json({
      success: true,
      batch: {
        ...finalBatch,
        teacher: teacherObj,
        branch: branchObj
      },
      message: id ? "Batch updated successfully!" : "Batch created successfully!"
    })
  } catch (err: unknown) {
    console.error("Unexpected error in /api/batches/save:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error saving batch." },
      { status: 500 }
    )
  }
}
