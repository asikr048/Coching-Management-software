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
} from "lucide-react"
import { getGrade } from "@/lib/utils"

interface Student {
  id: string
  name: string
  student_id: string
  phone?: string | null
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
  const [results, setResults] = useState<Record<string, Result>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Quick Search & Enter State
  const [studentSearchQuery, setStudentSearchQuery] = useState("")
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [quickMarkInput, setQuickMarkInput] = useState("")
  const [savingQuickMark, setSavingQuickMark] = useState(false)

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

        if (ex?.batch_id) {
          const { data: enrollments } = await supabase
            .from("enrollments")
            .select("student:students(id, name, student_id, phone)")
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
            .select("id, name, student_id, phone")
            .eq("status", "active")
            .order("name", { ascending: true })

          setStudents(allStudents || [])
        }

        const { data: existing } = await supabase
          .from("exam_results")
          .select("*")
          .eq("exam_id", params.id)

        const map: Record<string, Result> = {}
        for (const r of existing || []) {
          map[r.student_id] = {
            student_id: r.student_id,
            obtained_marks: String(r.obtained_marks ?? ""),
            grade: r.grade || "",
          }
        }
        setResults(map)
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

    // Pre-fill existing mark if already entered
    const existing = results[student.id]
    setQuickMarkInput(existing?.obtained_marks || "")

    // Automatically focus the mark input
    setTimeout(() => {
      quickMarkInputRef.current?.focus()
      quickMarkInputRef.current?.select()
    }, 50)
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

      setResults((prev) => ({
        ...prev,
        [selectedStudent.id]: {
          student_id: selectedStudent.id,
          obtained_marks: String(numMarks),
          grade,
        },
      }))

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

  // Update mark directly in the table
  function updateTableMark(studentId: string, marks: string) {
    const numMarks = parseFloat(marks)
    const grade = !isNaN(numMarks) && exam ? getGrade(numMarks, exam.total_marks) : ""
    setResults((r) => ({
      ...r,
      [studentId]: { student_id: studentId, obtained_marks: marks, grade },
    }))
  }

