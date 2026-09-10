"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Users, UserCheck, UserX, Clock, CalendarDays, TrendingUp, TrendingDown, 
  Activity, CheckCircle2, AlertCircle, Search, Printer, Download, 
  Save, RefreshCw, Award, Calendar, FileSpreadsheet, Sparkles, Check, X,
  HelpCircle, ChevronRight, BookOpen, Layers
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface AttendanceClientProps {
  todayAttendance: any[]
  batches: any[]
  recentAttendance: any[]
  top10: any[]
  bottom10: any[]
  todayDate: string
}

// Convert Bangla numerals to standard English digits for search matching
function normalizeBanglaDigits(str: string): string {
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]
  return str.replace(/[০-৯]/g, (char) => String(banglaDigits.indexOf(char)))
}

export default function AttendanceClient({
  todayAttendance: initialTodayAttendance,
  batches,
  recentAttendance,
  top10,
  bottom10,
  todayDate,
}: AttendanceClientProps) {
  const supabase = createClient()

  // Tab State
  const [activeTab, setActiveTab] = useState<"overview" | "take" | "result">("overview")

  // Shared / Take Attendance State
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || "")
  const [attendanceDate, setAttendanceDate] = useState<string>(todayDate)
  const [students, setStudents] = useState<any[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; note: string }>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Batch Attendance Result State
  const [resultBatchId, setResultBatchId] = useState<string>(batches[0]?.id || "")
  const [resultDateFilter, setResultDateFilter] = useState<"all" | "this_month" | "last_month">("all")
  const [loadingResult, setLoadingResult] = useState(false)
  const [batchAttendanceData, setBatchAttendanceData] = useState<any[]>([])
  const [batchEnrolledStudents, setBatchEnrolledStudents] = useState<any[]>([])

  // Keep local today attendance updated
  const [todayAttendance, setTodayAttendance] = useState<any[]>(initialTodayAttendance)

  // -------------------------------------------------------------
  // Overview Tab Calculations
  // -------------------------------------------------------------
  const presentCount = todayAttendance.filter((a) => a.status === "present").length
  const lateCount = todayAttendance.filter((a) => a.status === "late").length
  const absentCount = todayAttendance.filter((a) => a.status === "absent").length
  const excusedCount = todayAttendance.filter((a) => a.status === "excused").length
  const totalMarked = todayAttendance.length
  const presentRate = totalMarked > 0 ? Math.round(((presentCount + lateCount) / totalMarked) * 100) : 0

  const batchBreakdown = batches
    .map((batch) => {
      const batchAtt = todayAttendance.filter((a) => a.batch_id === batch.id)
      const bPresent = batchAtt.filter((a) => a.status === "present" || a.status === "late").length
      const bAbsent = batchAtt.filter((a) => a.status === "absent").length
      const bTotal = batchAtt.length
      const bRate = bTotal > 0 ? Math.round((bPresent / bTotal) * 100) : 0
      return {
        id: batch.id,
        name: batch.name,
        subject: batch.subject || "",
        classroom: batch.classroom || "",
        enrolled: batch.current_seats || 0,
        present: bPresent,
        absent: bAbsent,
        rate: bRate,
        marked: bTotal,
      }
    })
    .sort((a, b) => b.rate - a.rate)

  const trendsMap: Record<string, { present: number; absent: number; total: number }> = {}
  recentAttendance.forEach((a) => {
    if (!trendsMap[a.date]) trendsMap[a.date] = { present: 0, absent: 0, total: 0 }
    trendsMap[a.date].total += 1
    if (a.status === "present" || a.status === "late") trendsMap[a.date].present += 1
    else if (a.status === "absent") trendsMap[a.date].absent += 1
  })

  const trendsArray = Object.keys(trendsMap)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map((date) => {
      const data = trendsMap[date]
      const rate = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      return { date, ...data, rate }
    })

  // -------------------------------------------------------------
  // Load Students & Existing Attendance for "Take Attendance"
  // -------------------------------------------------------------
  useEffect(() => {
    if (!selectedBatchId) return

    let isMounted = true
    async function fetchSheetData() {
      setLoadingStudents(true)
      try {
        // 1. Fetch active enrollments with roll numbers
        const { data: enrollments, error: enrollErr } = await supabase
          .from("enrollments")
          .select("roll_no, enrollment_date, created_at, student:students(id, name, student_id, roll_no, batch_roll, phone, guardian_phone)")
          .eq("batch_id", selectedBatchId)
          .eq("status", "active")
          .order("roll_no", { ascending: true, nullsFirst: false })

        if (enrollErr) throw enrollErr

        // 2. Fetch existing attendance for this batch on the selected date
        const { data: existingRecords, error: attErr } = await supabase
          .from("attendance")
          .select("student_id, status, note")
          .eq("batch_id", selectedBatchId)
          .eq("date", attendanceDate)

        if (attErr) throw attErr

        if (!isMounted) return

        // 3. Normalize sequential roll numbers strictly starting from 1 to rest
        const mappedStudents: any[] = (enrollments || [])
          .map((e: any, idx: number) => {
            if (!e.student) return null
            const resolvedRoll =
              e.roll_no != null && Number(e.roll_no) > 0
                ? Number(e.roll_no)
                : e.student.roll_no || e.student.batch_roll || idx + 1
            return {
              ...e.student,
              roll_no: resolvedRoll,
              batch_roll: resolvedRoll,
              enrollment_date: e.enrollment_date,
            }
          })
          .filter(Boolean)

        // Sort strictly by roll number ascending (1, 2, 3...)
        mappedStudents.sort((a, b) => (a.roll_no || 9999) - (b.roll_no || 9999))
        setStudents(mappedStudents)

        // 4. Map existing attendance or default to "present"
        const existingMap: Record<string, { status: string; note: string }> = {}
        for (const rec of existingRecords || []) {
          existingMap[rec.student_id] = {
            status: rec.status,
            note: rec.note || "",
          }
        }

        // Fill missing students with "present" default
        for (const s of mappedStudents) {
          if (!existingMap[s.id]) {
            existingMap[s.id] = { status: "present", note: "" }
          }
        }

        setAttendanceMap(existingMap)
      } catch (err: any) {
        console.error("Error loading attendance sheet:", err)
        toast.error("Failed to load students for this batch")
      } finally {
        if (isMounted) setLoadingStudents(false)
      }
    }

    fetchSheetData()
    return () => {
      isMounted = false
    }
  }, [selectedBatchId, attendanceDate, supabase])

  // Quick Action Handlers
  const handleMarkAll = (status: "present" | "absent") => {
    setAttendanceMap((prev) => {
      const updated = { ...prev }
      for (const s of students) {
        updated[s.id] = { ...updated[s.id], status }
      }
      return updated
    })
    toast.success(`Marked all students as ${status}`)
  }

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { note: "" }),
        status,
      },
    }))
  }

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: "present" }),
        note,
      },
    }))
  }

  // Save Attendance to Database
  const handleSaveAttendance = async () => {
    if (!selectedBatchId || students.length === 0) return
    setSavingAttendance(true)

    try {
      const recordsToUpsert = students.map((s) => ({
        student_id: s.id,
        batch_id: selectedBatchId,
        date: attendanceDate,
        status: attendanceMap[s.id]?.status || "present",
        note: attendanceMap[s.id]?.note || null,
        entry_method: "manual" as const,
        checked_in_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from("attendance")
        .upsert(recordsToUpsert, { onConflict: "student_id,batch_id,date" })

      if (error) throw error

      toast.success(`Attendance successfully saved for ${recordsToUpsert.length} students!`)

      // If saved date is today, update today's stats locally
      if (attendanceDate === todayDate) {
        const { data: updatedToday } = await supabase
          .from("attendance")
          .select("*, student:students(id, name, student_id, roll_no, batch_roll), batch:batches(id, name, subject)")
          .eq("date", todayDate)
        if (updatedToday) setTodayAttendance(updatedToday)
      }
    } catch (err: any) {
      console.error("Save attendance error:", err)
      toast.error(err.message || "Failed to save attendance")
    } finally {
      setSavingAttendance(false)
    }
  }

  // Search Filter for Take Attendance
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = normalizeBanglaDigits(searchQuery.trim().toLowerCase())
    return students.filter((s) => {
      const rollStr = String(s.roll_no || "")
      const nameStr = String(s.name || "").toLowerCase()
      const idStr = String(s.student_id || "").toLowerCase()
      const phoneStr = String(s.phone || "")
      return (
        rollStr === q ||
        `roll ${rollStr}`.includes(q) ||
        `roll #${rollStr}`.includes(q) ||
        `#${rollStr}`.includes(q) ||
        nameStr.includes(q) ||
        idStr.includes(q) ||
        phoneStr.includes(q)
      )
    })
  }, [students, searchQuery])

  // -------------------------------------------------------------
  // Load Data for "Batch Attendance Result"
  // -------------------------------------------------------------
  useEffect(() => {
    if (!resultBatchId) return

    let isMounted = true
    async function fetchResultData() {
      setLoadingResult(true)
      try {
        // 1. Fetch batch enrolled students with roll numbers
        const { data: enrollments, error: enrollErr } = await supabase
          .from("enrollments")
          .select("roll_no, enrollment_date, created_at, student:students(id, name, student_id, roll_no, batch_roll, phone)")
          .eq("batch_id", resultBatchId)
          .eq("status", "active")
          .order("roll_no", { ascending: true, nullsFirst: false })

        if (enrollErr) throw enrollErr

        // 2. Fetch all attendance records for this batch
        let query = supabase
          .from("attendance")
          .select("id, student_id, batch_id, date, status, note")
          .eq("batch_id", resultBatchId)

        if (resultDateFilter === "this_month") {
          const now = new Date()
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
          query = query.gte("date", firstDay)
        } else if (resultDateFilter === "last_month") {
          const now = new Date()
          const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]
          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]
          query = query.gte("date", firstDay).lte("date", lastDay)
        }

        const { data: attRecords, error: attErr } = await query

        if (attErr) throw attErr

        if (!isMounted) return

        // Normalize students strictly ordered by Batch Roll 1..N
        const resolvedStudents: any[] = (enrollments || [])
          .map((e: any, idx: number) => {
            if (!e.student) return null
            const roll =
              e.roll_no != null && Number(e.roll_no) > 0
                ? Number(e.roll_no)
                : e.student.roll_no || e.student.batch_roll || idx + 1
            return {
              ...e.student,
              roll_no: roll,
              batch_roll: roll,
              enrollment_date: e.enrollment_date,
            }
          })
          .filter(Boolean)

        resolvedStudents.sort((a, b) => (a.roll_no || 9999) - (b.roll_no || 9999))

        setBatchEnrolledStudents(resolvedStudents)
        setBatchAttendanceData(attRecords || [])
      } catch (err: any) {
        console.error("Error loading batch attendance result:", err)
        toast.error("Failed to calculate attendance result")
      } finally {
        if (isMounted) setLoadingResult(false)
      }
    }

    fetchResultData()
    return () => {
      isMounted = false
    }
  }, [resultBatchId, resultDateFilter, supabase])

  // Batch Result Calculation Engine
  const {
    totalClassSessions,
    batchResults,
    avgAttendanceRate,
    perfectAttendanceCount,
    criticalAbsentCount,
  } = useMemo(() => {
    // Distinct class dates held for this batch
    const distinctDates = Array.from(new Set(batchAttendanceData.map((a) => a.date))).sort()
    const totalHeld = distinctDates.length

    let totalPercentSum = 0
    let perfectCount = 0
    let criticalCount = 0

    const results = batchEnrolledStudents.map((student) => {
      const studentRecords = batchAttendanceData.filter((a) => a.student_id === student.id)
      const presentCount = studentRecords.filter((a) => a.status === "present").length
      const lateCount = studentRecords.filter((a) => a.status === "late").length
      const absentCount = studentRecords.filter((a) => a.status === "absent").length
      const excusedCount = studentRecords.filter((a) => a.status === "excused").length

      // Present + Late count as attended
      const attendedCount = presentCount + lateCount
      const percentage = totalHeld > 0 ? Math.round((attendedCount / totalHeld) * 100) : 0

      totalPercentSum += percentage
      if (percentage === 100 && totalHeld > 0) perfectCount++
      if (percentage < 50 && totalHeld > 0) criticalCount++

      // Result Grade / Performance Tag
      let statusTag = {
        label: "Regular",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        icon: CheckCircle2,
      }
      if (percentage >= 90) {
        statusTag = {
          label: "Excellent",
          color: "text-emerald-800 bg-emerald-100 border-emerald-300",
          icon: Award,
        }
      } else if (percentage >= 75) {
        statusTag = {
          label: "Good / Regular",
          color: "text-blue-700 bg-blue-50 border-blue-200",
          icon: CheckCircle2,
        }
      } else if (percentage >= 50) {
        statusTag = {
          label: "Irregular",
          color: "text-amber-700 bg-amber-50 border-amber-200",
          icon: AlertCircle,
        }
      } else {
        statusTag = {
          label: "Critical / At Risk",
          color: "text-rose-700 bg-rose-50 border-rose-200",
          icon: X,
        }
      }

      return {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        student_id: student.student_id,
        phone: student.phone,
        totalHeld,
        attendedCount,
        presentCount,
        lateCount,
        absentCount,
        excusedCount,
        percentage,
        statusTag,
      }
    })

    const avgRate = results.length > 0 ? Math.round(totalPercentSum / results.length) : 0

    return {
      totalClassSessions: totalHeld,
      batchResults: results,
      avgAttendanceRate: avgRate,
      perfectAttendanceCount: perfectCount,
      criticalAbsentCount: criticalCount,
    }
  }, [batchAttendanceData, batchEnrolledStudents])

  // Export CSV
  const handleExportCSV = () => {
    const selectedBatchObj = batches.find((b) => b.id === resultBatchId)
    const batchName = selectedBatchObj?.name || "Batch"
    const headers = [
      "Roll No",
      "Student Name",
      "Student ID",
      "Total Classes Held",
      "Attended Days",
      "Present Days",
      "Late Days",
      "Absent Days",
      "Attendance %",
      "Status",
    ]

    const rows = batchResults.map((r) => [
      r.roll_no,
      `"${r.name}"`,
      r.student_id,
      r.totalHeld,
      r.attendedCount,
      r.presentCount,
      r.lateCount,
      r.absentCount,
      `${r.percentage}%`,
      r.statusTag.label,
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${batchName.replace(/\s+/g, "_")}_Attendance_Result.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV file downloaded!")
  }

  // Print Result Sheet
  const handlePrintResult = () => {
    window.print()
  }

  const selectedBatchObj = batches.find((b) => b.id === selectedBatchId)
  const resultBatchObj = batches.find((b) => b.id === resultBatchId)

  // Current Sheet summary counts
  const sheetPresent = Object.values(attendanceMap).filter((v) => v.status === "present").length
  const sheetLate = Object.values(attendanceMap).filter((v) => v.status === "late").length
  const sheetAbsent = Object.values(attendanceMap).filter((v) => v.status === "absent").length
  const sheetExcused = Object.values(attendanceMap).filter((v) => v.status === "excused").length

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 print:hidden">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Activity className="w-4 h-4 text-amber-400" />
          Attendance Overview
        </button>

        <button
          onClick={() => setActiveTab("take")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "take"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Take Attendance (Sheet)
        </button>

        <button
          onClick={() => setActiveTab("result")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "result"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Batch Attendance Result / Report
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD */}
      {/* ============================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Today's Summary */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-500" /> Today's Attendance Overview ({formatDate(todayDate)})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveTab("take")
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Take Today's Attendance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center hover:border-amber-500/40 transition-all">
                <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-2 border border-slate-200">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-slate-900">{totalMarked}</p>
                <p className="text-xs text-slate-500 font-medium">Total Marked</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center hover:border-emerald-500/40 transition-all">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-2 border border-emerald-200">
                  <UserCheck className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-emerald-600">{presentCount}</p>
                <p className="text-xs text-slate-500 font-medium">Present</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center hover:border-amber-500/40 transition-all">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-2 border border-amber-200">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-amber-600">{lateCount}</p>
                <p className="text-xs text-slate-500 font-medium">Late</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center hover:border-rose-500/40 transition-all">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-2 border border-rose-200">
                  <UserX className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-rose-600">{absentCount}</p>
                <p className="text-xs text-slate-500 font-medium">Absent</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center hover:border-blue-500/40 transition-all">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-2 border border-blue-200">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-blue-600">{excusedCount}</p>
                <p className="text-xs text-slate-500 font-medium">Excused</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-2xl border border-amber-400 shadow-md flex flex-col items-center justify-center text-white">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-2 text-white border border-white/30">
                  <Activity className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-white">{presentRate}%</p>
                <p className="text-xs text-amber-100 font-medium">Attendance Rate</p>
              </div>
            </div>
          </section>

          {/* Batchwise Breakdown & Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Batch Breakdown */}
            <section>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" /> Batchwise Breakdown
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Batch</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Enrolled</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Present</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Rate %</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchBreakdown.length > 0 ? (
                        batchBreakdown.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-slate-900 block">{b.name}</span>
                              {b.subject && <span className="text-xs text-slate-500">{b.subject}</span>}
                            </td>
                            <td className="px-4 py-3.5 text-right text-slate-600 font-mono">{b.enrolled}</td>
                            <td className="px-4 py-3.5 text-right text-emerald-600 font-bold font-mono">{b.present}</td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                  b.rate >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : b.rate >= 50
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {b.rate}%
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedBatchId(b.id)
                                    setActiveTab("take")
                                  }}
                                  title="Take Attendance"
                                  className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all cursor-pointer"
                                >
                                  Take
                                </button>
                                <button
                                  onClick={() => {
                                    setResultBatchId(b.id)
                                    setActiveTab("result")
                                  }}
                                  title="View Result Report"
                                  className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all cursor-pointer"
                                >
                                  Result
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                            No batches available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Attendance Trends */}
            <section>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" /> Last 7 Days Trend
              </h3>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Date</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Marked</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Present</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Absent</th>
                        <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-right">Rate %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trendsArray.length > 0 ? (
                        trendsArray.map((t) => (
                          <tr key={t.date} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 font-semibold text-slate-800">{formatDate(t.date)}</td>
                            <td className="px-4 py-3.5 text-right text-slate-600 font-mono">{t.total}</td>
                            <td className="px-4 py-3.5 text-right text-emerald-600 font-bold font-mono">{t.present}</td>
                            <td className="px-4 py-3.5 text-right text-rose-600 font-bold font-mono">{t.absent}</td>
                            <td className="px-4 py-3.5 text-right font-mono">
                              <span
                                className={`font-bold ${
                                  t.rate >= 80 ? "text-emerald-600" : t.rate >= 50 ? "text-amber-600" : "text-rose-600"
                                }`}
                              >
                                {t.rate}%
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                            No attendance data for the last 7 days.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* Leaderboard Section */}
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" /> Student Attendance Leaderboard
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-3.5 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-emerald-800">Top 10 Best Attendance</h4>
                </div>
                <div>
                  <ul className="divide-y divide-slate-100">
                    {top10.length > 0 ? (
                      top10.map((s, idx) => (
                        <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-400 font-mono w-5">{idx + 1}.</span>
                            <span className="font-bold text-slate-900">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{s.total} classes</span>
                            <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg min-w-[3rem] font-mono">
                              {s.rate}%
                            </span>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-8 text-center text-slate-400 text-sm">Not enough data to calculate leaderboard.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-rose-50/70 border-b border-rose-100 px-4 py-3.5 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                  <h4 className="font-bold text-rose-800">Bottom 10 Worst Attendance</h4>
                </div>
                <div>
                  <ul className="divide-y divide-slate-100">
                    {bottom10.length > 0 ? (
                      bottom10.map((s, idx) => (
                        <li key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-400 font-mono w-5">{idx + 1}.</span>
                            <span className="font-bold text-slate-900">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{s.total} classes</span>
                            <span className="inline-flex items-center justify-center px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg min-w-[3rem] font-mono">
                              {s.rate}%
                            </span>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-8 text-center text-slate-400 text-sm">Not enough data to calculate leaderboard.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: TAKE ATTENDANCE (SHEET ORDERED ROLL 1..N) */}
      {/* ============================================================= */}
      {activeTab === "take" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Controls Bar: Batch, Date, Search, Quick Mark */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Batch Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Batch
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.subject ? `(${b.subject})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Attendance Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                />
              </div>

              {/* Search by Roll / Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Filter by Roll / Name / ID
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Roll (1, ২), Name, ID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Bulk Actions:</span>
                <button
                  type="button"
                  onClick={() => handleMarkAll("present")}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAll("absent")}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Mark All Absent
                </button>
              </div>

              {selectedBatchObj && (
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span>
                    Batch: <strong className="text-slate-800">{selectedBatchObj.name}</strong>
                  </span>
                  {selectedBatchObj.classroom && (
                    <span>
                      Room: <strong className="text-slate-800">{selectedBatchObj.classroom}</strong>
                    </span>
                  )}
                  <span>
                    Total Enrolled: <strong className="text-slate-800">{students.length}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Student Attendance Sheet Table */}
          {loadingStudents ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">Loading Attendance Sheet for Batch...</p>
            </div>
          ) : students.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs w-20 text-center">
                        Batch Roll
                      </th>
                      <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Student Details</th>
                      <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs text-center">
                        Attendance Status
                      </th>
                      <th className="px-4 py-3.5 font-bold uppercase tracking-wider text-xs">Note / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => {
                      const currentStatus = attendanceMap[s.id]?.status || "present"
                      const currentNote = attendanceMap[s.id]?.note || ""

                      return (
                        <tr key={s.id} className="hover:bg-amber-50/20 transition-colors">
                          {/* Batch Roll: Strictly 1..N Badge */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2.5rem] h-9 px-2 rounded-xl bg-amber-50 border border-amber-200 font-black text-amber-800 text-sm font-mono shadow-xs">
                              #{s.roll_no}
                            </span>
                          </td>

                          {/* Student Details */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-base">{s.name}</div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                              <span>ID: {s.student_id}</span>
                              {s.phone && <span>• Phone: {s.phone}</span>}
                            </div>
                          </td>

                          {/* Status Buttons */}
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
                              {/* Present */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(s.id, "present")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === "present"
                                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                }`}
                              >
                                <Check className="w-3 h-3" />
                                Present
                              </button>

                              {/* Late */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(s.id, "late")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === "late"
                                    ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                Late
                              </button>

                              {/* Absent */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(s.id, "absent")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === "absent"
                                    ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                }`}
                              >
                                <X className="w-3 h-3" />
                                Absent
                              </button>

                              {/* Excused */}
                              <button
                                type="button"
                                onClick={() => handleStatusChange(s.id, "excused")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  currentStatus === "excused"
                                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                }`}
                              >
                                Excused
                              </button>
                            </div>
                          </td>

                          {/* Remarks/Note Input */}
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={currentNote}
                              onChange={(e) => handleNoteChange(s.id, e.target.value)}
                              placeholder="Reason / Note (optional)..."
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Sticky Bar for Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-4">
                  <span>
                    Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students
                  </span>
                  <span className="text-emerald-700 font-bold">• Present: {sheetPresent}</span>
                  <span className="text-amber-700 font-bold">• Late: {sheetLate}</span>
                  <span className="text-rose-700 font-bold">• Absent: {sheetAbsent}</span>
                  {sheetExcused > 0 && <span className="text-blue-700 font-bold">• Excused: {sheetExcused}</span>}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {savingAttendance ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving Attendance...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Attendance
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h4 className="text-base font-bold text-slate-800">No Students Enrolled</h4>
              <p className="text-xs text-slate-400 mt-1">
                There are no active student enrollments in this batch to take attendance for.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: BATCH ATTENDANCE RESULT / REPORT */}
      {/* ============================================================= */}
      {activeTab === "result" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Controls Bar: Batch Selector, Period Filter, Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-4">
                {/* Batch Selector */}
                <div className="flex-1 max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Batch for Result
                  </label>
                  <select
                    value={resultBatchId}
                    onChange={(e) => setResultBatchId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.subject ? `(${b.subject})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Period Range
                  </label>
                  <select
                    value={resultDateFilter}
                    onChange={(e) => setResultDateFilter(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                  >
                    <option value="all">All Time (Full Batch)</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-6">
                <button
                  type="button"
                  onClick={handlePrintResult}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  Print Result Sheet
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Printable Report Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 print:border-none print:shadow-none print:p-0">
            {/* Institution / Batch Header for Print */}
            <div className="border-b border-slate-200 pb-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    Batch Attendance Result Sheet
                  </h3>
                  <p className="text-sm font-semibold text-slate-600 mt-1">
                    Batch: <span className="text-amber-600 font-bold">{resultBatchObj?.name}</span>
                    {resultBatchObj?.subject && <span> • Subject: {resultBatchObj.subject}</span>}
                    {resultBatchObj?.classroom && <span> • Room: {resultBatchObj.classroom}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    Total Classes Conducted: {totalClassSessions} Days
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Generated: {formatDate(todayDate)}
                  </p>
                </div>
              </div>

              {/* Quick Batch Statistics Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 print:hidden">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">Total Enrolled</p>
                  <p className="text-xl font-black text-slate-900">{batchEnrolledStudents.length}</p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">Total Classes Held</p>
                  <p className="text-xl font-black text-amber-600">{totalClassSessions} Days</p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">Avg Attendance Rate</p>
                  <p className="text-xl font-black text-emerald-600">{avgAttendanceRate}%</p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">100% Attendance</p>
                  <p className="text-xl font-black text-teal-600">{perfectAttendanceCount} Students</p>
                </div>
              </div>
            </div>

            {/* Attendance Result Table */}
            {loadingResult ? (
              <div className="p-16 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Calculating Batch Attendance Results...</p>
              </div>
            ) : batchResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center w-20">
                        Roll No
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Student Name</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">Student ID</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">
                        Classes Held
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center text-emerald-700">
                        Present
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center text-amber-700">
                        Late
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center text-rose-700">
                        Absent
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">
                        Attended Days
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-right">
                        Attendance %
                      </th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-center">
                        Result Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {batchResults.map((r) => {
                      const StatusIcon = r.statusTag.icon
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Roll No: Strictly 1..N */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2.25rem] h-8 px-2 rounded-lg bg-amber-50 border border-amber-200 font-black text-amber-800 text-xs font-mono">
                              #{r.roll_no}
                            </span>
                          </td>

                          {/* Student Name */}
                          <td className="px-4 py-3 font-bold text-slate-900">{r.name}</td>

                          {/* Student ID */}
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.student_id}</td>

                          {/* Total Held */}
                          <td className="px-4 py-3 text-center font-mono text-slate-600">{r.totalHeld}</td>

                          {/* Present */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">
                            {r.presentCount}
                          </td>

                          {/* Late */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-amber-600">
                            {r.lateCount}
                          </td>

                          {/* Absent */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-rose-600">
                            {r.absentCount}
                          </td>

                          {/* Attended (Present + Late) */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                            {r.attendedCount} / {r.totalHeld}
                          </td>

                          {/* Attendance Rate */}
                          <td className="px-4 py-3 text-right font-mono">
                            <span
                              className={`text-sm font-black ${
                                r.percentage >= 80
                                  ? "text-emerald-600"
                                  : r.percentage >= 50
                                  ? "text-amber-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {r.percentage}%
                            </span>
                          </td>

                          {/* Result Status Badge */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${r.statusTag.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {r.statusTag.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h4 className="text-base font-bold text-slate-800">No Attendance Records Yet</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Once attendance is taken for this batch, full attendance result and percentages will be calculated here.
                </p>
              </div>
            )}

            {/* Print Signatures Block (Only visible on paper print or at bottom) */}
            <div className="hidden print:grid grid-cols-3 gap-8 pt-16 mt-16 border-t border-slate-300 text-center text-xs text-slate-600 font-semibold">
              <div>
                <div className="border-t border-slate-400 pt-2 w-40 mx-auto">Class Teacher / Instructor</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 w-40 mx-auto">Verified by Reception</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 w-40 mx-auto">Principal / Director</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
