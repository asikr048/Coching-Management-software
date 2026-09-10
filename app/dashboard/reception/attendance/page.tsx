"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  UserCheck, Loader2, Search, Check, X, Clock, HelpCircle, 
  FileSpreadsheet, Printer, Download, Calendar, Award, AlertCircle 
} from "lucide-react"
import { formatDate } from "@/lib/utils"

function normalizeBanglaDigits(str: string): string {
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]
  return str.replace(/[০-৯]/g, (char) => String(banglaDigits.indexOf(char)))
}

export default function ReceptionAttendancePage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<"take" | "result">("take")

  // Take Attendance State
  const [batches, setBatches] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState("")
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [students, setStudents] = useState<any[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; note: string }>>({})
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Batch Result State
  const [resultBatchId, setResultBatchId] = useState("")
  const [resultDateFilter, setResultDateFilter] = useState<"all" | "this_month" | "last_month">("all")
  const [loadingResult, setLoadingResult] = useState(false)
  const [batchAttendanceData, setBatchAttendanceData] = useState<any[]>([])
  const [batchEnrolledStudents, setBatchEnrolledStudents] = useState<any[]>([])

  useEffect(() => {
    supabase
      .from("batches")
      .select("id, name, classroom, subject, current_seats, is_active, status")
      .order("name")
      .then(({ data }) => {
        setBatches(data || [])
        if (data && data.length > 0) {
          if (!selectedBatch) setSelectedBatch(data[0].id)
          if (!resultBatchId) setResultBatchId(data[0].id)
        }
      })
  }, [supabase])

  // Load Students for Selected Batch & Date
  useEffect(() => {
    if (!selectedBatch) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/attendance/batch-data?batch_id=${selectedBatch}&date=${attendanceDate}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || "Failed to load students")
        }
        const data = await res.json()
        const rawStuds = data.students || []
        setStudents(rawStuds)

        const map: Record<string, { status: string; note: string }> = {}
        for (const a of data.dateAttendance || []) {
          map[a.student_id] = { status: a.status, note: a.note || "" }
        }
        for (const s of rawStuds) {
          if (!map[s.id]) map[s.id] = { status: "present", note: "" }
        }
        setAttendanceMap(map)
      } catch (err: any) {
        console.error("Error loading attendance:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedBatch, attendanceDate])

  // Bulk Actions
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

  // Save Attendance
  async function handleSave() {
    if (!selectedBatch || students.length === 0) return
    setLoading(true)
    try {
      const items = students.map((s) => ({
        student_id: s.id,
        batch_id: selectedBatch,
        date: attendanceDate,
        status: attendanceMap[s.id]?.status || "present",
        note: attendanceMap[s.id]?.note || null,
        entry_method: "manual" as const,
      }))
      const res = await fetch("/api/attendance/batch-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: items }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to save attendance")
      }
      toast.success("Attendance saved successfully!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save attendance")
    } finally {
      setLoading(false)
    }
  }

  // Filter students by search (Roll No, Name, Student ID)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = normalizeBanglaDigits(searchQuery.trim().toLowerCase())
    return students.filter((s) => {
      const rollStr = String(s.roll_no || "")
      const nameStr = String(s.name || "").toLowerCase()
      const idStr = String(s.student_id || "").toLowerCase()
      return (
        rollStr === q ||
        `roll ${rollStr}`.includes(q) ||
        `roll #${rollStr}`.includes(q) ||
        `#${rollStr}`.includes(q) ||
        nameStr.includes(q) ||
        idStr.includes(q)
      )
    })
  }, [students, searchQuery])

  // -------------------------------------------------------------
  // Load Data for "Batch Attendance Result"
  // -------------------------------------------------------------
  useEffect(() => {
    if (!resultBatchId) return
    async function fetchResult() {
      setLoadingResult(true)
      try {
        const res = await fetch(`/api/attendance/batch-data?batch_id=${resultBatchId}&filter=${resultDateFilter}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || "Failed to load result data")
        }
        const data = await res.json()
        setBatchEnrolledStudents(data.students || [])
        setBatchAttendanceData(data.attendance || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingResult(false)
      }
    }
    fetchResult()
  }, [resultBatchId, resultDateFilter])

  // Batch Result Calculation
  const { totalClassSessions, batchResults, avgAttendanceRate } = useMemo(() => {
    const distinctDates = Array.from(new Set(batchAttendanceData.map((a) => a.date))).sort()
    const totalHeld = distinctDates.length
    let totalPercentSum = 0

    const results = batchEnrolledStudents.map((student) => {
      const records = batchAttendanceData.filter((a) => a.student_id === student.id)
      const presentCount = records.filter((a) => a.status === "present").length
      const lateCount = records.filter((a) => a.status === "late").length
      const absentCount = records.filter((a) => a.status === "absent").length

      const attendedCount = presentCount + lateCount
      const percentage = totalHeld > 0 ? Math.round((attendedCount / totalHeld) * 100) : 0
      totalPercentSum += percentage

      let statusTag = { label: "Regular", color: "text-emerald-700 bg-emerald-50 border-emerald-200" }
      if (percentage >= 90) statusTag = { label: "Excellent", color: "text-emerald-800 bg-emerald-100 border-emerald-300" }
      else if (percentage >= 75) statusTag = { label: "Good", color: "text-blue-700 bg-blue-50 border-blue-200" }
      else if (percentage >= 50) statusTag = { label: "Irregular", color: "text-amber-700 bg-amber-50 border-amber-200" }
      else statusTag = { label: "Critical", color: "text-rose-700 bg-rose-50 border-rose-200" }

      return {
        id: student.id,
        roll_no: student.roll_no,
        name: student.name,
        student_id: student.student_id,
        totalHeld,
        attendedCount,
        presentCount,
        lateCount,
        absentCount,
        percentage,
        statusTag,
      }
    })

    const avgRate = results.length > 0 ? Math.round(totalPercentSum / results.length) : 0
    return {
      totalClassSessions: totalHeld,
      batchResults: results,
      avgAttendanceRate: avgRate,
    }
  }, [batchAttendanceData, batchEnrolledStudents])

  // Export CSV
  const handleExportCSV = () => {
    const currentBatch = batches.find((b) => b.id === resultBatchId)
    const batchName = currentBatch?.name || "Batch"
    const headers = ["Roll No", "Student Name", "Student ID", "Classes Held", "Attended", "Present", "Late", "Absent", "Attendance %", "Status"]
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

  const resultBatchObj = batches.find((b) => b.id === resultBatchId)

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Attendance Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Take daily attendance & generate batch results</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("take")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === "take"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Take Attendance
          </button>
          <button
            onClick={() => setActiveTab("result")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === "result"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Batch Result Sheet
          </button>
        </div>
      </div>

      {/* ================= TAKE ATTENDANCE ================= */}
      {activeTab === "take" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Batch Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Batch
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
                >
                  {batches.length === 0 ? (
                    <option value="" disabled className="text-slate-400 bg-white">
                      Loading batches / No batches found
                    </option>
                  ) : (
                    <>
                      <option value="" disabled className="text-slate-400 bg-white">
                        -- Select a Batch --
                      </option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id} className="text-slate-900 bg-white py-1.5 font-medium">
                          {b.name} {b.subject ? `(${b.subject})` : ""} {b.classroom ? `• Room ${b.classroom}` : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Attendance Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Search Roll / Name / ID
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Roll 1, Asik..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Quick Mark:</span>
                <button
                  type="button"
                  onClick={() => handleMarkAll("present")}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAll("absent")}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  All Absent
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Total Enrolled: <strong className="text-slate-800">{students.length}</strong>
              </div>
            </div>
          </div>

          {selectedBatch && students.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase w-20">Roll</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase">Student</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase">Student ID</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase">Status</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s) => {
                      const currentStatus = attendanceMap[s.id]?.status || "present"
                      const currentNote = attendanceMap[s.id]?.note || ""

                      return (
                        <tr key={s.id} className="hover:bg-amber-50/20 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2.25rem] h-8 px-2 rounded-lg bg-amber-50 border border-amber-200 font-black text-amber-800 text-xs font-mono">
                              #{s.roll_no}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{s.student_id}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
                              {["present", "late", "absent", "excused"].map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() =>
                                    setAttendanceMap((a) => ({
                                      ...a,
                                      [s.id]: { ...(a[s.id] || { note: "" }), status: st },
                                    }))
                                  }
                                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                                    currentStatus === st
                                      ? st === "present"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : st === "late"
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : st === "absent"
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "bg-blue-600 text-white shadow-xs"
                                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={currentNote}
                              onChange={(e) =>
                                setAttendanceMap((a) => ({
                                  ...a,
                                  [s.id]: { ...(a[s.id] || { status: "present" }), note: e.target.value },
                                }))
                              }
                              placeholder="Remarks (optional)..."
                              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
                <p className="text-xs text-slate-600">
                  Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students • Present:{" "}
                  <span className="text-emerald-700 font-bold">
                    {Object.values(attendanceMap).filter((v) => v.status === "present").length}
                  </span>{" "}
                  • Absent:{" "}
                  <span className="text-rose-700 font-bold">
                    {Object.values(attendanceMap).filter((v) => v.status === "absent").length}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" /> Save Attendance
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {selectedBatch && students.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-400">
              No students enrolled in this batch.
            </div>
          )}
        </div>
      )}

      {/* ================= BATCH RESULT SHEET ================= */}
      {activeTab === "result" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 print:hidden">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex-1 max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Batch
                  </label>
                  <select
                    value={resultBatchId}
                    onChange={(e) => setResultBatchId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                  >
                    {batches.length === 0 ? (
                      <option value="" disabled className="text-slate-400 bg-white">
                        No Batches Available
                      </option>
                    ) : (
                      <>
                        <option value="" disabled className="text-slate-400 bg-white">
                          -- Select a Batch --
                        </option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id} className="text-slate-900 bg-white py-1.5 font-medium">
                            {b.name} {b.subject ? `(${b.subject})` : ""} {b.classroom ? `• Room ${b.classroom}` : ""}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Period
                  </label>
                  <select
                    value={resultDateFilter}
                    onChange={(e) => setResultDateFilter(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">All Time</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:pt-6">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  Print Result Sheet
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-sm font-bold shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 print:border-none print:shadow-none print:p-0">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">Batch Attendance Result</h3>
                <p className="text-sm text-slate-600 font-semibold mt-0.5">
                  Batch: <span className="text-amber-600 font-bold">{resultBatchObj?.name}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5" />
                  Classes Held: {totalClassSessions} Days
                </span>
                <p className="text-xs text-slate-400 mt-1">Average Attendance: {avgAttendanceRate}%</p>
              </div>
            </div>

            {loadingResult ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-2" />
                <p className="text-sm">Calculating Result...</p>
              </div>
            ) : batchResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase w-20">Roll</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase">Student Name</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase">Student ID</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase">Held</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase text-emerald-700">Present</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase text-amber-700">Late</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase text-rose-700">Absent</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase">Attended</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase">Attendance %</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {batchResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2.25rem] h-8 px-2 rounded-lg bg-amber-50 border border-amber-200 font-black text-amber-800 text-xs font-mono">
                            #{r.roll_no}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">{r.name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{r.student_id}</td>
                        <td className="px-4 py-3 text-center font-mono">{r.totalHeld}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">{r.presentCount}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-600">{r.lateCount}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-rose-600">{r.absentCount}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">{r.attendedCount}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          <span
                            className={
                              r.percentage >= 80 ? "text-emerald-600" : r.percentage >= 50 ? "text-amber-600" : "text-rose-600"
                            }
                          >
                            {r.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${r.statusTag.color}`}>
                            {r.statusTag.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">No attendance records for this batch.</div>
            )}

            <div className="hidden print:grid grid-cols-3 gap-8 pt-16 mt-16 border-t border-slate-300 text-center text-xs text-slate-600 font-semibold">
              <div><div className="border-t border-slate-400 pt-2 w-40 mx-auto">Teacher / Instructor</div></div>
              <div><div className="border-t border-slate-400 pt-2 w-40 mx-auto">Reception Officer</div></div>
              <div><div className="border-t border-slate-400 pt-2 w-40 mx-auto">Principal / Director</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
