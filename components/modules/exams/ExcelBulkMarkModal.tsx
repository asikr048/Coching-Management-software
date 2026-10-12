"use client"

import React, { useState, useRef, useMemo } from "react"
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Info,
  Loader2,
  FileCheck,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { cn, getGrade } from "@/lib/utils"

export type BulkMarkInputMode = "total" | "mcq" | "written" | "both"

export interface BulkStudentItem {
  id: string
  name: string
  student_id: string
  roll_no?: number | null
  batch_roll?: number | null
}

export interface WeeklyDayInfo {
  key: string
  day_bn: string
  day_en?: string
  subject?: string
  exam_name?: string
  total_marks: number
  pass_marks: number
}

export interface ParsedStudentRow {
  key: string
  studentIdRaw: string
  rollRaw: string
  nameRaw: string
  matchedStudent: BulkStudentItem | null
  mcq: number | null
  written: number | null
  totalMarks: number | null
  dayMarks?: Record<string, number | null>
  isValid: boolean
  error?: string
}

export interface ExcelBulkMarkModalProps {
  isOpen: boolean
  onClose: () => void
  examTitle: string
  scopeTitle: string
  scopeType: "daily" | "weekly" | "routine" | "one_time" | "combined"
  activeDayConfig?: WeeklyDayInfo | null
  weeklyDays?: WeeklyDayInfo[]
  maxMarks: number
  passMarks: number
  currentMode: BulkMarkInputMode
  students: BulkStudentItem[]
  onApplyMarks: (
    results: Array<{
      studentId: string
      marks: number
      mcq?: number
      written?: number
      mode: BulkMarkInputMode
      dayMarks?: Record<string, number>
    }>,
    mode: BulkMarkInputMode
  ) => Promise<void>
}

// Convert Bengali numerals to standard ASCII digits
function normalizeDigits(val: any): string {
  if (val === null || val === undefined) return ""
  const str = String(val).trim()
  const bnToEnMap: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  }
  return str.replace(/[০-৯]/g, (c) => bnToEnMap[c] || c)
}

// Sanitize cell text to prevent spreadsheet formula injection
function sanitizeCellValue(val: any): string {
  if (val === null || val === undefined) return ""
  let str = String(val).trim()
  if (str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@")) {
    str = str.replace(/^[=+\-@]+/, "").trim()
  }
  return str
}

