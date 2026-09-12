"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Loader2,
  Save,
  Trophy,
  Search,
  Check,
  X,
  ArrowLeft,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Users,
  Lock,
  Eye,
  EyeOff,
  MessageSquare,
  Trash2,
  Globe,
  Bell,
  Play,
  Pause,
  CalendarDays,
  CheckCircle,
  Printer,
  ChevronRight,
  BookOpen,
  Edit2,
} from "lucide-react"
import { getGrade, cn } from "@/lib/utils"

interface Student {
  id: string
  name: string
  student_id: string
  roll_no?: number | null
  batch_roll?: number | null
  phone?: string | null
  guardian_phone?: string | null
}

interface Result {
  student_id: string
  obtained_marks: string
  grade: string
}

interface DayMarkItem {
  marks: number
  total: number
  grade: string
  subject?: string
  exam_name?: string
}

interface ParsedWeeklyDay {
  key: string
  day_bn: string
  day_en: string
  exam_name: string
  subject: string
  total_marks: number
  pass_marks: number
}

const ALL_WEEK_DAYS = [
  { id: "saturday", bn: "শনিবার", en: "Saturday" },
  { id: "sunday", bn: "রবিবার", en: "Sunday" },
  { id: "monday", bn: "সোমবার", en: "Monday" },
  { id: "tuesday", bn: "মঙ্গলবার", en: "Tuesday" },
  { id: "wednesday", bn: "বুধবার", en: "Wednesday" },
  { id: "thursday", bn: "বৃহস্পতিবার", en: "Thursday" },
  { id: "friday", bn: "শুক্রবার", en: "Friday" },
]

function getDayMarkItem(
  studentDays: Record<string, DayMarkItem> | undefined,
  dayKey?: string,
  dayBn?: string,
  dayEn?: string
): DayMarkItem | undefined {
  if (!studentDays) return undefined
  if (dayKey && studentDays[dayKey]) return studentDays[dayKey]
  const lKey = dayKey?.toLowerCase()
  if (lKey && studentDays[lKey]) return studentDays[lKey]
  if (lKey) {
    const capKey = lKey.charAt(0).toUpperCase() + lKey.slice(1)
    if (studentDays[capKey]) return studentDays[capKey]
  }
  if (dayBn && studentDays[dayBn]) return studentDays[dayBn]
  if (dayEn && studentDays[dayEn]) return studentDays[dayEn]
  if (dayEn) {
    const lEn = dayEn.toLowerCase()
    if (studentDays[lEn]) return studentDays[lEn]
  }
  for (const [k, v] of Object.entries(studentDays)) {
    const lk = k.toLowerCase()
    if ((lKey && lk === lKey) || (dayBn && k === dayBn) || (dayEn && lk === dayEn.toLowerCase())) {
      return v
    }
  }
  return undefined
}

function normalizeDayMarks(rawDays: Record<string, any> | undefined): Record<string, DayMarkItem> {
  if (!rawDays || typeof rawDays !== "object") return {}
  const normalized: Record<string, DayMarkItem> = {}
  for (const [k, v] of Object.entries(rawDays)) {
    const lk = k.toLowerCase()
    const matched = ALL_WEEK_DAYS.find((d) => d.id === lk || d.bn === k || d.en.toLowerCase() === lk)
    const canonicalKey = matched?.id || lk
    const item = typeof v === "object" && v !== null ? v : { marks: Number(v), total: 50, grade: "" }
    normalized[canonicalKey] = item as DayMarkItem
  }
  return normalized
}

function isClassMatch(batchStr?: string | null, studentStr?: string | null): boolean {
  if (!batchStr || !studentStr) return false
  const b = String(batchStr).trim().toLowerCase()
  const s = String(studentStr).trim().toLowerCase()
  if (b === s) return true
  if (b.includes(s) || s.includes(b)) return true

  const bnToEnMap: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" }
  const bNorm = b.replace(/[০-৯]/g, (d) => bnToEnMap[d] || d)
  const sNorm = s.replace(/[০-৯]/g, (d) => bnToEnMap[d] || d)

  const bDigitMatch = bNorm.match(/\d+/)
  const sDigitMatch = sNorm.match(/\d+/)
  if (bDigitMatch && sDigitMatch && bDigitMatch[0] === sDigitMatch[0]) return true

  const aliases: Record<string, string[]> = {
    "6": ["6", "six", "vi", "ষষ্ঠ"],
    "7": ["7", "seven", "vii", "সপ্তম"],
    "8": ["8", "eight", "viii", "অষ্টম"],
    "9": ["9", "nine", "ix", "নবম"],
    "10": ["10", "ten", "x", "দশম"],
    "11": ["11", "eleven", "xi", "একাদশ"],
    "12": ["12", "twelve", "xii", "দ্বাদশ"],
  }

  for (const group of Object.values(aliases)) {
    const bMatch = group.some((g) => bNorm.includes(g))
    const sMatch = group.some((g) => sNorm.includes(g))
    if (bMatch && sMatch) return true
  }

  return false
}

