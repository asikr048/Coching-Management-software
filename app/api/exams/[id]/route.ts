import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

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