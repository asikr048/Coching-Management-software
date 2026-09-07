"use client"
import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  Plus, X, Loader2, FileText, Trophy, Clock, CheckCircle, GripVertical, 
  Trash2, Edit2, PlayCircle, Eye, Globe, MessageSquare, Landmark, Building2, BookOpen,
  Pause, Play, CalendarDays, Bell, Sparkles, AlertCircle
} from "lucide-react"
import { formatDate, cn } from "@/lib/utils"
import Link from "next/link"
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
  schedule_notice_id?: string | null
  result_note?: string | null
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
  branches = [] 
}: { 
  exams: ExamRow[]
  batches: BatchOpt[]
  branches?: Branch[]
}) {
  const [exams, setExams] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [deleteConfirmExam, setDeleteConfirmExam] = useState<ExamRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const { selectedBranchId, currentBranch } = useBranch()
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "one_time" | "weekly" | "published" | "draft" | "online">("all")
  const [batchFilter, setBatchFilter] = useState<string>("all")
  
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
      if (statusFilter === "published" && !ex.is_published) return false
      if (statusFilter === "draft" && ex.is_published) return false
      if (statusFilter === "online" && !ex.is_online) return false
      if (statusFilter === "one_time" && (ex.exam_schedule_type === "weekly" || (Array.isArray(ex.recurring_days) && ex.recurring_days.length > 0))) return false
      if (statusFilter === "weekly" && ex.exam_schedule_type !== "weekly" && (!Array.isArray(ex.recurring_days) || ex.recurring_days.length === 0)) return false
      return true
    })
  }, [exams, statusFilter, batchFilter, selectedBranchId])

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
      const { error } = await supabase.from("exams").update({ is_published: true }).eq("id", id)
      if (error) throw error
      setExams(prev => prev.map(ex => ex.id === id ? { ...ex, is_published: true } : ex))
      toast.success("Exam published successfully!")
    } catch (err: any) {
      toast.error(err.message || "Failed to publish exam")
    } finally {
      setPublishing(null)
    }
  }

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
        ? (form.title.trim() || `সাপ্তাহিক পরীক্ষা (${activeWeeklyDays.map(d => d.day_bn).join(", ")})`)
        : form.title

      const finalTotalMarks = form.exam_schedule_type === "weekly"
        ? (activeWeeklyDays[0]?.total_marks || 50)
        : (examMode === "online" ? computedTotal : parseInt(form.total_marks))

      const finalPassMarks = form.exam_schedule_type === "weekly"
        ? (activeWeeklyDays[0]?.pass_marks || 20)
        : parseInt(form.pass_marks)

      const finalSubject = form.exam_schedule_type === "weekly"
        ? (form.subject.trim() || activeWeeklyDays.map(d => d.subject).filter(Boolean).join(", ") || "সাপ্তাহিক বিষয়সমূহ")
        : (form.subject || null)

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
        result_note: (form.result_note ? form.result_note + " " : "") + 
          `[SHOW_ALL_RESULTS:${form.show_all_results}]` +
          (form.exam_schedule_type === "weekly" 
            ? ` [WEEKLY_SCHEDULE:${JSON.stringify(activeWeeklyDays)}] [WEEKLY_DAYS:${activeWeeklyDays.map(d => d.day).join(",")}]` 
            : ""),
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
      if (form.publish_to_notice && newExam?.id) {
        try {
          const nRes = await fetch(`/api/exams/${newExam.id}/publish-notice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "schedule" }),
          })
          if (nRes.ok) {
            toast.success("Exam created & routine posted to Notice Board!")
          }
        } catch (nErr) {
          console.warn("Notice publish err:", nErr)
        }
      }

      setExams([{ ...newExam, exam_questions: [{ count: questions.length }] }, ...exams])
      setShowModal(false)
      toast.success(
        form.exam_schedule_type === "weekly"
          ? "Weekly exam schedule created!"
          : (examMode === "online" ? "Online exam created!" : "Exam created!")
      )
      
      // Reset form
      setQuestions([])
      setForm({ 
        title: "", 
        branch_id: selectedBranchId !== "all" ? selectedBranchId : (currentBranch?.id || branches[0]?.id || ""),
        batch_id: "", 
        batch_ids: [],
        exam_schedule_type: "one_time",
        recurring_days: [],
        publish_to_notice: false,
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
      setWeeklySchedule(defaultWeeklySchedule())
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
        // Direct Supabase fallback
        await supabase.from("exam_results").delete().eq("exam_id", examId)
        await supabase.from("exam_questions").delete().eq("exam_id", examId)
        await supabase.from("exam_submissions").delete().eq("exam_id", examId)
        const { error: dErr } = await supabase.from("exams").delete().eq("id", examId)
        if (dErr) throw dErr
      }

      setExams((prev) => prev.filter((e) => e.id !== examId))
      toast.success("✓ Exam deleted successfully!")
      setDeleteConfirmExam(null)
    } catch (err: any) {
      console.error("Delete exam error:", err)
      toast.error(err?.message || "Failed to delete exam")
    } finally {
      setDeletingId(null)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl overflow-x-auto">
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
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={inputClass + " w-48 font-semibold"}>
            <option value="all" className="bg-white text-slate-900">All Batches (সব ব্যাচ)</option>
            {availableBatches.map(b => <option key={b.id} value={b.id} className="bg-white text-slate-900">{b.name}</option>)}
          </select>
        </div>

        <button 
          onClick={() => {
            setForm(prev => ({
              ...prev,
              branch_id: selectedBranchId !== "all" ? selectedBranchId : (currentBranch?.id || branches[0]?.id || "")
            }))
            setShowModal(true)
          }} 
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Exam
        </button>
      </div>

      {/* Exam Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredExams.map(exam => {
          const isWeekly = exam.exam_schedule_type === "weekly" || (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0)
          const recurringDaysList = Array.isArray(exam.recurring_days) ? exam.recurring_days : []
          const daysBengali = recurringDaysList.map((d: any) => {
            if (typeof d === "object" && d !== null) {
              return `${d.day_bn || d.day}: ${d.exam_name || "পরীক্ষা"} (${d.total_marks || ""} নম্বর)`
            }
            return WEEK_DAYS.find(w => w.id === d)?.short || d
          }).join(", ")

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
                    <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold border", exam.is_published ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                      {exam.is_published ? "Published" : "Draft"}
                    </span>
                    {/* ONLY UPPER DELETE BUTTON */}
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
              
              <div className="grid grid-cols-2 gap-2 text-sm mt-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex-grow">
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500 font-medium">Total Marks</span>
                  <span className="font-extrabold text-amber-700 text-sm">{exam.total_marks}</span>
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
                  <Link
                    href={`/dashboard/owner/sms?exam_id=${exam.id}&mode=exam_result`}
                    className="w-full flex justify-center items-center gap-1.5 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> Send Result SMS
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
        {filteredExams.length === 0 && <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 shadow-xs">No exams match your filters.</div>}
      </div>

      {/* Analytics Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xs">
        <h3 className="text-lg font-extrabold text-slate-900 mb-1">Exam Analytics</h3>
        <p className="text-xs text-slate-500 font-medium">Performance summary and publication status</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-500 font-medium">Total Exams</p><p className="text-2xl font-extrabold text-slate-900 mt-1">{exams.length}</p></div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-500 font-medium">Published</p><p className="text-2xl font-extrabold text-emerald-600 mt-1">{exams.filter(e=>e.is_published).length}</p></div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-500 font-medium">Online Exams</p><p className="text-2xl font-extrabold text-blue-600 mt-1">{exams.filter(e=>e.is_online).length}</p></div>
        </div>
      </div>

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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh] border border-slate-200/90">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Create New Exam</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
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
                        placeholder="যেমন: HSC 2026 সাপ্তাহিক মডেল টেস্ট সিরিজ (ফাঁকা রাখলে স্বয়ংক্রিয় নাম তৈরি হবে)" 
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

                    {/* Publish to Notice Board Checkbox for Weekly */}
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/90 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="publish_to_notice_weekly"
                        checked={form.publish_to_notice}
                        onChange={e => update("publish_to_notice", e.target.checked)}
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
                        <input type="date" required value={form.exam_date} onChange={e => update("exam_date", e.target.value)} className={inputClass} />
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
                        onChange={e => update("publish_to_notice", e.target.checked)}
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
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 hover:text-white transition-colors">Cancel</button>
              <button form="examForm" type="submit" disabled={loading || (examMode === "online" && questions.length === 0)} className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
