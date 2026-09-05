"use client"
import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, FileText, Trophy, Clock, CheckCircle, GripVertical, Trash2, Edit2, PlayCircle, Eye, Globe, MessageSquare } from "lucide-react"
import { formatDate, cn } from "@/lib/utils"
import Link from "next/link"

interface ExamRow { 
  id: string; 
  title: string; 
  exam_type: string; 
  subject?: string; 
  total_marks: number; 
  exam_date?: string; 
  is_published: boolean; 
  is_online?: boolean;
  time_limit_minutes?: number;
  batch?: { name: string };
  batch_id?: string;
  exam_questions?: { count: number }[];
}

interface BatchOpt { id: string; name: string }

type QuestionType = "mcq" | "short" | "long"

interface DraftQuestion {
  id: string; // temp id for drag/drop
  question_type: QuestionType;
  question_text: string;
  options?: string[]; // for mcq
  correct_answer?: string; // for mcq / short
  marks: number;
  hint_note?: string;
  sort_order: number;
}

export default function ExamsClient({ exams: initial, batches }: { exams: ExamRow[]; batches: BatchOpt[] }) {
  const [exams, setExams] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "online">("all")
  const [batchFilter, setBatchFilter] = useState<string>("all")
  
  // Modal State
  const [examMode, setExamMode] = useState<"offline" | "online">("offline")
  
  // Form State
  const [form, setForm] = useState({ 
    title: "", 
    batch_id: "", 
    exam_type: "written", 
    subject: "", 
    total_marks: "100", 
    pass_marks: "33", 
    exam_date: "", 
    duration_minutes: "60",
    show_results_immediately: true,
    show_all_results: true,
    result_note: ""
  })
  function update(f: string, v: string | boolean) { setForm(x => ({ ...x, [f]: v })) }
  
  const supabase = createClient()

  // Online Questions State
  const [questions, setQuestions] = useState<DraftQuestion[]>([])
  const [editingQuestion, setEditingQuestion] = useState<DraftQuestion | null>(null)
  const [qForm, setQForm] = useState({
    type: "mcq" as QuestionType,
    text: "",
    opt1: "", opt2: "", opt3: "", opt4: "",
    correctOption: "0",
    expectedAnswer: "",
    marks: "5",
    hint: ""
  })

  // Filtered Exams
  const filteredExams = useMemo(() => {
    return exams.filter(ex => {
      if (batchFilter !== "all" && ex.batch_id !== batchFilter) return false
      if (statusFilter === "published" && !ex.is_published) return false
      if (statusFilter === "draft" && ex.is_published) return false
      if (statusFilter === "online" && !ex.is_online) return false
      return true
    })
  }, [exams, statusFilter, batchFilter])

  // Computed Total Marks for Online
  const computedTotal = questions.reduce((acc, q) => acc + q.marks, 0)

  function addQuestion() {
    if (!qForm.text) { toast.error("Question text required"); return }
    const newQ: DraftQuestion = {
      id: Math.random().toString(36).slice(2),
      question_type: qForm.type,
      question_text: qForm.text,
      marks: parseInt(qForm.marks) || 1,
      hint_note: qForm.hint,
      sort_order: questions.length
    }
    if (qForm.type === "mcq") {
      newQ.options = [qForm.opt1, qForm.opt2, qForm.opt3, qForm.opt4]
      newQ.correct_answer = newQ.options[parseInt(qForm.correctOption)]
    } else if (qForm.type === "short") {
      newQ.correct_answer = qForm.expectedAnswer
    }

    if (editingQuestion) {
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...newQ, sort_order: q.sort_order } : q))
      setEditingQuestion(null)
    } else {
      setQuestions([...questions, newQ])
    }
    
    // reset form
    setQForm({ type: "mcq", text: "", opt1: "", opt2: "", opt3: "", opt4: "", correctOption: "0", expectedAnswer: "", marks: "5", hint: "" })
  }

  function editQ(q: DraftQuestion) {
    setEditingQuestion(q)
    setQForm({
      type: q.question_type,
      text: q.question_text,
      opt1: q.options?.[0] || "",
      opt2: q.options?.[1] || "",
      opt3: q.options?.[2] || "",
      opt4: q.options?.[3] || "",
      correctOption: q.options ? q.options.indexOf(q.correct_answer || "").toString() : "0",
      expectedAnswer: q.question_type === "short" ? q.correct_answer || "" : "",
      marks: q.marks.toString(),
      hint: q.hint_note || ""
    })
  }

  function removeQ(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handlePublish(id: string) {
    setPublishing(id)
    try {
      const { error } = await supabase.from("exams").update({ is_published: true }).eq("id", id)
      if (error) throw error
      setExams(prev => prev.map(ex => ex.id === id ? { ...ex, is_published: true } : ex))
      toast.success("Exam published successfully!")
    } catch (err: any) {
      toast.error(err.message || "Failed to publish exam")
    } finally {
      setPublishing(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const examData = {
        title: form.title, 
        batch_id: form.batch_id || null, 
        exam_type: form.exam_type,
        subject: form.subject || null, 
        total_marks: examMode === "online" ? computedTotal : parseInt(form.total_marks), 
        pass_marks: parseInt(form.pass_marks),
        exam_date: form.exam_date || null, 
        is_online: examMode === "online",
        time_limit_minutes: examMode === "online" ? parseInt(form.duration_minutes) : null,
        duration_minutes: examMode === "offline" ? parseInt(form.duration_minutes) : null,
        show_results_immediately: form.show_results_immediately,
        show_all_results: form.show_all_results,
        result_note: (form.result_note ? form.result_note + " " : "") + `[SHOW_ALL_RESULTS:${form.show_all_results}]`,
        is_published: false
      }

      let newExam: any = null
      const { data: inserted, error: examErr } = await supabase.from("exams")
        .insert(examData).select("*, batch:batches(name)").single()
      
      if (examErr) {
        // If column show_all_results doesn't exist yet, retry without that specific column
        const { show_all_results: _omitted, ...fallbackData } = examData
        const { data: fbExam, error: fbErr } = await supabase.from("exams")
          .insert(fallbackData).select("*, batch:batches(name)").single()
        if (fbErr) throw fbErr
        newExam = fbExam
      } else {
        newExam = inserted
      }

      if (examMode === "online" && questions.length > 0) {
        const qInserts = questions.map((q, i) => ({
          exam_id: newExam.id,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.options || null,
          correct_answer: q.correct_answer || null,
          marks: q.marks,
          hint_note: q.hint_note || null,
          sort_order: i
        }))
        const { error: qErr } = await supabase.from("exam_questions").insert(qInserts)
        if (qErr) throw qErr
      }

      setExams([{ ...newExam, exam_questions: [{ count: questions.length }] }, ...exams])
      setShowModal(false)
      toast.success(examMode === "online" ? "Online exam created!" : "Exam created!")
      
      // Reset
      setQuestions([])
      setForm({ title: "", batch_id: "", exam_type: "written", subject: "", total_marks: "100", pass_marks: "33", exam_date: "", duration_minutes: "60", show_results_immediately: true, show_all_results: true, result_note: "" })
    } catch (err: any) { 
      toast.error(err.message || "Failed") 
    } finally { 
      setLoading(false) 
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 bg-slate-950 placeholder:text-slate-500 transition-all shadow-sm"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl">
            {["all", "published", "draft", "online"].map(t => (
              <button key={t} onClick={() => setStatusFilter(t as any)} className={cn("px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg capitalize transition-all", statusFilter === t ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs" : "text-slate-400 hover:text-white")}>
                {t}
              </button>
            ))}
          </div>
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={inputClass + " w-48 font-semibold"}>
            <option value="all" className="bg-slate-900 text-white">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>)}
          </select>
        </div>

        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all">
          <Plus className="w-4 h-4" /> Create Exam
        </button>
      </div>

      {/* Exam Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredExams.map(exam => (
          <div key={exam.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-500/40 p-5 shadow-xl transition-all flex flex-col h-full">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl border", exam.is_online ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                  {exam.is_online ? <Globe className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base leading-snug">{exam.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{exam.batch?.name || "All Batches"} • {exam.subject || "No Subject"}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold border", exam.is_published ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30")}>
                  {exam.is_published ? "Published" : "Draft"}
                </span>
                {exam.is_online && <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md font-extrabold">ONLINE</span>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm mt-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex-grow">
              <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-medium">Total Marks</span><span className="font-bold text-amber-400 text-sm">{exam.total_marks}</span></div>
              <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-medium">Date</span><span className="font-semibold text-slate-200 text-sm">{exam.exam_date ? formatDate(exam.exam_date) : "TBD"}</span></div>
              {exam.is_online && (
                <>
                  <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-medium">Duration</span><span className="font-semibold text-slate-200 text-sm">{exam.time_limit_minutes} min</span></div>
                  <div className="flex flex-col"><span className="text-[11px] text-slate-400 font-medium">Questions</span><span className="font-semibold text-slate-200 text-sm">{exam.exam_questions?.[0]?.count || 0}</span></div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 mt-auto">
              <div className="flex items-center gap-2 w-full">
                {exam.is_online ? (
                  <>
                    {!exam.is_published && (
                      <button onClick={() => handlePublish(exam.id)} disabled={publishing === exam.id} className="flex-1 flex justify-center items-center gap-1.5 text-xs sm:text-sm py-2 px-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 disabled:opacity-50 font-bold transition-colors">
                        {publishing === exam.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />} Publish
                      </button>
                    )}
                    <Link href={`/dashboard/owner/exams/${exam.id}/questions`} className="flex-1 flex justify-center items-center gap-1.5 text-xs sm:text-sm py-2 px-3 bg-slate-800 text-slate-200 hover:text-white rounded-xl hover:bg-slate-700 font-bold transition-colors border border-slate-700">
                      <Eye className="w-3.5 h-3.5" /> Questions
                    </Link>
                  </>
                ) : (
                  <Link href={`/dashboard/owner/exams/${exam.id}`} className="flex-1 flex justify-center items-center gap-2 py-2 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs sm:text-sm font-bold hover:bg-amber-500/25 transition-colors">
                    <Trophy className="w-4 h-4 text-amber-400" /> Enter Results
                  </Link>
                )}
              </div>
              <Link
                href={`/dashboard/owner/sms?exam_id=${exam.id}&mode=exam_result`}
                className="w-full flex justify-center items-center gap-1.5 py-2 px-3 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> Send Result SMS
              </Link>
            </div>
          </div>
        ))}
        {filteredExams.length === 0 && <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 shadow-xl">No exams match your filters.</div>}
      </div>

      {/* Analytics Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 text-white shadow-xl">
        <h3 className="text-lg font-extrabold text-slate-900 mb-1">Exam Analytics</h3>
        <p className="text-xs text-amber-400/90 font-medium">Performance summary and publication status</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-400 font-medium">Total Exams</p><p className="text-2xl font-extrabold text-white mt-1">{exams.length}</p></div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-400 font-medium">Published</p><p className="text-2xl font-extrabold text-emerald-400 mt-1">{exams.filter(e=>e.is_published).length}</p></div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-200"><p className="text-xs text-slate-400 font-medium">Online Exams</p><p className="text-2xl font-extrabold text-blue-400 mt-1">{exams.filter(e=>e.is_online).length}</p></div>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh] border border-slate-200 text-white">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0 bg-slate-50">
              <h3 className="text-lg font-extrabold text-slate-900">Create New Exam</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex gap-2 p-1 bg-white border border-slate-300 rounded-xl w-fit mb-6">
                <button onClick={() => setExamMode("offline")} className={cn("px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all", examMode === "offline" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs" : "text-slate-400 hover:text-white")}>Offline Exam</button>
                <button onClick={() => setExamMode("online")} className={cn("px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all", examMode === "online" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs" : "text-slate-400 hover:text-white")}>Online Exam</button>
              </div>

              <form id="examForm" onSubmit={handleCreate} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Exam Title *</label><input required value={form.title} onChange={e => update("title", e.target.value)} className={inputClass} placeholder="e.g., Monthly Test - Physics" /></div>
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Batch</label><select value={form.batch_id} onChange={e => update("batch_id", e.target.value)} className={inputClass}><option value="" className="bg-slate-900 text-white">All Batches</option>{batches.map(b => <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>)}</select></div>
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Subject</label><input value={form.subject} onChange={e => update("subject", e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Exam Date</label><input type="date" value={form.exam_date} onChange={e => update("exam_date", e.target.value)} className={inputClass} /></div>
                  
                  {examMode === "offline" && <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Total Marks</label><input type="number" required value={form.total_marks} onChange={e => update("total_marks", e.target.value)} className={inputClass} /></div>}
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Pass Marks</label><input type="number" required value={form.pass_marks} onChange={e => update("pass_marks", e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-xs font-bold text-slate-300 mb-1.5">Duration (minutes)</label><input type="number" required value={form.duration_minutes} onChange={e => update("duration_minutes", e.target.value)} className={inputClass} /></div>
                  
                  {examMode === "online" && (
                    <div className="col-span-1 md:col-span-2">
                      <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                        <input type="checkbox" checked={form.show_results_immediately} onChange={e => update("show_results_immediately", e.target.checked)} className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-950 focus:ring-amber-400" />
                        Show results immediately to students after submission
                      </label>
                    </div>
                  )}

                  {/* Batch Marks Visibility Option */}
                  <div className="col-span-1 md:col-span-2 bg-slate-950 p-3.5 rounded-xl border border-slate-200">
                    <label className="flex items-start gap-3 text-sm text-slate-200 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={form.show_all_results} 
                        onChange={e => update("show_all_results", e.target.checked)} 
                        className="w-4 h-4 mt-0.5 text-amber-500 rounded border-slate-700 bg-slate-950 focus:ring-amber-400 cursor-pointer" 
                      />
                      <div>
                        <span className="font-bold text-slate-900">Show marks & merit list to all students in batch (Default)</span>
                        <p className="text-xs text-slate-400 mt-0.5">
                          When checked, all students in this batch can view everyone&apos;s marks. If deselected, each student will only see their own marks privately.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Question Builder */}
                {examMode === "online" && (
                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-bold text-slate-900">Question Builder</h4>
                      <div className="text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full">Total Marks: {computedTotal}</div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* Left: Add Form */}
                      <div className="lg:col-span-2 bg-slate-950 p-4 rounded-xl border border-slate-200">
                        <h5 className="font-bold text-white text-sm mb-4">{editingQuestion ? "Edit Question" : "Add Question"}</h5>
                        <div className="space-y-4">
                          <div><label className="block text-xs font-bold text-slate-300 mb-1">Question Type</label><select value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value as QuestionType})} className={inputClass}><option value="mcq" className="bg-slate-900 text-white">Multiple Choice</option><option value="short" className="bg-slate-900 text-white">Short Answer (Auto-graded)</option><option value="long" className="bg-slate-900 text-white">Long Answer (Manual)</option></select></div>
                          <div><label className="block text-xs font-bold text-slate-300 mb-1">Question Text</label><textarea value={qForm.text} onChange={e => setQForm({...qForm, text: e.target.value})} className={inputClass} rows={3} placeholder="Enter question..." /></div>
                          
                          {qForm.type === "mcq" && (
                            <div className="space-y-2">
                              <label className="block text-xs font-bold text-slate-300">Options & Correct Answer</label>
                              {[1,2,3,4].map(num => (
                                <div key={num} className="flex items-center gap-2">
                                  <input type="radio" name="correctOpt" checked={qForm.correctOption === (num-1).toString()} onChange={() => setQForm({...qForm, correctOption: (num-1).toString()})} className="text-amber-500" />
                                  <input value={(qForm as any)[`opt${num}`]} onChange={e => setQForm({...qForm, [`opt${num}`]: e.target.value})} placeholder={`Option ${num}`} className={cn(inputClass, "py-1.5 text-sm")} />
                                </div>
                              ))}
                            </div>
                          )}

                          {qForm.type === "short" && (
                            <div><label className="block text-xs font-bold text-slate-300 mb-1">Expected Answer (Case Insensitive)</label><input value={qForm.expectedAnswer} onChange={e => setQForm({...qForm, expectedAnswer: e.target.value})} className={inputClass} placeholder="e.g. Paris" /></div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs font-bold text-slate-300 mb-1">Marks</label><input type="number" value={qForm.marks} onChange={e => setQForm({...qForm, marks: e.target.value})} className={inputClass} min="1" /></div>
                          </div>
                          <div><label className="block text-xs font-bold text-slate-300 mb-1">Hint / Note (Optional)</label><input value={qForm.hint} onChange={e => setQForm({...qForm, hint: e.target.value})} className={inputClass} placeholder="Shown in results..." /></div>
                          
                          <button type="button" onClick={addQuestion} className="w-full py-2 bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold rounded-xl hover:bg-amber-500/25 transition-all">
                            {editingQuestion ? "Update Question" : "Add Question"}
                          </button>
                        </div>
                      </div>

                      {/* Right: Question List */}
                      <div className="lg:col-span-3 space-y-3">
                        {questions.length === 0 ? (
                          <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500">
                            No questions added yet.<br/>Use the form to add questions to this exam.
                          </div>
                        ) : (
                          questions.map((q, idx) => (
                            <div key={q.id} className="bg-white border border-slate-300 p-4 rounded-xl flex gap-3 group relative hover:border-amber-500/40">
                              <div className="mt-1 cursor-grab text-slate-500"><GripVertical className="w-5 h-5" /></div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <h6 className="font-bold text-white text-sm">Q{idx + 1}. {q.question_text}</h6>
                                  <span className="shrink-0 ml-2 px-2 py-0.5 bg-slate-900 text-amber-300 border border-slate-200 rounded text-xs font-mono">{q.marks} Marks</span>
                                </div>
                                {q.question_type === "mcq" && (
                                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                                    {q.options?.map((opt, i) => (
                                      <div key={i} className={cn("text-xs px-2.5 py-1.5 rounded-lg border", q.correct_answer === opt ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold" : "bg-slate-900 border-slate-200 text-slate-300")}>
                                        {String.fromCharCode(65+i)}. {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {q.question_type === "short" && <div className="text-xs text-slate-300 mt-1 bg-slate-900 p-2 rounded-lg border border-slate-200">Expected: <strong className="text-amber-300">{q.correct_answer}</strong></div>}
                                {q.hint_note && <div className="text-xs text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-lg inline-block">Hint: {q.hint_note}</div>}
                              </div>
                              <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => editQ(q)} className="p-1.5 text-blue-400 hover:bg-slate-800 rounded"><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => removeQ(q.id)} className="p-1.5 text-red-400 hover:bg-slate-800 rounded"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
            
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50 rounded-b-3xl shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 hover:text-white transition-colors">Cancel</button>
              <button form="examForm" type="submit" disabled={loading || (examMode === "online" && questions.length === 0)} className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
