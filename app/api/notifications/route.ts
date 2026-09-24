import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffRole, isAuthError } from "@/lib/api-auth"

export interface NotificationFeedItem {
  id: string
  title: string
  message: string
  category: "admin" | "student"
  type: "notice" | "payment" | "deletion" | "exam"
  created_at: string
  href: string
  priority?: "urgent" | "high" | "normal" | "low"
  badge?: string
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireStaffRole([
      "owner",
      "super_manager",
      "manager",
      "branch_director",
      "receptionist",
      "teacher",
      "accountant",
      "course_teacher",
    ])
    if (isAuthError(authResult)) return authResult

    const admin = createAdminClient()

    // 1. Fetch persistent notice audience settings
    let noticeAudiencesMap: Record<string, string> = {}
    try {
      const { data: settingRow } = await admin
        .from("site_settings")
        .select("value")
        .eq("key", "notice_audiences")
        .maybeSingle()
      if (settingRow?.value) {
        noticeAudiencesMap = JSON.parse(settingRow.value)
      }
    } catch {}

    // 2. Fetch recent active notices (limit 25)
    let noticesList: any[] = []
    try {
      const { data: nData } = await admin
        .from("notices")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(25)
      if (nData) noticesList = nData
    } catch {}

    // 3. Fetch pending payment submissions (Admin Notification)
    let pendingPayments: any[] = []
    try {
      const { data: pData } = await admin
        .from("payment_submissions")
        .select("id, amount, payment_method, student_id, created_at, student:students(name, student_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10)
      if (pData) pendingPayments = pData
    } catch {}

    // 4. Fetch pending student deletion requests (Admin Notification)
    let pendingDeletions: any[] = []
    try {
      const { data: dData } = await admin
        .from("student_deletion_requests")
        .select("id, student_id, reason, created_at, student:students(name, student_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5)
      if (dData) pendingDeletions = dData
    } catch {}

    // 5. Fetch recent exams created in the last 14 days (Student Notification)
    let recentExams: any[] = []
    try {
      const { data: exData } = await admin
        .from("exams")
        .select("id, title, subject, exam_date, result_note, created_at")
        .order("created_at", { ascending: false })
        .limit(8)
      if (exData) recentExams = exData
    } catch {}

    const adminItems: NotificationFeedItem[] = []
    const studentItems: NotificationFeedItem[] = []

    // Process notices based on target_audience
    noticesList.forEach((n) => {
      const audience = n.target_audience || noticeAudiencesMap[n.id] || "all"
      const item: NotificationFeedItem = {
        id: `notice-${n.id}`,
        title: n.title,
        message: n.content ? (n.content.length > 120 ? `${n.content.slice(0, 120)}...` : n.content) : "নতুন নোটিশ প্রকাশিত হয়েছে",
        category: audience === "admin" ? "admin" : audience === "student" ? "student" : "student",
        type: "notice",
        created_at: n.created_at || new Date().toISOString(),
        href: "/dashboard/owner/notices",
        priority: n.priority || "normal",
        badge: audience === "admin" ? "অ্যাডমিন নোটিশ" : audience === "student" ? "শিক্ষার্থী নোটিশ" : "সাধারণ নোটিশ",
      }

      if (audience === "admin") {
        adminItems.push(item)
      } else if (audience === "student") {
        studentItems.push(item)
      } else {
        // "all" - show in both feeds
        adminItems.push({ ...item, category: "admin" })
        studentItems.push({ ...item, category: "student" })
      }
    })

    // Process pending payments (Admin feed)
    pendingPayments.forEach((p) => {
      const studentName = p.student?.name || "শিক্ষার্থী"
      const studentId = p.student?.student_id ? ` (${p.student.student_id})` : ""
      adminItems.push({
        id: `payment-${p.id}`,
        title: `নতুন পেমেন্ট যাচাই প্রয়োজন: ৳${Number(p.amount || 0).toLocaleString("en-IN")}`,
        message: `${studentName}${studentId} — ${p.payment_method?.toUpperCase() || "Online"} পেমেন্ট ভেরিফিকেশনের জন্য অপেক্ষমান`,
        category: "admin",
        type: "payment",
        created_at: p.created_at || new Date().toISOString(),
        href: "/dashboard/owner/payment-approvals",
        priority: "high",
        badge: "পেমেন্ট অনুমোদন",
      })
    })

    // Process student deletion requests (Admin feed)
    pendingDeletions.forEach((d) => {
      const studentName = d.student?.name || "শিক্ষার্থী"
      adminItems.push({
        id: `deletion-${d.id}`,
        title: "অ্যাকাউন্ট ডিলিট রিকোয়েস্ট",
        message: `${studentName} অ্যাকাউন্ট মুছে ফেলার আবেদন করেছে। কারণ: ${d.reason || "নির্দিষ্ট নয়"}`,
        category: "admin",
        type: "deletion",
        created_at: d.created_at || new Date().toISOString(),
        href: "/dashboard/owner/students",
        priority: "urgent",
        badge: "ডিলিট রিকোয়েস্ট",
      })
    })

    // Process recent exams (Student feed)
    recentExams.forEach((e) => {
      const isWeekly = e.result_note?.includes("[WEEKLY_SCHEDULE:") || e.title?.includes("সাপ্তাহিক")
      const dateInfo = e.exam_date || (isWeekly ? "সাপ্তাহিক রুটিন" : "নির্ধারিত তারিখ")
      studentItems.push({
        id: `exam-${e.id}`,
        title: `পরীক্ষার সময়সূচি: ${e.title}`,
        message: `বিষয়: ${e.subject || "সাধারণ"} | সময়/তারিখ: ${dateInfo}`,
        category: "student",
        type: "exam",
        created_at: e.created_at || new Date().toISOString(),
        href: "/dashboard/owner/exams",
        priority: "normal",
        badge: "পরীক্ষা সূচি",
      })
    })

    // Sort both feeds chronologically (newest first)
    adminItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    studentItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Combine all
    const allMap = new Map<string, NotificationFeedItem>()
    adminItems.forEach((i) => allMap.set(i.id, i))
    studentItems.forEach((i) => allMap.set(i.id, i))
    const allItems = Array.from(allMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({
      success: true,
      allNotifications: allItems,
      adminNotifications: adminItems,
      studentNotifications: studentItems,
      unreadCount: allItems.length,
    })
  } catch (err: any) {
    console.error("Notifications feed error:", err)
    return NextResponse.json(
      { error: err.message || "Failed to load notifications" },
      { status: 500 }
    )
  }
}
