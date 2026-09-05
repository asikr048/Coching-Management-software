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
      <div><h2 className="text-2xl font-black text-white tracking-tight">Mark Attendance</h2><p className="text-sm text-slate-400 mt-1">{today}</p></div>
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl p-5">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Batch</label>
        <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} className="w-full max-w-xs px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10">
          <option value="" className="bg-slate-950 text-white">-- Select Batch --</option>
          {batches.map(b => <option key={b.id} value={b.id} className="bg-slate-950 text-white">{b.name}</option>)}
        </select>
      </div>
      {selectedBatch && students.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-950/80 border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800/60">
                {students.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-bold text-white">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{s.student_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {["present", "absent", "late", "excused"].map(st => (
                          <button key={st} onClick={() => setAttendance(a => ({ ...a, [s.id]: st }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${attendance[s.id] === st
                              ? (st === "present" ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20" : st === "absent" ? "bg-rose-500 text-white font-black shadow-md shadow-rose-500/20" : st === "late" ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20" : "bg-blue-500 text-white font-black shadow-md shadow-blue-500/20")
                              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`}>{st}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-sm text-slate-400">{students.length} students • Present: <span className="text-emerald-400 font-bold">{Object.values(attendance).filter(v => v === "present").length}</span> • Absent: <span className="text-rose-400 font-bold">{Object.values(attendance).filter(v => v === "absent").length}</span></p>
            <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><UserCheck className="w-4 h-4" /> Save Attendance</>}
            </button>
          </div>
        </div>
      )}
      {selectedBatch && students.length === 0 && <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-8 text-center text-slate-400">No students enrolled in this batch.</div>}
    </div>
  )
}
