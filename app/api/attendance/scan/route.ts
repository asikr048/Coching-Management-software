import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { extractQrCodeFromInput, generateStudentQrCode, getCurrentMonth } from "@/lib/utils"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawQr = body.qr_code || body.code || body.token || body.student_id
    let batchId = body.batch_id
    const date = body.date || new Date().toISOString().split("T")[0]
    const status = body.status || "present"

    if (!rawQr || typeof rawQr !== "string" || !rawQr.trim()) {
      return NextResponse.json(
        { error: "qr_code is required in JSON payload" },
        { status: 400 }
      )
    }

    const cleanCode = extractQrCodeFromInput(rawQr)
    const admin = createAdminClient()
    const supabase = await createClient()

    // 1. Locate student using QR code, student_id, or enrollment qr_code
    let student: any = null
    let matchedEnrollment: any = null

    // Check students table by qr_code
    const { data: byQr } = await admin
      .from("students")
      .select("*, enrollments(*, batch:batches(*))")
      .eq("qr_code", cleanCode)
      .maybeSingle()

    if (byQr) {
      student = byQr
    } else {
      // Check enrollments by qr_code
      const { data: enrMatch } = await admin
        .from("enrollments")
        .select("*, student:students(*), batch:batches(*)")
        .eq("qr_code", cleanCode)
        .maybeSingle()

      if (enrMatch && enrMatch.student) {
        student = enrMatch.student
        matchedEnrollment = enrMatch
        if (!batchId && enrMatch.batch_id) {
          batchId = enrMatch.batch_id
        }
      }
    }

    // Check by student_id or UUID
    if (!student) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode)
      let query = admin.from("students").select("*, enrollments(*, batch:batches(*))")
      if (isUuid) {
        query = query.or(`id.eq.${cleanCode},student_id.ilike.${cleanCode}`)
      } else {
        query = query.ilike("student_id", cleanCode)
      }
      const { data: byId } = await query.maybeSingle()
      if (byId) student = byId
    }

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          error: `No student found for QR code: ${cleanCode}`,
          scanned_code: cleanCode,
        },
        { status: 404 }
      )
    }

    // Auto-heal / persist qr_code if student was missing one in database
    let studentQr = student.qr_code
    if (!studentQr) {
      studentQr = generateStudentQrCode({
        studentId: student.student_id,
        admissionDate: student.enrollment_date,
        createdAt: student.created_at,
        rollNo: student.roll_no || student.batch_roll,
        studentUuid: student.id,
      })
      student.qr_code = studentQr
      try {
        await admin.from("students").update({ qr_code: studentQr }).eq("id", student.id)
      } catch {}
    }

    // 2. Identify target batch
    const allEnrollments: any[] = student.enrollments || []
    const activeEnrollments = allEnrollments.filter(
      (e) => !e.status || e.status === "active" || e.status === "approved" || e.status === "enrolled"
    )
    const targetEnrollments = activeEnrollments.length > 0 ? activeEnrollments : allEnrollments

    let targetBatch: any = null
    let targetEnrollment: any = null

    if (batchId) {
      targetEnrollment = targetEnrollments.find((e) => e.batch_id === batchId) || null
      if (targetEnrollment && targetEnrollment.batch) {
        targetBatch = targetEnrollment.batch
      } else {
        const { data: bData } = await admin.from("batches").select("*").eq("id", batchId).maybeSingle()
        targetBatch = bData
      }
    } else if (matchedEnrollment && matchedEnrollment.batch) {
      targetBatch = matchedEnrollment.batch
      targetEnrollment = matchedEnrollment
      batchId = matchedEnrollment.batch_id
    } else if (targetEnrollments.length > 0) {
      targetEnrollment = targetEnrollments[0]
      targetBatch = targetEnrollment.batch
      batchId = targetEnrollment.batch_id
    }

    if (!targetBatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Student ${student.name} (${student.student_id}) is not enrolled in any batch.`,
          student: {
            id: student.id,
            name: student.name,
            student_id: student.student_id,
          },
        },
        { status: 400 }
      )
    }

    const effectiveRoll =
      targetEnrollment?.roll_no ?? student.roll_no ?? student.batch_roll ?? 1

    // 3. Check Fee Due & Due Date Exceeded status
    let feeDuesQuery = admin
      .from("fee_dues")
      .select("*")
      .eq("student_id", student.id)
      .in("status", ["pending", "partial"])

    if (batchId) {
      feeDuesQuery = feeDuesQuery.or(`batch_id.eq.${batchId},batch_id.is.null`)
    }

    const { data: rawDues } = await feeDuesQuery
    const duesList = (rawDues || []).filter((d) => {
      const outstanding = (Number(d.due_amount) || 0) - (Number(d.paid_amount) || 0)
      return outstanding > 0
    })

    const todayStr = date
    const todayTimestamp = new Date(todayStr).setHours(0, 0, 0, 0)

    let totalDueAmount = 0
    let isOverdue = false
    let earliestDueDate: string | null = null
    let exceededDays = 0

    for (const d of duesList) {
      const outstanding = Math.max(0, (Number(d.due_amount) || 0) - (Number(d.paid_amount) || 0))
      totalDueAmount += outstanding

      if (d.due_date) {
        const dueTimestamp = new Date(d.due_date).setHours(0, 0, 0, 0)
        if (dueTimestamp < todayTimestamp) {
          isOverdue = true
          const diffDays = Math.floor((todayTimestamp - dueTimestamp) / (1000 * 60 * 60 * 24))
          if (diffDays > exceededDays) exceededDays = diffDays
        }
        if (!earliestDueDate || d.due_date < earliestDueDate) {
          earliestDueDate = d.due_date
        }
      }
    }

    const hasDue = totalDueAmount > 0

    let alertMessage = ""
    if (isOverdue) {
      alertMessage = `⚠️ ফি প্রদানের শেষ তারিখ পার হয়ে গেছে (${exceededDays} দিন আগে)! বকেয়া: ৳${totalDueAmount}`
    } else if (hasDue) {
      alertMessage = `বকেয়া ফি আছে: ৳${totalDueAmount} (তারিখ: ${earliestDueDate || "আসন্ন"})`
    } else {
      alertMessage = "কোন বকেয়া ফি নেই।"
    }

    // 4. Save Attendance in Database
    const attendancePayload = {
      student_id: student.id,
      batch_id: targetBatch.id,
      date: todayStr,
      status: status,
      entry_method: "qr",
      fee_alert_triggered: isOverdue || hasDue,
      checked_in_at: new Date().toISOString(),
    }

    let savedRecord: any = null
    let alreadyRecorded = false

    // Check if attendance already exists for this date and batch
    const { data: existingAtt } = await admin
      .from("attendance")
      .select("*")
      .eq("student_id", student.id)
      .eq("batch_id", targetBatch.id)
      .eq("date", todayStr)
      .maybeSingle()

    if (existingAtt) {
      alreadyRecorded = true
      const { data: upd, error: updErr } = await admin
        .from("attendance")
        .update(attendancePayload)
        .eq("id", existingAtt.id)
        .select()
        .single()
      savedRecord = upd || existingAtt
    } else {
      const { data: ins, error: insErr } = await admin
        .from("attendance")
        .insert(attendancePayload)
        .select()
        .single()

      if (insErr) {
        // Fallback upsert
        const fb = await supabase
          .from("attendance")
          .upsert(attendancePayload, { onConflict: "student_id,batch_id,date" })
          .select()
          .single()
        savedRecord = fb.data || attendancePayload
      } else {
        savedRecord = ins
      }
    }

    // 5. Response JSON as requested
    return NextResponse.json(
      {
        success: true,
        message: alreadyRecorded
          ? `উপস্থিতি পুনরায় হালনাগাদ করা হয়েছে (${status})`
          : `উপস্থিতি সফলভাবে গৃহীত হয়েছে (${status})`,
        student: {
          id: student.id,
          name: student.name,
          student_id: student.student_id,
          roll_no: effectiveRoll,
          phone: student.phone,
          guardian_phone: student.guardian_phone,
          photo_url: student.photo_url,
          qr_code: studentQr,
        },
        batch: {
          id: targetBatch.id,
          name: targetBatch.name,
          monthly_fee: targetBatch.monthly_fee || 0,
        },
        attendance: {
          id: savedRecord?.id || null,
          date: todayStr,
          status: status,
          entry_method: "qr",
          checked_in_at: savedRecord?.checked_in_at || new Date().toISOString(),
          already_recorded: alreadyRecorded,
        },
        fee_status: {
          has_due: hasDue,
          due_date_exceeded: isOverdue,
          due_exceeded: isOverdue ? "yes" : "no", // Explicit 'yes' or 'no' requested by user
          is_overdue: isOverdue,
          due_amount: totalDueAmount,
          earliest_due_date: earliestDueDate,
          exceeded_days: exceededDays,
          dues_count: duesList.length,
          alert_message: alertMessage,
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Attendance Scan API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process QR attendance scan",
      },
      { status: 500 }
    )
  }
}
