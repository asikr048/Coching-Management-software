"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react"

export default function StudentExamPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  
  const [student, setStudent] = useState<any>(null)

  useEffect(() => {
    async function loadExam() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }

        const { data: studentData, error: sErr } = await supabase
          .from("students")
          .select("id, batch_id, enrollments(batch_id)")
          .eq("auth_id", user.id)
          .single()
        if (sErr || !studentData) throw new Error("Student profile not found")
        setStudent(studentData)

        // Fetch Exam
        const { data: examData, error: eErr } = await supabase.from("exams").select("*").eq("id", examId).single()
        if (eErr || !examData) throw new Error("Exam not found")
        
        // Multi-batch check
        const examBatches: string[] = []
        if (examData.batch_id) examBatches.push(examData.batch_id)
        if (Array.isArray(examData.batch_ids)) {
          examData.batch_ids.forEach((id: string) => {
            if (id && !examBatches.includes(id)) examBatches.push(id)
          })
        }

        if (examBatches.length > 0) {
          const studentBatches: string[] = []
          if (studentData.batch_id) studentBatches.push(studentData.batch_id)
          if (Array.isArray(studentData.enrollments)) {
            studentData.enrollments.forEach((e: any) => {
              if (e.batch_id && !studentBatches.includes(e.batch_id)) studentBatches.push(e.batch_id)
            })
          }

          const hasAccess = studentBatches.some(bId => examBatches.includes(bId))
          if (!hasAccess) {
            throw new Error("You are not enrolled in the batch for this exam")
          }
        }

        // Check if already submitted
        const { data: submission } = await supabase.from("exam_submissions")
          .select("id, is_submitted")
          .eq("exam_id", examId)
          .eq("student_id", studentData.id)
          .maybeSingle()

        if (submission?.is_submitted) {
          toast.info("You have already submitted this exam")
          router.push(`/student/exam/${examId}/results`)
          return
        }

        setExam(examData)

        // Fetch Questions
        const { data: qData, error: qErr } = await supabase.from("exam_questions")
          .select("*")
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true })
        if (qErr) throw qErr
        
        setQuestions(qData || [])

        if (examData.time_limit_minutes) {
          setTimeLeft(examData.time_limit_minutes * 60)
        }

      } catch (err: any) {
        toast.error(err.message)
        router.push("/student/dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadExam()
  }, [examId, router, supabase])

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitting) return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer)
          handleSubmit(true)
          return 0
        }
        return prev ? prev - 1 : 0
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, submitting]) // added dependencies

  async function handleSubmit(autoSubmit = false) {
    if (!student || !exam) return
    if (!autoSubmit && !window.confirm("Are you sure you want to submit? You cannot change your answers later.")) return
    
    setSubmitting(true)
    try {
      // Auto-grade
      let totalObtained = 0
      
      const answerInserts = questions.map(q => {
        const studentAns = answers[q.id] || ""
        let isCorrect = false
        let obtainedMarks = 0

        if (q.question_type === "mcq") {
          isCorrect = studentAns === q.correct_answer
          if (isCorrect) obtainedMarks = q.marks
        } else if (q.question_type === "short") {
          isCorrect = studentAns.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase()
          if (isCorrect) obtainedMarks = q.marks
        }
        // Long answers are manually graded, obtained_marks = 0 initially

        totalObtained += obtainedMarks

        return {
          question_id: q.id,
          student_answer: studentAns,
          is_correct: q.question_type === "long" ? null : isCorrect,
          obtained_marks: obtainedMarks
        }
      })

      // Insert Submission
      const { data: subData, error: subErr } = await supabase.from("exam_submissions").insert({
        exam_id: exam.id,
        student_id: student.id,
        is_submitted: true,
        total_obtained: totalObtained,
        auto_graded: true,
        submitted_at: new Date().toISOString()
      }).select("id").single()

      if (subErr) throw subErr

      // Insert Answers
      const answersWithSubId = answerInserts.map(a => ({ ...a, submission_id: subData.id }))
      const { error: ansErr } = await supabase.from("exam_answers").insert(answersWithSubId)
      if (ansErr) throw ansErr

      toast.success("Exam submitted successfully!")
      
      if (exam.show_results_immediately) {
        router.push(`/student/exam/${examId}/results`)
      } else {
        router.push("/student/dashboard")
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to submit exam")
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
  }

  if (!exam) return null

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="bg-indigo-600 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            <p className="text-indigo-100 mt-1">{exam.subject || "General"} • Total Marks: {exam.total_marks}</p>
          </div>
          
          {timeLeft !== null && (
            <div className="flex items-center gap-2 bg-indigo-700/50 px-4 py-2 rounded-lg shrink-0">
              <Clock className="w-5 h-5 text-indigo-100" />
              <span className="text-2xl font-mono font-bold tracking-wider">
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-800">
            Read all questions carefully. Once you submit, you cannot change your answers. 
            {exam.time_limit_minutes && " The exam will auto-submit when the timer runs out."}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">
                <span className="text-indigo-600 mr-2">{idx + 1}.</span> 
                {q.question_text}
              </h3>
              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md shrink-0">
                {q.marks} Marks
              </span>
            </div>

            <div className="mt-4">
              {q.question_type === "mcq" && (
                <div className="space-y-3">
                  {q.options?.map((opt: string, i: number) => (
                    <label key={i} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input 
                        type="radio" 
                        name={`q_${q.id}`} 
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-gray-800">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === "short" && (
                <input 
                  type="text" 
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}

              {q.question_type === "long" && (
                <textarea 
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  rows={5}
                  placeholder="Type your detailed answer here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end pb-12">
        <button 
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium text-lg transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Submit Exam
        </button>
      </div>
    </div>
  )
}
