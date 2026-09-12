"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { formatDate, getGrade, cn } from "@/lib/utils"
import {
  Trophy,
  Award,
  Search,
  Calendar,
  Clock,
  Landmark,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Printer,
  Sparkles,
  Users,
  Eye,
  CalendarDays,
  User,
  GraduationCap,
  LayoutDashboard,
} from "lucide-react"

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

interface ParsedWeeklyDay {
  key: string
  day_bn: string
  day_en: string
  exam_name: string
  subject: string
  total_marks: number
  pass_marks: number
}

function getDayMarkItem(
  studentDays: Record<string, any> | undefined,
  dayKey?: string,
  dayBn?: string,
  dayEn?: string
): { marks: number | string; total?: number; grade?: string; subject?: string; exam_name?: string } | undefined {
  if (!studentDays || typeof studentDays !== "object") return undefined
  if (dayKey && studentDays[dayKey] !== undefined) {
    const val = studentDays[dayKey]
    return typeof val === "object" && val !== null ? val : { marks: val }
  }
  const lKey = dayKey?.toLowerCase()
  if (lKey && studentDays[lKey] !== undefined) {
    const val = studentDays[lKey]
    return typeof val === "object" && val !== null ? val : { marks: val }
  }
  if (lKey) {
    const capKey = lKey.charAt(0).toUpperCase() + lKey.slice(1)
    if (studentDays[capKey] !== undefined) {
      const val = studentDays[capKey]
      return typeof val === "object" && val !== null ? val : { marks: val }
    }
  }
  if (dayBn && studentDays[dayBn] !== undefined) {
    const val = studentDays[dayBn]
    return typeof val === "object" && val !== null ? val : { marks: val }
  }
  if (dayEn && studentDays[dayEn] !== undefined) {
    const val = studentDays[dayEn]
    return typeof val === "object" && val !== null ? val : { marks: val }
  }
  if (dayEn) {
    const lEn = dayEn.toLowerCase()
    if (studentDays[lEn] !== undefined) {
      const val = studentDays[lEn]
      return typeof val === "object" && val !== null ? val : { marks: val }
    }
  }
  for (const [k, v] of Object.entries(studentDays)) {
    const lk = k.toLowerCase()
    if ((lKey && lk === lKey) || (dayBn && k === dayBn) || (dayEn && lk === dayEn.toLowerCase())) {
      return typeof v === "object" && v !== null ? v : { marks: v }
    }
  }
  return undefined
}

function normalizeDayMarks(days: Record<string, any> | undefined | null): Record<string, any> {
  if (!days || typeof days !== "object") return {}
  const normalized: Record<string, any> = {}
  for (const [key, val] of Object.entries(days)) {
    if (!val) continue
    const lowerKey = key.trim().toLowerCase()
    const matched = ALL_WEEK_DAYS.find((d) => d.id === lowerKey || d.bn === key || d.en.toLowerCase() === lowerKey)
    const canonicalKey = matched ? matched.id : lowerKey
    if (!normalized[canonicalKey] || (typeof val === "object" && val !== null && "marks" in val)) {
      normalized[canonicalKey] = val
    }
  }
  return normalized
}

export interface ResultCardItem {
  id: string
  parentExam: PublicExam
  type: "daily" | "weekly" | "one_time"
  title: string
  subTitle?: string
  subject?: string
  batchName?: string
  branchName?: string
  branchId?: string
  routineText: string
  totalMarks: number
  passMarks: number
  dayKey?: string | null
  dayConfig?: ParsedWeeklyDay | null
}

interface PublicExam {
  id: string
  title: string
  subject?: string
  total_marks: number
  pass_marks?: number
  exam_date?: string
  exam_schedule_type?: "one_time" | "weekly" | string
  recurring_days?: any[] | null
  published_days?: string[] | string | null
  is_weekly_published?: boolean
  is_paused?: boolean
  is_public_result?: boolean
  is_published?: boolean
  branch?: { id: string; name: string } | null
  batch?: { id: string; name: string } | null
  batch_ids?: string[] | null
  created_at: string
}

interface StudentRank {
  id: string
  student_id: string
  student_name: string
  roll: string
  obtained_marks: number
  grade?: string
  rank: number
  day_marks?: Record<string, any>
}

export function checkIsWeeklyExam(ex: any): boolean {
  if (!ex) return false
  const note = String(ex.result_note || "")
  if (ex.exam_schedule_type === "weekly") return true
  if (ex.exam_type === "weekly") return true
  if (ex.is_weekly === true || ex.is_weekly_published === true) return true
  if (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) return true
  if (
    note.includes("[WEEKLY_SCHEDULE:") ||
    note.includes("[WEEKLY_DAYS:") ||
    note.includes("[RECURRING_DAYS:") ||
    note.includes("[IS_WEEKLY_PUBLISHED:")
  ) return true
  if (ex.title && ex.title.includes("সাপ্তাহিক")) return true
  if (ex.subject && ex.subject.includes("সাপ্তাহিক")) return true
  if (Number(ex.total_marks) === 350) return true
  if (Array.isArray(ex.day_configs) && ex.day_configs.length > 0) return true
  return false
}

