"use client"

import React from "react"
import { cn } from "@/lib/utils"

export interface GrandTopperItem {
  position: 1 | 2 | 3
  positionLabel: string
  obtained_marks: number
  pct: number
  grade: string
  gpa?: number | string
  students: Array<{
    id: string
    name: string
    roll_no?: number | null
    batch_roll?: number | null
    student_id: string
  }>
}

export interface SubjectTopperItem {
  dayName: string
  subjectName: string
  totalMarks: number
  highestMarks: number
  winners: Array<{
    id: string
    name: string
    roll_no?: number | null
    batch_roll?: number | null
    student_id: string
  }>
}

export interface WeeklyToppersSheetProps {
  instituteName?: string
  instituteBranch?: string
  instituteLogoUrl?: string
  examTitle: string
  batchName: string
  academicYear?: string
  totalWeeklyMaxMarks: number
  totalToppers: GrandTopperItem[]
  subjectToppers: SubjectTopperItem[]
  documentTitle?: string
  documentSubtitle?: string
  toppersHeader1?: string
  toppersHeader2?: string
}

export default function WeeklyToppersSheet({
  instituteName = "MIIS ACADEMY",
  instituteBranch = "Academic Care",
  instituteLogoUrl = "/logo.jpg",
  examTitle,
  batchName,
  academicYear = new Date().getFullYear().toString(),
  totalWeeklyMaxMarks,
  totalToppers = [],
  subjectToppers = [],
  documentTitle = "TOPPERS & MERIT SUMMARY",
  documentSubtitle = "শীর্ষ মেধাবী শিক্ষার্থী তালিকা",
  toppersHeader1 = "🏆 সামগ্রিক শীর্ষ মেধা (Grand Total Toppers)",
  toppersHeader2 = "📚 বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী তালিকা (Subject-wise Toppers)",
}: WeeklyToppersSheetProps) {
  return (
    <div
      className="toppers-sheet-container bg-white text-black p-5 sm:p-7 w-full max-w-[860px] mx-auto font-sans relative"
      style={{
        boxSizing: "border-box",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* 1. OFFICIAL INSTITUTION HEADER */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-3">
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
            {documentTitle}
          </h2>
          <p className="text-[11px] font-bold text-slate-700 mt-0.5">{documentSubtitle}</p>
        </div>
      </div>

      {/* 2. META DETAILS LINE */}
      <div className="grid grid-cols-12 border border-black text-xs font-bold mb-4 bg-slate-50 print:bg-transparent">
        <div className="col-span-5 border-r border-black py-1.5 px-3 flex items-center">
          <span className="text-slate-700 w-16">Section:</span>
          <span className="font-extrabold text-black uppercase">{batchName}</span>
        </div>
        <div className="col-span-4 border-r border-black py-1.5 px-3 flex items-center">
          <span className="text-slate-700 w-14">Exam:</span>
          <span className="font-extrabold text-black uppercase">{examTitle}</span>
        </div>
        <div className="col-span-3 py-1.5 px-3 flex items-center">
          <span className="text-slate-700 w-24">Year / Marks:</span>
          <span className="font-extrabold text-black font-mono">{academicYear} ({totalWeeklyMaxMarks}m)</span>
        </div>
      </div>

      {/* 3. SECTION 1: GRAND TOTAL TOPPERS (১ম, ২য়, ৩য় সামগ্রিক শীর্ষস্থান) */}
      <div className="mb-5">
        <div className="bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>{toppersHeader1}</span>
          <span className="text-[11px] font-normal">পূর্ণমান: {totalWeeklyMaxMarks} নম্বর</span>
        </div>

        {totalToppers.length === 0 ? (
          <div className="border border-dashed border-slate-300 py-4 text-center text-xs text-slate-500">
            কোনো টপার পাওয়া যায়নি
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {totalToppers.slice(0, 3).map((t) => {
              const isGold = t.position === 1
              const isSilver = t.position === 2
              const medalLabel = isGold ? "🥇 ১ম স্থান (1st)" : isSilver ? "🥈 ২য় স্থান (2nd)" : "🥉 ৩য় স্থান (3rd)"
              const primaryStudent = t.students[0]

              return (
                <div
                  key={t.position}
                  className={cn(
                    "border-2 p-2.5 rounded-lg flex flex-col justify-between text-center relative",
                    isGold ? "border-black bg-amber-50/40" : isSilver ? "border-slate-700 bg-slate-50" : "border-slate-500 bg-orange-50/20"
                  )}
                >
                  <div className="font-black text-xs border-b pb-1 border-black/20 uppercase tracking-wide">
                    {medalLabel}
                  </div>

                  <div className="py-2 space-y-1.5 min-h-[60px] flex flex-col justify-center">
                    {t.students && t.students.length > 0 ? (
                      t.students.map((st, sIdx) => (
                        <div key={st.id || sIdx} className={cn("text-center", sIdx > 0 && "pt-1.5 border-t border-black/15")}>
                          <h4 className="font-black text-sm text-black leading-snug">{st.name}</h4>
                          <div className="text-[11px] font-mono text-slate-800 font-bold mt-0.5">
                            রোল: #{st.roll_no ?? st.batch_roll ?? "—"} • ID: {st.student_id}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400">—</div>
                    )}
                    {t.students && t.students.length > 1 && (
                      <div className="pt-0.5">
                        <span className="inline-block text-[9px] font-bold px-2 py-0.5 bg-amber-200 text-amber-950 rounded border border-amber-300">
                          যৌথ ({t.students.length} জন)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-black/20 pt-1.5 flex items-center justify-between text-xs font-mono font-black">
                    <span>প্রাপ্ত: {t.obtained_marks} / {totalWeeklyMaxMarks}</span>
                    <span className="bg-black text-white px-1.5 py-0.2 rounded text-[10px]">{t.pct}% ({t.grade})</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. SECTION 2: SUBJECT-WISE TOPPERS TABLE (বিষয়ভিত্তিক শীর্ষ মেধা) */}
      <div className="mb-6">
        <div className="bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>{toppersHeader2}</span>
          <span className="text-[11px] font-normal">প্রতিটি বিষয়ে সর্বোচ্চ নম্বরধারী</span>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-100 font-bold border-b border-black text-center text-[11px]">
              <th className="border border-black py-1 px-2 w-10 font-mono">ক্রম</th>
              <th className="border border-black py-1 px-2.5 text-left min-w-[130px]">বিষয়ের নাম (Subject)</th>
              <th className="border border-black py-1 px-2 w-20">বার (Day)</th>
              <th className="border border-black py-1 px-2 w-16 font-mono">পূর্ণমান</th>
              <th className="border border-black py-1 px-3 text-left min-w-[170px]">১ম স্থান অর্জনকারী শিক্ষার্থী</th>
              <th className="border border-black py-1 px-2 w-16 font-mono">রোল</th>
              <th className="border border-black py-1 px-2 w-24 font-mono">Student ID</th>
              <th className="border border-black py-1 px-2 w-20 font-mono">প্রাপ্ত নম্বর</th>
            </tr>
          </thead>
          <tbody>
            {subjectToppers.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-black py-4 text-center text-slate-400">
                  কোনো বিষয়ভিত্তিক রেকর্ড পাওয়া যায়নি
                </td>
              </tr>
            ) : (
              subjectToppers.map((st, idx) => {
                const winner = st.winners[0]
                const hasTie = st.winners.length > 1

                return (
                  <tr key={idx} className="border-b border-black/40 hover:bg-slate-50 text-center">
                    <td className="border border-black py-1.5 px-1 font-mono">{idx + 1}</td>
                    <td className="border border-black py-1.5 px-2.5 text-left font-bold text-black">
                      {st.subjectName || "সাধারণ বিষয়"}
                    </td>
                    <td className="border border-black py-1.5 px-2 font-medium text-slate-700">
                      {st.dayName}
                    </td>
                    <td className="border border-black py-1.5 px-2 font-mono font-bold">
                      {st.totalMarks}
                    </td>
                    <td className="border border-black py-1.5 px-3 text-left font-black text-black">
                      {st.winners.length > 0 ? (
                        <div className="space-y-1">
                          {st.winners.map((w, wIdx) => (
                            <div key={w.id || wIdx} className={cn("flex items-center justify-between gap-1", wIdx > 0 && "pt-1 border-t border-slate-200")}>
                              <span>{w.name}</span>
                              {hasTie && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold shrink-0">
                                  যৌথ
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="border border-black py-1.5 px-2 font-mono font-bold">
                      {st.winners.length > 0 ? (
                        <div className="space-y-1">
                          {st.winners.map((w, wIdx) => (
                            <div key={w.id || wIdx} className={cn(wIdx > 0 && "pt-1 border-t border-slate-200")}>
                              {w.roll_no ?? w.batch_roll ?? "—"}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="border border-black py-1.5 px-2 font-mono text-[11px] text-slate-700">
                      {st.winners.length > 0 ? (
                        <div className="space-y-1">
                          {st.winners.map((w, wIdx) => (
                            <div key={w.id || wIdx} className={cn(wIdx > 0 && "pt-1 border-t border-slate-200")}>
                              {w.student_id}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="border border-black py-1.5 px-2 font-mono font-black text-black bg-slate-50">
                      {st.highestMarks >= 0 ? st.highestMarks : "—"}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. OFFICIAL SIGNATURES BLOCK */}
      <div className="pt-6 border-t border-black/30 mt-6 grid grid-cols-3 gap-4 text-center text-xs font-bold">
        <div>
          <div className="border-t border-black pt-1 w-3/4 mx-auto">Class Teacher</div>
          <p className="text-[10px] text-slate-500 font-normal">শ্রেণি শিক্ষক</p>
        </div>
        <div>
          <div className="border-t border-black pt-1 w-3/4 mx-auto">Incharge / Coordinator</div>
          <p className="text-[10px] text-slate-500 font-normal">ইনচার্জ / সমন্বয়কারী</p>
        </div>
        <div>
          <div className="border-t border-black pt-1 w-3/4 mx-auto">Head of Institute</div>
          <p className="text-[10px] text-slate-500 font-normal">অধ্যক্ষ / পরিচালক</p>
        </div>
      </div>
    </div>
  )
}
