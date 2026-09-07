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

    return NextResponse.json({ success: true, exam })
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
    if (typeof body.is_weekly_published === "boolean") {
      payload.is_weekly_published = body.is_weekly_published
      updatedNote = updatedNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [IS_WEEKLY_PUBLISHED:${body.is_weekly_published}]`.trim()
    }

    // If is_public_result is enabled, ensure is_published is true
    if (body.is_public_result === true) {
      payload.is_published = true
      payload.is_public_result = true
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLIC_RESULT:true]`.trim()
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
      if ("is_paused" in payload) delete payload.is_paused
      if ("is_public_result" in payload) delete payload.is_public_result
      if ("exam_schedule_type" in payload) delete payload.exam_schedule_type
      if ("recurring_days" in payload) delete payload.recurring_days
      if ("schedule_notice_id" in payload) delete payload.schedule_notice_id
      if ("published_days" in payload) delete payload.published_days
      if ("is_weekly_published" in payload) delete payload.is_weekly_published

      const { data: fbExam, error: fbErr } = await admin
        .from("exams")
        .update(payload)
        .eq("id", examId)
        .select("*")
        .maybeSingle()

      if (fbErr) throw fbErr
      updatedExam = fbExam
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
