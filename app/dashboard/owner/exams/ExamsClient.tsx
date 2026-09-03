"use client"
import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, FileText, Trophy, Clock, CheckCircle, GripVertical, Trash2, Edit2, PlayCircle, Eye, Globe } from "lucide-react"
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
        result_note: form.result_note,
        is_published: false
      }

      const { data: newExam, error: examErr } = await supabase.from("exams")
        .insert(examData).select("*, batch:batches(name)").single()
      
      if (examErr) throw examErr

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
      setForm({ title: "", batch_id: "", exam_type: "written", subject: "", total_marks: "100", pass_marks: "33", exam_date: "", duration_minutes: "60", show_results_immediately: true, result_note: "" })
    } catch (err: any) { 
      toast.error(err.message || "Failed") 
    } finally { 
      setLoading(false) 
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-gray-100 rounded-lg">
            {["all", "published", "draft", "online"].map(t => (
              <button key={t} onClick={() => setStatusFilter(t as any)} className={cn("px-4 py-1.5 text-sm font-medium rounded-md capitalize", statusFilter === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
                {t}
              </button>
            ))}
          </div>
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className={inputClass + " w-48"}>
            <option value="all">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Exam
        </button>
      </div>

      {/* Exam Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExams.map(exam => (
          <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", exam.is_online ? "bg-blue-50" : "bg-purple-50")}>
                  {exam.is_online ? <Globe className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-purple-600" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{exam.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{exam.batch?.name || "All Batches"} • {exam.subject || "No Subject"}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", exam.is_published ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")}>
                  {exam.is_published ? "Published" : "Draft"}
                </span>
                {exam.is_online && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">ONLINE</span>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-3 mb-4 bg-gray-50 p-3 rounded-lg flex-grow">
              <div className="flex flex-col"><span className="text-xs text-gray-400">Total Marks</span><span className="font-medium text-gray-900">{exam.total_marks}</span></div>
              <div className="flex flex-col"><span className="text-xs text-gray-400">Date</span><span className="font-medium text-gray-900">{exam.exam_date ? formatDate(exam.exam_date) : "TBD"}</span></div>
              {exam.is_online && (
                <>
                  <div className="flex flex-col"><span className="text-xs text-gray-400">Duration</span><span className="font-medium text-gray-900">{exam.time_limit_minutes} min</span></div>
                  <div className="flex flex-col"><span className="text-xs text-gray-400">Questions</span><span className="font-medium text-gray-900">{exam.exam_questions?.[0]?.count || 0}</span></div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
              {exam.is_online ? (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  {!exam.is_published && (
                    <button onClick={() => handlePublish(exam.id)} disabled={publishing === exam.id} className="flex-1 flex justify-center items-center gap-1.5 text-sm py-1.5 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium">
                      {publishing === exam.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />} Publish
                    </button>
                  )}
                  <Link href={`/dashboard/owner/exams/${exam.id}/questions`} className="flex-1 flex justify-center items-center gap-1.5 text-sm py-1.5 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
                    <Eye className="w-3.5 h-3.5" /> Questions
                  </Link>
                </div>
              ) : (
                <Link href={`/dashboard/owner/exams/${exam.id}`} className="w-full flex justify-center items-center gap-2 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
                  <Trophy className="w-4 h-4" /> Enter Results
                </Link>
              )}
            </div>
          </div>
        ))}
        {filteredExams.length === 0 && <div className="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">No exams match your filters.</div>}
      </div>

      {/* Analytics Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Analytics</h3>
        <p className="text-sm text-gray-500">Analytics overview will appear here once more results are recorded.</p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg"><p className="text-sm text-gray-500">Total Exams</p><p className="text-2xl font-bold text-gray-900">{exams.length}</p></div>
          <div className="bg-gray-50 p-4 rounded-lg"><p className="text-sm text-gray-500">Published</p><p className="text-2xl font-bold text-emerald-600">{exams.filter(e=>e.is_published).length}</p></div>
          <div className="bg-gray-50 p-4 rounded-lg"><p className="text-sm text-gray-500">Online Exams</p><p className="text-2xl font-bold text-blue-600">{exams.filter(e=>e.is_online).length}</p></div>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Create New Exam</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit mb-6">
                <button onClick={() => setExamMode("offline")} className={cn("px-4 py-2 text-sm font-medium rounded-md", examMode === "offline" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600")}>Offline Exam</button>
                <button onClick={() => setExamMode("online")} className={cn("px-4 py-2 text-sm font-medium rounded-md", examMode === "online" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600")}>Online Exam</button>
              </div>

              <form id="examForm" onSubmit={handleCreate} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Exam Title *</label><input required value={form.title} onChange={e => update("title", e.target.value)} className={inputClass} placeholder="e.g., Monthly Test - Physics" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Batch</label><select value={form.batch_id} onChange={e => update("batch_id", e.target.value)} className={inputClass}><option value="">All Batches</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input value={form.subject} onChange={e => update("subject", e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label><input type="date" value={form.exam_date} onChange={e => update("exam_date", e.target.value)} className={inputClass} /></div>
                  
                  {examMode === "offline" && <div><label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label><input type="number" required value={form.total_marks} onChange={e => update("total_marks", e.target.value)} className={inputClass} /></div>}
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Pass Marks</label><input type="number" required value={form.pass_marks} onChange={e => update("pass_marks", e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label><input type="number" required value={form.duration_minutes} onChange={e => update("duration_minutes", e.target.value)} className={inputClass} /></div>
                  
                  {examMode === "online" && (
                    <div className="col-span-1 md:col-span-2">
                      <label className="flex items-center gap-2 text-sm text-gray-900 cursor-pointer">
                        <input type="checkbox" checked={form.show_results_immediately} onChange={e => update("show_results_immediately", e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                        Show results immediately to students after submission
                      </label>
                    </div>
                  )}
                </div>

                {/* Question Builder */}
                {examMode === "online" && (
                  <div className="mt-8 border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-gray-900">Question Builder</h4>
                      <div className="text-sm font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">Total Marks: {computedTotal}</div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                      {/* Left: Add Form */}
                      <div className="lg:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h5 className="font-semibold text-gray-800 mb-4">{editingQuestion ? "Edit Question" : "Add Question"}</h5>
                        <div className="space-y-4">
                          <div><label className="block text-xs font-medium text-gray-700 mb-1">Question Type</label><select value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value as QuestionType})} className={inputClass}><option value="mcq">Multiple Choice</option><option value="short">Short Answer (Auto-graded)</option><option value="long">Long Answer (Manual)</option></select></div>
                          <div><label className="block text-xs font-medium text-gray-700 mb-1">Question Text</label><textarea value={qForm.text} onChange={e => setQForm({...qForm, text: e.target.value})} className={inputClass} rows={3} placeholder="Enter question..." /></div>
                          
                          {qForm.type === "mcq" && (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-700">Options & Correct Answer</label>
                              {[1,2,3,4].map(num => (
                                <div key={num} className="flex items-center gap-2">
                                  <input type="radio" name="correctOpt" checked={qForm.correctOption === (num-1).toString()} onChange={() => setQForm({...qForm, correctOption: (num-1).toString()})} className="text-indigo-600" />
                                  <input value={(qForm as any)[`opt${num}`]} onChange={e => setQForm({...qForm, [`opt${num}`]: e.target.value})} placeholder={`Option ${num}`} className={cn(inputClass, "py-1.5 text-sm")} />
                                </div>
                              ))}
                            </div>
                          )}

                          {qForm.type === "short" && (
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">Expected Answer (Case Insensitive)</label><input value={qForm.expectedAnswer} onChange={e => setQForm({...qForm, expectedAnswer: e.target.value})} className={inputClass} placeholder="e.g. Paris" /></div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">Marks</label><input type="number" value={qForm.marks} onChange={e => setQForm({...qForm, marks: e.target.value})} className={inputClass} min="1" /></div>
                          </div>
                          <div><label className="block text-xs font-medium text-gray-700 mb-1">Hint / Note (Optional)</label><input value={qForm.hint} onChange={e => setQForm({...qForm, hint: e.target.value})} className={inputClass} placeholder="Shown in results..." /></div>
                          
                          <button type="button" onClick={addQuestion} className="w-full py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200">
                            {editingQuestion ? "Update Question" : "Add Question"}
                          </button>
                        </div>
                      </div>

                      {/* Right: Question List */}
                      <div className="lg:col-span-3 space-y-3">
                        {questions.length === 0 ? (
                          <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
                            No questions added yet.<br/>Use the form to add questions to this exam.
                          </div>
                        ) : (
                          questions.map((q, idx) => (
                            <div key={q.id} className="bg-white border border-gray-200 p-4 rounded-xl flex gap-3 group relative hover:border-indigo-300">
                              <div className="mt-1 cursor-grab text-gray-400"><GripVertical className="w-5 h-5" /></div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <h6 className="font-medium text-gray-900 text-sm">Q{idx + 1}. {q.question_text}</h6>
                                  <span className="shrink-0 ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">{q.marks} Marks</span>
                                </div>
                                {q.question_type === "mcq" && (
                                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                                    {q.options?.map((opt, i) => (
                                      <div key={i} className={cn("text-xs px-2 py-1 rounded border", q.correct_answer === opt ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-gray-50 border-gray-100 text-gray-600")}>
                                        {String.fromCharCode(65+i)}. {opt}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {q.question_type === "short" && <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">Expected: <strong>{q.correct_answer}</strong></div>}
                                {q.hint_note && <div className="text-xs text-indigo-600 mt-2 bg-indigo-50 p-1.5 rounded inline-block">Hint: {q.hint_note}</div>}
                              </div>
                              <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => editQ(q)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                <button type="button" onClick={() => removeQ(q.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
            
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white">Cancel</button>
              <button form="examForm" type="submit" disabled={loading || (examMode === "online" && questions.length === 0)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
