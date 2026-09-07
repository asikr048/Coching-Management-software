import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(
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
    const { type = "schedule", day, session_date, day_exam_name, day_total_marks } = body

    const admin = createAdminClient()

    // 1. Fetch exam
    const { data: exam, error: exErr } = await admin
      .from("exams")
      .select("*, batch:batches(name)")
      .eq("id", examId)
      .single()

    if (exErr || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    // Resolve batch names
    let batchNames = exam.batch?.name || ""
    if (!batchNames && Array.isArray(exam.batch_ids) && exam.batch_ids.length > 0) {
      const { data: bList } = await admin
        .from("batches")
        .select("name")
        .in("id", exam.batch_ids)
      if (bList && bList.length > 0) {
        batchNames = bList.map((b) => b.name).join(", ")
      }
    }
    if (!batchNames) batchNames = "সকল ব্যাচ (All Batches)"

    let noticeTitle = ""
    let noticeContent = ""

    if (type === "results") {
      // Fetch results
      const { data: results } = await admin
        .from("exam_results")
        .select("*, student:students(name, student_id)")
        .eq("exam_id", examId)
        .order("obtained_marks", { ascending: false })

      const count = results?.length || 0
      const highest = count > 0 ? results![0].obtained_marks : 0
      const passMarks = exam.pass_marks || 0
      const passedCount = results?.filter((r) => Number(r.obtained_marks) >= passMarks).length || 0

      const activeTitle = day_exam_name ? `${exam.title} (${day_exam_name})` : exam.title
      const activeTotalMarks = day_total_marks || exam.total_marks

      // Top 3
      const top3 = (results || []).slice(0, 3)
      let topText = ""
      if (top3.length > 0) {
        topText = "\n\n🏆 শীর্ষ মেধাতালিকা (Top Rankers):\n" +
          top3.map((r, idx) => {
            const medal = idx === 0 ? "🥇 ১ম:" : idx === 1 ? "🥈 ২য়:" : "🥉 ৩য়:"
            return `${medal} ${r.student?.name || "Student"} (ID: ${r.student?.student_id || "N/A"}) - ${r.obtained_marks}/${activeTotalMarks}`
          }).join("\n")
      }

      const sessionInfo = session_date ? ` [${session_date}]` : (day ? ` [${day}]` : "")

      noticeTitle = `🏆 পরীক্ষার ফলাফল ও মেরিট লিস্ট: ${activeTitle}${sessionInfo}`
      noticeContent = `মেধাশিরী কোচিংয়ের শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, "${activeTitle}" পরীক্ষার ফলাফল প্রকাশিত হয়েছে।

📋 পরীক্ষার তথ্য:
• বিষয়: ${exam.subject || "সাধারণ"}
• ব্যাচ: ${batchNames}
• মোট নম্বর: ${activeTotalMarks} | পাস নম্বর: ${exam.pass_marks}
• মোট পরীক্ষার্থী: ${count} জন | উত্তীর্ণ: ${passedCount} জন
• সর্বোচ্চ নম্বর: ${highest}${topText}

সকল শিক্ষার্থী তাদের স্টুডেন্ট প্রোফাইল অথবা ওয়েবসাইটের "অনলাইন রেজাল্ট" অপশন থেকে বিস্তারিত ফলাফল ও মেরিট দেখতে পারবে।`

      // Also mark is_public_result = true
      try {
        await admin.from("exams").update({ is_public_result: true }).eq("id", examId)
      } catch {}

    } else {
      // Schedule notice
      let dateText = exam.exam_date || "শীঘ্রই জানানো হবে"
      let scheduleBreakdown = ""
      if (exam.exam_schedule_type === "weekly" || (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0)) {
        if (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) {
          const lines = exam.recurring_days.map((item: any) => {
            if (typeof item === "object" && item !== null) {
              const subj = item.subject ? ` [${item.subject}]` : ""
              return `  • ${item.day_bn || item.day}: ${item.exam_name || "পরীক্ষা"}${subj} (মোট নম্বর: ${item.total_marks || 50}, পাস নম্বর: ${item.pass_marks || 20})`
            }
            return `  • প্রতি ${item}`
          })
          dateText = `প্রতি সপ্তাহে নির্ধারিত দিনসমূহে`
          scheduleBreakdown = `\n\n📅 সাপ্তাহিক পরীক্ষার সূচি ও মানবণ্টন:\n` + lines.join("\n")
        }
      }

      noticeTitle = `📋 পরীক্ষার রুটিন নোটিশ: ${exam.title}`
      noticeContent = `মেধাশিরী কোচিংয়ের সংশ্লিষ্ট শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, নিম্নোক্ত সূচি অনুযায়ী পরীক্ষা অনুষ্ঠিত হবে:

📌 পরীক্ষার নাম: ${exam.title}
📚 বিষয়: ${exam.subject || "সাধারণ"}
📅 পরীক্ষার সময়/তারিখ: ${dateText}${scheduleBreakdown}
🎯 টার্গেট ব্যাচ: ${batchNames}

সকল শিক্ষার্থীকে যথাসময়ে উপস্থিত হয়ে পরীক্ষায় অংশগ্রহণের জন্য বিশেষ নির্দেশ দেওয়া যাচ্ছে। কোনো প্রকার অনুপস্থিতি গ্রহণযোগ্য হবে না।`
    }

    // Insert notice
    const noticePayload: any = {
      title: noticeTitle,
      content: noticeContent,
      priority: "high",
      is_active: true,
      notice_date: new Date().toISOString().split("T")[0],
      branch_id: exam.branch_id || null,
      branch_ids: exam.branch_id ? [exam.branch_id] : [],
    }

    let { data: savedNotice, error: noticeErr } = await admin
      .from("notices")
      .insert([noticePayload])
      .select("*")
      .maybeSingle()

    if (noticeErr) {
      // Fallback if branch_id / branch_ids don't exist
      delete noticePayload.branch_ids
      delete noticePayload.branch_id
      delete noticePayload.notice_date
      const { data: fbNotice, error: fbErr } = await admin
        .from("notices")
        .insert([noticePayload])
        .select("*")
        .maybeSingle()
      if (fbErr) throw fbErr
      savedNotice = fbNotice
    }

    if (savedNotice && type === "schedule") {
      try {
        await admin.from("exams").update({ schedule_notice_id: savedNotice.id }).eq("id", examId)
      } catch {}
    }

    return NextResponse.json({
      success: true,
      notice: savedNotice,
      message: type === "results" 
        ? "পরীক্ষার ফলাফল ও মেরিট লিস্ট সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে!" 
        : "পরীক্ষার রুটিন সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে!",
    })
  } catch (err: any) {
    console.error("Publish exam notice error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
