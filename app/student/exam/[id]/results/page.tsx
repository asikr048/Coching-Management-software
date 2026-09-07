"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  MessageSquare,
  Trophy,
  AlertCircle,
  Award,
  Clock,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Sparkles,
  Users
} from "lucide-react"
import { getGrade, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export default function StudentExamResultsPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<any>(null)
  const [myResult, setMyResult] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [canViewAll, setCanViewAll] = useState(false)
  
  // MCQ Quiz Submissions (if online test)
  const [submission, setSubmission] = useState<any>(null)
  const [answers, setAnswers] = useState<any[]>([])

  useEffect(() => {
    async function loadResults() {
      try {
        // 1. Fetch official exam results & rank via server API
        const res = await fetch(`/api/exams/${examId}/results`)
        const json = await res.json()

        if (!res.ok) {
          throw new Error(json.error || "Failed to load exam results")
        }

        const examData = json.exam || {}
        setExam(examData)
        setCanViewAll(!!json.can_view_all)

        const resultsList: any[] = json.results || []
        setLeaderboard(resultsList)

        // Find current student's result
        let curStudentRes = resultsList.find((r: any) => r.is_current_student)
        if (!curStudentRes && json.current_student_id) {
          curStudentRes = resultsList.find((r: any) => r.student_id === json.current_student_id)
        }
        if (!curStudentRes && resultsList.length === 1 && !json.can_view_all) {
          curStudentRes = resultsList[0]
        }
        setMyResult(curStudentRes || null)

        // 2. Check for online MCQ submission if available
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: sData } = await supabase
              .from("students")
              .select("id")
              .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
              .maybeSingle()

            if (sData) {
              const { data: subData } = await supabase
                .from("exam_submissions")
                .select("*")
                .eq("exam_id", examId)
                .eq("student_id", sData.id)
                .maybeSingle()

              if (subData && subData.is_submitted) {
                setSubmission(subData)
                const { data: ansData } = await supabase
                  .from("exam_answers")
                  .select("*, question:exam_questions(*)")
                  .eq("submission_id", subData.id)

                if (ansData) {
                  const sortedAnswers = [...ansData].sort(
                    (a: any, b: any) => (a.question?.sort_order || 0) - (b.question?.sort_order || 0)
                  )
                  setAnswers(sortedAnswers)
                }
              }
            }
          }
        } catch (mcqErr) {
          // Non-blocking: written/weekly exams won't have exam_submissions
          console.warn("Online MCQ check note:", mcqErr)
        }
      } catch (err: any) {
        console.error("Error loading exam results:", err)
        toast.error(err.message || "Failed to load exam results")
      } finally {
        setLoading(false)
      }
    }

    if (examId) {
      loadResults()
    }
  }, [examId])

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold text-slate-500">ফলাফল লোড হচ্ছে...</p>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-3">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">ফলাফল পাওয়া যায়নি</h2>
          <p className="text-sm text-gray-500">পরীক্ষার তথ্য অথবা ফলাফল বর্তমানে অনুপলব্ধ।</p>
          <Link
            href="/student/profile"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors mt-2"
          >
            <ArrowLeft className="w-4 h-4" /> প্রোফাইলে ফিরে যান
          </Link>
        </div>
      </div>
    )
  }

  const isWeekly =
    exam.exam_schedule_type === "weekly" ||
    (Array.isArray(exam.recurring_days) && exam.recurring_days.length > 0) ||
    exam.is_weekly_published === true

  const totalMarks = Number(exam.total_marks) || 100
  const passMarks = Number(exam.pass_marks) || 33

  // Score determination: preference to myResult, then submission
  const obtainedMarks = myResult
    ? Number(myResult.obtained_marks ?? myResult.marks_obtained ?? 0)
    : submission
    ? Number(submission.total_obtained ?? 0)
    : 0

  const hasScore = !!myResult || !!submission
  const isPass = obtainedMarks >= passMarks
  const grade = myResult?.grade || getGrade(obtainedMarks, totalMarks)
  const rank = myResult?.rank || null
  const dayMarks = myResult?.day_marks || {}

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/student/profile"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>প্রোফাইলে ফিরে যান (Student Profile)</span>
        </Link>

        <Link
          href="/online-result"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 text-xs font-bold transition-colors"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-600" />
          <span>অনলাইন রেজাল্ট পোর্টাল</span>
        </Link>
      </div>

      {/* Hero Overview Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 p-6 sm:p-8 text-white relative">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {isWeekly ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-purple-400/20 text-purple-200 border border-purple-400/30">
                <CalendarDays className="w-3.5 h-3.5" />
                সাপ্তাহিক মডেল টেস্ট (Weekly)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-200 border border-amber-400/30">
                <Calendar className="w-3.5 h-3.5" />
                এককালীন পরীক্ষা (One-time)
              </span>
            )}

            {exam.subject && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 text-white border border-white/20">
                {exam.subject}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black">{exam.title}</h1>
          <p className="text-indigo-200 text-xs sm:text-sm mt-1">
            পূর্ণমান: {totalMarks} • পাস নম্বর: {passMarks}
            {exam.exam_date && ` • তারিখ: ${formatDate(exam.exam_date)}`}
          </p>
        </div>

        {hasScore ? (
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white">
            <div className="p-5 sm:p-6 text-center">
              <p className="text-xs text-slate-500 font-semibold mb-1">প্রাপ্ত নম্বর (Score)</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">
                {obtainedMarks}{" "}
                <span className="text-sm sm:text-base text-slate-400 font-normal">/ {totalMarks}</span>
              </p>
            </div>

            <div className="p-5 sm:p-6 text-center">
              <p className="text-xs text-slate-500 font-semibold mb-1">অবস্থা (Status)</p>
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isPass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}
              >
                {isPass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {isPass ? "উত্তীর্ণ (PASSED)" : "অনুত্তীর্ণ (FAILED)"}
              </div>
            </div>

            <div className="p-5 sm:p-6 text-center">
              <p className="text-xs text-slate-500 font-semibold mb-1">গ্রেড (Grade)</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{grade || "-"}</p>
            </div>

            <div className="p-5 sm:p-6 text-center">
              <p className="text-xs text-slate-500 font-semibold mb-1">মেধা স্থান (Rank)</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center justify-center gap-1.5">
                {rank ? `#${rank}` : "-"}
                {rank === 1 && <Award className="w-6 h-6 text-amber-500 shrink-0" />}
                {rank === 2 && <Award className="w-6 h-6 text-slate-400 shrink-0" />}
                {rank === 3 && <Award className="w-6 h-6 text-amber-700 shrink-0" />}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">ফলাফল এখনও প্রকাশিত বা রেকর্ড করা হয়নি</p>
            <p className="text-xs text-slate-400">কর্তৃপক্ষ ফলাফল প্রকাশ করলে এখানে দৃশ্যমান হবে।</p>
          </div>
        )}
      </div>

      {/* Weekly Exam Day-by-day score breakdown */}
      {isWeekly && Object.keys(dayMarks).length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-black text-slate-900">
              সাপ্তাহিক পরীক্ষার দিনভিত্তিক নম্বর (Day-by-Day Score)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(dayMarks).map(([dKey, dVal]: any) => {
              const mVal = typeof dVal === "object" && dVal !== null ? (dVal.marks ?? 0) : dVal
              const tVal = typeof dVal === "object" && dVal !== null ? (dVal.total ?? "") : ""
              const sub = typeof dVal === "object" && dVal !== null ? dVal.subject : null
              const examName = typeof dVal === "object" && dVal !== null ? dVal.exam_name : null
              const dGrade = typeof dVal === "object" && dVal !== null ? dVal.grade : null

              return (
                <div
                  key={dKey}
                  className="bg-gradient-to-br from-purple-50/60 to-indigo-50/40 rounded-2xl p-4 border border-purple-100 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-purple-900 uppercase text-xs tracking-wider">
                      {dKey}
                    </span>
                    {dGrade && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-800 text-[10px] font-black">
                        {dGrade}
                      </span>
                    )}
                  </div>

                  {examName && <p className="text-xs font-bold text-slate-800">{examName}</p>}
                  {sub && <p className="text-[11px] text-slate-500 font-medium">বিষয়: {sub}</p>}

                  <div className="pt-2 border-t border-purple-200/50 flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold">নম্বর:</span>
                    <span className="text-base font-black text-purple-950">
                      {mVal} {tVal ? <span className="text-xs font-normal text-slate-500">/ {tVal}</span> : ""}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Teacher / Result Note */}
      {exam.result_note && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-indigo-900 text-sm">শিক্ষক / কর্তৃপক্ষের বার্তা (Note)</h4>
            <p className="text-indigo-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
              {exam.result_note.replace(/\[[A-Z_]+:[^\]]*\]/g, "").trim()}
            </p>
          </div>
        </div>
      )}

      {/* Batch Merit List (If public) */}
      {canViewAll && leaderboard.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-black text-slate-900">ব্যাচ মেধাতালিকা (Batch Merit List)</h3>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              মোট শিক্ষার্থী: {leaderboard.length} জন
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-center w-16">মেধা</th>
                  <th className="px-4 py-3">শিক্ষার্থী</th>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3 text-center">প্রাপ্ত নম্বর</th>
                  <th className="px-4 py-3 text-center">গ্রেড</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((r, idx) => {
                  const isCurrent = r.is_current_student || (myResult && r.student_id === myResult.student_id)
                  const rRank = r.rank || idx + 1

                  return (
                    <tr
                      key={r.id || idx}
                      className={`transition-colors ${
                        isCurrent ? "bg-amber-50/80 font-black border-l-4 border-l-amber-500" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                            rRank === 1
                              ? "bg-amber-500 text-white"
                              : rRank === 2
                              ? "bg-slate-500 text-white"
                              : rRank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {rRank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{r.student?.name || r.student_name || "Student"}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">
                              YOU
                            </span>
                          )}
                        </div>

                        {/* Day breakdown inside leaderboard row */}
                        {r.day_marks && Object.keys(r.day_marks).length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {Object.entries(r.day_marks).map(([dKey, dVal]: any) => {
                              const mVal = typeof dVal === "object" && dVal !== null ? (dVal.marks ?? 0) : dVal
                              return (
                                <span
                                  key={dKey}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600"
                                >
                                  {dKey}: <strong className="text-purple-700">{mVal}</strong>
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {r.student?.student_id || r.roll || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-amber-700 text-sm">
                        {r.obtained_marks} / {totalMarks}
                      </td>
                      <td className="px-4 py-3 text-center font-extrabold text-slate-800">
                        {r.grade || "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Online MCQ Answers Breakdown (if test was online quiz) */}
      {answers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900">Detailed MCQ Breakdown</h3>
          <div className="space-y-4">
            {answers.map((ans, idx) => {
              const q = ans.question
              const isPending = q?.question_type === "long" && ans.is_correct === null
              let statusColor = "bg-gray-100 border-gray-200"
              let StatusIcon = Trophy
              if (isPending) {
                statusColor = "bg-yellow-50 border-yellow-200"
              } else if (ans.is_correct) {
                statusColor = "bg-emerald-50 border-emerald-200"
                StatusIcon = CheckCircle2
              } else {
                statusColor = "bg-red-50 border-red-200"
                StatusIcon = XCircle
              }

              return (
                <div key={ans.id || idx} className={`rounded-2xl border p-5 shadow-2xs ${statusColor}`}>
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex items-start gap-3">
                      {!isPending && (
                        <div className={`mt-0.5 shrink-0 ${ans.is_correct ? "text-emerald-600" : "text-rose-600"}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-gray-900 text-base">
                          <span className="text-gray-500 mr-1.5">{idx + 1}.</span>
                          {q?.question_text || "Question"}
                        </h4>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-bold text-gray-900">{ans.obtained_marks}</span>
                      <span className="text-gray-500 text-xs"> / {q?.marks || 1}</span>
                    </div>
                  </div>

                  <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/80 p-3 rounded-xl border border-gray-200/80">
                      <span className="block font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                        Your Answer
                      </span>
                      <p className="text-gray-900 font-medium">
                        {ans.student_answer || <span className="text-gray-400 italic">No answer provided</span>}
                      </p>
                    </div>

                    {q?.question_type !== "long" && (
                      <div className="bg-white/80 p-3 rounded-xl border border-gray-200/80">
                        <span className="block font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                          Correct Answer
                        </span>
                        <p className="text-emerald-700 font-bold">{q?.correct_answer}</p>
                      </div>
                    )}
                  </div>

                  {q?.hint_note && (
                    <div className="ml-8 mt-3 bg-blue-50/80 p-3 rounded-xl flex items-start gap-2 border border-blue-100 text-xs">
                      <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-blue-800 uppercase block">ব্যাখ্যা</span>
                        <p className="text-blue-900">{q.hint_note}</p>
                      </div>
                    </div>
                  )}

                  {ans.feedback && (
                    <div className="ml-8 mt-3 bg-purple-50/80 p-3 rounded-xl flex items-start gap-2 border border-purple-100 text-xs">
                      <MessageSquare className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-purple-800 uppercase block">শিক্ষকের মন্তব্য</span>
                        <p className="text-purple-900">{ans.feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
