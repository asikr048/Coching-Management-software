"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"

export interface ProgressReportStudent {
  id: string
  name: string
  student_id: string
  roll_no?: number | null
  batch_roll?: number | null
  father_name?: string | null
  mother_name?: string | null
  guardian_name?: string | null
  group?: string | null
  qr_code?: string | null
}

export interface ProgressReportSubject {
  name: string
  fullMarks: number
  highestMarks: number
  wrMarks: number
  mcqMarks: number
  totalMarks: number
  grade: string
  gp: number
}

export interface StudentProgressReportProps {
  instituteName?: string
  instituteBranch?: string
  instituteLogoUrl?: string
  examTitle: string // e.g. "WEEKLY-33"
  academicYear?: string // e.g. "2025"
  batchName: string // e.g. "NINE-Day-COMMON"
  groupName?: string // e.g. "HUMANITIES" / "SCIENCE" / "COMMERCE"
  student: ProgressReportStudent
  subjects: ProgressReportSubject[]
  classPosition: number | string // Rank in batch
  attendance?: {
    workingDays?: number
    totalPresent?: number
    totalAbsent?: number
  }
  conductEvaluation?: {
    excellent?: boolean
    good?: boolean
    average?: boolean
    poor?: boolean
    comments?: string
  }
  coCurricular?: {
    sports?: boolean
    culturalFunction?: boolean
    scoutBncc?: boolean
    mathOlympiad?: boolean
  }
}

/**
 * Coaching Center Grade Scale Calculator:
 * Marks (%) | Letter Grade | Grade Point | Remarks
 * 80–100    | A+           | 5.00        | Outstanding
 * 70–79     | A            | 4.00        | Excellent
 * 60–69     | A-           | 3.50        | Very Good
 * 50–59     | B            | 3.00        | Good
 * 40–49     | C            | 2.00        | Satisfactory
 * 33–39     | D            | 1.00        | Pass
 * 0–32      | F            | 0.00        | Fail
 */
export function calculateCoachingGrade(marks: number, fullMarks: number): { grade: string; gp: number; remarks: string } {
  if (fullMarks <= 0 || isNaN(marks) || marks === null) return { grade: "—", gp: 0, remarks: "—" }
  const pct = Math.round((marks / fullMarks) * 100)
  if (pct >= 80) return { grade: "A+", gp: 5.0, remarks: "Outstanding" }
  if (pct >= 70) return { grade: "A", gp: 4.0, remarks: "Excellent" }
  if (pct >= 60) return { grade: "A-", gp: 3.5, remarks: "Very Good" }
  if (pct >= 50) return { grade: "B", gp: 3.0, remarks: "Good" }
  if (pct >= 40) return { grade: "C", gp: 2.0, remarks: "Satisfactory" }
  if (pct >= 33) return { grade: "D", gp: 1.0, remarks: "Pass" }
  return { grade: "F", gp: 0.0, remarks: "Fail" }
}

