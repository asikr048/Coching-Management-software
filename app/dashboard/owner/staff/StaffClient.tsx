"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, UserCheck, Shield, ShieldCheck, Crown, ChevronDown } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Staff } from "@/lib/supabase/types"

const roleLabel: Record<string, string> = {
  owner: "Owner",
  super_manager: "Super Manager",
  manager: "Manager",
  receptionist: "Receptionist",
  teacher: "Teacher",
  accountant: "Accountant",
  course_teacher: "Course Teacher",
}

const roleColor: Record<string, string> = {
  owner: "bg-indigo-100 text-indigo-700 border-indigo-200",
  super_manager: "bg-amber-100 text-amber-700 border-amber-200",
  manager: "bg-teal-100 text-teal-700 border-teal-200",
  receptionist: "bg-emerald-100 text-emerald-700 border-emerald-200",
  teacher: "bg-blue-100 text-blue-700 border-blue-200",
  accountant: "bg-purple-100 text-purple-700 border-purple-200",
  course_teacher: "bg-sky-100 text-sky-700 border-sky-200",
}

const roleIcon: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5" />,
  super_manager: <ShieldCheck className="w-3.5 h-3.5" />,
  manager: <Shield className="w-3.5 h-3.5" />,
}

export default function StaffClient({ staff: initial, myRole }: { staff: Staff[]; myRole: string }) {
  const [staff, setStaff] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const supabase = createClient()
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "teacher", salary: "0", subject: "", password: "" })
  function update(f: string, v: string) { setForm(x => ({ ...x, [f]: v })) }

  // What roles can the current user assign?
  function getAssignableRoles(): string[] {
    if (myRole === "owner") {
      return ["super_manager", "manager", "receptionist", "teacher", "accountant", "course_teacher"]
    }
    if (myRole === "super_manager") {
      return ["manager", "receptionist", "teacher", "accountant", "course_teacher"]
    }
    return [] // manager and others can't change roles
  }

  // Can the current user change this staff member's role?
  function canChangeRole(targetRole: string): boolean {
    if (targetRole === "owner") return false // nobody can change the owner
    if (myRole === "owner") return true // owner can change anyone
    if (myRole === "super_manager") {
      // super_manager can only change managers and below
      return !["owner", "super_manager"].includes(targetRole)
    }
    return false
  }

  async function handleChangeRole(staffId: string, newRole: string) {
    setChangingRole(staffId)
    try {
      const { error } = await supabase.from("staff").update({ role: newRole }).eq("id", staffId)
      if (error) throw error
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, role: newRole as any } : s))
      toast.success(`Role updated to ${roleLabel[newRole]}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change role")
    } finally {
      setChangingRole(null)
    }
  }

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
      setStaff([data, ...staff]); setShowModal(false); toast.success(`${form.name} added as ${roleLabel[form.role]}`)
      setForm({ name: "", email: "", phone: "", role: "teacher", salary: "0", subject: "", password: "" })
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  async function handleToggleActive(staffId: string, currentActive: boolean) {
    try {
      const { error } = await supabase.from("staff").update({ is_active: !currentActive }).eq("id", staffId)
      if (error) throw error
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, is_active: !currentActive } : s))
      toast.success(currentActive ? "Staff deactivated" : "Staff activated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
  const assignableRoles = getAssignableRoles()
  const canAddStaff = myRole === "owner" || myRole === "super_manager"

  return (
    <div>
      {canAddStaff && (
        <div className="flex justify-end mb-4">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"><Plus className="w-4 h-4" /> Add Staff</button>
        </div>
      )}

      {/* Role hierarchy legend */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Role Hierarchy:</span>
        {["owner", "super_manager", "manager", "receptionist", "teacher", "accountant"].map(r => (
          <span key={r} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleColor[r]}`}>
            {roleIcon[r]} {roleLabel[r]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map(s => (
          <div key={s.id} className={`bg-white rounded-xl border ${s.is_active ? "border-gray-200" : "border-red-200 bg-red-50/30"} p-5 hover:shadow-md transition-shadow relative`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                s.role === "owner" ? "bg-indigo-100 text-indigo-700" :
                s.role === "super_manager" ? "bg-amber-100 text-amber-700" :
                s.role === "manager" ? "bg-teal-100 text-teal-700" :
                "bg-gray-100 text-gray-700"
              }`}>{s.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                  {!s.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-semibold">Inactive</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">{s.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm mb-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleColor[s.role] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                {roleIcon[s.role]} {roleLabel[s.role] || s.role}
              </span>
              <span className="text-gray-500 text-xs">{s.subject || ""}</span>
            </div>

            <div className="flex items-center justify-between text-xs mt-2 text-gray-500">
              <span>Salary: {formatCurrency(s.salary)}</span>
              <span>Joined: {formatDate(s.joined_at)}</span>
            </div>

            {/* Role change dropdown */}
            {canChangeRole(s.role) && assignableRoles.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <select
                  value={s.role}
                  onChange={e => handleChangeRole(s.id, e.target.value)}
                  disabled={changingRole === s.id}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {/* Show current role as an option even if not assignable (e.g. viewing a super_manager as owner) */}
                  {!assignableRoles.includes(s.role) && (
                    <option value={s.role}>{roleLabel[s.role] || s.role}</option>
                  )}
                  {assignableRoles.map(r => (
                    <option key={r} value={r}>{roleLabel[r]}</option>
                  ))}
                </select>

                {canChangeRole(s.role) && (
                  <button
                    onClick={() => handleToggleActive(s.id, s.is_active)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      s.is_active
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                )}

                {changingRole === s.id && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
              </div>
            )}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select value={form.role} onChange={e => update("role", e.target.value)} className={inputClass}>
                    {assignableRoles.map(r => (
                      <option key={r} value={r}>{roleLabel[r]}</option>
                    ))}
                  </select>
                </div>
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
