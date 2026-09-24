"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  Printer,
  FileText,
  LayoutTemplate,
  ArrowUpDown,
  Trophy,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  Users,
  Award,
  Layers,
} from "lucide-react"
import PrintableExamSheet, { PrintableExamSheetProps } from "./PrintableExamSheet"
import StudentProgressReport, {
  ProgressReportStudent,
  ProgressReportSubject,
  calculateCoachingGrade,
} from "./StudentProgressReport"
import SectionWiseMeritList, { SectionWiseMeritRow } from "./SectionWiseMeritList"
import WeeklyToppersSheet, { GrandTopperItem, SubjectTopperItem } from "./WeeklyToppersSheet"
import { cn, getGrade } from "@/lib/utils"
import { useBranding } from "@/components/providers/BrandingContext"

export type PrintTemplateType = "merit_list" | "progress_report" | "tabulation" | "toppers_sheet"

export interface BatchItem {
  id: string
  name: string
}

export interface CombinedWeekSummary {
  student_id: string
  roll_no: number | string
  name: string
  total_marks: number
  total_max_marks: number
  average_pct: number
  grade: string
  gpa: number
  section_merit: number | string
}

export interface ExamPrintModalProps {
  isOpen: boolean
  onClose: () => void
  exam: PrintableExamSheetProps["exam"] & {
    batch_id?: string | null
    batch_ids?: string[]
    result_note?: string | null
    batch?: { id?: string; name: string; branch_id?: string | null } | null
  }
  isWeeklyExam: boolean
  weeklyDays?: PrintableExamSheetProps["weeklyDays"]
  activeDayConfig?: PrintableExamSheetProps["activeDayConfig"]
  totalWeeklyMaxMarks?: number
  students: Array<PrintableExamSheetProps["students"][0] & {
    batch_id?: string
    father_name?: string
    mother_name?: string
    guardian_name?: string
    group?: string
    qr_code?: string
  }>
  savedResults?: PrintableExamSheetProps["savedResults"]
  dayMarksMap?: PrintableExamSheetProps["dayMarksMap"]
  defaultMode?: "one_time" | "weekly_aggregate" | "weekly_day" | "all_weeks_combined"
  availableBatches?: BatchItem[]
  combinedWeekData?: CombinedWeekSummary[]
  activeCombinedExams?: any[]
  allCombinedExams?: any[]
  combinedWeeksDayMarks?: Record<string, Record<string, Record<string, any>>>
  combinedWeeksMarks?: Record<string, Record<string, number>>
  defaultTemplate?: PrintTemplateType
  totalToppers?: GrandTopperItem[]
  subjectToppers?: SubjectTopperItem[]
  /** The Weekly Routine Title / series name typed at exam creation (W1's title).
   *  For weekly exams this is what should appear as the exam name everywhere.
   *  Undefined for one-time exams. */
  seriesTitle?: string
}

function getDayMarkItemHelper(
  studentDays: Record<string, any> | undefined,
  dayKey?: string,
  dayBn?: string,
  dayEn?: string
) {
  if (!studentDays || typeof studentDays !== "object") return undefined
  if (dayKey && studentDays[dayKey] !== undefined) return studentDays[dayKey]
  const lKey = dayKey?.toLowerCase()
  if (lKey && studentDays[lKey] !== undefined) return studentDays[lKey]
  if (dayBn && studentDays[dayBn] !== undefined) return studentDays[dayBn]
  if (dayEn && studentDays[dayEn] !== undefined) return studentDays[dayEn]
  for (const [k, v] of Object.entries(studentDays)) {
    const lk = k.toLowerCase()
    if ((lKey && lk === lKey) || (dayBn && k === dayBn) || (dayEn && lk === dayEn.toLowerCase())) {
      return v
    }
  }
  return undefined
}

