import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { AdmissionSlipData, StudentIdCardData } from "@/lib/id-card-generator"
import { requireStaffRole, isAuthError } from "@/lib/api-auth";
import { generateStudentQrCode, getStudentVerificationUrl, parseRollNumber } from "@/lib/utils"

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
  student_id?: string
  roll_no?: number | string
  qr_code?: string
  date_of_birth?: string
  guardian_relation?: string
}

function normalizeBDPhone(raw: string): string {
  if (!raw) return ""
  let str = String(raw).trim()

  // 1. Strip quotes, Excel formula markers like ="..." or ' or whitespace
  str = str.replace(/^="?|"?$/g, "").replace(/^'/, "").trim()

  // 2. Clean to only digits and '+'
  const clean = str.replace(/[^0-9+]/g, "").trim()
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
  const auth = await requireStaffRole(["owner", "branch_director", "super_manager", "manager", "receptionist"]);
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json()
    const {
      batch_id,
      branch_id,
      students = []
    } = body

    if (!batch_id) {
      return NextResponse.json({ error: "Batch selection is required." }, { status: 400 })
    }

    const password = (body.password && String(body.password).trim().length >= 6) ? String(body.password).trim() : "student123"

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "No students provided for bulk enrollment." }, { status: 400 })
    }

    const hasServiceKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder")
    )
    const admin = hasServiceKey ? createAdminClient() : null
    const db = admin || auth.supabase
    const cleanBatchId = String(batch_id).trim()

    // 1. Fetch batch details safely (avoiding fragile embedded joins)
    let batch: any = null
    const { data: bData, error: bErr } = await db
      .from("batches")
      .select("*")
      .eq("id", cleanBatchId)
      .maybeSingle()

    if (bData) {
      batch = bData
    } else {
      const { data: userBatch, error: uErr } = await auth.supabase
        .from("batches")
        .select("*")
        .eq("id", cleanBatchId)
        .maybeSingle()
      if (userBatch) {
        batch = userBatch
      } else {
        console.error("Batch lookup error in bulk-enroll:", { cleanBatchId, bErr, uErr })
      }
    }

    if (!batch) {
      return NextResponse.json({ error: "Selected batch not found." }, { status: 404 })
    }

    if (batch.status === "admission_closed" || batch.status === "finished") {
      return NextResponse.json({ error: `Admission is closed for batch "${batch.name}".` }, { status: 400 })
    }

    // 2. Check seat capacity
    let liveActiveCount = 0
    try {
      const { count } = await db
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", cleanBatchId)
        .eq("status", "active")

      if (typeof count === "number") {
        liveActiveCount = count
      } else {
        const { count: uCount } = await auth.supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("batch_id", cleanBatchId)
          .eq("status", "active")
        if (typeof uCount === "number") liveActiveCount = uCount
      }
    } catch (cntErr) {
      console.warn("Capacity check notice:", cntErr)
    }

    const maxSeats = batch.max_seats || 50
    const currentOccupied = Math.max(Number(batch.current_seats) || 0, Number(liveActiveCount) || 0)
    const availableSeats = Math.max(0, maxSeats - currentOccupied)

    if (students.length > availableSeats) {
      return NextResponse.json({
        error: `Cannot enroll ${students.length} students. Only ${availableSeats} seat(s) remaining in batch "${batch.name}" (Max: ${maxSeats}, Occupied: ${currentOccupied}).`
      }, { status: 400 })
    }

    // 3. Fetch branch info safely
    const effectiveBranchId = branch_id || batch.branch_id || null
    let branchName = "Main Branch"
    if (effectiveBranchId) {
      try {
        const { data: br } = await db.from("branches").select("name").eq("id", effectiveBranchId).maybeSingle()
        if (br?.name) {
          branchName = br.name
        } else {
          const { data: uBr } = await auth.supabase.from("branches").select("name").eq("id", effectiveBranchId).maybeSingle()
          if (uBr?.name) branchName = uBr.name
        }
      } catch {}
    }

    // 4. Collect existing rolls for this batch (source of truth for serial
    // numbering and for detecting conflicts with CSV-supplied rolls). The
    // student identity is kept so that re-importing the same student's row
    // (same student_id) is not treated as a conflict.
    const existingRolls: number[] = []
    const existingRollOwner = new Map<number, { studentId?: string; name?: string }>()
    try {
      let bEnrs: any[] | null = null
      const { data: enrData, error: enrJoinErr } = await db
        .from("enrollments")
        .select("roll_no, student:students(student_id, name)")
        .eq("batch_id", cleanBatchId)

      if (enrData && !enrJoinErr) {
        bEnrs = enrData
      } else {
        const { data: uEnrs } = await auth.supabase
          .from("enrollments")
          .select("roll_no")
          .eq("batch_id", cleanBatchId)
        bEnrs = uEnrs
      }

      if (bEnrs && bEnrs.length > 0) {
        bEnrs.forEach((e: any) => {
          const r = Number(e.roll_no)
          if (!isNaN(r) && r > 0) {
            existingRolls.push(r)
            if (!existingRollOwner.has(r)) {
              existingRollOwner.set(r, {
                studentId: e.student?.student_id || undefined,
                name: e.student?.name || undefined,
              })
            }
          }
        })
      }
    } catch {}

    const existingRollSet = new Set<number>(existingRolls)
    let highestRoll = existingRolls.length > 0 ? Math.max(...existingRolls) : 0

    if (highestRoll === 0) {
      highestRoll = currentOccupied || 0
    }

    // 4b. Validate CSV-supplied rolls BEFORE any write. Reject duplicates within
    // the file and collisions with students already in the batch with a 409 so
    // the uploader can resolve them manually. Blank rolls are assigned serially
    // further down and never collide with the numbers below.
    type RollConflict = { roll: number; reason: "duplicate_in_file" | "already_in_batch"; names: string[]; existingName?: string }
    // Validate every row before any write so a bad row cannot leave a
    // half-finished enrollment behind. Only Name is mandatory; a missing Roll
    // is auto-assigned later.
    for (let i = 0; i < students.length; i++) {
      const row = students[i]
      const name = String(row.name || "").trim()
      if (!name) {
        return NextResponse.json({
          error: `সারি ${i + 1}: নাম আবশ্যক (Row ${i + 1}: Name is required).`
        }, { status: 400 })
      }
      const parsedRoll = parseRollNumber(row.roll_no)
      if (parsedRoll.error) {
        return NextResponse.json({
          error: `সারি ${i + 1} (${name}): ${parsedRoll.error}`
        }, { status: 400 })
      }
    }

    const csvRollGroups = new Map<number, { names: string[]; studentIds: string[] }>()
    students.forEach((row, idx) => {
      const parsedRoll = parseRollNumber(row.roll_no)
      const r = parsedRoll.value
      if (r != null) {
        const entry = csvRollGroups.get(r) || { names: [], studentIds: [] }
        entry.names.push((row.name || `Row ${idx + 1}`).trim() || `Row ${idx + 1}`)
        if (row.student_id) entry.studentIds.push(String(row.student_id).trim())
        csvRollGroups.set(r, entry)
      }
    })

    const rollConflicts: RollConflict[] = []
    csvRollGroups.forEach((entry, roll) => {
      if (entry.names.length > 1) {
        rollConflicts.push({ roll, reason: "duplicate_in_file", names: entry.names })
      }
      if (existingRollSet.has(roll)) {
        const owner = existingRollOwner.get(roll)
        const sameStudent = !!owner?.studentId && entry.studentIds.includes(owner.studentId)
        if (!sameStudent) {
          rollConflicts.push({ roll, reason: "already_in_batch", names: entry.names, existingName: owner?.name })
        }
      }
    })

    if (rollConflicts.length > 0) {
      return NextResponse.json({
        success: false,
        error: "রোল নম্বর সংঘর্ষ পাওয়া গেছে — অনুগ্রহ করে সংঘর্ষগুলো নিজে সমাধান করুন (Roll number conflicts detected. Please resolve them manually.)",
        conflicts: rollConflicts,
      }, { status: 409 })
    }

    // Serial cursor: continue after the highest roll already in use (existing
    // students + rolls explicitly supplied by the file). Gaps are not filled.
    const usedRolls = new Set<number>(existingRollSet)
    csvRollGroups.forEach((_entry, roll) => usedRolls.add(roll))
    let serialCursor = usedRolls.size > 0 ? Math.max(...usedRolls) : (currentOccupied || 0)

    // 5. Calculate starting Student ID sequence (MS-XXXXX)
    let maxSeq = 0
    try {
      let lastStudents: any[] | null = null
      const { data: lsData } = await db
        .from("students")
        .select("student_id")
        .ilike("student_id", "MS-%")
        .order("student_id", { ascending: false })
        .limit(20)

      if (lsData) {
        lastStudents = lsData
      } else {
        const { data: uLs } = await auth.supabase
          .from("students")
          .select("student_id")
          .ilike("student_id", "MS-%")
          .order("student_id", { ascending: false })
          .limit(20)
        lastStudents = uLs
      }

      if (lastStudents && lastStudents.length > 0) {
        for (const s of lastStudents) {
          const numPart = parseInt(s.student_id.replace(/^MS-/i, ""), 10)
          if (!isNaN(numPart) && numPart > maxSeq) {
            maxSeq = numPart
          }
        }
      }
    } catch {}

    if (maxSeq === 0) {
      try {
        const { count } = await db.from("students").select("*", { count: "exact", head: true })
        if (typeof count === "number") {
          maxSeq = count
        } else {
          const { count: uCount } = await auth.supabase.from("students").select("*", { count: "exact", head: true })
          maxSeq = uCount || 0
        }
      } catch {}
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

    let maxAssignedRoll = highestRoll
    let nextStudentSeq = maxSeq

    // Process students sequentially to ensure deterministic ID and roll numbers
    for (let i = 0; i < students.length; i++) {
      const row: StudentImportPayload = students[i]
      const trimmedName = (row.name || "").trim()
      const guardianPhone = normalizeBDPhone(row.guardian_phone || "")
      const studentPhone = normalizeBDPhone(row.phone || "")

      const effectiveStudentPhone = studentPhone || guardianPhone
      // Guardian phone is never inferred from the student's phone or a name.
      // A blank guardian phone stays NULL.
      const effectiveGuardianPhone = guardianPhone || null
      const guardianName = (row.guardian_name || "").trim()
      const address = (row.address || "").trim()
      const school = (row.school_college || "").trim()
      const classLevel = (row.class_level || batch.class_level || "").trim()
      const gender = row.gender === "female" || row.gender === "other" ? row.gender : "male"
      const studentDue = typeof row.due_amount === "number" ? Math.max(0, row.due_amount) : 0

      nextStudentSeq++

      // Support re-import of exported CSV or auto-generate
      const studentIdStr = (row.student_id && String(row.student_id).trim()) || `MS-${String(nextStudentSeq).padStart(5, "0")}`
      const studentEmail = (row.email || "").trim() || `${studentIdStr.toLowerCase()}@medhashiree.local`

      // Roll: keep the validated CSV value, otherwise assign the next serial
      // number after the highest roll already in use in this batch.
      const csvRoll = parseRollNumber(row.roll_no)
      let assignedRoll: number
      if (csvRoll.value != null) {
        assignedRoll = csvRoll.value
      } else {
        do { serialCursor++ } while (usedRolls.has(serialCursor))
        assignedRoll = serialCursor
        usedRolls.add(assignedRoll)
      }
      if (assignedRoll > maxAssignedRoll) maxAssignedRoll = assignedRoll

      // A. Create or update auth user via Supabase Admin Auth (if service key available)
      let authUserId: string | null = null
      if (admin) {
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
            const existing = userList?.users?.find((u: any) => u.email?.toLowerCase() === studentEmail.toLowerCase())
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
      }

      // B. Upsert into user_profiles
      try {
        const { error: upErr } = await db.from("user_profiles").upsert({
          user_id: studentIdStr,
          email: studentEmail,
          name: trimmedName,
          phone: effectiveStudentPhone,
          auth_user_id: authUserId
        })
        if (upErr && db !== auth.supabase) {
          await auth.supabase.from("user_profiles").upsert({
            user_id: studentIdStr,
            email: studentEmail,
            name: trimmedName,
            phone: effectiveStudentPhone,
            auth_user_id: authUserId
          })
        }
      } catch {}

      // C. Insert student record into students table
      const admissionDateStr = today.toISOString().split("T")[0]
      const studentQr = (row.qr_code && String(row.qr_code).trim()) || generateStudentQrCode({
        studentId: studentIdStr,
        admissionDate: admissionDateStr,
        rollNo: assignedRoll,
      })
      const qrVerificationUrl = getStudentVerificationUrl(studentQr)

      const studentPayload: Record<string, any> = {
        student_id: studentIdStr,
        name: trimmedName,
        branch_id: effectiveBranchId,
        phone: effectiveStudentPhone || null,
        email: studentEmail,
        gender: gender,
        date_of_birth: row.date_of_birth || null,
        guardian_name: guardianName || null,
        guardian_phone: effectiveGuardianPhone,
        guardian_relation: row.guardian_relation || "Parent",
        address: address || null,
        school_college: school || null,
        class_level: classLevel || null,
        roll_no: assignedRoll,
        batch_roll: assignedRoll,
        enrollment_date: admissionDateStr,
        is_active: true,
        qr_code: studentQr,
      }

      // Check if student already exists by student_id or phone+name
      let { data: existingStudent } = await db
        .from("students")
        .select("*")
        .eq("student_id", studentIdStr)
        .maybeSingle()

      if (!existingStudent && effectiveStudentPhone && trimmedName) {
        const { data: byPhone } = await db
          .from("students")
          .select("*")
          .eq("phone", effectiveStudentPhone)
          .eq("name", trimmedName)
          .maybeSingle()
        if (byPhone) existingStudent = byPhone
      }

      let createdStudent = existingStudent
      let sErr: any = null

      if (!createdStudent) {
        const insertRes = await db
          .from("students")
          .insert(studentPayload)
          .select()
          .single()
        createdStudent = insertRes.data
        sErr = insertRes.error

        if (sErr && (sErr.message?.includes("qr_code") || (sErr as any).code === "PGRST204")) {
          delete studentPayload.qr_code
          const retryS = await db.from("students").insert(studentPayload).select().single()
          createdStudent = retryS.data
          sErr = retryS.error
        }

        if (sErr || !createdStudent) {
          const retryUser = await auth.supabase.from("students").insert(studentPayload).select().single()
          if (retryUser.data) {
            createdStudent = retryUser.data
            sErr = null
          } else if (retryUser.error && (retryUser.error.message?.includes("qr_code") || (retryUser.error as any).code === "PGRST204")) {
            delete studentPayload.qr_code
            const finalRetry = await auth.supabase.from("students").insert(studentPayload).select().single()
            createdStudent = finalRetry.data
            sErr = finalRetry.error
          }
        }

        if (sErr && ((sErr as any).code === "23505" || sErr.message?.includes("duplicate key"))) {
          const { data: dupStudent } = await db
            .from("students")
            .select("*")
            .eq("student_id", studentIdStr)
            .maybeSingle()
          if (dupStudent) {
            createdStudent = dupStudent
            sErr = null
          }
        }
      }

      if (sErr || !createdStudent) {
        throw new Error(`Failed to create student "${trimmedName}": ${sErr?.message || "Database error"}`)
      }

      // D. Insert or update enrollments table
      const finalMonthlyFee = Number(batch.monthly_fee) || 0

      // Check if student is already enrolled in this batch
      let { data: existingEnr } = await db
        .from("enrollments")
        .select("*")
        .eq("student_id", createdStudent.id)
        .eq("batch_id", cleanBatchId)
        .maybeSingle()

      let createdEnr = existingEnr
      let enrErr: any = null

      if (existingEnr) {
        await db
          .from("enrollments")
          .update({
            status: "active",
            final_monthly_fee: finalMonthlyFee,
            roll_no: assignedRoll || existingEnr.roll_no,
          })
          .eq("id", existingEnr.id)
      } else {
        const enrPayload: Record<string, any> = {
          student_id: createdStudent.id,
          batch_id: cleanBatchId,
          status: "active",
          roll_no: assignedRoll,
          qr_code: studentQr,
          enrollment_date: admissionDateStr,
          final_monthly_fee: finalMonthlyFee,
        }
        if (effectiveBranchId) {
          enrPayload.branch_id = effectiveBranchId
        }

        const insertEnr = await db
          .from("enrollments")
          .insert(enrPayload)
          .select()
          .single()

        createdEnr = insertEnr.data
        enrErr = insertEnr.error

        // Fallback if schema cache doesn't have roll_no, branch_id, qr_code, or final_monthly_fee
        if (enrErr && (
          enrErr.message?.includes("final_monthly_fee") ||
          enrErr.message?.includes("enrollment_date") ||
          enrErr.message?.includes("roll_no") ||
          enrErr.message?.includes("branch_id") ||
          enrErr.message?.includes("qr_code") ||
          enrErr.message?.includes("schema cache") ||
          (enrErr as any).code === "PGRST204"
        )) {
          if (enrErr.message?.includes("final_monthly_fee") || enrErr.message?.includes("schema cache") || (enrErr as any).code === "PGRST204") {
            delete enrPayload.final_monthly_fee
          }
          if (enrErr.message?.includes("enrollment_date")) {
            delete enrPayload.enrollment_date
          }
          delete enrPayload.roll_no
          delete enrPayload.branch_id
          delete enrPayload.qr_code
          const retry = await db.from("enrollments").insert(enrPayload).select().single()
          createdEnr = retry.data
          enrErr = retry.error
        }

        if (enrErr || !createdEnr) {
          const retryUser = await auth.supabase.from("enrollments").insert(enrPayload).select().single()
          if (retryUser.data) {
            createdEnr = retryUser.data
            enrErr = null
          } else if (retryUser.error && (
            retryUser.error.message?.includes("final_monthly_fee") ||
            retryUser.error.message?.includes("enrollment_date") ||
            retryUser.error.message?.includes("roll_no") ||
            retryUser.error.message?.includes("branch_id") ||
            retryUser.error.message?.includes("qr_code") ||
            retryUser.error.message?.includes("schema cache") ||
            (retryUser.error as any).code === "PGRST204"
          )) {
            if (retryUser.error.message?.includes("final_monthly_fee") || retryUser.error.message?.includes("schema cache") || (retryUser.error as any).code === "PGRST204") {
              delete enrPayload.final_monthly_fee
            }
            if (retryUser.error.message?.includes("enrollment_date")) {
              delete enrPayload.enrollment_date
            }
            delete enrPayload.roll_no
            delete enrPayload.branch_id
            delete enrPayload.qr_code
            const finalRetry = await auth.supabase.from("enrollments").insert(enrPayload).select().single()
            createdEnr = finalRetry.data
            enrErr = finalRetry.error
          }
        }
      }

      // Unique-constraint guard: never silently drop a roll. This only triggers
      // if a roll collision slipped past validation (e.g. a concurrent upload).
      if (enrErr && (enrErr as any).code === "23505") {
        throw new Error(`রোল নম্বর ${assignedRoll} এই ব্যাচে ইতিমধ্যে ব্যবহৃত (Roll ${assignedRoll} is already taken in this batch).`)
      }

      // E. Fee Dues insertion if student has due amount for the month
      const receiptNo = `RCP-${today.getFullYear()}-${Date.now().toString().slice(-6)}-${String(i + 1).padStart(2, "0")}`

      if (studentDue > 0) {
        try {
          const { error: dueErr } = await db.from("fee_dues").insert({
            student_id: createdStudent.id,
            batch_id: cleanBatchId,
            due_month: curMonthStr,
            due_amount: studentDue,
            paid_amount: 0,
            due_date: defaultDueDate,
            status: "pending"
          })
          if (dueErr) {
            await auth.supabase.from("fee_dues").insert({
              student_id: createdStudent.id,
              batch_id: cleanBatchId,
              due_month: curMonthStr,
              due_amount: studentDue,
              paid_amount: 0,
              due_date: defaultDueDate,
              status: "pending"
            })
          }
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
        qr_data: qrVerificationUrl,
        qr_code: studentQr,
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
        qr_data: qrVerificationUrl,
        qr_code: studentQr,
      }

      results.push({
        student: createdStudent,
        enrollment: createdEnr || { roll_no: assignedRoll },
        slip_data: slipData,
        id_card_data: idCardData
      })
    }

    // 7. Update batch seat count accurately
    let finalOccupiedSeats = Math.min(maxSeats, currentOccupied + results.length)
    try {
      const { count: liveActiveCount } = await db
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", cleanBatchId)
        .eq("status", "active")
      if (liveActiveCount != null) {
        finalOccupiedSeats = Math.min(maxSeats, Math.max(liveActiveCount, currentOccupied + results.length))
      }
    } catch {}

    try {
      const { error: updErr } = await db.from("batches").update({ current_seats: finalOccupiedSeats }).eq("id", cleanBatchId)
      if (updErr) {
        await auth.supabase.from("batches").update({ current_seats: finalOccupiedSeats }).eq("id", cleanBatchId)
      }
    } catch {}

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
        end: maxAssignedRoll
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