export default function StudentProgressReport({
  instituteName = "MIIS ACADEMY",
  instituteBranch = "Academic Care",
  instituteLogoUrl = "/logo.jpg",
  examTitle,
  academicYear = new Date().getFullYear().toString(),
  batchName,
  groupName = "COMMON",
  student,
  subjects = [],
  classPosition,
  attendance = { workingDays: 0, totalPresent: 0, totalAbsent: 0 },
  conductEvaluation = { excellent: false, good: true, average: false, poor: false, comments: "" },
  coCurricular = { sports: false, culturalFunction: false, scoutBncc: false, mathOlympiad: false },
}: StudentProgressReportProps) {
  // Aggregate stats across subjects
  const totals = useMemo(() => {
    let totalFull = 0
    let totalObtained = 0
    let gpSum = 0
    let failedCount = 0

    subjects.forEach((sub) => {
      totalFull += sub.fullMarks || 0
      totalObtained += sub.totalMarks || 0
      gpSum += sub.gp || 0
      if ((sub.totalMarks || 0) < Math.round((sub.fullMarks || 50) * 0.33)) {
        failedCount++
      }
    })

    const averageGp = subjects.length > 0 ? Number((gpSum / subjects.length).toFixed(1)) : 0
    const overallGradeInfo = calculateCoachingGrade(totalObtained, totalFull)
    const isPassed = failedCount === 0 && totalObtained >= Math.round(totalFull * 0.33)

    return {
      totalFull,
      totalObtained,
      averageGp,
      overallGrade: overallGradeInfo.grade,
      isPassed,
      failedCount,
    }
  }, [subjects])

  const qrUrl = useMemo(() => {
    const rawData = student.qr_code || `MEDHASHIREE:${student.student_id}:${student.roll_no || student.batch_roll || ""}:${examTitle}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(rawData)}`
  }, [student, examTitle])

  const rollDisplay = student.roll_no || student.batch_roll || "—"
  const fatherDisplay = student.father_name || student.guardian_name || "—"
  const motherDisplay = student.mother_name || "—"

  return (
    <div
      className="progress-report-sheet bg-white text-black p-4 sm:p-6 w-full max-w-[840px] mx-auto border border-slate-300 shadow-sm relative overflow-hidden font-sans print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none"
      style={{
        boxSizing: "border-box",
        pageBreakAfter: "always",
        breakAfter: "page",
        pageBreakInside: "avoid",
        minHeight: "260mm",
      }}
    >
      {/* WATERMARK BACKGROUND (메ধাসিঁড়ি) */}
      <div
        className="absolute inset-0 pointer-events-none select-none flex items-center justify-center opacity-[0.06] z-0 print:opacity-[0.05]"
        style={{ transform: "rotate(-18deg)" }}
      >
        <div className="text-center">
          <div className="text-7xl sm:text-8xl font-black tracking-widest text-slate-900 uppercase">
            {instituteName}
          </div>
          <p className="text-2xl font-bold tracking-widest text-slate-700 mt-2">
            ACADEMIC CARE &amp; ADMISSION
          </p>
        </div>
      </div>

      {/* INNER CONTENT WRAPPER */}
      <div className="relative z-10 flex flex-col justify-between" style={{ minHeight: "250mm" }}>
        {/* TOP SECTION: HEADER + GRADING TABLE */}
        <div>
          <div className="flex items-start justify-between gap-4 pb-2 border-b-2 border-black">
            {/* LEFT: LOGO + INSTITUTION TITLE */}
            <div className="flex items-start gap-3 flex-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-black p-1 flex items-center justify-center shrink-0 bg-white">
                {instituteLogoUrl ? (
                  <img
                    src={instituteLogoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain rounded-full"
                    onError={(e) => {
                      // Fallback if logo fails
                      ;(e.target as HTMLElement).style.display = "none"
                    }}
                  />
                ) : (
                  <span className="text-xl font-black">M</span>
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black uppercase leading-tight font-serif">
                  {instituteName}
                </h1>
                <p className="text-xs sm:text-sm font-semibold text-black tracking-wide">
                  {instituteBranch}
                </p>
                <div className="mt-1 inline-block border-b-2 border-black pb-0.5">
                  <span className="text-xs sm:text-sm font-black tracking-widest uppercase">
                    PROGRESS REPORT
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: OFFICIAL GRADING SYSTEM TABLE */}
            <div className="shrink-0">
              <table className="border-collapse border border-black text-[9px] leading-tight text-center font-mono">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-100 font-bold border-b border-black">
                    <th className="border border-black px-1.5 py-0.5">Marks (%)</th>
                    <th className="border border-black px-1.5 py-0.5">Letter Grade</th>
                    <th className="border border-black px-1.5 py-0.5">Grade Point</th>
                    <th className="border border-black px-1.5 py-0.5">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">80–100</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold">A+</td>
                    <td className="border border-black px-1.5 py-0.2">5.00</td>
                    <td className="border border-black px-1.5 py-0.2">Outstanding</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">70–79</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold">A</td>
                    <td className="border border-black px-1.5 py-0.2">4.00</td>
                    <td className="border border-black px-1.5 py-0.2">Excellent</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">60–69</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold">A-</td>
                    <td className="border border-black px-1.5 py-0.2">3.50</td>
                    <td className="border border-black px-1.5 py-0.2">Very Good</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">50–59</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold">B</td>
                    <td className="border border-black px-1.5 py-0.2">3.00</td>
                    <td className="border border-black px-1.5 py-0.2">Good</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">40–49</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold">C</td>
                    <td className="border border-black px-1.5 py-0.2">2.00</td>
                    <td className="border border-black px-1.5 py-0.2">Satisfactory</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">33–39</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold">D</td>
                    <td className="border border-black px-1.5 py-0.2">1.00</td>
                    <td className="border border-black px-1.5 py-0.2">Pass</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-1.5 py-0.2">0–32</td>
                    <td className="border border-black px-1.5 py-0.2 font-bold text-rose-700">F</td>
                    <td className="border border-black px-1.5 py-0.2">0.00</td>
                    <td className="border border-black px-1.5 py-0.2">Fail</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* STUDENT & EXAM META DATA (2-Column Grid) */}
          <div className="grid grid-cols-12 gap-3 py-3 border-b border-black text-xs font-semibold">
            {/* LEFT COLUMN: Student Info */}
            <div className="col-span-7 space-y-1">
              <div className="flex">
                <span className="w-28 text-slate-700">Name of Student</span>
                <span className="font-bold text-black uppercase">: {student.name}</span>
              </div>
              <div className="flex">
                <span className="w-28 text-slate-700">Father&apos;s Name</span>
                <span className="text-black">: {fatherDisplay}</span>
              </div>
              <div className="flex">
                <span className="w-28 text-slate-700">Mother&apos;s Name</span>
                <span className="text-black">: {motherDisplay}</span>
              </div>
              <div className="flex font-mono">
                <span className="w-28 font-sans text-slate-700">Student ID</span>
                <span className="font-bold text-black">: {student.student_id}</span>
              </div>
              <div className="flex font-mono">
                <span className="w-28 font-sans text-slate-700">Roll No.</span>
                <span className="font-bold text-black">: {rollDisplay}</span>
              </div>
              <div className="flex">
                <span className="w-28 text-slate-700">Class</span>
                <span className="font-bold text-black uppercase">: {batchName}</span>
              </div>
            </div>

            {/* RIGHT COLUMN: Exam Meta & QR Code */}
            <div className="col-span-5 flex items-start justify-between">
              <div className="space-y-1 text-xs">
                <div className="flex">
                  <span className="w-24 text-slate-700">Exam</span>
                  <span className="font-bold text-black uppercase">: {examTitle}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-700">Year/Session</span>
                  <span className="font-bold text-black">: {academicYear}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-700">Group</span>
                  <span className="font-bold text-black uppercase">: {student.group || groupName}</span>
                </div>
              </div>

              {/* QR CODE */}
              <div className="border border-black p-0.5 bg-white shrink-0">
                <img
                  src={qrUrl}
                  alt="Student Verification QR"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                />
              </div>
            </div>
          </div>

          {/* MARKS & SUBJECTS TABLE */}
          <div className="mt-3">
            <table className="w-full border-collapse border border-black text-xs font-sans">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-black text-center text-[11px]">
                  <th rowSpan={2} className="border border-black py-1.5 px-2 text-left min-w-[150px]">
                    Name of Subjects
                  </th>
                  <th rowSpan={2} className="border border-black py-1.5 px-1.5 w-16">
                    Full Marks
                  </th>
                  <th rowSpan={2} className="border border-black py-1.5 px-1.5 w-16">
                    Highest Marks
                  </th>
                  <th colSpan={2} className="border border-black py-0.5 px-1 text-center">
                    Obtaining Marks
                  </th>
                  <th rowSpan={2} className="border border-black py-1.5 px-1.5 w-16">
                    Total Marks
                  </th>
                  <th rowSpan={2} className="border border-black py-1.5 px-1.5 w-14">
                    Letter Grade
                  </th>
                  <th rowSpan={2} className="border border-black py-1.5 px-1.5 w-14">
                    Grade Point
                  </th>
                </tr>
                <tr className="bg-slate-100 font-bold border-b border-black text-center text-[10px]">
                  <th className="border border-black py-0.5 px-1.5 w-12 font-mono">WR</th>
                  <th className="border border-black py-0.5 px-1.5 w-12 font-mono">MCQ</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub, idx) => (
                  <tr key={idx} className="border-b border-black text-center font-mono">
                    <td className="border border-black py-1 px-2 text-left font-sans font-bold text-black">
                      {sub.name}
                    </td>
                    <td className="border border-black py-1 px-1">{sub.fullMarks}</td>
                    <td className="border border-black py-1 px-1 font-bold">{sub.highestMarks}</td>
                    <td className="border border-black py-1 px-1">{sub.wrMarks || 0}</td>
                    <td className="border border-black py-1 px-1">{sub.mcqMarks || sub.totalMarks}</td>
                    <td className="border border-black py-1 px-1 font-bold text-black">
                      {sub.totalMarks}
                    </td>
                    <td className="border border-black py-1 px-1 font-sans font-bold">
                      {sub.grade}
                    </td>
                    <td className="border border-black py-1 px-1 font-bold">
                      {sub.gp ? sub.gp.toFixed(1) : "0.0"}
                    </td>
                  </tr>
                ))}

                {/* Fill empty rows if less than 5 subjects for visual structure */}
                {subjects.length < 5 &&
                  Array.from({ length: 5 - subjects.length }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-black text-center h-6">
                      <td className="border border-black py-1 px-2">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                      <td className="border border-black py-1 px-1">&nbsp;</td>
                    </tr>
                  ))}

                {/* TOTAL ROW */}
                <tr className="border-t-2 border-black font-bold text-xs bg-slate-50 print:bg-slate-50">
                  <td className="border border-black py-1.5 px-2 text-left uppercase">
                    Total Exam Marks
                  </td>
                  <td className="border border-black py-1.5 px-1 text-center font-mono font-black">
                    {totals.totalFull}
                  </td>
                  <td
                    colSpan={3}
                    className="border border-black py-1.5 px-2 text-right uppercase font-sans"
                  >
                    Obtained Marks &amp; GPA
                  </td>
                  <td className="border border-black py-1.5 px-1 text-center font-mono font-black">
                    {totals.totalObtained}
                  </td>
                  <td className="border border-black py-1.5 px-1 text-center font-black">
                    {totals.overallGrade}
                  </td>
                  <td className="border border-black py-1.5 px-1 text-center font-mono font-black">
                    {totals.averageGp.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* LOWER EVALUATION & PERFORMANCE SECTION (3 COLUMNS) */}
          <div className="grid grid-cols-12 gap-0 border border-black mt-3 text-xs">
            {/* COLUMN 1: RESULT STATUS & ATTENDANCE (5 Columns) */}
            <div className="col-span-5 border-r border-black p-2 space-y-1">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                <span className="font-semibold text-slate-800">Result Status</span>
                <span
                  className={cn(
                    "font-bold uppercase px-2 py-0.5 rounded text-[11px]",
                    totals.isPassed ? "text-black" : "text-black font-black"
                  )}
                >
                  {totals.isPassed ? "Passed" : "Failed"}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200 font-mono">
                <span className="font-sans font-semibold text-slate-800">Class Position</span>
                <span className="font-bold text-black">{classPosition || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200 font-mono">
                <span className="font-sans font-semibold text-slate-800">GPA [Without 4th]</span>
                <span className="font-bold text-black">{totals.averageGp.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200 font-mono">
                <span className="font-sans font-semibold text-slate-800">Failed Subject (s)</span>
                <span className="font-bold text-black">{totals.failedCount}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200 font-mono">
                <span className="font-sans text-slate-700">Working Days</span>
                <span className="text-black">{attendance.workingDays || ""}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200 font-mono">
                <span className="font-sans text-slate-700">Total Present</span>
                <span className="text-black">{attendance.totalPresent || ""}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 font-mono">
                <span className="font-sans text-slate-700">Total Absent</span>
                <span className="text-black">{attendance.totalAbsent || ""}</span>
              </div>
            </div>

            {/* COLUMN 2: MORAL & BEHAVIOR EVALUATION (4 Columns) */}
            <div className="col-span-4 border-r border-black p-2 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-[11px] uppercase border-b border-black pb-1 mb-1.5 text-center">
                  Moral &amp; Behavior Evaluation
                </h4>
                <div className="space-y-1 text-xs pl-2">
                  <label className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                      {conductEvaluation.excellent ? "✓" : ""}
                    </span>
                    <span>Excellent</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                      {conductEvaluation.good ? "✓" : ""}
                    </span>
                    <span>Good</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                      {conductEvaluation.average ? "✓" : ""}
                    </span>
                    <span>Average</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                      {conductEvaluation.poor ? "✓" : ""}
                    </span>
                    <span>Poor</span>
                  </label>
                </div>
              </div>
              <div className="mt-2 pt-1 border-t border-slate-200">
                <span className="text-[10px] text-slate-600 block">Comments:</span>
                <p className="text-xs italic text-black min-h-[18px]">
                  {conductEvaluation.comments || ""}
                </p>
              </div>
            </div>

            {/* COLUMN 3: CO-CURRICULAR ACTIVITIES (3 Columns) */}
            <div className="col-span-3 p-2">
              <h4 className="font-bold text-[11px] uppercase border-b border-black pb-1 mb-1.5 text-center">
                Co-Curricular Activities
              </h4>
              <div className="space-y-1.5 text-xs pl-1">
                <label className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                    {coCurricular.sports ? "✓" : ""}
                  </span>
                  <span>Sports</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                    {coCurricular.culturalFunction ? "✓" : ""}
                  </span>
                  <span>Cultural Function</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                    {coCurricular.scoutBncc ? "✓" : ""}
                  </span>
                  <span>Scout/BNCC</span>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] font-bold">
                    {coCurricular.mathOlympiad ? "✓" : ""}
                  </span>
                  <span>Math Olympiad</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* SIGNATURE SECTION (BOTTOM) */}
        <div className="pt-8 pb-1 grid grid-cols-3 gap-6 text-center text-xs font-semibold">
          <div>
            <div className="border-t border-black pt-1 max-w-[140px] mx-auto">
              Guardian&apos;s Signature
            </div>
          </div>
          <div>
            <div className="border-t border-black pt-1 max-w-[140px] mx-auto">
              Class Teacher
            </div>
          </div>
          <div>
            <div className="border-t border-black pt-1 max-w-[140px] mx-auto">
              Principal / Director
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
