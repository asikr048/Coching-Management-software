"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus, X, Loader2, UserCheck, Shield, ShieldCheck, Crown,
  ChevronDown, Banknote, Landmark, Check, SlidersHorizontal, Award
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Staff, Branch } from "@/lib/supabase/types"

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

interface Props {
  staff: Staff[]
  branches: Branch[]
  myRole: string
  myStaffId: string
  hasSuperFinancial: boolean
  myBranchIds: string[]
}

export default function StaffClient({
  staff: initial,
  branches,
  myRole,
  myStaffId,
  hasSuperFinancial,
  myBranchIds,
}: Props) {
  const [staff, setStaff] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [branchModalStaff, setBranchModalStaff] = useState<Staff | null>(null)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [savingBranches, setSavingBranches] = useState(false)
  const [loading, setLoading] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const supabase = createClient()

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "teacher",
    salary: "0",
    subject: "",
    password: "",
    branch_ids: [] as string[],
  })

  function update(f: string, v: any) {
    setForm(x => ({ ...x, [f]: v }))
  }

  // Assignable roles
  function getAssignableRoles(): string[] {
    if (myRole === "owner") {
      return ["super_manager", "manager", "receptionist", "teacher", "accountant", "course_teacher"]
    }
    if (myRole === "super_manager") {
      return ["manager", "receptionist", "teacher", "accountant", "course_teacher"]
    }
    return []
  }

  function canChangeRole(targetRole: string): boolean {
    if (targetRole === "owner") return false
    if (myRole === "owner") return true
    if (myRole === "super_manager") {
      return !["owner", "super_manager"].includes(targetRole)
    }
    return false
  }

  // Can the current user manage financial access for this staff member?
  function canManageFinancialAccess(targetStaff: Staff): boolean {
    if (targetStaff.role === "owner") return false
    if (myRole === "owner") return true
    if (myRole === "super_manager" && hasSuperFinancial) {
      // Super manager can toggle financial access for staff within their permitted branches
      if (myBranchIds.length === 0) return true // Has access to all
      const targetBranches = targetStaff.branch_ids || (targetStaff.branch_id ? [targetStaff.branch_id] : [])
      if (targetBranches.length === 0) return true
      return targetBranches.some(bId => myBranchIds.includes(bId))
    }
    return false
  }

  async function handleChangeRole(staffId: string, newRole: string) {
    setChangingRole(staffId)
    try {
      const { error } = await supabase.from("staff").update({ role: newRole }).eq("id", staffId)
      if (error) throw error
      setStaff(prev => prev.map(s => (s.id === staffId ? { ...s, role: newRole as any } : s)))
      toast.success(`Role updated to ${roleLabel[newRole]}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change role")
    } finally {
      setChangingRole(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password || "changeme123",
      })
      if (authErr) throw authErr

      const primaryBranchId = form.branch_ids.length > 0 ? form.branch_ids[0] : null

      const { data, error } = await supabase
        .from("staff")
        .insert({
          auth_user_id: authData.user?.id,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
          salary: parseFloat(form.salary),
          subject: form.subject || null,
          branch_id: primaryBranchId,
          branch_ids: form.branch_ids.length > 0 ? form.branch_ids : null,
        })
        .select()
        .single()

      if (error) throw error
      setStaff([data, ...staff])
      setShowModal(false)
      toast.success(`${form.name} added as ${roleLabel[form.role]}`)
      setForm({
        name: "",
        email: "",
        phone: "",
        role: "teacher",
        salary: "0",
        subject: "",
        password: "",
        branch_ids: [],
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create staff")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(staffId: string, currentActive: boolean) {
    try {
      const { error } = await supabase.from("staff").update({ is_active: !currentActive }).eq("id", staffId)
      if (error) throw error
      setStaff(prev => prev.map(s => (s.id === staffId ? { ...s, is_active: !currentActive } : s)))
      toast.success(currentActive ? "Staff deactivated" : "Staff activated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  async function handleToggleFinancialAccess(staffId: string, current: boolean) {
    const target = staff.find(s => s.id === staffId)
    if (!target || !canManageFinancialAccess(target)) {
      toast.error("You do not have permission to manage financial access for this staff member")
      return
    }

    try {
      const { error } = await supabase
        .from("staff")
        .update({ has_financial_access: !current })
        .eq("id", staffId)
      if (error) throw error
      setStaff(prev =>
        prev.map(s => (s.id === staffId ? ({ ...s, has_financial_access: !current } as any) : s))
      )
      toast.success(!current ? "Financial access granted ✅" : "Financial access revoked ❌")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  async function handleToggleSuperFinancialAccess(staffId: string, current: boolean) {
    if (myRole !== "owner") {
      toast.error("Only owner can configure Super Financial Access")
      return
    }

    try {
      const { error } = await supabase
        .from("staff")
        .update({ has_super_financial_access: !current })
        .eq("id", staffId)
      if (error) throw error
      setStaff(prev =>
        prev.map(s => (s.id === staffId ? ({ ...s, has_super_financial_access: !current } as any) : s))
      )
      toast.success(!current ? "Super Financial Access granted 🌟" : "Super Financial Access revoked ❌")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  function openBranchModal(s: Staff) {
    setBranchModalStaff(s)
    const existing = s.branch_ids || (s.branch_id ? [s.branch_id] : [])
    setSelectedBranchIds(existing)
  }

  async function handleSaveBranches() {
    if (!branchModalStaff) return
    setSavingBranches(true)
    try {
      const primary = selectedBranchIds.length > 0 ? selectedBranchIds[0] : null
      const { error } = await supabase
        .from("staff")
        .update({
          branch_id: primary,
          branch_ids: selectedBranchIds.length > 0 ? selectedBranchIds : null,
        })
        .eq("id", branchModalStaff.id)

      if (error) throw error

      setStaff(prev =>
        prev.map(s =>
          s.id === branchModalStaff.id
            ? ({
                ...s,
                branch_id: primary || undefined,
                branch_ids: selectedBranchIds.length > 0 ? selectedBranchIds : undefined,
              } as Staff)
            : s
        )
      )
      toast.success("Staff branch permissions updated successfully")
      setBranchModalStaff(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch permissions")
    } finally {
      setSavingBranches(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
  const assignableRoles = getAssignableRoles()
  const canAddStaff = myRole === "owner" || myRole === "super_manager"

  return (
    <div>
      {canAddStaff && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Staff
          </button>
        </div>
      )}

      {/* Role hierarchy legend */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">
          Role Hierarchy:
        </span>
        {["owner", "super_manager", "manager", "receptionist", "teacher", "accountant"].map(r => (
          <span
            key={r}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleColor[r]}`}
          >
            {roleIcon[r]} {roleLabel[r]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map(s => {
          const staffBranchIds = s.branch_ids || (s.branch_id ? [s.branch_id] : [])
          const staffBranches = branches.filter(b => staffBranchIds.includes(b.id))
          const isSuperManager = s.role === "super_manager"

          return (
            <div
              key={s.id}
              className={`bg-white rounded-2xl border ${
                s.is_active ? "border-gray-200/90" : "border-red-200 bg-red-50/30"
              } p-5 hover:shadow-md transition-shadow relative flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                      s.role === "owner"
                        ? "bg-indigo-100 text-indigo-700"
                        : s.role === "super_manager"
                        ? "bg-amber-100 text-amber-700"
                        : s.role === "manager"
                        ? "bg-teal-100 text-teal-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                      {!s.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-semibold">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      roleColor[s.role] || "bg-gray-100 text-gray-700 border-gray-200"
                    }`}
                  >
                    {roleIcon[s.role]} {roleLabel[s.role] || s.role}
                  </span>
                  <span className="text-gray-500 text-xs font-medium">{s.subject || ""}</span>
                </div>

                {/* Assigned Branches Display */}
                <div className="mt-2.5 mb-2 p-2 bg-gray-50/90 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Landmark className="w-3 h-3 text-indigo-500" /> Permitted Branches
                    </span>
                    {(myRole === "owner" || (myRole === "super_manager" && s.role !== "owner")) && (
                      <button
                        onClick={() => openBranchModal(s)}
                        className="text-[11px] text-indigo-600 hover:underline font-semibold"
                      >
                        Manage Access
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.role === "owner" ? (
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium">
                        All Branches (Global Owner)
                      </span>
                    ) : staffBranches.length === 0 ? (
                      <span className="text-[11px] text-gray-400 italic">
                        {branches.length > 0 ? "Global (All Branches)" : "Default Branch"}
                      </span>
                    ) : (
                      staffBranches.map(b => (
                        <span
                          key={b.id}
                          className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium border border-indigo-100/60"
                        >
                          {b.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mt-2 text-gray-500">
                  <span>Salary: {formatCurrency(s.salary)}</span>
                  <span>Joined: {s.joined_at ? formatDate(s.joined_at) : "Recently"}</span>
                </div>

                {/* Super Financial Access (Owner-only toggle for Super Managers) */}
                {myRole === "owner" && isSuperManager && (
                  <div className="mt-3 pt-3 border-t border-amber-100 bg-amber-50/40 p-2 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Award
                        className={`w-4 h-4 ${
                          (s as any).has_super_financial_access ? "text-amber-600" : "text-gray-400"
                        }`}
                      />
                      <div>
                        <p
                          className={`text-xs font-bold ${
                            (s as any).has_super_financial_access ? "text-amber-700" : "text-gray-600"
                          }`}
                        >
                          Super Financial Access
                        </p>
                        <p className="text-[10px] text-gray-500">Can delegate staff financial access</p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleToggleSuperFinancialAccess(s.id, !!(s as any).has_super_financial_access)
                      }
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                        (s as any).has_super_financial_access
                          ? "border-red-200 text-red-600 hover:bg-red-50 bg-white"
                          : "border-amber-300 text-amber-700 hover:bg-amber-100 bg-white"
                      }`}
                    >
                      {(s as any).has_super_financial_access ? "Revoke Super" : "Grant Super"}
                    </button>
                  </div>
                )}

                {/* Standard Financial Access Badge + Toggle */}
                {s.role !== "owner" && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Banknote
                        className={`w-3.5 h-3.5 ${
                          (s as any).has_financial_access ? "text-emerald-600" : "text-gray-400"
                        }`}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          (s as any).has_financial_access ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        Financial Access: {(s as any).has_financial_access ? "Granted" : "None"}
                      </span>
                    </div>

                    {canManageFinancialAccess(s) && (
                      <button
                        onClick={() => handleToggleFinancialAccess(s.id, !!(s as any).has_financial_access)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                          (s as any).has_financial_access
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {(s as any).has_financial_access ? "Revoke" : "Grant"}
                      </button>
                    )}
                  </div>
                )}

                {s.role === "owner" && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-600">Financial Access: Always</span>
                  </div>
                )}
              </div>

              {/* Role change dropdown & active toggle */}
              {canChangeRole(s.role) && assignableRoles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <select
                    value={s.role}
                    onChange={e => handleChangeRole(s.id, e.target.value)}
                    disabled={changingRole === s.id}
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {!assignableRoles.includes(s.role) && (
                      <option value={s.role}>{roleLabel[s.role] || s.role}</option>
                    )}
                    {assignableRoles.map(r => (
                      <option key={r} value={r}>
                        {roleLabel[r]}
                      </option>
                    ))}
                  </select>

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

                  {changingRole === s.id && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
                </div>
              )}
            </div>
          )
        })}
        {staff.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">No staff added yet.</div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-600" /> Add Staff Member
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => update("name", e.target.value)}
                    className={inputClass}
                    placeholder="Staff member full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => update("email", e.target.value)}
                    className={inputClass}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => update("phone", e.target.value)}
                    className={inputClass}
                    placeholder="017xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={e => update("role", e.target.value)}
                    className={inputClass}
                  >
                    {assignableRoles.map(r => (
                      <option key={r} value={r}>
                        {roleLabel[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Subject / Designation</label>
                  <input
                    value={form.subject}
                    onChange={e => update("subject", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Physics, Reception, Math"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Monthly Salary (৳)</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={e => update("salary", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={e => update("password", e.target.value)}
                    className={inputClass}
                    placeholder="Min 6 chars"
                  />
                </div>
              </div>

              {/* Branch Assignment Checkboxes */}
              {branches.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Branch Assignment (শাখা নির্ধারণ)
                  </label>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Select one or multiple branches this staff member can access:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
                    {branches.map(branch => {
                      const checked = form.branch_ids.includes(branch.id)
                      return (
                        <label
                          key={branch.id}
                          className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer p-1 hover:bg-white rounded-lg transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) {
                                update("branch_ids", [...form.branch_ids, branch.id])
                              } else {
                                update(
                                  "branch_ids",
                                  form.branch_ids.filter(id => id !== branch.id)
                                )
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="truncate">{branch.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2 shadow-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Adding...
                    </>
                  ) : (
                    "Add Staff"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Branch Permissions Modal */}
      {branchModalStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Branch Access Control</h3>
                  <p className="text-xs text-gray-500 truncate">{branchModalStaff.name}</p>
                </div>
              </div>
              <button
                onClick={() => setBranchModalStaff(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-3">
              Assign single or multiple branch access for <strong>{branchModalStaff.name}</strong>. If none selected, staff member has global organization access.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
              {branches.map(branch => {
                const isSelected = selectedBranchIds.includes(branch.id)
                return (
                  <label
                    key={branch.id}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50 border border-indigo-200 text-indigo-900"
                        : "hover:bg-white text-gray-700 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedBranchIds(prev => [...prev, branch.id])
                          } else {
                            setSelectedBranchIds(prev => prev.filter(id => id !== branch.id))
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="truncate">{branch.name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                  </label>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBranchModalStaff(null)}
                disabled={savingBranches}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBranches}
                disabled={savingBranches}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-2 shadow-xs"
              >
                {savingBranches ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