export default function ExamResultsPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [exam, setExam] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [savedResults, setSavedResults] = useState<Record<string, Result>>({})
  const [draftMarks, setDraftMarks] = useState<Record<string, string>>({})
  
  // Day-wise marks state: studentId -> dayKey -> DayMarkItem
  const [dayMarksMap, setDayMarksMap] = useState<Record<string, Record<string, DayMarkItem>>>({})
  const [publishedDays, setPublishedDays] = useState<string[]>([])
  const [isWeeklyPublished, setIsWeeklyPublished] = useState<boolean>(false)

  // Active Tab: either a day key (e.g. "saturday") or "weekly_aggregate"
  const [selectedTab, setSelectedTab] = useState<string>("")
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("")

  const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set())
  const [savingRowStudentId, setSavingRowStudentId] = useState<string | null>(null)
  const [autoSavingIds, setAutoSavingIds] = useState<Set<string>>(new Set())
  const autoSaveTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  const [draftCellMarks, setDraftCellMarks] = useState<Record<string, string>>({})
  const cellAutoSaveTimersRef = useRef<Record<string, NodeJS.Timeout>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Clean up any pending auto-save timers on unmount
  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach((t) => clearTimeout(t))
      Object.values(cellAutoSaveTimersRef.current).forEach((t) => clearTimeout(t))
    }
  }, [])

  // Quick Search & Enter State
  const [studentSearchQuery, setStudentSearchQuery] = useState("")
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [quickMarkInput, setQuickMarkInput] = useState("")
  const [savingQuickMark, setSavingQuickMark] = useState(false)

  // Batch Results Visibility
  const [showAllResults, setShowAllResults] = useState<boolean>(true)
  const [updatingVisibility, setUpdatingVisibility] = useState(false)

  // Delete Exam State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Publishing & Actions State
  const [publishingExam, setPublishingExam] = useState(false)
  const [publishingPublic, setPublishingPublic] = useState(false)
  const [publishingNotice, setPublishingNotice] = useState(false)
  const [pausingExam, setPausingExam] = useState(false)

  // Table Filter & Search State
  const [tableSearchQuery, setTableSearchQuery] = useState("")
  const [weeklySearchQuery, setWeeklySearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "entered" | "pending" | "passed" | "failed">("all")

  // Batch Selection & Students State
  const [availableBatches, setAvailableBatches] = useState<{ id: string; name: string }[]>([])
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>("auto")
  const [switchingBatch, setSwitchingBatch] = useState(false)

  // Refs for keyboard navigation
  const searchInputRef = useRef<HTMLInputElement>(null)
  const quickMarkInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const isTeacher = pathname?.includes("/dashboard/teacher")
  const backUrl = isTeacher ? "/dashboard/teacher/exams" : "/dashboard/owner/exams"

  // 1. Detect if this is a Weekly Exam (ultra resilient)
  const isWeeklyExam = useMemo(() => {
    if (!exam) return false
    if (exam.exam_schedule_type === "weekly") return true
    if (exam.is_weekly === true || exam.is_weekly_published === true) return true
    if (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) return true
    if (typeof exam.recurring_days === "string" && exam.recurring_days.trim().startsWith("[") && exam.recurring_days.trim().length > 2) return true
    if (exam.result_note?.includes("[WEEKLY_SCHEDULE:") || exam.result_note?.includes("[WEEKLY_DAYS:") || exam.result_note?.includes("[STUDENT_DAY_MARKS:")) return true
    const title = String(exam.title || "").toLowerCase()
    const subject = String(exam.subject || "").toLowerCase()
    if (title.includes("সাপ্তাহিক") || title.includes("weekly") || subject.includes("সাপ্তাহিক") || subject.includes("weekly")) return true
    if (Number(exam.total_marks) === 350 && !exam.exam_date) return true
    return ALL_WEEK_DAYS.some(
      (d) => title.includes(d.bn) || title.includes(d.id) || subject.includes(d.bn) || subject.includes(d.id)
    )
  }, [exam])

  // 2. Parse Weekly Schedule Days (GUARANTEE ALL 7 DAYS: Saturday through Friday)
  const parsedWeeklyDays = useMemo<ParsedWeeklyDay[]>(() => {
    if (!exam || !isWeeklyExam) return []

    // Collect any customized day configurations from exam.recurring_days, result_note, or title
    const dayConfigMap: Record<string, ParsedWeeklyDay> = {}

    // A. Check recurring_days column (array or stringified JSON)
    let recDays = exam.recurring_days
    if (typeof recDays === "string") {
      try {
        recDays = JSON.parse(recDays)
      } catch {}
    }

    if (Array.isArray(recDays) && recDays.length > 0) {
      for (const item of recDays) {
        const isObj = typeof item === "object" && item !== null
        const rawKey = isObj ? (item.day || item.day_bn || item.day_en || "") : item
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

    // B. Check result_note fallback tag [WEEKLY_SCHEDULE:...]
    if (exam.result_note?.includes("[WEEKLY_SCHEDULE:")) {
      try {
        const match = exam.result_note.match(/\[WEEKLY_SCHEDULE:(.*?)\]/)
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
      } catch (e) {
        console.warn("Error parsing weekly schedule fallback:", e)
      }
    }

    // C. Extract days from exam.title or exam.subject
    const textToCheck = `${exam.title || ""} ${exam.subject || ""}`
    const foundDaysInTitle = ALL_WEEK_DAYS.filter(
      (d) => textToCheck.includes(d.bn) || textToCheck.toLowerCase().includes(d.id)
    )
    if (foundDaysInTitle.length > 0) {
      const subjectList = (exam.subject || "")
        .split(/[,+;|/]/)
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

    const examTotal = Number(exam.total_marks) || 350
    const defaultDayTotal = examTotal > 0 ? Math.round(examTotal / 7) : 50
    const examPass = Number(exam.pass_marks) || 140
    const defaultDayPass = examPass > 0 ? Math.round(examPass / 7) : 20

    const subjects = (exam.subject || "")
      .split(/[,+;|/]/)
      .map((s: string) => s.trim())
      .filter(Boolean)

    // D. GUARANTEE ALL 7 DAYS: Always iterate through all 7 days of ALL_WEEK_DAYS (Saturday to Friday)
    return ALL_WEEK_DAYS.map((w, idx) => {
      if (dayConfigMap[w.id]) {
        return dayConfigMap[w.id]
      }
      const daySubject = subjects.length > idx ? subjects[idx] : (subjects.length === 1 && !subjects[0].includes("সাপ্তাহিক") ? subjects[0] : (exam.subject || ""))
      return {
        key: w.id,
        day_bn: w.bn,
        day_en: w.en,
        exam_name: daySubject && !daySubject.includes("সাপ্তাহিক") ? `${daySubject} পরীক্ষা` : `${w.bn}ের পরীক্ষা`,
        subject: daySubject,
        total_marks: defaultDayTotal,
        pass_marks: defaultDayPass,
      }
    })
  }, [exam, isWeeklyExam])

  // Active day configuration
  const activeDayConfig = useMemo<ParsedWeeklyDay | null>(() => {
    if (!isWeeklyExam || selectedTab === "weekly_aggregate") return null
    const sTabLower = (selectedTab || "").toLowerCase()
    return (
      parsedWeeklyDays.find(
        (d) =>
          d.key.toLowerCase() === sTabLower ||
          d.day_bn === selectedTab ||
          d.day_en.toLowerCase() === sTabLower
      ) || parsedWeeklyDays[0] || null
    )
  }, [isWeeklyExam, selectedTab, parsedWeeklyDays])

  // Total possible weekly marks (sum of total marks for all scheduled days)
  const totalWeeklyMaxMarks = useMemo(() => {
    if (!isWeeklyExam || parsedWeeklyDays.length === 0) return exam?.total_marks || 100
    return parsedWeeklyDays.reduce((acc, d) => acc + (d.total_marks || 0), 0)
  }, [isWeeklyExam, parsedWeeklyDays, exam])

  // Load Exam and Student Data
  useEffect(() => {
    async function load() {
      try {
        let ex: any = null
        let resolvedStudents: Student[] = []
        let apiBatches: { id: string; name: string }[] = []
        let apiResults: any[] = []

        // 1. Primary: Fetch through server API (uses admin client, bypasses RLS, resolves multi-batch & roll numbers)
        try {
          const apiRes = await fetch(`/api/exams/${params.id}`)
          if (apiRes.ok) {
            const apiData = await apiRes.json()
            if (apiData.exam) {
              ex = apiData.exam
              setExam(apiData.exam)
            }
            if (Array.isArray(apiData.students) && apiData.students.length > 0) {
              resolvedStudents = apiData.students
            }
            if (Array.isArray(apiData.batches)) {
              apiBatches = apiData.batches
              setAvailableBatches(apiData.batches)
            }
            if (Array.isArray(apiData.existing_results)) {
              apiResults = apiData.existing_results
            }
          }
        } catch (apiErr) {
          console.warn("API exam load failed, proceeding to client fallback:", apiErr)
        }

        // 2. Client fallback for exam data if API didn't load it
        if (!ex) {
          const { data: fbExam, error: exErr } = await supabase
            .from("exams")
            .select("*, batch:batches(name)")
            .eq("id", params.id)
            .single()

          if (exErr) throw exErr
          ex = fbExam
          setExam(fbExam)
        }

        const isPublic = ex?.show_all_results !== false && !ex?.result_note?.includes("[SHOW_ALL_RESULTS:false]")
        setShowAllResults(isPublic)

        // Parse published_days
        let pubDays: string[] = []
        if (Array.isArray(ex?.published_days)) {
          pubDays = ex.published_days.map((d: any) => String(d).toLowerCase())
        } else if (typeof ex?.published_days === "string" && ex.published_days.trim()) {
          try {
            const parsed = JSON.parse(ex.published_days)
            if (Array.isArray(parsed)) {
              pubDays = parsed.map((d: any) => String(d).toLowerCase())
            } else {
              pubDays = ex.published_days.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
            }
          } catch {
            pubDays = ex.published_days.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
          }
        }
        if (pubDays.length === 0 && ex?.result_note?.includes("[PUBLISHED_DAYS:")) {
          const match = ex.result_note.match(/\[PUBLISHED_DAYS:(.*?)\]/)
          if (match && match[1]) {
            pubDays = match[1].split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean)
          }
        }
        setPublishedDays(pubDays)

        // Parse is_weekly_published
        const isWPub =
          ex?.is_weekly_published === true ||
          ex?.result_note?.includes("[IS_WEEKLY_PUBLISHED:true]") ||
          (ex?.is_public_result === true && !ex?.result_note?.includes("[IS_WEEKLY_PUBLISHED:false]")) ||
          (ex?.is_published === true && !ex?.result_note?.includes("[IS_WEEKLY_PUBLISHED:false]"))
        setIsWeeklyPublished(Boolean(isWPub))

        setSelectedSessionDate(ex?.exam_date || new Date().toISOString().split("T")[0])

        // 3. Fallback: Load Students via direct Supabase client if API returned 0
        if (resolvedStudents.length === 0) {
          const targetBatches: string[] = []
          if (Array.isArray(ex?.batch_ids) && ex.batch_ids.length > 0) {
            targetBatches.push(...ex.batch_ids)
          }
          if (ex?.batch_id && !targetBatches.includes(ex.batch_id)) {
            targetBatches.push(ex.batch_id)
          }

          if (targetBatches.length > 0) {
            // Direct query of enrollments with select("*") - safe against missing columns
            const { data: enrollments } = await supabase
              .from("enrollments")
              .select("*")
              .in("batch_id", targetBatches)

            const activeEnrs = (enrollments || []).filter(
              (e: any) => !e.status || e.status === "active" || e.status === "approved" || e.status === "enrolled"
            )
            const targetEnrs = activeEnrs.length > 0 ? activeEnrs : (enrollments || [])
            const sIds = Array.from(new Set(targetEnrs.map((e: any) => e.student_id).filter(Boolean)))

            if (sIds.length > 0) {
              const { data: sData } = await supabase
                .from("students")
                .select("*")
                .in("id", sIds)

              const sMap = new Map<string, any>()
              ;(sData || []).forEach((s: any) => sMap.set(s.id, s))

              resolvedStudents = targetEnrs
                .map((e: any, idx: number) => {
                  const s = sMap.get(e.student_id)
                  if (!s) return null
                  const rNo =
                    e.roll_no != null && Number(e.roll_no) > 0
                      ? Number(e.roll_no)
                      : e.batch_roll != null && Number(e.batch_roll) > 0
                      ? Number(e.batch_roll)
                      : s.roll_no != null && Number(s.roll_no) > 0
                      ? Number(s.roll_no)
                      : s.batch_roll != null && Number(s.batch_roll) > 0
                      ? Number(s.batch_roll)
                      : idx + 1
                  return {
                    ...s,
                    roll_no: Number(rNo),
                    batch_roll: Number(rNo),
                  }
                })
                .filter(Boolean) as Student[]
            }
          }

          // Fallback only if exam had no batch assigned at all
          if (resolvedStudents.length === 0 && targetBatches.length === 0) {
            const { data: allStData } = await supabase.from("students").select("*")
            const allSt = allStData || []
            resolvedStudents = allSt.map((s: any, idx: number) => ({
              ...s,
              roll_no: s.roll_no || s.batch_roll || idx + 1,
              batch_roll: s.roll_no || s.batch_roll || idx + 1,
            }))
          }

          resolvedStudents.sort((a: Student, b: Student) => (a.roll_no || 9999) - (b.roll_no || 9999))
        }

        setStudents(resolvedStudents)

        // If availableBatches is empty, fetch batches from supabase
        if (apiBatches.length === 0) {
          let bQuery = supabase.from("batches").select("id, name, branch_id").order("name", { ascending: true })
          if (ex?.branch_id) bQuery = bQuery.eq("branch_id", ex.branch_id)
          const { data: bData } = await bQuery
          if (bData) setAvailableBatches(bData)
        }

        // 4. Load Existing Results
        let existing = apiResults
        if (existing.length === 0) {
          const { data: existingData } = await supabase
            .from("exam_results")
            .select("*")
            .eq("exam_id", params.id)
          existing = existingData || []
        }

        const map: Record<string, Result> = {}
        const dayMarks: Record<string, Record<string, DayMarkItem>> = {}

        for (const r of existing || []) {
          const markStr = String(r.obtained_marks ?? "")
          map[r.student_id] = {
            student_id: r.student_id,
            obtained_marks: markStr,
            grade: r.grade || "",
          }

          // Parse day_marks from row if available
          let sDayMarks: Record<string, DayMarkItem> = {}
          if (r.day_marks && typeof r.day_marks === "object") {
            sDayMarks = r.day_marks
          } else if (typeof r.day_marks === "string") {
            try {
              sDayMarks = JSON.parse(r.day_marks)
            } catch {}
          }
          dayMarks[r.student_id] = sDayMarks
        }

        // Also load day marks from exam.result_note fallback [STUDENT_DAY_MARKS:...]
        if (ex?.result_note?.includes("[STUDENT_DAY_MARKS:")) {
          try {
            const m = ex.result_note.match(/\[STUDENT_DAY_MARKS:(.*?)\]/)
            if (m && m[1]) {
              const parsedAll = JSON.parse(m[1])
              for (const [stId, sMap] of Object.entries(parsedAll)) {
                if (!dayMarks[stId] || Object.keys(dayMarks[stId]).length === 0) {
                  dayMarks[stId] = sMap as Record<string, DayMarkItem>
                } else {
                  // Merge days from fallback note
                  dayMarks[stId] = {
                    ...(sMap as Record<string, DayMarkItem>),
                    ...dayMarks[stId],
                  }
                }
              }
            }
          } catch (err) {
            console.warn("Could not parse exam fallback day marks:", err)
          }
        }

        // Smart Recovery for weekly exams:
        // If a student already has an obtained_mark (e.g. from Saturday's entry)
        // but dayMarks[sId] is empty, assign it to the first day so Day 1 is never lost
        const isWeekly = ex?.exam_schedule_type === "weekly" || (Array.isArray(ex?.recurring_days) && ex?.recurring_days.length > 0) || ex?.result_note?.includes("[WEEKLY_SCHEDULE:") || ex?.title?.includes("সাপ্তাহিক")
        if (isWeekly) {
          let firstKey = "saturday"
          let firstTotal = ex?.total_marks || 50
          let firstSubj = ex?.subject || ""
          let firstExamName = "পরীক্ষা"
          if (Array.isArray(ex?.recurring_days) && ex.recurring_days.length > 0) {
            const d0 = ex.recurring_days[0]
            const rawKey = typeof d0 === "object" ? (d0.day || d0.day_bn || "saturday") : d0
            firstKey = String(rawKey).toLowerCase()
            firstTotal = typeof d0 === "object" && d0.total_marks ? Number(d0.total_marks) : ex.total_marks || 50
            firstSubj = typeof d0 === "object" && d0.subject ? d0.subject : ex.subject || ""
            firstExamName = typeof d0 === "object" && d0.exam_name ? d0.exam_name : "পরীক্ষা"
          }
          for (const [sId, res] of Object.entries(map)) {
            const currentDays = dayMarks[sId] || {}
            if (Object.keys(currentDays).length === 0 && res.obtained_marks !== "" && !isNaN(parseFloat(res.obtained_marks))) {
              const numVal = parseFloat(res.obtained_marks)
              dayMarks[sId] = {
                [firstKey]: {
                  marks: numVal,
                  total: firstTotal,
                  grade: res.grade || getGrade(numVal, firstTotal),
                  subject: firstSubj,
                  exam_name: firstExamName,
                }
              }
            }
          }
        }

        setSavedResults(map)
        setDayMarksMap(dayMarks)
      } catch (err: any) {
        console.error("Error loading exam results:", err)
        toast.error("Failed to load exam data")
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [params.id, supabase])

  // Switch Target Batch or View All Students
  async function handleSwitchBatch(batchId: string) {
    setSelectedBatchFilter(batchId)
    setSwitchingBatch(true)
    try {
      const url =
        batchId === "all"
          ? `/api/exams/${params.id}?batch_id=all`
          : batchId === "auto"
          ? `/api/exams/${params.id}`
          : `/api/exams/${params.id}?batch_id=${batchId}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.students) && data.students.length > 0) {
          setStudents(data.students)
          toast.success(`✓ ${data.students.length} জন শিক্ষার্থী লোড করা হয়েছে`)
          return
        }
      }

      // Fallback: Query directly from client Supabase
      const { data: allSt } = await supabase.from("students").select("*")
      if (allSt && allSt.length > 0) {
        let matched: any[] = []
        if (batchId === "all") {
          matched = allSt
        } else {
          const targetBIds: string[] = []
          if (batchId !== "auto") {
            targetBIds.push(batchId)
          } else {
            if (exam?.batch_id) targetBIds.push(exam.batch_id)
            if (Array.isArray(exam?.batch_ids)) targetBIds.push(...exam.batch_ids)
          }

          if (targetBIds.length > 0) {
            const { data: enrs } = await supabase.from("enrollments").select("*").in("batch_id", targetBIds)
            const activeEnrs = (enrs || []).filter((e: any) => e.status !== "inactive" && e.status !== "transferred")
            const sIds = new Set(activeEnrs.map((e: any) => e.student_id).filter(Boolean))
            matched = allSt.filter((s: any) => sIds.has(s.id))
          } else {
            matched = allSt
          }
        }

        const fallbackResolved: Student[] = matched.map((s: any, idx: number) => ({
          ...s,
          roll_no: s.roll_no || s.batch_roll || idx + 1,
          batch_roll: s.roll_no || s.batch_roll || idx + 1,
        }))
        fallbackResolved.sort((a, b) => (a.roll_no || 9999) - (b.roll_no || 9999))
        setStudents(fallbackResolved)
        if (fallbackResolved.length > 0) {
          toast.success(`✓ ${fallbackResolved.length} জন শিক্ষার্থী লোড করা হয়েছে`)
        } else {
          toast.info("এই ব্যাচে কোনো শিক্ষার্থী পাওয়া যায়নি")
        }
      } else {
        toast.error("শিক্ষার্থী লোড করতে সমস্যা হয়েছে")
      }
    } catch {
      toast.error("শিক্ষার্থী লোড করতে সমস্যা হয়েছে")
    } finally {
      setSwitchingBatch(false)
    }
  }

  // Initialize selectedTab once parsedWeeklyDays is available
  useEffect(() => {
    if (parsedWeeklyDays.length > 0 && !selectedTab) {
      setSelectedTab(parsedWeeklyDays[0].key)
    }
  }, [parsedWeeklyDays, selectedTab])

  // Sync draft marks whenever selectedTab or active day changes
  useEffect(() => {
    if (fetching) return

    if (!isWeeklyExam || selectedTab === "weekly_aggregate") {
      const drafts: Record<string, string> = {}
      for (const s of students) {
        drafts[s.id] = savedResults[s.id]?.obtained_marks ?? ""
      }
      setDraftMarks(drafts)
      return
    }

    const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
    const drafts: Record<string, string> = {}
    for (const s of students) {
      const studentDays = dayMarksMap[s.id]
      const dMark = getDayMarkItem(studentDays, activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)
      drafts[s.id] = dMark && !isNaN(Number(dMark.marks)) ? String(dMark.marks) : ""
    }
    setDraftMarks(drafts)
  }, [selectedTab, isWeeklyExam, students, fetching, activeDayConfig?.key])

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter students for Quick Search dropdown
  const filteredSearchStudents = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase()
    if (!q) return students.slice(0, 8)
    return students.filter((s) => {
      const nameMatch = (s.name || "").toLowerCase().includes(q)
      const idMatch = (s.student_id || "").toLowerCase().includes(q)
      const phoneMatch = (s.phone || "").includes(q)
      const rollStr = String(s.roll_no || "")
      const rollMatch = rollStr === q || `roll ${rollStr}`.includes(q) || `roll #${rollStr}`.includes(q)
      return nameMatch || idMatch || phoneMatch || rollMatch
    })
  }, [students, studentSearchQuery])

  // Select student in Quick Entry
  function handleSelectStudent(student: Student) {
    setSelectedStudent(student)
    setIsSearchDropdownOpen(false)
    setStudentSearchQuery("")

    const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
    const dayObj = isWeeklyExam && selectedTab !== "weekly_aggregate"
      ? getDayMarkItem(dayMarksMap[student.id], activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)
      : null
    const existing = isWeeklyExam && selectedTab !== "weekly_aggregate"
      ? (draftMarks[student.id] || (dayObj && !isNaN(Number(dayObj.marks)) ? String(dayObj.marks) : ""))
      : (draftMarks[student.id] || savedResults[student.id]?.obtained_marks || "")
    setQuickMarkInput(existing)

    setTimeout(() => {
      quickMarkInputRef.current?.focus()
      quickMarkInputRef.current?.select()
    }, 50)
  }

  // Auto-sync overall ranks strictly descending
  async function syncAllRanks(currentMarksMap: Record<string, string>) {
    if (!exam) return
    try {
      const maxTotal = isWeeklyExam ? totalWeeklyMaxMarks : exam.total_marks
      const items = students
        .map((s) => {
          const raw = currentMarksMap[s.id]?.trim() ?? savedResults[s.id]?.obtained_marks ?? ""
          const m = parseFloat(raw)
          return { student_id: s.id, marks: m }
        })
        .filter((x) => !isNaN(x.marks) && x.marks >= 0 && x.marks <= maxTotal)
        .sort((a, b) => b.marks - a.marks)

      let curR = 1
      const updates = items.map((item, i) => {
        if (i > 0 && item.marks < items[i - 1].marks) {
          curR = i + 1
        }
        return {
          exam_id: exam.id,
          student_id: item.student_id,
          obtained_marks: item.marks,
          grade: getGrade(item.marks, maxTotal),
          rank: curR,
        }
      })

      if (updates.length > 0) {
        await supabase.from("exam_results").upsert(updates, { onConflict: "exam_id,student_id" })
      }
    } catch (e) {
      console.warn("Rank sync note:", e)
    }
  }

  // Save specific day mark for a student (works from breakdown table or day view)
  async function saveStudentDayMark(student: Student, day: ParsedWeeklyDay, rawMark: string, silent?: boolean) {
    if (!exam) return
    const raw = rawMark.trim()
    if (raw === "") return

    const numMarks = parseFloat(raw)
    const dayMax = day.total_marks || 50
    if (isNaN(numMarks) || numMarks < 0 || numMarks > dayMax) {
      if (!silent) toast.error(`নম্বরটি অবশ্যই 0 থেকে ${dayMax}-এর মধ্যে হতে হবে`)
      return
    }

    const dayGrade = getGrade(numMarks, dayMax)
    const activeKey = day.key.toLowerCase()

    const currentStudentDays = normalizeDayMarks(dayMarksMap[student.id])
    currentStudentDays[activeKey] = {
      marks: numMarks,
      total: dayMax,
      grade: dayGrade,
      subject: day.subject,
      exam_name: day.exam_name,
    }

    const grandTotal = Object.values(currentStudentDays).reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
    const overallGrade = getGrade(grandTotal, totalWeeklyMaxMarks)

    const updatedAllDayMarks = {
      ...dayMarksMap,
      [student.id]: currentStudentDays,
    }

    try {
      const res = await fetch(`/api/exams/${exam.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: student.id,
          obtained_marks: grandTotal,
          grade: overallGrade,
          day_marks: currentStudentDays,
          all_day_marks: updatedAllDayMarks,
        }),
      })

      if (!res.ok) {
        const payload: any = {
          exam_id: exam.id,
          student_id: student.id,
          obtained_marks: grandTotal,
          grade: overallGrade,
          day_marks: currentStudentDays,
        }
        let { error } = await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
        if (error) {
          delete payload.day_marks
          await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
        }
        try {
          const curNote = exam.result_note || ""
          const newNote = curNote.replace(/\[STUDENT_DAY_MARKS:[^\]]*\]/g, "").trim() + ` [STUDENT_DAY_MARKS:${JSON.stringify(updatedAllDayMarks)}]`
          await supabase.from("exams").update({ result_note: newNote }).eq("id", exam.id)
        } catch {}
      }

      setDayMarksMap((prev) => ({
        ...prev,
        [student.id]: currentStudentDays,
      }))
      setSavedResults((prev) => ({
        ...prev,
        [student.id]: {
          student_id: student.id,
          obtained_marks: String(grandTotal),
          grade: overallGrade,
        },
      }))
      setDraftCellMarks((prev) => ({
        ...prev,
        [`${student.id}_${activeKey}`]: String(numMarks),
      }))
      if (activeDayConfig?.key.toLowerCase() === activeKey) {
        setDraftMarks((prev) => ({
          ...prev,
          [student.id]: String(numMarks),
        }))
      }
      setJustSavedIds((prev) => new Set(prev).add(student.id))

      if (!silent) {
        toast.success(`✓ ${student.name} (${day.day_bn}): ${numMarks}/${dayMax} সংরক্ষিত!`)
      }
    } catch (err: any) {
      console.error("Save day mark error:", err)
      if (!silent) toast.error(err.message || "Failed to save mark")
    }
  }

  // Handle cell mark typing with debounce in the breakdown table
  function handleCellMarkChange(student: Student, day: ParsedWeeklyDay, newVal: string) {
    const cellKey = `${student.id}_${day.key.toLowerCase()}`
    setDraftCellMarks((prev) => ({ ...prev, [cellKey]: newVal }))

    if (cellAutoSaveTimersRef.current[cellKey]) {
      clearTimeout(cellAutoSaveTimersRef.current[cellKey])
      delete cellAutoSaveTimersRef.current[cellKey]
    }

    const trimmed = newVal.trim()
    if (trimmed === "") return

    const dObj = getDayMarkItem(dayMarksMap[student.id], day.key, day.day_bn, day.day_en)
    const savedVal = dObj && !isNaN(Number(dObj.marks)) ? String(dObj.marks) : ""
    if (trimmed === savedVal) return

    const num = parseFloat(trimmed)
    const dayMax = day.total_marks || 50
    if (!isNaN(num) && num >= 0 && num <= dayMax) {
      cellAutoSaveTimersRef.current[cellKey] = setTimeout(() => {
        saveStudentDayMark(student, day, trimmed, true)
      }, 700)
    }
  }

  // Handle cell mark blur for instantaneous auto-save
  function handleCellMarkBlur(student: Student, day: ParsedWeeklyDay) {
    const cellKey = `${student.id}_${day.key.toLowerCase()}`
    if (cellAutoSaveTimersRef.current[cellKey]) {
      clearTimeout(cellAutoSaveTimersRef.current[cellKey])
      delete cellAutoSaveTimersRef.current[cellKey]
    }

    const draftVal = draftCellMarks[cellKey]?.trim()
    if (draftVal === undefined || draftVal === "") return

    const dObj = getDayMarkItem(dayMarksMap[student.id], day.key, day.day_bn, day.day_en)
    const savedVal = dObj && !isNaN(Number(dObj.marks)) ? String(dObj.marks) : ""
    if (draftVal !== savedVal) {
      saveStudentDayMark(student, day, draftVal, true)
    }
  }

  // Save All Days at once from the breakdown table
  async function handleSaveAllDays() {
    if (!exam || !isWeeklyExam) return
    setLoading(true)
    try {
      const batchUpdates: any[] = []
      const nextDayMarksMap: Record<string, Record<string, DayMarkItem>> = { ...dayMarksMap }

      for (const s of students) {
        let hasChanges = false
        const sDays = normalizeDayMarks(nextDayMarksMap[s.id])

        for (const d of parsedWeeklyDays) {
          const dayKey = d.key.toLowerCase()
          const cellKey = `${s.id}_${dayKey}`
          const draftVal = draftCellMarks[cellKey]?.trim()
          if (draftVal !== undefined && draftVal !== "") {
            const num = parseFloat(draftVal)
            const dayMax = d.total_marks || 50
            if (!isNaN(num) && num >= 0 && num <= dayMax) {
              sDays[dayKey] = {
                marks: num,
                total: dayMax,
                grade: getGrade(num, dayMax),
                subject: d.subject,
                exam_name: d.exam_name,
              }
              hasChanges = true
            }
          }
        }

        if (hasChanges || Object.keys(sDays).length > 0) {
          nextDayMarksMap[s.id] = sDays
          const grandTotal = Object.values(sDays).reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
          const overallGrade = getGrade(grandTotal, totalWeeklyMaxMarks)

          batchUpdates.push({
            student_id: s.id,
            obtained_marks: grandTotal,
            grade: overallGrade,
            day_marks: sDays,
          })
        }
      }

      if (batchUpdates.length === 0) {
        toast.info("সংরক্ষণের জন্য কোনো নতুন নম্বর নেই (No new marks to save)")
        return
      }

      const res = await fetch(`/api/exams/${exam.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_updates: batchUpdates,
          all_day_marks: nextDayMarksMap,
        }),
      })

      if (!res.ok) {
        // Client fallback upsert directly into Supabase
        for (const u of batchUpdates) {
          const payload: any = {
            exam_id: exam.id,
            student_id: u.student_id,
            obtained_marks: u.obtained_marks,
            grade: u.grade,
            day_marks: u.day_marks,
          }
          let { error } = await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
          if (error) {
            delete payload.day_marks
            await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
          }
        }
        try {
          const curNote = exam.result_note || ""
          const newNote = curNote.replace(/\[STUDENT_DAY_MARKS:[^\]]*\]/g, "").trim() + ` [STUDENT_DAY_MARKS:${JSON.stringify(nextDayMarksMap)}]`
          await supabase.from("exams").update({ result_note: newNote }).eq("id", exam.id)
        } catch {}
      }

      setDayMarksMap(nextDayMarksMap)
      setSavedResults((prev) => {
        const next = { ...prev }
        for (const u of batchUpdates) {
          next[u.student_id] = {
            student_id: u.student_id,
            obtained_marks: String(u.obtained_marks),
            grade: u.grade,
          }
        }
        return next
      })

      // Sync draftCellMarks with all saved marks across all days
      setDraftCellMarks((prev) => {
        const next = { ...prev }
        for (const s of students) {
          if (nextDayMarksMap[s.id]) {
            for (const [dKey, item] of Object.entries(nextDayMarksMap[s.id])) {
              if (item && !isNaN(Number(item.marks))) {
                next[`${s.id}_${dKey}`] = String(item.marks)
              }
            }
          }
        }
        return next
      })

      setJustSavedIds((prev) => {
        const next = new Set(prev)
        for (const u of batchUpdates) next.add(u.student_id)
        return next
      })

      toast.success(`✓ সকল ৭ দিনের নম্বর সফলভাবে সংরক্ষিত হয়েছে! (${batchUpdates.length} জন শিক্ষার্থী)`)
    } catch (err: any) {
      toast.error(err.message || "Failed to save all days")
    } finally {
      setLoading(false)
    }
  }

  // Save single student mark (with optional silent mode for auto-save)
  async function saveStudentMark(student: Student, rawMark: string, rowIndex?: number, silent?: boolean) {
    if (!exam) return
    const raw = rawMark.trim()
    if (raw === "") {
      if (!silent) toast.error("অনুগ্রহ করে একটি নম্বর লিখুন (Please enter a mark)")
      return
    }

    const numMarks = parseFloat(raw)
    const activeMax = isWeeklyExam
      ? (selectedTab === "weekly_aggregate" ? totalWeeklyMaxMarks : (activeDayConfig?.total_marks || 50))
      : (exam.total_marks || 100)

    if (isNaN(numMarks) || numMarks < 0 || numMarks > activeMax) {
      if (!silent) toast.error(`নম্বরটি অবশ্যই 0 থেকে ${activeMax}-এর মধ্যে হতে হবে (সর্বোচ্চ: ${activeMax})`)
      return
    }

    const dayGrade = getGrade(numMarks, activeMax)

    if (isWeeklyExam && activeDayConfig && selectedTab !== "weekly_aggregate") {
      const activeKey = (activeDayConfig.key || selectedTab).toLowerCase()
      const currentStudentDays = normalizeDayMarks(dayMarksMap[student.id])
      currentStudentDays[activeKey] = {
        marks: numMarks,
        total: activeMax,
        grade: dayGrade,
        subject: activeDayConfig.subject,
        exam_name: activeDayConfig.exam_name,
      }

      const grandTotal = Object.values(currentStudentDays).reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
      const overallGrade = getGrade(grandTotal, totalWeeklyMaxMarks)

      const updatedAllDayMarks = {
        ...dayMarksMap,
        [student.id]: currentStudentDays,
      }

      try {
        // Save via our server API endpoint for guaranteed admin persistence of day_marks & fallback notes
        const res = await fetch(`/api/exams/${exam.id}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: student.id,
            obtained_marks: grandTotal,
            grade: overallGrade,
            day_marks: currentStudentDays,
            all_day_marks: updatedAllDayMarks,
          }),
        })

        if (!res.ok) {
          const payload: any = {
            exam_id: exam.id,
            student_id: student.id,
            obtained_marks: grandTotal,
            grade: overallGrade,
            day_marks: currentStudentDays,
          }
          let { error } = await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
          if (error) {
            delete payload.day_marks
            await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
          }
          try {
            const curNote = exam.result_note || ""
            const newNote = curNote.replace(/\[STUDENT_DAY_MARKS:[^\]]*\]/g, "").trim() + ` [STUDENT_DAY_MARKS:${JSON.stringify(updatedAllDayMarks)}]`
            await supabase.from("exams").update({ result_note: newNote }).eq("id", exam.id)
          } catch {}
        }

        setDayMarksMap((prev) => ({
          ...prev,
          [student.id]: currentStudentDays,
        }))
        setSavedResults((prev) => ({
          ...prev,
          [student.id]: {
            student_id: student.id,
            obtained_marks: String(grandTotal),
            grade: overallGrade,
          },
        }))
        setDraftMarks((prev) => ({
          ...prev,
          [student.id]: String(numMarks),
        }))
        setDraftCellMarks((prev) => ({
          ...prev,
          [`${student.id}_${activeKey}`]: String(numMarks),
        }))
        setJustSavedIds((prev) => new Set(prev).add(student.id))

        if (!silent) {
          toast.success(`✓ ${student.name} (${activeDayConfig.day_bn}): ${numMarks}/${activeMax} (${dayGrade}) সংরক্ষিত!`)
        }

        if (rowIndex !== undefined) {
          const nextInput = document.getElementById(`mark-input-${rowIndex + 1}`) as HTMLInputElement | null
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }
      } catch (err: any) {
        console.error("Save error:", err)
        if (!silent) toast.error(err.message || "Failed to save mark")
      }
    } else {
      const grade = getGrade(numMarks, activeMax)
      try {
        const res = await fetch(`/api/exams/${exam.id}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: student.id,
            obtained_marks: numMarks,
            grade: grade,
          }),
        })

        if (!res.ok) {
          const { error } = await supabase.from("exam_results").upsert(
            {
              exam_id: exam.id,
              student_id: student.id,
              obtained_marks: numMarks,
              grade: grade,
            },
            { onConflict: "exam_id,student_id" }
          )
          if (error) throw error
        }

        setSavedResults((prev) => ({
          ...prev,
          [student.id]: {
            student_id: student.id,
            obtained_marks: String(numMarks),
            grade,
          },
        }))
        setDraftMarks((prev) => ({
          ...prev,
          [student.id]: String(numMarks),
        }))
        setJustSavedIds((prev) => new Set(prev).add(student.id))
        syncAllRanks({ ...draftMarks, [student.id]: String(numMarks) })

        if (!silent) {
          toast.success(`✓ ${student.name}: ${numMarks}/${activeMax} (${grade}) সংরক্ষিত!`)
        }

        if (rowIndex !== undefined) {
          const nextInput = document.getElementById(`mark-input-${rowIndex + 1}`) as HTMLInputElement | null
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }
      } catch (err: any) {
        if (!silent) toast.error(err.message || "Failed to save mark")
      }
    }
  }

  // Auto-save mark for a student with debounce or onBlur
  async function triggerAutoSave(student: Student, rawMark: string) {
    const trimmed = rawMark.trim()
    if (trimmed === "") return
    const num = parseFloat(trimmed)
    const activeMax = isWeeklyExam
      ? (selectedTab === "weekly_aggregate" ? totalWeeklyMaxMarks : (activeDayConfig?.total_marks || 50))
      : (exam?.total_marks || 100)
    if (isNaN(num) || num < 0 || num > activeMax) return

    setAutoSavingIds((prev) => new Set(prev).add(student.id))
    try {
      await saveStudentMark(student, trimmed, undefined, true)
    } finally {
      setAutoSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(student.id)
        return next
      })
    }
  }

  // Handle live mark input typing with 700ms debounce auto-save
  function handleMarkInputChange(student: Student, newVal: string) {
    setDraftMarks((prev) => ({ ...prev, [student.id]: newVal }))

    if (autoSaveTimersRef.current[student.id]) {
      clearTimeout(autoSaveTimersRef.current[student.id])
      delete autoSaveTimersRef.current[student.id]
    }

    const trimmed = newVal.trim()
    if (trimmed === "") return

    const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
    const savedVal = isWeeklyExam && selectedTab !== "weekly_aggregate"
      ? (getDayMarkItem(dayMarksMap[student.id], activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)?.marks?.toString() ?? "")
      : (savedResults[student.id]?.obtained_marks?.toString() ?? "")

    if (trimmed === savedVal) return

    const num = parseFloat(trimmed)
    const activeMax = isWeeklyExam
      ? (selectedTab === "weekly_aggregate" ? totalWeeklyMaxMarks : (activeDayConfig?.total_marks || 50))
      : (exam?.total_marks || 100)

    if (!isNaN(num) && num >= 0 && num <= activeMax) {
      autoSaveTimersRef.current[student.id] = setTimeout(() => {
        triggerAutoSave(student, trimmed)
      }, 700)
    }
  }

  // Handle input blur for instantaneous auto-save
  function handleMarkInputBlur(student: Student) {
    if (autoSaveTimersRef.current[student.id]) {
      clearTimeout(autoSaveTimersRef.current[student.id])
      delete autoSaveTimersRef.current[student.id]
    }

    const currentVal = draftMarks[student.id]?.trim() ?? ""
    if (currentVal === "") return

    const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
    const savedVal = isWeeklyExam && selectedTab !== "weekly_aggregate"
      ? (getDayMarkItem(dayMarksMap[student.id], activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)?.marks?.toString() ?? "")
      : (savedResults[student.id]?.obtained_marks?.toString() ?? "")

    if (currentVal !== savedVal) {
      const num = parseFloat(currentVal)
      const activeMax = isWeeklyExam
        ? (selectedTab === "weekly_aggregate" ? totalWeeklyMaxMarks : (activeDayConfig?.total_marks || 50))
        : (exam?.total_marks || 100)
      if (isNaN(num) || num < 0 || num > activeMax) {
        toast.error(`নম্বরটি অবশ্যই 0 থেকে ${activeMax}-এর মধ্যে হতে হবে`)
        return
      }
      triggerAutoSave(student, currentVal)
    }
  }

  // Quick mark save handler
  async function handleSaveQuickMark() {
    if (!selectedStudent) return
    const num = parseFloat(quickMarkInput)
    if (isNaN(num) || num < 0 || num > activeTotalMarks) {
      toast.error(`নম্বরটি অবশ্যই 0 থেকে ${activeTotalMarks}-এর মধ্যে হতে হবে`)
      return
    }
    setSavingQuickMark(true)
    try {
      await saveStudentMark(selectedStudent, quickMarkInput)
      setSelectedStudent(null)
      setQuickMarkInput("")
      setStudentSearchQuery("")
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } finally {
      setSavingQuickMark(false)
    }
  }

  // Save an individual row from table
  async function saveRowMark(student: Student, rowIndex?: number) {
    const raw = draftMarks[student.id] ?? ""
    const num = parseFloat(raw)
    if (isNaN(num) || num < 0 || num > activeTotalMarks) {
      toast.error(`নম্বরটি অবশ্যই 0 থেকে ${activeTotalMarks}-এর মধ্যে হতে হবে`)
      return
    }
    setSavingRowStudentId(student.id)
    try {
      await saveStudentMark(student, raw, rowIndex)
    } finally {
      setSavingRowStudentId(null)
    }
  }

  // Clear student mark
  async function clearStudentMark(studentId: string, studentName: string) {
    if (!exam) return

    if (isWeeklyExam && activeDayConfig && selectedTab !== "weekly_aggregate") {
      if (!confirm(`Are you sure you want to clear ${activeDayConfig.day_bn} mark for ${studentName}?`)) return
      try {
        const activeKey = (activeDayConfig.key || selectedTab).toLowerCase()
        const currentStudentDays = { ...(dayMarksMap[studentId] || {}) }
        delete currentStudentDays[activeKey]
        delete currentStudentDays[activeDayConfig.key]
        if (activeDayConfig.day_bn) delete currentStudentDays[activeDayConfig.day_bn]
        if (activeDayConfig.day_en) delete currentStudentDays[activeDayConfig.day_en.toLowerCase()]

        const remainingValues = Object.values(currentStudentDays)
        const grandTotal = remainingValues.reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
        const overallGrade = remainingValues.length > 0 ? getGrade(grandTotal, totalWeeklyMaxMarks) : ""

        const updatedAllDayMarks = {
          ...dayMarksMap,
          [studentId]: currentStudentDays,
        }

        await fetch(`/api/exams/${exam.id}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            obtained_marks: grandTotal,
            grade: overallGrade,
            day_marks: currentStudentDays,
            all_day_marks: updatedAllDayMarks,
          }),
        })

        if (remainingValues.length === 0) {
          await supabase.from("exam_results").delete().eq("exam_id", exam.id).eq("student_id", studentId)
          setSavedResults((prev) => {
            const next = { ...prev }
            delete next[studentId]
            return next
          })
        } else {
          setSavedResults((prev) => ({
            ...prev,
            [studentId]: {
              student_id: studentId,
              obtained_marks: String(grandTotal),
              grade: overallGrade,
            },
          }))
        }

        setDayMarksMap((prev) => ({
          ...prev,
          [studentId]: currentStudentDays,
        }))
        setDraftMarks((prev) => ({
          ...prev,
          [studentId]: "",
        }))
        setJustSavedIds((prev) => {
          const next = new Set(prev)
          next.delete(studentId)
          return next
        })

        toast.success(`Cleared ${activeDayConfig.day_bn} mark for ${studentName}`)
      } catch (err: any) {
        console.error("Clear mark error:", err)
        toast.error("Failed to clear mark")
      }
      return
    }

    if (!confirm(`Are you sure you want to clear results for ${studentName}?`)) return
    try {
      await supabase.from("exam_results").delete().eq("exam_id", exam.id).eq("student_id", studentId)
      setSavedResults((prev) => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
      setDayMarksMap((prev) => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
      setDraftMarks((prev) => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
      setJustSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(studentId)
        return next
      })
      toast.success(`Cleared results for ${studentName}`)
    } catch (err: any) {
      toast.error("Failed to clear result")
    }
  }

  // Save All entered marks at once
  async function handleSaveAll() {
    if (!exam) return
    setLoading(true)
    try {
      if (isWeeklyExam && activeDayConfig && selectedTab !== "weekly_aggregate") {
        const activeKey = (activeDayConfig.key || selectedTab).toLowerCase()
        const activeMax = activeDayConfig.total_marks
        const batchUpdates: any[] = []
        const nextDayMarksMap: Record<string, Record<string, DayMarkItem>> = { ...dayMarksMap }

        for (const s of students) {
          const raw = draftMarks[s.id]?.trim()
          if (raw && raw !== "") {
            const numMarks = parseFloat(raw)
            if (!isNaN(numMarks) && numMarks >= 0 && numMarks <= activeMax) {
              const dayGrade = getGrade(numMarks, activeMax)
              const sDays = normalizeDayMarks(nextDayMarksMap[s.id])
              sDays[activeKey] = {
                marks: numMarks,
                total: activeMax,
                grade: dayGrade,
                subject: activeDayConfig.subject,
                exam_name: activeDayConfig.exam_name,
              }
              nextDayMarksMap[s.id] = sDays
              const grandTotal = Object.values(sDays).reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
              const overallGrade = getGrade(grandTotal, totalWeeklyMaxMarks)

              batchUpdates.push({
                student_id: s.id,
                obtained_marks: grandTotal,
                grade: overallGrade,
                day_marks: sDays,
              })
            }
          }
        }

        if (batchUpdates.length === 0) {
          toast.error("কোনো বৈধ নম্বর পাওয়া যায়নি (No valid marks to save)")
          return
        }

        const res = await fetch(`/api/exams/${exam.id}/results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batch_updates: batchUpdates,
            all_day_marks: nextDayMarksMap,
          }),
        })

        if (!res.ok) {
          for (const u of batchUpdates) {
            const payload: any = {
              exam_id: exam.id,
              student_id: u.student_id,
              obtained_marks: u.obtained_marks,
              grade: u.grade,
              day_marks: u.day_marks,
            }
            let { error } = await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
            if (error) {
              delete payload.day_marks
              await supabase.from("exam_results").upsert(payload, { onConflict: "exam_id,student_id" })
            }
          }
          try {
            const curNote = exam.result_note || ""
            const newNote = curNote.replace(/\[STUDENT_DAY_MARKS:[^\]]*\]/g, "").trim() + ` [STUDENT_DAY_MARKS:${JSON.stringify(nextDayMarksMap)}]`
            await supabase.from("exams").update({ result_note: newNote }).eq("id", exam.id)
          } catch {}
        }

        setDayMarksMap(nextDayMarksMap)
        setSavedResults((prev) => {
          const next = { ...prev }
          for (const u of batchUpdates) {
            next[u.student_id] = {
              student_id: u.student_id,
              obtained_marks: String(u.obtained_marks),
              grade: u.grade,
            }
          }
          return next
        })

        // Sync draftCellMarks
        setDraftCellMarks((prev) => {
          const next = { ...prev }
          for (const u of batchUpdates) {
            if (u.day_marks) {
              for (const [dKey, item] of Object.entries(u.day_marks)) {
                if (item && !isNaN(Number((item as any).marks))) {
                  next[`${u.student_id}_${dKey}`] = String((item as any).marks)
                }
              }
            }
          }
          return next
        })

        setJustSavedIds((prev) => {
          const next = new Set(prev)
          for (const u of batchUpdates) next.add(u.student_id)
          return next
        })
        toast.success(`✓ ${batchUpdates.length} জন শিক্ষার্থীর নম্বর সফলভাবে সংরক্ষিত হয়েছে!`)
      } else {
        let savedCount = 0
        for (let i = 0; i < students.length; i++) {
          const s = students[i]
          const raw = draftMarks[s.id]?.trim()
          if (raw && raw !== "") {
            await saveStudentMark(s, raw)
            savedCount++
          }
        }
        toast.success(`Results saved for ${savedCount} students!`)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save all")
    } finally {
      setLoading(false)
    }
  }

  // Publish / Unpublish Individual Day Result (For Batch Students)
  async function handleTogglePublishDay(dayKey: string) {
    if (!exam) return
    const isCurrentlyPub = publishedDays.includes(dayKey.toLowerCase())
    const nextPubDays = isCurrentlyPub
      ? publishedDays.filter((d) => d.toLowerCase() !== dayKey.toLowerCase())
      : [...publishedDays, dayKey.toLowerCase()]

    const shouldBePublished = nextPubDays.length > 0 || isWeeklyPublished

    setPublishingExam(true)
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          published_days: nextPubDays,
          is_published: shouldBePublished,
        }),
      })

      if (!res.ok) {
        const updatedNote = (exam.result_note || "")
          .replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "")
          .trim() + ` [PUBLISHED_DAYS:${nextPubDays.join(",")}]`
        await supabase.from("exams").update({ 
          result_note: updatedNote, 
          is_published: shouldBePublished,
        }).eq("id", params.id)
      }

      setPublishedDays(nextPubDays)
      setExam((prev: any) => ({ 
        ...prev, 
        published_days: nextPubDays, 
        is_published: shouldBePublished,
      }))
      const matched = ALL_WEEK_DAYS.find((d) => d.id === dayKey.toLowerCase())
      const dayName = matched?.bn || dayKey
      toast.success(
        !isCurrentlyPub
          ? `✓ ${dayName}ের ফলাফল ব্যাচ শিক্ষার্থীদের জন্য প্রকাশিত হয়েছে! শিক্ষার্থীরা তাদের প্রোফাইলে দেখতে পারবে।`
          : `${dayName}ের ফলাফল ড্রাফট করা হয়েছে।`
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to update day publish status")
    } finally {
      setPublishingExam(false)
    }
  }

  // Publish / Unpublish Consolidated Weekly Result (For Batch Students)
  async function handleTogglePublishWeekly(nextVal: boolean) {
    setPublishingExam(true)
    const isPub = nextVal || publishedDays.length > 0
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          is_weekly_published: nextVal,
          is_published: isPub,
        }),
      })

      if (!res.ok) {
        const updatedNote = (exam.result_note || "")
          .replace(/\[IS_WEEKLY_PUBLISHED:[^\]]*\]/g, "")
          .trim() + ` [IS_WEEKLY_PUBLISHED:${nextVal}]`
        await supabase.from("exams").update({ 
          result_note: updatedNote,
          is_weekly_published: nextVal,
          is_published: isPub,
        }).eq("id", params.id)
      }

      setIsWeeklyPublished(nextVal)
      setExam((prev: any) => ({ 
        ...prev, 
        is_weekly_published: nextVal, 
        is_published: isPub,
      }))
      toast.success(
        nextVal
          ? "✓ সামগ্রিক সাপ্তাহিক ফলাফল ব্যাচ শিক্ষার্থীদের জন্য প্রকাশিত হয়েছে! শিক্ষার্থীরা তাদের প্রোফাইলে দেখতে পারবে।"
          : "সাপ্তাহিক সামগ্রিক ফলাফল ড্রাফট করা হয়েছে।"
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to publish weekly results")
    } finally {
      setPublishingExam(false)
    }
  }

  // Publish Exam (One-time exam - For Batch Students)
  async function handleTogglePublishOneTime(nextPublished: boolean) {
    setPublishingExam(true)
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          is_published: nextPublished,
        }),
      })
      if (!res.ok) {
        const updatedNote = (exam?.result_note || "")
          .replace(/\[BATCH_PUBLISHED:[^\]]*\]/g, "")
          .trim() + ` [BATCH_PUBLISHED:${nextPublished}]`
        await supabase.from("exams").update({ 
          is_published: nextPublished,
          result_note: updatedNote
        }).eq("id", params.id)
      }
      setExam((prev: any) => ({ 
        ...prev, 
        is_published: nextPublished,
      }))
      toast.success(
        nextPublished 
          ? "✓ এককালীন পরীক্ষার ফলাফল ব্যাচ শিক্ষার্থীদের জন্য প্রকাশিত হয়েছে! শিক্ষার্থীরা তাদের প্রোফাইলে দেখতে পারবে।" 
          : "ফলাফল ড্রাফট করা হয়েছে।"
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to update publish status")
    } finally {
      setPublishingExam(false)
    }
  }

  // Toggle Public Online Result (For Homepage & Public /online-result portal)
  async function handleTogglePublicResult(nextPublic: boolean) {
    setPublishingPublic(true)
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          is_public_result: nextPublic,
        }),
      })
      if (!res.ok) {
        const updatedNote = (exam?.result_note || "")
          .replace(/\[PUBLIC_RESULT:[^\]]*\]/g, "")
          .trim() + ` [PUBLIC_RESULT:${nextPublic}]`
        await supabase.from("exams").update({ 
          is_public_result: nextPublic,
          result_note: updatedNote.trim(),
        }).eq("id", params.id)
      }
      setExam((prev: any) => ({ 
        ...prev, 
        is_public_result: nextPublic,
      }))
      toast.success(
        nextPublic
          ? "✓ মেরিট লিস্ট এখন পাবলিক! হোমপেজ এবং অনলাইন রেজাল্ট পোর্টালে দৃশ্যমান।"
          : "মেরিট লিস্ট পাবলিক পোর্টাল থেকে অপসারিত হয়েছে (তবে ব্যাচ শিক্ষার্থীরা প্রোফাইলে দেখতে পারবে)।"
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to update public status")
    } finally {
      setPublishingPublic(false)
    }
  }

  // Publish Notice Board Announcement
  async function handlePublishNotice() {
    setPublishingNotice(true)
    try {
      const isWeeklyTab = selectedTab === "weekly_aggregate"
      const payload: any = {
        type: isWeeklyTab ? "weekly_aggregate" : "results",
      }

      if (!isWeeklyTab && activeDayConfig) {
        payload.day = activeDayConfig.day_bn
        payload.day_exam_name = activeDayConfig.exam_name
        payload.day_total_marks = activeDayConfig.total_marks
        payload.session_date = selectedSessionDate
      }

      const res = await fetch(`/api/exams/${params.id}/publish-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish notice")
      toast.success("✓ " + (data.message || "নোটিশ বোর্ডে সফলভাবে প্রকাশিত হয়েছে!"))
    } catch (err: any) {
      toast.error(err.message || "Failed to publish notice")
    } finally {
      setPublishingNotice(false)
    }
  }

  // Toggle Pause Exam
  async function handleTogglePauseExam() {
    if (!exam) return
    const nextPaused = !exam.is_paused
    setPausingExam(true)
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: nextPaused }),
      })
      if (!res.ok) {
        await supabase.from("exams").update({ is_paused: nextPaused }).eq("id", params.id)
      }
      setExam((prev: any) => ({ ...prev, is_paused: nextPaused }))
      toast.success(nextPaused ? `✓ "${exam.title}" স্থগিত (PAUSED) করা হয়েছে` : `✓ "${exam.title}" সচল (RESUMED) করা হয়েছে`)
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle pause")
    } finally {
      setPausingExam(false)
    }
  }

  // Toggle Batch Leaderboard Visibility
  async function handleToggleShowAllResults(nextVal: boolean) {
    setShowAllResults(nextVal)
    setUpdatingVisibility(true)
    try {
      const res = await fetch(`/api/exams/${params.id}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_all_results: nextVal }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update visibility")
      }
      setExam((prev: any) => ({ ...prev, show_all_results: nextVal }))
      toast.success(
        nextVal
          ? "✓ এই ব্যাচের সকল শিক্ষার্থী একে অপরের নম্বর ও মেরিট লিস্ট দেখতে পারবে"
          : "✓ প্রাইভেট মোড: শিক্ষার্থীরা শুধুমাত্র নিজেদের নম্বর দেখতে পারবে"
      )
    } catch (err: any) {
      setShowAllResults(!nextVal)
      toast.error(err.message || "Failed to update visibility")
    } finally {
      setUpdatingVisibility(false)
    }
  }

  // Delete Exam Permanently
  async function handleDeleteExam() {
    if (!exam) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/exams/${exam.id}`, { method: "DELETE" })
      if (!res.ok) {
        const { error: delErr } = await supabase.from("exams").delete().eq("id", exam.id)
        if (delErr) throw delErr
      }
      toast.success(`Exam "${exam.title}" deleted successfully`)
      setShowDeleteModal(false)
      router.push(backUrl)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete exam")
    } finally {
      setDeleting(false)
    }
  }

  // Statistics for the Active View
  const stats = useMemo(() => {
    const total = students.length
    const activeMax = isWeeklyExam
      ? (selectedTab === "weekly_aggregate" ? totalWeeklyMaxMarks : (activeDayConfig?.total_marks || 50))
      : (exam?.total_marks || 100)
    const activePass = isWeeklyExam
      ? (selectedTab === "weekly_aggregate" ? Math.round(totalWeeklyMaxMarks * 0.4) : (activeDayConfig?.pass_marks || 20))
      : (exam?.pass_marks || 33)

    let enteredCount = 0
    const marksArr: number[] = []

    for (const s of students) {
      let markVal: number | null = null
      if (isWeeklyExam && selectedTab !== "weekly_aggregate" && activeDayConfig) {
        const dObj = getDayMarkItem(dayMarksMap[s.id], activeDayConfig.key, activeDayConfig.day_bn, activeDayConfig.day_en)
        if (dObj && !isNaN(Number(dObj.marks))) {
          markVal = Number(dObj.marks)
        }
      } else {
        const raw = savedResults[s.id]?.obtained_marks
        if (raw !== undefined && raw !== "" && !isNaN(parseFloat(raw))) {
          markVal = parseFloat(raw)
        }
      }

      if (markVal !== null) {
        enteredCount++
        marksArr.push(markVal)
      }
    }

    const avg = marksArr.length ? Math.round(marksArr.reduce((a, b) => a + b, 0) / marksArr.length) : 0
    const highest = marksArr.length ? Math.max(...marksArr) : 0
    const passedCount = marksArr.filter((m) => m >= activePass).length
    const passRate = marksArr.length ? Math.round((passedCount / marksArr.length) * 100) : 0

    return { total, count: enteredCount, avg, highest, passRate, passedCount, failedCount: enteredCount - passedCount, max: activeMax, pass: activePass }
  }, [students, isWeeklyExam, selectedTab, activeDayConfig, totalWeeklyMaxMarks, dayMarksMap, savedResults, exam])

  // Total Toppers for Weekly View
  const totalToppers = useMemo(() => {
    if (!isWeeklyExam) return []
    const scoredList = students
      .map((s) => {
        const studentDays = dayMarksMap[s.id] || {}
        const grandTotal = Object.values(studentDays).reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
        const hasAnyMark = Object.keys(studentDays).length > 0 || (savedResults[s.id]?.obtained_marks !== "" && savedResults[s.id]?.obtained_marks !== undefined)
        const obt = hasAnyMark ? (grandTotal > 0 ? grandTotal : parseFloat(savedResults[s.id]?.obtained_marks || "0")) : null
        return {
          student: s,
          obtained_marks: obt,
          pct: obt !== null ? Math.round((obt / totalWeeklyMaxMarks) * 100) : 0,
          grade: obt !== null ? getGrade(obt, totalWeeklyMaxMarks) : "-",
        }
      })
      .filter((x) => x.obtained_marks !== null)
      .sort((a, b) => (b.obtained_marks || 0) - (a.obtained_marks || 0))

    let curRank = 1
    return scoredList.slice(0, 3).map((item, idx) => {
      if (idx > 0 && (item.obtained_marks || 0) < (scoredList[idx - 1].obtained_marks || 0)) {
        curRank = idx + 1
      }
      return { ...item, rank: curRank }
    })
  }, [isWeeklyExam, students, dayMarksMap, savedResults, totalWeeklyMaxMarks])

  // Subject-wise Toppers for Weekly View
  const subjectToppers = useMemo(() => {
    if (!isWeeklyExam || parsedWeeklyDays.length === 0) return []

    return parsedWeeklyDays.map((d) => {
      let topStudent: Student | null = null
      let topScore = -1

      for (const s of students) {
        const dObj = getDayMarkItem(dayMarksMap[s.id], d.key, d.day_bn, d.day_en)
        if (dObj) {
          const score = Number(dObj.marks)
          if (score > topScore) {
            topScore = score
            topStudent = s
          }
        }
      }

      return {
        day: d,
        student: topStudent,
        score: topScore,
      }
    })
  }, [isWeeklyExam, parsedWeeklyDays, students, dayMarksMap])

  // Filtered Students for Table
  const tableStudents = useMemo(() => {
    return students.filter((s) => {
      const q = tableSearchQuery.trim().toLowerCase()
      if (q) {
        const nameMatch = (s.name || "").toLowerCase().includes(q)
        const idMatch = (s.student_id || "").toLowerCase().includes(q)
        const rollStr = String(s.roll_no || "")
        const rollMatch = rollStr === q || `roll ${rollStr}`.includes(q) || `roll #${rollStr}`.includes(q)
        if (!nameMatch && !idMatch && !rollMatch) return false
      }

      const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
      const dayObj = isWeeklyExam && selectedTab !== "weekly_aggregate"
        ? getDayMarkItem(dayMarksMap[s.id], activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)
        : null
      const hasEntered = isWeeklyExam && selectedTab !== "weekly_aggregate"
        ? Boolean(dayObj && !isNaN(Number(dayObj.marks)))
        : Boolean(savedResults[s.id] && savedResults[s.id].obtained_marks !== "")

      const isJustSaved = justSavedIds.has(s.id)

      if (statusFilter === "entered") return hasEntered || isJustSaved
      if (statusFilter === "pending") return isJustSaved || !hasEntered
      if (statusFilter === "passed") {
        const mark = isWeeklyExam && selectedTab !== "weekly_aggregate"
          ? (dayObj ? Number(dayObj.marks) : null)
          : (savedResults[s.id]?.obtained_marks ? parseFloat(savedResults[s.id].obtained_marks) : null)
        return mark !== null && mark >= stats.pass
      }
      if (statusFilter === "failed") {
        const mark = isWeeklyExam && selectedTab !== "weekly_aggregate"
          ? (dayObj ? Number(dayObj.marks) : null)
          : (savedResults[s.id]?.obtained_marks ? parseFloat(savedResults[s.id].obtained_marks) : null)
        return mark !== null && mark < stats.pass
      }

      return true
    })
  }, [students, tableSearchQuery, statusFilter, isWeeklyExam, selectedTab, activeDayConfig, dayMarksMap, savedResults, justSavedIds, stats.pass])

  // Filtered Students for Weekly Multi-Column Table
  const filteredWeeklyStudents = useMemo(() => {
    if (!weeklySearchQuery.trim()) return students
    const q = weeklySearchQuery.trim().toLowerCase()
    return students.filter((s) => {
      const nameMatch = (s.name || "").toLowerCase().includes(q)
      const idMatch = (s.student_id || "").toLowerCase().includes(q)
      const phoneMatch = (s.phone || "").includes(q)
      const rollStr = String(s.roll_no || "")
      const rollMatch = rollStr === q || `roll ${rollStr}`.includes(q) || `roll #${rollStr}`.includes(q)
      return nameMatch || idMatch || phoneMatch || rollMatch
    })
  }, [students, weeklySearchQuery])

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-slate-500">পরীক্ষার তথ্য ও শিক্ষার্থীদের তালিকা লোড হচ্ছে...</p>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/90 shadow-sm max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Exam not found</h3>
        <p className="text-sm text-slate-400 mt-1 mb-6">পরীক্ষাটি খুঁজে পাওয়া যায়নি বা মুছে ফেলা হয়েছে।</p>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl text-sm shadow-md"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Exams
        </Link>
      </div>
    )
  }

  const isWeeklyActive = isWeeklyExam && selectedTab === "weekly_aggregate"
  const isSelectedDayPublished = activeDayConfig
    ? (publishedDays.some((p) => p.toLowerCase() === activeDayConfig.key.toLowerCase()) ||
       publishedDays.some((p) => p.toLowerCase() === activeDayConfig.day_bn.toLowerCase()) ||
       (activeDayConfig.day_en ? publishedDays.some((p) => p.toLowerCase() === activeDayConfig.day_en.toLowerCase()) : false))
    : false
  const activeTotalMarks = isWeeklyExam ? (isWeeklyActive ? totalWeeklyMaxMarks : (activeDayConfig?.total_marks || 50)) : exam.total_marks
  const activePassMarks = isWeeklyExam ? (isWeeklyActive ? Math.round(totalWeeklyMaxMarks * 0.4) : (activeDayConfig?.pass_marks || 20)) : exam.pass_marks

  const quickMarkNum = parseFloat(quickMarkInput)
  const isQuickOverMax = !isNaN(quickMarkNum) && quickMarkNum > activeTotalMarks
  const isQuickNegative = !isNaN(quickMarkNum) && quickMarkNum < 0
  const hasValidQuickMark = !isNaN(quickMarkNum) && quickMarkNum >= 0 && quickMarkNum <= activeTotalMarks
  const quickGradePreview = hasValidQuickMark ? getGrade(quickMarkNum, activeTotalMarks) : ""
  const isQuickPass = hasValidQuickMark && quickMarkNum >= activePassMarks

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <Link
            href={backUrl}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shrink-0 mt-0.5"
            title="Back to Exams"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                {exam.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {exam.subject || "সাধারণ বিষয়"}
              </span>
              {isWeeklyExam && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  সাপ্তাহিক পরীক্ষা
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700">{exam.batch?.name || "সকল ব্যাচ"}</span>
              <span>•</span>
              <span>
                মোট পূর্ণমান: <strong className="text-amber-600 font-bold">{activeTotalMarks}</strong> নম্বর
              </span>
              <span>•</span>
              <span>
                পাস নম্বর: <strong className="text-emerald-600 font-bold">{activePassMarks}</strong>
              </span>
            </p>
          </div>
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* 1. Dynamic Publish Button */}
          {isWeeklyExam ? (
            isWeeklyActive ? (
              <button
                type="button"
                onClick={() => handleTogglePublishWeekly(!isWeeklyPublished)}
                disabled={publishingExam}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
                  isWeeklyPublished
                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                    : "bg-purple-600 hover:bg-purple-700 text-white border-purple-600 shadow-purple-600/20"
                )}
                title="Publish consolidated weekly results"
              >
                {publishingExam ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isWeeklyPublished ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>{isWeeklyPublished ? "সাপ্তাহিক রেজাল্ট প্রকাশিত ✓" : "Publish Weekly Result"}</span>
              </button>
            ) : activeDayConfig ? (
              <button
                type="button"
                onClick={() => handleTogglePublishDay(activeDayConfig.key)}
                disabled={publishingExam}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
                  isSelectedDayPublished
                    ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                    : "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-blue-600/20"
                )}
                title={`Publish results for ${activeDayConfig.day_bn}`}
              >
                {publishingExam ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isSelectedDayPublished ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSelectedDayPublished ? `${activeDayConfig.day_bn} প্রকাশিত ✓` : `Publish [${activeDayConfig.day_bn}] Result`}
                </span>
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => handleTogglePublishOneTime(!exam.is_published)}
              disabled={publishingExam}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
                exam.is_published
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              )}
            >
              {publishingExam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exam.is_published ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Play className="w-3.5 h-3.5" />}
              <span>{exam.is_published ? "Results Published" : "Publish Exam"}</span>
            </button>
          )}

          {/* 2. Public Online Result Portal Toggle */}
          <button
            type="button"
            onClick={() => handleTogglePublicResult(!exam.is_public_result)}
            disabled={publishingPublic}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
              exam.is_public_result
                ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
            )}
            title="Publish on homepage Online Result portal"
          >
            {publishingPublic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span>{exam.is_public_result ? "🌐 Public Online Result" : "Publish to Public"}</span>
          </button>

          {/* 3. Publish Notice Button */}
          <button
            type="button"
            onClick={handlePublishNotice}
            disabled={publishingNotice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
            title="Post merit list announcement to notice board"
          >
            {publishingNotice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5 text-amber-600" />}
            <span>{isWeeklyActive ? "Publish Weekly Notice" : activeDayConfig ? `Publish [${activeDayConfig.day_bn}] Notice` : "Publish to Notice"}</span>
          </button>

          {/* 4. Weekly Pause/Resume */}
          {isWeeklyExam && (
            <button
              type="button"
              onClick={handleTogglePauseExam}
              disabled={pausingExam}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
                exam.is_paused ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-700" : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
              )}
            >
              {pausingExam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exam.is_paused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5 fill-slate-800" />}
              <span>{exam.is_paused ? "Resume Exam" : "Pause Exam"}</span>
            </button>
          )}

          {/* 5. SMS Button */}
          <Link
            href={`/dashboard/owner/sms?exam_id=${exam.id}&mode=exam_result${activeDayConfig ? `&day=${activeDayConfig.key}` : ""}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" /> Send SMS
          </Link>

          {/* 5.5. Edit Exam Button */}
          <Link
            href={`/dashboard/owner/exams?edit=${exam.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs"
            title="Edit Exam details, schedule, marks, and settings"
          >
            <Edit2 className="w-4 h-4 text-indigo-600" />
            <span>Edit Exam (সম্পাদনা)</span>
          </Link>

          {/* 6. Delete Exam */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer"
            title="Delete this exam"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* 7. Save All */}
          {!isWeeklyActive && (
            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
              <span>Save All</span>
            </button>
          )}
        </div>
      </div>

      {/* PROMINENT TOP DAY SELECTION & SESSION BAR (For Weekly Exams) */}
      {isWeeklyExam && parsedWeeklyDays.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-amber-400 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  সাপ্তাহিক পরীক্ষার দিন নির্বাচন (Weekly Exam Day Selection)
                </h2>
                <p className="text-xs text-slate-500">
                  দিন সিলেক্ট করে নম্বর ইনপুট ও প্রকাশ করুন, অথবা সামগ্রিক মেধার জন্য &ldquo;সাপ্তাহিক রেজাল্ট&rdquo; ট্যাবে যান।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">তারিখ:</span>
              <input
                type="date"
                value={selectedSessionDate}
                onChange={(e) => setSelectedSessionDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* DAY TABS + FINAL WEEKLY RESULT TAB */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
            {parsedWeeklyDays.map((d) => {
              const isSelected = selectedTab === d.key
              const isDayPub = publishedDays.includes(d.key.toLowerCase()) || publishedDays.includes(d.day_bn.toLowerCase())

              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    Object.values(autoSaveTimersRef.current).forEach((t) => clearTimeout(t))
                    autoSaveTimersRef.current = {}
                    setSelectedTab(d.key)
                    setJustSavedIds(new Set())
                    setSelectedStudent(null)
                    setQuickMarkInput("")
                    setStudentSearchQuery("")
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all shrink-0 min-w-[130px] sm:min-w-[155px] cursor-pointer",
                    isSelected
                      ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className={cn("text-xs font-black", isSelected ? "text-white" : "text-slate-900")}>
                      {d.day_bn}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.2 rounded-full border",
                        isDayPub
                          ? isSelected
                            ? "bg-white text-emerald-700 border-white"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : isSelected
                          ? "bg-amber-600/40 text-white border-amber-400"
                          : "bg-slate-200 text-slate-600 border-slate-300"
                      )}
                    >
                      {isDayPub ? "✓ প্রকাশিত" : "ড্রাফট"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] truncate w-full">
                    <span className={cn("font-medium truncate", isSelected ? "text-amber-100" : "text-slate-600")}>
                      {d.subject || d.exam_name}
                    </span>
                  </div>

                  <div className={cn("text-[10px] font-bold mt-0.5", isSelected ? "text-white" : "text-amber-700")}>
                    মোট: {d.total_marks} নম্বর (পাস: {d.pass_marks})
                  </div>
                </button>
              )
            })}

            {/* FINAL TAB: WEEKLY AGGREGATE RESULT */}
            <button
              type="button"
              onClick={() => {
                Object.values(autoSaveTimersRef.current).forEach((t) => clearTimeout(t))
                autoSaveTimersRef.current = {}
                setSelectedTab("weekly_aggregate")
                setJustSavedIds(new Set())
                setSelectedStudent(null)
                setQuickMarkInput("")
                setStudentSearchQuery("")
              }}
              className={cn(
                "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all shrink-0 min-w-[180px] sm:min-w-[210px] cursor-pointer",
                selectedTab === "weekly_aggregate"
                  ? "bg-gradient-to-r from-purple-700 to-indigo-700 text-white border-purple-800 shadow-lg ring-2 ring-purple-400/40"
                  : "bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200"
              )}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <span className="text-xs font-black flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  🏆 সাপ্তাহিক সামগ্রিক রেজাল্ট
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.2 rounded-full border",
                    isWeeklyPublished
                      ? "bg-emerald-500 text-white border-emerald-400"
                      : "bg-purple-200 text-purple-800 border-purple-300"
                  )}
                >
                  {isWeeklyPublished ? "✓ প্রকাশিত" : "ড্রাফট"}
                </span>
              </div>
              <p className={cn("text-[11px] font-medium", selectedTab === "weekly_aggregate" ? "text-purple-100" : "text-purple-700")}>
                সকল বিষয়ের মোট ফলাফল ও মেধা
              </p>
              <span className={cn("text-[10px] font-bold", selectedTab === "weekly_aggregate" ? "text-amber-300" : "text-purple-900")}>
                মোট পূর্ণমান: {totalWeeklyMaxMarks} নম্বর
              </span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">মোট শিক্ষার্থী</p>
            <p className="text-lg font-black text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">নম্বর প্রদান সম্পন্ন</p>
            <p className="text-lg font-black text-slate-900">
              {stats.count} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">গড় নম্বর</p>
            <p className="text-lg font-black text-slate-900">
              {stats.avg} <span className="text-xs font-normal text-slate-400">/{stats.max}</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">সর্বোচ্চ / পাসের হার</p>
            <p className="text-lg font-black text-slate-900">
              {stats.highest} <span className="text-xs font-normal text-slate-400">({stats.passRate}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* TARGET BATCH INFO & BATCH SWITCHER TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap text-xs font-semibold text-slate-700">
          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Users className="w-4 h-4" />
          </span>
          <span className="text-slate-500">টার্গেট ব্যাচ:</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-2xs">
            {exam.batch?.name || "সকল ব্যাচ"}
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-slate-600">
            মোট লোডকৃত শিক্ষার্থী:{" "}
            <span className={cn("font-black px-2 py-0.5 rounded-md text-xs", students.length > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200")}>
              {students.length} জন
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500 font-medium hidden sm:inline">ব্যাচ পরিবর্তন:</label>
          <select
            value={selectedBatchFilter}
            onChange={(e) => handleSwitchBatch(e.target.value)}
            disabled={switchingBatch}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-300 text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer disabled:opacity-50"
          >
            <option value="auto">
              {exam.batch?.name ? `নির্ধারিত ব্যাচ (${exam.batch.name})` : "পরীক্ষার ব্যাচ (ডিফল্ট)"}
            </option>
            <option value="all">🌐 সকল শিক্ষার্থী (All Students)</option>
            {availableBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {selectedBatchFilter !== "all" && (
            <button
              type="button"
              onClick={() => handleSwitchBatch("all")}
              disabled={switchingBatch}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {switchingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              সকল শিক্ষার্থী দেখুন
            </button>
          )}
        </div>
      </div>

      {students.length === 0 && !fetching && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>এই ব্যাচে কোনো শিক্ষার্থী তালিকাভুক্ত নেই অথবা এখনও কোনো শিক্ষার্থী পাওয়া যায়নি।</span>
          </div>
          <button
            type="button"
            onClick={() => handleSwitchBatch("all")}
            disabled={switchingBatch}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            {switchingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            সকল শিক্ষার্থী লোড করুন (Load All Students)
          </button>
        </div>
      )}

      {/* CONDITIONAL CONTENT: IF "WEEKLY AGGREGATE" IS SELECTED, SHOW TOPPERS & CONSOLIDATED TABLE */}
      {isWeeklyActive ? (
        <div className="space-y-6">
          {/* TOTAL TOPPERS (GRAND MERIT PODIUM) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                  <Trophy className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-slate-900">
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
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> প্রিন্ট মেধা তালিকা
              </button>
            </div>

            {totalToppers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                এখনও কোনো শিক্ষার্থীর নম্বর দেওয়া হয়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {totalToppers.map((t, idx) => {
                  const isGold = idx === 0
                  const isSilver = idx === 1

                  return (
                    <div
                      key={t.student.id}
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
                        <h3 className="font-black text-sm text-slate-900 truncate">{t.student.name}</h3>
                        <p className="text-[11px] font-mono text-slate-500">ID: {t.student.student_id}</p>
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

          {/* SUBJECT-WISE TOPPERS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <span className="p-2 rounded-xl bg-purple-100 text-purple-700 font-bold">
                <BookOpen className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী (Subject-wise Toppers)
                </h2>
                <p className="text-xs text-slate-500">
                  প্রতিটি দিনের নির্ধারিত বিষয়ে সর্বোচ্চ নম্বর অর্জনকারী শিক্ষার্থী
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjectToppers.map((st) => {
                const hasWinner = st.student && st.score >= 0

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
                          <p className="font-bold text-slate-800 truncate">🏆 {st.student?.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">ID: {st.student?.student_id}</p>
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

          {/* CONSOLIDATED MULTI-COLUMN WEEKLY MARKS TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">
                    সাপ্তাহিক সামগ্রিক মূল্যায়ন টেবিল (Day-by-Day Marks Breakdown)
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Edit & Auto-Save
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  যেকোনো দিনের ঘরে সরাসরি নম্বর লিখুন — স্বয়ংক্রিয়ভাবে সেভ হবে এবং মোট নম্বর আপডেট হবে।
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search in weekly breakdown */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={weeklySearchQuery}
                    onChange={(e) => setWeeklySearchQuery(e.target.value)}
                    placeholder="শিক্ষার্থী খুঁজুন (নাম, আইডি, রোল)..."
                    className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 shadow-xs"
                  />
                  {weeklySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setWeeklySearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveAllDays}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  title="Save all entered day marks across all students"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>সব দিনের নম্বর সেভ করুন</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 min-w-[140px]">Student Name</th>
                    <th className="px-3 py-3 min-w-[90px]">Student ID</th>
                    {parsedWeeklyDays.map((d) => (
                      <th key={d.key} className="px-2 py-3 text-center whitespace-nowrap min-w-[85px]">
                        <span className="block text-slate-900 font-extrabold">{d.day_bn}</span>
                        <span className="text-[10px] text-amber-700 font-bold">({d.total_marks})</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center bg-amber-50/60 font-black text-amber-900 min-w-[100px]">
                      মোট প্রাপ্ত ({totalWeeklyMaxMarks})
                    </th>
                    <th className="px-3 py-3 text-center min-w-[70px]">শতকরা (%)</th>
                    <th className="px-3 py-3 text-center min-w-[60px]">গ্রেড</th>
                    <th className="px-3 py-3 text-center min-w-[70px]">মেধা (Rank)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWeeklyStudents
                    .map((s) => {
                      const studentDays = { ...(dayMarksMap[s.id] || {}) }
                      
                      // Integrate any active cell drafts into the row's live calculation
                      for (const d of parsedWeeklyDays) {
                        const dayKey = d.key.toLowerCase()
                        const cellKey = `${s.id}_${dayKey}`
                        if (draftCellMarks[cellKey] !== undefined) {
                          const num = parseFloat(draftCellMarks[cellKey].trim())
                          if (!isNaN(num) && num >= 0) {
                            studentDays[dayKey] = {
                              marks: num,
                              total: d.total_marks,
                              grade: getGrade(num, d.total_marks),
                              subject: d.subject,
                              exam_name: d.exam_name,
                            }
                          }
                        }
                      }

                      const grandTotal = Object.values(studentDays).reduce((acc, curr) => acc + (Number(curr?.marks) || 0), 0)
                      const hasMarks = Object.keys(studentDays).length > 0 || (savedResults[s.id]?.obtained_marks !== "" && savedResults[s.id]?.obtained_marks !== undefined)
                      const obtVal = hasMarks ? (grandTotal > 0 ? grandTotal : parseFloat(savedResults[s.id]?.obtained_marks || "0")) : null
                      return { student: s, grandTotal: obtVal, days: studentDays }
                    })
                    .sort((a, b) => (b.grandTotal ?? -1) - (a.grandTotal ?? -1))
                    .map((row, idx) => {
                      const obt = row.grandTotal
                      const pct = obt !== null ? Math.round((obt / totalWeeklyMaxMarks) * 100) : null
                      const grade = obt !== null ? getGrade(obt, totalWeeklyMaxMarks) : "-"

                      return (
                        <tr key={row.student.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                          <td className="px-4 py-2 font-bold text-slate-900">
                            <p className="truncate max-w-[150px]">{row.student.name}</p>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-600 font-semibold">{row.student.student_id}</td>
                          {parsedWeeklyDays.map((d) => {
                            const dayKey = d.key.toLowerCase()
                            const cellKey = `${row.student.id}_${dayKey}`
                            const dObj = getDayMarkItem(row.days, d.key, d.day_bn, d.day_en)
                            const currentVal = draftCellMarks[cellKey] !== undefined
                              ? draftCellMarks[cellKey]
                              : (dObj && !isNaN(Number(dObj.marks)) ? String(dObj.marks) : "")
                            const cellNum = currentVal !== "" ? parseFloat(currentVal) : null
                            const dayMax = d.total_marks || 50
                            const isCellOverMax = cellNum !== null && !isNaN(cellNum) && cellNum > dayMax
                            const isCellNegative = cellNum !== null && !isNaN(cellNum) && cellNum < 0
                            const isCellInvalid = isCellOverMax || isCellNegative

                            return (
                              <td key={d.key} className="px-1.5 py-1.5 text-center">
                                <div className="inline-flex flex-col items-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={currentVal}
                                    onChange={(e) => handleCellMarkChange(row.student, d, e.target.value)}
                                    onBlur={() => handleCellMarkBlur(row.student, d)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleCellMarkBlur(row.student, d)
                                      }
                                    }}
                                    placeholder="—"
                                    className={cn(
                                      "w-16 sm:w-20 text-center py-1 px-1 rounded-lg text-xs font-black border transition-all focus:outline-none focus:ring-2",
                                      isCellInvalid
                                        ? "border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-400/30 font-black"
                                        : currentVal !== ""
                                        ? "bg-amber-50/70 border-amber-400 text-slate-900 shadow-2xs font-extrabold focus:ring-amber-500"
                                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 focus:ring-amber-500"
                                    )}
                                    title={isCellOverMax ? `সর্বোচ্চ নম্বর (${dayMax})-এর বেশি হতে পারবে না!` : undefined}
                                  />
                                  {isCellOverMax && (
                                    <span className="text-[9px] text-rose-600 font-black mt-0.5 whitespace-nowrap">
                                      &gt;{dayMax}!
                                    </span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                          <td className="px-4 py-2 text-center font-black text-amber-900 bg-amber-50/50 text-sm">
                            {obt !== null ? obt : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-slate-700">
                            {pct !== null ? `${pct}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-black">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[11px]",
                                grade === "A+" || grade === "A" ? "bg-emerald-100 text-emerald-800 font-bold" : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {grade}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-black">
                            {obt !== null ? (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                  idx === 0 ? "bg-amber-500 text-white" : idx === 1 ? "bg-slate-500 text-white" : idx === 2 ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-700"
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
                    })}
                  {filteredWeeklyStudents.length === 0 && (
                    <tr>
                      <td colSpan={parsedWeeklyDays.length + 6} className="text-center py-8 text-slate-400 text-xs">
                        {weeklySearchQuery ? `"${weeklySearchQuery}" দিয়ে কোনো শিক্ষার্থী পাওয়া যায়নি` : "কোনো শিক্ষার্থী নেই"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* DAY MARK ENTRY MODE OR ONE-TIME EXAM MODE */
        <div className="space-y-6">
          {/* QUICK SEARCH & ENTER MARK SECTION */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Quick Mark Entry — {activeDayConfig ? `${activeDayConfig.day_bn} (${activeDayConfig.subject || activeDayConfig.exam_name})` : "পরীক্ষার নম্বর প্রদান"}
                </h2>
              </div>
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium hidden sm:inline-block">
                শর্টকাট: নাম/ID টাইপ করুন → সিলেক্ট করুন → নম্বর দিয়ে Enter ↵ চাপুন
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Student Search Box */}
              <div className="lg:col-span-6 relative" ref={searchContainerRef}>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ১. শিক্ষার্থী খুঁজুন (Search by Name, Roll, or Phone)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => {
                      setStudentSearchQuery(e.target.value)
                      setIsSearchDropdownOpen(true)
                    }}
                    onFocus={() => setIsSearchDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredSearchStudents.length === 1) {
                        e.preventDefault()
                        handleSelectStudent(filteredSearchStudents[0])
                      } else if (e.key === "Escape") {
                        setIsSearchDropdownOpen(false)
                      }
                    }}
                    placeholder="শিক্ষার্থীর নাম বা রোল/ID টাইপ করুন..."
                    className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                  />
                  {studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentSearchQuery("")
                        searchInputRef.current?.focus()
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions */}
                {isSearchDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-slate-200 shadow-2xl max-h-64 overflow-y-auto z-50 divide-y divide-slate-100">
                    {filteredSearchStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 font-medium space-y-2">
                        <p>কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                        {selectedBatchFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => handleSwitchBatch("all")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" />
                            সকল শিক্ষার্থী থেকে খুঁজুন
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredSearchStudents.map((s) => {
                        const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
                        const dayObj = isWeeklyExam
                          ? getDayMarkItem(dayMarksMap[s.id], activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)
                          : null
                        const markToShow = isWeeklyExam
                          ? (dayObj && !isNaN(Number(dayObj.marks)) ? String(dayObj.marks) : "")
                          : (draftMarks[s.id] || savedResults[s.id]?.obtained_marks || "")
                        const hasMark = Boolean(markToShow !== "")
                        const isSelected = selectedStudent?.id === s.id

                        return (
                          <div
                            key={s.id}
                            onClick={() => handleSelectStudent(s)}
                            className={cn(
                              "px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors",
                              isSelected ? "bg-amber-50 border-l-4 border-amber-500" : "hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                                {s.name?.charAt(0).toUpperCase() || "S"}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-bold text-slate-900 truncate">{s.name}</p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  <span className="font-semibold text-amber-700">{s.student_id}</span>
                                  {s.phone && <span> • {s.phone}</span>}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0 ml-2">
                              {hasMark ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" /> {markToShow}/{activeTotalMarks}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Enter Mark & Action Box */}
              <div className="lg:col-span-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200 shadow-xs">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ২. প্রাপ্ত নম্বর ইনপুট করুন (পূর্ণমান: {activeTotalMarks})
                </label>

                {selectedStudent ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {selectedStudent.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 truncate">{selectedStudent.name}</p>
                          <p className="text-[11px] text-amber-700 font-mono font-bold">
                            ID: {selectedStudent.student_id}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(null)
                          setQuickMarkInput("")
                          searchInputRef.current?.focus()
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        title="Deselect student"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSaveQuickMark()
                      }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-1">
                          <input
                            ref={quickMarkInputRef}
                            type="text"
                            inputMode="decimal"
                            value={quickMarkInput}
                            onChange={(e) => setQuickMarkInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                handleSaveQuickMark()
                              } else if (e.key === "Escape") {
                                setSelectedStudent(null)
                                setQuickMarkInput("")
                                searchInputRef.current?.focus()
                              }
                            }}
                            placeholder={`0 - ${activeTotalMarks}`}
                            className={cn(
                              "w-full pl-3.5 pr-14 py-2 rounded-xl text-base font-black transition-all focus:outline-none",
                              isQuickOverMax || isQuickNegative
                                ? "border-2 border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-400/30"
                                : "bg-white border-2 border-amber-500 text-slate-900 focus:ring-2 focus:ring-amber-500/30"
                            )}
                          />
                          <span className={cn(
                            "absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold",
                            isQuickOverMax ? "text-rose-500" : "text-slate-400"
                          )}>
                            /{activeTotalMarks}
                          </span>
                        </div>

                        {hasValidQuickMark && (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black border border-amber-200">
                              {quickGradePreview}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-1 rounded-lg text-xs font-bold border",
                                isQuickPass ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {isQuickPass ? "Pass" : "Fail"}
                            </span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={savingQuickMark || !hasValidQuickMark}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {savingQuickMark ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Check className="w-4 h-4" />}
                          <span>Save</span>
                        </button>
                      </div>

                      {isQuickOverMax && (
                        <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          সর্বোচ্চ নম্বর {activeTotalMarks}-এর বেশি হওয়া সম্ভব নয়!
                        </p>
                      )}
                      {isQuickNegative && (
                        <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          নম্বর ০ এর কম হতে পারে না!
                        </p>
                      )}
                    </form>
                  </div>
                ) : (
                  <div
                    onClick={() => searchInputRef.current?.focus()}
                    className="py-4 px-3 border border-dashed border-slate-300 rounded-xl bg-white text-center cursor-pointer hover:border-amber-400 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-700">বাম পাশের সার্চ বক্সে শিক্ষার্থীর নাম বা আইডি খুঁজুন</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      অথবা সরাসরি নিচের টেবিলের ঘরে নম্বর টাইপ করে <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> চাপুন
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TABLE SECTION WITH LIVE SEARCH & FILTERS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="শিক্ষার্থীর নাম বা রোল দিয়ে ফিল্টার করুন..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 shadow-xs"
                />
                {tableSearchQuery && (
                  <button type="button" onClick={() => setTableSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>⚡ Auto-Save Active</span>
                </div>
                {(
                  [
                    { key: "all", label: `সকল (${students.length})` },
                    { key: "entered", label: `নম্বর প্রাপ্ত (${stats.count})` },
                    { key: "pending", label: `বাকি (${stats.total - stats.count})` },
                    { key: "passed", label: `পাস (${stats.passedCount})` },
                    { key: "failed", label: `ফেল (${stats.failedCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                      statusFilter === tab.key ? "bg-amber-500 text-white shadow-xs" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3 w-16 text-center">Roll</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3 text-center">
                      প্রাপ্ত নম্বর (/{activeTotalMarks})
                    </th>
                    <th className="px-4 py-3 text-center">গ্রেড</th>
                    <th className="px-4 py-3 text-center">অবস্থা</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {tableStudents.map((s, idx) => {
                    const activeKey = (activeDayConfig?.key || selectedTab).toLowerCase()
                    const dayObj = isWeeklyExam && selectedTab !== "weekly_aggregate"
                      ? getDayMarkItem(dayMarksMap[s.id], activeKey, activeDayConfig?.day_bn, activeDayConfig?.day_en)
                      : null
                    const draftVal = draftMarks[s.id] ?? ""
                    const currentMarksNum = draftVal !== ""
                      ? parseFloat(draftVal)
                      : (dayObj && !isNaN(Number(dayObj.marks)))
                      ? Number(dayObj.marks)
                      : (!isWeeklyExam || selectedTab === "weekly_aggregate")
                      ? (savedResults[s.id]?.obtained_marks ? parseFloat(savedResults[s.id].obtained_marks) : null)
                      : null
                    const draftNum = draftVal !== "" ? parseFloat(draftVal) : null
                    const isRowOverMax = draftNum !== null && !isNaN(draftNum) && draftNum > activeTotalMarks
                    const isRowNegative = draftNum !== null && !isNaN(draftNum) && draftNum < 0
                    const isRowInvalid = isRowOverMax || isRowNegative
                    const hasEntered = Boolean(currentMarksNum !== null && !isNaN(currentMarksNum))
                    const isJustSaved = justSavedIds.has(s.id)
                    const isAutoSaving = autoSavingIds.has(s.id)
                    const passed = hasEntered && currentMarksNum! >= activePassMarks
                    const gradeToDisplay = hasEntered ? getGrade(currentMarksNum!, activeTotalMarks) : ""

                    return (
                      <tr key={s.id} className={cn("transition-colors", isAutoSaving ? "bg-amber-50/40" : isJustSaved ? "bg-emerald-50" : hasEntered ? "hover:bg-amber-50/20" : "hover:bg-slate-50")}>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono text-center font-bold">{idx + 1}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono text-xs font-black">
                            {s.roll_no || idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {s.name?.charAt(0).toUpperCase() || "S"}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{s.name}</p>
                              {s.phone && <p className="text-[11px] text-slate-400 font-medium">{s.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs font-bold">
                            {s.student_id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              if (isRowInvalid) return
                              if (autoSaveTimersRef.current[s.id]) {
                                clearTimeout(autoSaveTimersRef.current[s.id])
                                delete autoSaveTimersRef.current[s.id]
                              }
                              saveRowMark(s, idx)
                            }}
                            className="inline-flex flex-col items-center"
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                id={`mark-input-${idx}`}
                                type="text"
                                inputMode="decimal"
                                value={draftVal}
                                onChange={(e) => handleMarkInputChange(s, e.target.value)}
                                onBlur={() => handleMarkInputBlur(s)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    if (isRowInvalid) return
                                    if (autoSaveTimersRef.current[s.id]) {
                                      clearTimeout(autoSaveTimersRef.current[s.id])
                                      delete autoSaveTimersRef.current[s.id]
                                    }
                                    saveRowMark(s, idx)
                                  }
                                }}
                                className={cn(
                                  "w-24 px-3 py-1.5 border-2 rounded-lg text-sm text-center font-black transition-all focus:outline-none shadow-xs",
                                  isRowInvalid
                                    ? "border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-400/30"
                                    : isAutoSaving
                                    ? "border-amber-400 bg-amber-50/50 text-amber-900 ring-2 ring-amber-400/20"
                                    : isJustSaved
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                    : hasEntered
                                    ? "border-emerald-400 bg-white text-emerald-900"
                                    : "border-slate-300 bg-white text-slate-900 focus:border-amber-500"
                                )}
                                placeholder="—"
                                title={isRowOverMax ? `সর্বোচ্চ নম্বর (${activeTotalMarks})-এর বেশি হতে পারবে না!` : undefined}
                              />
                              <button
                                type="submit"
                                disabled={savingRowStudentId === s.id || isAutoSaving || isRowInvalid}
                                title={isRowInvalid ? `সর্বোচ্চ নম্বর (${activeTotalMarks})-এর বেশি হতে পারবে না` : "Save mark (Enter ↵)"}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {savingRowStudentId === s.id || isAutoSaving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                ) : isJustSaved ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {isRowOverMax && (
                              <span className="text-[9px] text-rose-600 font-black mt-0.5 whitespace-nowrap">
                                &gt;{activeTotalMarks}!
                              </span>
                            )}
                            {isRowNegative && (
                              <span className="text-[9px] text-rose-600 font-black mt-0.5 whitespace-nowrap">
                                &lt;0!
                              </span>
                            )}
                          </form>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {gradeToDisplay ? (
                            <span
                              className={cn(
                                "inline-block px-2.5 py-0.5 rounded-full text-xs font-black border",
                                gradeToDisplay === "A+" || gradeToDisplay === "A"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : gradeToDisplay === "F"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              )}
                            >
                              {gradeToDisplay}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isAutoSaving ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                            </span>
                          ) : isJustSaved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3" /> Saved ✓
                            </span>
                          ) : hasEntered ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                                passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {passed ? "Pass" : "Fail"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectStudent(s)}
                              className="px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              Quick Edit
                            </button>
                            {hasEntered && (
                              <button
                                type="button"
                                onClick={() => clearStudentMark(s.id, s.name)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Clear mark"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {tableStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <Users className="w-6 h-6" />
                          </div>
                          <p className="font-bold text-slate-700 text-sm">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                          <p className="text-xs text-slate-400">
                            {tableSearchQuery
                              ? "অনুসন্ধানের সাথে কোনো শিক্ষার্থীর তথ্য মিলছে না।"
                              : "এই ব্যাচে কোনো শিক্ষার্থী তালিকাভুক্ত নেই অথবা এখনও কোনো শিক্ষার্থী লোড করা হয়নি।"}
                          </p>
                          {selectedBatchFilter !== "all" && !tableSearchQuery && (
                            <button
                              type="button"
                              onClick={() => handleSwitchBatch("all")}
                              disabled={switchingBatch}
                              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              {switchingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                              সকল শিক্ষার্থী লোড করুন (Load All Students)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BATCH MARKS VISIBILITY OPTION */}
      <div className="p-4 sm:p-5 rounded-2xl border bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            {showAllResults ? <Users className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Batch Marks Visibility & Merit List
              </h3>
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full border", showAllResults ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                {showAllResults ? "Public to Batch (Default)" : "Private (Only Own Marks)"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {showAllResults
                ? "ডিফল্ট: ব্যাচের সকল শিক্ষার্থী প্রোফাইল থেকে একে অপরের ফলাফল ও মেরিট লিস্ট দেখতে পারবে।"
                : "প্রাইভেট: শিক্ষার্থীরা শুধুমাত্র নিজেদের নম্বর দেখতে পারবে, অন্যের নম্বর বা মেরিট লুকানো থাকবে।"}
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllResults}
            disabled={updatingVisibility}
            onChange={(e) => handleToggleShowAllResults(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-emerald-500"></div>
          <span className="ml-3 text-xs font-bold text-slate-700 min-w-[120px]">
            {updatingVisibility ? "আপডেট হচ্ছে..." : showAllResults ? "All Marks Visible" : "Private Only"}
          </span>
        </label>
      </div>

      {/* DELETE MODAL */}
      {showDeleteModal && exam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Exam?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  আপনি কি নিশ্চিত যে &ldquo;{exam.title}&rdquo; মুছে ফেলতে চান? সকল প্রশ্ন ও শিক্ষার্থীদের ফলাফল স্থায়ীভাবে মুছে যাবে।
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExam}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
