"use client"

import React, { useMemo } from "react"
import { cn } from "@/lib/utils"

export interface SectionWiseMeritRow {
  student_id: string
  roll_no: number | string
  name: string
  total_marks: number | string
  section_merit: number | string
  grade: string
  gpa: number | string
}

export interface SectionWiseMeritListProps {
  instituteName?: string
  instituteBranch?: string
  instituteLogoUrl?: string
  sectionName: string // e.g. "NINE-Day-COMMON"
  examTitle: string // e.g. "WEEKLY-33"
  academicYear?: string // e.g. "2025"
  rows: SectionWiseMeritRow[]
  breakBefore?: boolean
}

export default function SectionWiseMeritList({
  instituteName = "Medhashiree Coaching Center",
  instituteBranch = "Rangpur Sadar",
  instituteLogoUrl = "/logo.jpg",
  sectionName,
  examTitle,
  academicYear = new Date().getFullYear().toString(),
  rows = [],
  breakBefore = false,
}: SectionWiseMeritListProps) {
  // Sort rows strictly by Section Merit if numeric, or fallback to roll
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const mA = typeof a.section_merit === "number" ? a.section_merit : parseInt(String(a.section_merit)) || 9999
      const mB = typeof b.section_merit === "number" ? b.section_merit : parseInt(String(b.section_merit)) || 9999
      if (mA !== mB) return mA - mB
      const rA = typeof a.roll_no === "number" ? a.roll_no : parseInt(String(a.roll_no)) || 9999
      const rB = typeof b.roll_no === "number" ? b.roll_no : parseInt(String(b.roll_no)) || 9999
      return rA - rB
    })
  }, [rows])

  return (
    <div
      className={cn(
        "section-wise-merit-sheet bg-white text-black p-4 sm:p-6 w-full max-w-[860px] mx-auto font-sans relative",
        breakBefore ? "print:break-before-page" : ""
      )}
      style={{
        boxSizing: "border-box",
        pageBreakBefore: breakBefore ? "always" : "auto",
        breakBefore: breakBefore ? "page" : "auto",
      }}
    >
      {/* 1. OFFICIAL INSTITUTION & DOCUMENT HEADER (Matching Picture 2) */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-black p-1 flex items-center justify-center shrink-0 bg-white">
            {instituteLogoUrl ? (
              <img
                src={instituteLogoUrl}
                alt="Logo"
                className="w-full h-full object-contain rounded-full"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = "none"
                }}
              />
            ) : (
              <span className="text-lg font-black">M</span>
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight uppercase font-serif">
              {instituteName}
            </h1>
            <p className="text-xs font-semibold text-black tracking-wide">
              {instituteBranch}
            </p>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-base sm:text-lg font-black tracking-wider uppercase underline underline-offset-4 text-black">
            Section Wise Merit List
          </h2>
        </div>
      </div>

      {/* 2. SECTION & EXAM SUBHEADER META LINE */}
      <div className="grid grid-cols-12 border border-black text-xs font-bold mb-2 bg-slate-50 print:bg-transparent">
        <div className="col-span-5 border-r border-black py-1 px-2.5 flex items-center">
          <span className="text-slate-700 w-16">Section:</span>
          <span className="font-extrabold text-black uppercase">{sectionName}</span>
        </div>
        <div className="col-span-4 border-r border-black py-1 px-2.5 flex items-center">
          <span className="text-slate-700 w-14">Exam:</span>
          <span className="font-extrabold text-black uppercase">{examTitle}</span>
        </div>
        <div className="col-span-3 py-1 px-2.5 flex items-center">
          <span className="text-slate-700 w-24">Academic Year:</span>
          <span className="font-extrabold text-black">{academicYear}</span>
        </div>
      </div>

      {/* 3. OFFICIAL MERIT LIST TABLE (Compact & Clean A4 Design) */}
      <div className="w-full overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-100 font-bold border-b border-black text-center text-[11px]">
              <th className="border border-black py-1 px-1.5 w-24 font-mono">Student ID</th>
              <th className="border border-black py-1 px-1.5 w-16 font-mono">Roll No.</th>
              <th className="border border-black py-1 px-3 text-left min-w-[170px]">Name</th>
              <th className="border border-black py-1 px-2 w-20 font-mono">Total Marks</th>
              <th className="border border-black py-1 px-2 w-24">Section Merit</th>
              <th className="border border-black py-1 px-1.5 w-16">Grade</th>
              <th className="border border-black py-1 px-1.5 w-16 font-mono">GPA</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => {
              const isEven = idx % 2 === 0
              return (
                <tr
                  key={row.student_id || idx}
                  className={cn(
                    "border-b border-black text-center text-xs",
                    isEven ? "bg-white" : "bg-slate-50/60 print:bg-transparent"
                  )}
                  style={{ pageBreakInside: "avoid" }}
                >
                  <td className="border border-black py-1 px-1.5 font-mono text-[11px] font-semibold text-black">
                    {row.student_id}
                  </td>
                  <td className="border border-black py-1 px-1.5 font-mono font-bold text-black">
                    {row.roll_no}
                  </td>
                  <td className="border border-black py-1 px-3 text-left font-bold text-black">
                    {row.name}
                  </td>
                  <td className="border border-black py-1 px-2 font-mono font-black text-black">
                    {row.total_marks}
                  </td>
                  <td className="border border-black py-1 px-2 font-bold text-black">
                    {row.section_merit}
                  </td>
                  <td className="border border-black py-1 px-1.5 font-bold text-black">
                    {row.grade}
                  </td>
                  <td className="border border-black py-1 px-1.5 font-mono font-bold text-black">
                    {typeof row.gpa === "number" ? row.gpa.toFixed(1) : row.gpa}
                  </td>
                </tr>
              )
            })}

            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="border border-black py-6 text-center text-slate-400 italic">
                  কোনো শিক্ষার্থীর ফলাফল পাওয়া যায়নি।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. TOTAL STUDENT FOOTER COUNT (Matching Picture 2 bottom right) */}
      <div className="flex justify-end pt-2 pb-1 text-xs font-bold text-black">
        <span>Total Student: {sortedRows.length}</span>
      </div>

      {/* 5. OFFICIAL SIGNATURES BLOCK (For printed document validity) */}
      <div
        className="grid grid-cols-3 gap-6 pt-10 mt-6 border-t border-slate-300 text-center text-xs font-semibold"
        style={{ pageBreakInside: "avoid" }}
      >
        <div>
          <div className="border-t border-black pt-1 max-w-[130px] mx-auto">
            Exam Coordinator
          </div>
        </div>
        <div>
          <div className="border-t border-black pt-1 max-w-[130px] mx-auto">
            Class Teacher
          </div>
        </div>
        <div>
          <div className="border-t border-black pt-1 max-w-[130px] mx-auto">
            Branch Director
          </div>
        </div>
      </div>
    </div>
  )
}
