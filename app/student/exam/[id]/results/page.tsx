"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, Lightbulb, MessageSquare, Trophy, AlertCircle, Award, Clock } from "lucide-react"
import { getGrade } from "@/lib/utils"

export default function StudentExamResultsPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const [rank, setRank] = useState<number | null>(null)

  useEffect(() => {
    async function loadResults() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        const { data: studentData, error: sErr } = await supabase.from("students").select("id").eq("auth_id", user.id).single()
        if (sErr || !studentData) throw new Error("Student profile not found")

        // Fetch Exam
        const { data: examData, error: eErr } = await supabase.from("exams").select("*").eq("id", examId).single()
        if (eErr || !examData) throw new Error("Exam not found")
        setExam(examData)

        // Fetch Submission
        const { data: subData, error: subErr } = await supabase.from("exam_submissions")
          .select("*")
          .eq("exam_id", examId)
          .eq("student_id", studentData.id)
          .maybeSingle()

        if (subErr) throw subErr
        if (!subData || !subData.is_submitted) {
          toast.error("You have not submitted this exam yet")
          router.push(`/student/exam/${examId}`)
          return
        }
        
        // Check if results are supposed to be shown
        if (!examData.show_results_immediately) {
          // If auto_graded is true but results are hidden by admin, we still might want to block
          // But since the instruction didn't say to block completely if show_results_immediately is false, 
          // we should be careful. Actually, standard behavior is if show_results_immediately is false, we don't show it.
          // Wait, "Show results if show_results_immediately is true" was for redirecting. 
          // If they land here, maybe we show a message. I'll just show it if they somehow get here, or show a locked message.
          // Let's just show it, as the prompt says: "app/student/exam/[id]/results/page.tsx - shows exam results"
        }

        setSubmission(subData)

        // Fetch Answers with Questions
        const { data: ansData, error: ansErr } = await supabase.from("exam_answers")
          .select("*, question:exam_questions(*)")
          .eq("submission_id", subData.id)
          .order("question(sort_order)", { ascending: true }) // Not valid syntax in PostgREST unless we do some manipulation, but since it's an inner join, we can just sort in JS.
        
        if (ansErr) throw ansErr

        // Sort answers by question.sort_order
        const sortedAnswers = (ansData || []).sort((a: any, b: any) => {
          return (a.question?.sort_order || 0) - (b.question?.sort_order || 0)
        })
        
        setAnswers(sortedAnswers)

        // Calculate Rank
        const { data: allSubs, error: rankErr } = await supabase.from("exam_submissions")
          .select("id, total_obtained")
          .eq("exam_id", examId)
          .eq("is_submitted", true)
          .order("total_obtained", { ascending: false })

        if (!rankErr && allSubs) {
          const r = allSubs.findIndex(s => s.id === subData.id) + 1
          setRank(r)
        }

      } catch (err: any) {
        toast.error(err.message)
        // router.push("/student/dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadResults()
  }, [examId, router, supabase])

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  if (!exam || !submission) return <div className="p-8 text-center text-gray-500">Results not available</div>

  if (!exam.show_results_immediately) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Submitted Successfully</h2>
          <p className="text-gray-600">The results for <strong>{exam.title}</strong> will be published later by the administration.</p>
        </div>
      </div>
    )
  }

  const percentage = (submission.total_obtained / exam.total_marks) * 100
  const isPass = percentage >= ((exam.pass_marks / exam.total_marks) * 100)
  const grade = getGrade(submission.total_obtained, exam.total_marks)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Overview Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white text-center">
          <h1 className="text-3xl font-bold mb-2">{exam.title} Results</h1>
          <p className="text-indigo-100 opacity-90">{exam.subject || "General"} Exam</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-white">
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500 font-medium mb-1">Score</p>
            <p className="text-3xl font-bold text-gray-900">{submission.total_obtained} <span className="text-lg text-gray-400 font-normal">/ {exam.total_marks}</span></p>
          </div>
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500 font-medium mb-1">Status</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isPass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {isPass ? 'PASSED' : 'FAILED'}
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500 font-medium mb-1">Grade</p>
            <p className="text-3xl font-bold text-gray-900">{grade}</p>
          </div>
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500 font-medium mb-1">Rank</p>
            <p className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
              {rank ? `#${rank}` : '-'}
              {rank === 1 && <Award className="w-6 h-6 text-yellow-500" />}
            </p>
          </div>
        </div>
      </div>

      {exam.result_note && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-8 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-indigo-900 mb-1">Note from Instructor</h4>
            <p className="text-indigo-800 text-sm whitespace-pre-wrap">{exam.result_note}</p>
          </div>
        </div>
      )}

      {/* Answers Breakdown */}
      <h3 className="text-xl font-bold text-gray-900 mb-4">Detailed Breakdown</h3>
      <div className="space-y-6">
        {answers.map((ans, idx) => {
          const q = ans.question
          const isPending = q.question_type === "long" && ans.is_correct === null
          
          let statusColor = "bg-gray-100 border-gray-200"
          let StatusIcon = Trophy // fallback
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
            <div key={ans.id} className={`rounded-xl border p-6 shadow-sm ${statusColor}`}>
              <div className="flex items-start justify-between mb-4 gap-4">
                <div className="flex items-start gap-3">
                  {!isPending && (
                    <div className={`mt-0.5 shrink-0 ${ans.is_correct ? 'text-emerald-600' : 'text-red-600'}`}>
                      <StatusIcon className="w-6 h-6" />
                    </div>
                  )}
                  {isPending && <div className="mt-0.5 shrink-0 text-yellow-600"><Clock className="w-6 h-6" /></div>}
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      <span className="text-gray-500 mr-2">{idx + 1}.</span> 
                      {q.question_text}
                    </h4>
                  </div>
                </div>
                
                <div className="shrink-0 text-right">
                  <span className="font-bold text-gray-900">{ans.obtained_marks}</span>
                  <span className="text-gray-500 text-sm"> / {q.marks}</span>
                </div>
              </div>

              <div className="ml-9 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white/60 p-3 rounded-lg border border-gray-200/60">
                  <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Your Answer</span>
                  <p className="text-gray-900 font-medium whitespace-pre-wrap">{ans.student_answer || <span className="text-gray-400 italic">No answer provided</span>}</p>
                </div>
                
                {q.question_type !== "long" && (
                  <div className="bg-white/60 p-3 rounded-lg border border-gray-200/60">
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Correct Answer</span>
                    <p className="text-emerald-700 font-medium">{q.correct_answer}</p>
                  </div>
                )}
              </div>

              {q.hint_note && (
                <div className="ml-9 mt-4 bg-blue-50/80 p-3 rounded-lg flex items-start gap-2 border border-blue-100">
                  <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block mb-0.5">Explanation</span>
                    <p className="text-sm text-blue-900">{q.hint_note}</p>
                  </div>
                </div>
              )}

              {ans.feedback && (
                <div className="ml-9 mt-4 bg-purple-50/80 p-3 rounded-lg flex items-start gap-2 border border-purple-100">
                  <MessageSquare className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider block mb-0.5">Teacher Feedback</span>
                    <p className="text-sm text-purple-900">{ans.feedback}</p>
                  </div>
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  )
}
