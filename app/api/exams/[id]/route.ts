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
    const { data: exam, error } = await admin
      .from("exams")
      .select("*, batch:batches(name, branch_id), branch:branches(name)")
      .eq("id", examId)
      .single()

    if (error || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const requestedBatch = searchParams.get("batch_id")

    // 1. Resolve target batch IDs
    let targetBatchIds: string[] = []
    if (requestedBatch && requestedBatch !== "all" && requestedBatch !== "auto") {
      targetBatchIds = [requestedBatch]
    } else if (requestedBatch === "all") {
      targetBatchIds = [] // load all students without batch filtering
    } else {
      if (Array.isArray(exam.batch_ids) && exam.batch_ids.length > 0) {
        for (const b of exam.batch_ids) {
          if (b && typeof b === "string" && !targetBatchIds.includes(b)) {
            targetBatchIds.push(b)
          }
        }
      }
      if (exam.batch_id && typeof exam.batch_id === "string" && !targetBatchIds.includes(exam.batch_id)) {
        targetBatchIds.push(exam.batch_id)
      }
    }

    // 2. Fetch existing results for this exam
    const { data: existingResults } = await admin
      .from("exam_results")
      .select("id, exam_id, student_id, obtained_marks, grade, day_marks, created_at")
      .eq("exam_id", examId)

    const existingResultStudentIds = (existingResults || []).map((r: any) => r.student_id).filter(Boolean)

    // 3. Resolve enrollments and enrolled students
    let enrollments: any[] = []
    if (targetBatchIds.length > 0) {
      const { data: enrData } = await admin
        .from("enrollments")
        .select("id, student_id, batch_id, status, roll_no, batch_roll, enrollment_date, created_at")
        .in("batch_id", targetBatchIds)

      if (enrData && enrData.length > 0) {
        enrollments = enrData
      }
    }

    const activeEnrs = enrollments.filter(
      (e: any) => !e.status || e.status === "active" || e.status === "approved" || e.status === "enrolled"
    )
    const targetEnrs = activeEnrs.length > 0 ? activeEnrs : enrollments
    const enrolledStudentIds = Array.from(new Set(targetEnrs.map((e: any) => e.student_id).filter(Boolean)))

    // Combine student IDs from enrollments and any already graded in exam_results
    const allTargetStudentIds = Array.from(new Set([...enrolledStudentIds, ...existingResultStudentIds]))

    let resolvedStudents: any[] = []
    const enrMap = new Map<string, any>()
    targetEnrs.forEach((e: any) => enrMap.set(e.student_id, e))

    if (allTargetStudentIds.length > 0) {
      const { data: stData } = await admin
        .from("students")
        .select("id, name, student_id, roll_no, batch_roll, phone, guardian_phone, branch_id, is_active")
        .in("id", allTargetStudentIds)

      const sMap = new Map<string, any>()
      ;(stData || []).forEach((s: any) => sMap.set(s.id, s))

      resolvedStudents = allTargetStudentIds
        .map((sid, idx) => {
          const s = sMap.get(sid)
          if (!s) return null
          const e = enrMap.get(sid)
          const rawRoll =
            e?.roll_no != null && Number(e.roll_no) > 0
              ? Number(e.roll_no)
              : e?.batch_roll != null && Number(e.batch_roll) > 0
              ? Number(e.batch_roll)
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
            is_active: s.is_active !== false,
          }
        })
        .filter(Boolean)
    }

    // 4. Fallback if no students enrolled in target batch: load students from branch or globally
    if (resolvedStudents.length === 0) {
      let sQuery = admin
        .from("students")
        .select("id, name, student_id, roll_no, batch_roll, phone, guardian_phone, branch_id, is_active")
      if (exam.branch_id) {
        sQuery = sQuery.eq("branch_id", exam.branch_id)
      }
      let { data: branchStudents } = await sQuery
      let studentsList = branchStudents || []
      if (studentsList.length === 0) {
        const { data: globalStudents } = await admin
          .from("students")
          .select("id, name, student_id, roll_no, batch_roll, phone, guardian_phone, branch_id, is_active")
        studentsList = globalStudents || []
      }

      resolvedStudents = studentsList.map((s: any, idx: number) => {
        const rawRoll =
          s.roll_no != null && Number(s.roll_no) > 0
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
          branch_id: s.branch_id,
          is_active: s.is_active !== false,
        }
      })
    }

    // Sort ascending by roll_no
    resolvedStudents.sort((a: any, b: any) => (a.roll_no || 9999) - (b.roll_no || 9999))

    // 5. Fetch available batches for easy switching in the exam UI
    let batchQuery = admin.from("batches").select("id, name, branch_id").order("name", { ascending: true })
    if (exam.branch_id) {
      batchQuery = batchQuery.eq("branch_id", exam.branch_id)
    }
    const { data: batches } = await batchQuery

    return NextResponse.json({
      success: true,
      exam,
      students: resolvedStudents,
      batches: batches || [],
      existing_results: existingResults || [],
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
