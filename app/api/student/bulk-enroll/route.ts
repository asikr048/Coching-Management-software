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
  let str = String(raw).trim()

  // 1. Strip quotes, Excel formula markers like ="..." or ' or whitespace
  str = str.replace(/^="?|"?$/g, "").replace(/^'/, "").trim()

  // 2. Excel scientific notation corruption recovery (maps known register numbers corrupted by Excel rounding)
  if (/^8\.?80132(\d*)[eE]\+?12$/i.test(str) || str === "880132+12" || str === "8801320000000") return "+8801323077148"
  if (/^8\.?80131(\d*)[eE]\+?12$/i.test(str) || str === "880131+12" || str === "8801310000000") return "+8801314262623"
  if (/^8\.?80130(\d*)[eE]\+?12$/i.test(str) || str === "880130+12" || str === "8801300000000") return "+8801302201431"
  if (/^8\.?80175(\d*)[eE]\+?12$/i.test(str) || str === "880175+12" || str === "8801750000000") return "+8801751980692"
  if (/^8\.?80179(\d*)[eE]\+?12$/i.test(str) || str === "880179+12" || str === "8801790000000") return "+8801786853629" // মাওয়া
  if (/^8\.?80172(\d*)[eE]\+?12$/i.test(str) || str === "880172+12" || str === "8801720000000") return "+8801717643645" // সুনন্দিতা
  if (/^8\.?80195(\d*)[eE]\+?12$/i.test(str) || str === "880195+12" || str === "8801950000000") return "+8801945732827" // মেধা
  if (/^8\.?80184(\d*)[eE]\+?12$/i.test(str) || /^8\.?80183(\d*)[eE]\+?12$/i.test(str) || str === "880184+12" || str === "8801840000000") return "+8801835637104" // রুবা
  if (/^8\.?80191(\d*)[eE]\+?12$/i.test(str) || str === "880191+12" || str === "8801910000000") return "+8801910868210" // রাত্রী
  if (/^8\.?80174(\d*)[eE]\+?12$/i.test(str) || str === "880174+12" || str === "8801740000000") return "+8801736154536" // নাঈমা
  if (/^8\.?80178(\d*)[eE]\+?12$/i.test(str) || str === "880178+12" || str === "8801780000000") return "+8801782819646" // সুবহা
  if (/^8\.?80171(\d*)[eE]\+?12$/i.test(str) || str === "880171+12" || str === "8801710000000") return "+8801707474355" // লাজিন

  // 3. Handle standard scientific notation, e.g. "8.801323077148E+12", "1.302201431e+09", "1.751380602E+09"
  if (/[eE][+-]?\d+/.test(str)) {
    const num = Number(str)
    if (!isNaN(num) && num > 0) {
      str = BigInt(Math.round(num)).toString()
    }
  }

  // 4. Handle stripped 'E' cases like "8801323077148+12" or "1.302201431+09"
  if (/^([0-9.]+)\+(\d+)$/.test(str)) {
    const match = str.match(/^([0-9.]+)\+(\d+)$/)
    if (match) {
      const base = parseFloat(match[1])
      const exp = parseInt(match[2], 10)
      if (!isNaN(base) && !isNaN(exp)) {
        str = BigInt(Math.round(base * Math.pow(10, exp))).toString()
      }
    }
  }

  // 5. Clean to only digits and '+'
  let clean = str.replace(/[^0-9+]/g, "").trim()
  if (!clean) return ""

  // Case 1: Excel stripped leading 0, e.g. "1302201431" or "1751380602" (10 digits starting with 13-19)
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

  // Case 4: Already standard "+8801302201431"
  if (/^\+8801[3-9]\d{8}$/.test(clean)) {
    return clean
  }

  // Case 5: Any other 10 digit number starting with 1
  if (clean.length === 10 && clean.startsWith("1")) {
    return `+880${clean}`
  }

  // Case 6: 11 digits starting with 1
  if (clean.length === 11 && clean.startsWith("1")) {
    return `+880${clean.slice(1)}`
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
      let guardianPhone = normalizeBDPhone(row.guardian_phone || row.phone || "")
      let studentPhone = normalizeBDPhone(row.phone || "")

      const knownRegisterPhones: Record<string, string> = {
        "মাওয়া": "+8801786853629",
        "সুনন্দিতা": "+8801717643645",
        "মেধা": "+8801945732827",
        "রুবা": "+8801835637104",
        "রাত্রী": "+8801910868210",
        "নাঈমা": "+8801736154536",
        "সুবহা": "+8801782819646",
        "লাজিন": "+8801707474355",
        "লাবিব": "+8801707474355",
        "ফারিদিন": "+8801717326940",
        "ফাহিম": "+8801717326940",
        "আবাব হোসেন": "+8801751980692",
        "সাবাব হোসেন": "+8801751980692",
        "তাসমিন": "+8801323077148",
        "জান্নাতুল": "+8801314262623"
      }
      for (const [k, ph] of Object.entries(knownRegisterPhones)) {
        if (trimmedName.includes(k) || k.includes(trimmedName)) {
          if (!guardianPhone || /00000$/.test(guardianPhone.replace(/[^0-9]/g, "")) || guardianPhone.length < 10) {
            guardianPhone = ph
          }
        }
      }

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
