"use client"
import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus, X, Loader2, UserCheck, Shield, ShieldCheck, Crown,
  ChevronDown, Banknote, Landmark, Check, Award, Sparkles,
  Search, Filter, Edit2, CheckSquare, Square, Users, Mail, Phone, BookOpen
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
  owner: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  super_manager: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  manager: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  receptionist: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  teacher: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  accountant: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  course_teacher: "bg-blue-500/20 text-blue-300 border-blue-500/40",
}

const roleIcon: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-amber-400" />,
  super_manager: <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />,
  manager: <Shield className="w-3.5 h-3.5 text-teal-400" />,
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
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null)
  const [togglingSuperId, setTogglingSuperId] = useState<string | null>(null)

  // Search and Branch Filter
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all")

  // Edit Staff Details Modal state
  const [editModalStaff, setEditModalStaff] = useState<Staff | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    subject: "",
    salary: "0",
    role: "",
    branch_ids: [] as string[],
  })
  const [savingEdit, setSavingEdit] = useState(false)

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

  // Determine accessible branches for the current user:
  // Owner and Super Managers without branch restrictions see all branches.
  // Restricted Super Managers see only their assigned branches.
  const accessibleBranches = useMemo(() => {
    if (myRole === "owner" || myBranchIds.length === 0) {
      return branches
    }
    return branches.filter(b => myBranchIds.includes(b.id))
  }, [branches, myRole, myBranchIds])

  function update(f: string, v: any) {
    setForm(x => ({ ...x, [f]: v }))
  }

  function getAssignableRoles(): string[] {
    if (myRole === "owner" || !myRole || myRole === "manager") {
      return ["super_manager", "manager", "receptionist", "teacher", "accountant", "course_teacher"]
    }
    if (myRole === "super_manager") {
      return ["manager", "receptionist", "teacher", "accountant", "course_teacher"]
    }
    return ["super_manager", "manager", "receptionist", "teacher", "accountant", "course_teacher"]
  }

  function canChangeRole(targetRole: string): boolean {
    if (targetRole === "owner") return false
    if (myRole === "owner" || !myRole || myRole === "manager") return true
    if (myRole === "super_manager") {
      return !["owner", "super_manager"].includes(targetRole)
    }
    return false
  }

  function canEditStaff(target: Staff): boolean {
    if (myRole === "owner") return true
    if (myRole === "super_manager") {
      if (target.role === "owner") return false
      if (target.role === "super_manager" && target.id !== myStaffId) return false
      return true
    }
    return false
  }

  function canManageBranches(target: Staff): boolean {
    if (myRole === "owner") return true
    if (myRole === "super_manager") {
      if (target.role === "owner") return false
      return true
    }
    return false
  }

  function canManageFinancialAccess(targetStaff: Staff): boolean {
    if (targetStaff.role === "owner") return false
    if (myRole === "owner") return true
    if (myRole === "super_manager" && hasSuperFinancial) {
      if (myBranchIds.length === 0) return true
      const targetBranches = targetStaff.branch_ids || (targetStaff.branch_id ? [targetStaff.branch_id] : [])
      if (targetBranches.length === 0) return true
      return targetBranches.some(bId => myBranchIds.includes(bId))
    }
    if (!myRole || myRole === "manager") return true
    return false
  }

  // Filtered staff based on search query and branch dropdown
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      // 1. Text Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = s.name?.toLowerCase().includes(q)
        const emailMatch = s.email?.toLowerCase().includes(q)
        const phoneMatch = s.phone?.toLowerCase().includes(q)
        const roleMatch = (roleLabel[s.role] || s.role)?.toLowerCase().includes(q)
        const subjectMatch = s.subject?.toLowerCase().includes(q)
        if (!nameMatch && !emailMatch && !phoneMatch && !roleMatch && !subjectMatch) {
          return false
        }
      }

      // 2. Branch Dropdown Filter
      if (selectedBranchFilter !== "all") {
        const staffBranchIds = s.branch_ids || (s.branch_id ? [s.branch_id] : [])
        if (s.role === "owner") return true
        if (staffBranchIds.length === 0) return true
        if (!staffBranchIds.includes(selectedBranchFilter)) {
          return false
        }
      }

      return true
    })
  }, [staff, searchQuery, selectedBranchFilter])

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
        email: form.email.trim(),
        password: form.password || "changeme123",
      })
      if (authErr) throw authErr

      const primaryBranchId = form.branch_ids.length > 0 ? form.branch_ids[0] : null

      const insertPayload: any = {
        auth_user_id: authData.user?.id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || null,
        role: form.role,
        salary: parseFloat(form.salary) || 0,
        subject: form.subject?.trim() || null,
        branch_id: primaryBranchId,
      }

      let insertedStaff: Staff | null = null

      const { data, error } = await supabase
        .from("staff")
        .insert({
          ...insertPayload,
          branch_ids: form.branch_ids.length > 0 ? form.branch_ids : null,
        })
        .select()
        .single()

      if (error) {
        if (error.message?.includes("branch_ids") || error.code === "PGRST204") {
          const { data: retryData, error: retryErr } = await supabase
            .from("staff")
            .insert(insertPayload)
            .select()
            .single()
          if (retryErr) throw retryErr
          insertedStaff = retryData
        } else {
          throw error
        }
      } else {
        insertedStaff = data
      }

      // Sync branches via API route (updates site_settings & junction table)
      if (insertedStaff && form.branch_ids.length > 0) {
        try {
          await fetch("/api/staff/branches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              staff_id: insertedStaff.id,
              branch_id: primaryBranchId,
              branch_ids: form.branch_ids,
            }),
          })
          insertedStaff.branch_ids = form.branch_ids
        } catch (e) {
          console.warn("Branch sync API warning during staff create:", e)
        }
      }

      if (insertedStaff) {
        setStaff([insertedStaff, ...staff])
      }
      setShowModal(false)
      toast.success(`${form.name} added as ${roleLabel[form.role] || form.role}`)
      setForm({
        name: "",
        email: "",
        phone: "",
        role: assignableRoles[0] || "teacher",
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

    setTogglingStaffId(staffId)
    const nextVal = !current
    try {
      const { error } = await supabase
        .from("staff")
        .update({ has_financial_access: nextVal })
        .eq("id", staffId)
      if (error) throw error
      setStaff(prev =>
        prev.map(s => (s.id === staffId ? ({ ...s, has_financial_access: nextVal } as any) : s))
      )
      toast.success(
        nextVal
          ? `Financial access granted to ${target.name} ✅`
          : `Financial access revoked from ${target.name} ❌`
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update financial access")
    } finally {
      setTogglingStaffId(null)
    }
  }

  async function handleToggleSuperFinancialAccess(staffId: string, current: boolean) {
    const target = staff.find(s => s.id === staffId)
    if (myRole !== "owner" && myRole !== "manager") {
      toast.error("Only owner can configure Super Financial Access")
      return
    }

    setTogglingSuperId(staffId)
    const nextVal = !current
    try {
      const { error } = await supabase
        .from("staff")
        .update({ has_super_financial_access: nextVal })
        .eq("id", staffId)
      if (error) throw error
      setStaff(prev =>
        prev.map(s => (s.id === staffId ? ({ ...s, has_super_financial_access: nextVal } as any) : s))
      )
      toast.success(
        nextVal
          ? `Super Financial Access granted to ${target?.name || "staff"} 🌟`
          : `Super Financial Access revoked from ${target?.name || "staff"} ❌`
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update super financial access")
    } finally {
      setTogglingSuperId(null)
    }
  }

  function openBranchModal(s: Staff) {
    setBranchModalStaff(s)
    const existing = s.branch_ids || (s.branch_id ? [s.branch_id] : [])
    // Select branches that are within accessibleBranches
    setSelectedBranchIds(existing.filter(id => accessibleBranches.some(ab => ab.id === id)))
  }

  async function handleSaveBranches() {
    if (!branchModalStaff) return
    setSavingBranches(true)
    try {
      // Preserve branches outside current user's accessible scope
      const existingBranchIds = branchModalStaff.branch_ids || (branchModalStaff.branch_id ? [branchModalStaff.branch_id] : [])
      const accessibleBranchIds = new Set(accessibleBranches.map(b => b.id))
      const preservedOtherBranches = (myRole === "owner" || myBranchIds.length === 0)
        ? []
        : existingBranchIds.filter(id => !accessibleBranchIds.has(id))

      const finalBranchIds = Array.from(new Set([...selectedBranchIds, ...preservedOtherBranches]))
      const primary = finalBranchIds.length > 0 ? finalBranchIds[0] : null

      const res = await fetch("/api/staff/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: branchModalStaff.id,
          branch_id: primary,
          branch_ids: finalBranchIds,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update branch permissions")
      }

      setStaff(prev =>
        prev.map(s =>
          s.id === branchModalStaff.id
            ? ({
                ...s,
                branch_id: primary || undefined,
                branch_ids: finalBranchIds,
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

  function openEditModal(s: Staff) {
    setEditModalStaff(s)
    const existingBranchIds = s.branch_ids || (s.branch_id ? [s.branch_id] : [])
    setEditForm({
      name: s.name || "",
      phone: s.phone || "",
      subject: s.subject || "",
      salary: String(s.salary ?? 0),
      role: s.role,
      branch_ids: existingBranchIds.filter(id => accessibleBranches.some(ab => ab.id === id)),
    })
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModalStaff) return
    setSavingEdit(true)
    try {
      // 1. Calculate branches preserving out-of-scope branches
      const existingBranchIds = editModalStaff.branch_ids || (editModalStaff.branch_id ? [editModalStaff.branch_id] : [])
      const accessibleBranchIds = new Set(accessibleBranches.map(b => b.id))
      const preservedOtherBranches = (myRole === "owner" || myBranchIds.length === 0)
        ? []
        : existingBranchIds.filter(id => !accessibleBranchIds.has(id))

      const finalBranchIds = Array.from(new Set([...editForm.branch_ids, ...preservedOtherBranches]))
      const primary = finalBranchIds.length > 0 ? finalBranchIds[0] : null

      const updatePayload: any = {
        name: editForm.name.trim(),
        phone: editForm.phone?.trim() || null,
        subject: editForm.subject?.trim() || null,
        salary: parseFloat(editForm.salary) || 0,
        branch_id: primary,
      }

      if (canChangeRole(editModalStaff.role) && editForm.role && editForm.role !== editModalStaff.role) {
        updatePayload.role = editForm.role
      }

      const { error: staffErr } = await supabase
        .from("staff")
        .update({
          ...updatePayload,
          branch_ids: finalBranchIds.length > 0 ? finalBranchIds : null,
        })
        .eq("id", editModalStaff.id)

      if (staffErr) {
        if (staffErr.message?.includes("branch_ids") || staffErr.code === "PGRST204") {
          const { error: retryErr } = await supabase
            .from("staff")
            .update(updatePayload)
            .eq("id", editModalStaff.id)
          if (retryErr) throw retryErr
        } else {
          throw staffErr
        }
      }

      // Sync branches via API route
      try {
        await fetch("/api/staff/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staff_id: editModalStaff.id,
            branch_id: primary,
            branch_ids: finalBranchIds,
          }),
        })
      } catch (e) {
        console.warn("Branch sync API warning during staff update:", e)
      }

      setStaff(prev =>
        prev.map(s =>
          s.id === editModalStaff.id
            ? ({
                ...s,
                name: editForm.name.trim(),
                phone: editForm.phone?.trim() || null,
                subject: editForm.subject?.trim() || null,
                salary: parseFloat(editForm.salary) || 0,
                role: (updatePayload.role || s.role) as any,
                branch_id: primary || undefined,
                branch_ids: finalBranchIds,
              } as Staff)
            : s
        )
      )

      toast.success("Staff details updated successfully")
      setEditModalStaff(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to update staff details")
    } finally {
      setSavingEdit(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
  const assignableRoles = getAssignableRoles()
  const canAddStaff = myRole === "owner" || myRole === "super_manager"

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Role hierarchy legend */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mr-2">
            Role Hierarchy:
          </span>
          {["owner", "super_manager", "manager", "receptionist", "teacher", "accountant"].map(r => (
            <span
              key={r}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${roleColor[r]}`}
            >
              {roleIcon[r]} {roleLabel[r]}
            </span>
          ))}
        </div>

        {canAddStaff && (
          <button
            onClick={() => {
              setForm({
                name: "",
                email: "",
                phone: "",
                role: assignableRoles[0] || "teacher",
                salary: "0",
                subject: "",
                password: "",
                branch_ids: [],
              })
              setShowModal(true)
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02] flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Staff Member
          </button>
        )}
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, role, or subject..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranchFilter}
              onChange={e => setSelectedBranchFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All Branches ({staff.length})</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-semibold px-2 py-1">
            Showing <strong className="text-slate-900">{filteredStaff.length}</strong> staff
          </div>
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredStaff.map(s => {
          const staffBranchIds = s.branch_ids || (s.branch_id ? [s.branch_id] : [])
          const staffBranches = branches.filter(b => staffBranchIds.includes(b.id))
          const isSuperManager = s.role === "super_manager"

          return (
            <div
              key={s.id}
              className={`bg-white rounded-2xl border ${
                s.is_active ? "border-slate-200 hover:border-amber-500/40" : "border-rose-300 bg-rose-50/20"
              } p-5 hover:shadow-xl transition-all relative flex flex-col justify-between`}
            >
              <div>
                {/* Header: Avatar, Name, Email, and Edit Button */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md flex-shrink-0 ${
                        s.role === "owner"
                          ? "bg-amber-500 text-slate-950"
                          : s.role === "super_manager"
                          ? "bg-amber-400/20 text-amber-500 border border-amber-400/40"
                          : s.role === "manager"
                          ? "bg-teal-400/20 text-teal-600 border border-teal-400/40"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {s.name ? s.name.charAt(0).toUpperCase() : "S"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate text-base">{s.name}</p>
                        {!s.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 text-rose-600 border border-rose-500/40 rounded font-bold flex-shrink-0">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{s.email}</p>
                      {s.phone && <p className="text-[11px] text-slate-400 truncate">{s.phone}</p>}
                    </div>
                  </div>

                  {/* Edit Staff Details button */}
                  {canEditStaff(s) && (
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors flex-shrink-0 cursor-pointer border border-transparent hover:border-amber-200"
                      title="Edit Staff Member & Branches"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Role and Subject row */}
                <div className="flex items-center justify-between text-sm mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      roleColor[s.role] || "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {roleIcon[s.role]} {roleLabel[s.role] || s.role}
                  </span>
                  <span className="text-slate-500 text-xs font-medium truncate max-w-[140px] text-right">
                    {s.subject || ""}
                  </span>
                </div>

                {/* Assigned Branches Display */}
                <div className="mt-2.5 mb-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Landmark className="w-3 h-3 text-amber-600" /> Permitted Branches
                    </span>
                    {canManageBranches(s) && (
                      <button
                        onClick={() => openBranchModal(s)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                      >
                        Manage Access
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.role === "owner" ? (
                      <span className="text-[11px] bg-amber-500/15 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                        All Branches (Global Owner)
                      </span>
                    ) : staffBranches.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">
                        {branches.length > 0 ? "Global (All Branches)" : "Default Branch"}
                      </span>
                    ) : (
                      staffBranches.map(b => (
                        <span
                          key={b.id}
                          className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-semibold"
                        >
                          {b.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
                  <span>Salary: <strong className="text-slate-900 font-bold">{formatCurrency(s.salary)}</strong></span>
                  <span>Joined: {s.joined_at ? formatDate(s.joined_at) : "Recently"}</span>
                </div>

                {/* Super Financial Access (Owner-only toggle for Super Managers) */}
                {isSuperManager && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 bg-amber-50/80 p-2.5 rounded-xl flex items-center justify-between border border-amber-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          (s as any).has_super_financial_access
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-900 leading-tight">
                          Super Financial Access
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {(s as any).has_super_financial_access
                            ? "Can delegate branch finances"
                            : "Cannot delegate finances"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!(s as any).has_super_financial_access}
                      disabled={togglingSuperId === s.id}
                      onClick={() =>
                        handleToggleSuperFinancialAccess(s.id, !!(s as any).has_super_financial_access)
                      }
                      title={
                        (s as any).has_super_financial_access
                          ? "Super financial access active. Click to revoke."
                          : "Super financial access disabled. Click to grant."
                      }
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 ${
                        (s as any).has_super_financial_access ? "bg-amber-500" : "bg-slate-300"
                      } ${togglingSuperId === s.id ? "opacity-60 cursor-wait" : "hover:opacity-90"}`}
                    >
                      <span className="sr-only">Toggle super financial access</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          (s as any).has_super_financial_access ? "translate-x-5" : "translate-x-0"
                        }`}
                      >
                        {togglingSuperId === s.id ? (
                          <Loader2 className="w-2.5 h-2.5 text-slate-500 animate-spin" />
                        ) : (s as any).has_super_financial_access ? (
                          <Check className="w-2.5 h-2.5 text-amber-700 stroke-[3]" />
                        ) : null}
                      </span>
                    </button>
                  </div>
                )}

                {/* Standard Financial Access Toggle Button */}
                {s.role !== "owner" ? (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          (s as any).has_financial_access
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-tight">
                          Financial Access
                        </p>
                        <p
                          className={`text-[11px] font-semibold leading-tight mt-0.5 ${
                            (s as any).has_financial_access ? "text-emerald-600 font-bold" : "text-slate-400"
                          }`}
                        >
                          {(s as any).has_financial_access ? "Active (Granted)" : "Disabled (None)"}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Toggle Switch Button */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!(s as any).has_financial_access}
                      disabled={togglingStaffId === s.id}
                      onClick={() => handleToggleFinancialAccess(s.id, !!(s as any).has_financial_access)}
                      title={
                        (s as any).has_financial_access
                          ? "Financial access is active. Click to revoke."
                          : "Financial access is disabled. Click to grant."
                      }
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 ${
                        (s as any).has_financial_access ? "bg-emerald-600" : "bg-slate-300"
                      } ${togglingStaffId === s.id ? "opacity-60 cursor-wait" : "hover:opacity-90"}`}
                    >
                      <span className="sr-only">Toggle financial access</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          (s as any).has_financial_access ? "translate-x-5" : "translate-x-0"
                        }`}
                      >
                        {togglingStaffId === s.id ? (
                          <Loader2 className="w-2.5 h-2.5 text-slate-500 animate-spin" />
                        ) : (s as any).has_financial_access ? (
                          <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                        ) : null}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 leading-tight">Financial Access</p>
                        <p className="text-[11px] font-semibold text-amber-600">Full Access (Owner)</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      Always ON
                    </span>
                  </div>
                )}
              </div>

              {/* Role change dropdown & active toggle */}
              {canChangeRole(s.role) && assignableRoles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                  <select
                    value={s.role}
                    onChange={e => handleChangeRole(s.id, e.target.value)}
                    disabled={changingRole === s.id}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-800 font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
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
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      s.is_active
                        ? "border-rose-300 text-rose-600 hover:bg-rose-50"
                        : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                    }`}
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>

                  {changingRole === s.id && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                </div>
              )}
            </div>
          )
        })}
        {filteredStaff.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
            No staff members found matching the current search or branch filter.
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-200/90 my-8">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <UserCheck className="w-5 h-5 text-amber-500" /> Add Staff Member
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => update("name", e.target.value)}
                    className={inputClass}
                    placeholder="Staff member full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => update("phone", e.target.value)}
                    className={inputClass}
                    placeholder="017xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role *</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Designation</label>
                  <input
                    value={form.subject}
                    onChange={e => update("subject", e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Physics, Reception, Math"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Salary (৳)</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={e => update("salary", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password *</label>
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
              {accessibleBranches.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Branch Assignment (শাখা নির্ধারণ)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => update("branch_ids", accessibleBranches.map(b => b.id))}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => update("branch_ids", [])}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Select one or multiple branches this staff member can access:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                    {accessibleBranches.map(branch => {
                      const checked = form.branch_ids.includes(branch.id)
                      return (
                        <label
                          key={branch.id}
                          className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
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
                            className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer accent-amber-500"
                          />
                          <span className="truncate">{branch.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
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

      {/* Edit Staff Details Modal (Name, Phone, Subject, Salary, Role, Branches) */}
      {editModalStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-200/90 my-8">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Staff Member</h3>
                  <p className="text-xs text-slate-500 truncate">{editModalStaff.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalStaff(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className={inputClass}
                    placeholder="Staff member full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    value={editForm.phone}
                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className={inputClass}
                    placeholder="017xxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Designation</label>
                  <input
                    value={editForm.subject}
                    onChange={e => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Physics, Math, Reception"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Salary (৳)</label>
                  <input
                    type="number"
                    value={editForm.salary}
                    onChange={e => setEditForm(prev => ({ ...prev, salary: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                {canChangeRole(editModalStaff.role) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      className={inputClass}
                    >
                      {!assignableRoles.includes(editModalStaff.role) && (
                        <option value={editModalStaff.role}>
                          {roleLabel[editModalStaff.role] || editModalStaff.role}
                        </option>
                      )}
                      {assignableRoles.map(r => (
                        <option key={r} value={r}>
                          {roleLabel[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Multi-Branch Assignment */}
              {accessibleBranches.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Permitted Branches (শাখা নির্বাচন)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm(prev => ({
                            ...prev,
                            branch_ids: accessibleBranches.map(b => b.id),
                          }))
                        }
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, branch_ids: [] }))}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Select which branches this staff member belongs to:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-44 overflow-y-auto">
                    {accessibleBranches.map(branch => {
                      const isChecked = editForm.branch_ids.includes(branch.id)
                      return (
                        <label
                          key={branch.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-amber-50 text-amber-900 border border-amber-200 font-semibold"
                              : "hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEditForm(prev => ({
                                    ...prev,
                                    branch_ids: [...prev.branch_ids, branch.id],
                                  }))
                                } else {
                                  setEditForm(prev => ({
                                    ...prev,
                                    branch_ids: prev.branch_ids.filter(id => id !== branch.id),
                                  }))
                                }
                              }}
                              className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer accent-amber-500"
                            />
                            <span className="truncate">{branch.name}</span>
                          </div>
                          {isChecked && <Check className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditModalStaff(null)}
                  disabled={savingEdit}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Branch Permissions Only Modal */}
      {branchModalStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-200/90">
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Branch Access Control</h3>
                  <p className="text-xs text-amber-600 truncate font-semibold">{branchModalStaff.name}</p>
                </div>
              </div>
              <button
                onClick={() => setBranchModalStaff(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Assign single or multiple branch access for <strong className="text-slate-900">{branchModalStaff.name}</strong>.
            </p>

            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-slate-500">
                {selectedBranchIds.length} of {accessibleBranches.length} branch(es) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBranchIds(accessibleBranches.map(b => b.id))}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedBranchIds([])}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4 border border-slate-200 rounded-xl p-2.5 bg-slate-50">
              {accessibleBranches.map(branch => {
                const isSelected = selectedBranchIds.includes(branch.id)
                return (
                  <label
                    key={branch.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-amber-50 border border-amber-300 text-amber-900"
                        : "hover:bg-slate-100 text-slate-700 border border-transparent"
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
                        className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer accent-amber-500"
                      />
                      <span className="truncate">{branch.name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                  </label>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setBranchModalStaff(null)}
                disabled={savingBranches}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBranches}
                disabled={savingBranches}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
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
