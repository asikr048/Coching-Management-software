"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, FileText, Trophy } from "lucide-react"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

interface ExamRow { id: string; title: string; exam_type: string; subject?: string; total_marks: number; exam_date?: string; is_published: boolean; batch?: { name: string } }
interface BatchOpt { id: string; name: string }

export default function ExamsClient({ exams: initial, batches }: { exams: ExamRow[]; batches: BatchOpt[] }) {
  const [exams, setExams] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const [form, setForm] = useState({ title: "", batch_id: "", exam_type: "written", subject: "", total_marks: "100", pass_marks: "33", exam_date: "", duration_minutes: "60" })
  function update(f: string, v: string) { setForm(x => ({ ...x, [f]: v })) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const { data, error } = await supabase.from("exams").insert({
        title: form.title, batch_id: form.batch_id || null, exam_type: form.exam_type,
        subject: form.subject || null, total_marks: parseInt(form.total_marks), pass_marks: parseInt(form.pass_marks),
        exam_date: form.exam_date || null, duration_minutes: parseInt(form.duration_minutes),
      }).select("*, batch:batches(name)").single()
      if (error) throw error
      setExams([data, ...exams]); setShowModal(false); toast.success("Exam created!")
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"><Plus className="w-4 h-4" /> Create Exam</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2"><div className="p-2 bg-purple-50 rounded-lg"><FileText className="w-4 h-4 text-purple-600" /></div><div><p className="font-semibold text-gray-800 text-sm">{exam.title}</p><p className="text-xs text-gray-500">{exam.batch?.name || "All"} • {exam.subject || ""}</p></div></div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${exam.is_published ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>{exam.is_published ? "Published" : "Draft"}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
              <span>Marks: {exam.total_marks} • {exam.exam_type}</span>
              <span>{exam.exam_date ? formatDate(exam.exam_date) : "TBD"}</span>
            </div>
            <Link href={`/dashboard/owner/exams/${exam.id}`} className="mt-3 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"><Trophy className="w-3.5 h-3.5" /> Enter Results</Link>
          </div>
        ))}
        {exams.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No exams created yet.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold">Create Exam</h3><button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Exam Title *</label><input required value={form.title} onChange={e => update("title", e.target.value)} className={inputClass} placeholder="e.g., Monthly Test - Physics" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Batch</label><select value={form.batch_id} onChange={e => update("batch_id", e.target.value)} className={inputClass}><option value="">All Batches</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={form.exam_type} onChange={e => update("exam_type", e.target.value)} className={inputClass}><option value="written">Written</option><option value="mcq">MCQ</option><option value="mixed">Mixed</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input value={form.subject} onChange={e => update("subject", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label><input type="number" value={form.total_marks} onChange={e => update("total_marks", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Pass Marks</label><input type="number" value={form.pass_marks} onChange={e => update("pass_marks", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label><input type="date" value={form.exam_date} onChange={e => update("exam_date", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label><input type="number" value={form.duration_minutes} onChange={e => update("duration_minutes", e.target.value)} className={inputClass} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">{loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Exam"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
