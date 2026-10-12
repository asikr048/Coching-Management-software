"use client"

import React, { useState, useRef, useMemo } from "react"
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  Search,
  Check,
  RefreshCw,
  Eye,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { cn, getGrade } from "@/lib/utils"

export interface BulkResultUploadModalProps {
  isOpen: boolean
  onClose: () => void
  exam: any
  isWeeklyExam: boolean
  parsedWeeklyDays: Array<{
    key: string
    day_bn: string
    day_en: string
    exam_name: string
    subject: string
    total_marks: number
    pass_marks: number
  }>
  students: Array<{
    id: string
    name: string
    student_id: string
    roll_no?: number | null
    batch_roll?: number | null
  }>
  dayMarksMap: Record<string, Record<string, any>>
  markInputModes?: Record<string, "total" | "mcq" | "written" | "both">
  totalWeeklyMaxMarks?: number
  onSuccess: (updatedDayMarksMap: Record<string, Record<string, any>>, updatedSavedResults: Record<string, any>) => void
}

interface ParsedStudentResult {
  student: {
    id: string
    name: string
    student_id: string
    roll_no?: number | null
  }
  rawRoll: string
  rawId: string
  rawName: string
  isMatched: boolean
  dayMarks: Record<
    string,
    {
      marks: number
      total: number
      mcq?: number
      written?: number
      mode?: "total" | "mcq" | "written" | "both"
      isOverMax?: boolean
    }
  >
  oneTimeMark?: {
    marks: number
    mcq?: number
    written?: number
    isOverMax?: boolean
  }
  totalObtained: number
  hasErrors: boolean
  errorMsg?: string
}

const BN_TO_EN_DIGITS: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
}