  // Save an individual row from the table
  async function saveRowMark(student: Student) {
    const r = results[student.id]
    if (!r || r.obtained_marks === "") {
      toast.error("Please enter a mark first")
      return
    }

    const numMarks = parseFloat(r.obtained_marks)
    if (isNaN(numMarks) || numMarks < 0 || (exam && numMarks > exam.total_marks)) {
      toast.error(`Valid mark between 0 and ${exam?.total_marks} required`)
      return
    }

    const grade = getGrade(numMarks, exam.total_marks)

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
      toast.success(`Saved mark for ${student.name}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to save")
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

      setResults((prev) => {
        const next = { ...prev }
        delete next[studentId]
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

  // Save all results & calculate rank
  async function handleSaveAll() {
    setLoading(true)
    try {
      const items = Object.values(results)
        .filter((r) => r.obtained_marks !== "")
        .map((r) => ({
          exam_id: params.id as string,
          student_id: r.student_id,
          obtained_marks: parseFloat(r.obtained_marks),
          grade: r.grade,
        }))

      if (items.length === 0) {
        toast.error("No marks entered")
        return
      }

      const sorted = [...items].sort((a, b) => b.obtained_marks - a.obtained_marks)
      sorted.forEach((item, i) => {
        ;(item as any).rank = i + 1
      })

      const { error } = await supabase
        .from("exam_results")
        .upsert(sorted, { onConflict: "exam_id,student_id" })

      if (error) throw error
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
    const entered = Object.values(results).filter((r) => r.obtained_marks !== "")
    const count = entered.length
    const marksArr = entered.map((r) => parseFloat(r.obtained_marks)).filter((n) => !isNaN(n))
    const avg = marksArr.length ? Math.round(marksArr.reduce((a, b) => a + b, 0) / marksArr.length) : 0
    const highest = marksArr.length ? Math.max(...marksArr) : 0
    const passMarks = exam?.pass_marks || 0
    const passedCount = marksArr.filter((m) => m >= passMarks).length
    const passRate = marksArr.length ? Math.round((passedCount / marksArr.length) * 100) : 0

    return { total, count, avg, highest, passRate, passedCount, failedCount: count - passedCount }
  }, [students, results, exam])

  // Filtered students for Table
  const tableStudents = useMemo(() => {
    return students.filter((s) => {
      const q = tableSearchQuery.trim().toLowerCase()
      if (q) {
        const nameMatch = (s.name || "").toLowerCase().includes(q)
        const idMatch = (s.student_id || "").toLowerCase().includes(q)
        if (!nameMatch && !idMatch) return false
      }

      const r = results[s.id]
      const hasMarks = r && r.obtained_marks !== ""
      const numMarks = hasMarks ? parseFloat(r.obtained_marks) : null
      const passed = numMarks !== null && exam && numMarks >= exam.pass_marks

      if (statusFilter === "entered") return hasMarks
      if (statusFilter === "pending") return !hasMarks
      if (statusFilter === "passed") return passed === true
      if (statusFilter === "failed") return hasMarks && passed === false

      return true
    })
  }, [students, tableSearchQuery, statusFilter, results, exam])

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-gray-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-gray-500">Loading exam & student list...</p>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Exam not found</h3>
        <p className="text-sm text-gray-500 mt-1 mb-6">The requested test may have been moved or deleted.</p>
        <Link
          href={backUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-start gap-4">
          <Link
            href={backUrl}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors shrink-0 mt-0.5"
            title="Back to Exams"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                {exam.title}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {exam.subject || "General"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-700">{exam.batch?.name || "All Enrolled Batches"}</span>
              <span>•</span>
              <span>
                Total: <strong className="text-gray-800 font-bold">{exam.total_marks}</strong> marks
              </span>
              <span>•</span>
              <span>
                Pass mark: <strong className="text-emerald-700 font-bold">{exam.pass_marks}</strong>
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-100 disabled:bg-indigo-400 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving All...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save All & Rank
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Students</p>
            <p className="text-lg font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Marks Entered</p>
            <p className="text-lg font-bold text-gray-900">
              {stats.count} <span className="text-xs font-normal text-gray-500">/ {stats.total}</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Average Mark</p>
            <p className="text-lg font-bold text-gray-900">
              {stats.avg} <span className="text-xs font-normal text-gray-500">/{exam.total_marks}</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Highest / Pass Rate</p>
            <p className="text-lg font-bold text-gray-900">
              {stats.highest} <span className="text-xs font-normal text-gray-500">({stats.passRate}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* QUICK SEARCH & ENTER MARK SECTION */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-blue-50/70 p-5 rounded-2xl border-2 border-indigo-200/80 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black text-gray-900">Quick Mark Entry (Search & Enter)</h2>
          </div>
          <span className="text-xs text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full font-medium hidden sm:inline-block">
            Keyboard shortcut: Type name/ID → Select → Type mark → Press Enter ↵
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Student Search Box */}
          <div className="lg:col-span-6 relative" ref={searchContainerRef}>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              1. Search Student (by Name, ID, or Roll)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                className="w-full pl-10 pr-9 py-2.5 bg-white border-2 border-indigo-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 shadow-sm"
              />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearchQuery("")
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Suggestions */}
            {isSearchDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl max-h-64 overflow-y-auto z-50 divide-y divide-gray-100">
                {filteredSearchStudents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500 font-medium">
                    No matching enrolled student found
                  </div>
                ) : (
                  filteredSearchStudents.map((s) => {
                    const r = results[s.id]
                    const hasMark = r && r.obtained_marks !== ""
                    const isSelected = selectedStudent?.id === s.id

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? "bg-indigo-50/80" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {s.name?.charAt(0).toUpperCase() || "S"}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                            <p className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5">
                              <span className="font-semibold text-indigo-600">{s.student_id}</span>
                              {s.phone && <span>• {s.phone}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 ml-2 text-right">
                          {hasMark ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3" /> {r.obtained_marks}/{exam.total_marks} ({r.grade})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-500">
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
          <div className="lg:col-span-6 bg-white p-3.5 rounded-xl border border-indigo-200/90 shadow-sm">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              2. Enter Mark & Save (Auto-saves to database)
            </label>

            {selectedStudent ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {selectedStudent.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-black text-gray-900 truncate">{selectedStudent.name}</p>
                      <p className="text-[11px] text-indigo-700 font-mono font-bold">
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
                    className="text-xs text-gray-400 hover:text-gray-600 p-1 rounded-md cursor-pointer"
                    title="Deselect student"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      ref={quickMarkInputRef}
                      type="number"
                      min="0"
                      max={exam.total_marks}
                      step="any"
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
                      className="w-full pl-3.5 pr-14 py-2 bg-white border-2 border-indigo-500 rounded-xl text-base font-black text-gray-900 focus:outline-none focus:ring-4 focus:ring-indigo-100 shadow-sm"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      /{exam.total_marks}
                    </span>
                  </div>

                  {hasValidQuickMark && (
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black">
                        {quickGradePreview}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-bold ${
                          isQuickPass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {isQuickPass ? "Pass" : "Fail"}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveQuickMark}
                    disabled={savingQuickMark || !quickMarkInput}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all flex items-center gap-1.5 disabled:bg-gray-300 disabled:shadow-none cursor-pointer shrink-0"
                  >
                    {savingQuickMark ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" /> Save Mark
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => searchInputRef.current?.focus()}
                className="py-4 px-3 border border-dashed border-gray-300 rounded-xl bg-gray-50/60 text-center cursor-pointer hover:bg-indigo-50/40 hover:border-indigo-300 transition-colors"
              >
                <p className="text-xs font-semibold text-gray-600">
                  Select a student on the left to quickly enter mark
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Click here or press <kbd className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded text-[10px]">Enter</kbd> in search box
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABLE SECTION WITH LIVE SEARCH & FILTERS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Filter Controls */}
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/60">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder="Filter list by student name or roll number..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-sm"
            />
            {tableSearchQuery && (
              <button
                type="button"
                onClick={() => setTableSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === tab.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
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
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3 text-center">Marks (/{exam.total_marks})</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {tableStudents.map((s, idx) => {
                const r = results[s.id]
                const marksVal = r?.obtained_marks ?? ""
                const numMarks = marksVal !== "" ? parseFloat(marksVal) : null
                const hasEntered = numMarks !== null && !isNaN(numMarks)
                const passed = hasEntered && numMarks >= exam.pass_marks
                const isSelectedInQuick = selectedStudent?.id === s.id

                return (
                  <tr
                    key={s.id}
                    className={`transition-colors ${
                      isSelectedInQuick
                        ? "bg-indigo-50/70"
                        : hasEntered
                        ? "hover:bg-emerald-50/30"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono text-center">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {s.name?.charAt(0).toUpperCase() || "S"}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{s.name}</p>
                          {s.phone && <p className="text-[11px] text-gray-400 font-medium">{s.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-mono text-xs font-bold">
                        {s.student_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max={exam.total_marks}
                          step="any"
                          value={marksVal}
                          onChange={(e) => updateTableMark(s.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              saveRowMark(s)
                            }
                          }}
                          className={`w-24 px-3 py-1.5 border-2 rounded-lg text-sm text-center font-black transition-all ${
                            hasEntered
                              ? "border-emerald-300 bg-emerald-50/40 text-emerald-950 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                              : "border-gray-200 bg-white text-gray-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                          } focus:outline-none shadow-sm`}
                          placeholder="—"
                        />
                        <button
                          type="button"
                          onClick={() => saveRowMark(s)}
                          title="Save this row"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r?.grade ? (
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${
                            r.grade === "A+" || r.grade === "A"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.grade === "F"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {r.grade}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasEntered ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            passed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {passed ? "Pass" : "Fail"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Quick edit mark"
                        >
                          Quick Edit
                        </button>
                        {hasEntered && (
                          <button
                            type="button"
                            onClick={() => clearStudentMark(s.id, s.name)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <p className="text-sm font-semibold">No students found matching your criteria</p>
                    <p className="text-xs text-gray-400 mt-1">Try clearing your search query or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>
            Showing <strong className="text-gray-800">{tableStudents.length}</strong> of{" "}
            <strong className="text-gray-800">{students.length}</strong> students
          </span>
          <span>
            Marks entered: <strong className="text-indigo-600">{stats.count}</strong> / {stats.total}
          </span>
        </div>
      </div>
    </div>
  )
}