import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { submissionId, staffId } = body

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required." }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch submission record
    const { data: sub, error: fetchErr } = await admin
      .from("payment_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle()

    if (fetchErr || !sub) {
      return NextResponse.json(
        { error: fetchErr?.message || "Payment submission not found." },
        { status: 404 }
      )
    }

    if (sub.status === "approved") {
      // Ensure enrollment or course purchase is confirmed in database
      if (sub.batch_id) {
        const { data: existingEnr } = await admin
          .from("enrollments")
          .select("id, status")
          .eq("student_id", sub.student_id)
          .eq("batch_id", sub.batch_id)
          .maybeSingle()

        if (!existingEnr) {
          await admin.from("enrollments").upsert({
            student_id: sub.student_id,
            batch_id: sub.batch_id,
            status: "active",
          }, { onConflict: "student_id,batch_id" })
        } else if (existingEnr.status !== "active") {
          await admin.from("enrollments").update({ status: "active" }).eq("id", existingEnr.id)
        }
      } else if (sub.course_id) {
        const { data: existingCp } = await admin
          .from("course_purchases")
          .select("id")
          .eq("course_id", sub.course_id)
          .eq("student_id", sub.student_id)
          .maybeSingle()

        if (!existingCp) {
          const { data: stInfo } = await admin
            .from("students")
            .select("name, phone, email")
            .eq("id", sub.student_id)
            .maybeSingle()

          await admin.from("course_purchases").insert({
            course_id: sub.course_id,
            student_id: sub.student_id,
            buyer_name: stInfo?.name || "Student",
            buyer_phone: stInfo?.phone || sub.sender_number || null,
            buyer_email: stInfo?.email || null,
            amount_paid: Number(sub.amount) || 0,
            payment_method: sub.payment_method || "online",
            transaction_id: sub.transaction_id || sub.trx_id || null,
          })
        }
      }
      return NextResponse.json({ success: true, message: "Payment is already approved and access confirmed." })
    }

    const nowIso = new Date().toISOString()
    const isCourse = !!sub.course_id || sub.item_type === "course"
    const amountNum = Number(sub.amount) || 0
    const dueAmountNum = Number(sub.due_amount) || 0
    const totalFeeNum = Number(sub.total_fee || (amountNum + dueAmountNum)) || amountNum
    const cleanTrx = sub.transaction_id || sub.trx_id || null
    const cleanSender = sub.sender_number || null

    // 2. Lookup student details
    const { data: student } = await admin
      .from("students")
      .select("id, name, phone, email, student_id, referred_by_code, referred_by_student_id")
      .eq("id", sub.student_id)
      .maybeSingle()

    // 3. Process based on item type
    if (isCourse && sub.course_id) {
      // 3a. Course Purchase Record
      const { data: existingCp } = await admin
        .from("course_purchases")
        .select("id")
        .eq("course_id", sub.course_id)
        .eq("student_id", sub.student_id)
        .maybeSingle()

      if (!existingCp) {
        const { error: cpErr } = await admin.from("course_purchases").insert({
          course_id: sub.course_id,
          student_id: sub.student_id,
          buyer_name: student?.name || "Student",
          buyer_phone: student?.phone || cleanSender || null,
          buyer_email: student?.email || null,
          amount_paid: amountNum,
          payment_method: sub.payment_method || "online",
          transaction_id: cleanTrx,
        })
        if (cpErr && !cpErr.message.includes("duplicate")) {
          console.warn("Course purchase insert note:", cpErr.message)
        }
      }

      // Increment course total_sales
      try {
        const { data: cData } = await admin.from("courses").select("total_sales").eq("id", sub.course_id).maybeSingle()
        if (cData) {
          await admin.from("courses").update({ total_sales: (cData.total_sales || 0) + 1 }).eq("id", sub.course_id)
        }
      } catch (err) {
        console.warn("Course sales counter increment error:", err)
      }

      // Payment record
      const receiptNo = `RCP-C-${Date.now().toString(36).toUpperCase()}`
      await admin.from("payments").insert({
        student_id: sub.student_id,
        amount: amountNum,
        total_paid: amountNum,
        discount: 0,
        late_fee: 0,
        payment_method: sub.payment_method || "online",
        transaction_id: cleanTrx,
        payment_for: "course",
        receipt_number: receiptNo,
        notes: `Course: ${sub.course_id}. Sender: ${cleanSender || "—"}`,
      })
    } else if (sub.batch_id) {
      // 3b. Batch Enrollment or Batch Fee Due
      const isEnrollment =
        sub.item_type === "batch" ||
        sub.item_type === "enrollment" ||
        sub.raw_payload?.created_via === "enrollment_page_v2" ||
        sub.notes?.toLowerCase().includes("batch enrollment") ||
        sub.notes?.toLowerCase().includes("enrollment in") ||
        !sub.fee_due_id

      // 1. Always ensure active enrollment for batch
      const { data: existingEnr } = await admin
        .from("enrollments")
        .select("id, status")
        .eq("student_id", sub.student_id)
        .eq("batch_id", sub.batch_id)
        .maybeSingle()

      if (existingEnr) {
        if (existingEnr.status !== "active") {
          await admin.from("enrollments").update({ status: "active" }).eq("id", existingEnr.id)
        }
      } else {
        const enrPayload: Record<string, any> = {
          student_id: sub.student_id,
          batch_id: sub.batch_id,
          status: "active",
        }
        if (sub.branch_id) {
          enrPayload.branch_id = sub.branch_id
        }

        const { error: enrErr } = await admin.from("enrollments").upsert(
          enrPayload,
          { onConflict: "student_id,batch_id" }
        )

        if (enrErr && !enrErr.message.includes("duplicate")) {
          console.warn("Enrollment upsert note, trying fallback:", enrErr.message)
          await admin.from("enrollments").insert(enrPayload)
        }

        // Also ensure student is linked to branch if not already linked
        if (sub.branch_id && sub.student_id) {
          await admin
            .from("students")
            .update({ branch_id: sub.branch_id })
            .eq("id", sub.student_id)
            .is("branch_id", null)
        }
      }

      // 2. Fetch batch fee details & update seat counter if new enrollment
      let batchMonthlyFee = 0
      let batchAdmissionFee = 0
      let batchTotalFee = 0
      try {
        const { data: bData } = await admin
          .from("batches")
          .select("id, name, monthly_fee, admission_fee, current_seats")
          .eq("id", sub.batch_id)
          .maybeSingle()

        if (bData) {
          batchMonthlyFee = Number(bData.monthly_fee) || 0
          batchAdmissionFee = Number(bData.admission_fee) || 0
          batchTotalFee = batchMonthlyFee + batchAdmissionFee
          if (isEnrollment && (!existingEnr || existingEnr.status !== "active")) {
            await admin.from("batches").update({ current_seats: (bData.current_seats || 0) + 1 }).eq("id", sub.batch_id)
          }
        }
      } catch (err) {
        console.warn("Batch lookup note:", err)
      }

      // 3. Calculate effective remaining due amount
      let effectiveDue = dueAmountNum
      if (effectiveDue <= 0) {
        const match = sub.notes?.match(/Due:\s*৳?\s*([0-9]+(?:\.[0-9]+)?)/i)
        if (match && Number(match[1]) > 0) {
          effectiveDue = Number(match[1])
        } else if (totalFeeNum > amountNum) {
          effectiveDue = totalFeeNum - amountNum
        } else if (batchTotalFee > amountNum) {
          effectiveDue = batchTotalFee - amountNum
        }
      }

      // 4. Payment record
      const receiptNo = `RCP-${Date.now().toString(36).toUpperCase()}`
      let paymentNotes: string | null = cleanSender ? `Sender: ${cleanSender}` : null
      if (sub.payment_method === "referral" || (sub.notes && sub.notes.toLowerCase().includes("referral"))) {
        paymentNotes = sub.notes || (cleanSender ? `Referral: ${cleanSender}` : "Referral payment")
      } else if (sub.notes) {
        paymentNotes = sub.notes
      }

      await admin.from("payments").insert({
        student_id: sub.student_id,
        batch_id: sub.batch_id,
        amount: amountNum,
        total_paid: amountNum,
        discount: 0,
        late_fee: 0,
        payment_method: sub.payment_method || "cash",
        transaction_id: cleanTrx,
        payment_for: isEnrollment ? "enrollment" : "monthly_fee",
        payment_month: sub.due_date ? new Date(sub.due_date).toISOString().slice(0, 7) : nowIso.slice(0, 7),
        paid_at: nowIso,
        received_by: staffId || null,
        receipt_number: receiptNo,
        notes: paymentNotes,
      })

      // 5. Update or create fee_dues
      let dueUpdated = false
      if (sub.fee_due_id) {
        const { data: dueData } = await admin.from("fee_dues").select("*").eq("id", sub.fee_due_id).maybeSingle()
        if (dueData) {
          dueUpdated = true
          const newPaid = (Number(dueData.paid_amount) || 0) + amountNum
          const totalOwed = Math.max(Number(dueData.due_amount) || 0, totalFeeNum, batchTotalFee, newPaid + effectiveDue)
          const isFull = newPaid >= totalOwed
          await admin
            .from("fee_dues")
            .update({
              due_amount: totalOwed,
              paid_amount: newPaid,
              status: isFull ? "paid" : newPaid > 0 ? "partial" : "pending",
              ...(sub.due_date ? { due_date: sub.due_date } : {}),
            })
            .eq("id", sub.fee_due_id)
        }
      }

      if (!dueUpdated && effectiveDue > 0) {
        const targetDueDate =
          sub.due_date ||
          (() => {
            const d = new Date()
            d.setMonth(d.getMonth() + 1)
            d.setDate(10)
            return d.toISOString().split("T")[0]
          })()
        const dueMonth = sub.due_date ? new Date(sub.due_date).toISOString().slice(0, 7) : nowIso.slice(0, 7)
        const expectedTotal = Math.max(totalFeeNum, batchTotalFee, amountNum + effectiveDue)

        const { data: existingDue } = await admin
          .from("fee_dues")
          .select("id, due_amount, paid_amount")
          .eq("student_id", sub.student_id)
          .eq("batch_id", sub.batch_id)
          .eq("due_month", dueMonth)
          .maybeSingle()

        if (existingDue) {
          const newPaid = (Number(existingDue.paid_amount) || 0) + amountNum
          const totalOwed = Math.max(Number(existingDue.due_amount), expectedTotal)
          const isFull = newPaid >= totalOwed
          await admin
            .from("fee_dues")
            .update({
              due_amount: totalOwed,
              paid_amount: newPaid,
              due_date: targetDueDate,
              status: isFull ? "paid" : newPaid > 0 ? "partial" : "pending",
            })
            .eq("id", existingDue.id)

          if (!sub.fee_due_id) {
            await admin.from("payment_submissions").update({ fee_due_id: existingDue.id }).eq("id", submissionId)
          }
        } else {
          const isFull = amountNum >= expectedTotal
          const { data: createdDue, error: dueErr } = await admin.from("fee_dues").insert({
            student_id: sub.student_id,
            batch_id: sub.batch_id,
            due_month: dueMonth,
            due_amount: expectedTotal,
            paid_amount: amountNum,
            due_date: targetDueDate,
            status: isFull ? "paid" : amountNum > 0 ? "partial" : "pending",
          }).select("id").maybeSingle()

          if (createdDue?.id && !sub.fee_due_id) {
            await admin.from("payment_submissions").update({ fee_due_id: createdDue.id }).eq("id", submissionId)
          }

          if (dueErr && !dueErr.message.includes("duplicate")) {
            console.warn("Fee due insert note:", dueErr.message)
          }
        }
      }

      // 6. Process referral commission if enrollment
      if (isEnrollment) {
        try {
          if (student?.referred_by_student_id || student?.referred_by_code) {
            let refId = student.referred_by_student_id
            if (!refId && student.referred_by_code) {
              const code = student.referred_by_code.trim()
              const { data: matched } = await admin
                .from("students")
                .select("id")
                .or(`referral_code.eq.${code},student_id.eq.${code},phone.eq.${code}`)
                .maybeSingle()
              if (matched) refId = matched.id
            }

            if (refId) {
              const { data: existingRef } = await admin
                .from("referrals")
                .select("id")
                .eq("referee_id", sub.student_id)
                .maybeSingle()

              if (!existingRef) {
                const commAmt = Math.round(totalFeeNum * 0.1)
                await admin.from("referrals").insert({
                  referrer_id: refId,
                  referee_id: sub.student_id,
                  commission_rate: 10,
                  commission_amount: commAmt,
                  status: "pending",
                  notes: "Auto-recorded on payment approval",
                })
              }
            }
          }
        } catch (refErr) {
          console.warn("Referral recording note:", refErr)
        }
      }
    } else if (sub.fee_due_id) {
      // 3c. Standalone Monthly Fee Due Payment (without batch_id)
      const { data: dueData } = await admin.from("fee_dues").select("*").eq("id", sub.fee_due_id).maybeSingle()
      if (dueData) {
        const newPaid = (Number(dueData.paid_amount) || 0) + amountNum
        const isFull = newPaid >= Number(dueData.due_amount)
        await admin
          .from("fee_dues")
          .update({
            paid_amount: newPaid,
            status: isFull ? "paid" : "partial",
          })
          .eq("id", sub.fee_due_id)
      }

      const receiptNo = `RCP-D-${Date.now().toString(36).toUpperCase()}`
      let duePayNotes = `Due payment. Sender: ${cleanSender || "—"}`
      if (sub.payment_method === "referral" || (sub.notes && sub.notes.toLowerCase().includes("referral"))) {
        duePayNotes = sub.notes || (cleanSender ? `Referral: ${cleanSender}` : "Referral due payment")
      } else if (sub.notes) {
        duePayNotes = sub.notes
      }

      await admin.from("payments").insert({
        student_id: sub.student_id,
        batch_id: sub.batch_id || null,
        amount: amountNum,
        total_paid: amountNum,
        discount: 0,
        late_fee: 0,
        payment_method: sub.payment_method || "cash",
        transaction_id: cleanTrx,
        payment_for: "monthly_fee",
        receipt_number: receiptNo,
        notes: duePayNotes,
      })
    }

    // 4. Update payment submission status to approved
    const updatePayload: Record<string, any> = {
      status: "approved",
      approved_by: staffId || null,
      approved_at: nowIso,
      reviewed_by: staffId || null,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }

    const { error: updateErr } = await admin
      .from("payment_submissions")
      .update(updatePayload)
      .eq("id", submissionId)

    if (updateErr) {
      // Fallback update with minimal columns if some columns don't exist
      await admin
        .from("payment_submissions")
        .update({ status: "approved" })
        .eq("id", submissionId)
    }

    return NextResponse.json({
      success: true,
      message: "Payment successfully approved and access granted!",
      approvedAt: nowIso,
    })
  } catch (error: any) {
    console.error("Payment approval fatal exception:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to approve payment." },
      { status: 500 }
    )
  }
}
