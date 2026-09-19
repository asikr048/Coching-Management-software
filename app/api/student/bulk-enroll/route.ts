import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AdmissionSlipData, StudentIdCardData } from "@/lib/id-card-generator"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface StudentImportPayload {
  name: string
  guardian_phone: string
  due_amount?: number
  guardian_name?: string
  phone?: string
  address?: string
  school_college?: string
  gender?: "male" | "female" | "other"
  class_level?: string
  email?: string
}

function normalizeBDPhone(raw: string): string {
  if (!raw) return ""
  const clean = raw.replace(/[^0-9+]/g, "").trim()
  if (!clean) return ""

  // Case 1: Excel stripped leading 0, e.g. "1302201431" (10 digits starting with 13-19)
  if (/^1[3-9]\d{8}$/.test(clean)) {
    return `+880${clean}`
  }

  // Case 2: Standard local 11 digits starting with 01, e.g. "01302201431"
  if (/^01[3-9]\d{8}$/.test(clean)) {
    return `+88${clean}`
  }

  // Case 3: 13 digits starting with 8801, e.g. "8801302201431"
  if (/^8801[3-9]\d{8}$/.test(clean)) {
    return `+${clean}`
  }

  // Case 4: Already "+8801302201431"
  if (/^\+8801[3-9]\d{8}$/.test(clean)) {
    return clean
  }

  // Any other 10 digit number starting with 1
  if (clean.length === 10 && clean.startsWith("1")) {
    return `+880${clean}`
  }

  return clean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      batch_id,
      branch_id,
      password,
      students = []
    } = body

    if (!batch_id) {
      return NextResponse.json({ error: "Batch selection is required." }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "No students provided for bulk enrollment." }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch batch details safely
    const { data: batch, error: bErr } = await admin
      .from("batches")
      .select("*, branch:branches(id, name)")
      .eq("id", batch_id)
      .maybeSingle()

    if (bErr || !batch) {
      return NextResponse.json({ error: "Selected batch not found." }, { status: 404 })
    }

    if (batch.status === "admission_closed" || batch.status === "finished") {
      return NextResponse.json({ error: `Admission is closed for batch "${batch.name}".` }, { status: 400 })
    }

    // 2. Check seat capacity
    const { count: liveActiveCount } = await admin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch_id)
      .eq("status", "active")

    const maxSeats = batch.max_seats || 50
    const currentOccupied = Math.max(Number(batch.current_seats) || 0, Number(liveActiveCount) || 0)
    const availableSeats = Math.max(0, maxSeats - currentOccupied)

    if (students.length > availableSeats) {
      return NextResponse.json({
        error: `Cannot enroll ${students.length} students. Only ${availableSeats} seat(s) remaining in batch "${batch.name}" (Max: ${maxSeats}, Occupied: ${currentOccupied}).`
      }, { status: 400 })
    }

    // 3. Fetch branch info
    const effectiveBranchId = branch_id || batch.branch_id || null
    let branchName = batch.branch?.name || "Main Branch"
    if (effectiveBranchId && !batch.branch?.name) {
      const { data: br } = await admin.from("branches").select("name").eq("id", effectiveBranchId).maybeSingle()
      if (br?.name) branchName = br.name
    }

    // 4. Calculate starting roll number for this batch
    const { data: bEnrs } = await admin
      .from("enrollments")
      .select("roll_no")
      .eq("batch_id", batch_id)

    let highestRoll = 0
    if (bEnrs && bEnrs.length > 0) {
      bEnrs.forEach((e: any) => {
        const r = Number(e.roll_no)
        if (!isNaN(r) && r > highestRoll) highestRoll = r
      })
    }
    if (highestRoll === 0) {
      highestRoll = bEnrs?.length || currentOccupied || 0
    }

    // 5. Calculate starting Student ID sequence (MS-XXXXX)
    const { data: lastStudents } = await admin
      .from("students")
      .select("student_id")
      .ilike("student_id", "MS-%")
      .order("student_id", { ascending: false })
      .limit(20)

    let maxSeq = 0
    if (lastStudents && lastStudents.length > 0) {
      for (const s of lastStudents) {
        const numPart = parseInt(s.student_id.replace(/^MS-/i, ""), 10)
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart
        }
      }
    }
    if (maxSeq === 0) {
      const { count } = await admin.from("students").select("*", { count: "exact", head: true })
      maxSeq = count || 0
    }

    const today = new Date()
    const curMonthStr = today.toISOString().slice(0, 7) // YYYY-MM
    const defaultDueDate = (() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      d.setDate(10)
      return d.toISOString().split("T")[0]
    })()

    const results: Array<{
      student: any
      enrollment: any
      slip_data: AdmissionSlipData
      id_card_data: StudentIdCardData
    }> = []

    let nextRollSeq = highestRoll
    let nextStudentSeq = maxSeq

    // Process students sequentially to ensure deterministic ID and roll numbers
    for (let i = 0; i < students.length; i++) {
      const row: StudentImportPayload = students[i]
      const trimmedName = (row.name || `Student ${i + 1}`).trim()
      const guardianPhone = normalizeBDPhone(row.guardian_phone || row.phone || "")
      const studentPhone = normalizeBDPhone(row.phone || "")
      const effectiveStudentPhone = studentPhone || guardianPhone
      const effectiveGuardianPhone = guardianPhone || studentPhone || "+8801700000000"
      const guardianName = (row.guardian_name || "").trim()
      const address = (row.address || "").trim()
      const school = (row.school_college || "").trim()
      const classLevel = (row.class_level || batch.class_level || "").trim()
      const gender = row.gender === "female" || row.gender === "other" ? row.gender : "male"
      const studentDue = typeof row.due_amount === "number" ? Math.max(0, row.due_amount) : 0

      nextStudentSeq++
      nextRollSeq++

      const studentIdStr = `MS-${String(nextStudentSeq).padStart(5, "0")}`
      const studentEmail = (row.email || "").trim() || `${studentIdStr.toLowerCase()}@medhashiree.local`
      const assignedRoll = nextRollSeq

      // A. Create or update auth user via Supabase Admin Auth
      let authUserId: string | null = null
      try {
        const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
          email: studentEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: trimmedName,
            user_id: studentIdStr,
            phone: effectiveStudentPhone,
            initial_password: password
          }
        })

        if (!authErr && authUser?.user?.id) {
          authUserId = authUser.user.id
        } else if (authErr) {
          const { data: userList } = await admin.auth.admin.listUsers()
          const existing = userList?.users?.find(u => u.email?.toLowerCase() === studentEmail.toLowerCase())
          if (existing) {
            await admin.auth.admin.updateUserById(existing.id, {
              password: password,
              user_metadata: {
                full_name: trimmedName,
                user_id: studentIdStr,
                phone: effectiveStudentPhone,
                initial_password: password
              }
            })
            authUserId = existing.id
          }
        }
      } catch (authException) {
        console.warn(`Auth user setup notice for ${studentIdStr}:`, authException)
      }

      // B. Upsert into user_profiles
      try {
        await admin.from("user_profiles").upsert({
          user_id: studentIdStr,
          email: studentEmail,
          name: trimmedName,
          phone: effectiveStudentPhone,
          auth_user_id: authUserId
        })
      } catch {}

      // C. Insert student record into students table
      const studentPayload: Record<string, any> = {
        student_id: studentIdStr,
        name: trimmedName,
        branch_id: effectiveBranchId,
        phone: effectiveStudentPhone || null,
        email: studentEmail,
        gender: gender,
        guardian_name: guardianName || null,
        guardian_phone: effectiveGuardianPhone,
        guardian_relation: "Parent",
        address: address || null,
        school_college: school || null,
        class_level: classLevel || null,
        roll_no: assignedRoll,
        batch_roll: assignedRoll,
        enrollment_date: today.toISOString().split("T")[0],
        is_active: true
      }

      const { data: createdStudent, error: sErr } = await admin
        .from("students")
        .insert(studentPayload)
        .select()
        .single()

      if (sErr || !createdStudent) {
        throw new Error(`Failed to create student "${trimmedName}": ${sErr?.message || "Database error"}`)
      }

      // D. Insert into enrollments table
      const enrPayload: Record<string, any> = {
        student_id: createdStudent.id,
        batch_id: batch_id,
        status: "active",
        roll_no: assignedRoll
      }
      if (effectiveBranchId) {
        enrPayload.branch_id = effectiveBranchId
      }

      let { data: createdEnr, error: enrErr } = await admin
        .from("enrollments")
        .insert(enrPayload)
        .select()
        .single()

      // Fallback if schema cache doesn't have roll_no or branch_id
      if (enrErr && (enrErr.message?.includes("roll_no") || enrErr.message?.includes("branch_id") || (enrErr as any).code === "PGRST204")) {
        delete enrPayload.roll_no
        delete enrPayload.branch_id
        const retry = await admin.from("enrollments").insert(enrPayload).select().single()
        createdEnr = retry.data
      }

      // E. Fee Dues insertion if student has due amount for the month
      const receiptNo = `RCP-${today.getFullYear()}-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(2, "0")}`

      if (studentDue > 0) {
        try {
          await admin.from("fee_dues").insert({
            student_id: createdStudent.id,
            batch_id: batch_id,
            due_month: curMonthStr,
            due_amount: studentDue,
            paid_amount: 0,
            due_date: defaultDueDate,
            status: "pending"
          })
        } catch (dueErr) {
          console.warn("Due insert notice:", dueErr)
        }
      }

      const dateStr = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })

      // F. Construct Slip & ID card data for immediate print/PDF
      const slipData: AdmissionSlipData = {
        receipt_number: receiptNo,
        student_name: trimmedName,
        student_id: studentIdStr,
        password: password,
        student_phone: effectiveStudentPhone || undefined,
        student_email: studentEmail,
        guardian_name: guardianName || undefined,
        guardian_phone: effectiveGuardianPhone || undefined,
        batch_name: batch.name,
        batch_roll: assignedRoll,
        branch_name: branchName,
        subject: batch.subject || batch.class_level || "General",
        date: dateStr,
        total_fee: studentDue > 0 ? studentDue : (batch.monthly_fee || 0),
        paid_amount: 0,
        due_amount: studentDue,
        due_date: studentDue > 0 ? defaultDueDate : undefined,
        payment_method: studentDue > 0 ? "DUE / PENDING" : "NONE",
        qr_data: `Student ID: ${studentIdStr} | Name: ${trimmedName} | Batch: ${batch.name} | Roll: #${assignedRoll} | Due: ${studentDue}`
      }

      const idCardData: StudentIdCardData = {
        student_name: trimmedName,
        student_id: studentIdStr,
        batch_name: batch.name,
        batch_roll: assignedRoll,
        subject: batch.subject || batch.class_level || "General",
        branch_name: branchName,
        student_phone: effectiveStudentPhone || undefined,
        guardian_name: guardianName || undefined,
        guardian_phone: effectiveGuardianPhone || undefined,
        qr_data: `MEDHASHIREE-ID:${studentIdStr}|ROLL:${assignedRoll}|BATCH:${batch.name}|NAME:${trimmedName}`
      }

      results.push({
        student: createdStudent,
        enrollment: createdEnr || { roll_no: assignedRoll },
        slip_data: slipData,
        id_card_data: idCardData
      })
    }

    // 7. Update batch seat count accurately
    const finalOccupiedSeats = Math.min(maxSeats, currentOccupied + results.length)
    await admin.from("batches").update({ current_seats: finalOccupiedSeats }).eq("id", batch_id)

    return NextResponse.json({
      success: true,
      count: results.length,
      batch: {
        id: batch.id,
        name: batch.name,
        current_seats: finalOccupiedSeats,
        max_seats: maxSeats
      },
      roll_range: {
        start: highestRoll + 1,
        end: nextRollSeq
      },
      results
    })
  } catch (err: any) {
    console.error("Bulk enroll error:", err)
    return NextResponse.json({
      error: err?.message || "Failed to complete bulk enrollment."
    }, { status: 500 })
  }
}
