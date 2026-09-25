import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffRole, isAuthError } from "@/lib/api-auth"

export async function POST(req: NextRequest) {
  const auth = await requireStaffRole(["owner", "branch_director", "super_manager", "manager"])
  if (isAuthError(auth)) return auth

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

    const hasServiceKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder")
    )
    const db = hasServiceKey ? createAdminClient() : auth.supabase

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

    const extendedPayload = {
      ...basePayload,
      classroom: cleanClassroom,
      branch_seats: typeof branch_seats === "object" ? branch_seats : {},
      approval_status: approval_status || "approved"
    }

    let savedBatchId = id

    if (id) {
      // 1. UPDATE EXISTING BATCH
      let res = await db
        .from("batches")
        .update(extendedPayload)
        .eq("id", id)
        .select()

      if (res.error) {
        res = await db
          .from("batches")
          .update(basePayload)
          .eq("id", id)
          .select()
      }

      if (res.error) {
        // Fallback to user supabase client
        res = await auth.supabase
          .from("batches")
          .update(basePayload)
          .eq("id", id)
          .select()
      }

      if (res.error) {
        return NextResponse.json(
          { error: res.error.message || "Failed to update batch in database." },
          { status: 500 }
        )
      }
    } else {
      // 2. CREATE NEW BATCH
      let createRes = await db
        .from("batches")
        .insert(extendedPayload)
        .select()
        .single()

      if (createRes.error) {
        createRes = await db
          .from("batches")
          .insert(basePayload)
          .select()
          .single()
      }

      if (createRes.error) {
        // Fallback to authenticated user client
        createRes = await auth.supabase
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
    }

    // Fetch the final saved batch cleanly
    let finalBatch: any = null
    const fetchRes = await db
      .from("batches")
      .select("*")
      .eq("id", savedBatchId)
      .maybeSingle()

    if (fetchRes.data) {
      finalBatch = fetchRes.data
    } else {
      const fb = await auth.supabase
        .from("batches")
        .select("*")
        .eq("id", savedBatchId)
        .maybeSingle()
      finalBatch = fb.data || { id: savedBatchId, ...basePayload }
    }

    return NextResponse.json({
      success: true,
      batch: finalBatch,
      message: `Batch "${finalBatch.name || cleanName}" saved successfully!`
    })
  } catch (err: any) {
    console.error("Batch save server error:", err)
    return NextResponse.json(
      { error: err.message || "Internal server error saving batch." },
      { status: 500 }
    )
  }
}