// Standalone parser for weekly days
export function parseWeeklyDaysForExam(exam: PublicExam | null): ParsedWeeklyDay[] {
  if (!exam) return []
  const isWeekly = checkIsWeeklyExam(exam)

  const dayConfigMap: Record<string, ParsedWeeklyDay> = {}

  if (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) {
    for (const item of exam.recurring_days) {
      const isObj = typeof item === "object" && item !== null
      const rawKey = isObj ? (item.day || item.day_bn || item.day_en || "") : String(item)
      const dayKey = String(rawKey).toLowerCase()
      const matched = ALL_WEEK_DAYS.find((d) => d.id === dayKey || d.bn === rawKey || d.en.toLowerCase() === dayKey)
      const canonicalKey = matched?.id || dayKey
      const bnName = matched?.bn || (isObj ? item.day_bn : rawKey)
      const enName = matched?.en || (isObj ? item.day_en : rawKey)
      dayConfigMap[canonicalKey] = {
        key: canonicalKey,
        day_bn: bnName,
        day_en: enName,
        exam_name: isObj && item.exam_name ? item.exam_name : `${bnName}ের পরীক্ষা`,
        subject: isObj && item.subject ? item.subject : exam.subject || "",
        total_marks: isObj && item.total_marks ? Number(item.total_marks) : 50,
        pass_marks: isObj && item.pass_marks ? Number(item.pass_marks) : 20,
      }
    }
  }

  const note = (exam as any).result_note || ""
  if (note.includes("[WEEKLY_SCHEDULE:")) {
    try {
      const match = note.match(/\[WEEKLY_SCHEDULE:(.*?)\]/)
      if (match && match[1]) {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const rawKey = item.day || item.day_bn || item.day_en || ""
            const dayKey = String(rawKey).toLowerCase()
            const matched = ALL_WEEK_DAYS.find((d) => d.id === dayKey || d.bn === rawKey || d.en.toLowerCase() === dayKey)
            const canonicalKey = matched?.id || dayKey
            if (!dayConfigMap[canonicalKey]) {
              dayConfigMap[canonicalKey] = {
                key: canonicalKey,
                day_bn: matched?.bn || item.day_bn || item.day,
                day_en: matched?.en || item.day_en || item.day,
                exam_name: item.exam_name || `${matched?.bn || item.day}ের পরীক্ষা`,
                subject: item.subject || exam.subject || "",
                total_marks: Number(item.total_marks) || 50,
                pass_marks: Number(item.pass_marks) || 20,
              }
            }
          }
        }
      }
    } catch {}
  }

  const foundDaysInTitle = ALL_WEEK_DAYS.filter(
    (d) => exam.title?.includes(d.bn) || exam.title?.toLowerCase()?.includes(d.id)
  )
  if (foundDaysInTitle.length > 0) {
    const subjectList = (exam.subject || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)

    foundDaysInTitle.forEach((d, idx) => {
      if (!dayConfigMap[d.id]) {
        const assignedSubj = subjectList[idx] || exam.subject || ""
        dayConfigMap[d.id] = {
          key: d.id,
          day_bn: d.bn,
          day_en: d.en,
          exam_name: assignedSubj ? `${assignedSubj} পরীক্ষা` : `${d.bn}ের পরীক্ষা`,
          subject: assignedSubj,
          total_marks: 50,
          pass_marks: 20,
        }
      }
    })
  }

  if (isWeekly) {
    return ALL_WEEK_DAYS.map((w) => {
      if (dayConfigMap[w.id]) {
        return dayConfigMap[w.id]
      }
      return {
        key: w.id,
        day_bn: w.bn,
        day_en: w.en,
        exam_name: `${w.bn}ের পরীক্ষা`,
        subject: exam.subject || "",
        total_marks: 50,
        pass_marks: 20,
      }
    })
  }
  return []
}

