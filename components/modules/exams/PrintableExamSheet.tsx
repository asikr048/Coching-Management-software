"use client"

import React, { useMemo } from "react"
import { Trophy, Award, CheckCircle2, Users, BookOpen, Calendar, GraduationCap } from "lucide-react"
import { getGrade, cn } from "@/lib/utils"

export interface PrintableExamSheetProps {
  exam: {
    id: string
    title: string
    subject?: string | null
    total_marks: number
    pass_marks: number
    exam_date?: string | null
    created_at?: string | null
    batch?: { name: string; branch_id?: string | null } | null
    branch?: { name: string; address?: string | null; phone?: string | null } | null
    exam_schedule_type?: string | null
  }
  mode: "one_time" | "weekly_aggregate" | "weekly_day"
  weeklyDays?: Array<{
    key: string
    day_bn: string
    day_en?: string
    subject?: string
    exam_name?: string
    total_marks: number
    pass_marks: number
  }>
  activeDayConfig?: {
    key: string
    day_bn: string
    day_en?: string
    subject?: string
    exam_name?: string
    total_marks: number
    pass_marks: number
  } | null
  totalWeeklyMaxMarks?: number
  students: Array<{
    id: string
    name: string
    student_id: string
    roll_no?: number | null
    batch_roll?: number | null
    phone?: string | null
  }>
  savedResults?: Record<string, { obtained_marks: string; grade: string }>
  dayMarksMap?: Record<string, Record<string, { marks: number; total: number; grade: string; subject?: string; exam_name?: string }>>
  sortBy?: "rank" | "roll"
  showPodium?: boolean
  showSubjectToppers?: boolean
  showSignatures?: boolean
  instituteName?: string
  instituteBranch?: string
}

function getDayMarkItemHelper(
  studentDays: Record<string, any> | undefined,
  dayKey?: string,
  dayBn?: string,
  dayEn?: string
) {
  if (!studentDays) return undefined
  if (dayKey && studentDays[dayKey]) return studentDays[dayKey]
  const lKey = dayKey?.toLowerCase()
  if (lKey && studentDays[lKey]) return studentDays[lKey]
  if (dayBn && studentDays[dayBn]) return studentDays[dayBn]
  if (dayEn && studentDays[dayEn]) return studentDays[dayEn]
  for (const [k, v] of Object.entries(studentDays)) {
    const lk = k.toLowerCase()
    if ((lKey && lk === lKey) || (dayBn && k === dayBn) || (dayEn && lk === dayEn.toLowerCase())) {
      return v
    }
  }
  return undefined
}

