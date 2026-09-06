import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      form,
      batchId,
      branchId: clientBranchId,
      courseId,
      isCourse,
      paidAmount,
      totalAmount,
      dueAmount,
      paymentMethod,
      senderNumber,
      transactionId,
      authUserId: clientAuthUserId,
    } = body

    const password = (form?.password || body.password || "").trim()

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
    const cleanEmail = form.email ? String(form.email).trim().toLowerCase() : null
    const cleanGuardianPhone = form.guardian_phone?.trim() || cleanPhone
    const cleanSenderNumber = String(senderNumber).trim()
    const cleanTrxId = String(transactionId).trim().toUpperCase()
    const cleanMethod = String(paymentMethod).toLowerCase()
    const actualPaid = Number(paidAmount) || 0
    const totalFee = Number(totalAmount) || 0
    const actualDue = Number(dueAmount) >= 0 ? Number(dueAmount) : Math.max(0, totalFee - actualPaid)

    const admin = createAdminClient()

    let resolvedBranchId: string | null = clientBranchId || form?.branch_id || null
    if (!resolvedBranchId && batchId) {
      try {
        const { data: bRow } = await admin.from("batches").select("branch_id").eq("id", batchId).maybeSingle()
        if (bRow?.branch_id) {
          resolvedBranchId = bRow.branch_id
        }
      } catch {}
    }

    // 1. Find existing student if any
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
        .ilike("email", cleanEmail)
        .maybeSingle()

      if (existingByEmail) {
        studentDbId = existingByEmail.id
        studentCode = existingByEmail.student_id
      }
    }

    // 2. Determine or generate sequential Student ID (MS-10001, MS-10002, ...)
    if (!studentCode) {
      let maxSeq = 10000
      try {
        const { data: lastStudents } = await admin
          .from("students")
          .select("student_id")
          .order("created_at", { ascending: false })
          .limit(50)

        if (lastStudents && lastStudents.length > 0) {
          for (const s of lastStudents) {
            if (s.student_id) {
              const numPart = parseInt(s.student_id.replace(/^MS-/i, ""), 10)
              if (!isNaN(numPart) && numPart > maxSeq) {
                maxSeq = numPart
              }
            }
          }
        }

        const { data: lastProfiles } = await admin
          .from("user_profiles")
          .select("user_id")
          .order("created_at", { ascending: false })
          .limit(50)

        if (lastProfiles && lastProfiles.length > 0) {
          for (const p of lastProfiles) {
            if (p.user_id) {
              const numPart = parseInt(p.user_id.replace(/^MS-/i, ""), 10)
              if (!isNaN(numPart) && numPart > maxSeq) {
                maxSeq = numPart
              }
            }
          }
        }
      } catch {
        // Continue with default fallback
      }

      studentCode = `MS-${String(maxSeq + 1).padStart(5, "0")}`
    }

    // 3. Handle Supabase Auth Account Creation if requested
    let finalAuthUserId: string | null = clientAuthUserId || null
    let accountCreated = false
    const targetAuthEmail = cleanEmail || `${studentCode.toLowerCase()}@medhashiree.local`

    if (!finalAuthUserId && password && password.length >= 6) {
      try {
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: targetAuthEmail,
          password: password,
          email_confirm: true, // Auto-confirm email so student can log in right away
          user_metadata: {
            full_name: form.name.trim(),
            user_id: studentCode,
            phone: cleanPhone || null,
          },
        })

        if (!authError && authData?.user) {
          finalAuthUserId = authData.user.id
          accountCreated = true
        } else if (authError) {
          console.warn("Auth user creation note:", authError.message)
          const msg = authError.message.toLowerCase()
          if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("unique")) {
            // Check if existing auth user matches this email
            try {
              const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
              const matching = userList?.users?.find(
                (u) => u.email?.toLowerCase() === targetAuthEmail.toLowerCase()
              )
              if (matching) {
                finalAuthUserId = matching.id
              }
            } catch {}
          }
        }
      } catch (authException) {
        console.warn("Supabase Auth create exception:", authException)
      }

      // Upsert into user_profiles
      try {
        const { data: existingProfile } = await admin
          .from("user_profiles")
          .select("id")
          .ilike("user_id", studentCode)
          .maybeSingle()

        if (!existingProfile) {
          await admin.from("user_profiles").insert({
            user_id: studentCode,
            email: targetAuthEmail,
            name: form.name.trim(),
            phone: cleanPhone || null,
            auth_user_id: finalAuthUserId || null,
          })
        } else if (finalAuthUserId) {
          await admin
            .from("user_profiles")
            .update({ auth_user_id: finalAuthUserId })
            .eq("id", existingProfile.id)
        }
      } catch (profileErr) {
        console.warn("user_profiles sync warning:", profileErr)
      }
    }

    // 4. If new student, insert; else update
    if (!studentDbId) {
      const studentPayload: Record<string, any> = {
        student_id: studentCode,
        name: form.name.trim(),
        phone: cleanPhone,
        email: cleanEmail || targetAuthEmail,
        gender: form.gender || "male",
        date_of_birth: form.date_of_birth || null,
        guardian_name: form.guardian_name?.trim() || null,
        guardian_phone: cleanGuardianPhone,
        guardian_relation: form.guardian_relation || "Parent",
        school_college: form.school_college?.trim() || null,
        class_level: form.class_level?.trim() || null,
        address: form.address?.trim() || null,
        referred_by_code: form.referred_by_code?.trim() || null,
        is_active: true,
        ...(resolvedBranchId ? { branch_id: resolvedBranchId } : {}),
      }

      const { data: newStudent, error: createStudentErr } = await admin
        .from("students")
        .insert(studentPayload)
        .select("id, student_id")
        .single()

      if (createStudentErr) {
        console.error("Student creation error in admin API:", createStudentErr)
        // Try without explicit student_id if auto trigger/sequence exists
        delete studentPayload.student_id
        const { data: retryStudent, error: retryErr } = await admin
          .from("students")
          .insert(studentPayload)
          .select("id, student_id")
          .single()

        if (retryErr) {
          throw new Error(`Failed to register student record: ${retryErr.message}`)
        }

        studentDbId = retryStudent.id
        studentCode = retryStudent.student_id || studentCode
      } else {
        studentDbId = newStudent.id
        studentCode = newStudent.student_id || studentCode
      }
    } else {
      // Update existing student details non-destructively
      await admin
        .from("students")
        .update({
          name: form.name.trim(),
          ...(studentCode ? { student_id: studentCode } : {}),
          ...(resolvedBranchId ? { branch_id: resolvedBranchId } : {}),
          ...(form.guardian_name?.trim() ? { guardian_name: form.guardian_name.trim() } : {}),
          ...(cleanGuardianPhone ? { guardian_phone: cleanGuardianPhone } : {}),
          ...(form.school_college?.trim() ? { school_college: form.school_college.trim() } : {}),
          ...(form.class_level?.trim() ? { class_level: form.class_level.trim() } : {}),
          ...(form.address?.trim() ? { address: form.address.trim() } : {}),
          ...(form.referred_by_code?.trim() ? { referred_by_code: form.referred_by_code.trim() } : {}),
        })
        .eq("id", studentDbId)
    }

    // 5. Validate duplicate transaction ID
    if (cleanTrxId) {
      const { data: existingTrx } = await admin
        .from("payment_submissions")
        .select("id, status")
        .eq("transaction_id", cleanTrxId)
        .maybeSingle()

      if (existingTrx) {
        return NextResponse.json(
          {
            error: `This Transaction ID (${cleanTrxId}) has already been submitted (Status: ${existingTrx.status}). If this is a new payment, please enter your new Transaction ID.`,
          },
          { status: 400 }
        )
      }
    }

    let isExistingEnrolled = false
    if (studentDbId) {
      if (batchId) {
        const { data: activeEnr } = await admin
          .from("enrollments")
          .select("id")
          .eq("student_id", studentDbId)
          .eq("batch_id", batchId)
          .eq("status", "active")
          .maybeSingle()

        if (activeEnr) {
          isExistingEnrolled = true
        }

        // Check if already has a pending submission for this batch
        const { data: existingPendingBatch } = await admin
          .from("payment_submissions")
          .select("id")
          .eq("student_id", studentDbId)
          .eq("batch_id", batchId)
          .eq("status", "pending")
          .maybeSingle()

        if (existingPendingBatch) {
          return NextResponse.json(
            { error: "You already have a pending payment submission for this batch awaiting admin approval." },
            { status: 400 }
          )
        }
      }

      if (courseId) {
        // Check if student already owns this course
        const { data: existingCourse } = await admin
          .from("course_purchases")
          .select("id")
          .eq("student_id", studentDbId)
          .eq("course_id", courseId)
          .maybeSingle()

        if (existingCourse) {
          return NextResponse.json(
            { error: "You have already purchased and enrolled in this online course! You can access it anytime from your dashboard." },
            { status: 400 }
          )
        }

        // Check if already has a pending submission for this course
        const { data: existingPendingCourse } = await admin
          .from("payment_submissions")
          .select("id")
          .eq("student_id", studentDbId)
          .eq("course_id", courseId)
          .eq("status", "pending")
          .maybeSingle()

        if (existingPendingCourse) {
          return NextResponse.json(
            { error: "You already have a pending payment submission for this online course awaiting admin approval." },
            { status: 400 }
          )
        }
      }
    }

    // 6. Pre-record or link fee_dues if student has remaining due
    let linkedFeeDueId: string | null = null
    const targetDueDate = (() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      d.setDate(10)
      return d.toISOString().split("T")[0]
    })()

    if (batchId && studentDbId && actualDue > 0) {
      try {
        const dueMonth = new Date().toISOString().slice(0, 7)
        const { data: existingDue } = await admin
          .from("fee_dues")
          .select("id, due_amount, paid_amount")
          .eq("student_id", studentDbId)
          .eq("batch_id", batchId)
          .eq("due_month", dueMonth)
          .maybeSingle()

        if (existingDue) {
          linkedFeeDueId = existingDue.id
          await admin
            .from("fee_dues")
            .update({
              due_amount: Math.max(Number(existingDue.due_amount) || 0, totalFee),
              due_date: targetDueDate,
              status: "pending",
            })
            .eq("id", existingDue.id)
        } else {
          const { data: createdDue, error: cDueErr } = await admin
            .from("fee_dues")
            .insert({
              student_id: studentDbId,
              batch_id: batchId,
              due_month: dueMonth,
              due_amount: totalFee,
              paid_amount: 0,
              due_date: targetDueDate,
              status: "pending",
            })
            .select("id")
            .maybeSingle()

          if (createdDue?.id) {
            linkedFeeDueId = createdDue.id
          } else if (cDueErr) {
            console.warn("fee_dues initial insert note:", cDueErr.message)
          }
        }
      } catch (dueErr) {
        console.warn("Fee due pre-record error:", dueErr)
      }
    }

    // 7. Insert payment submission
    const notesContent = isCourse
      ? `Online Course: ${courseId}. Student: ${form.name} (Student ID: ${studentCode}, Phone: ${cleanPhone}). Paid: ৳${actualPaid}, Due: ৳${actualDue}. Trx: ${cleanTrxId}`
      : `${isExistingEnrolled ? "Enrolled Student Fee Payment" : "Batch Enrollment"}: ${batchId}. Student: ${form.name} (Student ID: ${studentCode}, Phone: ${cleanPhone}). Paid: ৳${actualPaid}, Due: ৳${actualDue}. Trx: ${cleanTrxId}`

    const submissionPayload: Record<string, any> = {
      student_id: studentDbId,
      amount: actualPaid,
      total_fee: totalFee,
      due_amount: actualDue,
      due_date: targetDueDate,
      payment_method: cleanMethod,
      sender_number: cleanSenderNumber,
      transaction_id: cleanTrxId,
      status: "pending",
      notes: notesContent,
    }

    if (linkedFeeDueId) {
      submissionPayload.fee_due_id = linkedFeeDueId
    }

    if (resolvedBranchId) {
      submissionPayload.branch_id = resolvedBranchId
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

      // Find any fallback batch if batch_id cannot be null in database
      let fallbackBatchId = batchId
      if (!fallbackBatchId && subError.message.includes("batch_id")) {
        const { data: anyBatch } = await admin.from("batches").select("id").limit(1).maybeSingle()
        if (anyBatch) fallbackBatchId = anyBatch.id
      }

      // Fallback: If columns item_type or course_id or due_amount are missing in DB schema
      const compatiblePayload: Record<string, any> = {
        student_id: studentDbId,
        batch_id: fallbackBatchId,
        amount: actualPaid,
        total_fee: totalFee,
        due_amount: actualDue,
        payment_method: cleanMethod,
        sender_number: cleanSenderNumber,
        transaction_id: cleanTrxId,
        status: "pending",
        notes: notesContent,
      }

      const { data: fallbackSub, error: fallbackSubErr } = await admin
        .from("payment_submissions")
        .insert(compatiblePayload)
        .select("id")
        .single()

      if (fallbackSubErr) {
        console.warn("Secondary payment_submissions failed, trying minimum columns:", fallbackSubErr.message)
        // Minimal core columns insert
        const minimalPayload: Record<string, any> = {
          student_id: studentDbId,
          batch_id: fallbackBatchId,
          amount: actualPaid,
          total_fee: totalFee,
          payment_method: cleanMethod,
          sender_number: cleanSenderNumber,
          transaction_id: cleanTrxId,
          status: "pending",
          notes: notesContent,
        }

        const { data: minSub, error: minSubErr } = await admin
          .from("payment_submissions")
          .insert(minimalPayload)
          .select("id")
          .single()

        if (minSubErr) {
          console.error("Fatal payment_submissions error:", minSubErr)
          return NextResponse.json(
            { error: `Payment submission failed: ${minSubErr.message}` },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          submissionId: minSub.id,
          studentDbId,
          studentId: studentCode,
          accountCreated,
          accountEmail: targetAuthEmail,
        })
      }

      return NextResponse.json({
        success: true,
        submissionId: fallbackSub.id,
        studentDbId,
        studentId: studentCode,
        accountCreated,
        accountEmail: targetAuthEmail,
      })
    }

    return NextResponse.json({
      success: true,
      submissionId: subData.id,
      studentDbId,
      studentId: studentCode,
      accountCreated,
      accountEmail: targetAuthEmail,
    })
  } catch (error: any) {
    console.error("API enroll submit fatal exception:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error submitting payment" },
      { status: 500 }
    )
  }
}
