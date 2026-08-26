"use client"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Loader2, Save, Trophy } from "lucide-react"
import { getGrade } from "@/lib/utils"

interface Student { id: string; name: string; student_id: string }
interface Result { student_id: string; obtained_marks: string; grade: string }

export default function ExamResultsPage() {
  const params = useParams()
  const supabase = createClient()
  const [exam, setExam] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [results, setResults] = useState<Record<string, Result>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: ex } = await supabase.from("exams").select("*, batch:batches(name)").eq("id", params.id).single()
      setExam(ex)
      if (ex?.batch_id) {
        const { data: enrollments } = await supabase.from("enrollments").select("student:students(id, name, student_id)").eq("batch_id", ex.batch_id).eq("status", "active")
        setStudents((enrollments || []).map((e: any) => e.student).filter(Boolean))
      }
      const { data: existing } = await supabase.from("exam_results").select("*").eq("exam_id", params.id)
      const map: Record<string, Result> = {}
      for (const r of existing || []) {
        map[r.student_id] = { student_id: r.student_id, obtained_marks: String(r.obtained_marks ?? ""), grade: r.grade || "" }
      }
      setResults(map)
      setFetching(false)
    }
    load()
  }, [params.id, supabase])

  function updateMark(studentId: string, marks: string) {
    const numMarks = parseFloat(marks)
    const grade = !isNaN(numMarks) && exam ? getGrade(numMarks, exam.total_marks) : ""
    setResults(r => ({ ...r, [studentId]: { student_id: studentId, obtained_marks: marks, grade } }))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const items = Object.values(results).filter(r => r.obtained_marks !== "").map(r => ({
        exam_id: params.id as string, student_id: r.student_id,
        obtained_marks: parseFloat(r.obtained_marks), grade: r.grade,
      }))
      if (items.length === 0) { toast.error("No marks entered"); return }

      const sorted = [...items].sort((a, b) => b.obtained_marks - a.obtained_marks)
      sorted.forEach((item, i) => { (item as any).rank = i + 1 })

      const { error } = await supabase.from("exam_results").upsert(sorted, { onConflict: "exam_id,student_id" })
      if (error) throw error
      toast.success(`Results saved for ${items.length} students!`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  if (fetching) return <div className="flex items-center justify-center h-64 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
  if (!exam) return <div className="text-center py-12 text-gray-400">Exam not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-6 h-6 text-purple-600" /> {exam.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{exam.batch?.name || "All batches"} | Total: {exam.total_marks} marks | Pass: {exam.pass_marks}</p>
        </div>
        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Results</>}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marks (/{exam.total_marks})</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Grade</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((s, i) => {
              const r = results[s.id]
              const marks = r?.obtained_marks ? parseFloat(r.obtained_marks) : null
              const passed = marks !== null && marks >= exam.pass_marks
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.student_id}</td>
                  <td className="px-4 py-3"><input type="number" min="0" max={exam.total_marks} value={r?.obtained_marks || ""} onChange={e => updateMark(s.id, e.target.value)} className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="-" /></td>
                  <td className="px-4 py-3">{r?.grade && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">{r.grade}</span>}</td>
                  <td className="px-4 py-3">{marks !== null && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{passed ? "Pass" : "Fail"}</span>}</td>
                </tr>
              )
            })}
            {students.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400">No students enrolled in this batch</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}