export default function PrintableExamSheet({
  exam,
  mode,
  weeklyDays = [],
  activeDayConfig = null,
  totalWeeklyMaxMarks = 100,
  students = [],
  savedResults = {},
  dayMarksMap = {},
  sortBy = "rank",
  showPodium = true,
  showSubjectToppers = true,
  showSignatures = true,
  instituteName = "মেধাশিরী কোচিং সেন্টার",
  instituteBranch,
}: PrintableExamSheetProps) {
  const isWeeklyAggregate = mode === "weekly_aggregate"
  const isWeeklyDay = mode === "weekly_day"

  // Active marks thresholds
  const activeTotalMarks = isWeeklyAggregate
    ? totalWeeklyMaxMarks
    : isWeeklyDay
    ? activeDayConfig?.total_marks || 50
    : exam.total_marks || 100

  const activePassMarks = isWeeklyAggregate
    ? Math.round(totalWeeklyMaxMarks * 0.4)
    : isWeeklyDay
    ? activeDayConfig?.pass_marks || 20
    : exam.pass_marks || 33

  const displaySubject = isWeeklyAggregate
    ? "সকল বিষয় (সাপ্তাহিক মূল্যায়ন)"
    : isWeeklyDay
    ? activeDayConfig?.subject || activeDayConfig?.exam_name || "বিষয়"
    : exam.subject || "সাধারণ বিষয়"

  const displayBranch =
    instituteBranch ||
    exam.branch?.name ||
    (exam.batch?.branch_id ? "শাখা ক্যাম্পাস" : "মূল শাখা")

  // Process rows with marks, percentages, grades, and calculate ranks
  const processedRows = useMemo(() => {
    // 1. Calculate raw obtained marks for every student
    const rawList = students.map((s, originalIdx) => {
      const rollNumber = s.roll_no || s.batch_roll || originalIdx + 1

      if (isWeeklyAggregate) {
        const studentDays = dayMarksMap[s.id] || {}
        let sumMarks = 0
        let hasAnyDayMark = false

        // Sum across weekly days
        for (const d of weeklyDays) {
          const item = getDayMarkItemHelper(studentDays, d.key, d.day_bn, d.day_en)
          if (item && !isNaN(Number(item.marks))) {
            sumMarks += Number(item.marks)
            hasAnyDayMark = true
          }
        }

        // Fallback to saved result if no day marks entered
        if (!hasAnyDayMark && savedResults[s.id]?.obtained_marks) {
          const fbVal = parseFloat(savedResults[s.id].obtained_marks)
          if (!isNaN(fbVal)) {
            sumMarks = fbVal
            hasAnyDayMark = true
          }
        }

        const mark = hasAnyDayMark ? sumMarks : null
        const pct = mark !== null ? Math.round((mark / activeTotalMarks) * 100) : null
        const grade = mark !== null ? getGrade(mark, activeTotalMarks) : "—"
        const isPass = mark !== null && mark >= activePassMarks

        // Day-by-day marks breakdown map
        const dayBreakdown: Record<string, { marks: number | null; total: number }> = {}
        for (const d of weeklyDays) {
          const item = getDayMarkItemHelper(studentDays, d.key, d.day_bn, d.day_en)
          dayBreakdown[d.key] = {
            marks: item && !isNaN(Number(item.marks)) ? Number(item.marks) : null,
            total: d.total_marks,
          }
        }

        return {
          student: s,
          rollNumber,
          mark,
          pct,
          grade,
          isPass,
          dayBreakdown,
          hasEvaluated: hasAnyDayMark,
        }
      } else if (isWeeklyDay && activeDayConfig) {
        const studentDays = dayMarksMap[s.id] || {}
        const item = getDayMarkItemHelper(studentDays, activeDayConfig.key, activeDayConfig.day_bn, activeDayConfig.day_en)
        const hasMark = Boolean(item && !isNaN(Number(item.marks)))
        const mark = hasMark ? Number(item.marks) : null
        const pct = mark !== null ? Math.round((mark / activeTotalMarks) * 100) : null
        const grade = mark !== null ? getGrade(mark, activeTotalMarks) : "—"
        const isPass = mark !== null && mark >= activePassMarks

        return {
          student: s,
          rollNumber,
          mark,
          pct,
          grade,
          isPass,
          dayBreakdown: {},
          hasEvaluated: hasMark,
        }
      } else {
        // One-Time Exam
        const raw = savedResults[s.id]?.obtained_marks
        const hasMark = raw !== undefined && raw !== "" && !isNaN(parseFloat(raw))
        const mark = hasMark ? parseFloat(raw) : null
        const pct = mark !== null ? Math.round((mark / activeTotalMarks) * 100) : null
        const grade = mark !== null ? getGrade(mark, activeTotalMarks) : "—"
        const isPass = mark !== null && mark >= activePassMarks

        return {
          student: s,
          rollNumber,
          mark,
          pct,
          grade,
          isPass,
          dayBreakdown: {},
          hasEvaluated: hasMark,
        }
      }
    })

    // 2. Compute true Merit Rank by sorting evaluated students by mark descending
    const evaluatedOnly = rawList
      .filter((r) => r.hasEvaluated && r.mark !== null)
      .sort((a, b) => (b.mark || 0) - (a.mark || 0))

    const rankMap = new Map<string, number>()
    let currentRank = 1
    evaluatedOnly.forEach((item, idx) => {
      if (idx > 0 && (item.mark || 0) < (evaluatedOnly[idx - 1].mark || 0)) {
        currentRank = idx + 1
      }
      rankMap.set(item.student.id, currentRank)
    })

    // 3. Attach rank to each student record
    const withRank = rawList.map((r) => ({
      ...r,
      rank: rankMap.get(r.student.id) || null,
    }))

    // 4. Sort according to requested sort option (rank or roll)
    if (sortBy === "roll") {
      withRank.sort((a, b) => a.rollNumber - b.rollNumber)
    } else {
      // By Merit Rank: ranked students first (sorted 1, 2, 3...), then unranked by roll
      withRank.sort((a, b) => {
        if (a.rank !== null && b.rank !== null) {
          if (a.rank !== b.rank) return a.rank - b.rank
          return a.rollNumber - b.rollNumber
        }
        if (a.rank !== null && b.rank === null) return -1
        if (a.rank === null && b.rank !== null) return 1
        return a.rollNumber - b.rollNumber
      })
    }

    return withRank
  }, [students, isWeeklyAggregate, isWeeklyDay, activeDayConfig, totalWeeklyMaxMarks, activeTotalMarks, activePassMarks, dayMarksMap, weeklyDays, savedResults, exam.total_marks, exam.pass_marks, sortBy])

  // Summary KPIs
  const summary = useMemo(() => {
    const totalStudents = students.length
    const evaluated = processedRows.filter((r) => r.hasEvaluated && r.mark !== null)
    const evaluatedCount = evaluated.length
    const passedCount = evaluated.filter((r) => r.isPass).length
    const failedCount = evaluatedCount - passedCount
    const passRate = evaluatedCount > 0 ? Math.round((passedCount / evaluatedCount) * 100) : 0
    const scores = evaluated.map((r) => r.mark as number)
    const highestScore = scores.length ? Math.max(...scores) : 0
    const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    return {
      totalStudents,
      evaluatedCount,
      passedCount,
      failedCount,
      passRate,
      highestScore,
      averageScore,
    }
  }, [students.length, processedRows])

  // Podium / Top 3
  const topThree = useMemo(() => {
    const evaluated = processedRows
      .filter((r) => r.hasEvaluated && r.mark !== null && r.rank !== null)
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))

    return evaluated.slice(0, 3)
  }, [processedRows])

  // Subject-wise toppers calculation for Weekly Aggregate
  const { subjectToppers, dayTopperMap } = useMemo(() => {
    if (!isWeeklyAggregate || weeklyDays.length === 0) {
      return {
        subjectToppers: [],
        dayTopperMap: new Map<string, { score: number; names: string; rolls: string; topStudentIds: Set<string> }>(),
      }
    }

    const toppersList: Array<{
      day: (typeof weeklyDays)[0]
      topScore: number
      winners: Array<{ student: (typeof students)[0]; rollNumber: number; score: number }>
    }> = []

    const map = new Map<string, { score: number; names: string; rolls: string; topStudentIds: Set<string> }>()

    for (const d of weeklyDays) {
      let maxScore = -1
      const studentDayEntries: Array<{ student: (typeof students)[0]; rollNumber: number; score: number }> = []

      for (const s of students) {
        const studentDays = dayMarksMap[s.id] || {}
        const item = getDayMarkItemHelper(studentDays, d.key, d.day_bn, d.day_en)
        if (item && !isNaN(Number(item.marks))) {
          const sc = Number(item.marks)
          if (sc > maxScore) {
            maxScore = sc
          }
          studentDayEntries.push({
            student: s,
            rollNumber: s.roll_no || s.batch_roll || 0,
            score: sc,
          })
        }
      }

      const winners = maxScore >= 0 ? studentDayEntries.filter((e) => e.score === maxScore) : []
      toppersList.push({
        day: d,
        topScore: maxScore,
        winners,
      })

      const topIds = new Set(winners.map((w) => w.student.id))
      map.set(d.key, {
        score: maxScore,
        names: winners.map((w) => w.student.name).join(", "),
        rolls: winners.map((w) => w.rollNumber).join(", "),
        topStudentIds: topIds,
      })
    }

    return { subjectToppers: toppersList, dayTopperMap: map }
  }, [isWeeklyAggregate, weeklyDays, students, dayMarksMap])

  const formattedExamDate = useMemo(() => {
    if (exam.exam_date) {
      try {
        const d = new Date(exam.exam_date)
        return d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })
      } catch {
        return exam.exam_date
      }
    }
    return "নিয়মিত সেশন"
  }, [exam.exam_date])

  const printTimestamp = useMemo(() => {
    return new Date().toLocaleString("bn-BD", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }, [])

  return (
    <div
      id="printable-exam-sheet"
      className="bg-white text-slate-900 p-4 sm:p-6 font-sans leading-normal selection:bg-none print:p-0 print:m-0 print:w-full print:border-none print:shadow-none"
      style={{ minHeight: "100%" }}
    >
      {/* 1. OFFICIAL INSTITUTION HEADER */}
      <div className="border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0 print:border print:border-slate-800">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase leading-none">
                {instituteName}
              </h1>
              <p className="text-xs font-bold text-amber-700 tracking-wider mt-1 uppercase">
                Academic &amp; Admission Care • {displayBranch}
              </p>
              {exam.branch?.address && (
                <p className="text-[11px] text-slate-500 mt-0.5">{exam.branch.address}</p>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="inline-block px-3 py-1 rounded-lg border-2 border-slate-900 text-slate-900 font-black text-xs uppercase tracking-wider bg-slate-50 print:bg-transparent">
              {isWeeklyAggregate
                ? "সাপ্তাহিক সামগ্রিক মেধা তালিকা"
                : isWeeklyDay
                ? `সাপ্তাহিক পরীক্ষা: ${activeDayConfig?.day_bn || "দিন"}`
                : "ফলাফল ও মেধা তালিকা বিবরণী"}
            </span>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              মুদ্রণের সময়: {printTimestamp}
            </p>
          </div>
        </div>

        {/* EXAM & BATCH META INFO GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3 border-t border-slate-200 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">পরীক্ষার নাম</span>
            <span className="font-black text-slate-900 leading-snug block">{exam.title}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">ব্যাচ ও বিষয়</span>
            <span className="font-black text-slate-900 leading-snug block">
              {exam.batch?.name || "সকল ব্যাচ"} • {displaySubject}
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">তারিখ ও সেশন</span>
            <span className="font-bold text-slate-900 block">{formattedExamDate}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 print:bg-transparent print:border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">পূর্ণমান ও পাস নম্বর</span>
            <span className="font-black text-slate-900 block">
              পূর্ণমান: <strong className="text-amber-800">{activeTotalMarks}</strong> • পাস: <strong className="text-emerald-800">{activePassMarks}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. STATISTICAL SUMMARY STRIP */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4 text-center">
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/70 print:bg-transparent">
          <p className="text-[10px] font-bold uppercase text-slate-500">মোট শিক্ষার্থী</p>
          <p className="text-base font-black text-slate-900">{summary.totalStudents}</p>
        </div>
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/70 print:bg-transparent">
          <p className="text-[10px] font-bold uppercase text-slate-500">মূল্যায়িত</p>
          <p className="text-base font-black text-indigo-900">{summary.evaluatedCount}</p>
        </div>
        <div className="border border-emerald-300 rounded-lg p-2 bg-emerald-50/50 print:bg-transparent">
          <p className="text-[10px] font-bold uppercase text-emerald-800">উত্তীর্ণ (পাস)</p>
          <p className="text-base font-black text-emerald-900">
            {summary.passedCount} <span className="text-xs font-normal">({summary.passRate}%)</span>
          </p>
        </div>
        <div className="border border-rose-300 rounded-lg p-2 bg-rose-50/50 print:bg-transparent">
          <p className="text-[10px] font-bold uppercase text-rose-800">অনুত্তীর্ণ (ফেল)</p>
          <p className="text-base font-black text-rose-900">{summary.failedCount}</p>
        </div>
        <div className="border border-amber-300 rounded-lg p-2 bg-amber-50/50 print:bg-transparent">
          <p className="text-[10px] font-bold uppercase text-amber-800">সর্বোচ্চ নম্বর</p>
          <p className="text-base font-black text-amber-900">
            {summary.highestScore} <span className="text-xs font-normal text-slate-600">/{activeTotalMarks}</span>
          </p>
        </div>
        <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/70 print:bg-transparent">
          <p className="text-[10px] font-bold uppercase text-slate-500">গড় নম্বর</p>
          <p className="text-base font-black text-slate-900">
            {summary.averageScore} <span className="text-xs font-normal text-slate-600">/{activeTotalMarks}</span>
          </p>
        </div>
      </div>

      {/* 3. TOP 3 PODIUM SUMMARY (If enabled & available) */}
      {showPodium && topThree.length > 0 && (
        <div className="mb-4 border border-slate-300 rounded-xl p-3 bg-slate-50/50 print:bg-transparent">
          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-200">
            <Trophy className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              শীর্ষ ৩ মেধা স্থান (Top Performers Podium)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {topThree.map((item, idx) => {
              const placeLabel = idx === 0 ? "১ম স্থান (1st)" : idx === 1 ? "২য় স্থান (2nd)" : "৩য় স্থান (3rd)"
              const badgeBg = idx === 0 ? "bg-amber-100 text-amber-900 border-amber-300" : idx === 1 ? "bg-slate-200 text-slate-900 border-slate-400" : "bg-orange-100 text-orange-900 border-orange-300"

              return (
                <div
                  key={item.student.id}
                  className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-300 print:border-slate-400"
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border",
                      badgeBg
                    )}
                  >
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {placeLabel}
                    </p>
                    <p className="text-xs font-black text-slate-900 truncate">{item.student.name}</p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      রোল: {item.rollNumber} • আইডি: {item.student.student_id}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-amber-900 block">
                      {item.mark}/{activeTotalMarks}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 block">
                      {item.pct}% ({item.grade})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3.1 SUBJECT-WISE TOPPERS (বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী) */}
      {/* 3.1 SUBJECT-WISE TOPPERS (বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী) */}
      {showSubjectToppers && isWeeklyAggregate && subjectToppers.length > 0 && (
        <div
          className="mb-4 border border-purple-300 rounded-xl p-3 bg-purple-50/40 print:border-slate-400 print:bg-transparent"
          style={{ pageBreakInside: "avoid" }}
        >
          <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-purple-200 print:border-slate-300">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী (Subject-wise Toppers)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-200 print:hidden">
              প্রতিটি বিষয়ের নির্ধারিত দিনে সর্বোচ্চ নম্বর অর্জনকারী
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {subjectToppers.map((st) => {
              const hasWinner = st.winners.length > 0 && st.topScore >= 0
              const primaryWinner = hasWinner ? st.winners[0] : null
              const isTie = st.winners.length > 1

              return (
                <div
                  key={st.day.key}
                  className="p-2.5 sm:p-3 bg-white rounded-xl border border-purple-200/90 print:border-slate-300 flex flex-col justify-between space-y-2 text-left shadow-2xs print:shadow-none"
                  style={{ pageBreakInside: "avoid" }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 pb-1 border-b border-purple-100 print:border-slate-200">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>
                        <span>{st.day.day_bn}</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 print:border-slate-300">
                        পূর্ণমান: {st.day.total_marks}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-purple-900 mt-1">
                      {st.day.subject || st.day.exam_name}
                    </p>
                  </div>

                  {hasWinner ? (
                    <div className="pt-2 border-t border-slate-100 print:border-slate-200 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-950 text-xs flex items-center gap-1">
                          <span className="shrink-0 text-amber-500">🏆</span>
                          <span className="font-black text-slate-950">
                            {isTie ? st.winners.map((w) => w.student.name).join(", ") : primaryWinner?.student.name}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                          {isTie
                            ? `রোল: ${st.winners.map((w) => w.rollNumber).join(", ")}`
                            : `রোল: ${primaryWinner?.rollNumber} • আইডি: ${primaryWinner?.student.student_id}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-xs sm:text-sm text-amber-800 block">
                          {st.topScore}/{st.day.total_marks}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 block">
                          {Math.round((st.topScore / (st.day.total_marks || 50)) * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1.5 border-t border-slate-100 print:border-slate-200">
                      <p className="text-xs text-slate-400 italic">
                        নম্বর এখনও যুক্ত হয়নি
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. OFFICIAL TABULATION SHEET TABLE */}
      <div className="w-full overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse border border-slate-400 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-black border-b-2 border-slate-400 text-center uppercase tracking-wider text-[11px] print:bg-slate-200">
              <th className="border border-slate-400 py-1.5 px-1 w-8 min-w-[32px] text-center whitespace-nowrap">#</th>
              <th className="border border-slate-400 py-1.5 px-1.5 w-14 min-w-[50px] text-center whitespace-nowrap">মেধাক্রম</th>
              <th className="border border-slate-400 py-1.5 px-1.5 w-12 min-w-[44px] text-center whitespace-nowrap font-mono">রোল</th>
              <th className="border border-slate-400 py-1.5 px-1.5 w-24 min-w-[85px] text-center whitespace-nowrap font-mono">শিক্ষার্থী আইডি</th>
              <th className="border border-slate-400 py-1.5 px-3 text-left min-w-[140px] whitespace-nowrap">শিক্ষার্থীর নাম</th>

              {/* Weekly Aggregate: Active Days Columns */}
              {isWeeklyAggregate &&
                weeklyDays.map((d) => (
                  <th key={d.key} className="border border-slate-400 py-1.5 px-1 text-center whitespace-nowrap min-w-[52px]">
                    <span className="block font-black text-[11px] leading-tight">{d.day_bn}</span>
                    <span className="text-[9px] font-semibold text-slate-600 block truncate max-w-[62px] mx-auto leading-tight" title={d.subject || d.exam_name}>
                      {d.subject || d.exam_name}
                    </span>
                    <span className="text-[9px] text-amber-900 font-bold block leading-tight">({d.total_marks})</span>
                  </th>
                ))}

              <th className="border border-slate-400 py-1.5 px-2 bg-amber-50/70 print:bg-transparent text-center whitespace-nowrap w-20 min-w-[70px]">
                <span className="block font-black text-[11px] leading-tight">
                  {isWeeklyAggregate ? "মোট প্রাপ্ত" : "প্রাপ্ত নম্বর"}
                </span>
                <span className="text-[9px] text-amber-900 font-bold block leading-tight">
                  ({isWeeklyAggregate ? totalWeeklyMaxMarks : activeTotalMarks})
                </span>
              </th>
              <th className="border border-slate-400 py-1.5 px-1.5 w-12 min-w-[44px] text-center whitespace-nowrap">শতকরা</th>
              <th className="border border-slate-400 py-1.5 px-1.5 w-12 min-w-[40px] text-center whitespace-nowrap">গ্রেড</th>
              <th className="border border-slate-400 py-1.5 px-2 w-14 min-w-[55px] text-center whitespace-nowrap">ফলাফল</th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((row, idx) => {
              const isEven = idx % 2 === 0
              const rowClass = cn(
                "border-b border-slate-300 text-slate-900 print:border-slate-300",
                isEven ? "bg-white" : "bg-slate-50/50 print:bg-transparent"
              )

              return (
                <tr key={row.student.id} className={rowClass} style={{ pageBreakInside: "avoid" }}>
                  <td className="border border-slate-300 py-1.5 px-1 text-center font-mono text-slate-500 font-semibold whitespace-nowrap">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-1.5 text-center font-bold whitespace-nowrap">
                    {row.rank !== null ? (
                      <span
                        className={cn(
                          "inline-block font-black px-1.5 py-0.5 rounded text-xs",
                          row.rank === 1
                            ? "bg-amber-100 text-amber-950 font-extrabold border border-amber-400"
                            : row.rank === 2
                            ? "bg-slate-200 text-slate-950 font-bold border border-slate-400"
                            : row.rank === 3
                            ? "bg-orange-100 text-orange-950 font-bold border border-orange-400"
                            : "text-slate-800"
                        )}
                      >
                        {row.rank}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                    {row.rollNumber}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono text-[11px] text-slate-700 whitespace-nowrap">
                    {row.student.student_id}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-3 font-bold text-slate-950 whitespace-nowrap min-w-[140px]">
                    {row.student.name}
                  </td>

                  {/* Day marks if weekly aggregate */}
                  {isWeeklyAggregate &&
                    weeklyDays.map((d) => {
                      const dayVal = row.dayBreakdown[d.key]?.marks
                      const isTopper =
                        dayVal !== null &&
                        dayVal !== undefined &&
                        dayTopperMap.get(d.key)?.topStudentIds.has(row.student.id) &&
                        dayVal > 0

                      return (
                        <td
                          key={d.key}
                          className={cn(
                            "border border-slate-300 py-1 px-1 text-center font-mono text-xs whitespace-nowrap",
                            isTopper ? "bg-amber-100/70 font-black text-amber-950 print:bg-amber-100" : ""
                          )}
                        >
                          {dayVal !== null && dayVal !== undefined ? (
                            <span
                              className={cn(
                                dayVal >= d.pass_marks ? "text-slate-900 font-semibold" : "text-rose-700 font-bold",
                                isTopper ? "text-amber-950 font-black inline-flex items-center justify-center gap-0.5" : ""
                              )}
                              title={isTopper ? "🏆 বিষয়ভিত্তিক শীর্ষ শিক্ষার্থী" : undefined}
                            >
                              {isTopper && <span className="text-[10px]">🏆</span>}
                              {dayVal}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">abs</span>
                          )}
                        </td>
                      )
                    })}

                  <td className="border border-slate-300 py-1.5 px-2 text-center font-mono font-black text-amber-950 bg-amber-50/40 print:bg-transparent whitespace-nowrap">
                    {row.mark !== null ? row.mark : <span className="text-slate-400 font-normal">—</span>}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-1.5 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                    {row.pct !== null ? `${row.pct}%` : "—"}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-1.5 text-center font-black whitespace-nowrap">
                    {row.grade !== "—" ? (
                      <span
                        className={cn(
                          row.grade === "A+" || row.grade === "A"
                            ? "text-emerald-800"
                            : row.grade === "F"
                            ? "text-rose-700 font-black"
                            : "text-amber-800"
                        )}
                      >
                        {row.grade}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">—</span>
                    )}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-center font-bold text-[11px] whitespace-nowrap">
                    {row.mark !== null ? (
                      row.isPass ? (
                        <span className="text-emerald-800 font-black">উত্তীর্ণ</span>
                      ) : (
                        <span className="text-rose-700 font-black">অনুত্তীর্ণ</span>
                      )
                    ) : (
                      <span className="text-slate-400 font-normal">অনুপস্থিত</span>
                    )}
                  </td>
                </tr>
              )
            })}

            {processedRows.length === 0 && (
              <tr>
                <td
                  colSpan={isWeeklyAggregate ? weeklyDays.length + 9 : 9}
                  className="border border-slate-300 py-8 text-center text-slate-400 italic"
                >
                  কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                </td>
              </tr>
            )}
          </tbody>

          {/* TABLE SUMMARY FOOTER FOR WEEKLY AGGREGATE */}
          {isWeeklyAggregate && weeklyDays.length > 0 && processedRows.length > 0 && (
            <tfoot style={{ pageBreakInside: "avoid" }}>
              {/* Row 1: Subject-wise Highest Score */}
              <tr className="bg-amber-50/80 font-black border-t-2 border-slate-400 text-xs print:bg-slate-100">
                <td colSpan={5} className="border border-slate-400 py-1.5 px-3 text-right text-slate-900">
                  <span className="flex items-center justify-end gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-600 inline shrink-0" />
                    <span>বিষয়ভিত্তিক সর্বোচ্চ নম্বর (Highest Mark):</span>
                  </span>
                </td>
                {weeklyDays.map((d) => {
                  const topper = dayTopperMap.get(d.key)
                  return (
                    <td
                      key={d.key}
                      className="border border-slate-400 py-1.5 px-1 text-center font-mono font-black text-amber-950 bg-amber-100/60 print:bg-transparent"
                    >
                      {topper && topper.score >= 0 ? `${topper.score}/${d.total_marks}` : "—"}
                    </td>
                  )
                })}
                <td className="border border-slate-400 py-1.5 px-2 text-center font-mono font-black text-amber-950 bg-amber-100/70">
                  {summary.highestScore}/{activeTotalMarks}
                </td>
                <td
                  colSpan={3}
                  className="border border-slate-400 py-1.5 px-2 text-center text-[10px] text-slate-600 font-bold"
                >
                  সর্বোচ্চ প্রাপ্তি
                </td>
              </tr>

              {/* Row 2: Subject Toppers Names / Rolls */}
              <tr className="bg-slate-100 font-bold border-t border-slate-300 text-[10px] print:bg-slate-50">
                <td colSpan={5} className="border border-slate-400 py-1.5 px-3 text-right text-purple-900 font-black">
                  <span className="flex items-center justify-end gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-700 inline shrink-0" />
                    <span>বিষয়ভিত্তিক শীর্ষ মেধা (Subject Topper):</span>
                  </span>
                </td>
                {weeklyDays.map((d) => {
                  const topper = dayTopperMap.get(d.key)
                  return (
                    <td
                      key={d.key}
                      className="border border-slate-400 py-1 px-1 text-center text-[10px] font-semibold text-slate-900"
                      title={topper?.names}
                    >
                      {topper && topper.names ? (
                        <div className="truncate max-w-[85px] mx-auto">
                          <span className="font-black text-slate-950 block truncate">🏆 {topper.names}</span>
                          <span className="text-[9px] text-slate-600 font-mono block">রোল: {topper.rolls}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  )
                })}
                <td colSpan={4} className="border border-slate-400 py-1.5 px-2 text-center text-[10px] text-slate-400">
                  —
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 5. OFFICIAL SIGNATURES BLOCK */}
      {showSignatures && (
        <div
          className="grid grid-cols-4 gap-4 pt-14 mt-10 border-t border-slate-300 text-center text-xs text-slate-800 font-semibold"
          style={{ pageBreakInside: "avoid" }}
        >
          <div>
            <div className="border-t border-slate-800 pt-1.5 mx-auto max-w-[150px] font-bold">
              প্রস্তুতকারক / সহকারী
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">তারিখ: .......................</p>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1.5 mx-auto max-w-[150px] font-bold">
              শ্রেণি শিক্ষক / কো-অর্ডিনেটর
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">তারিখ: .......................</p>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1.5 mx-auto max-w-[150px] font-bold">
              পরীক্ষা নিয়ন্ত্রক
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">তারিখ: .......................</p>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1.5 mx-auto max-w-[150px] font-bold">
              শাখা পরিচালক / প্রধান
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">তারিখ: .......................</p>
          </div>
        </div>
      )}

      {/* 6. BOTTOM FOOTER NOTICE */}
      <div
        className="mt-6 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono"
        style={{ pageBreakInside: "avoid" }}
      >
        <span>
          © {new Date().getFullYear()} {instituteName} • মেধা ও মূল্যায়ন ব্যবস্থাপনা পোর্টাল
        </span>
        <span>স্মারক নং: EXAM-{exam.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  )
}
