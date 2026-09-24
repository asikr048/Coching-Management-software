"use client"
import { useState, useMemo, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  Plus, X, Loader2, FileText, Trophy, Clock, CheckCircle, GripVertical, 
  Trash2, Edit2, PlayCircle, Eye, Globe, MessageSquare, Landmark, Building2, BookOpen,
  Pause, Play, CalendarDays, Bell, Sparkles, AlertCircle, Search, ExternalLink, Filter,
  Check, RefreshCw, Layers, Award
} from "lucide-react"
import { formatDate, cn, extractWeeklyScheduleFromNote, cleanWeeklyScheduleFromNote, extractSeriesId, extractSeriesWeek, getExamSeriesKey } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useBranch } from "@/components/providers/BranchContext"
import type { Branch } from "@/lib/supabase/types"

export const WEEK_DAYS = [
  { id: "Saturday", bn: "শনিবার", short: "শনি" },
  { id: "Sunday", bn: "রবিবার", short: "রবি" },
  { id: "Monday", bn: "সোমবার", short: "সোম" },
  { id: "Tuesday", bn: "মঙ্গলবার", short: "মঙ্গল" },
  { id: "Wednesday", bn: "বুধবার", short: "বুধ" },
  { id: "Thursday", bn: "বৃহস্পতিবার", short: "বৃহস্পতি" },
  { id: "Friday", bn: "শুক্রবার", short: "শুক্র" },
]

export interface NoticeRow {
  id: string
  title: string
  content: string
  is_active: boolean
  priority?: string
  notice_date?: string | null
  branch_id?: string | null
  branch_ids?: string[] | null
  created_at: string
}

interface ExamRow { 
  id: string
  title: string
  exam_type: string
  subject?: string
  total_marks: number
  pass_marks?: number
  exam_date?: string
  is_published: boolean
  is_online?: boolean
  time_limit_minutes?: number
  duration_minutes?: number | null
  show_results_immediately?: boolean
  show_all_results?: boolean
  batch?: { name: string }
  batch_id?: string
  batch_ids?: string[] | null
  branch_id?: string | null
  branch?: { id?: string; name: string } | null
  exam_questions?: { count: number }[]
  exam_schedule_type?: "one_time" | "weekly"
  recurring_days?: any[] | null
  is_paused?: boolean
  is_public_result?: boolean
  is_weekly_published?: boolean
  schedule_notice_id?: string | null
  result_note?: string | null
  created_at?: string
}

export interface WeeklyDayConfig {
  selected: boolean
  exam_name: string
  subject: string
  total_marks: string
  pass_marks: string
}

const defaultWeeklySchedule = () => ({
  Saturday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
  Sunday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
  Monday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
  Tuesday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
  Wednesday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
  Thursday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
  Friday: { selected: false, exam_name: "", subject: "", total_marks: "50", pass_marks: "20" },
})

interface BatchOpt { 
  id: string
  name: string
  branch_id?: string | null 
}

type QuestionType = "mcq" | "short" | "long"

interface DraftQuestion {
  id: string
  question_type: QuestionType
  question_text: string
  options?: string[]
  correct_answer?: string
  marks: number
  hint_note?: string
  sort_order: number
}