function parseNumberFlexible(val: any): number | null {
  if (val === null || val === undefined) return null
  let s = String(val).trim()
  if (s === "") return null
  s = s.replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] || d)
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export default function BulkResultUploadModal({
  isOpen,
  onClose,
  exam,
  isWeeklyExam,
  parsedWeeklyDays = [],
  students = [],
  dayMarksMap = {},
  markInputModes = {},
  totalWeeklyMaxMarks = 350,
  onSuccess,
}: BulkResultUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedStudentResult[]>([])
  const [showFormatGuide, setShowFormatGuide] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<"all" | "matched" | "unmatched" | "error">("all")

  // Generate clean columns description for the current exam
  const columnsConfig = useMemo(() => {
    if (isWeeklyExam && parsedWeeklyDays.length > 0) {
      return parsedWeeklyDays.map((d) => {
        const mode = markInputModes[d.key.toLowerCase()] || "total"
        return {
          day: d,
          mode,
          isBoth: mode === "both",
        }
      })
    }
    return []
  }, [isWeeklyExam, parsedWeeklyDays, markInputModes])

  if (!isOpen) return null

  // 1. Download Sample Excel Template
  async function handleDownloadSampleTemplate() {
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()

      const headerRow1: string[] = ["রোল (Roll)", "আইডি (Student ID)", "শিক্ষার্থীর নাম (Student Name)"]
      const headerRow2: string[] = ["Roll", "Student ID", "Name"]

      if (isWeeklyExam && columnsConfig.length > 0) {
        for (const col of columnsConfig) {
          const dayLabel = `${col.day.day_bn} (${col.day.day_en})`
          if (col.isBoth) {
            // Two columns for Both mode
            headerRow1.push(dayLabel, dayLabel)
            headerRow2.push("MCQ", "Written")
          } else if (col.mode === "mcq") {
            headerRow1.push(dayLabel)
            headerRow2.push("MCQ")
          } else if (col.mode === "written") {
            headerRow1.push(dayLabel)
            headerRow2.push("Written")
          } else {
            headerRow1.push(dayLabel)
            headerRow2.push("Marks")
          }
        }
      } else {
        // One-time exam
        headerRow1.push(exam?.title || "পরীক্ষার নম্বর (Marks)")
        headerRow2.push("Marks")
      }

      const rows: any[][] = [headerRow1, headerRow2]

      // Populate student rows with existing data or sample blanks
      students.forEach((s, idx) => {
        const rNo = s.roll_no || s.batch_roll || idx + 1
        const sRow: any[] = [rNo, s.student_id || "", s.name || ""]

        if (isWeeklyExam && columnsConfig.length > 0) {
          for (const col of columnsConfig) {
            const dayKey = col.day.key.toLowerCase()
            const existingDayMark = dayMarksMap[s.id]?.[dayKey]
            if (col.isBoth) {
              sRow.push(
                existingDayMark?.mcq !== undefined ? existingDayMark.mcq : "",
                existingDayMark?.written !== undefined ? existingDayMark.written : ""
              )
            } else if (col.mode === "mcq") {
              sRow.push(existingDayMark?.mcq ?? existingDayMark?.marks ?? "")
            } else if (col.mode === "written") {
              sRow.push(existingDayMark?.written ?? existingDayMark?.marks ?? "")
            } else {
              sRow.push(existingDayMark?.marks ?? "")
            }
          }
        } else {
          sRow.push("")
        }

        rows.push(sRow)
      })

      const ws = XLSX.utils.aoa_to_sheet(rows)

      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // Roll
        { wch: 18 }, // ID
        { wch: 26 }, // Name
        ...Array(headerRow1.length - 3).fill({ wch: 18 }),
      ]

      const sheetName = isWeeklyExam ? "Weekly_Result_Sheet" : "Exam_Result_Sheet"
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      const safeTitle = (exam?.title || "Exam")
        .replace(/[/\\?%*:|"<>]/g, "_")
        .trim()
      XLSX.writeFile(wb, `${safeTitle}_Bulk_Result_Template.xlsx`)
      toast.success("✓ নমুনা এক্সেল টেমপ্লেট সফলভাবে ডাউনলোড হয়েছে!")
    } catch (err: any) {
      console.error("Download template error:", err)
      toast.error("এক্সেল টেমপ্লেট তৈরি করতে ব্যর্থ হয়েছে")
    }
  }

  // 2. Parse Uploaded Excel File
  async function handleFileProcess(file: File) {
    setSelectedFile(file)
    setParsing(true)
    setParsedData([])

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array", cellFormula: false, raw: true })

      const sheetName = wb.SheetNames[0]
      if (!sheetName) {
        throw new Error("এক্সেল ফাইলে কোনো শিট পাওয়া যায়নি")
      }

      const ws = wb.Sheets[sheetName]
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: false,
        defval: "",
      })

      if (rawRows.length < 3) {
        throw new Error("ফাইলে পর্যাপ্ত তথ্য নেই। কমপক্ষে ৩টি সারি (Row 1: দিন, Row 2: MCQ/Written, Row 3+: শিক্ষার্থী) থাকতে হবে।")
      }

      const row1 = rawRows[0].map((v) => String(v || "").trim())
      const row2 = rawRows[1].map((v) => String(v || "").trim())

      // Detect Roll, ID, and Name columns
      let rollColIdx = -1
      let idColIdx = -1
      let nameColIdx = -1

      for (let c = 0; c < Math.min(row1.length, 6); c++) {
        const h1 = row1[c].toLowerCase()
        const h2 = row2[c].toLowerCase()
        if (rollColIdx === -1 && (h1.includes("roll") || h1.includes("রোল") || h2.includes("roll") || h2.includes("রোল"))) {
          rollColIdx = c
        } else if (idColIdx === -1 && (h1.includes("id") || h1.includes("আইডি") || h2.includes("id") || h2.includes("আইডি"))) {
          idColIdx = c
        } else if (nameColIdx === -1 && (h1.includes("name") || h1.includes("নাম") || h2.includes("name") || h2.includes("নাম"))) {
          nameColIdx = c
        }
      }

      if (rollColIdx === -1) rollColIdx = 0
      if (idColIdx === -1 && row1.length > 1) idColIdx = 1
      if (nameColIdx === -1 && row1.length > 2) nameColIdx = 2

      // Map score columns
      interface ScoreColumnMeta {
        colIdx: number
        dayKey?: string
        dayConfig?: (typeof parsedWeeklyDays)[0]
        type: "mcq" | "written" | "total"
      }

      const scoreColumns: ScoreColumnMeta[] = []
      let lastInheritedDayKey: string | null = null

      for (let c = 0; c < row1.length; c++) {
        if (c === rollColIdx || c === idColIdx || c === nameColIdx) continue

        const h1 = row1[c]
        const h2 = row2[c]

        if (isWeeklyExam && parsedWeeklyDays.length > 0) {
          // Identify matching day
          let matchedDay = parsedWeeklyDays.find((d) => {
            const lk = d.key.toLowerCase()
            const bn = d.day_bn.toLowerCase()
            const en = d.day_en.toLowerCase()
            const text = (h1 + " " + h2).toLowerCase()
            return text.includes(lk) || text.includes(bn) || text.includes(en)
          })

          if (!matchedDay && lastInheritedDayKey && (h1 === "" || h1 === lastInheritedDayKey)) {
            // Merged header column inheritance
            matchedDay = parsedWeeklyDays.find((d) => d.key.toLowerCase() === lastInheritedDayKey?.toLowerCase())
          }

          if (matchedDay) {
            lastInheritedDayKey = matchedDay.key.toLowerCase()
            const h2Lower = h2.toLowerCase()
            let scoreType: "mcq" | "written" | "total" = "total"
            let prevDayCol: ScoreColumnMeta | undefined
            for (let i = scoreColumns.length - 1; i >= 0; i--) {
              if (scoreColumns[i].dayKey === matchedDay.key.toLowerCase()) {
                prevDayCol = scoreColumns[i]
                break
              }
            }

            if (h2Lower.includes("mcq") || h2Lower.includes("নৈর্ব্যক্তিক") || h2Lower.includes("এমসিকিউ")) {
              scoreType = "mcq"
            } else if (h2Lower.includes("written") || h2Lower.includes("লিখিত") || h2Lower.includes("রচনামূলক") || h2Lower.includes("wr")) {
              scoreType = "written"
            } else if (h2Lower.includes("both") || h2Lower.includes("উভয়") || h2Lower.includes("উভয়")) {
              if (prevDayCol) {
                prevDayCol.type = "mcq"
                scoreType = "written"
              } else {
                scoreType = "mcq"
              }
            } else if (prevDayCol && prevDayCol.type === "total") {
              // Two columns provided for the same day without explicit tags -> col 1 is MCQ, col 2 is Written
              prevDayCol.type = "mcq"
              scoreType = "written"
            }

            scoreColumns.push({
              colIdx: c,
              dayKey: matchedDay.key.toLowerCase(),
              dayConfig: matchedDay,
              type: scoreType,
            })
          }
        } else {
          // One-time exam
          const hLower = (h1 + " " + h2).toLowerCase()
          let scoreType: "mcq" | "written" | "total" = "total"
          if (hLower.includes("mcq")) scoreType = "mcq"
          else if (hLower.includes("written") || hLower.includes("লিখিত")) scoreType = "written"

          scoreColumns.push({
            colIdx: c,
            type: scoreType,
          })
        }
      }

      if (scoreColumns.length === 0) {
        throw new Error("কোনো নম্বরের কলাম সনাক্ত করা সম্ভব হয়নি। অনুগ্রহ করে নমুনা এক্সেল ফরম্যাট অনুযায়ী দিন ও MCQ/Written কলাম দিন।")
      }

      // Map Students by roll and id for ultra-fast lookup
      const studentsByRoll = new Map<number, (typeof students)[0]>()
      const studentsById = new Map<string, (typeof students)[0]>()
      const studentsByName = new Map<string, (typeof students)[0]>()

      students.forEach((s) => {
        if (s.roll_no != null) studentsByRoll.set(Number(s.roll_no), s)
        if (s.batch_roll != null) studentsByRoll.set(Number(s.batch_roll), s)
        if (s.student_id) studentsById.set(s.student_id.trim().toLowerCase(), s)
        if (s.name) studentsByName.set(s.name.trim().toLowerCase(), s)
      })

      // Parse data rows (Row 3 onwards)
      const parsedResults: ParsedStudentResult[] = []

      for (let r = 2; r < rawRows.length; r++) {
        const rowData = rawRows[r]
        if (!rowData || rowData.length === 0) continue

        const rawRoll = String(rowData[rollColIdx] || "").trim()
        const rawId = idColIdx >= 0 ? String(rowData[idColIdx] || "").trim() : ""
        const rawName = nameColIdx >= 0 ? String(rowData[nameColIdx] || "").trim() : ""

        // Skip completely empty spacer rows
        if (!rawRoll && !rawId && !rawName) continue

        const parsedRollNum = parseNumberFlexible(rawRoll)

        // Find student
        let matchedStudent: (typeof students)[0] | undefined
        if (parsedRollNum !== null && studentsByRoll.has(parsedRollNum)) {
          matchedStudent = studentsByRoll.get(parsedRollNum)
        } else if (rawId && studentsById.has(rawId.toLowerCase())) {
          matchedStudent = studentsById.get(rawId.toLowerCase())
        } else if (rawName && studentsByName.has(rawName.toLowerCase())) {
          matchedStudent = studentsByName.get(rawName.toLowerCase())
        }

        const isMatched = !!matchedStudent
        const studentObj = matchedStudent || {
          id: `unmatched-${r}`,
          name: rawName || "অপরিচিত শিক্ষার্থী",
          student_id: rawId || "",
          roll_no: parsedRollNum,
        }

        const studentDayMarks: ParsedStudentResult["dayMarks"] = {}
        let studentOneTimeMark: ParsedStudentResult["oneTimeMark"]
        let totalObt = 0
        let hasRowError = !isMatched
        let rowErrorMsg = !isMatched ? "শিক্ষার্থীর রোল বা আইডি সিস্টেমে মেলেনি" : undefined

        if (isWeeklyExam) {
          // Group scores by day
          for (const col of scoreColumns) {
            if (!col.dayKey || !col.dayConfig) continue
            const val = parseNumberFlexible(rowData[col.colIdx])
            if (val === null) continue

            const dayMax = col.dayConfig.total_marks || 50
            const isOver = val > dayMax

            if (isOver) {
              hasRowError = true
              rowErrorMsg = `${col.dayConfig.day_bn}-এর নম্বর সর্বোচ্চ ${dayMax}-এর বেশি হয়েছে (${val})`
            }

            if (!studentDayMarks[col.dayKey]) {
              studentDayMarks[col.dayKey] = {
                marks: 0,
                total: dayMax,
                mode: "total",
                isOverMax: isOver,
              }
            }

            const cur = studentDayMarks[col.dayKey]
            if (col.type === "mcq") {
              cur.mcq = val
              cur.mode = cur.written !== undefined ? "both" : "mcq"
              cur.marks = (cur.mcq || 0) + (cur.written || 0)
            } else if (col.type === "written") {
              cur.written = val
              cur.mode = cur.mcq !== undefined ? "both" : "written"
              cur.marks = (cur.mcq || 0) + (cur.written || 0)
            } else {
              cur.marks = val
            }

            if (cur.marks > dayMax) cur.isOverMax = true
          }

          // Calculate grand total across days
          totalObt = Object.values(studentDayMarks).reduce((acc, curr) => acc + (curr.marks || 0), 0)
        } else {
          // One-time exam
          let mcqVal: number | undefined
          let wrVal: number | undefined
          let totalMarkVal = 0

          for (const col of scoreColumns) {
            const val = parseNumberFlexible(rowData[col.colIdx])
            if (val === null) continue
            if (col.type === "mcq") mcqVal = val
            else if (col.type === "written") wrVal = val
            else totalMarkVal = val
          }

          const examMax = Number(exam?.total_marks) || 100
          if (mcqVal !== undefined || wrVal !== undefined) {
            totalMarkVal = (mcqVal || 0) + (wrVal || 0)
          }

          const isOver = totalMarkVal > examMax
          if (isOver) {
            hasRowError = true
            rowErrorMsg = `প্রাপ্ত নম্বর সর্বোচ্চ ${examMax}-এর বেশি হয়েছে (${totalMarkVal})`
          }

          studentOneTimeMark = {
            marks: totalMarkVal,
            mcq: mcqVal,
            written: wrVal,
            isOverMax: isOver,
          }
          totalObt = totalMarkVal
        }

        parsedResults.push({
          student: studentObj,
          rawRoll: rawRoll || (parsedRollNum !== null ? String(parsedRollNum) : ""),
          rawId,
          rawName,
          isMatched,
          dayMarks: studentDayMarks,
          oneTimeMark: studentOneTimeMark,
          totalObtained: totalObt,
          hasErrors: hasRowError,
          errorMsg: rowErrorMsg,
        })
      }

      setParsedData(parsedResults)
      toast.success(`✓ ${parsedResults.length} জন শিক্ষার্থীর ডাটা প্রসেস করা হয়েছে!`)
    } catch (err: any) {
      console.error("Excel parse error:", err)
      toast.error(err.message || "এক্সেল ফাইল রিড করতে ব্যর্থ হয়েছে")
    } finally {
      setParsing(false)
    }
  }

  // 3. Confirm & Save to Server API
  async function handleConfirmSave() {
    const validRows = parsedData.filter((r) => r.isMatched && !r.hasErrors)
    if (validRows.length === 0) {
      toast.error("সংরক্ষণের জন্য কোনো বৈধ ফলাফল পাওয়া যায়নি। অনুগ্রহ করে রোলের অমিল বা ভুল নম্বর ঠিক করুন।")
      return
    }

    setSaving(true)
    try {
      const batchUpdates: any[] = []
      const nextDayMarksMap: Record<string, Record<string, any>> = { ...dayMarksMap }
      const nextSavedResults: Record<string, any> = {}

      for (const row of validRows) {
        const sId = row.student.id

        if (isWeeklyExam) {
          const studentExistingDays = { ...(nextDayMarksMap[sId] || {}) }
          let studentTotal = 0

          for (const [dayKey, item] of Object.entries(row.dayMarks)) {
            const dayConf = parsedWeeklyDays.find((d) => d.key.toLowerCase() === dayKey)
            studentExistingDays[dayKey] = {
              marks: item.marks,
              total: item.total,
              grade: getGrade(item.marks, item.total),
              subject: dayConf?.subject || "",
              exam_name: dayConf?.exam_name || "",
              mcq: item.mcq,
              written: item.written,
              mode: item.mode || "total",
            }
          }

          studentTotal = Object.values(studentExistingDays).reduce(
            (acc, curr) => acc + (Number(curr?.marks) || 0),
            0
          )
          const grade = getGrade(studentTotal, totalWeeklyMaxMarks)

          nextDayMarksMap[sId] = studentExistingDays
          nextSavedResults[sId] = {
            student_id: sId,
            obtained_marks: String(studentTotal),
            grade,
          }

          batchUpdates.push({
            student_id: sId,
            obtained_marks: studentTotal,
            grade,
            day_marks: studentExistingDays,
          })
        } else {
          // One-time exam
          const obt = row.oneTimeMark?.marks || 0
          const examMax = Number(exam?.total_marks) || 100
          const grade = getGrade(obt, examMax)

          nextSavedResults[sId] = {
            student_id: sId,
            obtained_marks: String(obt),
            grade,
            mcq: row.oneTimeMark?.mcq,
            written: row.oneTimeMark?.written,
          }

          batchUpdates.push({
            student_id: sId,
            obtained_marks: obt,
            grade,
            day_marks: {
              main: {
                marks: obt,
                total: examMax,
                grade,
                mcq: row.oneTimeMark?.mcq,
                written: row.oneTimeMark?.written,
              },
            },
          })
        }
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
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Failed to save results to server")
      }

      toast.success(`✓ সফলভাবে ${validRows.length} জন শিক্ষার্থীর নম্বর এক্সেল থেকে সংরক্ষিত হয়েছে!`)
      onSuccess(nextDayMarksMap, nextSavedResults)
      onClose()
    } catch (err: any) {
      console.error("Save excel results error:", err)
      toast.error(err.message || "নম্বর সংরক্ষণ করতে সমস্যা হয়েছে")
    } finally {
      setSaving(false)
    }
  }

  // Filtered list of parsed results for review
  const filteredParsed = useMemo(() => {
    return parsedData.filter((r) => {
      if (filterMode === "matched" && (!r.isMatched || r.hasErrors)) return false
      if (filterMode === "unmatched" && r.isMatched) return false
      if (filterMode === "error" && !r.hasErrors) return false

      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        r.rawRoll.toLowerCase().includes(q) ||
        r.rawName.toLowerCase().includes(q) ||
        r.rawId.toLowerCase().includes(q) ||
        r.student.name.toLowerCase().includes(q)
      )
    })
  }, [parsedData, filterMode, searchQuery])

  const totalMatchedCount = parsedData.filter((r) => r.isMatched && !r.hasErrors).length
  const totalErrorCount = parsedData.filter((r) => r.hasErrors || !r.isMatched).length

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl my-4 flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50 rounded-t-3xl shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  বাল্ক রেজাল্ট আপলোড (Excel Import)
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isWeeklyExam ? "সাপ্তাহিক পরীক্ষা" : "এককালীন পরীক্ষা"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {exam?.title} • মোট পরীক্ষার্থী: {students.length} জন • এক্সেল ফাইল আপলোড করে একসাথে সকল শিক্ষার্থীর নম্বর এন্ট্রি করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Action Row: Download Template & View Format */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-600" />
                ১. নমুনা এক্সেল টেমপ্লেট সংগ্রহ করুন
              </h4>
              <p className="text-xs text-slate-600">
                এই পরীক্ষায় রোল ও শিক্ষার্থীর নামসহ সাজানো এক্সেল ফাইল নামিয়ে সহজে নম্বর টাইপ করুন।
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setShowFormatGuide(!showFormatGuide)}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>{showFormatGuide ? "গাইড লুকান" : "ফরম্যাট দেখুন"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                <span>নমুনা ফাইল ডাউনলোড (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Visual Format Guide Table (Expandable / Preview) */}
          {showFormatGuide && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3 shadow-md animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Info className="w-4 h-4" />
                  <span>এক্সেল শিটের গঠন ও কলাম ফরম্যাট নির্দেশিকা:</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Row 1: দিন | Row 2: MCQ/Written</span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-center border-collapse">
                  <thead>
                    {/* Row 1 */}
                    <tr className="bg-slate-800 text-amber-300 border-b border-slate-700 font-bold">
                      <th className="p-2 border border-slate-700 text-left">রোল (Roll)</th>
                      <th className="p-2 border border-slate-700 text-left">আইডি (Student ID)</th>
                      <th className="p-2 border border-slate-700 text-left">নাম (Student Name)</th>
                      {isWeeklyExam && columnsConfig.length > 0 ? (
                        columnsConfig.map((col, idx) => (
                          <th
                            key={idx}
                            colSpan={col.isBoth ? 2 : 1}
                            className="p-2 border border-slate-700 bg-indigo-950/80 text-indigo-300"
                          >
                            {col.day.day_bn} ({col.day.day_en})
                          </th>
                        ))
                      ) : (
                        <th className="p-2 border border-slate-700 bg-indigo-950/80 text-indigo-300">
                          {exam?.title || "পরীক্ষার নম্বর"}
                        </th>
                      )}
                    </tr>

                    {/* Row 2 */}
                    <tr className="bg-slate-800/60 text-slate-300 border-b border-slate-700 font-semibold text-[11px]">
                      <td className="p-1.5 border border-slate-700 text-left">Roll</td>
                      <td className="p-1.5 border border-slate-700 text-left">Student ID</td>
                      <td className="p-1.5 border border-slate-700 text-left">Name</td>
                      {isWeeklyExam && columnsConfig.length > 0 ? (
                        columnsConfig.map((col, idx) => (
                          <React.Fragment key={idx}>
                            {col.isBoth ? (
                              <>
                                <td className="p-1.5 border border-slate-700 bg-purple-950/50 text-purple-300 font-bold">
                                  MCQ
                                </td>
                                <td className="p-1.5 border border-slate-700 bg-blue-950/50 text-blue-300 font-bold">
                                  Written
                                </td>
                              </>
                            ) : (
                              <td className="p-1.5 border border-slate-700 text-slate-300 font-bold">
                                {col.mode === "mcq" ? "MCQ" : col.mode === "written" ? "Written" : "Marks"}
                              </td>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <td className="p-1.5 border border-slate-700 text-slate-300 font-bold">Marks</td>
                      )}
                    </tr>
                  </thead>
                  <tbody className="text-slate-300 font-mono text-[11px]">
                    <tr className="border-b border-slate-800">
                      <td className="p-1.5 border border-slate-800 text-left font-bold text-white">1</td>
                      <td className="p-1.5 border border-slate-800 text-left">MS-001</td>
                      <td className="p-1.5 border border-slate-800 text-left text-slate-300 font-sans">রাহাত হাসান</td>
                      {isWeeklyExam && columnsConfig.length > 0 ? (
                        columnsConfig.map((col, idx) => (
                          <React.Fragment key={idx}>
                            {col.isBoth ? (
                              <>
                                <td className="p-1.5 border border-slate-800 text-emerald-400">20</td>
                                <td className="p-1.5 border border-slate-800 text-emerald-400">25</td>
                              </>
                            ) : (
                              <td className="p-1.5 border border-slate-800 text-emerald-400">45</td>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <td className="p-1.5 border border-slate-800 text-emerald-400">85</td>
                      )}
                    </tr>
                    <tr>
                      <td className="p-1.5 border border-slate-800 text-left font-bold text-white">2</td>
                      <td className="p-1.5 border border-slate-800 text-left">MS-002</td>
                      <td className="p-1.5 border border-slate-800 text-left text-slate-300 font-sans">সাদিয়া আক্তার</td>
                      {isWeeklyExam && columnsConfig.length > 0 ? (
                        columnsConfig.map((col, idx) => (
                          <React.Fragment key={idx}>
                            {col.isBoth ? (
                              <>
                                <td className="p-1.5 border border-slate-800 text-emerald-400">18</td>
                                <td className="p-1.5 border border-slate-800 text-emerald-400">28</td>
                              </>
                            ) : (
                              <td className="p-1.5 border border-slate-800 text-emerald-400">42</td>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <td className="p-1.5 border border-slate-800 text-emerald-400">80</td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">
                💡 <strong>টিপ:</strong> উপরে থাকা "নমুনা ফাইল ডাউনলোড (.xlsx)" বাটনে ক্লিক করলে আপনার বর্তমান এক্সামের সকল শিক্ষার্থীর নামসহ রেডিমেড ফাইল ডাউনলোড হবে।
              </p>
            </div>
          )}

          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileProcess(e.dataTransfer.files[0])
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "p-6 sm:p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
              isDragging
                ? "border-emerald-500 bg-emerald-50/50 scale-[0.99]"
                : "border-slate-300 hover:border-emerald-500 hover:bg-slate-50 bg-white"
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0])
                }
              }}
            />

            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              {parsing ? (
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              ) : (
                <Upload className="w-7 h-7 text-emerald-600" />
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">
                {selectedFile ? selectedFile.name : "এক্সেল ফাইল আপলোড করতে এখানে ক্লিক করুন অথবা ড্র্যাগ করুন"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                সমর্থিত ফাইল ফরম্যাট: <strong>.xlsx, .xls, .csv</strong> (Microsoft Excel বা Google Sheets)
              </p>
            </div>

            {selectedFile && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                ✓ নির্বাচিত ফাইল: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          {/* Parsed Results Section */}
          {parsedData.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-slate-500">মোট সারি / শিক্ষার্থী</p>
                    <p className="text-lg font-black text-slate-900">{parsedData.length} জন</p>
                  </div>
                  <FileSpreadsheet className="w-6 h-6 text-slate-400" />
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-emerald-700">সফলভাবে প্রস্তুত</p>
                    <p className="text-lg font-black text-emerald-800">{totalMatchedCount} জন</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-amber-700">ত্রুটি বা অমিল</p>
                    <p className="text-lg font-black text-amber-800">{totalErrorCount} টি</p>
                  </div>
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
              </div>

              {/* Toolbar & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="রোল বা নাম দিয়ে খুঁজুন..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      filterMode === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    )}
                  >
                    সকল ({parsedData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("matched")}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      filterMode === "matched"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-emerald-700 border border-emerald-200"
                    )}
                  >
                    প্রস্তুত ({totalMatchedCount})
                  </button>
                  {totalErrorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode("error")}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        filterMode === "error"
                          ? "bg-amber-600 text-white"
                          : "bg-white text-amber-700 border border-amber-200"
                      )}
                    >
                      ত্রুটি ({totalErrorCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Parsed Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 font-bold z-10">
                    <tr>
                      <th className="p-3 w-16 text-center">রোল</th>
                      <th className="p-3">শিক্ষার্থী</th>
                      {isWeeklyExam && columnsConfig.length > 0 ? (
                        columnsConfig.map((col, idx) => (
                          <th key={idx} className="p-3 text-center">
                            {col.day.day_bn} ({col.day.total_marks}m)
                          </th>
                        ))
                      ) : (
                        <th className="p-3 text-center">প্রাপ্ত নম্বর</th>
                      )}
                      <th className="p-3 text-center">মোট প্রাপ্ত</th>
                      <th className="p-3 text-center w-28">অবস্থা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredParsed.map((item, idx) => {
                      return (
                        <tr
                          key={idx}
                          className={cn(
                            "hover:bg-slate-50 transition-colors",
                            item.hasErrors ? "bg-amber-50/40" : ""
                          )}
                        >
                          <td className="p-3 text-center font-bold font-mono">
                            {item.rawRoll || item.student.roll_no || "-"}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{item.student.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ID: {item.student.student_id || item.rawId || "-"}
                            </p>
                          </td>

                          {/* Day marks / Scores */}
                          {isWeeklyExam && columnsConfig.length > 0 ? (
                            columnsConfig.map((col, cIdx) => {
                              const dData = item.dayMarks[col.day.key.toLowerCase()]
                              if (!dData) {
                                return (
                                  <td key={cIdx} className="p-3 text-center text-slate-300">
                                    -
                                  </td>
                                )
                              }

                              return (
                                <td key={cIdx} className="p-3 text-center">
                                  {col.isBoth && (dData.mcq !== undefined || dData.written !== undefined) ? (
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border",
                                        dData.isOverMax
                                          ? "bg-rose-100 text-rose-800 border-rose-300"
                                          : "bg-purple-50 text-purple-900 border-purple-200"
                                      )}
                                    >
                                      M:{dData.mcq ?? 0} + W:{dData.written ?? 0} = {dData.marks}
                                    </span>
                                  ) : (
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border",
                                        dData.isOverMax
                                          ? "bg-rose-100 text-rose-800 border-rose-300"
                                          : "bg-slate-100 text-slate-800 border-slate-200"
                                      )}
                                    >
                                      {dData.marks}
                                    </span>
                                  )}
                                </td>
                              )
                            })
                          ) : (
                            <td className="p-3 text-center font-bold font-mono">
                              {item.oneTimeMark?.marks ?? "-"}
                            </td>
                          )}

                          {/* Grand total */}
                          <td className="p-3 text-center font-black font-mono text-emerald-700">
                            {item.totalObtained}
                          </td>

                          {/* Status */}
                          <td className="p-3 text-center">
                            {item.hasErrors ? (
                              <span
                                title={item.errorMsg}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                              >
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                {item.errorMsg || "ত্রুটি"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" />
                                প্রস্তুত
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 rounded-b-3xl flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            বাতিল (Close)
          </button>

          <button
            type="button"
            onClick={handleConfirmSave}
            disabled={saving || totalMatchedCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            )}
            <span>
              {totalMatchedCount > 0
                ? `${totalMatchedCount} জন শিক্ষার্থীর নম্বর সংরক্ষণ করুন`
                : "নম্বর সংরক্ষণ করুন"}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
