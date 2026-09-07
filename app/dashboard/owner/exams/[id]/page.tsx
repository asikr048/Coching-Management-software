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
} from "lucide-react"
import { getGrade, cn } from "@/lib/utils"

interface Student {
  id: string
  name: string
  student_id: string
  phone?: string | null
  guardian_phone?: string | null
}

interface Result {
  student_id: string
  obtained_marks: string
  grade: string
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
  const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set())
  const [savingRowStudentId, setSavingRowStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Quick Search & Enter State
  const [studentSearchQuery, setStudentSearchQuery] = useState("")
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [quickMarkInput, setQuickMarkInput] = useState("")
  const [savingQuickMark, setSavingQuickMark] = useState(false)

  // Batch Results Visibility (Default: true - all students see everyone's marks)
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

  // Weekly Session selection state
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>("")

  // Table Filter & Search State
  const [tableSearchQuery, setTableSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "entered" | "pending" | "passed" | "failed">("all")

  // Refs for keyboard navigation
  const searchInputRef = useRef<HTMLInputElement>(null)
  const quickMarkInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Detect back URL for owner vs teacher
  const isTeacher = pathname?.includes("/dashboard/teacher")
  const backUrl = isTeacher ? "/dashboard/teacher/exams" : "/dashboard/owner/exams"

  useEffect(() => {
    async function load() {
      try {
        const { data: ex, error: exErr } = await supabase
          .from("exams")
          .select("*, batch:batches(name)")
          .eq("id", params.id)
          .single()

        if (exErr) throw exErr
        setExam(ex)
        const isPublic = ex?.show_all_results !== false && !ex?.result_note?.includes("[SHOW_ALL_RESULTS:false]")
        setShowAllResults(isPublic)

        if (Array.isArray(ex?.recurring_days) && ex.recurring_days.length > 0) {
          const first = ex.recurring_days[0]
          const defaultDay = typeof first === "object" && first !== null ? (first.day_bn || first.day) : first
          setSelectedDay(defaultDay)
        }
        setSelectedSessionDate(ex?.exam_date || new Date().toISOString().split("T")[0])

        if (ex?.batch_id) {
          const { data: enrollments } = await supabase
            .from("enrollments")
            .select("student:students(id, name, student_id, phone, guardian_phone)")
            .eq("batch_id", ex.batch_id)
            .eq("status", "active")

          const fetchedStudents: Student[] = (enrollments || [])
            .map((e: any) => e.student)
            .filter(Boolean)
            .sort((a: Student, b: Student) => (a.name || "").localeCompare(b.name || ""))

          setStudents(fetchedStudents)
        } else {
          const { data: allStudents } = await supabase
            .from("students")
            .select("id, name, student_id, phone, guardian_phone")
            .eq("status", "active")
            .order("name", { ascending: true })

          setStudents(allStudents || [])
        }

        const { data: existing } = await supabase
          .from("exam_results")
          .select("*")
          .eq("exam_id", params.id)

        const map: Record<string, Result> = {}
        const drafts: Record<string, string> = {}
        for (const r of existing || []) {
          const markStr = String(r.obtained_marks ?? "")
          map[r.student_id] = {
            student_id: r.student_id,
            obtained_marks: markStr,
            grade: r.grade || "",
          }
          drafts[r.student_id] = markStr
        }
        setSavedResults(map)
        setDraftMarks(drafts)
      } catch (err: any) {
        console.error("Error loading exam results:", err)
        toast.error("Failed to load exam data")
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [params.id, supabase])

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
      return nameMatch || idMatch || phoneMatch
    })
  }, [students, studentSearchQuery])

  // Handle selecting a student in Quick Entry
  function handleSelectStudent(student: Student) {
    setSelectedStudent(student)
    setIsSearchDropdownOpen(false)
    setStudentSearchQuery("")

    // Pre-fill existing mark from draftMarks or savedResults
    const existing = draftMarks[student.id] ?? savedResults[student.id]?.obtained_marks ?? ""
    setQuickMarkInput(existing)

    // Automatically focus the mark input
    setTimeout(() => {
      quickMarkInputRef.current?.focus()
      quickMarkInputRef.current?.select()
    }, 50)
  }

  // Recalculate ranks strictly by marks descending (highest to lowest) and sync to DB
  async function syncAllRanks(currentMarksMap: Record<string, string>) {
    if (!exam) return
    try {
      const items = students
        .map((s) => {
          const raw = currentMarksMap[s.id]?.trim() ?? savedResults[s.id]?.obtained_marks ?? ""
          const m = parseFloat(raw)
          return { student_id: s.id, marks: m }
        })
        .filter((x) => !isNaN(x.marks) && x.marks >= 0 && (!exam || x.marks <= exam.total_marks))
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
          grade: getGrade(item.marks, exam.total_marks),
          rank: curR,
        }
      })

      if (updates.length > 0) {
        await supabase.from("exam_results").upsert(updates, { onConflict: "exam_id,student_id" })
      }
    } catch (e) {
      console.warn("Rank auto-sync note:", e)
    }
  }

  // Save quick mark
  async function handleSaveQuickMark() {
    if (!selectedStudent || !exam) return

    const raw = quickMarkInput.trim()
    if (raw === "") {
      toast.error("Please enter a mark before saving")
      quickMarkInputRef.current?.focus()
      return
    }

    const numMarks = parseFloat(raw)
    if (isNaN(numMarks) || numMarks < 0) {
      toast.error("Please enter a valid non-negative number")
      return
    }
    if (numMarks > exam.total_marks) {
      toast.error(`Mark cannot exceed maximum marks (${exam.total_marks})`)
      return
    }

    const grade = getGrade(numMarks, exam.total_marks)

    setSavingQuickMark(true)
    try {
      const { error } = await supabase.from("exam_results").upsert(
        {
          exam_id: exam.id,
          student_id: selectedStudent.id,
          obtained_marks: numMarks,
          grade: grade,
        },
        { onConflict: "exam_id,student_id" }
      )

      if (error) throw error

      setSavedResults((prev) => ({
        ...prev,
        [selectedStudent.id]: {
          student_id: selectedStudent.id,
          obtained_marks: String(numMarks),
          grade,
        },
      }))
      setDraftMarks((prev) => ({
        ...prev,
        [selectedStudent.id]: String(numMarks),
      }))
      setJustSavedIds((prev) => new Set(prev).add(selectedStudent.id))

      // Auto-sync ranks strictly highest to lowest
      syncAllRanks({ ...draftMarks, [selectedStudent.id]: String(numMarks) })

      toast.success(`✓ ${selectedStudent.name}: ${numMarks}/${exam.total_marks} (${grade}) saved!`)

      // Reset selection and focus back to search for next student
      setSelectedStudent(null)
      setQuickMarkInput("")
      setStudentSearchQuery("")
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } catch (err: any) {
      console.error("Save error:", err)
      toast.error(err.message || "Failed to save mark")
    } finally {
      setSavingQuickMark(false)
    }
  }

  // Handle typing mark in table row
  function handleDraftChange(studentId: string, marks: string) {
    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: marks,
    }))
  }

  // Save an individual row from the table (called on Enter / Form submit / button click)
  async function saveRowMark(student: Student, rowIndex?: number) {
    const raw = draftMarks[student.id]?.trim() ?? ""
    if (raw === "") {
      toast.error("Please enter a mark first")
      return
    }

    const numMarks = parseFloat(raw)
    if (isNaN(numMarks) || numMarks < 0 || (exam && numMarks > exam.total_marks)) {
      toast.error(`Valid mark between 0 and ${exam?.total_marks} required`)
      return
    }

    const grade = getGrade(numMarks, exam.total_marks)

    setSavingRowStudentId(student.id)
    try {
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

      setSavedResults((prev) => ({
        ...prev,
        [student.id]: {
          student_id: student.id,
          obtained_marks: String(numMarks),
          grade,
        },
      }))
      setJustSavedIds((prev) => new Set(prev).add(student.id))

      // Auto-sync ranks strictly highest to lowest
      syncAllRanks({ ...draftMarks, [student.id]: String(numMarks) })

      toast.success(`✓ Saved ${numMarks}/${exam.total_marks} for ${student.name} (${grade})`)

      // Automatically focus the next row input if available
      if (rowIndex !== undefined) {
        const nextInput = document.getElementById(`mark-input-${rowIndex + 1}`) as HTMLInputElement | null
        if (nextInput) {
          nextInput.focus()
          nextInput.select()
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save")
    } finally {
      setSavingRowStudentId(null)
    }
  }

  // Clear a student's mark
  async function clearStudentMark(studentId: string, studentName: string) {
    if (!confirm(`Are you sure you want to clear results for ${studentName}?`)) return

    try {
      await supabase
        .from("exam_results")
        .delete()
        .eq("exam_id", exam.id)
        .eq("student_id", studentId)

      setSavedResults((prev) => {
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

      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null)
        setQuickMarkInput("")
      }

      toast.success(`Cleared result for ${studentName}`)
    } catch (err: any) {
      toast.error("Failed to clear result")
    }
  }

  // Toggle Batch Leaderboard / Marks Visibility for all students
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

      setExam((prev: any) => ({
        ...prev,
        show_all_results: nextVal,
      }))

      if (nextVal) {
        toast.success("✓ All students in this batch can now see everyone's marks & merit list")
      } else {
        toast.success("✓ Private Mode: Each student will only see their own marks in their profile")
      }
    } catch (err: any) {
      console.error("Failed to toggle visibility:", err)
      setShowAllResults(!nextVal)
      toast.error(err.message || "Failed to update visibility setting")
    } finally {
      setUpdatingVisibility(false)
    }
  }

  // Delete Exam permanently
  async function handleDeleteExam() {
    if (!exam) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/exams/${exam.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        // Fallback directly to Supabase client
        const { error: delErr } = await supabase.from("exams").delete().eq("id", exam.id)
        if (delErr) throw delErr
      }

      toast.success(`Exam "${exam.title}" deleted successfully`)
      setShowDeleteModal(false)
      router.push(backUrl)
    } catch (err: any) {
      console.error("Failed to delete exam:", err)
      toast.error(err.message || "Failed to delete exam")
    } finally {
      setDeleting(false)
    }
  }

  // 1. Toggle Publish Exam (is_published)
  async function handleTogglePublish(nextPublished: boolean) {
    setPublishingExam(true)
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: nextPublished }),
      })
      if (!res.ok) {
        await supabase.from("exams").update({ is_published: nextPublished }).eq("id", params.id)
      }
      setExam((prev: any) => ({ ...prev, is_published: nextPublished }))
      toast.success(nextPublished ? "✓ Exam results published to students!" : "Exam reverted to draft.")
    } catch (err: any) {
      toast.error(err.message || "Failed to update publish status")
    } finally {
      setPublishingExam(false)
    }
  }

  // 2. Toggle Publish to Public Online Result (is_public_result)
  async function handleTogglePublicResult(nextPublic: boolean) {
    setPublishingPublic(true)
    try {
      const res = await fetch(`/api/exams/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public_result: nextPublic }),
      })
      if (!res.ok) {
        await supabase.from("exams").update({ is_public_result: nextPublic }).eq("id", params.id)
      }
      setExam((prev: any) => ({ ...prev, is_public_result: nextPublic }))
      toast.success(
        nextPublic
          ? "✓ Merit list is now PUBLIC! Viewable on homepage & Online Result portal."
          : "Merit list removed from public Online Result portal."
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to update public status")
    } finally {
      setPublishingPublic(false)
    }
  }

  // 3. Publish to Notice Board
  async function handlePublishNotice() {
    setPublishingNotice(true)
    try {
      const activeSchedule = Array.isArray(exam?.recurring_days)
        ? exam.recurring_days.find((d: any) => {
            if (typeof d === "object" && d !== null) {
              return d.day === selectedDay || d.day_bn === selectedDay || d.day_en === selectedDay
            }
            return d === selectedDay
          })
        : null

      const res = await fetch(`/api/exams/${params.id}/publish-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type: "results",
          day: selectedDay,
          session_date: selectedSessionDate,
          day_exam_name: typeof activeSchedule === "object" && activeSchedule?.exam_name ? activeSchedule.exam_name : undefined,
          day_total_marks: typeof activeSchedule === "object" && activeSchedule?.total_marks ? activeSchedule.total_marks : undefined
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish notice")
      toast.success("✓ " + (data.message || "Exam merit list published to Notice Board!"))
    } catch (err: any) {
      toast.error(err.message || "Failed to publish notice")
    } finally {
      setPublishingNotice(false)
    }
  }

  // 4. Toggle Pause Weekly Exam
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
      toast.success(nextPaused ? `✓ "${exam.title}" is now PAUSED (স্থগিত)` : `✓ "${exam.title}" is now RESUMED (সচল)`)
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle pause")
    } finally {
      setPausingExam(false)
    }
  }

  // Save all results & calculate rank
  async function handleSaveAll() {
    setLoading(true)
    try {
      const items: { exam_id: string; student_id: string; obtained_marks: number; grade: string }[] = []

      for (const s of students) {
        const raw = draftMarks[s.id]?.trim() ?? savedResults[s.id]?.obtained_marks ?? ""
        if (raw !== "") {
          const numMarks = parseFloat(raw)
          if (!isNaN(numMarks) && numMarks >= 0 && (!exam || numMarks <= exam.total_marks)) {
            items.push({
              exam_id: params.id as string,
              student_id: s.id,
              obtained_marks: numMarks,
              grade: getGrade(numMarks, exam.total_marks),
            })
          }
        }
      }

      if (items.length === 0) {
        toast.error("No marks entered")
        return
      }

      const sorted = [...items].sort((a, b) => b.obtained_marks - a.obtained_marks)
      let curR = 1
      sorted.forEach((item, i) => {
        if (i > 0 && item.obtained_marks < sorted[i - 1].obtained_marks) {
          curR = i + 1
        }
        ;(item as any).rank = curR
      })

      const { error } = await supabase
        .from("exam_results")
        .upsert(sorted, { onConflict: "exam_id,student_id" })

      if (error) throw error

      const map: Record<string, Result> = {}
      for (const item of sorted) {
        map[item.student_id] = {
          student_id: item.student_id,
          obtained_marks: String(item.obtained_marks),
          grade: item.grade,
        }
      }
      setSavedResults(map)

      toast.success(`Results and ranks saved for ${items.length} students!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save results")
    } finally {
      setLoading(false)
    }
  }

  // Statistics
  const stats = useMemo(() => {
    const total = students.length
    const entered = Object.values(savedResults).filter((r) => r.obtained_marks !== "")
    const count = entered.length
    const marksArr = entered.map((r) => parseFloat(r.obtained_marks)).filter((n) => !isNaN(n))
    const avg = marksArr.length ? Math.round(marksArr.reduce((a, b) => a + b, 0) / marksArr.length) : 0
    const highest = marksArr.length ? Math.max(...marksArr) : 0
    const passMarks = exam?.pass_marks || 0
    const passedCount = marksArr.filter((m) => m >= passMarks).length
    const passRate = marksArr.length ? Math.round((passedCount / marksArr.length) * 100) : 0

    return { total, count, avg, highest, passRate, passedCount, failedCount: count - passedCount }
  }, [students, savedResults, exam])

  // Filtered students for Table
  const tableStudents = useMemo(() => {
    return students.filter((s) => {
      const q = tableSearchQuery.trim().toLowerCase()
      if (q) {
        const nameMatch = (s.name || "").toLowerCase().includes(q)
        const idMatch = (s.student_id || "").toLowerCase().includes(q)
        if (!nameMatch && !idMatch) return false
      }

      const saved = savedResults[s.id]
      const hasSaved = Boolean(saved && saved.obtained_marks !== "")
      const isJustSaved = justSavedIds.has(s.id)

      if (statusFilter === "entered") {
        return hasSaved || isJustSaved
      }
      if (statusFilter === "pending") {
        // KEEP VISIBLE if not saved yet OR if it was just saved in this view
        // so it NEVER disappears while typing!
        if (isJustSaved) return true
        return !hasSaved
      }
      if (statusFilter === "passed") {
        const num = hasSaved ? parseFloat(saved.obtained_marks) : null
        return num !== null && exam && num >= exam.pass_marks
      }
      if (statusFilter === "failed") {
        const num = hasSaved ? parseFloat(saved.obtained_marks) : null
        return num !== null && exam && num < exam.pass_marks
      }

      return true
    })
  }, [students, tableSearchQuery, statusFilter, savedResults, justSavedIds, exam])

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-slate-400">Loading exam & student list...</p>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900">Exam not found</h3>
        <p className="text-sm text-slate-400 mt-1 mb-6">The requested test may have been moved or deleted.</p>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Exams
        </Link>
      </div>
    )
  }

  const quickMarkNum = parseFloat(quickMarkInput)
  const hasValidQuickMark = !isNaN(quickMarkNum) && quickMarkNum >= 0 && quickMarkNum <= exam.total_marks
  const quickGradePreview = hasValidQuickMark ? getGrade(quickMarkNum, exam.total_marks) : ""
  const isQuickPass = hasValidQuickMark && quickMarkNum >= exam.pass_marks

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white backdrop-blur-md p-5 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex items-start gap-4">
          <Link
            href={backUrl}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 mt-0.5"
            title="Back to Exams"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                {exam.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {exam.subject || "General"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-200">{exam.batch?.name || "All Enrolled Batches"}</span>
              <span>•</span>
              <span>
                Total: <strong className="text-amber-400 font-bold">{exam.total_marks}</strong> marks
              </span>
              <span>•</span>
              <span>
                Pass mark: <strong className="text-emerald-400 font-bold">{exam.pass_marks}</strong>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Publish Exam to Students */}
          <button
            type="button"
            onClick={() => handleTogglePublish(!exam.is_published)}
            disabled={publishingExam}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
              exam.is_published
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                : "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-blue-600/20"
            )}
            title={exam.is_published ? "Click to unpublish results" : "Publish results to enrolled students"}
          >
            {publishingExam ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : exam.is_published ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{exam.is_published ? "Results Published" : "Publish Exam"}</span>
          </button>

          {/* Publish to Public Online Result */}
          <button
            type="button"
            onClick={() => handleTogglePublicResult(!exam.is_public_result)}
            disabled={publishingPublic}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
              exam.is_public_result
                ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-purple-600/20"
                : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
            )}
            title="Publish merit list on public homepage Online Result portal"
          >
            {publishingPublic ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            <span>{exam.is_public_result ? "🌐 Public Online Result" : "Publish to Public"}</span>
          </button>

          {/* Publish to Notice Board */}
          <button
            type="button"
            onClick={handlePublishNotice}
            disabled={publishingNotice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
            title="Generate and post merit list notice to notice board"
          >
            {publishingNotice ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>Publish to Notice</span>
          </button>

          {/* Weekly Pause / Resume Toggle */}
          {(exam.exam_schedule_type === "weekly" || (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0)) && (
            <button
              type="button"
              onClick={handleTogglePauseExam}
              disabled={pausingExam}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer border",
                exam.is_paused
                  ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-rose-600/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
              )}
            >
              {pausingExam ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : exam.is_paused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume Exam</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 fill-slate-800" />
                  <span>Pause Exam</span>
                </>
              )}
            </button>
          )}

          <Link
            href={`/dashboard/owner/sms?exam_id=${exam.id}&mode=exam_result`}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs sm:text-sm hover:border-amber-500/50 active:scale-[0.98] shadow-md transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" /> Send Result SMS
          </Link>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-xs sm:text-sm active:scale-[0.98] shadow-xs transition-all cursor-pointer"
            title="Delete this exam"
          >
            <Trash2 className="w-4 h-4" /> Delete Exam
          </button>

          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs sm:text-sm active:scale-[0.98] shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> Saving All...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save All & Rank
              </>
            )}
          </button>
        </div>
      </div>

      {/* Weekly Exam Session Card */}
      {(exam.exam_schedule_type === "weekly" || (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0)) && (
        <div className="p-4 sm:p-5 rounded-2xl border border-purple-200 bg-purple-50/70 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 border border-purple-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Weekly Exam Session (সাপ্তাহিক পরীক্ষার সেশন ও দিন নির্বাচন)
                  </h2>
                  {exam.is_paused ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      PAUSED (স্থগিত)
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ACTIVE (সচল)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  সপ্তাহের নির্ধারিত দিন সিলেক্ট করে এই সেশনের প্রাপ্ত নম্বর ইনপুট করুন।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    বার / দিন (Day)
                  </label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-purple-900 focus:outline-none cursor-pointer"
                  >
                    {exam.recurring_days.map((d: any, idx: number) => {
                      const isObj = typeof d === "object" && d !== null
                      const dayVal = isObj ? (d.day_bn || d.day) : d
                      const label = isObj
                        ? `${d.day_bn || d.day}: ${d.exam_name || "পরীক্ষা"} (নম্বর: ${d.total_marks || exam.total_marks})`
                        : d
                      return (
                        <option key={idx} value={dayVal}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  সেশন তারিখ (Date)
                </label>
                <input
                  type="date"
                  value={selectedSessionDate}
                  onChange={(e) => setSelectedSessionDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {(() => {
            const activeDaySchedule = Array.isArray(exam.recurring_days)
              ? exam.recurring_days.find((d: any) => {
                  if (typeof d === "object" && d !== null) {
                    return d.day === selectedDay || d.day_bn === selectedDay || d.day_en === selectedDay
                  }
                  return d === selectedDay
                })
              : null

            if (!activeDaySchedule || typeof activeDaySchedule !== "object") return null

            return (
              <div className="pt-2.5 border-t border-purple-200/80 flex items-center gap-3 flex-wrap text-xs text-purple-900">
                <span className="font-bold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-purple-200">
                  📝 {activeDaySchedule.exam_name}
                </span>
                {activeDaySchedule.subject && (
                  <span className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 font-medium">
                    বিষয়: {activeDaySchedule.subject}
                  </span>
                )}
                <span className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 font-bold">
                  মোট নম্বর: {activeDaySchedule.total_marks}
                </span>
                <span className="bg-white px-2.5 py-1 rounded-lg border border-purple-200 font-medium">
                  পাস নম্বর: {activeDaySchedule.pass_marks}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Batch Marks Visibility Option Card */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        showAllResults 
          ? "bg-white backdrop-blur-md border-emerald-500/30 shadow-xl" 
          : "bg-white backdrop-blur-md border-amber-500/30 shadow-xl"
      }`}>
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
            showAllResults ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}>
            {showAllResults ? <Users className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Batch Marks Visibility & Merit List
              </h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                showAllResults 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}>
                {showAllResults ? "Public to Batch (Default)" : "Private (Own Marks Only)"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {showAllResults ? (
                <>
                  <strong className="font-semibold text-emerald-400">Default:</strong> All enrolled students in this batch can view everyone&apos;s scores, percentages, and the batch merit list.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-amber-400">Deselected:</strong> Each student will <strong className="underline">only see their own marks</strong> privately on their profile. Other students&apos; marks and numbers are hidden.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto pl-14 sm:pl-0">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAllResults}
              disabled={updatingVisibility}
              onChange={(e) => handleToggleShowAllResults(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-slate-950 after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-slate-200 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-3 text-xs font-bold text-slate-300 min-w-[140px]">
              {updatingVisibility ? (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Saving setting...
                </span>
              ) : showAllResults ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> All Marks Visible
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <EyeOff className="w-3.5 h-3.5" /> Private Only
                </span>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Students</p>
            <p className="text-lg font-black text-white">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Marks Entered</p>
            <p className="text-lg font-black text-white">
              {stats.count} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
            </p>
          </div>
        </div>

        <div className="bg-white backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Average Mark</p>
            <p className="text-lg font-black text-white">
              {stats.avg} <span className="text-xs font-normal text-slate-400">/{exam.total_marks}</span>
            </p>
          </div>
        </div>

        <div className="bg-white backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Highest / Pass Rate</p>
            <p className="text-lg font-black text-white">
              {stats.highest} <span className="text-xs font-normal text-slate-400">({stats.passRate}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* QUICK SEARCH & ENTER MARK SECTION */}
      <div className="bg-white backdrop-blur-md p-5 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black text-slate-900">Quick Mark Entry (Search & Enter)</h2>
          </div>
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium hidden sm:inline-block">
            Keyboard shortcut: Type name/ID → Select → Type mark → Press Enter ↵
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Student Search Box */}
          <div className="lg:col-span-6 relative" ref={searchContainerRef}>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              1. Search Student (by Name, ID, or Roll)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                placeholder="Type student name (e.g. Asik) or ID (e.g. MS-86053)..."
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-white placeholder:text-slate-500 placeholder:font-normal focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 shadow-sm"
              />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearchQuery("")
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Suggestions */}
            {isSearchDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 rounded-xl border border-slate-200 shadow-2xl max-h-64 overflow-y-auto z-50 divide-y divide-slate-100">
                {filteredSearchStudents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 font-medium">
                    No matching enrolled student found
                  </div>
                ) : (
                  filteredSearchStudents.map((s) => {
                    const saved = savedResults[s.id]
                    const draft = draftMarks[s.id]
                    const markToShow = draft || saved?.obtained_marks || ""
                    const hasMark = Boolean(markToShow !== "")
                    const gradeToShow = saved?.grade || (hasMark && exam ? getGrade(parseFloat(markToShow), exam.total_marks) : "")
                    const isSelected = selectedStudent?.id === s.id

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? "bg-amber-500/10 border-l-2 border-amber-400" : "hover:bg-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                            {s.name?.charAt(0).toUpperCase() || "S"}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate">{s.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span className="font-semibold text-amber-400">{s.student_id}</span>
                              {s.phone && <span>• {s.phone}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2 text-right">
                          {hasMark ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <Check className="w-3 h-3" /> {markToShow}/{exam.total_marks} ({gradeToShow})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
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
          <div className="lg:col-span-6 bg-slate-950 p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              2. Enter Mark & Save (Auto-saves to database)
            </label>

            {selectedStudent ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                      {selectedStudent.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-black text-white truncate">{selectedStudent.name}</p>
                      <p className="text-[11px] text-amber-400 font-mono font-bold">
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
                    className="text-xs text-slate-400 hover:text-white p-1 rounded-md cursor-pointer"
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
                  className="flex items-center gap-3"
                >
                  <div className="relative flex-1">
                    <input
                      ref={quickMarkInputRef}
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
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
                      placeholder={`0 - ${exam.total_marks}`}
                      className="w-full pl-3.5 pr-14 py-2 bg-slate-900 border-2 border-amber-500/70 rounded-xl text-base font-black text-white focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20 shadow-sm"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      /{exam.total_marks}
                    </span>
                  </div>

                  {hasValidQuickMark && (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-black">
                        {quickGradePreview}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                          isQuickPass 
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                            : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                        }`}
                      >
                        {isQuickPass ? "Pass" : "Fail"}
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingQuickMark || !quickMarkInput}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:shadow-none cursor-pointer shrink-0"
                  >
                    {savingQuickMark ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Save Mark
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div
                onClick={() => searchInputRef.current?.focus()}
                className="py-4 px-3 border border-dashed border-slate-200 rounded-xl bg-slate-900/50 text-center cursor-pointer hover:bg-slate-900 hover:border-amber-500/40 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-300">
                  Select a student on the left to quickly enter mark
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click here or press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded text-[10px]">Enter</kbd> in search box
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABLE SECTION WITH LIVE SEARCH & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Table Filter Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder="Filter list by student name or roll number..."
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-200 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 shadow-sm"
            />
            {tableSearchQuery && (
              <button
                type="button"
                onClick={() => setTableSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(
              [
                { key: "all", label: `All (${students.length})` },
                { key: "entered", label: `Marks Entered (${stats.count})` },
                { key: "pending", label: `Pending (${stats.total - stats.count})` },
                { key: "passed", label: `Passed (${stats.passedCount})` },
                { key: "failed", label: `Failed (${stats.failedCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* The Student Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3 text-center">Marks (/{exam.total_marks})</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {tableStudents.map((s, idx) => {
                const saved = savedResults[s.id]
                const draftVal = draftMarks[s.id] ?? ""
                const numMarks = draftVal !== "" ? parseFloat(draftVal) : (saved?.obtained_marks ? parseFloat(saved.obtained_marks) : null)
                const hasEntered = Boolean(saved && saved.obtained_marks !== "")
                const isJustSaved = justSavedIds.has(s.id)
                const passed = numMarks !== null && !isNaN(numMarks) && exam && numMarks >= exam.pass_marks
                const isSelectedInQuick = selectedStudent?.id === s.id
                const gradeToDisplay = saved?.grade || (numMarks !== null && !isNaN(numMarks) && exam ? getGrade(numMarks, exam.total_marks) : "")

                return (
                  <tr
                    key={s.id}
                    className={`transition-colors ${
                      isSelectedInQuick
                        ? "bg-amber-500/10 border-l-2 border-amber-400"
                        : isJustSaved
                        ? "bg-emerald-500/15"
                        : hasEntered
                        ? "hover:bg-amber-50/30"
                        : "hover:bg-slate-800/20"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono text-center">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                          {s.name?.charAt(0).toUpperCase() || "S"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{s.name}</p>
                          {s.phone && <p className="text-[11px] text-slate-400 font-medium">{s.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded bg-white border border-slate-300 text-amber-400 font-mono text-xs font-bold">
                        {s.student_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          saveRowMark(s, idx)
                        }}
                        className="inline-flex items-center gap-2"
                      >
                        <input
                          id={`mark-input-${idx}`}
                          type="text"
                          inputMode="decimal"
                          enterKeyHint="next"
                          value={draftVal}
                          onChange={(e) => handleDraftChange(s.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              saveRowMark(s, idx)
                            }
                          }}
                          className={`w-24 px-3 py-1.5 border-2 rounded-lg text-sm text-center font-black transition-all ${
                            isJustSaved
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30"
                              : hasEntered
                              ? "border-emerald-500/40 bg-slate-950 text-emerald-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                              : "border-slate-200 bg-slate-950 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          } focus:outline-none shadow-sm`}
                          placeholder="—"
                        />
                        <button
                          type="submit"
                          disabled={savingRowStudentId === s.id}
                          title="Save mark (Enter ↵ / Return on phone)"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          {savingRowStudentId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : isJustSaved ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {gradeToDisplay ? (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black border ${
                            gradeToDisplay === "A+" || gradeToDisplay === "A"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : gradeToDisplay === "F"
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {gradeToDisplay}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isJustSaved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                          <Check className="w-3 h-3" /> Saved ✓
                        </span>
                      ) : hasEntered ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            passed
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {passed ? "Pass" : "Fail"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="px-2 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Quick edit mark"
                        >
                          Quick Edit
                        </button>
                        {(hasEntered || isJustSaved || draftVal !== "") && (
                          <button
                            type="button"
                            onClick={() => clearStudentMark(s.id, s.name)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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
                    <p className="text-sm font-semibold">No students found matching your criteria</p>
                    <p className="text-xs text-slate-500 mt-1">Try clearing your search query or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{tableStudents.length}</strong> of{" "}
            <strong className="text-white">{students.length}</strong> students
          </span>
          <span>
            Marks entered: <strong className="text-amber-400">{stats.count}</strong> / {stats.total}
          </span>
        </div>
      </div>

      {/* Delete Exam Confirmation Modal */}
      {showDeleteModal && exam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Exam?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-800 font-bold">&quot;{exam.title}&quot;</strong>?
                  All associated questions and student exam results will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExam}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
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
    </div>
  )
}