export default function ExamsClient({ 
  exams: initial, 
  batches,
  branches = [],
  initialNotices = []
}: { 
  exams: ExamRow[]
  batches: BatchOpt[]
  branches?: Branch[]
  initialNotices?: NoticeRow[]
}) {
  const [exams, setExams] = useState(initial)
  const [notices, setNotices] = useState<NoticeRow[]>(initialNotices)
  const [showModal, setShowModal] = useState(false)
  const [editingExam, setEditingExam] = useState<ExamRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [deleteConfirmExam, setDeleteConfirmExam] = useState<ExamRow | null>(null)
  const [deleteConfirmSeries, setDeleteConfirmSeries] = useState<any | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const { selectedBranchId, currentBranch } = useBranch()
  const router = useRouter()
  
  // Notice & Result Notification States
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)
  const [deleteConfirmNotice, setDeleteConfirmNotice] = useState<NoticeRow | null>(null)
  const [selectedNoticeForView, setSelectedNoticeForView] = useState<NoticeRow | null>(null)
  const [noticeSearch, setNoticeSearch] = useState("")
  const [noticeTypeFilter, setNoticeTypeFilter] = useState<"all" | "results" | "routine">("all")
  const [publishingNoticeExamId, setPublishingNoticeExamId] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "one_time" | "weekly" | "published" | "draft" | "online" | "notices">("all")
  const [batchFilter, setBatchFilter] = useState<string>("all")
  const [groupSeries, setGroupSeries] = useState(true)
  
  // Modal State
  const [examMode, setExamMode] = useState<"offline" | "online">("offline")
  
  // Form State
  const [form, setForm] = useState({ 
    title: "", 
    branch_id: selectedBranchId !== "all" ? selectedBranchId : (currentBranch?.id || branches[0]?.id || ""),
    batch_id: "", 
    batch_ids: [] as string[],
    exam_schedule_type: "one_time" as "one_time" | "weekly",
    recurring_days: [] as string[],
    publish_to_notice: false,
    notice_title: "",
    notice_content: "",
    is_notice_customized: false,
    exam_type: "written", 
    subject: "", 
    total_marks: "100", 
    pass_marks: "33", 
    exam_date: "", 
    duration_minutes: "60",
    show_results_immediately: true,
    show_all_results: true,
    result_note: ""
  })
  function update(f: string, v: any) { setForm(x => ({ ...x, [f]: v })) }

  function getGeneratedNoticePreview(currentForm: typeof form, currentWeekly: typeof weeklySchedule) {
    let dateText = currentForm.exam_date || "শীঘ্রই জানানো হবে"
    let scheduleBreakdown = ""
    
    if (currentForm.exam_schedule_type === "weekly") {
      const lines: string[] = []
      WEEK_DAYS.forEach(day => {
        const config = (currentWeekly as any)[day.id]
        if (config?.selected) {
          const subj = config.subject ? ` [${config.subject}]` : ""
          lines.push(`  • ${day.bn}: ${config.exam_name || "পরীক্ষা"}${subj} (পূর্ণমান: ${config.total_marks || 50}, পাস নম্বর: ${config.pass_marks || 20})`)
        }
      })
      if (lines.length > 0) {
        dateText = "প্রতি সপ্তাহে নির্ধারিত দিনসমূহে"
        scheduleBreakdown = `\n\n📅 সাপ্তাহিক পরীক্ষার সূচি ও মানবণ্টন:\n` + lines.join("\n")
      }
    }

    const title = currentForm.title.trim() || (currentForm.exam_schedule_type === "weekly" ? "সাপ্তাহিক মূল্যায়ন পরীক্ষা" : "মাসিক মূল্যায়ন পরীক্ষা")
    const subject = currentForm.subject.trim() || "সাধারণ / নির্ধারিত বিষয়"

    // Batch names summary
    let targetBatchNames = "সকল ব্যাচ"
    if (currentForm.batch_ids && currentForm.batch_ids.length > 0) {
      const bNames = batches.filter(b => currentForm.batch_ids.includes(b.id)).map(b => b.name)
      if (bNames.length > 0) targetBatchNames = bNames.join(", ")
    } else if (currentForm.batch_id) {
      const b = batches.find(x => x.id === currentForm.batch_id)
      if (b) targetBatchNames = b.name
    }

    const noticeTitle = `📋 পরীক্ষার রুটিন নোটিশ: ${title}`
    const noticeContent = `মেধাশিরী কোচিংয়ের সংশ্লিষ্ট শিক্ষার্থীদের অবগতির জন্য জানানো যাচ্ছে যে, নিম্নোক্ত সূচি অনুযায়ী পরীক্ষা অনুষ্ঠিত হবে:

📌 পরীক্ষার নাম: ${title}
📚 বিষয়: ${subject}
📅 পরীক্ষার সময়/তারিখ: ${dateText}${scheduleBreakdown}
🎯 টার্গেট ব্যাচ: ${targetBatchNames}

সকল শিক্ষার্থীকে যথাসময়ে উপস্থিত হয়ে পরীক্ষায় অংশগ্রহণের জন্য বিশেষ নির্দেশ দেওয়া যাচ্ছে। কোনো প্রকার অনুপস্থিতি গ্রহণযোগ্য হবে না।`

    return { noticeTitle, noticeContent }
  }

  function togglePublishToNotice(checked: boolean) {
    if (checked) {
      const { noticeTitle, noticeContent } = getGeneratedNoticePreview(form, weeklySchedule)
      setForm(prev => ({
        ...prev,
        publish_to_notice: true,
        notice_title: prev.is_notice_customized && prev.notice_title ? prev.notice_title : noticeTitle,
        notice_content: prev.is_notice_customized && prev.notice_content ? prev.notice_content : noticeContent,
      }))
    } else {
      update("publish_to_notice", false)
    }
  }

  function resetForm() {
    setEditingExam(null)
    setExamMode("offline")
    setQuestions([])
    setWeeklySchedule(defaultWeeklySchedule())
    setForm({ 
      title: "", 
      branch_id: selectedBranchId !== "all" ? selectedBranchId : (currentBranch?.id || branches[0]?.id || ""),
      batch_id: "", 
      batch_ids: [],
      exam_schedule_type: "one_time",
      recurring_days: [],
      publish_to_notice: false,
      notice_title: "",
      notice_content: "",
      is_notice_customized: false,
      exam_type: "written", 
      subject: "", 
      total_marks: "100", 
      pass_marks: "33", 
      exam_date: "", 
      duration_minutes: "60",
      show_results_immediately: true,
      show_all_results: true,
      result_note: ""
    })
  }

  function handleOpenCreate() {
    resetForm()
    setShowModal(true)
  }

  // Quick Continuous Weekly Exam Creator (Starts fresh at Week 1 with independent series ID)
  function handleOpenNewWeeklyExam() {
    resetForm()

    const newSeriesId = `series_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const initialBatchId =
      batchFilter !== "all" ? batchFilter : (batches[0]?.id || "")

    // Pre-populate all 7 days with 50 marks each (350 total)
    const initialSchedule = defaultWeeklySchedule()
    WEEK_DAYS.forEach((w) => {
      initialSchedule[w.id as keyof typeof initialSchedule] = {
        selected: true,
        exam_name: `${w.bn}ের পরীক্ষা`,
        subject: "বিষয় ভিত্তিক পরীক্ষা",
        total_marks: "50",
        pass_marks: "20",
      }
    })
    setWeeklySchedule(initialSchedule)

    setForm((prev) => ({
      ...prev,
      title: "WEEKLY-01",
      subject: "সকল বিষয় (সাপ্তাহিক মূল্যায়ন)",
      batch_id: initialBatchId,
      batch_ids: initialBatchId ? [initialBatchId] : [],
      exam_schedule_type: "weekly",
      recurring_days: [],
      total_marks: "350",
      pass_marks: "140",
      exam_date: new Date().toISOString().split("T")[0],
      duration_minutes: "60",
      show_results_immediately: true,
      show_all_results: true,
      result_note: `[SERIES_ID:${newSeriesId}] [SERIES_WEEK:1]`,
    }))

    setExamMode("offline")
    setShowModal(true)
  }

  // Directly create the next sequential week for a specific series card
  const [creatingWeekForSeriesId, setCreatingWeekForSeriesId] = useState<string | null>(null)
  async function handleCreateNextWeekForSeries(group: any) {
    if (!group || !group.firstExam) return
    setCreatingWeekForSeriesId(group.groupKey)
    try {
      const nextWeekNum = group.allWeeks.length + 1
      const weekLabel = `WEEKLY-${nextWeekNum < 10 ? "0" + nextWeekNum : nextWeekNum}`
      const srcExam = group.latestExam || group.firstExam
      const seriesId = extractSeriesId(srcExam.result_note) || extractSeriesId(group.firstExam.result_note) || group.groupKey.replace("series_", "")

      // Extract schedule from source exam
      let scheduleToCopy: any[] = []
      const fromNote = extractWeeklyScheduleFromNote(srcExam.result_note)
      if (Array.isArray(fromNote) && fromNote.length > 0) {
        scheduleToCopy = fromNote
      } else if (Array.isArray(srcExam.recurring_days) && srcExam.recurring_days.length > 0) {
        scheduleToCopy = srcExam.recurring_days
      }

      let newTotalMarks = Number(srcExam.total_marks) || 350
      let newPassMarks = Number(srcExam.pass_marks) || 140
      if (scheduleToCopy.length > 0) {
        const schedTotal = scheduleToCopy.reduce((acc: number, d: any) => acc + (Number(d.total_marks) || 0), 0)
        const schedPass = scheduleToCopy.reduce((acc: number, d: any) => acc + (Number(d.pass_marks) || 0), 0)
        if (schedTotal > 0) newTotalMarks = schedTotal
        if (schedPass > 0) newPassMarks = schedPass
      }

      const batchIdsList = Array.isArray(srcExam.batch_ids) && srcExam.batch_ids.length > 0
        ? srcExam.batch_ids
        : srcExam.batch_id ? [srcExam.batch_id] : []

      let updatedNote = `[SERIES_ID:${seriesId}] [SERIES_WEEK:${nextWeekNum}] [SHOW_ALL_RESULTS:true]`
      if (batchIdsList.length > 0) {
        updatedNote += ` [BATCH_IDS:${JSON.stringify(batchIdsList)}]`
      }
      if (scheduleToCopy.length > 0) {
        updatedNote += ` [WEEKLY_SCHEDULE:${JSON.stringify(scheduleToCopy)}]`
        updatedNote += ` [WEEKLY_DAYS:${scheduleToCopy.map((d: any) => typeof d === "object" ? d.day : d).join(",")}]`
      }

      // Ensure the first/root exam also has this SERIES_ID in its note if it was missing
      if (group.firstExam?.id && !group.firstExam.result_note?.includes("[SERIES_ID:")) {
        try {
          await supabase
            .from("exams")
            .update({
              result_note: `[SERIES_ID:${seriesId}] [SERIES_WEEK:1] ` + (group.firstExam.result_note || "")
            })
            .eq("id", group.firstExam.id)
        } catch {}
      }

      const corePayload = {
        title: weekLabel,
        batch_id: srcExam.batch_id,
        subject: srcExam.subject || "সকল বিষয় (সাপ্তাহিক মূল্যায়ন)",
        total_marks: newTotalMarks,
        pass_marks: newPassMarks,
        exam_date: new Date().toISOString().split("T")[0],
        result_note: updatedNote,
        is_published: false,
      }

      const fullPayload: any = { ...corePayload }
      if (srcExam.branch_id) fullPayload.branch_id = srcExam.branch_id
      if (srcExam.duration_minutes) fullPayload.duration_minutes = Number(srcExam.duration_minutes) || 60

      let insertedId: string | null = null

      const { data: inserted, error: insErr } = await supabase
        .from("exams")
        .insert(fullPayload)
        .select("id")
        .single()

      if (!insErr && inserted?.id) {
        insertedId = inserted.id
      } else {
        console.warn("Standard insert failed, falling back to minimal payload:", insErr)
        const { data: fbExam, error: fbErr } = await supabase
          .from("exams")
          .insert(corePayload)
          .select("id")
          .single()

        if (fbErr) throw fbErr
        if (fbExam?.id) insertedId = fbExam.id
      }

      if (insertedId) {
        toast.success(`✓ Week ${nextWeekNum} সফলভাবে তৈরি হয়েছে! নম্বর প্রদান পেজে নিয়ে যাওয়া হচ্ছে...`)
        router.push(`/dashboard/owner/exams/${insertedId}`)
      }
    } catch (err: any) {
      console.error("Failed to create next week:", err)
      toast.error(err?.message || "Failed to create next week")
    } finally {
      setCreatingWeekForSeriesId(null)
    }
  }

  // Weekly Day-by-Day Schedule State
  const [weeklySchedule, setWeeklySchedule] = useState(defaultWeeklySchedule())

  function toggleDay(dayId: string, selected: boolean) {
    setWeeklySchedule(prev => {
      const current = prev[dayId as keyof typeof prev]
      const dayBn = WEEK_DAYS.find(w => w.id === dayId)?.bn || dayId
      return {
        ...prev,
        [dayId]: {
          ...current,
          selected,
          exam_name: current.exam_name || (selected ? `${dayBn}ের পরীক্ষা` : "")
        }
      }
    })
  }

  function updateDayField(dayId: string, field: "exam_name" | "subject" | "total_marks" | "pass_marks", value: string) {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId as keyof typeof prev],
        [field]: value
      }
    }))
  }

  const selectedWeeklyDaysCount = useMemo(() => {
    return WEEK_DAYS.filter(d => weeklySchedule[d.id as keyof typeof weeklySchedule]?.selected).length
  }, [weeklySchedule])
  
  const supabase = createClient()

  // Online Questions State
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [editingQuestion, setEditingQuestion] = useState<DraftQuestion | null>(null)
  const [qForm, setQForm] = useState({
    type: "mcq" as QuestionType,
    text: "",
    opt1: "", opt2: "", opt3: "", opt4: "",
    correctOption: "0",
    expectedAnswer: "",
    marks: "5",
    hint: ""
  })

  // Available batches for current view
  const availableBatches = useMemo(() => {
    if (selectedBranchId !== "all") {
      return batches.filter(b => !b.branch_id || b.branch_id === selectedBranchId)
    }
    return batches
  }, [batches, selectedBranchId])

  // Batches for the modal form based on form.branch_id
  const formBatches = useMemo(() => {
    if (form.branch_id) {
      return batches.filter(b => !b.branch_id || b.branch_id === form.branch_id)
    }
    return availableBatches
  }, [batches, form.branch_id, availableBatches])

  // Published check helper (supports is_published, is_public_result, is_weekly_published, and result_note flags)
  const isExamPublished = (ex: ExamRow) => {
    return Boolean(
      ex.is_published ||
      ex.is_public_result ||
      ex.is_weekly_published ||
      ex.result_note?.includes("[PUBLIC_RESULT:true]") ||
      ex.result_note?.includes("[IS_WEEKLY_PUBLISHED:true]")
    )
  }

  // Notice classification helpers
  const isResultNotice = (n: NoticeRow) => {
    const t = (n.title || "").toLowerCase()
    const c = (n.content || "").toLowerCase()
    return (
      t.includes("ফলাফল") ||
      t.includes("মেরিট") ||
      t.includes("result") ||
      t.includes("merit") ||
      t.includes("🏆") ||
      c.includes("ফলাফল প্রকাশিত") ||
      c.includes("মেধা তালিকা")
    )
  }

  const isRoutineNotice = (n: NoticeRow) => {
    const t = (n.title || "").toLowerCase()
    const c = (n.content || "").toLowerCase()
    return (
      t.includes("রুটিন") ||
      t.includes("সূচি") ||
      t.includes("routine") ||
      t.includes("📋") ||
      c.includes("পরীক্ষার রুটিন") ||
      c.includes("পরীক্ষার সূচি")
    )
  }

  const isExamOrResultNotice = (n: NoticeRow) => {
    const t = (n.title || "").toLowerCase()
    const c = (n.content || "").toLowerCase()
    return (
      isResultNotice(n) ||
      isRoutineNotice(n) ||
      t.includes("পরীক্ষা") ||
      t.includes("exam") ||
      c.includes("পরীক্ষা") ||
      c.includes("exam")
    )
  }

  function getLinkedNotices(exam: ExamRow, allNotices: NoticeRow[]) {
    return allNotices.filter(n => {
      if (exam.schedule_notice_id && n.id === exam.schedule_notice_id) return true
      if (exam.title) {
        const cleanExamTitle = exam.title.trim().toLowerCase()
        if (cleanExamTitle.length >= 3) {
          if (n.title?.toLowerCase().includes(cleanExamTitle)) return true
          if (n.content?.toLowerCase().includes(cleanExamTitle)) return true
        }
      }
      return false
    })
  }

  // Filtered Exams
  const filteredExams = useMemo(() => {
    return exams.filter(ex => {
      // Branch filter
      if (selectedBranchId !== "all" && ex.branch_id && ex.branch_id !== selectedBranchId) {
        return false
      }
      // Batch filter
      if (batchFilter !== "all") {
        const matchPrimary = ex.batch_id === batchFilter
        const matchMulti = Array.isArray(ex.batch_ids) && ex.batch_ids.includes(batchFilter)
        if (!matchPrimary && !matchMulti) return false
      }
      if (statusFilter === "published" && !isExamPublished(ex)) return false
      if (statusFilter === "draft" && isExamPublished(ex)) return false
      if (statusFilter === "online" && !ex.is_online) return false
      const isWeeklyEx =
        ex.exam_schedule_type === "weekly" ||
        (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) ||
        Boolean(ex.title?.includes("সাপ্তাহিক")) ||
        Boolean(ex.subject?.includes("সাপ্তাহিক")) ||
        Boolean(ex.result_note?.includes("[WEEKLY_SCHEDULE:")) ||
        Boolean(ex.result_note?.includes("[SERIES_WEEK:")) ||
        Boolean(ex.title?.toUpperCase().includes("WEEKLY-")) ||
        (Number(ex.total_marks) === 350 && !ex.exam_date)
      if (statusFilter === "one_time" && isWeeklyEx) return false
      if (statusFilter === "weekly" && !isWeeklyEx) return false
      return true
    })
  }, [exams, statusFilter, batchFilter, selectedBranchId])

  // Grouped Series vs Standalone Exams
  const { groupedSeriesList, standaloneExams } = useMemo(() => {
    if (!groupSeries) {
      return { groupedSeriesList: [], standaloneExams: filteredExams }
    }

    const weeklyList: ExamRow[] = []
    const standalone: ExamRow[] = []

    filteredExams.forEach((ex) => {
      const isW =
        ex.exam_schedule_type === "weekly" ||
        (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0) ||
        Boolean(ex.title?.includes("সাপ্তাহিক")) ||
        Boolean(ex.subject?.includes("সাপ্তাহিক")) ||
        Boolean(ex.result_note?.includes("[WEEKLY_SCHEDULE:")) ||
        Boolean(ex.result_note?.includes("[SERIES_WEEK:")) ||
        Boolean(ex.title?.toUpperCase().includes("WEEKLY-")) ||
        (Number(ex.total_marks) === 350 && !ex.exam_date)

      if (isW) {
        weeklyList.push(ex)
      } else {
        standalone.push(ex)
      }
    })

    // Group weekly exams by explicit series key
    const groupMap = new Map<string, ExamRow[]>()
    weeklyList.forEach((ex) => {
      const key = getExamSeriesKey(ex)
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
      }
      groupMap.get(key)!.push(ex)
    })

    const seriesGroups: Array<{
      groupKey: string
      seriesId: string
      seriesTitle: string
      batchId: string | null
      batchName: string
      branchId: string | null
      branchName: string | null
      firstExam: ExamRow
      latestExam: ExamRow
      allWeeks: ExamRow[]
      totalWeeksCount: number
      isPaused: boolean
      isPublished: boolean
      allNotices: NoticeRow[]
    }> = []

    groupMap.forEach((examsInGroup, key) => {
      // Sort exams chronologically or by series week
      examsInGroup.sort((a, b) => {
        const wA = extractSeriesWeek(a.result_note, a.title) || 0
        const wB = extractSeriesWeek(b.result_note, b.title) || 0
        if (wA !== wB && wA > 0 && wB > 0) return wA - wB
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      })
      const firstExam = examsInGroup[0]
      const latest = examsInGroup[examsInGroup.length - 1]

      const batchName =
        firstExam.batch?.name ||
        batches.find((b) => b.id === firstExam.batch_id)?.name ||
        (Array.isArray(firstExam.batch_ids) && firstExam.batch_ids.length > 0
          ? firstExam.batch_ids.map((id) => batches.find((b) => b.id === id)?.name).filter(Boolean).join(", ")
          : null) ||
        "সকল ব্যাচ (সমন্বিত সিরিজ)"

      const branchName = firstExam.branch?.name || branches.find((br) => br.id === firstExam.branch_id)?.name || null

      const linkedNoticesSet = new Map<string, NoticeRow>()
      examsInGroup.forEach((ex) => {
        getLinkedNotices(ex, notices).forEach((n) => linkedNoticesSet.set(n.id, n))
      })

      const rawSeriesId = extractSeriesId(firstExam.result_note) || extractSeriesId(latest.result_note) || key.replace(/^series_|^legacy_weekly_/, "")
      // Find the latest custom title across the series exams (ignoring auto-generated generic labels like WEEKLY-01, WEEKLY-02)
      const latestCustomTitle = [...examsInGroup].reverse().find(
        (e) => e.title && !/^weekly-?\d+$/i.test(e.title.trim()) && !/^সাপ্তাহিক-?\d+$/i.test(e.title.trim())
      )?.title
      const seriesTitle = latestCustomTitle || firstExam.title || `${batchName} — ধারাবাহিক পরীক্ষা`

      seriesGroups.push({
        groupKey: key,
        seriesId: rawSeriesId,
        seriesTitle,
        batchId: firstExam.batch_id || null,
        batchName,
        branchId: firstExam.branch_id || null,
        branchName,
        firstExam,
        latestExam: latest,
        allWeeks: examsInGroup,
        totalWeeksCount: examsInGroup.length,
        isPaused: examsInGroup.every((e) => e.is_paused),
        isPublished: examsInGroup.some((e) => isExamPublished(e)),
        allNotices: Array.from(linkedNoticesSet.values()),
      })
    })

    return { groupedSeriesList: seriesGroups, standaloneExams: standalone }
  }, [filteredExams, groupSeries, notices, batches, branches])

  // Filtered Notices
  const filteredNotices = useMemo(() => {
    const selectedBatchObj = batches.find(b => b.id === batchFilter)
    const batchName = selectedBatchObj?.name?.toLowerCase()

    return notices.filter(n => {
      if (!isExamOrResultNotice(n)) return false

      // Branch filter
      if (selectedBranchId !== "all") {
        const bIds = Array.isArray(n.branch_ids) ? n.branch_ids : (n.branch_id ? [n.branch_id] : [])
        if (bIds.length > 0 && !bIds.includes(selectedBranchId)) {
          return false
        }
      }

      // Type filter
      if (noticeTypeFilter === "results" && !isResultNotice(n)) return false
      if (noticeTypeFilter === "routine" && !isRoutineNotice(n)) return false

      // Batch filter
      if (batchFilter !== "all" && batchName) {
        const t = (n.title || "").toLowerCase()
        const c = (n.content || "").toLowerCase()
        const mentionsBatch = t.includes(batchName) || c.includes(batchName)
        const linkedExam = exams.find(ex => {
          const inThisBatch = ex.batch_id === batchFilter || (Array.isArray(ex.batch_ids) && ex.batch_ids.includes(batchFilter))
          if (!inThisBatch) return false
          return ex.schedule_notice_id === n.id || (ex.title && (t.includes(ex.title.toLowerCase()) || c.includes(ex.title.toLowerCase())))
        })
        if (!mentionsBatch && !linkedExam) return false
      }

      // Search filter
      if (noticeSearch.trim()) {
        const q = noticeSearch.trim().toLowerCase()
        const matchTitle = n.title?.toLowerCase().includes(q)
        const matchContent = n.content?.toLowerCase().includes(q)
        if (!matchTitle && !matchContent) return false
      }

      return true
    })
  }, [notices, selectedBranchId, batchFilter, batches, exams, noticeSearch, noticeTypeFilter])

  const resultNoticesCount = useMemo(() => {
    return notices.filter(isExamOrResultNotice).length
  }, [notices])

  // Delete Notice Handler
  async function handleDeleteNotice(noticeId: string) {
    setDeletingNoticeId(noticeId)
    try {
      const res = await fetch("/api/notices/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noticeId }),
      })

      if (!res.ok) {
        // Direct Supabase fallback
        const { error: sbErr } = await supabase.from("notices").delete().eq("id", noticeId)
        if (sbErr) throw sbErr
      }

      // Clear schedule_notice_id if any exam referenced it
      setExams(prev => prev.map(ex => ex.schedule_notice_id === noticeId ? { ...ex, schedule_notice_id: null } : ex))
      try {
        await supabase.from("exams").update({ schedule_notice_id: null }).eq("schedule_notice_id", noticeId)
      } catch {}

      setNotices(prev => prev.filter(n => n.id !== noticeId))
      setDeleteConfirmNotice(null)
      if (selectedNoticeForView?.id === noticeId) {
        setSelectedNoticeForView(null)
      }
      toast.success("✓ নোটিশ সফলভাবে মুছে ফেলা হয়েছে (Notice deleted successfully)")
    } catch (err: any) {
      console.error("Delete notice error:", err)
      toast.error(err?.message || "Failed to delete notice")
    } finally {
      setDeletingNoticeId(null)
    }
  }

  // Publish Notice for Exam Handler
  async function handlePublishExamNotice(exam: ExamRow) {
    setPublishingNoticeExamId(exam.id)
    try {
      const isWeekly = exam.exam_schedule_type === "weekly" || (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0)
      const res = await fetch(`/api/exams/${exam.id}/publish-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isWeekly ? "weekly_aggregate" : "results",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish notice")

      if (data.notice) {
        setNotices(prev => [data.notice, ...prev.filter(n => n.id !== data.notice.id)])
        setExams(prev => prev.map(ex => ex.id === exam.id ? { ...ex, schedule_notice_id: data.notice.id, is_public_result: true } : ex))
      }
      toast.success("✓ " + (data.message || "নোটিশ বোর্ডে সফলভাবে প্রকাশিত হয়েছে!"))
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish notice")
    } finally {
      setPublishingNoticeExamId(null)
    }
  }

  async function handleTogglePause(exam: ExamRow) {
    const nextPaused = !exam.is_paused
    setPausingId(exam.id)
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: nextPaused }),
      })
      if (!res.ok) {
        // Direct Supabase fallback
        await supabase.from("exams").update({ is_paused: nextPaused }).eq("id", exam.id)
      }
      setExams(prev => prev.map(ex => ex.id === exam.id ? { ...ex, is_paused: nextPaused } : ex))
      toast.success(nextPaused ? `✓ "${exam.title}" is now PAUSED (স্থগিত)` : `✓ "${exam.title}" is now ACTIVE (সচল)`)
    } catch (err: any) {
      console.error("Toggle pause error:", err)
      toast.error(err?.message || "Failed to toggle pause status")
    } finally {
      setPausingId(null)
    }
  }

  // Computed Total Marks for Online
  const computedTotal = questions.reduce((acc, q) => acc + q.marks, 0)

  function addQuestion() {
    if (!qForm.text) { toast.error("Question text required"); return }
    const newQ: DraftQuestion = {
      id: Math.random().toString(36).slice(2),
      question_type: qForm.type,
      question_text: qForm.text,
      marks: parseInt(qForm.marks) || 1,
      hint_note: qForm.hint,
      sort_order: questions.length
    }
    if (qForm.type === "mcq") {
      newQ.options = [qForm.opt1, qForm.opt2, qForm.opt3, qForm.opt4]
      newQ.correct_answer = newQ.options[parseInt(qForm.correctOption)]
    } else if (qForm.type === "short") {
      newQ.correct_answer = qForm.expectedAnswer
    }

    if (editingQuestion) {
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...newQ, sort_order: q.sort_order } : q))
      setEditingQuestion(null)
    } else {
      setQuestions([...questions, newQ])
    }
    
    // reset form
    setQForm({ type: "mcq", text: "", opt1: "", opt2: "", opt3: "", opt4: "", correctOption: "0", expectedAnswer: "", marks: "5", hint: "" })
  }

  function editQ(q: DraftQuestion) {
    setEditingQuestion(q)
    setQForm({
      type: q.question_type,
      text: q.question_text,
      opt1: q.options?.[0] || "",
      opt2: q.options?.[1] || "",
      opt3: q.options?.[2] || "",
      opt4: q.options?.[3] || "",
      correctOption: q.options ? q.options.indexOf(q.correct_answer || "").toString() : "0",
      expectedAnswer: q.question_type === "short" ? q.correct_answer || "" : "",
      marks: q.marks.toString(),
      hint: q.hint_note || ""
    })
  }

  function removeQ(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handlePublish(id: string) {
    setPublishing(id)
    try {
      const targetExam = exams.find(e => e.id === id)
      const isWeekly = targetExam?.exam_schedule_type === "weekly" || (Array.isArray(targetExam?.recurring_days) && targetExam.recurring_days.length > 0)
      const res = await fetch(`/api/exams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          is_published: true, 
          is_public_result: true,
          is_weekly_published: isWeekly ? true : undefined,
        }),
      })
      if (!res.ok) {
        const { error } = await supabase.from("exams").update({ 
          is_published: true, 
          is_public_result: true,
          is_weekly_published: isWeekly ? true : false,
        }).eq("id", id)
        if (error) throw error
      }
      setExams((prev) => prev.map((ex) => (ex.id === id ? { ...ex, is_published: true, is_public_result: true, is_weekly_published: isWeekly ? true : ex.is_weekly_published } : ex)))
      toast.success("Exam published successfully! Results are now visible in online results portal.")
    } catch (err: any) {
      toast.error(err.message || "Failed to publish exam")
    } finally {
      setPublishing(null)
    }
  }

  async function handleOpenEdit(exam: ExamRow) {
    setEditingExam(exam)
    const isOnline = Boolean(exam.is_online)
    setExamMode(isOnline ? "online" : "offline")

    const isWeekly =
      exam.exam_schedule_type === "weekly" ||
      (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
      Boolean(exam.title?.includes("সাপ্তাহিক")) ||
      Boolean(exam.subject?.includes("সাপ্তাহিক")) ||
      Boolean(exam.result_note?.includes("[WEEKLY_SCHEDULE:")) ||
      (Number(exam.total_marks) === 350 && !exam.exam_date)

    let targetBatchIds: string[] = []
    if (Array.isArray(exam.batch_ids) && exam.batch_ids.length > 0) {
      targetBatchIds = exam.batch_ids
    } else if (exam.batch_id) {
      targetBatchIds = [exam.batch_id]
    }

    // Parse recurring_days if string
    let recDays: any = exam.recurring_days
    if (typeof recDays === "string") {
      try {
        recDays = JSON.parse(recDays)
      } catch {}
    }

    const newSched = defaultWeeklySchedule()
    const dayConfigs: Record<string, any> = {}

    // A. Parse from recurring_days column if present
    if (Array.isArray(recDays) && recDays.length > 0) {
      for (const item of recDays) {
        const isObj = typeof item === "object" && item !== null
        const rawKey = isObj ? (item.day || item.day_bn || item.day_en || "") : String(item)
        const dayKey = String(rawKey).toLowerCase()
        const matched = WEEK_DAYS.find(w => w.id.toLowerCase() === dayKey || w.bn === rawKey)
        if (matched) {
          dayConfigs[matched.id] = {
            selected: true,
            exam_name: isObj && item.exam_name ? item.exam_name : `${matched.bn}ের পরীক্ষা`,
            subject: isObj && item.subject ? item.subject : (exam.subject || ""),
            total_marks: isObj && item.total_marks != null ? String(item.total_marks) : "50",
            pass_marks: isObj && item.pass_marks != null ? String(item.pass_marks) : "20",
          }
        }
      }
    }

    // B. ALWAYS parse [WEEKLY_SCHEDULE:...] from result_note using robust extractor
    // result_note contains the user's latest saved day-by-day marks and names!
    const noteSchedule = extractWeeklyScheduleFromNote(exam.result_note)
    if (Array.isArray(noteSchedule) && noteSchedule.length > 0) {
      for (const item of noteSchedule) {
        const rawKey = item.day || item.day_bn || item.day_en || ""
        const dayKey = String(rawKey).toLowerCase()
        const matched = WEEK_DAYS.find(w => w.id.toLowerCase() === dayKey || w.bn === rawKey)
        if (matched) {
          const existing = dayConfigs[matched.id] || {}
          dayConfigs[matched.id] = {
            selected: true,
            exam_name: item.exam_name || existing.exam_name || `${matched.bn}ের পরীক্ষা`,
            subject: item.subject || existing.subject || exam.subject || "",
            total_marks: item.total_marks != null ? String(item.total_marks) : (existing.total_marks || "50"),
            pass_marks: item.pass_marks != null ? String(item.pass_marks) : (existing.pass_marks || "20"),
          }
        }
      }
    }

    // C. If dayConfigs is still empty, look for a template from other exams in the same series or batch
    if (Object.keys(dayConfigs).length === 0) {
      const siblingExam = exams.find((e) =>
        e.id !== exam.id &&
        (e.batch_id === exam.batch_id || (exam.title && e.title && e.title.slice(0, 6).toLowerCase() === exam.title.slice(0, 6).toLowerCase())) &&
        e.result_note &&
        e.result_note.includes("[WEEKLY_SCHEDULE:")
      )
      if (siblingExam) {
        const sibSchedule = extractWeeklyScheduleFromNote(siblingExam.result_note)
        if (Array.isArray(sibSchedule) && sibSchedule.length > 0) {
          for (const item of sibSchedule) {
            const rawKey = item.day || item.day_bn || item.day_en || ""
            const dayKey = String(rawKey).toLowerCase()
            const matched = WEEK_DAYS.find(w => w.id.toLowerCase() === dayKey || w.bn === rawKey)
            if (matched) {
              dayConfigs[matched.id] = {
                selected: true,
                exam_name: item.exam_name || `${matched.bn}ের পরীক্ষা`,
                subject: item.subject || exam.subject || "",
                total_marks: item.total_marks != null ? String(item.total_marks) : "50",
                pass_marks: item.pass_marks != null ? String(item.pass_marks) : "20",
              }
            }
          }
        }
      }
    }

    if (isWeekly) {
      const hasConfiguredDays = Object.keys(dayConfigs).length > 0
      const examTotal = Number(exam.total_marks) || 350
      const defaultDayTotal = hasConfiguredDays 
        ? String(Math.round(examTotal / Object.keys(dayConfigs).length))
        : (examTotal % 7 === 0 ? String(examTotal / 7) : "50")
      const examPass = Number(exam.pass_marks) || 140
      const defaultDayPass = hasConfiguredDays 
        ? String(Math.round(examPass / Object.keys(dayConfigs).length))
        : (examPass % 7 === 0 ? String(examPass / 7) : "20")
      
      const subjects = (exam.subject || "")
        .split(/[,+;|/]/)
        .map((s: string) => s.trim())
        .filter(Boolean)

      WEEK_DAYS.forEach((w, idx) => {
        if (dayConfigs[w.id]) {
          newSched[w.id as keyof typeof newSched] = {
            ...dayConfigs[w.id],
            total_marks: dayConfigs[w.id].total_marks || defaultDayTotal,
            pass_marks: dayConfigs[w.id].pass_marks || defaultDayPass,
          }
        } else if (!hasConfiguredDays) {
          const daySubject = subjects.length > idx ? subjects[idx] : (subjects.length === 1 && !subjects[0].includes("সাপ্তাহিক") ? subjects[0] : (exam.subject || ""))
          newSched[w.id as keyof typeof newSched] = {
            selected: true,
            exam_name: daySubject && !daySubject.includes("সাপ্তাহিক") ? `${daySubject} পরীক্ষা` : `${w.bn}ের পরীক্ষা`,
            subject: daySubject,
            total_marks: defaultDayTotal,
            pass_marks: defaultDayPass,
          }
        } else {
          newSched[w.id as keyof typeof newSched] = {
            selected: false,
            exam_name: `${w.bn}ের পরীক্ষা`,
            subject: "",
            total_marks: "50",
            pass_marks: "20",
          }
        }
      })
    } else {
      Object.keys(dayConfigs).forEach(k => {
        if (newSched[k as keyof typeof newSched]) {
          newSched[k as keyof typeof newSched] = dayConfigs[k]
        }
      })
    }

    setWeeklySchedule(newSched)

    let cleanedNote = cleanWeeklyScheduleFromNote(exam.result_note)
    cleanedNote = cleanedNote
      .replace(/\[SHOW_ALL_RESULTS:(true|false)\]/g, "")
      .replace(/\[IS_PAUSED:(true|false)\]/g, "")
      .replace(/\[PUBLIC_RESULT:(true|false)\]/g, "")
      .replace(/\[PUBLISHED_DAYS:[^\]]*\]/g, "")
      .replace(/\[IS_WEEKLY_PUBLISHED:(true|false)\]/g, "")
      .trim()

    let initialTitle = exam.title || ""
    if (isWeekly) {
      const sId = extractSeriesId(exam.result_note)
      if (sId) {
        const seriesSibling = [...exams].reverse().find(e => 
          e.result_note?.includes(`[SERIES_ID:${sId}]`) && 
          e.title && !/^weekly-?\d+$/i.test(e.title.trim()) && !/^সাপ্তাহিক-?\d+$/i.test(e.title.trim())
        )
        if (seriesSibling?.title) {
          initialTitle = seriesSibling.title
        }
      }
    }

    setForm({
      title: initialTitle,
      branch_id: exam.branch_id || (selectedBranchId !== "all" ? selectedBranchId : (currentBranch?.id || branches[0]?.id || "")),
      batch_id: exam.batch_id || targetBatchIds[0] || "",
      batch_ids: targetBatchIds,
      exam_schedule_type: isWeekly ? "weekly" : "one_time",
      recurring_days: Array.isArray(recDays) ? recDays : [],
      publish_to_notice: false,
      notice_title: "",
      notice_content: "",
      is_notice_customized: false,
      exam_type: exam.exam_type || "written",
      subject: exam.subject || "",
      total_marks: String(exam.total_marks || "100"),
      pass_marks: String(exam.pass_marks || "33"),
      exam_date: exam.exam_date ? exam.exam_date.slice(0, 10) : "",
      duration_minutes: String(exam.duration_minutes || exam.time_limit_minutes || "60"),
      show_results_immediately: (exam as any).show_results_immediately ?? true,
      show_all_results: (exam as any).show_all_results ?? true,
      result_note: cleanedNote,
    })

    if (isOnline) {
      try {
        const { data: qData } = await supabase
          .from("exam_questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("sort_order", { ascending: true })

        if (qData && qData.length > 0) {
          setQuestions(qData.map(q => ({
            id: q.id,
            question_type: q.question_type as QuestionType,
            question_text: q.question_text,
            options: q.options || [],
            correct_answer: q.correct_answer,
            marks: q.marks,
            hint_note: q.hint_note,
            sort_order: q.sort_order,
          })))
        } else {
          setQuestions([])
        }
      } catch {
        setQuestions([])
      }
    } else {
      setQuestions([])
    }

    setShowModal(true)
  }

  // Support ?edit=EXAM_ID in URL query params (only auto-open once on initial load)
  const hasAutoOpenedEdit = useRef(false)
  useEffect(() => {
    if (typeof window !== "undefined" && exams.length > 0 && !hasAutoOpenedEdit.current) {
      const urlParams = new URLSearchParams(window.location.search)
      const editId = urlParams.get("edit")
      if (editId) {
        const found = exams.find(e => e.id === editId)
        if (found) {
          hasAutoOpenedEdit.current = true
          handleOpenEdit(found)
        }
      }
    }
  }, [exams])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (form.batch_ids.length === 0 && !form.batch_id) {
      toast.error("Please select at least one batch for this exam")
      return
    }

    let activeWeeklyDays: any[] = []
    if (form.exam_schedule_type === "weekly") {
      activeWeeklyDays = WEEK_DAYS.filter(
        (w) => weeklySchedule[w.id as keyof typeof weeklySchedule]?.selected
      ).map((w) => {
        const cfg = weeklySchedule[w.id as keyof typeof weeklySchedule]
        return {
          day: w.id,
          day_bn: w.bn,
          day_short: w.short,
          exam_name: cfg.exam_name.trim() || `${w.bn}ের পরীক্ষা`,
          subject: cfg.subject.trim() || form.subject || "",
          total_marks: parseInt(cfg.total_marks) || 50,
          pass_marks: parseInt(cfg.pass_marks) || 20,
        }
      })

      if (activeWeeklyDays.length === 0) {
        toast.error("সাপ্তাহিক পরীক্ষার জন্য অন্তত একটি দিন সিলেক্ট করুন এবং বিবরণ লিখুন (Please select at least one day and configure exam details)")
        return
      }
    } else {
      if (!form.title.trim()) {
        toast.error("Please enter exam title (পরীক্ষার নাম লিখুন)")
        return
      }
      if (!form.exam_date) {
        toast.error("Please select a date for the one-time exam (এককালীন পরীক্ষার তারিখ নির্ধারণ আবশ্যক)")
        return
      }
    }

    setLoading(true)
    try {
      const selectedBatchIdToUse = form.batch_ids[0] || form.batch_id || null
      const selectedBatchIdsToUse = form.batch_ids.length > 0 ? form.batch_ids : (form.batch_id ? [form.batch_id] : [])

      const finalTitle = form.exam_schedule_type === "weekly"
        ? (form.title.trim() || "WEEKLY-01")
        : form.title

      const finalTotalMarks = form.exam_schedule_type === "weekly"
        ? activeWeeklyDays.reduce((acc, d) => acc + (d.total_marks || 50), 0)
        : (examMode === "online" ? computedTotal : parseInt(form.total_marks))

      const finalPassMarks = form.exam_schedule_type === "weekly"
        ? activeWeeklyDays.reduce((acc, d) => acc + (d.pass_marks || 20), 0)
        : parseInt(form.pass_marks)

      const finalSubject = form.exam_schedule_type === "weekly"
        ? (form.subject.trim() || activeWeeklyDays.map(d => d.subject).filter(Boolean).join(", ") || "সাপ্তাহিক বিষয়সমূহ")
        : (form.subject || null)

      // 1. UPDATE EXISTING EXAM
      if (editingExam) {
        const updatePayload: any = {
          title: finalTitle,
          branch_id: form.branch_id || (selectedBranchId !== "all" ? selectedBranchId : null),
          batch_id: selectedBatchIdToUse,
          batch_ids: selectedBatchIdsToUse,
          exam_schedule_type: form.exam_schedule_type,
          recurring_days: form.exam_schedule_type === "weekly" ? activeWeeklyDays : [],
          exam_type: form.exam_type,
          subject: finalSubject,
          total_marks: finalTotalMarks,
          pass_marks: finalPassMarks,
          exam_date: form.exam_schedule_type === "one_time" ? (form.exam_date || null) : null,
          is_online: examMode === "online",
          time_limit_minutes: examMode === "online" ? parseInt(form.duration_minutes) : null,
          duration_minutes: examMode === "offline" ? parseInt(form.duration_minutes) : null,
          show_results_immediately: form.show_results_immediately,
          show_all_results: form.show_all_results,
          result_note: (form.result_note 
            ? cleanWeeklyScheduleFromNote(form.result_note).replace(/\[SHOW_ALL_RESULTS:(true|false)\]/g, "").trim() + " " 
            : "") + 
            `[SHOW_ALL_RESULTS:${form.show_all_results}]` +
            (form.exam_schedule_type === "weekly" 
              ? ` [WEEKLY_SCHEDULE:${JSON.stringify(activeWeeklyDays)}] [WEEKLY_DAYS:${activeWeeklyDays.map(d => d.day).join(",")}]` 
              : ""),
        }

        const res = await fetch(`/api/exams/${editingExam.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        })

        let updatedData: any = null
        if (res.ok) {
          const resJson = await res.json()
          updatedData = resJson.exam
        } else {
          const { data: sbUpdated, error: sbErr } = await supabase
            .from("exams")
            .update(updatePayload)
            .eq("id", editingExam.id)
            .select("*, batch:batches(name), branch:branches(id, name)")
            .single()

          if (sbErr) {
            const { 
              batch_ids: _b, 
              branch_id: _br, 
              exam_schedule_type: _st, 
              recurring_days: _rd, 
              show_all_results: _sar,
              show_results_immediately: _sri,
              is_paused: _ip,
              is_public_result: _ipr,
              is_weekly_published: _iwp,
              published_days: _pd,
              schedule_notice_id: _sn,
              duration_minutes: _dm,
              time_limit_minutes: _tlm,
              ...fb 
            } = updatePayload
            let { data: fbData, error: fbErr } = await supabase
              .from("exams")
              .update(fb)
              .eq("id", editingExam.id)
              .select("*, batch:batches(name)")
              .maybeSingle()

            if (fbErr) {
              const coreBase = {
                title: fb.title,
                exam_type: fb.exam_type,
                subject: fb.subject,
                total_marks: fb.total_marks,
                pass_marks: fb.pass_marks,
                exam_date: fb.exam_date,
                batch_id: fb.batch_id,
                is_published: fb.is_published,
                is_online: fb.is_online,
                result_note: fb.result_note,
              }
              const { data: cData, error: cErr } = await supabase
                .from("exams")
                .update(coreBase)
                .eq("id", editingExam.id)
                .select("*")
                .maybeSingle()
              if (cErr) throw cErr
              fbData = cData
            }
            updatedData = { ...fbData, ...updatePayload }
          } else {
            updatedData = sbUpdated
          }
        }

        if (examMode === "online" && questions.length > 0) {
          await supabase.from("exam_questions").delete().eq("exam_id", editingExam.id)
          const qInserts = questions.map((q, i) => ({
            exam_id: editingExam.id,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options || null,
            correct_answer: q.correct_answer || null,
            marks: q.marks,
            hint_note: q.hint_note || null,
            sort_order: i
          }))
          await supabase.from("exam_questions").insert(qInserts)
        }

        if (form.publish_to_notice) {
          try {
            await fetch(`/api/exams/${editingExam.id}/publish-notice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "schedule" }),
            })
          } catch {}
        }

        const matchedBatch = batches.find(b => b.id === selectedBatchIdToUse)
        const finalUpdatedExam: ExamRow = {
          ...editingExam,
          ...(updatedData || {}),
          ...updatePayload, // Ensure updated activeWeeklyDays and marks take precedence in local state
          batch: matchedBatch ? { name: matchedBatch.name } : editingExam.batch,
        }

        const curSeriesId = extractSeriesId(editingExam.result_note)
        if (curSeriesId) {
          try {
            await supabase
              .from("exams")
              .update({ title: finalTitle })
              .ilike("result_note", `%[SERIES_ID:${curSeriesId}]%`)
          } catch (syncErr) {
            console.warn("Failed to sync series title to other weeks in series:", syncErr)
          }
        }

        setExams(prev => prev.map(ex => {
          if (ex.id === editingExam.id) return finalUpdatedExam
          if (curSeriesId && ex.result_note?.includes(`[SERIES_ID:${curSeriesId}]`)) {
            return { ...ex, title: finalTitle }
          }
          return ex
        }))
        toast.success(`✓ "${finalTitle}" updated successfully! (পরীক্ষা আপডেট সম্পন্ন হয়েছে)`)
        setShowModal(false)
        resetForm()
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href)
          if (url.searchParams.has("edit")) {
            url.searchParams.delete("edit")
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""))
          }
        }
        router.refresh()
        setLoading(false)
        return
      }

      // 2. CREATE NEW EXAM
      const examData: any = {
        title: finalTitle, 
        branch_id: form.branch_id || (selectedBranchId !== "all" ? selectedBranchId : null), 
        batch_id: selectedBatchIdToUse, 
        batch_ids: selectedBatchIdsToUse,
        exam_schedule_type: form.exam_schedule_type,
        recurring_days: form.exam_schedule_type === "weekly" ? activeWeeklyDays : [],
        is_paused: false,
        is_public_result: false,
        exam_type: form.exam_type,
        subject: finalSubject, 
        total_marks: finalTotalMarks, 
        pass_marks: finalPassMarks,
        exam_date: form.exam_schedule_type === "one_time" ? (form.exam_date || null) : null, 
        is_online: examMode === "online",
        time_limit_minutes: examMode === "online" ? parseInt(form.duration_minutes) : null,
        duration_minutes: examMode === "offline" ? parseInt(form.duration_minutes) : null,
        show_results_immediately: form.show_results_immediately,
        show_all_results: form.show_all_results,
        result_note: (() => {
          let baseNote = form.result_note ? form.result_note.trim() + " " : ""
          if (form.exam_schedule_type === "weekly" && !baseNote.includes("[SERIES_ID:")) {
            const newSeriesId = `series_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            baseNote = `[SERIES_ID:${newSeriesId}] [SERIES_WEEK:1] ` + baseNote
          }
          return (baseNote + 
            `[SHOW_ALL_RESULTS:${form.show_all_results}]` +
            (form.exam_schedule_type === "weekly" 
              ? ` [WEEKLY_SCHEDULE:${JSON.stringify(activeWeeklyDays)}] [WEEKLY_DAYS:${activeWeeklyDays.map(d => d.day).join(",")}]` 
              : "")).trim()
        })(),
        is_published: false
      }

      let newExam: any = null
      const { data: inserted, error: examErr } = await supabase.from("exams")
        .insert(examData).select("*, batch:batches(name), branch:branches(id, name)").single()
      
      if (examErr) {
        // Fallback if column batch_ids/branch_id/exam_schedule_type doesn't exist yet
        const { 
          batch_ids: _b, 
          branch_id: _br, 
          show_all_results: _omitted, 
          show_results_immediately: _sri,
          duration_minutes: _dm,
          exam_schedule_type: _st, 
          recurring_days: _rd, 
          is_paused: _ip, 
          is_public_result: _ipr, 
          ...fallbackData 
        } = examData

        const { data: fbExam, error: fbErr } = await supabase.from("exams")
          .insert(fallbackData).select("*, batch:batches(name)").single()
        if (fbErr) throw fbErr
        newExam = { 
          ...fbExam, 
          batch_ids: selectedBatchIdsToUse, 
          exam_schedule_type: form.exam_schedule_type, 
          recurring_days: form.recurring_days,
          is_paused: false,
          is_public_result: false
        }
      } else {
        newExam = inserted
      }

      if (examMode === "online" && questions.length > 0) {
        const qInserts = questions.map((q, i) => ({
          exam_id: newExam.id,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options || null,
          correct_answer: q.correct_answer || null,
          marks: q.marks,
          hint_note: q.hint_note || null,
          sort_order: i
        }))
        const { error: qErr } = await supabase.from("exam_questions").insert(qInserts)
        if (qErr) throw qErr
      }

      // If user selected "Publish exam schedule to Notice Board"
      let noticePublished = false
      if (form.publish_to_notice && newExam?.id) {
        try {
          const nRes = await fetch(`/api/exams/${newExam.id}/publish-notice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              type: "schedule",
              custom_title: form.notice_title?.trim() || undefined,
              custom_content: form.notice_content?.trim() || undefined,
            }),
          })
          if (nRes.ok) {
            noticePublished = true
          } else {
            toast.warning("Notice Board posting failed — please try manually. (নোটিশ বোর্ডে পোস্ট ব্যর্থ হয়েছে)")
          }
        } catch (nErr) {
          console.warn("Notice publish err:", nErr)
          toast.warning("Notice Board posting failed — please try manually. (নোটিশ বোর্ডে পোস্ট ব্যর্থ হয়েছে)")
        }
      }

      setExams([{ ...newExam, exam_questions: [{ count: questions.length }] }, ...exams])
      setShowModal(false)
      
      if (noticePublished) {
        toast.success(`✓ "${finalTitle}" created & posted to Notice Board! (পরীক্ষা তৈরি ও নোটিশ বোর্ডে প্রকাশিত)`)
      } else {
        toast.success(`✓ "${finalTitle}" created successfully! (পরীক্ষা তৈরি সম্পন্ন হয়েছে)`)
      }
      
      // Reset form
      resetForm()
      router.refresh()
    } catch (err: any) { 
      toast.error(err.message || "Failed") 
    } finally { 
      setLoading(false) 
    }
  }

  async function handleDeleteExam(examId: string) {
    setDeletingId(examId)
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Failed to delete exam from server")
      }

      // Remove the deleted exam from local state
      setExams((prev) => prev.filter((e) => e.id !== examId))

      // Also clean up any linked notices from local state
      if (deleteConfirmExam?.schedule_notice_id) {
        setNotices((prev) => prev.filter((n) => n.id !== deleteConfirmExam.schedule_notice_id))
      }
      if (deleteConfirmExam?.title) {
        setNotices((prev) => prev.filter((n) => !n.title?.includes(deleteConfirmExam.title)))
      }

      toast.success("✓ Exam deleted successfully! (পরীক্ষা সফলভাবে মুছে ফেলা হয়েছে)")
      setDeleteConfirmExam(null)
      setDeleteConfirmSeries(null)
      router.refresh()
    } catch (err: any) {
      console.error("Delete exam error:", err)
      toast.error(err?.message || "Failed to delete exam")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteEntireSeries(group: any) {
    if (!group || !group.allWeeks || group.allWeeks.length === 0) return
    const weekIds = group.allWeeks.map((w: any) => w.id)
    setDeletingId(group.groupKey)
    try {
      await Promise.all(
        weekIds.map((id: string) =>
          fetch(`/api/exams/${id}`, { method: "DELETE" }).then((res) => {
            if (!res.ok) throw new Error("Failed to delete exam from server")
            return res.json().catch(() => ({}))
          })
        )
      )

      // Remove from local state
      setExams((prev) => prev.filter((e) => !weekIds.includes(e.id)))

      // Clean up linked notices
      if (group.allNotices && group.allNotices.length > 0) {
        const noticeIds = group.allNotices.map((n: any) => n.id)
        setNotices((prev) => prev.filter((n) => !noticeIds.includes(n.id)))
      }

      toast.success(`✓ "${group.seriesTitle}" পরীক্ষার সকল সপ্তাহ সফলভাবে মুছে ফেলা হয়েছে!`)
      setDeleteConfirmSeries(null)
      router.refresh()
    } catch (err: any) {
      console.error("Failed to delete exam series:", err)
      toast.error(err?.message || "Failed to delete exam series")
    } finally {
      setDeletingId(null)
    }
  }

  function renderSingleExam(exam: ExamRow) {
    const isWeekly =
      exam.exam_schedule_type === "weekly" ||
      (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
      Boolean(exam.title?.includes("সাপ্তাহিক")) ||
      Boolean(exam.subject?.includes("সাপ্তাহিক")) ||
      Boolean(exam.result_note?.includes("[WEEKLY_SCHEDULE:")) ||
      (Number(exam.total_marks) === 350 && !exam.exam_date)

    let recurringDaysList: any[] = []
    if (Array.isArray(exam.recurring_days)) {
      recurringDaysList = exam.recurring_days
    } else if (typeof exam.recurring_days === "string") {
      try {
        recurringDaysList = JSON.parse(exam.recurring_days)
      } catch {}
    }
    if (recurringDaysList.length === 0 && exam.result_note?.includes("[WEEKLY_SCHEDULE:")) {
      try {
        const match = exam.result_note.match(/\[WEEKLY_SCHEDULE:(.*?)\]/)
        if (match && match[1]) {
          recurringDaysList = JSON.parse(match[1])
        }
      } catch {}
    }

    const daysBengali = recurringDaysList.map((d: any) => {
      if (typeof d === "object" && d !== null) {
        return `${d.day_bn || d.day}: ${d.exam_name || "পরীক্ষা"} (${d.total_marks || ""} নম্বর)`
      }
      return WEEK_DAYS.find(w => w.id === d)?.short || d
    }).join(", ")

    const linkedNoticeList = getLinkedNotices(exam, notices)

    return (
      <div key={exam.id} className={cn(
        "bg-white rounded-2xl border shadow-sm p-5 shadow-xl transition-all flex flex-col h-full",
        exam.is_paused ? "border-rose-200 bg-rose-50/20" : "border-slate-200/90 hover:border-amber-500/40"
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2.5 rounded-xl border mt-0.5", 
              exam.is_online 
                ? "bg-blue-50 text-blue-600 border-blue-200" 
                : isWeekly
                  ? "bg-purple-50 text-purple-600 border-purple-200"
                  : "bg-amber-50 text-amber-600 border-amber-200"
            )}>
              {exam.is_online ? <Globe className="w-5 h-5" /> : isWeekly ? <CalendarDays className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-extrabold text-slate-900 text-base leading-snug">{exam.title}</p>
                {exam.is_paused && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                    PAUSED (স্থগিত)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{exam.subject || "General Subject"}</p>
              
              {/* Configured Batches & Branch badges */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {exam.branch?.name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Landmark className="w-2.5 h-2.5" /> {exam.branch.name}
                  </span>
                )}
                {Array.isArray(exam.batch_ids) && exam.batch_ids.length > 0 ? (
                  exam.batch_ids.map(bId => {
                    const bName = batches.find(b => b.id === bId)?.name || (exam.batch_id === bId ? exam.batch?.name : null)
                    if (!bName) return null
                    return (
                      <span key={bId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                        <BookOpen className="w-2.5 h-2.5 text-amber-600" /> {bName}
                      </span>
                    )
                  })
                ) : exam.batch?.name ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                    <BookOpen className="w-2.5 h-2.5 text-amber-600" /> {exam.batch.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    All Batches
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold border", isExamPublished(exam) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                {isExamPublished(exam) ? "Published" : "Draft"}
              </span>
              <button
                type="button"
                onClick={() => handleOpenEdit(exam)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                title="Edit Exam (পরীক্ষা সম্পাদনা করুন)"
              >
                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmExam(exam)}
                disabled={deletingId === exam.id}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                title="Delete Exam"
              >
                {deletingId === exam.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {isWeekly ? (
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> WEEKLY
                </span>
              ) : (
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                  ONE-TIME
                </span>
              )}
              {exam.is_online && <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-extrabold">ONLINE</span>}
              {exam.is_public_result && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold" title="Public in Online Results portal">
                  PUBLIC RESULT
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm mt-3 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex-grow">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 font-medium">Total Marks</span>
            <span className="font-extrabold text-amber-700 text-sm">
              {isWeekly && Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0
                ? exam.recurring_days.reduce((acc: number, d: any) => acc + (Number(d?.total_marks) || 50), 0)
                : exam.total_marks}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500 font-medium">
              {isWeekly ? "Weekly Day(s)" : "Exam Date"}
            </span>
            <span className="font-semibold text-slate-800 text-sm truncate">
              {isWeekly 
                ? (daysBengali ? `প্রতি ${daysBengali}` : "সাপ্তাহিক নির্ধারিত দিন")
                : (exam.exam_date ? formatDate(exam.exam_date) : "TBD")}
            </span>
          </div>
          {exam.is_online && (
            <>
              <div className="flex flex-col"><span className="text-[11px] text-slate-500 font-medium">Duration</span><span className="font-semibold text-slate-800 text-sm">{exam.time_limit_minutes} min</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-slate-500 font-medium">Questions</span><span className="font-semibold text-slate-800 text-sm">{exam.exam_questions?.[0]?.count || 0}</span></div>
            </>
          )}
          {isWeekly && (
            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200 mt-1">
              <span className="text-[11px] text-slate-500 font-medium">Weekly Status:</span>
              <button
                type="button"
                onClick={() => handleTogglePause(exam)}
                disabled={pausingId === exam.id}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-colors border cursor-pointer",
                  exam.is_paused 
                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs" 
                    : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-2xs"
                )}
              >
                {pausingId === exam.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : exam.is_paused ? (
                  <>
                    <Play className="w-3 h-3 text-rose-600 fill-rose-600" />
                    <span>Resume (সচল করুন)</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3 text-amber-700 fill-amber-700" />
                    <span>Pause (স্থগিত করুন)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Linked Notice Section on Exam Card */}
        {linkedNoticeList.length > 0 ? (
          <div className="mb-3 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                <Bell className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-950 truncate" title={linkedNoticeList[0].title}>
                  {linkedNoticeList[0].title}
                </p>
                <p className="text-[10px] text-amber-700 font-semibold">
                  {linkedNoticeList.length > 1 ? `${linkedNoticeList.length}টি নোটিশ সক্রিয় • ` : ""}নোটিশ বোর্ডে প্রকাশিত
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedNoticeForView(linkedNoticeList[0])}
                className="p-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="View Notice (নোটিশ দেখুন)"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmNotice(linkedNoticeList[0])}
                disabled={deletingNoticeId === linkedNoticeList[0].id}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Delete Notice (নোটিশ ডিলিট করুন)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : isExamPublished(exam) ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => handlePublishExamNotice(exam)}
              disabled={publishingNoticeExamId === exam.id}
              className="w-full py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 border-dashed rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="ফলাফল নোটিশ বোর্ডে পোস্ট করুন"
            >
              {publishingNoticeExamId === exam.id ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>নোটিশ তৈরি হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>নোটিশ বোর্ডে প্রকাশ করুন (Publish Notice)</span>
                </>
              )}
            </button>
          </div>
        ) : null}

        <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 mt-auto">
          <div className="flex items-center gap-2 w-full">
            {exam.is_online ? (
              <>
                {!exam.is_published && (
                  <button onClick={() => handlePublish(exam.id)} disabled={publishing === exam.id} className="flex-1 flex justify-center items-center gap-1.5 text-xs sm:text-sm py-2 px-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-50 font-bold transition-colors cursor-pointer">
                    {publishing === exam.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />} Publish
                  </button>
                )}
                <Link href={`/dashboard/owner/exams/${exam.id}/questions`} className="flex-1 flex justify-center items-center gap-1.5 text-xs sm:text-sm py-2 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors border border-slate-300">
                  <Eye className="w-3.5 h-3.5" /> Questions
                </Link>
              </>
            ) : (
              <Link href={`/dashboard/owner/exams/${exam.id}`} className="flex-1 flex justify-center items-center gap-2 py-2 bg-amber-500/15 text-amber-900 border border-amber-500/30 rounded-xl text-xs sm:text-sm font-bold hover:bg-amber-500/25 transition-colors">
                <Trophy className="w-4 h-4 text-amber-600" /> Enter Results & Merit
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => handleOpenEdit(exam)}
              className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-indigo-600" /> Edit Exam
            </button>
            <Link
              href={`/dashboard/owner/sms?exam_id=${exam.id}&mode=exam_result`}
              className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> Result SMS
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl overflow-x-auto shadow-2xs">
            {[
              { id: "all", label: "All" },
              { id: "one_time", label: "One-Time" },
              { id: "weekly", label: "Weekly" },
              { id: "published", label: "Published" },
              { id: "draft", label: "Draft" },
              { id: "online", label: "Online" }
            ].map(({ id, label }) => (
              <button 
                key={id} 
                onClick={() => setStatusFilter(id as any)} 
                className={cn(
                  "px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg capitalize transition-all whitespace-nowrap", 
                  statusFilter === id ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Dedicated Result & Exam Notices Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter("notices")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all border whitespace-nowrap shadow-2xs cursor-pointer",
              statusFilter === "notices"
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 hover:border-amber-400"
            )}
          >
            <Bell className={cn("w-4 h-4", statusFilter === "notices" ? "text-white fill-white" : "text-amber-600 fill-amber-600")} />
            <span>Result & Exam Notices (ফলাফল নোটিশ)</span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-black",
              statusFilter === "notices" ? "bg-white text-amber-700" : "bg-amber-200 text-amber-950"
            )}>
              {resultNoticesCount}
            </span>
          </button>

          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={inputClass + " w-48 font-semibold"}>
            <option value="all" className="bg-white text-slate-900">All Batches (সব ব্যাচ)</option>
            {availableBatches.map(b => <option key={b.id} value={b.id} className="bg-white text-slate-900">{b.name}</option>)}
          </select>

          <button
            type="button"
            onClick={() => setGroupSeries(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border transition-all whitespace-nowrap cursor-pointer shadow-2xs",
              groupSeries
                ? "bg-purple-100/90 hover:bg-purple-200 text-purple-950 border-purple-300"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            )}
            title="সাপ্তাহিক পরীক্ষাসমূহ ব্যাচভিত্তিক এক কার্ডে দেখুন অথবা আলাদা আলাদা কার্ডে দেখুন"
          >
            <Layers className={cn("w-4 h-4", groupSeries ? "text-purple-700" : "text-slate-500")} />
            <span>{groupSeries ? "সিরিজ একত্রিত (Grouped)" : "আলাদা কার্ড (Flat)"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 min-w-fit">
          <button 
            type="button"
            onClick={handleOpenNewWeeklyExam} 
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-purple-500/20 hover:scale-[1.02] transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="নতুন ধারাবাহিক সাপ্তাহিক পরীক্ষা শুরু করুন (WEEKLY-XX)"
          >
            <CalendarDays className="w-4 h-4 text-purple-200" />
            <span>+ New Weekly Exam (নতুন সপ্তাহ)</span>
          </button>

          <button 
            type="button"
            onClick={handleOpenCreate} 
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Create Exam
          </button>
        </div>
      </div>

      {/* NOTICES MANAGEMENT VIEW (When "notices" tab is active) */}
      {statusFilter === "notices" ? (
        <div className="space-y-5">
          {/* Header Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                  <Bell className="w-6 h-6 fill-white" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    পরীক্ষার ফলাফল ও রুটিন নোটিশ ব্যবস্থাপনা (Live Notices)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    ওয়েবসাইট ও স্টুডেন্ট পোর্টালে প্রকাশিত ফলাফল ও রুটিন নোটিশ দেখুন এবং অপ্রয়োজনীয় নোটিশ এখান থেকেই সরাসরি মুছে ফেলুন।
                  </p>
                </div>
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: "all", label: `সকল নোটিশ (${notices.filter(isExamOrResultNotice).length})` },
                  { id: "results", label: `🏆 ফলাফল নোটিশ (${notices.filter(isResultNotice).length})` },
                  { id: "routine", label: `📋 রুটিন নোটিশ (${notices.filter(isRoutineNotice).length})` },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNoticeTypeFilter(id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                      noticeTypeFilter === id
                        ? "bg-amber-500 text-white border-amber-500 shadow-2xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={noticeSearch}
                onChange={e => setNoticeSearch(e.target.value)}
                placeholder="নোটিশের শিরোনাম, বিষয়, বা ব্যাচের নাম দিয়ে সার্চ করুন..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
              {noticeSearch && (
                <button
                  type="button"
                  onClick={() => setNoticeSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Notice Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNotices.map(notice => {
              const isRes = isResultNotice(notice)
              const isRout = isRoutineNotice(notice)

              // Try finding matching exam safely
              const linkedExam = exams.find((e) => {
                if (e.schedule_notice_id === notice.id) return true
                if (!e.title) return false
                const nT = String(notice.title || "").toLowerCase()
                const nC = String(notice.content || "").toLowerCase()
                const eT = String(e.title).toLowerCase()
                return nT.includes(eT) || nC.includes(eT)
              })

              return (
                <div
                  key={notice.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between h-full"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={cn(
                          "p-2.5 rounded-xl border shrink-0 mt-0.5",
                          isRes
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : isRout
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {isRes ? <Trophy className="w-5 h-5 text-amber-600" /> : isRout ? <FileText className="w-5 h-5 text-purple-600" /> : <Bell className="w-5 h-5 text-blue-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm leading-snug break-words">
                            {notice.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                              <CalendarDays className="w-3 h-3 text-slate-400" />
                              {formatDate(notice.notice_date || notice.created_at)}
                            </span>
                            {isRes && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                ফলাফল নোটিশ
                              </span>
                            )}
                            {isRout && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                রুটিন নোটিশ
                              </span>
                            )}
                            {notice.priority === "high" && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                জরুরি
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Delete Trash Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmNotice(notice)}
                        disabled={deletingNoticeId === notice.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 border border-transparent hover:border-rose-200 cursor-pointer"
                        title="Delete Notice (নোটিশ মুছুন)"
                      >
                        {deletingNoticeId === notice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Preview Content */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 font-normal leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto mb-4">
                      {notice.content}
                    </div>

                    {linkedExam && (
                      <div className="mb-3 px-2.5 py-1.5 bg-indigo-50/70 border border-indigo-200/80 rounded-lg flex items-center justify-between text-[11px] text-indigo-900 font-semibold">
                        <span className="truncate">সংযুক্ত পরীক্ষা: {linkedExam.title}</span>
                        <Link href={`/dashboard/owner/exams/${linkedExam.id}`} className="text-indigo-600 hover:text-indigo-800 underline font-bold shrink-0 ml-1">
                          মেধা তালিকা
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedNoticeForView(notice)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      <span>সম্পূর্ণ পড়ুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmNotice(notice)}
                      disabled={deletingNoticeId === notice.id}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>নোটিশ মুছুন</span>
                    </button>
                  </div>
                </div>
              )
            })}

            {filteredNotices.length === 0 && (
              <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 shadow-xs space-y-3">
                <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">কোনো ফলাফল বা রুটিন নোটিশ পাওয়া যায়নি।</p>
                <p className="text-xs text-slate-400">পরীক্ষার ফলাফল প্রকাশের পর নোটিশ বোর্ডে প্রকাশ করলে তা এখানে প্রদর্শিত হবে।</p>
                {(noticeSearch || noticeTypeFilter !== "all" || batchFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => { setNoticeSearch(""); setNoticeTypeFilter("all"); setBatchFilter("all") }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-amber-600 transition-all cursor-pointer inline-block"
                  >
                    ফিল্টার রিসেট করুন
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Active Result Notices Notification Banner */}
          {resultNoticesCount > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/80 to-orange-50/60 border border-amber-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bell className="w-5 h-5 fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      ফলাফল ও পরীক্ষার নোটিশ সক্রিয় রয়েছে ({resultNoticesCount}টি নোটিশ)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                      LIVE NOTICES
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    ওয়েবসাইট ও স্টুডেন্ট পোর্টালে ফলাফল ও রুটিন প্রদর্শিত হচ্ছে। এখান থেকেই নোটিশ দেখুন বা সরাসরি ডিলিট করুন।
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setStatusFilter("notices")}
                  className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-600" />
                  <span>সকল নোটিশ দেখুন ও মুছুন ({resultNoticesCount})</span>
                </button>
              </div>
            </div>
          )}

          {/* Exam Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupSeries ? (
              <>
                {groupedSeriesList.map((group) => {
                  return (
                    <div
                      key={`series-${group.groupKey}`}
                      className={cn(
                        "bg-white rounded-2xl border-2 shadow-sm hover:shadow-xl transition-all p-5 flex flex-col justify-between h-full relative overflow-hidden",
                        group.isPaused
                          ? "border-rose-300 bg-rose-50/20"
                          : "border-purple-200/90 hover:border-purple-400 bg-gradient-to-br from-white via-purple-50/15 to-indigo-50/15"
                      )}
                    >
                      <div>
                        {/* Series Header */}
                        <div className="flex items-start justify-between mb-3.5 gap-2">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl border mt-0.5 bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-sm shadow-purple-500/20 shrink-0">
                              <CalendarDays className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                  <Trophy className="w-3 h-3 text-purple-600" />
                                  ধারাবাহিক সিরিজ (SERIES)
                                </span>
                                {group.isPaused && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                                    PAUSED
                                  </span>
                                )}
                              </div>
                              <h3 className="font-extrabold text-slate-900 text-base leading-snug mt-1">
                                {group.seriesTitle}
                              </h3>
                              <p className="text-xs text-purple-700 font-semibold mt-0.5">
                                {group.batchName} • মোট {group.totalWeeksCount}টি সপ্তাহ সক্রিয় • প্রতি সপ্তাহ {group.latestExam.total_marks || 350} নম্বর
                              </p>

                              {/* Badges for Branch & Batch */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {group.branchName && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    <Landmark className="w-2.5 h-2.5" /> {group.branchName}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <BookOpen className="w-2.5 h-2.5 text-amber-600" /> {group.batchName}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 items-end shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-xs font-bold border",
                                  group.isPublished
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}
                              >
                                {group.isPublished ? "Published" : "Draft"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(group.firstExam)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                                title="Edit Exam Series (সিরিজ সম্পাদনা)"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmSeries(group)}
                                disabled={deletingId === group.groupKey}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                                title={`Delete ${group.seriesTitle}`}
                              >
                                {deletingId === group.groupKey ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* All Weeks Pills */}
                        <div className="my-3 p-3 bg-purple-50/60 rounded-xl border border-purple-200/80">
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[11px] font-black text-purple-950 flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5 text-purple-700" />
                              সকল সপ্তাহ ({group.totalWeeksCount}টি সপ্তাহ):
                            </span>
                            <span className="text-[10px] text-purple-600 font-bold">
                              সপ্তাহে ক্লিক করে নম্বর দিন
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {group.allWeeks.map((we, idx) => {
                              const wNum = idx + 1 // Always starts from 1, then 2, 3, 4 sequentially
                              const isPub = isExamPublished(we)
                              return (
                                <Link
                                  key={we.id}
                                  href={`/dashboard/owner/exams/${we.id}`}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 border shadow-2xs hover:scale-105",
                                    isPub
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-white hover:bg-purple-100 text-purple-900 border-purple-300"
                                  )}
                                  title={`${we.title} (${isPub ? "প্রকাশিত" : "ড্রাফট"})`}
                                >
                                  <span>W{wNum}</span>
                                  <span className={cn("w-1.5 h-1.5 rounded-full", isPub ? "bg-emerald-500" : "bg-amber-400")} />
                                </Link>
                              )
                            })}

                            <button
                              type="button"
                              disabled={creatingWeekForSeriesId === group.groupKey}
                              onClick={() => handleCreateNextWeekForSeries(group)}
                              className="px-2 py-1 rounded-lg text-xs font-bold bg-white hover:bg-purple-100 text-purple-700 border border-purple-300 border-dashed flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                              title="পরবর্তী সপ্তাহ যোগ করুন"
                            >
                              {creatingWeekForSeriesId === group.groupKey ? (
                                <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                              ) : (
                                <Plus className="w-3 h-3 text-purple-600" />
                              )}
                              <span>নতুন সপ্তাহ</span>
                            </button>
                          </div>
                        </div>

                        {/* Linked Notices on Series Card */}
                        {group.allNotices.length > 0 && (
                          <div className="mb-3 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300">
                                <Bell className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-amber-950 truncate" title={group.allNotices[0].title}>
                                  {group.allNotices[0].title}
                                </p>
                                <p className="text-[10px] text-amber-700 font-semibold">
                                  {group.allNotices.length > 1 ? `${group.allNotices.length}টি নোটিশ সক্রিয় • ` : ""}নোটিশ বোর্ডে প্রকাশিত
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedNoticeForView(group.allNotices[0])}
                                className="p-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                title="View Notice"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmNotice(group.allNotices[0])}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                title="Delete Notice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions Footer */}
                      <div className="pt-3 border-t border-purple-100 flex flex-col gap-2 mt-auto">
                        <div className="flex items-center gap-2 w-full">
                          <Link
                            href={`/dashboard/owner/exams/${group.latestExam.id}`}
                            className="flex-1 flex justify-center items-center gap-2 py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-purple-500/20 transition-all hover:scale-[1.01]"
                            title="সাপ্তাহিক পরীক্ষার হাবে প্রবেশ করুন যেখানে সব সপ্তাহ ও নম্বর রয়েছে"
                          >
                            <Trophy className="w-4 h-4 text-amber-300" />
                            <span>সাপ্তাহিক হাব ও ফলাফল প্রবেশ</span>
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 w-full">
                          <Link
                            href={`/dashboard/owner/exams/${group.latestExam.id}?tab=all_weeks_combined`}
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                            title="সকল সপ্তাহের সমন্বিত মেধা তালিকা দেখুন"
                          >
                            <Award className="w-3.5 h-3.5 text-blue-600" />
                            <span>সমন্বিত মেধা</span>
                          </Link>
                          <Link
                            href={`/dashboard/owner/sms?exam_id=${group.latestExam.id}&mode=exam_result`}
                            className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> Result SMS
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleTogglePause(group.latestExam)}
                            disabled={pausingId === group.latestExam.id}
                            className={cn(
                              "px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center",
                              group.isPaused
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                            )}
                            title={group.isPaused ? "Resume Series" : "Pause Series"}
                          >
                            {group.isPaused ? <Play className="w-3.5 h-3.5 fill-rose-600 text-rose-600" /> : <Pause className="w-3.5 h-3.5 text-slate-600" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {standaloneExams.map((exam) => renderSingleExam(exam))}

                {groupedSeriesList.length === 0 && standaloneExams.length === 0 && (
                  <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 shadow-xs">No exams match your filters.</div>
                )}
              </>
            ) : (
              <>
                {filteredExams.map((exam) => renderSingleExam(exam))}
                {filteredExams.length === 0 && (
                  <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 shadow-xs">No exams match your filters.</div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Analytics Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xs">
        <h3 className="text-lg font-extrabold text-slate-900 mb-1">Exam Analytics & Notifications</h3>
        <p className="text-xs text-slate-500 font-medium">Performance summary, publication status, and active notices</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">Total Exams</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{exams.length}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">Published Results</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{exams.filter(isExamPublished).length}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">Online Exams</p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">{exams.filter(e => e.is_online).length}</p>
          </div>
          <div
            onClick={() => setStatusFilter("notices")}
            className="bg-amber-50 hover:bg-amber-100 p-4 rounded-xl border border-amber-200 cursor-pointer transition-all shadow-2xs"
            title="Click to view all notices"
          >
            <p className="text-xs text-amber-800 font-bold flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 text-amber-600 fill-amber-600" /> Result & Routine Notices
            </p>
            <p className="text-2xl font-extrabold text-amber-900 mt-1">{resultNoticesCount}</p>
          </div>
        </div>
      </div>

      {/* Delete Notice Confirmation Modal */}
      {deleteConfirmNotice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Notice (নোটিশ ডিলিট করবেন?)</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800 font-bold">&quot;{deleteConfirmNotice.title}&quot;</strong>?
                </p>
                <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-medium">
                  ⚠️ এই নোটিশটি মুছে ফেললে তা স্টুডেন্ট পোর্টাল, পাবলিক নোটিশ বোর্ড এবং ওয়েবসাইটের স্লাইডার থেকে সম্পূর্ণ মুছে যাবে।
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmNotice(null)}
                disabled={deletingNoticeId === deleteConfirmNotice.id}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNotice(deleteConfirmNotice.id)}
                disabled={deletingNoticeId === deleteConfirmNotice.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {deletingNoticeId === deleteConfirmNotice.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> মোছা হচ্ছে...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> নোটিশ মুছে ফেলুন
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Notice Full Details Modal */}
      {selectedNoticeForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl border mt-0.5",
                  isResultNotice(selectedNoticeForView)
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-purple-100 text-purple-800 border-purple-200"
                )}>
                  {isResultNotice(selectedNoticeForView) ? <Trophy className="w-5 h-5 text-amber-700" /> : <FileText className="w-5 h-5 text-purple-700" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    {selectedNoticeForView.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(selectedNoticeForView.notice_date || selectedNoticeForView.created_at)}
                    </span>
                    {selectedNoticeForView.priority === "high" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                        জরুরি নোটিশ
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNoticeForView(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-sm text-slate-800 font-normal leading-relaxed whitespace-pre-line select-text">
                {selectedNoticeForView.content}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const toDel = selectedNoticeForView
                  setSelectedNoticeForView(null)
                  setDeleteConfirmNotice(toDel)
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>এই নোটিশটি মুছুন (Delete Notice)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedNoticeForView(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                বন্ধ করুন (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exam Confirmation Modal */}
      {deleteConfirmExam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Exam?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800 font-bold">&quot;{deleteConfirmExam.title}&quot;</strong>?
                  All associated questions and student exam results will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmExam(null)}
                disabled={deletingId === deleteConfirmExam.id}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteExam(deleteConfirmExam.id)}
                disabled={deletingId === deleteConfirmExam.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {deletingId === deleteConfirmExam.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exam Series Confirmation Modal */}
      {deleteConfirmSeries && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete &quot;{deleteConfirmSeries.seriesTitle}&quot;?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {deleteConfirmSeries.allWeeks.length > 1 ? (
                    <>
                      এই পরীক্ষাটিতে মোট <strong className="text-slate-800 font-bold">{deleteConfirmSeries.allWeeks.length}টি সপ্তাহ</strong> রয়েছে (Week 1 থেকে Week {deleteConfirmSeries.allWeeks.length})। আপনি কি পুরো সিরিজ ও সকল সপ্তাহের নম্বর মুছে ফেলতে চান, নাকি শুধুমাত্র সর্বশেষ সপ্তাহটি মুছবেন?
                    </>
                  ) : (
                    <>
                      আপনি কি নিশ্চিত যে <strong className="text-slate-800 font-bold">&quot;{deleteConfirmSeries.seriesTitle}&quot;</strong> পরীক্ষাটি মুছে ফেলতে চান? সকল প্রশ্ন ও শিক্ষার্থীদের ফলাফল স্থায়ীভাবে মুছে যাবে।
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmSeries(null)}
                disabled={deletingId === deleteConfirmSeries.groupKey || deletingId === deleteConfirmSeries.latestExam?.id}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
              >
                Cancel (বাতিল)
              </button>

              {deleteConfirmSeries.allWeeks.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteExam(deleteConfirmSeries.latestExam.id)}
                  disabled={deletingId === deleteConfirmSeries.groupKey || deletingId === deleteConfirmSeries.latestExam?.id}
                  className="w-full sm:w-auto px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  title="শুধুমাত্র শেষ সপ্তাহটি মুছে ফেলুন, আগের সপ্তাহগুলো থাকবে"
                >
                  {deletingId === deleteConfirmSeries.latestExam?.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                  )}
                  <span>শুধু শেষ সপ্তাহ মুছুন ({deleteConfirmSeries.latestExam.title})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteEntireSeries(deleteConfirmSeries)}
                disabled={deletingId === deleteConfirmSeries.groupKey || deletingId === deleteConfirmSeries.latestExam?.id}
                className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {deletingId === deleteConfirmSeries.groupKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting All...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {deleteConfirmSeries.allWeeks.length > 1
                        ? `পুরো সিরিজ মুছুন (${deleteConfirmSeries.allWeeks.length} Weeks)`
                        : "Delete Permanently"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh] border border-slate-200/90">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0 bg-slate-50">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingExam ? "Edit Exam (পরীক্ষা সম্পাদনা)" : "Create New Exam"}
                </h3>
                {editingExam && (
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Updating &ldquo;{editingExam.title}&rdquo; — প্রয়োজনীয় তথ্য পরিবর্তন করে সংরক্ষণ করুন
                  </p>
                )}
              </div>
              <button 
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }} 
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex gap-2 p-1 bg-white border border-slate-300 rounded-xl w-fit mb-6">
                <button onClick={() => setExamMode("offline")} className={cn("px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all", examMode === "offline" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}>Offline Exam</button>
                <button onClick={() => setExamMode("online")} className={cn("px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all", examMode === "online" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900")}>Online Exam</button>
              </div>

              <form id="examForm" onSubmit={handleCreate} className="space-y-6">
                {/* Exam Schedule Type Selector (One-Time vs Weekly) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                      Exam Type (পরীক্ষার ধরন নির্বাচন করুন) *
                    </label>
                    <select 
                      value={form.exam_schedule_type} 
                      onChange={e => update("exam_schedule_type", e.target.value as "one_time" | "weekly")} 
                      className={inputClass + " font-bold text-indigo-950 bg-white border-amber-300"}
                    >
                      <option value="one_time">One time exam (এককালীন পরীক্ষা - নির্দিষ্ট তারিখে)</option>
                      <option value="weekly">Weekly exam (সাপ্তাহিক পরীক্ষা - প্রতি সপ্তাহে নির্ধারিত দিনে)</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {form.exam_schedule_type === "one_time" 
                        ? "এককালীন পরীক্ষার একটি নির্দিষ্ট তারিখ থাকবে এবং এটি শিক্ষার্থীদের ব্যাচ প্রোফাইল ও রুটিনে প্রদর্শিত হবে।" 
                        : "সাপ্তাহিক পরীক্ষা প্রতি সপ্তাহে নির্ধারিত দিনগুলোতে অনুষ্ঠিত হবে। প্রতিটি দিনের জন্য আলাদা পরীক্ষার নাম ও নম্বর নির্ধারণ করা যাবে।"}
                    </p>
                  </div>
                </div>

                {/* Branch Selection if multiple */}
                {branches.length > 1 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Exam Branch (শাখা)</label>
                    <select 
                      value={form.branch_id} 
                      onChange={e => update("branch_id", e.target.value)} 
                      className={inputClass + " font-bold"}
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* WEEKLY EXAM CONFIGURATION */}
                {form.exam_schedule_type === "weekly" ? (
                  <div className="space-y-4">
                    {/* Routine Title */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Weekly Routine Title (সাপ্তাহিক রুটিন / সিরিজের নাম - ঐচ্ছিক)
                      </label>
                      <input 
                        value={form.title} 
                        onChange={e => update("title", e.target.value)} 
                        className={inputClass} 
                        placeholder="যেমন: WEEKLY-01 (ফাঁকা রাখলে স্বয়ংক্রিয়ভাবে WEEKLY-01 হবে)" 
                      />
                    </div>

                    {/* Day by Day Schedule Configuration */}
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            সাপ্তাহিক পরীক্ষার দিন, নাম ও নম্বর নির্ধারণ (Weekly Days & Marks) *
                          </label>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            বামে দিন নির্বাচন করুন এবং ডানে সেই দিনের পরীক্ষার নাম, বিষয় ও নম্বর লিখুন।
                          </p>
                        </div>
                        <span className="text-xs text-purple-700 font-extrabold bg-purple-100/90 px-2.5 py-1 rounded-full border border-purple-200">
                          {selectedWeeklyDaysCount} দিন নির্বাচিত
                        </span>
                      </div>

                      {/* Day Rows */}
                      <div className="space-y-2.5">
                        {WEEK_DAYS.map((day) => {
                          const config = weeklySchedule[day.id as keyof typeof weeklySchedule]
                          const isSelected = config?.selected

                          return (
                            <div
                              key={day.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all",
                                isSelected
                                  ? "bg-purple-50/50 border-purple-300 shadow-2xs"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              )}
                            >
                              <div className="flex flex-col md:flex-row md:items-center gap-3">
                                {/* Left: Day Selector */}
                                <div className="md:w-44 shrink-0 flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    id={`day_check_${day.id}`}
                                    checked={isSelected}
                                    onChange={(e) => toggleDay(day.id, e.target.checked)}
                                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                                  />
                                  <label
                                    htmlFor={`day_check_${day.id}`}
                                    className="cursor-pointer select-none flex-1"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-sm text-slate-900">{day.bn}</span>
                                      <span className="text-xs text-slate-500 font-medium">({day.id})</span>
                                    </div>
                                    <span
                                      className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5",
                                        isSelected
                                          ? "bg-purple-200/80 text-purple-800"
                                          : "bg-slate-100 text-slate-500 border border-slate-200"
                                      )}
                                    >
                                      {isSelected ? "✓ নির্বাচিত" : "অনির্ধারিত"}
                                    </span>
                                  </label>
                                </div>

                                {/* Right: Exam Name, Subject, Total Mark, Pass Mark */}
                                <div className="flex-1">
                                  {isSelected ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                      <div className="sm:col-span-5">
                                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                          Exam Name (পরীক্ষার নাম) *
                                        </label>
                                        <input
                                          type="text"
                                          required={isSelected}
                                          value={config.exam_name}
                                          onChange={(e) => updateDayField(day.id, "exam_name", e.target.value)}
                                          placeholder={`যেমন: ${day.bn}ের গণিত পরীক্ষা`}
                                          className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                      </div>

                                      <div className="sm:col-span-3">
                                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                          Subject (বিষয়)
                                        </label>
                                        <input
                                          type="text"
                                          value={config.subject}
                                          onChange={(e) => updateDayField(day.id, "subject", e.target.value)}
                                          placeholder="যেমন: গণিত / পদার্থ"
                                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                      </div>

                                      <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                          Total (নম্বর) *
                                        </label>
                                        <input
                                          type="number"
                                          required={isSelected}
                                          value={config.total_marks}
                                          onChange={(e) => updateDayField(day.id, "total_marks", e.target.value)}
                                          placeholder="50"
                                          className="w-full px-2 py-1.5 text-xs bg-white border border-purple-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                                        />
                                      </div>

                                      <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                          Pass (পাস)
                                        </label>
                                        <input
                                          type="number"
                                          value={config.pass_marks}
                                          onChange={(e) => updateDayField(day.id, "pass_marks", e.target.value)}
                                          placeholder="20"
                                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => toggleDay(day.id, true)}
                                      className="cursor-pointer text-xs text-slate-400 py-2 px-3 rounded-lg border border-dashed border-slate-200 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/40 transition-all flex items-center justify-between"
                                    >
                                      <span>দিনটি রুটিনে অন্তর্ভুক্ত করতে ক্লিক করুন বা বামের চেকবক্সে টিক দিন</span>
                                      <span className="text-[11px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                                        + যুক্ত করুন
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Optional Start Date for Weekly Exams */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Start Date (শুরুর তারিখ - ঐচ্ছিক)
                      </label>
                      <input 
                        type="date"
                        value={form.exam_date}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        onChange={e => update("exam_date", e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    {/* Publish to Notice Board Checkbox for Weekly */}
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/90 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="publish_to_notice_weekly"
                        checked={form.publish_to_notice}
                        onChange={e => togglePublishToNotice(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="publish_to_notice_weekly" className="cursor-pointer select-none">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          নোটিশ বোর্ডে সাপ্তাহিক রুটিন প্রকাশ করুন (Publish exam routine to Notice Board)
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          টিক দেওয়া থাকলে পরীক্ষা তৈরির সাথে সাথেই কোচিংয়ের নোটিশ বোর্ডে এই সাপ্তাহিক পরীক্ষার সম্পূর্ণ সূচি ও মানবণ্টন নোটিশ আকারে স্বয়ংক্রিয়ভাবে প্রকাশিত হবে।
                        </p>
                      </label>
                    </div>
                  </div>
                ) : (
                  /* ONE-TIME EXAM CONFIGURATION */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Exam Title (পরীক্ষার নাম) *</label>
                        <input required value={form.title} onChange={e => update("title", e.target.value)} className={inputClass} placeholder="e.g., Monthly Test - Physics" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject (বিষয়)</label>
                        <input value={form.subject} onChange={e => update("subject", e.target.value)} className={inputClass} placeholder="e.g., Physics 1st Paper" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Exam Date (পরীক্ষার তারিখ) *</label>
                        <input type="date" required value={form.exam_date} onClick={(e) => e.currentTarget.showPicker?.()} onChange={e => update("exam_date", e.target.value)} className={inputClass} />
                      </div>
                      {examMode === "offline" && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">Total Marks (মোট নম্বর)</label>
                          <input type="number" required value={form.total_marks} onChange={e => update("total_marks", e.target.value)} className={inputClass} />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Pass Marks (পাস নম্বর)</label>
                        <input type="number" required value={form.pass_marks} onChange={e => update("pass_marks", e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Duration (সময় - মিনিট)</label>
                        <input type="number" required value={form.duration_minutes} onChange={e => update("duration_minutes", e.target.value)} className={inputClass} />
                      </div>
                    </div>

                    {/* Publish to Notice Board Checkbox for One-Time */}
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/90 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="publish_to_notice_one_time"
                        checked={form.publish_to_notice}
                        onChange={e => togglePublishToNotice(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="publish_to_notice_one_time" className="cursor-pointer select-none">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Bell className="w-3.5 h-3.5 text-amber-600" />
                          নোটিশ বোর্ডে রুটিন প্রকাশ করুন (Publish exam routine to Notice Board)
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          টিক দেওয়া থাকলে পরীক্ষা তৈরির সাথে সাথেই কোচিংয়ের নোটিশ বোর্ডে এই পরীক্ষার সম্পূর্ণ সূচি নোটিশ আকারে স্বয়ংক্রিয়ভাবে প্রকাশিত হবে।
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {/* Live Editable Notice Preview Box */}
                {form.publish_to_notice && (
                  <div className="bg-amber-50/60 border-2 border-amber-300 rounded-2xl p-4 space-y-3 shadow-xs animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center font-black text-xs">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            নোটিশ প্রিভিউ ও সম্পাদনা (Notice Preview - Live Editable)
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            পরীক্ষা তৈরি হলে এই নোটিশটি স্বয়ংক্রিয়ভাবে প্রকাশিত হবে। আপনি চাইলে নিচে সরাসরি এডিট করতে পারেন:
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const { noticeTitle, noticeContent } = getGeneratedNoticePreview(form, weeklySchedule)
                          setForm(prev => ({
                            ...prev,
                            notice_title: noticeTitle,
                            notice_content: noticeContent,
                            is_notice_customized: false,
                          }))
                          toast.info("ডিফল্ট পরীক্ষার রুটিন নোটিশ রিলোড হয়েছে")
                        }}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="পরীক্ষার বর্তমান তথ্য অনুযায়ী ডিফল্ট নোটিশ রিলোড করুন"
                      >
                        <RefreshCw className="w-3 h-3" />
                        টেমপ্লেট রিলোড
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        নোটিশ শিরোনাম (Notice Title) *
                      </label>
                      <input
                        type="text"
                        value={form.notice_title}
                        onChange={e => setForm(prev => ({ ...prev, notice_title: e.target.value, is_notice_customized: true }))}
                        placeholder="নোটিশের শিরোনাম..."
                        className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        নোটিশের বিবরণ / রুটিন বার্তা (Notice Content) *
                      </label>
                      <textarea
                        rows={5}
                        value={form.notice_content}
                        onChange={e => setForm(prev => ({ ...prev, notice_content: e.target.value, is_notice_customized: true }))}
                        placeholder="নোটিশের বিস্তারিত বার্তা..."
                        className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-slate-800 font-mono leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>এই নোটিশটি সরাসরি নোটিশ বোর্ডে ও শিক্ষার্থীদের অ্যাকাউন্টে প্রকাশিত হবে।</span>
                    </div>
                  </div>
                )}

                {/* Batch Configuration (Multi-Batch Selection) */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      Target Batches (টার্গেট ব্যাচ নির্বাচন) *
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = formBatches.map(b => b.id)
                          setForm(f => ({ ...f, batch_ids: allIds, batch_id: allIds[0] || "" }))
                        }}
                        className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold"
                      >
                        Select All ({formBatches.length})
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, batch_ids: [], batch_id: "" }))}
                        className="text-[11px] text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    {formBatches.map(b => {
                      const isSelected = form.batch_ids.includes(b.id)
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            isSelected
                              ? "bg-amber-50 border-amber-300 text-amber-950 font-bold shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...form.batch_ids, b.id]
                                : form.batch_ids.filter(id => id !== b.id)
                              setForm(f => ({
                                ...f,
                                batch_ids: updated,
                                batch_id: updated[0] || ""
                              }))
                            }}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                          />
                          <span className="truncate">{b.name}</span>
                        </label>
                      )
                    })}
                    {formBatches.length === 0 && (
                      <p className="col-span-full text-center py-4 text-xs text-slate-400">
                        No batches available for the selected branch.
                      </p>
                    )}
                  </div>
                  {form.batch_ids.length === 0 && (
                    <p className="text-[11px] text-amber-700 font-semibold">
                      ⚠️ Please check at least one batch to configure this exam.
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200">
                  {examMode === "online" && (
                    <div>
                      <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer font-medium">
                        <input type="checkbox" checked={form.show_results_immediately} onChange={e => update("show_results_immediately", e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400" />
                        Show results immediately to students after submission
                      </label>
                    </div>
                  )}

                  {/* Batch Marks Visibility Option */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <label className="flex items-start gap-3 text-sm cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={form.show_all_results} 
                        onChange={e => update("show_all_results", e.target.checked)} 
                        className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" 
                      />
                      <div>
                        <span className="font-bold text-slate-900">Show marks & merit list to all students in configured batches (Default)</span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          When checked, all students in these batches can view everyone&apos;s marks. If deselected, each student will only see their own marks privately.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Question Builder */}
                {examMode === "online" && (
                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-bold text-slate-900">Question Builder</h4>
                      <div className="text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full">Total Marks: {computedTotal}</div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* Left: Add Form */}
                      <div className="lg:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-200">
                        <h5 className="font-bold text-white text-sm mb-4">{editingQuestion ? "Edit Question" : "Add Question"}</h5>
                        <div className="space-y-4">
                          <div><label className="block text-xs font-bold text-slate-700 mb-1">Question Type</label><select value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value as QuestionType})} className={inputClass}><option value="mcq" className="bg-white text-slate-900">Multiple Choice</option><option value="short" className="bg-white text-slate-900">Short Answer (Auto-graded)</option><option value="long" className="bg-white text-slate-900">Long Answer (Manual)</option></select></div>
                          <div><label className="block text-xs font-bold text-slate-700 mb-1">Question Text</label><textarea value={qForm.text} onChange={e => setQForm({...qForm, text: e.target.value})} className={inputClass} rows={3} placeholder="Enter question..." /></div>
                          
                          {qForm.type === "mcq" && (
                            <div className="space-y-2">
                              <label className="block text-xs font-bold text-slate-300">Options & Correct Answer</label>
                              {[1,2,3,4].map(num => (
                                <div key={num} className="flex items-center gap-2">
                                  <input type="radio" name="correctOpt" checked={qForm.correctOption === (num-1).toString()} onChange={() => setQForm({...qForm, correctOption: (num-1).toString()})} className="text-amber-500" />
                                  <input value={(qForm as any)[`opt${num}`]} onChange={e => setQForm({...qForm, [`opt${num}`]: e.target.value})} placeholder={`Option ${num}`} className={cn(inputClass, "py-1.5 text-sm")} />
                                </div>
                              ))}
                            </div>
                          )}

                          {qForm.type === "short" && (
                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Expected Answer (Case Insensitive)</label><input value={qForm.expectedAnswer} onChange={e => setQForm({...qForm, expectedAnswer: e.target.value})} className={inputClass} placeholder="e.g. Paris" /></div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs font-bold text-slate-700 mb-1">Marks</label><input type="number" value={qForm.marks} onChange={e => setQForm({...qForm, marks: e.target.value})} className={inputClass} min="1" /></div>
                          </div>
                          <div><label className="block text-xs font-bold text-slate-700 mb-1">Hint / Note (Optional)</label><input value={qForm.hint} onChange={e => setQForm({...qForm, hint: e.target.value})} className={inputClass} placeholder="Shown in results..." /></div>
                          
                          <button type="button" onClick={addQuestion} className="w-full py-2 bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold rounded-xl hover:bg-amber-500/25 transition-all">
                            {editingQuestion ? "Update Question" : "Add Question"}
                          </button>
                        </div>
                      </div>

                      {/* Right: Question List */}
                      <div className="lg:col-span-3 space-y-3">
                        {questions.length === 0 ? (
                          <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
                            No questions added yet.<br/>Use the form to add questions to this exam.
                          </div>
                        ) : (
                          questions.map((q, idx) => (
                            <div key={q.id} className="bg-white border border-slate-300 p-4 rounded-xl flex gap-3 group relative hover:border-amber-500/40">
                              <div className="mt-1 cursor-grab text-slate-500"><GripVertical className="w-5 h-5" /></div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <h6 className="font-bold text-white text-sm">Q{idx + 1}. {q.question_text}</h6>
                                  <span className="shrink-0 ml-2 px-2 py-0.5 bg-slate-900 text-amber-300 border border-slate-200 rounded text-xs font-mono">{q.marks} Marks</span>
                                </div>
                                {q.question_type === "mcq" && (
                                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                                    {q.options?.map((opt, i) => (
                                      <div key={i} className={cn("text-xs px-2.5 py-1.5 rounded-lg border", q.correct_answer === opt ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold" : "bg-slate-900 border-slate-200 text-slate-300")}>
                                        {String.fromCharCode(65+i)}. {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {q.question_type === "short" && <div className="text-xs text-slate-300 mt-1 bg-slate-900 p-2 rounded-lg border border-slate-200">Expected: <strong className="text-amber-300">{q.correct_answer}</strong></div>}
                                {q.hint_note && <div className="text-xs text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-lg inline-block">Hint: {q.hint_note}</div>}
                              </div>
                              <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => editQ(q)} className="p-1.5 text-blue-400 hover:bg-slate-800 rounded"><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => removeQ(q.id)} className="p-1.5 text-red-400 hover:bg-slate-800 rounded"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
            
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50 rounded-b-3xl shrink-0">
              <button 
                type="button" 
                onClick={() => { setShowModal(false); resetForm(); }} 
                className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                form="examForm" 
                type="submit" 
                disabled={loading || (examMode === "online" && questions.length === 0)} 
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all cursor-pointer"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : editingExam ? (
                  <><Edit2 className="w-4 h-4" /> Update Exam (আপডেট করুন)</>
                ) : (
                  "Save Exam"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
