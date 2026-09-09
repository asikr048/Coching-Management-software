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

  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    supabase.from("batches").select("id, name").eq("is_active", true).then(({ data }) => setBatches(data || []))
  }, [supabase])

  useEffect(() => {
    if (!selectedBatch) return
    async function load() {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("roll_no, enrollment_date, created_at, student:students(id, name, student_id, roll_no, batch_roll)")
        .eq("batch_id", selectedBatch)
        .eq("status", "active")
        .order("roll_no", { ascending: true, nullsFirst: false })

      // Deduplicate and resolve sequential roll numbers starting from 1
      const rawStuds: any[] = (enrollments || []).map((e: any, idx: number) => {
        if (!e.student) return null
        const assignedRoll = e.roll_no != null && Number(e.roll_no) > 0 
          ? Number(e.roll_no) 
          : (e.student.roll_no || e.student.batch_roll || idx + 1)
        return {
          ...e.student,
          roll_no: assignedRoll,
          batch_roll: assignedRoll,
          enrollment_date: e.enrollment_date,
        }
      }).filter(Boolean)

      rawStuds.sort((a, b) => (a.roll_no || 9999) - (b.roll_no || 9999))
      setStudents(rawStuds)

      const { data: existing } = await supabase.from("attendance").select("student_id, status").eq("batch_id", selectedBatch).eq("date", today)
      const map: Record<string, string> = {}
      for (const a of existing || []) map[a.student_id] = a.status
      for (const s of rawStuds) if (!map[s.id]) map[s.id] = "present"
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

  // Filter students by search (Roll No, Name, Student ID)
  const filteredStudents = students.filter(s => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.trim().toLowerCase()
    const rollStr = String(s.roll_no || "")
    const nameStr = String(s.name || "").toLowerCase()
    const idStr = String(s.student_id || "").toLowerCase()
    return rollStr === q || `roll ${rollStr}`.includes(q) || `roll #${rollStr}`.includes(q) || nameStr.includes(q) || idStr.includes(q)
  })

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-black text-slate-900 tracking-tight">Mark Attendance</h2><p className="text-sm text-slate-400 mt-1">{today}</p></div>
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Select Batch</label>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10">
            <option value="" className="bg-slate-950 text-white">-- Select Batch --</option>
            {batches.map(b => <option key={b.id} value={b.id} className="bg-slate-950 text-white">{b.name}</option>)}
          </select>
        </div>

        {selectedBatch && (
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Search by Roll / Name / ID</label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Roll 1, Asik, MS-10001..."
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {selectedBatch && students.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Roll</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Student ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-black text-amber-600 font-mono">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 font-black text-amber-700">
                        {s.roll_no}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono">{s.student_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {["present", "absent", "late", "excused"].map(st => (
                          <button key={st} onClick={() => setAttendance(a => ({ ...a, [s.id]: st }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${attendance[s.id] === st
                              ? (st === "present" ? "bg-emerald-500 text-white font-black shadow-md shadow-emerald-500/20" : st === "absent" ? "bg-rose-500 text-white font-black shadow-md shadow-rose-500/20" : st === "late" ? "bg-amber-500 text-white font-black shadow-md shadow-amber-500/20" : "bg-blue-500 text-white font-black shadow-md shadow-blue-500/20")
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{st}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-sm text-slate-600">
              Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students • Present: <span className="text-emerald-600 font-bold">{Object.values(attendance).filter(v => v === "present").length}</span> • Absent: <span className="text-rose-600 font-bold">{Object.values(attendance).filter(v => v === "absent").length}</span>
            </p>
            <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><UserCheck className="w-4 h-4" /> Save Attendance</>}
            </button>
          </div>
        </div>
      )}
      {selectedBatch && students.length === 0 && <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center text-slate-400">No students enrolled in this batch.</div>}
    </div>
  )
}
