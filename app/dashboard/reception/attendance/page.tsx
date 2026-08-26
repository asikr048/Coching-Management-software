"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { UserCheck, Loader2 } from "lucide-react"

export default function AttendancePage() {
  const supabase = createClient()
  const [batches, setBatches] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState("")
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    supabase.from("batches").select("id, name").eq("is_active", true).then(({ data }) => setBatches(data || []))
  }, [supabase])

  useEffect(() => {
    if (!selectedBatch) return
    async function load() {
      const { data: enrollments } = await supabase.from("enrollments").select("student:students(id, name, student_id)").eq("batch_id", selectedBatch).eq("status", "active")
      const studs = (enrollments || []).map((e: any) => e.student).filter(Boolean)
      setStudents(studs)

      const { data: existing } = await supabase.from("attendance").select("student_id, status").eq("batch_id", selectedBatch).eq("date", today)
      const map: Record<string, string> = {}
      for (const a of existing || []) map[a.student_id] = a.status
      for (const s of studs) if (!map[s.id]) map[s.id] = "present"
      setAttendance(map)
    }
    load()
  }, [selectedBatch, supabase, today])

  async function handleSave() {
    setLoading(true)
    try {
      const items = students.map(s => ({
        student_id: s.id, batch_id: selectedBatch, date: today, status: attendance[s.id] || "present", entry_method: "manual" as const,
      }))
      const { error } = await supabase.from("attendance").upsert(items, { onConflict: "student_id,batch_id,date" })
      if (error) throw error
      toast.success("Attendance saved!")
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Mark Attendance</h2><p className="text-sm text-gray-500 mt-1">{today}</p></div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch</label>
        <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">-- Select Batch --</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {selectedBatch && students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s, i) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.student_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {["present", "absent", "late", "excused"].map(st => (
                        <button key={st} onClick={() => setAttendance(a => ({ ...a, [s.id]: st }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${attendance[s.id] === st
                            ? (st === "present" ? "bg-emerald-500 text-white" : st === "absent" ? "bg-red-500 text-white" : st === "late" ? "bg-yellow-500 text-white" : "bg-blue-500 text-white")
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{st}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <p className="text-sm text-gray-500">{students.length} students • Present: {Object.values(attendance).filter(v => v === "present").length} • Absent: {Object.values(attendance).filter(v => v === "absent").length}</p>
            <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-400">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><UserCheck className="w-4 h-4" /> Save Attendance</>}
            </button>
          </div>
        </div>
      )}
      {selectedBatch && students.length === 0 && <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No students enrolled in this batch.</div>}
    </div>
  )
}
