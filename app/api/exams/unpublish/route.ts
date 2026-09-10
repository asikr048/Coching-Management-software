import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      exam_id,
      action = "unpublish", // "unpublish" | "delete_day" | "delete_exam"
      day_key,
      delete_notices = true,
    } = body

    if (!exam_id) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch current exam
    const { data: exam, error: exErr } = await admin
      .from("exams")
      .select("*")
      .eq("id", exam_id)
      .maybeSingle()

    if (exErr || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    if (action === "delete_exam") {
      // 1. Delete submissions, questions, results, answers
      const { data: submissions } = await admin
        .from("exam_submissions")
        .select("id")
        .eq("exam_id", exam_id)

      if (submissions && submissions.length > 0) {
        const subIds = submissions.map((s) => s.id)
        await admin.from("exam_answers").delete().in("submission_id", subIds)
      }
      await admin.from("exam_submissions").delete().eq("exam_id", exam_id)
      await admin.from("exam_questions").delete().eq("exam_id", exam_id)
      await admin.from("exam_results").delete().eq("exam_id", exam_id)

      // Delete associated notices
      if (delete_notices) {
        await admin
          .from("notices")
          .delete()
          .or(`title.ilike.%${exam.title}%,content.ilike.%${exam.title}%`)
      }

      // Delete the exam
      const { error: delErr } = await admin.from("exams").delete().eq("id", exam_id)
      if (delErr) throw delErr

      return NextResponse.json({
        success: true,
        message: `পরীক্ষা "${exam.title}" এবং এর সকল ফলাফল সফলভাবে মুছে ফেলা হয়েছে!`,
      })
    }

    if (action === "delete_day" && day_key) {
      // Remove specific day from published_days
      let pubDays: string[] = []
      if (Array.isArray(exam.published_days)) {
        pubDays = exam.published_days.map((d: any) => String(d).toLowerCase())
      }
      const targetLower = String(day_key).toLowerCase()
      const newPubDays = pubDays.filter((d) => d !== targetLower)

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
      if (newPubDays.length > 0) {
        updatedNote = `${updatedNote} [PUBLISHED_DAYS:${newPubDays.join(",")}]`.trim()
      }

      const updatePayload: any = {
        published_days: newPubDays,
        result_note: updatedNote,
      }

      if (newPubDays.length === 0 && !exam.is_weekly_published) {
        updatePayload.is_public_result = false
        updatePayload.is_published = false
        updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
        updatedNote = `${updatedNote} [PUBLIC_RESULT:false]`.trim()
        updatePayload.result_note = updatedNote
      }

      const { data: updated, error: uErr } = await admin
        .from("exams")
        .update(updatePayload)
        .eq("id", exam_id)
        .select()
        .single()

      if (uErr) throw uErr

      return NextResponse.json({
        success: true,
        exam: updated,
        message: `${day_key} দিনের ফলাফল নোটিফিকেশন সফলভাবে মুছে ফেলা হয়েছে!`,
      })
    }

    // Default action: UNPUBLISH from homepage and online result portal
    let cleanNote = exam.result_note || ""
    cleanNote = cleanNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
    cleanNote = cleanNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
    cleanNote = cleanNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
    cleanNote = `${cleanNote} [PUBLIC_RESULT:false] [IS_WEEKLY_PUBLISHED:false]`.trim()

    const unpublishPayload: any = {
      is_public_result: false,
      is_published: false,
      is_weekly_published: false,
      published_days: [],
      result_note: cleanNote,
    }

    const { data: updated, error: unpubErr } = await admin
      .from("exams")
      .update(unpublishPayload)
      .eq("id", exam_id)
      .select()
      .single()

    if (unpubErr) throw unpubErr

    // Optionally delete published notices from notice board
    if (delete_notices) {
      try {
        await admin
          .from("notices")
          .delete()
          .or(`title.ilike.%${exam.title}%,content.ilike.%${exam.title}%`)
      } catch (nErr) {
        console.warn("Notice delete error on unpublish:", nErr)
      }
    }

    return NextResponse.json({
      success: true,
      exam: updated,
      message: `পরীক্ষার নোটিফিকেশন ও রেজাল্ট সফলভাবে হোমপেজ ও অনলাইন পোর্টাল থেকে মুছে ফেলা/আনপাবলিশ করা হয়েছে!`,
    })
  } catch (err: any) {
    console.error("Exam unpublish error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