export default function ExcelBulkMarkModal({
  isOpen,
  onClose,
  examTitle,
  scopeTitle,
  scopeType,
  activeDayConfig = null,
  weeklyDays = [],
  maxMarks,
  passMarks,
  currentMode = "total",
  students = [],
  onApplyMarks,
}: ExcelBulkMarkModalProps) {
  const [selectedMode, setSelectedMode] = useState<BulkMarkInputMode>(currentMode)
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "error">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync mode with props if changed externally
  React.useEffect(() => {
    setSelectedMode(currentMode)
  }, [currentMode, isOpen])

  if (!isOpen) return null

  const isWeeklyAllDays = scopeType === "weekly"

  // 1. Generate & Download Custom Excel Template
  function handleDownloadTemplate() {
    try {
      const wb = XLSX.utils.book_new()

      if (isWeeklyAllDays && weeklyDays.length > 0) {
        // Multi-day weekly breakdown template
        const headers = [
          "Student ID (শিক্ষার্থী আইডি)",
          "Roll No (রোল)",
          "Name (নাম)",
          ...weeklyDays.map(
            (d) => `${d.day_bn} (${d.subject || d.exam_name || "বিষয়"}) [পূর্ণমান: ${d.total_marks}]`
          ),
        ]

        const rows = students.map((s, idx) => [
          s.student_id || `ID-${idx + 1}`,
          s.roll_no || s.batch_roll || idx + 1,
          s.name || `Student ${idx + 1}`,
          ...weeklyDays.map(() => ""),
        ])

        const wsData = [headers, ...rows]
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        ws["!cols"] = [
          { wch: 18 },
          { wch: 10 },
          { wch: 25 },
          ...weeklyDays.map(() => ({ wch: 22 })),
        ]
        XLSX.utils.book_append_sheet(wb, ws, "Weekly Marks Entry")
      } else {
        // Single exam or single day template
        let headers: string[] = []
        if (selectedMode === "both") {
          headers = [
            "Student ID (শিক্ষার্থী আইডি)",
            "Roll No (রোল)",
            "Name (নাম)",
            `MCQ Marks (এমসিকিউ)`,
            `Written Marks (লিখিত)`,
            `Total Marks (মোট নম্বর - ঐচ্ছিক)`,
          ]
        } else if (selectedMode === "mcq") {
          headers = [
            "Student ID (শিক্ষার্থী আইডি)",
            "Roll No (রোল)",
            "Name (নাম)",
            `MCQ Marks (পূর্ণমান: ${maxMarks})`,
          ]
        } else if (selectedMode === "written") {
          headers = [
            "Student ID (শিক্ষার্থী আইডি)",
            "Roll No (রোল)",
            "Name (নাম)",
            `Written Marks (পূর্ণমান: ${maxMarks})`,
          ]
        } else {
          headers = [
            "Student ID (শিক্ষার্থী আইডি)",
            "Roll No (রোল)",
            "Name (নাম)",
            `Obtained Marks (প্রাপ্ত নম্বর - পূর্ণমান: ${maxMarks})`,
          ]
        }

        const rows = students.map((s, idx) => {
          const base = [
            s.student_id || `ID-${idx + 1}`,
            s.roll_no || s.batch_roll || idx + 1,
            s.name || `Student ${idx + 1}`,
          ]
          if (selectedMode === "both") {
            return [...base, "", "", ""]
          }
          return [...base, ""]
        })

        const wsData = [headers, ...rows]
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        ws["!cols"] = [
          { wch: 18 },
          { wch: 10 },
          { wch: 25 },
          { wch: 18 },
          ...(selectedMode === "both" ? [{ wch: 18 }, { wch: 18 }] : []),
        ]
        XLSX.utils.book_append_sheet(wb, ws, "Exam Marks Entry")
      }

      // Add a helpful Guide sheet
      const guideData = [
        ["মেধাসিঁড়ি এক্সেল বাল্ক মার্ক ইনপুট নির্দেশিকা"],
        [""],
        ["১. Student ID অথবা Roll No কলাম কোনোভাবেই পরিবর্তন করবেন না।"],
        ["২. নম্বরগুলো ইংরেজি অথবা বাংলা সংখ্যায় লিখুন (যেমন: 25 বা ২৫)।"],
        [`৩. প্রাপ্ত নম্বর কোনোভাবেই পূর্ণমান (${maxMarks}) এর বেশি হতে পারবে না।`],
        [
          selectedMode === "both"
            ? "৪. 'Both' মোডে MCQ এবং Written দুটি ঘরে আলাদা আলাদা নম্বর লিখুন।"
            : "৪. শুধুমাত্র নির্ধারিত কলামে নম্বর লিখুন।",
        ],
        ["৫. ফাইলটি সংরক্ষণ করে সফটওয়্যারে আপলোড করুন।"],
      ]
      const guideWs = XLSX.utils.aoa_to_sheet(guideData)
      XLSX.utils.book_append_sheet(wb, guideWs, "Instructions")

      const fileNameClean = `${examTitle.replace(/[/\\?%*:|"<>]/g, "_")}_${scopeTitle.replace(/[/\\?%*:|"<>]/g, "_")}_Template.xlsx`
      XLSX.writeFile(wb, fileNameClean)
      toast.success("এক্সেল টেমপ্লেট সফলভাবে ডাউনলোড হয়েছে!")
    } catch (err: any) {
      console.error("Template download error:", err)
      toast.error("টেমপ্লেট তৈরি করতে সমস্যা হয়েছে")
    }
  }

  // 2. Parse Uploaded Excel File
  async function handleFileUpload(fileObj: File) {
    if (!fileObj) return
    const isSupported =
      fileObj.name.endsWith(".xlsx") ||
      fileObj.name.endsWith(".xls") ||
      fileObj.name.endsWith(".csv")
    if (!isSupported) {
      toast.error("অনুগ্রহ করে একটি .xlsx, .xls অথবা .csv ফাইল আপলোড করুন")
      return
    }

    setFile(fileObj)
    setIsProcessing(true)

    try {
      const buffer = await fileObj.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array", cellFormula: false, raw: false })
      const firstSheetName = wb.SheetNames[0]
      if (!firstSheetName) throw new Error("স্প্রেডশীটে কোনো শিট পাওয়া যায়নি")

      const ws = wb.Sheets[firstSheetName]
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })

      if (rawRows.length < 2) {
        throw new Error("ফাইলটিতে কোনো ডাটা পাওয়া যায়নি (কমপক্ষে ২ লাইন থাকতে হবে)")
      }

      const headerRow = rawRows[0].map((h) => String(h || "").trim().toLowerCase())

      // Find column indices
      const findColIdx = (aliases: string[]) => {
        return headerRow.findIndex((h) =>
          aliases.some((alias) => h.includes(alias.toLowerCase()))
        )
      }

      const idIdx = findColIdx(["student id", "studentid", "student_id", "id", "আইডি", "শিক্ষার্থী আইডি"])
      const rollIdx = findColIdx(["roll no", "roll_no", "roll", "রোল", "রোল নং"])
      const nameIdx = findColIdx(["student name", "name", "নাম", "শিক্ষার্থীর নাম"])

      const mcqIdx = findColIdx(["mcq", "mc", "এমসিকিউ"])
      const writtenIdx = findColIdx(["written", "wr", "লিখিত"])
      const totalIdx = findColIdx(["total", "marks", "obtained marks", "নম্বর", "প্রাপ্ত", "মোট"])

      // For weekly all days, match each weekly day column
      const weeklyDayColIndices: Record<string, number> = {}
      if (isWeeklyAllDays && weeklyDays.length > 0) {
        weeklyDays.forEach((d) => {
          const idx = findColIdx([d.key, d.day_bn, d.day_en || "", d.subject || ""])
          if (idx !== -1) {
            weeklyDayColIndices[d.key] = idx
          }
        })
      }

      const results: ParsedStudentRow[] = []

      // Student lookup map (by lowercase student_id and by roll number)
      const studentMapById = new Map<string, BulkStudentItem>()
      const studentMapByRoll = new Map<number, BulkStudentItem>()
      students.forEach((s) => {
        if (s.student_id) studentMapById.set(s.student_id.trim().toLowerCase(), s)
        const rollNum = s.roll_no || s.batch_roll
        if (rollNum) studentMapByRoll.set(Number(rollNum), s)
      })

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r]
        if (!row || row.every((c) => String(c).trim() === "")) continue

        const idRaw = sanitizeCellValue(idIdx !== -1 ? row[idIdx] : "")
        const rollRaw = normalizeDigits(sanitizeCellValue(rollIdx !== -1 ? row[rollIdx] : ""))
        const nameRaw = sanitizeCellValue(nameIdx !== -1 ? row[nameIdx] : "")

        // Match student
        let matched: BulkStudentItem | null = null
        if (idRaw) {
          matched = studentMapById.get(idRaw.toLowerCase()) || null
        }
        if (!matched && rollRaw) {
          const numRoll = parseInt(rollRaw, 10)
          if (!isNaN(numRoll)) {
            matched = studentMapByRoll.get(numRoll) || null
          }
        }

        let mcqVal: number | null = null
        let wrVal: number | null = null
        let totalVal: number | null = null
        const dayMarksVal: Record<string, number | null> = {}
        let isValid = true
        let errorMsg = ""

        if (!matched) {
          isValid = false
          errorMsg = "শিক্ষার্থী খুঁজে পাওয়া যায়নি (ব্যাচের তালিকায় নেই)"
        }

        if (isWeeklyAllDays) {
          // Multi-day weekly values
          let anyDayHasMark = false
          for (const d of weeklyDays) {
            const colIdx = weeklyDayColIndices[d.key]
            if (colIdx !== -1 && row[colIdx] !== undefined) {
              const rawVal = normalizeDigits(sanitizeCellValue(row[colIdx]))
              if (rawVal !== "") {
                const n = parseFloat(rawVal)
                if (isNaN(n) || n < 0) {
                  isValid = false
                  errorMsg = `${d.day_bn} নম্বর সঠিক নয়`
                } else if (n > d.total_marks) {
                  isValid = false
                  errorMsg = `${d.day_bn} নম্বর সর্বোচ্চ (${d.total_marks})-এর চেয়ে বেশি`
                } else {
                  dayMarksVal[d.key] = n
                  anyDayHasMark = true
                }
              } else {
                dayMarksVal[d.key] = null
              }
            }
          }
          totalVal = Object.values(dayMarksVal).reduce<number>(
            (acc, curr) => acc + (curr !== null && !isNaN(curr) ? curr : 0),
            0
          )
        } else {
          // Single day or one-time exam values
          const rawMcq = mcqIdx !== -1 ? normalizeDigits(sanitizeCellValue(row[mcqIdx])) : ""
          const rawWr = writtenIdx !== -1 ? normalizeDigits(sanitizeCellValue(row[writtenIdx])) : ""
          const rawTotal = totalIdx !== -1 ? normalizeDigits(sanitizeCellValue(row[totalIdx])) : ""

          if (selectedMode === "both") {
            if (rawMcq !== "") {
              const n = parseFloat(rawMcq)
              if (isNaN(n) || n < 0) {
                isValid = false
                errorMsg = "MCQ নম্বর সঠিক নয়"
              } else {
                mcqVal = n
              }
            }
            if (rawWr !== "") {
              const n = parseFloat(rawWr)
              if (isNaN(n) || n < 0) {
                isValid = false
                errorMsg = "Written নম্বর সঠিক নয়"
              } else {
                wrVal = n
              }
            }
            if (mcqVal !== null || wrVal !== null) {
              const sum = (mcqVal ?? 0) + (wrVal ?? 0)
              if (sum > maxMarks) {
                isValid = false
                errorMsg = `মোট নম্বর (${sum}) সর্বোচ্চ (${maxMarks}) অতিক্রম করেছে`
              } else {
                totalVal = sum
              }
            } else if (rawTotal !== "") {
              const n = parseFloat(rawTotal)
              if (!isNaN(n) && n >= 0 && n <= maxMarks) {
                totalVal = n
              }
            }
          } else if (selectedMode === "mcq") {
            const raw = rawMcq !== "" ? rawMcq : rawTotal
            if (raw !== "") {
              const n = parseFloat(raw)
              if (isNaN(n) || n < 0 || n > maxMarks) {
                isValid = false
                errorMsg = `MCQ নম্বর 0 থেকে ${maxMarks}-এর মধ্যে হতে হবে`
              } else {
                mcqVal = n
                totalVal = n
              }
            }
          } else if (selectedMode === "written") {
            const raw = rawWr !== "" ? rawWr : rawTotal
            if (raw !== "") {
              const n = parseFloat(raw)
              if (isNaN(n) || n < 0 || n > maxMarks) {
                isValid = false
                errorMsg = `Written নম্বর 0 থেকে ${maxMarks}-এর মধ্যে হতে হবে`
              } else {
                wrVal = n
                totalVal = n
              }
            }
          } else {
            // Total marks mode
            if (rawTotal !== "") {
              const n = parseFloat(rawTotal)
              if (isNaN(n) || n < 0 || n > maxMarks) {
                isValid = false
                errorMsg = `প্রাপ্ত নম্বর 0 থেকে ${maxMarks}-এর মধ্যে হতে হবে`
              } else {
                totalVal = n
              }
            }
          }
        }

        results.push({
          key: `row-${r}-${matched?.id || idRaw || rollRaw}`,
          studentIdRaw: idRaw,
          rollRaw,
          nameRaw,
          matchedStudent: matched,
          mcq: mcqVal,
          written: wrVal,
          totalMarks: totalVal,
          dayMarks: dayMarksVal,
          isValid,
          error: errorMsg,
        })
      }

      setParsedRows(results)
      toast.success(`${results.length}টি ডাটা সফলভাবে রিড করা হয়েছে!`)
    } catch (err: any) {
      console.error("Excel parse error:", err)
      toast.error(err.message || "ফাইল রিড করতে ব্যর্থ হয়েছে")
    } finally {
      setIsProcessing(false)
    }
  }

  // 3. Inline Row Editing inside Modal
  function handleUpdateRowValue(rowKey: string, field: "mcq" | "written" | "total", newVal: string) {
    const cleaned = normalizeDigits(newVal.trim())
    const num = cleaned === "" ? null : parseFloat(cleaned)

    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.key !== rowKey) return r

        let nextMcq = r.mcq
        let nextWr = r.written
        let nextTotal = r.totalMarks
        let nextValid = true
        let errorMsg = ""

        if (!r.matchedStudent) {
          nextValid = false
          errorMsg = "শিক্ষার্থী খুঁজে পাওয়া যায়নি"
        }

        if (field === "mcq") {
          nextMcq = num
          if (num !== null && (isNaN(num) || num < 0)) {
            nextValid = false
            errorMsg = "MCQ নম্বর ঋণাত্মক হতে পারবে না"
          }
        } else if (field === "written") {
          nextWr = num
          if (num !== null && (isNaN(num) || num < 0)) {
            nextValid = false
            errorMsg = "Written নম্বর ঋণাত্মক হতে পারবে না"
          }
        } else if (field === "total") {
          nextTotal = num
          if (num !== null && (isNaN(num) || num < 0 || num > maxMarks)) {
            nextValid = false
            errorMsg = `নম্বর 0 থেকে ${maxMarks}-এর মধ্যে হতে হবে`
          }
        }

        if (selectedMode === "both") {
          if (nextMcq !== null || nextWr !== null) {
            const sum = (nextMcq ?? 0) + (nextWr ?? 0)
            if (sum > maxMarks) {
              nextValid = false
              errorMsg = `মোট নম্বর (${sum}) সর্বোচ্চ (${maxMarks}) অতিক্রম করেছে`
            } else {
              nextTotal = sum
            }
          } else {
            nextTotal = null
          }
        }

        return {
          ...r,
          mcq: nextMcq,
          written: nextWr,
          totalMarks: nextTotal,
          isValid: nextValid,
          error: errorMsg,
        }
      })
    )
  }

  // Filtered preview rows
  const filteredRows = useMemo(() => {
    return parsedRows.filter((r) => {
      if (statusFilter === "valid" && !r.isValid) return false
      if (statusFilter === "error" && r.isValid) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = (r.matchedStudent?.name || r.nameRaw || "").toLowerCase().includes(q)
        const matchId = (r.matchedStudent?.student_id || r.studentIdRaw || "").toLowerCase().includes(q)
        const matchRoll = String(r.matchedStudent?.roll_no || r.rollRaw || "").includes(q)
        return matchName || matchId || matchRoll
      }
      return true
    })
  }, [parsedRows, statusFilter, searchQuery])

  // Summary counts
  const validCount = parsedRows.filter((r) => r.isValid && (r.totalMarks !== null || isWeeklyAllDays)).length
  const errorCount = parsedRows.filter((r) => !r.isValid).length
  const blankCount = parsedRows.filter((r) => r.isValid && r.totalMarks === null && !isWeeklyAllDays).length

  // 4. Save and Apply Marks to Exam
  async function handleConfirmAndSave() {
    const validUpdates = parsedRows.filter(
      (r) => r.isValid && r.matchedStudent && (r.totalMarks !== null || isWeeklyAllDays)
    )

    if (validUpdates.length === 0) {
      toast.error("সংরক্ষণের জন্য কোনো বৈধ নম্বর পাওয়া যায়নি")
      return
    }

    setIsSaving(true)
    try {
      const payload = validUpdates.map((r) => {
        const st = r.matchedStudent!
        const total = r.totalMarks ?? 0
        const item: any = {
          studentId: st.id,
          marks: total,
          mode: selectedMode,
        }
        if (selectedMode === "both" || selectedMode === "mcq") {
          item.mcq = r.mcq !== null ? r.mcq : 0
        }
        if (selectedMode === "both" || selectedMode === "written") {
          item.written = r.written !== null ? r.written : 0
        }
        if (isWeeklyAllDays && r.dayMarks) {
          const cleanDays: Record<string, number> = {}
          for (const [dK, dM] of Object.entries(r.dayMarks)) {
            if (dM !== null && !isNaN(dM)) cleanDays[dK] = dM
          }
          item.dayMarks = cleanDays
        }
        return item
      })

      await onApplyMarks(payload, selectedMode)
      toast.success(`সফল! ${validUpdates.length} জন শিক্ষার্থীর নম্বর সংরক্ষিত হয়েছে`)
      onClose()
    } catch (err: any) {
      console.error("Bulk save error:", err)
      toast.error(err.message || "নম্বর সংরক্ষণ করতে সমস্যা হয়েছে")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  এক্সেল বাল্ক মার্ক ইনপুট
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {scopeTitle}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {examTitle} • পূর্ণমান: <b className="text-slate-900">{maxMarks}</b> • পাস নম্বর:{" "}
                <b className="text-slate-900">{passMarks}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Input Mode Selector (only when not weekly multi-day) */}
            {!isWeeklyAllDays ? (
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <label className="text-xs font-bold text-slate-600 ml-1.5">ইনপুট মোড:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMode("total")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      selectedMode === "total"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    প্রাপ্ত নম্বর (Total)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode("mcq")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      selectedMode === "mcq"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    MCQ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode("written")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      selectedMode === "written"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Written
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode("both")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      selectedMode === "both"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Both (MCQ + WR)
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs font-bold text-purple-900 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <span>সাপ্তাহিক সকল দিনের ব্রেকডাউন মোড ({weeklyDays.length}টি দিন)</span>
              </div>
            )}

            {/* Template Download Button */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>📥 এক্সেল টেমপ্লেট ডাউনলোড (Download Sample)</span>
            </button>
          </div>

          {/* File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 transition-all rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-1.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0])
                }
              }}
              className="hidden"
            />
            <div className="p-2 rounded-full bg-white shadow-2xs text-amber-600">
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <div className="text-xs font-bold text-slate-800">
              {file ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {file.name} (ক্লিক করে অন্য ফাইল দিন)
                </span>
              ) : (
                <span>ক্লিক করে অথবা ড্র্যাগ করে .xlsx / .csv ফাইল আপলোড করুন</span>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              টেমপ্লেট ফাইলে নম্বর বসিয়ে সরাসরি আপলোড দিন। সফটওয়্যার স্বয়ংক্রিয়ভাবে শিক্ষার্থী ও নম্বর মিলিয়ে নিবে।
            </span>
          </div>
        </div>

        {/* Data Preview Table Area */}
        {parsedRows.length > 0 ? (
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Summary & Filters Header */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">ফলাফল প্রিভিউ:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">
                  ✓ {validCount} বৈধ
                </span>
                {errorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold font-mono">
                    ⚠️ {errorCount} ত্রুটি
                  </span>
                )}
                {blankCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold font-mono">
                    — {blankCount} ফাঁকা
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Search in preview */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="খুঁজুন (রোল, আইডি, নাম)..."
                    className="pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-amber-500 w-44"
                  />
                </div>

                {/* Filter toggle */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="all">সকল ({parsedRows.length})</option>
                  <option value="valid">শুধুমাত্র বৈধ ({validCount})</option>
                  <option value="error">ত্রুটিপূর্ণ ({errorCount})</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2 px-2 text-center w-10">#</th>
                    <th className="py-2 px-2.5 text-center w-14 font-mono">রোল</th>
                    <th className="py-2 px-3 text-left min-w-[140px]">শিক্ষার্থীর নাম</th>
                    <th className="py-2 px-2.5 text-center w-24 font-mono">Student ID</th>
                    {isWeeklyAllDays ? (
                      weeklyDays.map((d) => (
                        <th key={d.key} className="py-2 px-2 text-center min-w-[90px]">
                          {d.day_bn} ({d.total_marks})
                        </th>
                      ))
                    ) : selectedMode === "both" ? (
                      <>
                        <th className="py-2 px-2 text-center w-20">MCQ</th>
                        <th className="py-2 px-2 text-center w-20">Written</th>
                        <th className="py-2 px-2 text-center w-20 font-mono">মোট</th>
                      </>
                    ) : (
                      <th className="py-2 px-3 text-center w-28">প্রাপ্ত নম্বর (/{maxMarks})</th>
                    )}
                    <th className="py-2 px-2 text-center w-16">গ্রেড</th>
                    <th className="py-2 px-3 text-center w-28">অবস্থা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((r, idx) => {
                    const st = r.matchedStudent
                    const roll = st?.roll_no || st?.batch_roll || r.rollRaw || idx + 1
                    const name = st?.name || r.nameRaw || "অজ্ঞাত শিক্ষার্থী"
                    const sId = st?.student_id || r.studentIdRaw || "—"
                    const grade =
                      r.totalMarks !== null && !isNaN(r.totalMarks)
                        ? getGrade(r.totalMarks, maxMarks)
                        : "—"

                    return (
                      <tr
                        key={r.key}
                        className={cn(
                          "transition-colors",
                          !r.isValid
                            ? "bg-rose-50/50 hover:bg-rose-50"
                            : r.totalMarks !== null
                            ? "hover:bg-amber-50/20"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <td className="py-2 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-800">
                          {roll}
                        </td>
                        <td className="py-2 px-3 text-left font-bold text-slate-900">
                          {name}
                          {!st && (
                            <span className="block text-[10px] text-rose-600 font-normal">
                              আইডি ব্যাচে মিলছে না
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono text-[11px] text-slate-600">
                          {sId}
                        </td>

                        {/* Marks Columns */}
                        {isWeeklyAllDays ? (
                          weeklyDays.map((d) => (
                            <td key={d.key} className="py-1.5 px-2 text-center font-mono font-bold">
                              {r.dayMarks?.[d.key] !== undefined && r.dayMarks?.[d.key] !== null
                                ? r.dayMarks[d.key]
                                : "—"}
                            </td>
                          ))
                        ) : selectedMode === "both" ? (
                          <>
                            <td className="py-1.5 px-2 text-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.mcq !== null ? String(r.mcq) : ""}
                                onChange={(e) => handleUpdateRowValue(r.key, "mcq", e.target.value)}
                                placeholder="0"
                                className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.written !== null ? String(r.written) : ""}
                                onChange={(e) => handleUpdateRowValue(r.key, "written", e.target.value)}
                                placeholder="0"
                                className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono font-extrabold text-slate-900">
                              {r.totalMarks !== null ? r.totalMarks : "—"}
                            </td>
                          </>
                        ) : (
                          <td className="py-1.5 px-2 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={r.totalMarks !== null ? String(r.totalMarks) : ""}
                              onChange={(e) => handleUpdateRowValue(r.key, "total", e.target.value)}
                              placeholder="0"
                              className="w-20 px-2 py-1 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-amber-500"
                            />
                          </td>
                        )}

                        <td className="py-2 px-2 text-center font-bold text-slate-800">{grade}</td>
                        <td className="py-2 px-3 text-center">
                          {r.isValid ? (
                            r.totalMarks !== null || isWeeklyAllDays ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> প্রস্তুত
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400">— ফাঁকা</span>
                            )
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 max-w-[130px] truncate"
                              title={r.error}
                            >
                              <AlertCircle className="w-3 h-3 shrink-0" /> {r.error || "ত্রুটি"}
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 stroke-1" />
            <p className="text-sm font-bold text-slate-700">এখনও কোনো এক্সেল ফাইল লোড করা হয়নি</p>
            <p className="text-xs text-slate-500 max-w-md">
              উপরে "এক্সেল টেমপ্লেট ডাউনলোড" বাটনে ক্লিক করে শিক্ষার্থীর তালিকা সহ ফাইল নামিয়ে নিন,
              নম্বর পূরণ করে আপলোড করুন।
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>নম্বর সেভ হওয়ার সাথে সাথে মেধা তালিকা ও রেজাল্ট শীটে আপডেট হয়ে যাবে।</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleConfirmAndSave}
              disabled={validCount === 0 || isSaving}
              className={cn(
                "px-5 py-2 rounded-xl font-bold text-xs text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95",
                validCount > 0 && !isSaving
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                  : "bg-slate-300 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>💾 {validCount} জনের নম্বর সংরক্ষণ ও প্রয়োগ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