export default function OnlineResultPortalPage() {
  const [exams, setExams] = useState<PublicExam[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [staffRole, setStaffRole] = useState<string>("")
  
  // Filters: default to "all" so published weekly and daily exams are immediately visible
  const [activeTab, setActiveTab] = useState<"all" | "one_time" | "weekly" | "everyday">("all")
  const [selectedBranch, setSelectedBranch] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Active Exam for Full Merit List Modal
  const [selectedExam, setSelectedExam] = useState<PublicExam | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [examResults, setExamResults] = useState<StudentRank[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [studentSearchInModal, setStudentSearchInModal] = useState("")

  useEffect(() => {
    async function checkAuthRole() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUser(user)
          // 1. Check staff table
          let { data: staff } = await supabase
            .from("staff")
            .select("id, role, name, email")
            .eq("auth_user_id", user.id)
            .maybeSingle()

          if (!staff && user.email) {
            const { data: staffByEmail } = await supabase
              .from("staff")
              .select("id, role, name, email")
              .eq("email", user.email)
              .maybeSingle()
            if (staffByEmail) {
              staff = staffByEmail
              try {
                await supabase.from("staff").update({ auth_user_id: user.id }).eq("id", staffByEmail.id)
              } catch {}
            }
          }

          let pRole = null
          try {
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
            if (profile?.role) pRole = profile.role
          } catch {}

          const finalRole = staff?.role || pRole || (user.user_metadata?.role)
          if (finalRole && ["owner", "branch_director", "super_manager", "manager", "admin", "super_admin", "branch_admin", "teacher", "receptionist", "accountant", "course_teacher"].includes(finalRole)) {
            setIsStaff(true)
            setStaffRole(finalRole)
          } else if (staff) {
            setIsStaff(true)
            setStaffRole(staff.role || "staff")
          }
        }
      } catch (err) {
        console.warn("Auth role check error:", err)
      }
    }
    checkAuthRole()
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/online-results")
        const json = await res.json()
        let loadedExams: PublicExam[] = []
        if (json.success) {
          if (json.branches) setBranches(json.branches)
          if (json.exams) {
            setExams(json.exams)
            loadedExams = json.exams
          }
        } else {
          // Fallback to client supabase if api error
          const supabase = createClient()
          const { data: bList } = await supabase.from("branches").select("id, name").eq("is_active", true)
          if (bList) setBranches(bList)

          const { data: exList } = await supabase
            .from("exams")
            .select("*, branch:branches(id, name), batch:batches(id, name)")
            .or("is_public_result.eq.true,is_published.eq.true")
            .order("exam_date", { ascending: false })

          if (exList) {
            setExams(exList)
            loadedExams = exList
          }
        }
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
        const targetExamId = urlParams?.get("exam_id") || urlParams?.get("id")
        const targetDay = urlParams?.get("day")
        const targetTab = urlParams?.get("tab")

        if (targetTab === "weekly" || targetTab === "everyday" || targetTab === "all") {
          setActiveTab(targetTab)
        }

        if (targetExamId) {
          let found = loadedExams.find((e: any) => e.id === targetExamId)
          if (!found) {
            try {
              const singleRes = await fetch(`/api/online-results?exam_id=${targetExamId}`)
              const singleJson = await singleRes.json()
              if (singleJson.success && singleJson.exam) {
                found = singleJson.exam
              }
            } catch {}
          }
          if (found) {
            handleOpenMeritList(found, targetDay || null)
          }
        }
      } catch (err) {
        console.error("Error loading public online results:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Open Full Merit List
  async function handleOpenMeritList(exam: PublicExam, dayKey: string | null = null) {
    setSelectedExam(exam)
    setSelectedDayKey(dayKey)
    setLoadingResults(true)
    setStudentSearchInModal("")
    setExamResults([])

    try {
      const res = await fetch(`/api/online-results?exam_id=${exam.id}`)
      const json = await res.json()
      if (json.success && json.results) {
        setExamResults(json.results)
      } else {
        // Fallback
        const supabase = createClient()
        const { data: results } = await supabase
          .from("exam_results")
          .select("*, student:students(id, name, student_id)")
          .eq("exam_id", exam.id)
          .order("obtained_marks", { ascending: false })

        if (results && results.length > 0) {
          let curRank = 1
          const list: StudentRank[] = results.map((r, i) => {
            if (i > 0 && Number(r.obtained_marks) < Number(results[i - 1].obtained_marks)) {
              curRank = i + 1
            }
            return {
              id: r.id,
              student_id: r.student?.id || r.student_id,
              student_name: r.student?.name || "Student",
              roll: r.student?.student_id || "N/A",
              obtained_marks: Number(r.obtained_marks || 0),
              grade: r.grade || "",
              rank: r.rank || curRank,
              day_marks: r.day_marks || {},
            }
          })
          setExamResults(list)
        }
      }
    } catch (err) {
      console.error("Error fetching exam results:", err)
    } finally {
      setLoadingResults(false)
    }
  }

  // Unified Card Items: expands weekly exams into individual published daily cards + published weekly card
  const allCardItems = useMemo<ResultCardItem[]>(() => {
    const items: ResultCardItem[] = []

    for (const ex of exams) {
      const note = (ex as any).result_note || ""
      const isExplicitlyUnpublished =
        note.includes("[PUBLIC_RESULT:false]") ||
        (ex.is_public_result === false && ex.is_published === false && !note.includes("[PUBLIC_RESULT:true]"))

      if (isExplicitlyUnpublished) continue

      const isWeekly = checkIsWeeklyExam(ex)

      if (!isWeekly) {
        items.push({
          id: ex.id,
          parentExam: ex,
          type: "one_time",
          title: ex.title,
          subTitle: ex.subject || "এককালীন পরীক্ষা",
          subject: ex.subject,
          batchName: ex.batch?.name || "All Enrolled Batches",
          branchName: ex.branch?.name,
          branchId: ex.branch?.id,
          routineText: ex.exam_date ? formatDate(ex.exam_date) : "চলমান",
          totalMarks: ex.total_marks || 100,
          passMarks: ex.pass_marks || 33,
          dayKey: null,
          dayConfig: null,
        })
      } else {
        const days = parseWeeklyDaysForExam(ex)
        const totalMarks = days.reduce((acc, d) => acc + (d.total_marks || 0), 0) || (ex.total_marks || 350)
        const passMarks = days.reduce((acc, d) => acc + (d.pass_marks || 0), 0) || (ex.pass_marks || 140)

        // Parse published days
        let pubDays: string[] = []
        const rawPubDays: any = ex.published_days
        if (Array.isArray(rawPubDays)) {
          pubDays = rawPubDays.map((d: any) => String(d).toLowerCase())
        } else if (typeof rawPubDays === "string" && rawPubDays.trim()) {
          try {
            const parsed = JSON.parse(rawPubDays)
            if (Array.isArray(parsed)) pubDays = parsed.map((d: any) => String(d).toLowerCase())
            else pubDays = rawPubDays.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
          } catch {
            pubDays = rawPubDays.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
          }
        }
        if (pubDays.length === 0 && (ex as any).result_note?.includes("[PUBLISHED_DAYS:")) {
          const match = (ex as any).result_note.match(/\[PUBLISHED_DAYS:(.*?)\]/)
          if (match && match[1]) {
            pubDays = match[1].split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
          }
        }

        // 1. WEEKLY CONSOLIDATED EXAM CARD (350 marks):
        // Show weekly card unless explicitly disabled
        const isWeeklyExplicitlyFalse = note.includes("[IS_WEEKLY_PUBLISHED:false]")
        if (!isWeeklyExplicitlyFalse) {
          items.push({
            id: `${ex.id}-weekly`,
            parentExam: ex,
            type: "weekly",
            title: ex.title,
            subTitle: "সাপ্তাহিক সামগ্রিক মূল্যায়ন ও সকল দিনের সম্মিলিত ফলাফল",
            subject: ex.subject,
            batchName: ex.batch?.name || "All Enrolled Batches",
            branchName: ex.branch?.name,
            branchId: ex.branch?.id,
            routineText: "সাপ্তাহিক রুটিন (শনিবার হতে শুক্রবার)",
            totalMarks,
            passMarks,
            dayKey: null,
            dayConfig: null,
          })
        }

        // 2. FOR EACH PUBLISHED DAY: Add an individual day card (if published)
        for (const dayConf of days) {
          const isDayPub = pubDays.some((p) => {
            const pLower = String(p).toLowerCase()
            return (
              pLower === dayConf.key?.toLowerCase() ||
              pLower === dayConf.day_bn?.toLowerCase() ||
              (dayConf.day_en && pLower === dayConf.day_en.toLowerCase())
            )
          })
          if (isDayPub) {
            items.push({
              id: `${ex.id}-day-${dayConf.key}`,
              parentExam: ex,
              type: "daily",
              title: `${ex.title} - ${dayConf.day_bn}`,
              subTitle: dayConf.subject ? `${dayConf.subject} (${dayConf.exam_name})` : dayConf.exam_name,
              subject: dayConf.subject || ex.subject,
              batchName: ex.batch?.name || "All Enrolled Batches",
              branchName: ex.branch?.name,
              branchId: ex.branch?.id,
              routineText: `${dayConf.day_bn}ের পরীক্ষা`,
              totalMarks: dayConf.total_marks || 50,
              passMarks: dayConf.pass_marks || 20,
              dayKey: dayConf.key,
              dayConfig: dayConf,
            })
          }
        }
      }
    }
    return items
  }, [exams])

  // Filter cards by active tab, branch, and search
  const filteredCards = useMemo(() => {
    return allCardItems.filter((item) => {
      if (activeTab === "weekly" && item.type !== "weekly" && item.type !== "daily") return false
      if ((activeTab === "one_time" || (activeTab as string) === "everyday") && item.type !== "one_time") return false

      if (selectedBranch !== "all" && item.branchId && item.branchId !== selectedBranch) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = item.title?.toLowerCase().includes(q)
        const subMatch = item.subject?.toLowerCase().includes(q)
        const batchMatch = item.batchName?.toLowerCase().includes(q)
        if (!titleMatch && !subMatch && !batchMatch) return false
      }

      return true
    })
  }, [allCardItems, activeTab, selectedBranch, searchQuery])

  // Filter results inside merit list modal
  const filteredModalResults = useMemo(() => {
    if (!studentSearchInModal.trim()) return examResults
    const q = studentSearchInModal.toLowerCase()
    return examResults.filter((r) => r.student_name.toLowerCase().includes(q) || r.roll.toLowerCase().includes(q))
  }, [examResults, studentSearchInModal])

  // Is the selected exam in the modal a weekly exam?
  const isWeeklyExam = useMemo(() => {
    if (!selectedExam) return false
    return checkIsWeeklyExam(selectedExam)
  }, [selectedExam])

  // Parse structured days for weekly exams (GUARANTEE ALL 7 DAYS: Saturday to Friday)
  const parsedWeeklyDays = useMemo<ParsedWeeklyDay[]>(() => {
    return parseWeeklyDaysForExam(selectedExam)
  }, [selectedExam])

  // Active day configuration if viewing a specific day's merit list
  const activeDayConfig = useMemo<ParsedWeeklyDay | null>(() => {
    if (!selectedDayKey || parsedWeeklyDays.length === 0) return null
    const lower = selectedDayKey.toLowerCase()
    return (
      parsedWeeklyDays.find(
        (d) =>
          d.key?.toLowerCase() === lower ||
          d.day_bn?.toLowerCase() === lower ||
          (d.day_en && d.day_en.toLowerCase() === lower)
      ) || null
    )
  }, [selectedDayKey, parsedWeeklyDays])

  // Available published days for day switcher pills in modal
  const modalPublishedDays = useMemo(() => {
    if (!selectedExam) return []
    let pubDays: string[] = []
    const rawPub: any = selectedExam.published_days
    if (Array.isArray(rawPub)) {
      pubDays = rawPub.map((d: any) => String(d).toLowerCase())
    } else if (typeof rawPub === "string" && rawPub.trim()) {
      try {
        const p = JSON.parse(rawPub)
        if (Array.isArray(p)) pubDays = p.map((d: any) => String(d).toLowerCase())
        else pubDays = rawPub.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      } catch {
        pubDays = rawPub.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      }
    }
    if (pubDays.length === 0 && (selectedExam as any).result_note?.includes("[PUBLISHED_DAYS:")) {
      const match = (selectedExam as any).result_note.match(/\[PUBLISHED_DAYS:(.*?)\]/)
      if (match && match[1]) {
        pubDays = match[1].split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
      }
    }
    return parsedWeeklyDays.filter((d) =>
      pubDays.some((p) => {
        const pLower = String(p).toLowerCase()
        return (
          pLower === d.key?.toLowerCase() ||
          pLower === d.day_bn?.toLowerCase() ||
          (d.day_en && pLower === d.day_en.toLowerCase())
        )
      })
    )
  }, [selectedExam, parsedWeeklyDays])

  // Daily Exam Student Results (When viewing a specific published day)
  const dailyModalResults = useMemo(() => {
    if (!selectedDayKey || !activeDayConfig) return []
    const dayKeyLower = activeDayConfig.key.toLowerCase()
    const maxMarks = activeDayConfig.total_marks || 50
    const passMarks = activeDayConfig.pass_marks || 20

    const mapped = examResults.map((r) => {
      const normDays = normalizeDayMarks(r.day_marks)
      const dayVal = normDays[dayKeyLower]
      const mark =
        typeof dayVal === "object" && dayVal !== null
          ? dayVal.marks != null
            ? Number(dayVal.marks)
            : null
          : dayVal != null
          ? Number(dayVal)
          : null
      const obt = mark !== null && !isNaN(mark) ? mark : null
      const pct = obt !== null && maxMarks > 0 ? Math.round((obt / maxMarks) * 100) : null
      const grade = obt !== null ? getGrade(obt, maxMarks) : "-"
      const passed = obt !== null && obt >= passMarks

      return {
        id: r.id,
        student_id: r.student_id,
        student_name: r.student_name,
        roll: r.roll,
        obtained_marks: obt,
        pct,
        grade,
        passed,
      }
    })

    const filtered = studentSearchInModal.trim()
      ? mapped.filter(
          (s) =>
            s.student_name.toLowerCase().includes(studentSearchInModal.toLowerCase()) ||
            s.roll.toLowerCase().includes(studentSearchInModal.toLowerCase())
        )
      : mapped

    const sorted = [...filtered].sort((a, b) => (b.obtained_marks ?? -1) - (a.obtained_marks ?? -1))

    let curRank = 1
    return sorted.map((s, idx) => {
      if (idx > 0 && (s.obtained_marks ?? -1) < (sorted[idx - 1].obtained_marks ?? -1)) {
        curRank = idx + 1
      }
      return {
        ...s,
        rank: s.obtained_marks !== null ? curRank : null,
      }
    })
  }, [examResults, selectedDayKey, activeDayConfig, studentSearchInModal])

  // Daily Podium Toppers (Top 3 for that day)
  const dailyToppers = useMemo(() => {
    return dailyModalResults.filter((s) => s.obtained_marks !== null && s.obtained_marks > 0).slice(0, 3)
  }, [dailyModalResults])

  // Total possible weekly marks
  const totalWeeklyMaxMarks = useMemo(() => {
    if (!selectedExam) return 100
    if (parsedWeeklyDays.length > 0) {
      return parsedWeeklyDays.reduce((acc, d) => acc + (d.total_marks || 0), 0)
    }
    return selectedExam.total_marks || 100
  }, [selectedExam, parsedWeeklyDays])

  // Weekly grand total toppers (Top 3 for podium cards)
  const weeklyTotalToppers = useMemo(() => {
    if (!isWeeklyExam || examResults.length === 0) return []

    const scoredList = examResults
      .map((r) => {
        let grandTotal = 0
        let hasMark = false

        const normDays = normalizeDayMarks(r.day_marks)
        if (Object.keys(normDays).length > 0) {
          grandTotal = Object.values(normDays).reduce((acc: number, curr: any) => {
            const m = typeof curr === "object" && curr !== null ? Number(curr.marks) : Number(curr)
            if (!isNaN(m)) {
              hasMark = true
              return acc + m
            }
            return acc
          }, 0)
        }

        if (!hasMark && r.obtained_marks !== undefined && r.obtained_marks !== null && !isNaN(r.obtained_marks)) {
          grandTotal = Number(r.obtained_marks)
          hasMark = true
        }

        const obt = hasMark ? grandTotal : 0
        const pct = Math.round((obt / totalWeeklyMaxMarks) * 100)
        const grade = getGrade(obt, totalWeeklyMaxMarks)

        return {
          id: r.id,
          student_id: r.student_id,
          student_name: r.student_name,
          roll: r.roll,
          obtained_marks: obt,
          pct,
          grade,
          hasMark,
        }
      })
      .filter((x) => x.hasMark)
      .sort((a, b) => b.obtained_marks - a.obtained_marks)

    let curRank = 1
    return scoredList.slice(0, 3).map((item, idx) => {
      if (idx > 0 && item.obtained_marks < scoredList[idx - 1].obtained_marks) {
        curRank = idx + 1
      }
      return { ...item, rank: curRank }
    })
  }, [isWeeklyExam, examResults, totalWeeklyMaxMarks])

  // Subject-wise toppers (for each scheduled day)
  const weeklySubjectToppers = useMemo(() => {
    if (!isWeeklyExam || parsedWeeklyDays.length === 0) return []

    return parsedWeeklyDays.map((d) => {
      let topStudentName = ""
      let topStudentRoll = ""
      let topScore = -1

      for (const r of examResults) {
        const dObj = getDayMarkItem(r.day_marks, d.key, d.day_bn, d.day_en)
        if (dObj && !isNaN(Number(dObj.marks))) {
          const score = Number(dObj.marks)
          if (score > topScore) {
            topScore = score
            topStudentName = r.student_name
            topStudentRoll = r.roll
          }
        }
      }

      return {
        day: d,
        studentName: topStudentName,
        studentRoll: topStudentRoll,
        score: topScore,
      }
    })
  }, [isWeeklyExam, parsedWeeklyDays, examResults])

  // Multi-column table rows for weekly view
  const weeklyTableRows = useMemo(() => {
    return filteredModalResults
      .map((r) => {
        let grandTotal = 0
        let hasMark = false

        const normDays = normalizeDayMarks(r.day_marks)
        if (Object.keys(normDays).length > 0) {
          grandTotal = Object.values(normDays).reduce((acc: number, curr: any) => {
            const m = typeof curr === "object" && curr !== null ? Number(curr.marks) : Number(curr)
            if (!isNaN(m)) {
              hasMark = true
              return acc + m
            }
            return acc
          }, 0)
        }

        if (!hasMark && r.obtained_marks !== undefined && r.obtained_marks !== null && !isNaN(r.obtained_marks)) {
          grandTotal = Number(r.obtained_marks)
          hasMark = true
        }

        const obt = hasMark ? grandTotal : null
        const pct = obt !== null ? Math.round((obt / totalWeeklyMaxMarks) * 100) : null
        const grade = obt !== null ? getGrade(obt, totalWeeklyMaxMarks) : "-"

        return {
          id: r.id,
          student_id: r.student_id,
          student_name: r.student_name,
          roll: r.roll,
          obtained_marks: obt,
          pct,
          grade,
          day_marks: normDays,
        }
      })
      .sort((a, b) => (b.obtained_marks ?? -1) - (a.obtained_marks ?? -1))
  }, [filteredModalResults, totalWeeklyMaxMarks])

  const top3 = examResults.slice(0, 3)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased">
      {/* Top Utility Header */}
      <header className="bg-[#1e1b4b] text-white py-3.5 px-4 sm:px-8 border-b border-indigo-900/60 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 transition-colors flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">মূল পাতা (Home)</span>
            </Link>
            <div className="h-4 w-px bg-white/20"></div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="font-extrabold text-base sm:text-lg tracking-tight">
                অনলাইন রেজাল্ট ও মেধাতালিকা
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-amber-300 text-xs font-bold border border-white/10">
                  <User className="w-3 h-3 text-amber-400" />
                  <span>
                    {staffRole
                      ? staffRole === "owner"
                        ? "মালিক (Owner)"
                        : staffRole === "teacher"
                        ? "শিক্ষক"
                        : staffRole === "super_admin" || staffRole === "admin"
                        ? "এডমিন"
                        : staffRole
                      : "স্টাফ / এডমিন"}
                  </span>
                </span>
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>ড্যাশবোর্ড</span>
                </Link>
              </div>
            ) : (
              <Link
                href="/login?returnUrl=/online-result"
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>লগইন</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-white py-10 px-4 sm:px-8 border-b-4 border-amber-400">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              মেধাশিরী পরীক্ষার কেন্দ্রীয় ফলাফল পোর্টাল
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              দৈনিক ও সাপ্তাহিক পরীক্ষার রেজাল্ট এবং মেরিট লিস্ট
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 font-medium leading-relaxed">
              শিক্ষার্থী ও অভিভাবকদের অবগতির জন্য কোচিংয়ের প্রতিটি শাখার দৈনিক ও সাপ্তাহিক পরীক্ষার ফলাফল সরাসরি এই পোর্টালে প্রকাশিত হয়। রোল নম্বর বা নাম দিয়ে ফলাফল খুঁজুন।
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">প্রকাশিত মোট পরীক্ষা</p>
              <p className="text-2xl font-black text-amber-400 mt-0.5">{allCardItems.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">এককালীন পরীক্ষা</p>
              <p className="text-2xl font-black text-white mt-0.5">
                {allCardItems.filter((i) => i.type === "one_time").length}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">সাপ্তাহিক পরীক্ষা</p>
              <p className="text-2xl font-black text-purple-300 mt-0.5">
                {allCardItems.filter((i) => i.type === "weekly" || i.type === "daily").length}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
              <p className="text-[11px] text-indigo-200 font-semibold">সক্রিয় শাখা</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">{branches.length || 1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Navigation Tabs & Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Main Merit List Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === "all"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>সকল পরীক্ষা ({allCardItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === "weekly"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>সাপ্তাহিক পরীক্ষা ({allCardItems.filter((i) => i.type === "weekly" || i.type === "daily").length})</span>
            </button>
            <button
              onClick={() => setActiveTab("one_time")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === "one_time" || (activeTab as string) === "everyday"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>এককালীন পরীক্ষা ({allCardItems.filter((i) => i.type === "one_time").length})</span>
            </button>
          </div>

          {/* Search and Branch Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            {branches.length > 1 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
              >
                <option value="all">সকল শাখা (All Branches)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="পরীক্ষার নাম বা বিষয় দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Exams Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="font-semibold text-sm">ফলাফল ও মেরিট লিস্ট লোড হচ্ছে...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500 shadow-xs space-y-2">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">এই বিভাগে কোনো ফলাফল পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400">ফিল্টার পরিবর্তন করে অথবা পরীক্ষা ফলাফল প্রকাশিত হলে পুনরায় চেক করুন।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCards.map((card) => {
              const isWeekly = card.type === "weekly"
              const isDaily = card.type === "daily"

              return (
                <div
                  key={card.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-500/50 p-5 shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isWeekly ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                            <CalendarDays className="w-3 h-3" />
                            সাপ্তাহিক পরীক্ষা
                          </span>
                        ) : isDaily ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            <Calendar className="w-3 h-3 text-purple-600" />
                            সাপ্তাহিক ({card.dayConfig?.day_bn || "দিন"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            <Calendar className="w-3 h-3" />
                            এককালীন পরীক্ষা
                          </span>
                        )}
                        {card.subject && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {card.subject}
                          </span>
                        )}
                      </div>
                      {card.branchName && (
                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                          <Landmark className="w-3 h-3 text-slate-400" />
                          {card.branchName}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-900 transition-colors">
                        {card.title}
                      </h3>
                      {card.subTitle && (
                        <p className="text-xs text-indigo-800 font-semibold mt-0.5">
                          {card.subTitle}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        <span>{card.batchName}</span>
                      </p>
                    </div>

                    {/* Metadata chips */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">তারিখ / সূচি</span>
                        <span className="font-bold text-slate-800 truncate block">
                          {card.routineText}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">পূর্ণমান ও পাস</span>
                        <span className="font-bold text-slate-800 block">
                          {card.totalMarks} marks (Pass: {card.passMarks})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenMeritList(card.parentExam, card.dayKey)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 text-amber-200" />
                      <span>{isWeekly ? "সাপ্তাহিক পরীক্ষার রেজাল্ট ও মেধা তালিকা দেখুন" : isDaily ? `${card.dayConfig?.day_bn || "দিন"}ের রেজাল্ট দেখুন` : "এককালীন পরীক্ষার রেজাল্ট দেখুন"}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Full Merit List Modal */}
      {selectedExam && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div
            className={cn(
              "bg-white rounded-3xl w-full shadow-2xl my-4 sm:my-8 flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150",
              isWeeklyExam ? "max-w-6xl" : "max-w-4xl"
            )}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50 rounded-t-3xl shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {selectedDayKey && activeDayConfig
                        ? `${selectedExam.title} - ${activeDayConfig.day_bn} (${activeDayConfig.subject || activeDayConfig.exam_name})`
                        : `${selectedExam.title} - ${isWeeklyExam ? "সাপ্তাহিক পরীক্ষার সামগ্রিক মেধাতালিকা" : "এককালীন পরীক্ষার মেধাতালিকা"}`}
                    </h3>
                    {selectedDayKey && activeDayConfig ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                        সাপ্তাহিক পরীক্ষা • {activeDayConfig.day_bn}
                      </span>
                    ) : isWeeklyExam ? (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                        সাপ্তাহিক পরীক্ষা
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                        এককালীন পরীক্ষা
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedExam.branch?.name && <span>শাখা: {selectedExam.branch.name} • </span>}
                    {selectedExam.batch?.name && <span>ব্যাচ: {selectedExam.batch.name} • </span>}
                    {selectedDayKey && activeDayConfig ? (
                      <span>পূর্ণমান: {activeDayConfig.total_marks} নম্বর (পাস: {activeDayConfig.pass_marks}) • মোট পরীক্ষার্থী: {dailyModalResults.length} জন</span>
                    ) : (
                      <span>মোট পূর্ণমান: {isWeeklyExam ? totalWeeklyMaxMarks : selectedExam.total_marks} নম্বর • মোট পরীক্ষার্থী: {examResults.length} জন</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedExam(null)
                  setSelectedDayKey(null)
                }}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Day Switcher Bar in Modal (If weekly exam has published days or weekly published) */}
            {isWeeklyExam && (modalPublishedDays.length > 0 || selectedExam.is_weekly_published) && (
              <div className="px-4 sm:px-6 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-500 mr-1 whitespace-nowrap">দিন নির্বাচন:</span>
                {modalPublishedDays.map((d) => {
                  const isDayActive = selectedDayKey?.toLowerCase() === d.key.toLowerCase()
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setSelectedDayKey(d.key)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                        isDayActive
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                          : "bg-white hover:bg-slate-200/70 text-slate-700 border-slate-300"
                      )}
                    >
                      {d.day_bn} ({d.total_marks})
                    </button>
                  )
                })}
                {selectedExam.is_weekly_published && (
                  <button
                    type="button"
                    onClick={() => setSelectedDayKey(null)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                      !selectedDayKey
                        ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                        : "bg-white hover:bg-slate-200/70 text-slate-700 border-slate-300"
                    )}
                  >
                    <CalendarDays className="w-3 h-3 inline mr-1" />
                    সামগ্রিক সাপ্তাহিক ({totalWeeklyMaxMarks})
                  </button>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {loadingResults ? (
                <div className="py-16 text-center text-slate-500">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm font-semibold">ফলাফল ও মেধাতালিকা সাজানো হচ্ছে...</p>
                </div>
              ) : selectedDayKey && activeDayConfig ? (
                /* ========================================================================= */
                /* 1. DAILY EXAM MERIT LIST (FOR EACH PUBLISHED DAY OF THE WEEK) */
                /* ========================================================================= */
                <div className="space-y-6">
                  {/* Daily Podium (Top 3 for that day) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                          <Trophy className="w-5 h-5" />
                        </span>
                        <div>
                          <h2 className="text-sm sm:text-base font-black text-slate-900">
                            {activeDayConfig.day_bn}ের শীর্ষ মেধা তালিকা (Top Performers)
                          </h2>
                          <p className="text-xs text-slate-500">
                            {activeDayConfig.subject || activeDayConfig.exam_name} বিষয়ে সর্বোচ্চ নম্বর অর্জনকারী ১ম, ২য় ও ৩য় স্থান
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-300"
                      >
                        <Printer className="w-3.5 h-3.5" /> প্রিন্ট মেধা তালিকা
                      </button>
                    </div>

                    {dailyToppers.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        এই দিনে এখনও কোনো শিক্ষার্থীর প্রাপ্ত নম্বর পাওয়া যায়নি।
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {dailyToppers.map((t, idx) => {
                          const isGold = idx === 0
                          const isSilver = idx === 1

                          return (
                            <div
                              key={t.id || t.student_id}
                              className={cn(
                                "p-4 rounded-2xl border flex items-center gap-3.5 transition-all shadow-xs",
                                isGold
                                  ? "bg-gradient-to-br from-amber-50 via-amber-100/50 to-amber-200/40 border-amber-300 ring-2 ring-amber-400/30"
                                  : isSilver
                                  ? "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/50 border-slate-300"
                                  : "bg-gradient-to-br from-orange-50 via-orange-100/50 to-orange-200/40 border-orange-300"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm shrink-0",
                                  isGold ? "bg-amber-500 text-white" : isSilver ? "bg-slate-600 text-white" : "bg-amber-700 text-white"
                                )}
                              >
                                {isGold ? "১ম" : isSilver ? "২য়" : "৩য়"}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  {isGold ? "🥇 ১ম স্থান" : isSilver ? "🥈 ২য় স্থান" : "🥉 ৩য় স্থান"}
                                </span>
                                <h3 className="font-black text-sm text-slate-900 truncate">{t.student_name}</h3>
                                <p className="text-[11px] font-mono text-slate-500">ID: {t.roll}</p>
                                <p className="text-xs font-bold text-amber-700 mt-1">
                                  প্রাপ্ত: {t.obtained_marks} / {activeDayConfig.total_marks} ({t.pct}%, গ্রেড: {t.grade})
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Daily Search and Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          {activeDayConfig.day_bn}ের পূর্ণাঙ্গ ফলাফল ও মেধাতালিকা
                        </h3>
                        <p className="text-xs text-slate-500">
                          বিষয়: {activeDayConfig.subject || activeDayConfig.exam_name} • পূর্ণমান: {activeDayConfig.total_marks} (পাস: {activeDayConfig.pass_marks})
                        </p>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="নিজের রোল বা নাম দিয়ে খুঁজুন..."
                          value={studentSearchInModal}
                          onChange={(e) => setStudentSearchInModal(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {dailyModalResults.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 text-center w-16">মেধা (Rank)</th>
                              <th className="px-4 py-3">শিক্ষার্থীর নাম</th>
                              <th className="px-4 py-3">রোল / Student ID</th>
                              <th className="px-4 py-3 text-center bg-amber-50/70 text-amber-900 font-black">
                                প্রাপ্ত নম্বর ({activeDayConfig.total_marks})
                              </th>
                              <th className="px-4 py-3 text-center">শতকরা (%)</th>
                              <th className="px-4 py-3 text-center">গ্রেড</th>
                              <th className="px-4 py-3 text-center">ফলাফল</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dailyModalResults.map((r) => {
                              return (
                                <tr key={r.id || r.student_id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 text-center font-black">
                                    <span
                                      className={cn(
                                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold",
                                        r.rank === 1
                                          ? "bg-amber-500 text-white"
                                          : r.rank === 2
                                          ? "bg-slate-500 text-white"
                                          : r.rank === 3
                                          ? "bg-amber-700 text-white"
                                          : "bg-slate-100 text-slate-700"
                                      )}
                                    >
                                      {r.rank ?? "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-900">{r.student_name}</td>
                                  <td className="px-4 py-3 font-mono text-slate-600 font-semibold">{r.roll}</td>
                                  <td className="px-4 py-3 text-center font-black text-amber-700 text-sm bg-amber-50/40">
                                    {r.obtained_marks !== null ? `${r.obtained_marks} / ${activeDayConfig.total_marks}` : "অনুপস্থিত"}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-700">
                                    {r.pct !== null ? `${r.pct}%` : "-"}
                                  </td>
                                  <td className="px-4 py-3 text-center font-extrabold text-slate-800">
                                    {r.grade || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={cn(
                                        "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                                        r.obtained_marks === null
                                          ? "bg-slate-100 text-slate-500 border-slate-200"
                                          : r.passed
                                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                          : "bg-rose-100 text-rose-800 border-rose-300"
                                      )}
                                    >
                                      {r.obtained_marks === null ? "অনুপস্থিত" : r.passed ? "উত্তীর্ণ" : "অনুত্তীর্ণ"}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : isWeeklyExam ? (
                /* ========================================================================= */
                /* 2. CONSOLIDATED WEEKLY EXAM VIEW */
                /* ========================================================================= */
                <div className="space-y-6">
                  {/* 1. TOTAL TOPPERS (GRAND MERIT PODIUM) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                          <Trophy className="w-5 h-5" />
                        </span>
                        <div>
                          <h2 className="text-sm sm:text-base font-black text-slate-900">
                            সামগ্রিক শীর্ষ মেধা (Weekly Grand Total Toppers)
                          </h2>
                          <p className="text-xs text-slate-500">
                            সকল বিষয়ের মোট নম্বরের ভিত্তিতে ১ম, ২য় ও ৩য় স্থান অর্জনকারী শিক্ষার্থী
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-300"
                      >
                        <Printer className="w-3.5 h-3.5" /> প্রিন্ট মেধা তালিকা
                      </button>
                    </div>

                    {weeklyTotalToppers.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        এখনও কোনো শিক্ষার্থীর নম্বর দেওয়া হয়নি।
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {weeklyTotalToppers.map((t, idx) => {
                          const isGold = idx === 0
                          const isSilver = idx === 1

                          return (
                            <div
                              key={t.id || t.student_id}
                              className={cn(
                                "p-4 rounded-2xl border flex items-center gap-3.5 transition-all shadow-xs",
                                isGold
                                  ? "bg-gradient-to-br from-amber-50 via-amber-100/50 to-amber-200/40 border-amber-300 ring-2 ring-amber-400/30"
                                  : isSilver
                                  ? "bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200/50 border-slate-300"
                                  : "bg-gradient-to-br from-orange-50 via-orange-100/50 to-orange-200/40 border-orange-300"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm shrink-0",
                                  isGold ? "bg-amber-500 text-white" : isSilver ? "bg-slate-600 text-white" : "bg-amber-700 text-white"
                                )}
                              >
                                {isGold ? "১ম" : isSilver ? "২য়" : "৩য়"}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  {isGold ? "🥇 ১ম স্থান" : isSilver ? "🥈 ২য় স্থান" : "🥉 ৩য় স্থান"}
                                </span>
                                <h3 className="font-black text-sm text-slate-900 truncate">{t.student_name}</h3>
                                <p className="text-[11px] font-mono text-slate-500">ID: {t.roll}</p>
                                <p className="text-xs font-bold text-amber-700 mt-1">
                                  মোট প্রাপ্ত: {t.obtained_marks} / {totalWeeklyMaxMarks} ({t.pct}%, গ্রেড: {t.grade})
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. SUBJECT-WISE TOPPERS */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                      <span className="p-2 rounded-xl bg-purple-100 text-purple-700 font-bold">
                        <BookOpen className="w-5 h-5" />
                      </span>
                      <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                          বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী (Subject-wise Toppers)
                        </h2>
                        <p className="text-xs text-slate-500">
                          প্রতিটি দিনের নির্ধারিত বিষয়ে সর্বোচ্চ নম্বর অর্জনকারী শিক্ষার্থী
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {weeklySubjectToppers.map((st) => {
                        const hasWinner = Boolean(st.studentName && st.score >= 0)

                        return (
                          <div key={st.day.key} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                                {st.day.day_bn}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                                পূর্ণমান: {st.day.total_marks}
                              </span>
                            </div>

                            <p className="text-xs text-purple-900 font-bold truncate">
                              {st.day.subject || st.day.exam_name}
                            </p>

                            {hasWinner ? (
                              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                                <div className="truncate">
                                  <p className="font-bold text-slate-800 truncate">🏆 {st.studentName}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">ID: {st.studentRoll}</p>
                                </div>
                                <span className="font-black text-amber-700 shrink-0 ml-2">
                                  {st.score}/{st.day.total_marks}
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200">
                                নম্বর এখনও যুক্ত হয়নি
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 3. CONSOLIDATED MULTI-COLUMN WEEKLY MARKS TABLE */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          সাপ্তাহিক সামগ্রিক মূল্যায়ন টেবিল (Day-by-Day Marks Breakdown)
                        </h3>
                        <p className="text-xs text-slate-500">প্রতিটি শিক্ষার্থীর প্রতিদিনের নম্বর এবং মোট প্রাপ্তির বিস্তারিত বিবরণ</p>
                      </div>

                      {/* Live Search in Modal Table */}
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="নিজের রোল বা নাম দিয়ে খুঁজুন..."
                          value={studentSearchInModal}
                          onChange={(e) => setStudentSearchInModal(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-center w-12">#</th>
                            <th className="px-4 py-3">Student Name</th>
                            <th className="px-4 py-3">Student ID</th>
                            {parsedWeeklyDays.map((d) => (
                              <th key={d.key} className="px-3 py-3 text-center whitespace-nowrap">
                                {d.day_bn} ({d.total_marks})
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center bg-amber-50/60 font-black text-amber-900 whitespace-nowrap">
                              মোট প্রাপ্ত ({totalWeeklyMaxMarks})
                            </th>
                            <th className="px-3 py-3 text-center whitespace-nowrap">শতকরা (%)</th>
                            <th className="px-3 py-3 text-center">গ্রেড</th>
                            <th className="px-3 py-3 text-center whitespace-nowrap">মেধা (Rank)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {weeklyTableRows.length === 0 ? (
                            <tr>
                              <td colSpan={parsedWeeklyDays.length + 7} className="py-8 text-center text-slate-400">
                                কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                              </td>
                            </tr>
                          ) : (
                            weeklyTableRows.map((row, idx) => {
                              const obt = row.obtained_marks
                              const pct = row.pct
                              const grade = row.grade

                              return (
                                <tr key={row.id || row.student_id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                  <td className="px-4 py-3 font-bold text-slate-900">{row.student_name}</td>
                                  <td className="px-4 py-3 font-mono text-slate-600 font-semibold">{row.roll}</td>
                                  {parsedWeeklyDays.map((d) => {
                                    const dObj = getDayMarkItem(row.day_marks, d.key, d.day_bn, d.day_en)
                                    return (
                                      <td key={d.key} className="px-3 py-3 text-center font-semibold">
                                        {dObj && !isNaN(Number(dObj.marks)) ? (
                                          <span className="text-slate-800 font-black">{dObj.marks}</span>
                                        ) : (
                                          <span className="text-slate-300">—</span>
                                        )}
                                      </td>
                                    )
                                  })}
                                  <td className="px-4 py-3 text-center font-black text-amber-800 bg-amber-50/40 text-sm">
                                    {obt !== null ? obt : "—"}
                                  </td>
                                  <td className="px-3 py-3 text-center font-bold text-slate-700">
                                    {pct !== null ? `${pct}%` : "—"}
                                  </td>
                                  <td className="px-3 py-3 text-center font-black">
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded-md text-[11px]",
                                        grade === "A+" || grade === "A"
                                          ? "bg-emerald-100 text-emerald-800 font-bold"
                                          : "bg-slate-100 text-slate-700"
                                      )}
                                    >
                                      {grade}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center font-black">
                                    {obt !== null ? (
                                      <span
                                        className={cn(
                                          "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                          idx === 0
                                            ? "bg-amber-500 text-white"
                                            : idx === 1
                                            ? "bg-slate-500 text-white"
                                            : idx === 2
                                            ? "bg-amber-700 text-white"
                                            : "bg-slate-100 text-slate-700"
                                        )}
                                      >
                                        {idx + 1}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* ONE-TIME EXAM VIEW */
                <>
                  {/* Top 3 Podium Cards */}
                  {top3.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {top3.map((r, idx) => {
                        const isGold = idx === 0
                        const isSilver = idx === 1

                        return (
                          <div
                            key={r.id}
                            className={`p-4 rounded-2xl border flex items-center gap-3.5 ${
                              isGold
                                ? "bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-300 shadow-sm"
                                : isSilver
                                ? "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300 shadow-sm"
                                : "bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-300 shadow-sm"
                            }`}
                          >
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-xs ${
                                isGold
                                  ? "bg-amber-500 text-white"
                                  : isSilver
                                  ? "bg-slate-600 text-white"
                                  : "bg-amber-700 text-white"
                              }`}
                            >
                              {isGold ? "১ম" : isSilver ? "২য়" : "৩য়"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">
                                {isGold ? "🥇 ১ম স্থান" : isSilver ? "🥈 ২য় স্থান" : "🥉 ৩য় স্থান"}
                              </p>
                              <p className="font-extrabold text-sm text-slate-900 truncate">{r.student_name}</p>
                              <p className="text-xs font-bold text-amber-700">
                                প্রাপ্ত নম্বর: {r.obtained_marks} / {selectedExam.total_marks}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Student Search & Stats in Modal */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="নিজের রোল বা নাম দিয়ে খুঁজুন..."
                        value={studentSearchInModal}
                        onChange={(e) => setStudentSearchInModal(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="text-xs text-slate-500 font-bold">
                      মোট পরীক্ষার্থী: <span className="text-slate-900">{examResults.length}</span> জন
                    </div>
                  </div>

                  {/* Leaderboard Table */}
                  {filteredModalResults.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl text-xs">
                      কোনো পরীক্ষার্থীর ফলাফল পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-center w-16">মেধা (Rank)</th>
                            <th className="px-4 py-3">শিক্ষার্থীর নাম</th>
                            <th className="px-4 py-3">রোল / Student ID</th>
                            <th className="px-4 py-3 text-center">প্রাপ্ত নম্বর</th>
                            <th className="px-4 py-3 text-center">গ্রেড</th>
                            <th className="px-4 py-3 text-center">ফলাফল</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredModalResults.map((r) => {
                            const pass = r.obtained_marks >= (selectedExam.pass_marks || 33)
                            return (
                              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-center font-black">
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                                      r.rank === 1
                                        ? "bg-amber-500 text-white font-bold"
                                        : r.rank === 2
                                        ? "bg-slate-500 text-white font-bold"
                                        : r.rank === 3
                                        ? "bg-amber-700 text-white font-bold"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {r.rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-900">
                                  <div>{r.student_name}</div>
                                  {r.day_marks && Object.keys(r.day_marks).length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                      {Object.entries(r.day_marks).map(([dKey, dVal]: any) => {
                                        const mVal = typeof dVal === "object" && dVal !== null ? (dVal.marks ?? 0) : dVal
                                        const tVal = typeof dVal === "object" && dVal !== null ? (dVal.total ?? "") : ""
                                        return (
                                          <span
                                            key={dKey}
                                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700"
                                          >
                                            <span className="capitalize">{dKey}:</span>
                                            <strong className="text-indigo-700">{mVal}{tVal ? `/${tVal}` : ""}</strong>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono font-medium">{r.roll}</td>
                                <td className="px-4 py-3 text-center font-black text-amber-700 text-sm">
                                  {r.obtained_marks} / {selectedExam.total_marks}
                                </td>
                                <td className="px-4 py-3 text-center font-extrabold text-slate-800">
                                  {r.grade || "-"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      pass
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : "bg-rose-100 text-rose-800 border border-rose-300"
                                    }`}
                                  >
                                    {pass ? "উত্তীর্ণ" : "অনুত্তীর্ণ"}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>প্রিন্ট / ডাউনলোড</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedExam(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
