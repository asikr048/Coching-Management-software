import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params
    const examId = resolvedParams.id
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const supabase = await createClient()

    // 1. Fetch exam details with batch and branch
    let exam: any = null
    const { data: exData } = await admin
      .from("exams")
      .select("*, batch:batches(*), branch:branches(*)")
      .eq("id", examId)
      .maybeSingle()

    if (exData) {
      exam = exData
    } else {
      const { data: fbEx } = await supabase
        .from("exams")
        .select("*, batch:batches(*), branch:branches(*)")
        .eq("id", examId)
        .maybeSingle()
      exam = fbEx
    }

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const requestedBatch = searchParams.get("batch_id")

    // 2. Fetch all batches (using select("*") - completely safe against missing columns)
    let allBatches: any[] = []
    const { data: bList } = await admin.from("batches").select("*").order("name", { ascending: true })
    if (bList && bList.length > 0) {
      allBatches = bList
    } else {
      const { data: sessionB } = await supabase.from("batches").select("*").order("name", { ascending: true })
      if (sessionB) allBatches = sessionB
    }

    // 3. Fetch all raw students (using select("*") - completely safe against missing columns)
    let rawStudents: any[] = []
    const { data: stList } = await admin.from("students").select("*").order("created_at", { ascending: false })
    if (stList && stList.length > 0) {
      rawStudents = stList
    } else {
      const { data: sessionSt } = await supabase.from("students").select("*").order("created_at", { ascending: false })
      if (sessionSt) rawStudents = sessionSt
    }

    // 4. Fetch all raw enrollments (using select("*") - completely safe against missing columns)
    let rawEnrollments: any[] = []
    const { data: enrList } = await admin.from("enrollments").select("*")
    if (enrList && enrList.length > 0) {
      rawEnrollments = enrList
    } else {
      const { data: sessionEnr } = await supabase.from("enrollments").select("*")
      if (sessionEnr) rawEnrollments = sessionEnr
    }

    // 5. Fetch existing exam results for this exam
    let existingResults: any[] = []
    const { data: resList } = await admin.from("exam_results").select("*").eq("exam_id", examId)
    if (resList) existingResults = resList

    // 6. Map enrollments by student
    const enrollmentsByStudent = new Map<string, any[]>()
    rawEnrollments.forEach((e) => {
      if (!e.student_id) return
      const list = enrollmentsByStudent.get(e.student_id) || []
      list.push(e)
      enrollmentsByStudent.set(e.student_id, list)
    })

    const existingGradedIds = new Set(existingResults.map((r) => r.student_id).filter(Boolean))

    // 7. Determine which students should be returned based on requestedBatch
    let selectedStudents: any[] = []

    if (requestedBatch === "all") {
      // User explicitly asked for ALL students!
      selectedStudents = rawStudents
    } else if (requestedBatch && requestedBatch !== "auto") {
      // User selected a specific batch UUID
      selectedStudents = rawStudents.filter((s) => {
        if (existingGradedIds.has(s.id)) return true
        const sEnrs = enrollmentsByStudent.get(s.id) || []
        return sEnrs.some((e) => e.batch_id === requestedBatch)
      })
      // If none found by enrollment, check if batch has a class_level or name matching student class_level
      if (selectedStudents.length === 0) {
        const targetB = allBatches.find((b) => b.id === requestedBatch)
        if (targetB) {
          const bName = (targetB.name || "").toLowerCase()
          const bClass = (targetB.class_level || "").toLowerCase()
          selectedStudents = rawStudents.filter((s) => {
            const sc = (s.class_level || "").toLowerCase()
            return (bName && sc.includes(bName)) || (bClass && sc.includes(bClass))
          })
        }
      }
    } else {
      // Default / Auto: load students for the exam's batch(es)
      const targetBatchIds = new Set<string>()
      if (exam.batch_id) targetBatchIds.add(exam.batch_id)
      if (Array.isArray(exam.batch_ids)) {
        exam.batch_ids.forEach((b: any) => {
          if (b && typeof b === "string") targetBatchIds.add(b)
        })
      }

      // Also add any batch with identical name (e.g. another batch named "Class 9")
      const examBatchName = (exam.batch?.name || "").trim().toLowerCase()
      if (examBatchName) {
        allBatches.forEach((b) => {
          if ((b.name || "").trim().toLowerCase() === examBatchName) {
            targetBatchIds.add(b.id)
          }
        })
      }

      // Strategy A: Match by enrollment in target batch(es)
      selectedStudents = rawStudents.filter((s) => {
        if (existingGradedIds.has(s.id)) return true
        const sEnrs = enrollmentsByStudent.get(s.id) || []
        return sEnrs.some((e) => targetBatchIds.has(e.batch_id))
      })

      // Strategy B: If no enrolled students found in batch, match by class_level
      // (e.g. exam is for "Class 9" or batch is "Class 9", and student has class_level "Class 9" or "9")
      if (selectedStudents.length === 0) {
        const batchName = (exam.batch?.name || exam.title || "").toLowerCase()
        const isClass9 = batchName.includes("9") || batchName.includes("nine") || batchName.includes("class 9")
        if (isClass9) {
          const class9Students = rawStudents.filter((s) => {
            const cl = String(s.class_level || "").toLowerCase()
            return cl.includes("9") || cl.includes("nine") || cl.includes("ix")
          })
          if (class9Students.length > 0) {
            selectedStudents = class9Students
          }
        }
      }

      // Strategy C: Check branch students if exam has a branch_id
      if (selectedStudents.length === 0 && exam.branch_id) {
        const branchStudents = rawStudents.filter((s) => !s.branch_id || s.branch_id === exam.branch_id)
        if (branchStudents.length > 0) {
          selectedStudents = branchStudents
        }
      }

      // Strategy D: Fallback to ALL students if still 0!
      if (selectedStudents.length === 0) {
        selectedStudents = rawStudents
      }
    }

    // 8. Map students with clean, normalized fields and sequential roll numbers
    const resolvedStudents = selectedStudents.map((s, idx) => {
      const sEnrs = enrollmentsByStudent.get(s.id) || []
      const matchingEnr = sEnrs.find((e) => exam.batch_id && e.batch_id === exam.batch_id) || sEnrs[0]
      const rawRoll =
        matchingEnr?.roll_no != null && Number(matchingEnr.roll_no) > 0
          ? Number(matchingEnr.roll_no)
          : matchingEnr?.batch_roll != null && Number(matchingEnr.batch_roll) > 0
          ? Number(matchingEnr.batch_roll)
          : s.roll_no != null && Number(s.roll_no) > 0
          ? Number(s.roll_no)
          : s.batch_roll != null && Number(s.batch_roll) > 0
          ? Number(s.batch_roll)
          : idx + 1

      return {
        id: s.id,
        student_id: s.student_id || `ID-${s.id.slice(0, 5)}`,
        name: s.name || "Student",
        roll_no: Number(rawRoll),
        batch_roll: Number(rawRoll),
        phone: s.phone || "",
        guardian_phone: s.guardian_phone || "",
        branch_id: s.branch_id || exam.branch_id || null,
        class_level: s.class_level || "",
        is_active: s.is_active !== false,
      }
    })

    // Sort ascending by roll_no
    resolvedStudents.sort((a, b) => (a.roll_no || 9999) - (b.roll_no || 9999))

    return NextResponse.json({
      success: true,
      exam,
      students: resolvedStudents,
      batches: allBatches,
      existing_results: existingResults,
      total_students_count: rawStudents.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params
    const examId = resolvedParams.id
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const admin = createAdminClient()

    // 1. Fetch current exam to handle fallback notes
    const { data: currentExam } = await admin.from("exams").select("*").eq("id", examId).single()
    if (!currentExam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    let payload: Record<string, any> = { ...body }
    delete payload.id

    // Ensure metadata tags in result_note for guaranteed persistence
    let updatedNote = currentExam.result_note || ""
    if (typeof body.is_paused === "boolean") {
      updatedNote = updatedNote.replace(/\[IS_PAUSED:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [IS_PAUSED:${body.is_paused}]`.trim()
    }
    if (typeof body.is_public_result === "boolean") {
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLIC_RESULT:${body.is_public_result}]`.trim()
    }
    if (typeof body.show_all_results === "boolean") {
      updatedNote = updatedNote.replace(/\[SHOW_ALL_RESULTS:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [SHOW_ALL_RESULTS:${body.show_all_results}]`.trim()
    }
    if (Array.isArray(body.published_days)) {
      const pubList = body.published_days.map((d: any) => String(d).toLowerCase())
      payload.published_days = pubList
      updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLISHED_DAYS:${pubList.join(",")}]`.trim()
    }
    const isWeekly =
      currentExam.exam_schedule_type === "weekly" ||
      (Array.isArray(currentExam.recurring_days) && currentExam.recurring_days.length > 0) ||
      Boolean(currentExam.title?.includes("সাপ্তাহিক")) ||
      Boolean(currentExam.subject?.includes("সাপ্তাহিক")) ||
      Boolean(currentExam.result_note?.includes("[WEEKLY_SCHEDULE:")) ||
      (Number(currentExam.total_marks) === 350 && !currentExam.exam_date)

    if (typeof body.is_weekly_published === "boolean") {
      payload.is_weekly_published = body.is_weekly_published
      updatedNote = updatedNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [IS_WEEKLY_PUBLISHED:${body.is_weekly_published}]`.trim()
      if (body.is_weekly_published === true) {
        payload.is_published = true
        payload.is_public_result = true
        updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
        updatedNote = `${updatedNote} [PUBLIC_RESULT:true]`.trim()
      }
    }

    // If is_public_result is enabled, ensure is_published is true and weekly exams are published
    if (body.is_public_result === true) {
      payload.is_published = true
      payload.is_public_result = true
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLIC_RESULT:true]`.trim()
      if (isWeekly && body.is_weekly_published !== false) {
        payload.is_weekly_published = true
        updatedNote = updatedNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
        updatedNote = `${updatedNote} [IS_WEEKLY_PUBLISHED:true]`.trim()
      }
    }

    // If exam is published, also ensure weekly publication for weekly exams
    if (body.is_published === true && isWeekly && body.is_weekly_published !== false) {
      payload.is_weekly_published = true
      updatedNote = updatedNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [IS_WEEKLY_PUBLISHED:true]`.trim()
    }

    // If weekly or day results are published, automatically publish public results unless explicitly set to false
    if (
      body.is_weekly_published === true ||
      (Array.isArray(body.published_days) && body.published_days.length > 0) ||
      body.is_published === true
    ) {
      if (body.is_public_result !== false) {
        payload.is_public_result = true
        payload.is_published = true
        updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
        updatedNote = `${updatedNote} [PUBLIC_RESULT:true]`.trim()
      }
    }
    payload.result_note = updatedNote

    // Attempt update with column fallback
    let { data: updatedExam, error } = await admin
      .from("exams")
      .update(payload)
      .eq("id", examId)
      .select("*")
      .maybeSingle()

    if (error) {
      console.warn("Exam update first attempt failed:", error.message)
      // Prune newer columns if Postgres rejected them
      if ("show_all_results" in payload) delete payload.show_all_results
      if ("show_results_immediately" in payload) delete payload.show_results_immediately
      if ("is_paused" in payload) delete payload.is_paused
      if ("is_public_result" in payload) delete payload.is_public_result
      if ("exam_schedule_type" in payload) delete payload.exam_schedule_type
      if ("recurring_days" in payload) delete payload.recurring_days
      if ("schedule_notice_id" in payload) delete payload.schedule_notice_id
      if ("published_days" in payload) delete payload.published_days
      if ("is_weekly_published" in payload) delete payload.is_weekly_published
      if ("duration_minutes" in payload) delete payload.duration_minutes
      if ("batch_ids" in payload) delete payload.batch_ids
      if ("branch_id" in payload) delete payload.branch_id

      let { data: fbExam, error: fbErr } = await admin
        .from("exams")
        .update(payload)
        .eq("id", examId)
        .select("*")
        .maybeSingle()

      if (fbErr) {
        console.warn("Exam update second attempt failed:", fbErr.message)
        const coreBaseColumns = [
          "title",
          "subject",
          "exam_type",
          "total_marks",
          "pass_marks",
          "exam_date",
          "batch_id",
          "is_published",
          "is_online",
          "result_note"
        ]
        const corePayload: Record<string, any> = {}
        for (const k of coreBaseColumns) {
          if (k in payload) {
            corePayload[k] = payload[k]
          }
        }
        const { data: coreExam, error: coreErr } = await admin
          .from("exams")
          .update(corePayload)
          .eq("id", examId)
          .select("*")
          .maybeSingle()

        if (coreErr) throw coreErr
        fbExam = coreExam
      }

      updatedExam = { ...fbExam, ...body }
    }

    return NextResponse.json({ success: true, exam: updatedExam })
  } catch (err: any) {
    console.error("Exam PATCH error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params
    const examId = resolvedParams.id
    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    // Auth verification
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()

    // 1. Delete student answers for any submissions of this exam
    const { data: submissions } = await admin
      .from("exam_submissions")
      .select("id")
      .eq("exam_id", examId)

    if (submissions && submissions.length > 0) {
      const subIds = submissions.map((s) => s.id)
      await admin.from("exam_answers").delete().in("submission_id", subIds)
    }

    // 2. Delete exam submissions
    await admin.from("exam_submissions").delete().eq("exam_id", examId)

    // 3. Delete exam questions
    await admin.from("exam_questions").delete().eq("exam_id", examId)

    // 4. Delete exam results
    await admin.from("exam_results").delete().eq("exam_id", examId)

    // 5. Delete the exam record itself
    const { error: examErr } = await admin
      .from("exams")
      .delete()
      .eq("id", examId)

    if (examErr) {
      console.error("Failed to delete exam:", examErr)
      return NextResponse.json({ error: examErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Exam deleted successfully" })
  } catch (err: any) {
    console.error("Delete exam error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
