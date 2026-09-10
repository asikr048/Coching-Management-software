import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

function getCanonicalDayId(raw: string): string {
  const low = String(raw).toLowerCase().trim()
  const matched = ALL_WEEK_DAYS.find((d) => d.id === low || d.bn === raw || d.en.toLowerCase() === low)
  return matched ? matched.id : low
}

function parseExistingPubDays(exam: any): string[] {
  let pubDays: string[] = []
  const raw = exam.published_days
  if (Array.isArray(raw)) {
    pubDays = raw.map((d: any) => getCanonicalDayId(d))
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) pubDays = parsed.map((d: any) => getCanonicalDayId(d))
      else pubDays = raw.split(",").map((s: string) => getCanonicalDayId(s)).filter(Boolean)
    } catch {
      pubDays = raw.split(",").map((s: string) => getCanonicalDayId(s)).filter(Boolean)
    }
  }

  const note = exam.result_note || ""
  if (note.includes("[PUBLISHED_DAYS:")) {
    try {
      const match = note.match(/\[PUBLISHED_DAYS:([^\]]*)\]/)
      if (match && match[1]) {
        const fromNote = match[1].split(",").map((s: string) => getCanonicalDayId(s)).filter(Boolean)
        pubDays = Array.from(new Set([...pubDays, ...fromNote]))
      }
    } catch {}
  }
  return pubDays
}

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
      action = "unpublish", // "unpublish" | "delete_day" | "publish_day" | "toggle_weekly_total" | "delete_exam"
      day_key,
      is_weekly_published,
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
      const canonicalTarget = getCanonicalDayId(day_key)
      const currentPubDays = parseExistingPubDays(exam)
      const newPubDays = currentPubDays.filter((d) => d !== canonicalTarget)

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
      if (newPubDays.length > 0) {
        updatedNote = `${updatedNote} [PUBLISHED_DAYS:${newPubDays.join(",")}]`.trim()
      } else {
        updatedNote = `${updatedNote} [PUBLISHED_DAYS:]`.trim()
      }

      const isWeeklyPub = exam.is_weekly_published === true || updatedNote.includes("[IS_WEEKLY_PUBLISHED:true]")
      const hasLiveCards = newPubDays.length > 0 || isWeeklyPub

      const updatePayload: any = {
        published_days: newPubDays,
        result_note: updatedNote,
      }

      if (!hasLiveCards) {
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

      const dayObj = ALL_WEEK_DAYS.find((d) => d.id === canonicalTarget)
      const label = dayObj ? dayObj.bn : day_key

      return NextResponse.json({
        success: true,
        exam: updated,
        message: `${label} দিনের ফলাফল নোটিফিকেশন সফলভাবে মুছে ফেলা হয়েছে!`,
      })
    }

    if (action === "publish_day" && day_key) {
      const canonicalTarget = getCanonicalDayId(day_key)
      const currentPubDays = parseExistingPubDays(exam)
      const newPubDays = Array.from(new Set([...currentPubDays, canonicalTarget]))

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLISHED_DAYS:${newPubDays.join(",")}] [PUBLIC_RESULT:true]`.trim()

      const updatePayload: any = {
        published_days: newPubDays,
        is_public_result: true,
        is_published: true,
        result_note: updatedNote,
      }

      const { data: updated, error: uErr } = await admin
        .from("exams")
        .update(updatePayload)
        .eq("id", exam_id)
        .select()
        .single()

      if (uErr) throw uErr

      const dayObj = ALL_WEEK_DAYS.find((d) => d.id === canonicalTarget)
      const label = dayObj ? dayObj.bn : day_key

      return NextResponse.json({
        success: true,
        exam: updated,
        message: `${label} দিনের ফলাফল নোটিফিকেশন সফলভাবে প্রকাশ করা হয়েছে!`,
      })
    }

    if (action === "toggle_weekly_total") {
      const targetWeeklyPub = Boolean(is_weekly_published)
      const currentPubDays = parseExistingPubDays(exam)

      let updatedNote = exam.result_note || ""
      updatedNote = updatedNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [IS_WEEKLY_PUBLISHED:${targetWeeklyPub}]`.trim()

      const hasLive = targetWeeklyPub || currentPubDays.length > 0
      updatedNote = updatedNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
      updatedNote = `${updatedNote} [PUBLIC_RESULT:${hasLive}]`.trim()

      const updatePayload: any = {
        is_weekly_published: targetWeeklyPub,
        is_public_result: hasLive,
        is_published: hasLive,
        result_note: updatedNote,
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
        message: targetWeeklyPub
          ? "সাপ্তাহিক সামগ্রিক ফলাফল কার্ড সফলভাবে প্রকাশ করা হয়েছে!"
          : "সাপ্তাহিক সামগ্রিক ফলাফল কার্ড সফলভাবে মুছে ফেলা / হাইড করা হয়েছে!",
      })
    }

    // Default action: UNPUBLISH from homepage and online result portal
    let cleanNote = exam.result_note || ""
    cleanNote = cleanNote.replace(/\[PUBLIC_RESULT:(true|false)\]/g, "").trim()
    cleanNote = cleanNote.replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "").trim()
    cleanNote = cleanNote.replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "").trim()
    cleanNote = `${cleanNote} [PUBLIC_RESULT:false] [IS_WEEKLY_PUBLISHED:false] [PUBLISHED_DAYS:]`.trim()

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
