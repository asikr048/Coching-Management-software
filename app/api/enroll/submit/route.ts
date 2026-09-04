import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      form,
      batchId,
      courseId,
      isCourse,
      paidAmount,
      totalAmount,
      dueAmount,
      paymentMethod,
      senderNumber,
      transactionId,
    } = body

    if (!form || !form.name || !form.phone) {
      return NextResponse.json(
        { error: "Student name and phone number are required." },
        { status: 400 }
      )
    }

    if (!senderNumber || !transactionId || !paymentMethod) {
      return NextResponse.json(
        { error: "Payment method, sender number, and transaction ID are required." },
        { status: 400 }
      )
    }

    const cleanPhone = String(form.phone).trim()
    const cleanEmail = form.email ? String(form.email).trim() : null
    const cleanGuardianPhone = form.guardian_phone?.trim() || cleanPhone
    const cleanSenderNumber = String(senderNumber).trim()
    const cleanTrxId = String(transactionId).trim().toUpperCase()
    const cleanMethod = String(paymentMethod).toLowerCase()
    const actualPaid = Number(paidAmount) || 0
    const totalFee = Number(totalAmount) || 0
    const actualDue = Number(dueAmount) >= 0 ? Number(dueAmount) : Math.max(0, totalFee - actualPaid)

    const admin = createAdminClient()

    // 1. Find or create student
    let studentDbId: string | null = null
    let studentCode: string | null = null

    // Check by phone
    if (cleanPhone) {
      const { data: existingByPhone } = await admin
        .from("students")
        .select("id, student_id, name")
        .eq("phone", cleanPhone)
        .maybeSingle()

      if (existingByPhone) {
        studentDbId = existingByPhone.id
        studentCode = existingByPhone.student_id
      }
    }

    // Check by email if not found
    if (!studentDbId && cleanEmail) {
      const { data: existingByEmail } = await admin
        .from("students")
        .select("id, student_id, name")
        .eq("email", cleanEmail)
        .maybeSingle()

      if (existingByEmail) {
        studentDbId = existingByEmail.id
        studentCode = existingByEmail.student_id
      }
    }

    // If new student, insert
    if (!studentDbId) {
      const fallbackId = `MS-${Math.floor(10000 + Math.random() * 90000)}`
      const { data: newStudent, error: createStudentErr } = await admin
        .from("students")
        .insert({
          student_id: fallbackId,
          name: form.name.trim(),
          phone: cleanPhone,
          email: cleanEmail || null,
          gender: form.gender || "male",
          date_of_birth: form.date_of_birth || null,
          guardian_name: form.guardian_name?.trim() || null,
          guardian_phone: cleanGuardianPhone,
          guardian_relation: form.guardian_relation || "Parent",
          school_college: form.school_college?.trim() || null,
          class_level: form.class_level?.trim() || null,
          address: form.address?.trim() || null,
          referred_by_code: form.referred_by_code?.trim() || null,
        })
        .select("id, student_id")
        .single()

      if (createStudentErr) {
        console.error("Student creation error in admin API:", createStudentErr)
        // Try without student_id in case trigger expects NULL
        const { data: retryStudent, error: retryErr } = await admin
          .from("students")
          .insert({
            name: form.name.trim(),
            phone: cleanPhone,
            email: cleanEmail || null,
            gender: form.gender || "male",
            date_of_birth: form.date_of_birth || null,
            guardian_name: form.guardian_name?.trim() || null,
            guardian_phone: cleanGuardianPhone,
            guardian_relation: form.guardian_relation || "Parent",
            school_college: form.school_college?.trim() || null,
            class_level: form.class_level?.trim() || null,
            address: form.address?.trim() || null,
            referred_by_code: form.referred_by_code?.trim() || null,
          })
          .select("id, student_id")
          .single()

        if (retryErr) {
          throw new Error(`Failed to register student record: ${retryErr.message}`)
        }

        studentDbId = retryStudent.id
        studentCode = retryStudent.student_id
      } else {
        studentDbId = newStudent.id
        studentCode = newStudent.student_id
      }
    } else {
      // Update existing student details non-destructively
      await admin
        .from("students")
        .update({
          name: form.name.trim(),
          ...(form.guardian_name?.trim() ? { guardian_name: form.guardian_name.trim() } : {}),
          ...(cleanGuardianPhone ? { guardian_phone: cleanGuardianPhone } : {}),
          ...(form.school_college?.trim() ? { school_college: form.school_college.trim() } : {}),
          ...(form.class_level?.trim() ? { class_level: form.class_level.trim() } : {}),
          ...(form.address?.trim() ? { address: form.address.trim() } : {}),
          ...(form.referred_by_code?.trim() ? { referred_by_code: form.referred_by_code.trim() } : {}),
        })
        .eq("id", studentDbId)
    }

    // 2. Check for duplicate pending payment submissions or already enrolled
    if (isCourse && courseId) {
      const { data: activeCp } = await admin
        .from("course_purchases")
        .select("id")
        .eq("student_id", studentDbId)
        .eq("course_id", courseId)
        .maybeSingle()

      if (activeCp) {
        return NextResponse.json({
          success: true,
          alreadyEnrolled: true,
          studentDbId,
          studentId: studentCode,
          message: "You have already purchased this course! You can view it in your dashboard.",
        })
      }
    } else if (batchId) {
      const { data: activeEnr } = await admin
        .from("enrollments")
        .select("id")
        .eq("student_id", studentDbId)
        .eq("batch_id", batchId)
        .eq("status", "active")
        .maybeSingle()

      if (activeEnr) {
        return NextResponse.json({
          success: true,
          alreadyEnrolled: true,
          studentDbId,
          studentId: studentCode,
          message: "You are already enrolled in this batch!",
        })
      }

      const { data: existingSub } = await admin
        .from("payment_submissions")
        .select("id, transaction_id")
        .eq("student_id", studentDbId)
        .eq("batch_id", batchId)
        .eq("status", "pending")
        .maybeSingle()

      if (existingSub) {
        return NextResponse.json({
          success: true,
          existingPending: true,
          studentDbId,
          studentId: studentCode,
          message: "You already have a pending payment submitted for this batch.",
        })
      }
    }

    // 3. Insert payment submission
    // First attempt with full columns (item_type, course_id, batch_id)
    const notesContent = isCourse
      ? `Online Course: ${courseId}. Student: ${form.name} (${cleanPhone}). Paid: ৳${actualPaid}, Due: ৳${actualDue}. Trx: ${cleanTrxId}`
      : `Batch Enrollment: ${batchId}. Student: ${form.name} (${cleanPhone}). Paid: ৳${actualPaid}, Due: ৳${actualDue}. Trx: ${cleanTrxId}`

    const submissionPayload: Record<string, any> = {
      student_id: studentDbId,
      amount: actualPaid,
      total_fee: totalFee,
      due_amount: actualDue,
      payment_method: cleanMethod,
      sender_number: cleanSenderNumber,
      transaction_id: cleanTrxId,
      status: "pending",
      notes: notesContent,
    }

    if (batchId) {
      submissionPayload.batch_id = batchId
      submissionPayload.item_type = "batch"
    }

    if (courseId) {
      submissionPayload.course_id = courseId
      submissionPayload.item_type = "course"
    }

    const { data: subData, error: subError } = await admin
      .from("payment_submissions")
      .insert(submissionPayload)
      .select("id")
      .single()

    if (subError) {
      console.warn("Primary payment_submissions insert failed, trying compatible payload:", subError.message)
      // Fallback: If columns item_type or course_id are missing in old DB schema
      const compatiblePayload: Record<string, any> = {
        student_id: studentDbId,
        amount: actualPaid,
        total_fee: totalFee,
        due_amount: actualDue,
        payment_method: cleanMethod,
        sender_number: cleanSenderNumber,
        transaction_id: cleanTrxId,
        status: "pending",
        notes: notesContent,
      }
      if (batchId) {
        compatiblePayload.batch_id = batchId
      }

      const { data: fallbackSub, error: fallbackSubErr } = await admin
        .from("payment_submissions")
        .insert(compatiblePayload)
        .select("id")
        .single()

      if (fallbackSubErr) {
        console.error("Fatal payment_submissions error:", fallbackSubErr)
        return NextResponse.json(
          { error: `Payment submission failed: ${fallbackSubErr.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        submissionId: fallbackSub.id,
        studentDbId,
        studentId: studentCode,
      })
    }

    return NextResponse.json({
      success: true,
      submissionId: subData.id,
      studentDbId,
      studentId: studentCode,
    })
  } catch (error: any) {
    console.error("API enroll submit fatal exception:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error submitting payment" },
      { status: 500 }
    )
  }
}