export default function ExamPrintModal({
  isOpen,
  onClose,
  exam,
  isWeeklyExam,
  weeklyDays = [],
  activeDayConfig = null,
  totalWeeklyMaxMarks = 100,
  students = [],
  savedResults = {},
  dayMarksMap = {},
  defaultMode = "one_time",
  availableBatches = [],
  combinedWeekData = [],
  activeCombinedExams = [],
  allCombinedExams = [],
  combinedWeeksDayMarks = {},
  combinedWeeksMarks = {},
  defaultTemplate = "merit_list",
  totalToppers = [],
  subjectToppers = [],
  seriesTitle,
}: ExamPrintModalProps) {
  const { branding, theme } = useBranding()

  // For weekly exams, the display name is always the series/routine title (typed at creation).
  // For one-time exams, it's just the exam title.
  const displayTitle = (isWeeklyExam && seriesTitle) ? seriesTitle : (exam.title || "")
  // 1. Template Type: Merit List (Pic 2), Progress Report (Pic 1), Tabulation, or Toppers Sheet
  const [template, setTemplate] = useState<PrintTemplateType>(defaultTemplate)

  // 2. Exam Mode / Scope
  const [selectedMode, setSelectedMode] = useState<"one_time" | "weekly_aggregate" | "weekly_day" | "all_weeks_combined">(
    isWeeklyExam ? defaultMode : "one_time"
  )
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    activeDayConfig?.key || weeklyDays[0]?.key || "saturday"
  )

  // 3. Batch Filter: "all" or specific batch ID
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all")

  // 4. Progress Report Student Selector: "all" or student.id
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all")

  // 5. Page Layout / Options
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait")
  const [sortBy, setSortBy] = useState<"rank" | "roll">("rank")
  const [showPodium, setShowPodium] = useState<boolean>(true)
  const [showSubjectToppers, setShowSubjectToppers] = useState<boolean>(true)
  const [showSignatures, setShowSignatures] = useState<boolean>(true)

  // 6. Academic Year (editable for result sheets — e.g. 2026)
  const [customAcademicYear, setCustomAcademicYear] = useState<string>(
    exam.exam_date ? new Date(exam.exam_date).getFullYear().toString() : new Date().getFullYear().toString()
  )

  // 7. PDF Title — editable, LOCAL ONLY, never saved to DB.
  //    Defaults to displayTitle (series name). User can change it just for the printout.
  const [pdfTitle, setPdfTitle] = useState<string>(displayTitle)

  // Keep academic year and pdfTitle synced if exam changes (e.g. navigating between weeks)
  useEffect(() => {
    if (exam.exam_date) {
      setCustomAcademicYear(new Date(exam.exam_date).getFullYear().toString())
    }
    setPdfTitle((isWeeklyExam && seriesTitle) ? seriesTitle : (exam.title || ""))
  }, [exam.id, exam.exam_date, exam.title, isWeeklyExam, seriesTitle])

  // Sync mode and orientation when defaultMode changes
  useEffect(() => {
    if (isWeeklyExam) {
      setSelectedMode(defaultMode)
    } else {
      setSelectedMode("one_time")
    }
  }, [defaultMode, isWeeklyExam])

  // Adapt orientation to template
  useEffect(() => {
    if (template === "tabulation" && selectedMode === "weekly_aggregate") {
      setOrientation("landscape")
    } else {
      setOrientation("portrait")
    }
  }, [template, selectedMode])

  const currentDayConfig = weeklyDays.find((d) => d.key === selectedDayKey) || activeDayConfig || weeklyDays[0] || null

  // Resolved list of batches relevant to this exam (ONLY batches selected at creation time)
  const relevantBatches = useMemo<BatchItem[]>(() => {
    // 1. Gather all allowed batch IDs specified during exam creation
    let targetBatchIds: string[] = []
    if (Array.isArray(exam.batch_ids) && exam.batch_ids.length > 0) {
      targetBatchIds = exam.batch_ids
    } else if (exam.result_note && exam.result_note.includes("[BATCH_IDS:")) {
      try {
        const m = exam.result_note.match(/\[BATCH_IDS:(.*?)\]/)
        if (m && m[1]) {
          const parsed = JSON.parse(m[1])
          if (Array.isArray(parsed) && parsed.length > 0) {
            targetBatchIds = parsed
          }
        }
      } catch {}
    }

    if (targetBatchIds.length === 0 && exam.batch_id) {
      targetBatchIds = [exam.batch_id]
    }

    // 2. If target batches were specified, return ONLY matching batches
    if (targetBatchIds.length > 0) {
      if (availableBatches.length > 0) {
        const matched = availableBatches.filter((b) => targetBatchIds.includes(b.id))
        if (matched.length > 0) return matched
      }
      if (exam.batch?.name) {
        return [{ id: exam.batch_id || (exam.batch as any).id || "primary", name: exam.batch.name }]
      }
      return targetBatchIds.map((id) => ({ id, name: "নির্ধারিত ব্যাচ" }))
    }

    // 3. If exam had no batch_id, check which batches the participating students actually belong to
    if (students.length > 0 && availableBatches.length > 0) {
      const studentBatchIds = new Set(students.map((s) => s.batch_id).filter(Boolean))
      if (studentBatchIds.size > 0) {
        const matched = availableBatches.filter((b) => studentBatchIds.has(b.id))
        if (matched.length > 0) return matched
      }
    }

    if (exam.batch?.name) {
      return [{ id: "primary", name: exam.batch.name }]
    }

    return []
  }, [availableBatches, exam.batch_ids, exam.batch_id, exam.batch, exam.result_note, students])

  // Filter students based on selected batch
  const filteredStudents = useMemo(() => {
    if (selectedBatchId === "all") return students
    return students.filter((s) => s.batch_id === selectedBatchId)
  }, [students, selectedBatchId])

  // Active batch name for headers
  const activeBatchName = useMemo(() => {
    if (selectedBatchId !== "all") {
      const b = relevantBatches.find((item) => item.id === selectedBatchId)
      if (b) return b.name
    }
    return exam.batch?.name || "সকল ব্যাচ (সমন্বিত)"
  }, [selectedBatchId, relevantBatches, exam.batch])

  // Calculate student marks for current scope
  const isWeeklyAggregate = selectedMode === "weekly_aggregate"
  const isWeeklyDay = selectedMode === "weekly_day"
  const isCombinedWeeks = selectedMode === "all_weeks_combined"

  const combinedTotalMaxMarks = useMemo(() => {
    if (activeCombinedExams && activeCombinedExams.length > 0) {
      return activeCombinedExams.reduce((acc, curr) => acc + (Number(curr.total_marks) || 100), 0)
    }
    if (combinedWeekData && combinedWeekData.length > 0) {
      return Number(combinedWeekData[0].total_max_marks) || totalWeeklyMaxMarks
    }
    return totalWeeklyMaxMarks
  }, [activeCombinedExams, combinedWeekData, totalWeeklyMaxMarks])

  const activeTotalMarks = isCombinedWeeks
    ? combinedTotalMaxMarks
    : isWeeklyAggregate
    ? totalWeeklyMaxMarks
    : isWeeklyDay
    ? activeDayConfig?.total_marks || 50
    : exam.total_marks || 100

  // Build merit ranking for filtered students
  const studentEvaluations = useMemo(() => {
    const list = filteredStudents.map((s, idx) => {
      const rollNumber = s.roll_no || s.batch_roll || idx + 1

      if (isCombinedWeeks && combinedWeekData.length > 0) {
        const found = combinedWeekData.find(
          (c: any) => c.id === s.id || c.student_id === s.student_id || c.student_id === s.id
        )
        if (found) {
          return {
            student: s,
            rollNumber,
            totalMarks: Number(found.total_marks) || 0,
            grade: found.grade,
            gpa: found.gpa,
            hasEvaluated: Number(found.total_marks) > 0,
          }
        }
      }

      if (isWeeklyAggregate) {
        const studentDays = dayMarksMap[s.id] || {}
        let sumMarks = 0
        let hasAnyDayMark = false

        for (const d of weeklyDays) {
          const item = studentDays[d.key] || (d.day_bn && studentDays[d.day_bn])
          if (item && !isNaN(Number(item.marks))) {
            sumMarks += Number(item.marks)
            hasAnyDayMark = true
          }
        }

        if (!hasAnyDayMark && savedResults[s.id]?.obtained_marks) {
          const fbVal = parseFloat(savedResults[s.id].obtained_marks)
          if (!isNaN(fbVal)) {
            sumMarks = fbVal
            hasAnyDayMark = true
          }
        }

        const mark = hasAnyDayMark ? sumMarks : 0
        const gradeInfo = calculateCoachingGrade(mark, activeTotalMarks)

        return {
          student: s,
          rollNumber,
          totalMarks: mark,
          grade: hasAnyDayMark ? gradeInfo.grade : "—",
          gpa: hasAnyDayMark ? gradeInfo.gp : 0,
          hasEvaluated: hasAnyDayMark,
        }
      } else if (isWeeklyDay && currentDayConfig) {
        const studentDays = dayMarksMap[s.id] || {}
        const item = studentDays[currentDayConfig.key] || (currentDayConfig.day_bn && studentDays[currentDayConfig.day_bn])
        const hasMark = Boolean(item && !isNaN(Number(item.marks)))
        const mark = hasMark ? Number(item.marks) : 0
        const gradeInfo = calculateCoachingGrade(mark, currentDayConfig.total_marks || 50)

        return {
          student: s,
          rollNumber,
          totalMarks: mark,
          grade: hasMark ? gradeInfo.grade : "—",
          gpa: hasMark ? gradeInfo.gp : 0,
          hasEvaluated: hasMark,
        }
      } else {
        const raw = savedResults[s.id]?.obtained_marks
        const hasMark = raw !== undefined && raw !== "" && !isNaN(parseFloat(raw))
        const mark = hasMark ? parseFloat(raw) : 0
        const gradeInfo = calculateCoachingGrade(mark, activeTotalMarks)

        return {
          student: s,
          rollNumber,
          totalMarks: mark,
          grade: hasMark ? gradeInfo.grade : "—",
          gpa: hasMark ? gradeInfo.gp : 0,
          hasEvaluated: hasMark,
        }
      }
    })

    // Rank evaluated students
    const evaluated = list
      .filter((r) => r.hasEvaluated)
      .sort((a, b) => b.totalMarks - a.totalMarks || Number(a.rollNumber) - Number(b.rollNumber))

    const rankMap = new Map<string, number>()
    let currentRank = 1
    evaluated.forEach((item, idx) => {
      if (idx > 0 && item.totalMarks < evaluated[idx - 1].totalMarks) {
        currentRank = idx + 1
      }
      rankMap.set(item.student.id, currentRank)
    })

    return list.map((item) => ({
      ...item,
      meritRank: rankMap.get(item.student.id) || "—",
    }))
  }, [filteredStudents, isCombinedWeeks, combinedWeekData, isWeeklyAggregate, isWeeklyDay, currentDayConfig, weeklyDays, dayMarksMap, savedResults, activeTotalMarks])

  // Subject-wise Highest Score map for Progress Reports
  const subjectHighestMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of weeklyDays) {
      let maxScore = 0
      for (const s of students) {
        const sDays = dayMarksMap[s.id] || {}
        const item = sDays[d.key] || (d.day_bn && sDays[d.day_bn])
        if (item && !isNaN(Number(item.marks))) {
          if (Number(item.marks) > maxScore) maxScore = Number(item.marks)
        }
      }
      map.set(d.key, maxScore)
    }
    return map
  }, [weeklyDays, students, dayMarksMap])

  // Rows for Section Wise Merit List (Pic 2)
  const meritListRows = useMemo<SectionWiseMeritRow[]>(() => {
    return studentEvaluations.map((e) => ({
      student_id: e.student.student_id,
      roll_no: e.rollNumber,
      name: e.student.name,
      total_marks: e.hasEvaluated ? e.totalMarks : 0,
      section_merit: e.meritRank,
      grade: e.grade,
      gpa: e.gpa,
    }))
  }, [studentEvaluations])

  // Students to render in Progress Report mode
  const targetProgressReportStudents = useMemo(() => {
    if (selectedStudentId === "all") return filteredStudents
    return filteredStudents.filter((s) => s.id === selectedStudentId)
  }, [filteredStudents, selectedStudentId])

  // Build subject list for an individual student in Progress Report mode
  function getStudentProgressSubjects(studentId: string): ProgressReportSubject[] {
    if (isCombinedWeeks && activeCombinedExams && activeCombinedExams.length > 0) {
      const allSubjects: ProgressReportSubject[] = []
      const targetStudent = students.find((s) => s.id === studentId || s.student_id === studentId)
      const sid = targetStudent?.id || studentId
      const scode = targetStudent?.student_id || ""

      activeCombinedExams.forEach((we, wIdx) => {
        // 1. Add week header row
        allSubjects.push({
          name: `📅 ${we.title || `সপ্তাহ ${wIdx + 1}`} (পূর্ণমান: ${we.total_marks || 350} নম্বর)`,
          fullMarks: Number(we.total_marks) || 350,
          highestMarks: 0,
          wrMarks: 0,
          mcqMarks: 0,
          totalMarks: 0,
          grade: "",
          gp: 0,
          weekTitle: we.title,
          weekId: we.id,
          isWeekHeader: true,
        })

        // 2. Parse daily schedule of this week
        let examDays: Array<{ key: string; day_bn: string; subject?: string; exam_name?: string; total_marks: number; pass_marks: number }> = []
        if (Array.isArray(we.recurring_days) && we.recurring_days.length > 0) {
          examDays = we.recurring_days.map((d: any) => ({
            key: typeof d === "object" ? d.day || d.key : d,
            day_bn: typeof d === "object" ? d.day_bn || d.day : d,
            subject: typeof d === "object" ? d.subject : "",
            exam_name: typeof d === "object" ? d.exam_name : "",
            total_marks: typeof d === "object" ? Number(d.total_marks) || 50 : 50,
            pass_marks: typeof d === "object" ? Number(d.pass_marks) || 20 : 20,
          }))
        } else if (we.result_note?.includes("[WEEKLY_SCHEDULE:")) {
          try {
            const m = we.result_note.match(/\[WEEKLY_SCHEDULE:(.*?)\]/)
            if (m && m[1]) {
              const parsed = JSON.parse(m[1])
              if (Array.isArray(parsed) && parsed.length > 0) {
                examDays = parsed.map((d: any) => ({
                  key: d.day || d.key,
                  day_bn: d.day_bn || d.day,
                  subject: d.subject || "",
                  exam_name: d.exam_name || "",
                  total_marks: Number(d.total_marks) || 50,
                  pass_marks: Number(d.pass_marks) || 20,
                }))
              }
            }
          } catch {}
        }

        if (examDays.length === 0 && weeklyDays.length > 0) {
          examDays = weeklyDays
        }

        // Student's day marks for this week
        const stDays =
          combinedWeeksDayMarks?.[sid]?.[we.id] ||
          (scode ? combinedWeeksDayMarks?.[scode]?.[we.id] : undefined) ||
          (we.id === exam.id ? (dayMarksMap[sid] || (scode ? dayMarksMap[scode] : undefined)) : undefined) ||
          {}

        let weekObtainedSum = 0
        let weekFullSum = 0
        let weekGpSum = 0
        let weekDaysCount = 0

        const weekTotalFallback =
          combinedWeeksMarks?.[sid]?.[we.id] ??
          (scode ? combinedWeeksMarks?.[scode]?.[we.id] : undefined) ??
          (we.id === exam.id ? parseFloat(savedResults[sid]?.obtained_marks || (scode ? savedResults[scode]?.obtained_marks : "0") || "0") : 0)

        if (examDays.length > 0) {
          examDays.forEach((d) => {
            const item = getDayMarkItemHelper(stDays, d.key, d.day_bn, (d as any).day_en)
            const hasMark = item !== undefined && item !== null && !isNaN(Number(item?.marks ?? item))
            const score = hasMark ? Number(item?.marks ?? item) : 0
            const dayMax = d.total_marks || 50
            const gradeInfo = calculateCoachingGrade(score, dayMax)

            // Find highest marks across all students for this day in this exam
            let dayHighest = score
            if (students.length > 0) {
              let h = 0
              for (const s of students) {
                const sDays =
                  combinedWeeksDayMarks?.[s.id]?.[we.id] ||
                  (s.student_id ? combinedWeeksDayMarks?.[s.student_id]?.[we.id] : undefined) ||
                  (we.id === exam.id ? (dayMarksMap[s.id] || (s.student_id ? dayMarksMap[s.student_id] : undefined)) : undefined) ||
                  {}
                const sItem = getDayMarkItemHelper(sDays, d.key, d.day_bn, (d as any).day_en)
                const val = sItem !== undefined && sItem !== null ? Number(sItem?.marks ?? sItem) : 0
                if (!isNaN(val) && val > h) h = val
              }
              if (h > 0) dayHighest = h
            }

            weekObtainedSum += score
            weekFullSum += dayMax
            weekGpSum += gradeInfo.gp
            weekDaysCount++

            allSubjects.push({
              name: `${d.day_bn || d.key}: ${d.subject || d.exam_name || "সাপ্তাহিক মূল্যায়ন"}`,
              fullMarks: dayMax,
              highestMarks: dayHighest,
              wrMarks: 0,
              mcqMarks: score,
              totalMarks: score,
              grade: gradeInfo.grade,
              gp: gradeInfo.gp,
              weekTitle: we.title,
              weekId: we.id,
            })
          })

          // If no daily marks were entered individually, but a total week score exists
          if (weekObtainedSum === 0 && weekTotalFallback > 0) {
            weekObtainedSum = weekTotalFallback
          }

          // Add week subtotal row
          const weekGradeInfo = calculateCoachingGrade(weekObtainedSum, weekFullSum)
          allSubjects.push({
            name: `${we.title || "সপ্তাহ"} সর্বমোট নম্বর (Subtotal)`,
            fullMarks: weekFullSum,
            highestMarks: 0,
            wrMarks: 0,
            mcqMarks: 0,
            totalMarks: weekObtainedSum,
            grade: weekGradeInfo.grade,
            gp: weekDaysCount > 0 ? Number((weekGpSum / weekDaysCount).toFixed(1)) : 0,
            weekTitle: we.title,
            weekId: we.id,
            isWeekSubtotal: true,
          })
        } else {
          // No days defined: add week total row
          const weekMark = weekTotalFallback
          const weekMax = Number(we.total_marks) || 350
          const gradeInfo = calculateCoachingGrade(weekMark, weekMax)
          allSubjects.push({
            name: `${we.title || "সাপ্তাহিক মূল্যায়ন"} - প্রাপ্ত নম্বর`,
            fullMarks: weekMax,
            highestMarks: weekMax,
            wrMarks: 0,
            mcqMarks: weekMark,
            totalMarks: weekMark,
            grade: gradeInfo.grade,
            gp: gradeInfo.gp,
            weekTitle: we.title,
            weekId: we.id,
          })
        }
      })

      return allSubjects
    }

    if (isWeeklyAggregate && weeklyDays.length > 0) {
      const sDays = dayMarksMap[studentId] || {}
      return weeklyDays.map((d) => {
        const item = sDays[d.key] || (d.day_bn && sDays[d.day_bn])
        const score = item && !isNaN(Number(item.marks)) ? Number(item.marks) : 0
        const gradeInfo = calculateCoachingGrade(score, d.total_marks || 50)
        return {
          name: d.subject || d.exam_name || d.day_bn,
          fullMarks: d.total_marks || 50,
          highestMarks: subjectHighestMap.get(d.key) || score,
          wrMarks: 0,
          mcqMarks: score,
          totalMarks: score,
          grade: gradeInfo.grade,
          gp: gradeInfo.gp,
        }
      })
    }

    // Default single subject exam
    const raw = savedResults[studentId]?.obtained_marks
    const score = raw !== undefined && raw !== "" && !isNaN(parseFloat(raw)) ? parseFloat(raw) : 0
    const gradeInfo = calculateCoachingGrade(score, exam.total_marks || 100)
    return [
      {
        name: exam.subject || exam.title || "সাধারণ বিষয়",
        fullMarks: exam.total_marks || 100,
        highestMarks: exam.total_marks || 100,
        wrMarks: 0,
        mcqMarks: score,
        totalMarks: score,
        grade: gradeInfo.grade,
        gp: gradeInfo.gp,
      },
    ]
  }

  function handlePrint() {
    window.print()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-transparent print:static print:z-auto">
      {/* Dynamic Print CSS for Strict A4 and Clean Pagination */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${orientation === "landscape" ? "A4 landscape" : "A4 portrait"};
            margin: 8mm 8mm 8mm 8mm;
          }
          body * {
            visibility: hidden;
          }
          #print-document-container,
          #print-document-container * {
            visibility: visible;
          }
          #print-document-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .progress-report-sheet {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
          }
          .section-wise-merit-sheet {
            page-break-inside: avoid !important;
          }
          .print-controls,
          aside,
          header,
          nav,
          button {
            display: none !important;
          }
        }
      `}</style>

      <div
        className={cn(
          "bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-300 shadow-2xl w-full max-h-[96vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:bg-white",
          orientation === "landscape" ? "max-w-[1180px]" : "max-w-4xl"
        )}
      >
        {/* Top Control Bar (Screen only) */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col gap-3 shrink-0 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                <Printer className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>পরীক্ষার রেজাল্ট প্রিন্ট ও PDF প্রিভিউ</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    A4 Ready
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {pdfTitle || displayTitle} • {activeBatchName} ({filteredStudents.length} জন শিক্ষার্থী)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>প্রিন্ট / PDF সংরক্ষণ</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Configuration Toolbars */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-700">
            {/* 1. Template Chooser */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTemplate("merit_list")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  template === "merit_list"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>মেধা তালিকা (Pic 2)</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplate("progress_report")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  template === "progress_report"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                <span>অগ্রগতি রিপোর্ট (Pic 1)</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplate("tabulation")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  template === "tabulation"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-blue-400" />
                <span>পূর্ণাঙ্গ টেবুলেশন শিট</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplate("toppers_sheet")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  template === "toppers_sheet"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>শীর্ষ মেধা ও টপার শিট</span>
              </button>
            </div>

            {/* Exam Name Display (always shows the saved exam title — to change it, use ✏️ on the main page) */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <FileText className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
              {/* Fixed exam name — always the name given at creation */}
              <label className="text-slate-500 font-bold text-[11px] whitespace-nowrap">পরীক্ষার নাম:</label>
              <span
                className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-700 min-w-[60px] truncate max-w-[160px]"
                title={`সৃষ্টির সময় দেওয়া নাম: ${displayTitle}`}
              >
                {displayTitle || "—"}
              </span>

              {/* Editable PDF name — local only, used on printout, never saved to DB */}
              <label className="text-slate-500 font-bold text-[11px] whitespace-nowrap ml-1">PDF নাম:</label>
              <input
                type="text"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                className="px-2 py-0.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 w-28 sm:w-36 focus:w-48 transition-all focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                placeholder={displayTitle}
                title="শুধুমাত্র প্রিন্টের জন্য — এটি পরিবর্তন করলে পরীক্ষার আসল নাম পরিবর্তন হবে না"
              />

              <label className="text-slate-500 font-bold text-[11px] whitespace-nowrap ml-1">শিক্ষাবর্ষ:</label>
              <input
                type="text"
                value={customAcademicYear}
                onChange={(e) => setCustomAcademicYear(e.target.value)}
                className="px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 w-16 focus:outline-hidden focus:ring-1 focus:ring-amber-500 text-center"
                placeholder="2026"
                title="রেজাল্ট শিটে শিক্ষাবর্ষ পরিবর্তন করুন"
              />
            </div>

            {/* 2. Multi-Batch Selector (When multi-batch exists) */}
            {relevantBatches.length > 1 && (
              <div className="flex items-center gap-1.5 bg-amber-50/70 p-1 rounded-xl border border-amber-200">
                <Users className="w-3.5 h-3.5 text-amber-700 ml-1.5" />
                <label className="text-amber-900 font-bold">ব্যাচ:</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900"
                >
                  <option value="all">সকল ব্যাচ সমন্বিত (Combined)</option>
                  {relevantBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (আলাদা শিট)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Scope Selector for Weekly Exams */}
            {isWeeklyExam && (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedMode("weekly_aggregate")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                    selectedMode === "weekly_aggregate"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  সাপ্তাহিক সামগ্রিক
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode("weekly_day")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                    selectedMode === "weekly_day"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  নির্দিষ্ট দিন
                </button>
                {combinedWeekData.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMode("all_weeks_combined")}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer",
                      selectedMode === "all_weeks_combined"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-purple-700 hover:bg-purple-100"
                    )}
                  >
                    সকল সপ্তাহের সমন্বিত
                  </button>
                )}
              </div>
            )}

            {/* If Weekly Day is selected, pick day */}
            {isWeeklyExam && selectedMode === "weekly_day" && (
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500">দিন:</label>
                <select
                  value={selectedDayKey}
                  onChange={(e) => setSelectedDayKey(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {weeklyDays.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.day_bn} ({d.subject || d.exam_name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Progress Report Student Selector */}
            {template === "progress_report" && (
              <div className="flex items-center gap-1.5 bg-purple-50 p-1 rounded-xl border border-purple-200">
                <label className="text-purple-900 font-bold ml-1">শিক্ষার্থী:</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs font-bold text-slate-900 max-w-[200px]"
                >
                  <option value="all">
                    সকল শিক্ষার্থী ({filteredStudents.length} জন - এক ক্লিকে সব প্রিন্ট)
                  </option>
                  {filteredStudents.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      #{s.roll_no || s.batch_roll || idx + 1} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 5. Orientation (for Tabulation mode) */}
            {template === "tabulation" && (
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500">লেআউট:</label>
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOrientation("portrait")}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer",
                      orientation === "portrait"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    পোর্ট্রেট
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation("landscape")}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer",
                      orientation === "landscape"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    ল্যান্ডস্কেপ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Document Preview Viewport */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-200/70 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            id="print-document-container"
            className={cn(
              "bg-white shadow-xl rounded-xl transition-all border border-slate-300/80 print:shadow-none print:border-none print:rounded-none",
              orientation === "landscape" ? "w-full max-w-[1080px]" : "w-full max-w-[860px]"
            )}
          >
            {/* TEMPLATE 1: SECTION WISE MERIT LIST (Picture 2) */}
            {template === "merit_list" && (
              <SectionWiseMeritList
                instituteName={branding.nameBn || branding.name}
                instituteBranch={exam.branch?.name || branding.address || "Academic Care"}
                instituteLogoUrl={branding.logoUrl}
                sectionName={activeBatchName}
                examTitle={
                  isCombinedWeeks && activeCombinedExams.length > 0
                    ? `সমন্বিত মেধা তালিকা (${activeCombinedExams.map((e) => e.title).join(", ")})`
                    : (pdfTitle || displayTitle)
                }
                academicYear={customAcademicYear}
                rows={meritListRows}
              />
            )}

            {/* TEMPLATE 2: INDIVIDUAL PROGRESS REPORT (Picture 1) */}
            {template === "progress_report" && (
              <div className="space-y-4 print:space-y-0">
                {targetProgressReportStudents.map((st) => {
                  const ev = studentEvaluations.find((e) => e.student.id === st.id)
                  const subjects = getStudentProgressSubjects(st.id)

                  return (
                    <StudentProgressReport
                      key={st.id}
                      instituteName={branding.nameBn || branding.name}
                      instituteBranch={exam.branch?.name || branding.address || "Academic Care"}
                      instituteLogoUrl={branding.logoUrl}
                      examTitle={
                        isCombinedWeeks && activeCombinedExams.length > 0
                          ? `ধারাবাহিক সাপ্তাহিক পরীক্ষা - সমন্বিত প্রগ্রেস রিপোর্ট (${activeCombinedExams.map((e) => e.title).join(", ")})`
                    : (pdfTitle || displayTitle)
                      }
                      academicYear={customAcademicYear}
                      batchName={activeBatchName}
                      groupName={st.group || "HUMANITIES"}
                      student={{
                        id: st.id,
                        name: st.name,
                        student_id: st.student_id,
                        roll_no: st.roll_no,
                        batch_roll: st.batch_roll,
                        father_name: st.father_name || st.guardian_name,
                        mother_name: st.mother_name,
                        guardian_name: st.guardian_name,
                        group: st.group,
                        qr_code: st.qr_code,
                      }}
                      subjects={subjects}
                      classPosition={ev?.meritRank || "—"}
                    />
                  )
                })}
              </div>
            )}

            {/* TEMPLATE 3: COMPREHENSIVE TABULATION SHEET */}
            {template === "tabulation" && (
              <PrintableExamSheet
                instituteName={branding.nameBn || branding.name}
                instituteBranch={exam.branch?.name || branding.address || "Academic Care"}
                instituteLogoUrl={branding.logoUrl}
                tagline={branding.tagline}
                exam={{
                  ...exam,
                  title:
                    isCombinedWeeks && activeCombinedExams.length > 0
                      ? `সমন্বিত ট্যাবশুলার শিট (${activeCombinedExams.map((e) => e.title).join(", ")})`
                    : (pdfTitle || displayTitle),
                  total_marks: activeTotalMarks,
                }}
                mode={selectedMode}
                weeklyDays={weeklyDays}
                activeDayConfig={currentDayConfig}
                totalWeeklyMaxMarks={activeTotalMarks}
                students={filteredStudents}
                savedResults={savedResults}
                dayMarksMap={dayMarksMap}
                activeCombinedExams={activeCombinedExams}
                combinedWeekData={combinedWeekData}
                sortBy={sortBy}
                showPodium={showPodium}
                showSubjectToppers={showSubjectToppers}
                showSignatures={showSignatures}
              />
            )}

            {/* TEMPLATE 4: TOPPERS & SUBJECT MERIT SUMMARY SHEET (Pic 2 Toppers & Subject-Wise) */}
            {template === "toppers_sheet" && (
              <WeeklyToppersSheet
                instituteName={branding.nameBn || branding.name}
                instituteBranch={exam.branch?.name || branding.address || "Academic Care"}
                instituteLogoUrl={branding.logoUrl}
                examTitle={
                  isCombinedWeeks && activeCombinedExams.length > 0
                    ? `সমন্বিত শীর্ষ মেধা (${activeCombinedExams.map((e) => e.title).join(", ")})`
                    : (pdfTitle || displayTitle)
                }
                batchName={activeBatchName}
                academicYear={customAcademicYear}
                totalWeeklyMaxMarks={activeTotalMarks}
                totalToppers={totalToppers}
                subjectToppers={subjectToppers}
              />
            )}
          </div>
        </div>

        {/* Modal Bottom Footer (Screen only) */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>
              {template === "progress_report"
                ? `প্রিন্ট ডায়ালগ থেকে "Save as PDF" দিলে প্রতি শিক্ষার্থীর জন্য ১ পেজ হিসেবে মোট ${targetProgressReportStudents.length} পেজ তৈরি হবে।`
                : "টিপস: ব্রাউজারের প্রিন্ট ডায়ালগ থেকে 'Save as PDF' সিলেক্ট করে A4 সাইজে ডাউনলোড করতে পারবেন।"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
            >
              বন্ধ করুন
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" /> প্রিন্ট করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}





