"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, UserCheck } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Staff } from "@/lib/supabase/types"

export default function StaffClient({ staff: initial }: { staff: Staff[] }) {
  const [staff, setStaff] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "teacher", salary: "0", subject: "", password: "" })
  function update(f: string, v: string) { setForm(x => ({ ...x, [f]: v })) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email: form.email, password: form.password || "changeme123" })
      if (authErr) throw authErr
      const { data, error } = await supabase.from("staff").insert({
        auth_user_id: authData.user?.id, name: form.name, email: form.email,
        phone: form.phone || null, role: form.role, salary: parseFloat(form.salary),
        subject: form.subject || null,
      }).select().single()
      if (error) throw error
      setStaff([data, ...staff]); setShowModal(false); toast.success(`${form.name} added as ${form.role}`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  const roleLabel: Record<string, string> = { owner: "Owner", receptionist: "Receptionist", teacher: "Teacher", accountant: "Accountant", course_teacher: "Course Teacher" }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"><Plus className="w-4 h-4" /> Add Staff</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">{s.name.charAt(0)}</div>
              <div><p className="font-semibold text-gray-800">{s.name}</p><p className="text-xs text-gray-500">{s.email}</p></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.role === "owner" ? "bg-purple-100 text-purple-700" : s.role === "teacher" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{roleLabel[s.role]}</span>
              <span className="text-gray-500">{s.subject || ""}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2 text-gray-500">
              <span>Salary: {formatCurrency(s.salary)}</span>
              <span>Joined: {formatDate(s.joined_at)}</span>
            </div>
          </div>
        ))}
        {staff.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No staff added yet.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold flex items-center gap-2"><UserCheck className="w-5 h-5" /> Add Staff Member</h3><button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" required value={form.email} onChange={e => update("email", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => update("phone", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Role *</label><select value={form.role} onChange={e => update("role", e.target.value)} className={inputClass}><option value="teacher">Teacher</option><option value="receptionist">Receptionist</option><option value="accountant">Accountant</option><option value="course_teacher">Course Teacher</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input value={form.subject} onChange={e => update("subject", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Salary (৳)</label><input type="number" value={form.salary} onChange={e => update("salary", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label><input type="password" required value={form.password} onChange={e => update("password", e.target.value)} className={inputClass} placeholder="Min 6 chars" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">{loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : "Add Staff"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
