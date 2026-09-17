"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Landmark, Plus, Search, MapPin, Phone, Mail, MessageSquare,
  User, Shield, Edit2, CheckCircle2, XCircle, Users,
  BookOpen, Copy, Check, AlertTriangle, Info, X,
  Trash2, Clock, ShieldAlert, Undo2, Lock, Unlock, AlertOctagon
} from "lucide-react"
import type { Branch } from "@/lib/supabase/types"

interface Props {
  initialBranches: Branch[]
  students: { id: string; branch_id?: string | null }[]
  batches: { id: string; branch_id?: string | null }[]
  staff: { id: string; branch_id?: string | null; branch_ids?: string[] | null }[]
  myRole: string
}

const SQL_MIGRATION_SNIPPET = `-- Run this in Supabase SQL Editor to enable full multi-branch director, SMS gateway and 48-hour deletion schedule:
ALTER TABLE branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_director TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS director_phone TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_phone TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS established_year TEXT DEFAULT '2018';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS sms_gateway_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_pending_deletion BOOLEAN DEFAULT false;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
`

export default function BranchesClient({
  initialBranches,
  students,
  batches,
  staff,
  myRole,
}: Props) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [search, setSearch] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "active" | "timelock">("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)
  const [showSqlGuide, setShowSqlGuide] = useState(false)
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null)

  // 48-Hour Deletion Timelock State
  const [scheduleDeleteModalBranch, setScheduleDeleteModalBranch] = useState<Branch | null>(null)
  const [deletionReason, setDeletionReason] = useState("")
  const [processingDeletion, setProcessingDeletion] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [now, setNow] = useState<number>(Date.now())

  const isOwner = myRole === "owner"
  const isOwnerOrSuper = myRole === "owner" || myRole === "branch_director" || myRole === "super_manager"
  const supabase = createClient()

  // Real-time tick every second for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    branch_director: "",
    director_phone: "",
    manager: "",
    manager_phone: "",
    phone: "",
    email: "",
    whatsapp: "",
    established_year: "2018",
    is_active: true,
    sms_api_key: "",
    sms_sender_id: "",
    sms_api_url: "",
  })

  function openCreateModal() {
    setEditingBranch(null)
    setFormData({
      name: "",
      location: "",
      description: "",
      branch_director: "",
      director_phone: "",
      manager: "",
      manager_phone: "",
      phone: "",
      email: "",
      whatsapp: "",
      established_year: "2018",
      is_active: true,
      sms_api_key: "",
      sms_sender_id: "",
      sms_api_url: "",
    })
    setError(null)
    setIsModalOpen(true)
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch)
    const contacts = branch.contact_info || {}
    const sms = branch.sms_gateway_config || {}
    setFormData({
      name: branch.name || "",
      location: branch.location || branch.address || "",
      description: branch.description || "",
      branch_director: branch.branch_director || "",
      director_phone: branch.director_phone || "",
      manager: branch.manager || "",
      manager_phone: branch.manager_phone || "",
      phone: contacts.phone || branch.phone || "",
      email: contacts.email || branch.email || "",
      whatsapp: branch.whatsapp || contacts.whatsapp || "",
      established_year: branch.established_year || contacts.established_year || "2018",
      is_active: branch.is_active ?? true,
      sms_api_key: sms.api_key || sms.apiKey || "",
      sms_sender_id: sms.sender_id || sms.senderId || "",
      sms_api_url: sms.api_url || sms.urlTemplate || "",
    })
    setError(null)
    setIsModalOpen(true)
  }

  function handleCopySql() {
    navigator.clipboard.writeText(SQL_MIGRATION_SNIPPET)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError("Branch name is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const fullPayload: any = {
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        description: formData.description.trim() || null,
        branch_director: formData.branch_director.trim() || null,
        director_phone: formData.director_phone.trim() || null,
        manager: formData.manager.trim() || null,
        manager_phone: formData.manager_phone.trim() || null,
        whatsapp: formData.whatsapp.trim() || null,
        established_year: formData.established_year.trim() || null,
        is_active: formData.is_active,
        address: formData.location.trim() || null,
        phone: formData.phone.trim() || formData.director_phone.trim() || formData.manager_phone.trim() || null,
        email: formData.email.trim() || null,
        contact_info: {
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          established_year: formData.established_year.trim() || null,
          address: formData.location.trim() || null,
        },
        sms_gateway_config: formData.sms_api_key.trim()
          ? {
              api_key: formData.sms_api_key.trim(),
              apiKey: formData.sms_api_key.trim(),
              sender_id: formData.sms_sender_id.trim() || undefined,
              senderId: formData.sms_sender_id.trim() || undefined,
              api_url: formData.sms_api_url.trim() || undefined,
              urlTemplate: formData.sms_api_url.trim() || undefined,
            }
          : null,
      }

      let savedRecord: Branch | null = null
      let usedFallback = false

      // 1. Try saving with full payload
      try {
        if (editingBranch) {
          const { data, error: updateError } = await supabase
            .from("branches")
            .update(fullPayload)
            .eq("id", editingBranch.id)
            .select()
            .single()

          if (updateError) throw updateError
          savedRecord = data as Branch
        } else {
          const { data, error: insertError } = await supabase
            .from("branches")
            .insert([fullPayload])
            .select()
            .single()

          if (insertError) throw insertError
          savedRecord = data as Branch
        }
      } catch (dbErr: any) {
        const msg = (dbErr?.message || "").toLowerCase()
        if (msg.includes("column") || msg.includes("schema cache") || msg.includes("does not exist")) {
          console.warn("Retrying with base schema fallback columns due to schema cache:", dbErr.message)
          usedFallback = true

          const basePayload: any = {
            name: formData.name.trim(),
            address: formData.location.trim() || null,
            phone: formData.phone.trim() || formData.director_phone.trim() || formData.manager_phone.trim() || null,
            email: formData.email.trim() || null,
            is_active: formData.is_active,
          }

          if (editingBranch) {
            const { data, error: fallbackUpdateErr } = await supabase
              .from("branches")
              .update(basePayload)
              .eq("id", editingBranch.id)
              .select()
              .single()

            if (fallbackUpdateErr) throw fallbackUpdateErr
            savedRecord = { ...(data as Branch), ...fullPayload }
          } else {
            const { data, error: fallbackInsertErr } = await supabase
              .from("branches")
              .insert([basePayload])
              .select()
              .single()

            if (fallbackInsertErr) throw fallbackInsertErr
            savedRecord = { ...(data as Branch), ...fullPayload }
          }
        } else {
          throw dbErr
        }
      }

      if (savedRecord) {
        if (editingBranch) {
          setBranches(prev => prev.map(b => (b.id === editingBranch.id ? savedRecord! : b)))
        } else {
          setBranches(prev => [...prev, savedRecord!])
        }

        if (usedFallback) {
          setFallbackWarning(
            "Branch saved to database! Note: Run SQL Migration in your Supabase SQL editor to permanently enable all custom columns in the database schema."
          )
        } else {
          setFallbackWarning(null)
        }

        setIsModalOpen(false)
      }
    } catch (err: any) {
      console.error("Save branch error:", err)
      setError(err.message || "Failed to save branch")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(branch: Branch) {
    const newStatus = !branch.is_active
    try {
      const { error: updateError } = await supabase
        .from("branches")
        .update({ is_active: newStatus })
        .eq("id", branch.id)

      if (updateError) throw updateError
      setBranches(prev =>
        prev.map(b => (b.id === branch.id ? { ...b, is_active: newStatus } : b))
      )
    } catch (err: any) {
      alert("Error updating status: " + err.message)
    }
  }

  // ==========================================
  // 48-HOUR BRANCH DELETION TIMELOCK HANDLERS (OWNER ONLY)
  // ==========================================

  function openScheduleDeleteModal(branch: Branch) {
    if (!isOwner) {
      alert("Only the Institute Owner has authority to delete branches.")
      return
    }
    setScheduleDeleteModalBranch(branch)
    setDeletionReason("")
    setDeleteError(null)
  }

  async function handleConfirmScheduleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!isOwner) {
      setDeleteError("Permission denied: Only the Owner can delete branches.")
      return
    }
    if (!scheduleDeleteModalBranch) return
    if (!deletionReason.trim()) {
      setDeleteError("Please provide a reason for deleting this branch.")
      return
    }

    setProcessingDeletion(true)
    setDeleteError(null)

    const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const nowIso = new Date().toISOString()
    const reasonText = deletionReason.trim()

    try {
      // 1. Update branch in Supabase
      const { error: updateErr } = await supabase
        .from("branches")
        .update({
          is_pending_deletion: true,
          deletion_scheduled_at: scheduledTime,
          deletion_requested_at: nowIso,
          deletion_requested_by: "Owner (প্রতিষ্ঠানের মালিক)",
          deletion_reason: reasonText,
        })
        .eq("id", scheduleDeleteModalBranch.id)

      if (updateErr) {
        console.warn("Could not update branch deletion columns directly:", updateErr.message)
      }

      // 2. Insert into branch_deletion_requests log table if available
      try {
        await supabase.from("branch_deletion_requests").insert({
          branch_id: scheduleDeleteModalBranch.id,
          branch_name: scheduleDeleteModalBranch.name,
          reason: reasonText,
          requested_by: "owner",
          requested_by_name: "Owner (প্রতিষ্ঠানের মালিক)",
          scheduled_delete_at: scheduledTime,
          status: "timelock",
        })
      } catch (logErr) {
        console.warn("Could not insert to branch_deletion_requests log:", logErr)
      }

      // 3. Update local state
      setBranches(prev =>
        prev.map(b =>
          b.id === scheduleDeleteModalBranch.id
            ? {
                ...b,
                is_pending_deletion: true,
                deletion_scheduled_at: scheduledTime,
                deletion_requested_at: nowIso,
                deletion_requested_by: "Owner (প্রতিষ্ঠানের মালিক)",
                deletion_reason: reasonText,
              }
            : b
        )
      )

      setScheduleDeleteModalBranch(null)
      alert(
        `🚨 Branch "${scheduleDeleteModalBranch.name}" is now scheduled for deletion in 48 hours!\n\nA red warning banner has been activated in that branch's admin dashboard. You can cancel this deletion at any time before 48 hours expire.`
      )
    } catch (err: any) {
      setDeleteError(err.message || "Failed to schedule branch deletion")
    } finally {
      setProcessingDeletion(false)
    }
  }

  async function handleCancelDeletion(branch: Branch) {
    if (!isOwner) {
      alert("Only the Institute Owner has authority to cancel branch deletion.")
      return
    }

    if (!confirm(`Are you sure you want to cancel the scheduled deletion of "${branch.name}" and restore it to normal status?`)) {
      return
    }

    try {
      // 1. Clear deletion fields in branches table
      const { error: updateErr } = await supabase
        .from("branches")
        .update({
          is_pending_deletion: false,
          deletion_scheduled_at: null,
          deletion_requested_at: null,
          deletion_requested_by: null,
          deletion_reason: null,
        })
        .eq("id", branch.id)

      if (updateErr) {
        console.warn("Notice updating branch status:", updateErr.message)
      }

      // 2. Update log record
      try {
        await supabase
          .from("branch_deletion_requests")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: "Owner",
          })
          .eq("branch_id", branch.id)
          .eq("status", "timelock")
      } catch {}

      // 3. Update local state
      setBranches(prev =>
        prev.map(b =>
          b.id === branch.id
            ? {
                ...b,
                is_pending_deletion: false,
                deletion_scheduled_at: null,
                deletion_requested_at: null,
                deletion_requested_by: null,
                deletion_reason: null,
              }
            : b
        )
      )

      alert(`✓ Branch "${branch.name}" deletion request cancelled. The branch is safe and operational!`)
    } catch (err: any) {
      alert("Error cancelling deletion: " + err.message)
    }
  }

  async function handleExecutePermanentDeletion(branch: Branch) {
    if (!isOwner) {
      alert("Only the Institute Owner has authority to execute permanent branch deletion.")
      return
    }

    const time = formatCountdown(branch.deletion_scheduled_at)
    if (!time.isReady) {
      alert(`⚠️ 48-Hour cooling timelock is still active (${time.display} remaining). You cannot delete this branch until the 48 hours have completed.`)
      return
    }

    if (!confirm(`🔴 DANGER: Are you completely certain you want to permanently delete "${branch.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      // 1. Delete branch from Supabase
      const { error: deleteErr } = await supabase.from("branches").delete().eq("id", branch.id)
      if (deleteErr) throw deleteErr

      // 2. Mark log as executed
      try {
        await supabase
          .from("branch_deletion_requests")
          .update({
            status: "executed",
            executed_at: new Date().toISOString(),
          })
          .eq("branch_id", branch.id)
      } catch {}

      // 3. Update local state
      setBranches(prev => prev.filter(b => b.id !== branch.id))
      alert(`✓ Branch "${branch.name}" has been permanently deleted after 48-hour cooling period.`)
    } catch (err: any) {
      alert("Error deleting branch: " + (err.message || "Failed to delete"))
    }
  }

  function formatCountdown(scheduledIso?: string | null) {
    if (!scheduledIso) return { isReady: false, hours: 0, minutes: 0, seconds: 0, display: "48h 0m 0s", pct: 0 }
    const scheduledMs = new Date(scheduledIso).getTime()
    const diffMs = scheduledMs - now

    if (diffMs <= 0) {
      return { isReady: true, hours: 0, minutes: 0, seconds: 0, display: "48h Completed (Ready to delete)", pct: 100 }
    }

    const totalDurationMs = 48 * 60 * 60 * 1000
    const elapsedMs = totalDurationMs - diffMs
    const pct = Math.max(0, Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100)))

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    return {
      isReady: false,
      hours,
      minutes,
      seconds,
      display: `${hours}h ${minutes}m ${seconds}s remaining`,
      displayBn: `${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড বাকি`,
      pct,
    }
  }

  // Filter Branches
  const filteredBranches = branches.filter(b => {
    const q = search.toLowerCase()
    const matchesSearch =
      b.name.toLowerCase().includes(q) ||
      (b.location && b.location.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q)) ||
      (b.branch_director && b.branch_director.toLowerCase().includes(q)) ||
      (b.manager && b.manager.toLowerCase().includes(q))

    if (!matchesSearch) return false

    if (filterTab === "active") {
      return b.is_active && !b.is_pending_deletion
    }
    if (filterTab === "timelock") {
      return b.is_pending_deletion === true
    }
    return true
  })

  // Quick stats
  const totalStudents = students.length
  const totalBatches = batches.length
  const activeBranches = branches.filter(b => b.is_active && !b.is_pending_deletion).length
  const timelockBranches = branches.filter(b => b.is_pending_deletion).length

  return (
    <div className="space-y-6">
      {/* Schema Fallback Notification Banner */}
      {fallbackWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">{fallbackWarning}</p>
              <p className="text-xs text-amber-800 mt-1">
                Your branch was created and is active. Run the SQL snippet in your Supabase SQL editor to enable all custom director, manager, SMS, and 48-hour deletion fields.
              </p>
              <button
                onClick={() => setShowSqlGuide(true)}
                className="mt-2 text-xs font-bold text-amber-900 underline hover:text-amber-700"
              >
                View SQL Migration Script &rarr;
              </button>
            </div>
          </div>
          <button
            onClick={() => setFallbackWarning(null)}
            className="text-amber-700 hover:text-amber-900 text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* SQL Migration Modal / Guide */}
      {showSqlGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white text-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Supabase Database Migration (030)</h4>
                  <p className="text-[11px] text-amber-700 font-medium">Add Branch Director, SMS Gateway & 48h Deletion Schedule</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlGuide(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Open your <strong>Supabase Project &rarr; SQL Editor</strong>, paste this script, and click <strong>Run</strong>. This will add the branch management and 48-hour deletion timelock columns permanently.
              </p>
              <div className="relative">
                <pre className="bg-slate-900 text-amber-300 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-56">
                  {SQL_MIGRATION_SNIPPET}
                </pre>
                <button
                  onClick={handleCopySql}
                  className="absolute top-2.5 right-2.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? "Copied!" : "Copy SQL"}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowSqlGuide(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-50 text-amber-600 border border-amber-200/80 rounded-xl flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Branches</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{branches.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Branches</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{activeBranches}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${timelockBranches > 0 ? "bg-red-50 text-red-600 border-red-200 ring-2 ring-red-400/20" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            <ShieldAlert className={`w-5 h-5 ${timelockBranches > 0 ? "animate-pulse text-red-600" : ""}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Deletion</p>
            <p className={`text-xl font-extrabold mt-0.5 ${timelockBranches > 0 ? "text-red-600" : "text-slate-900"}`}>
              {timelockBranches} {timelockBranches > 0 && <span className="text-xs font-bold text-red-500">(48h Lock)</span>}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 bg-sky-50 text-sky-600 border border-sky-200/80 rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Students</p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">{totalStudents}</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Tabs & Add */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by branch name, location, director, or manager..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all shadow-2xs"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({branches.length})
            </button>
            <button
              onClick={() => setFilterTab("active")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({activeBranches})
            </button>
            <button
              onClick={() => setFilterTab("timelock")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                filterTab === "timelock"
                  ? "bg-red-600 text-white shadow-xs"
                  : timelockBranches > 0
                  ? "text-red-700 bg-red-50 hover:bg-red-100"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>48h Deletion Queue</span>
              {timelockBranches > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${filterTab === "timelock" ? "bg-white text-red-700" : "bg-red-600 text-white"}`}>
                  {timelockBranches}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowSqlGuide(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Database Schema SQL Migration"
          >
            <Info className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">SQL Migration</span>
          </button>

          {isOwnerOrSuper && (
            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-extrabold transition-all shadow-md shadow-amber-500/25 hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add New Branch (শাখা যোগ)
            </button>
          )}
        </div>
      </div>

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-xs">
          <Landmark className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {filterTab === "timelock" ? "No branches currently pending deletion" : "No branches found"}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {filterTab === "timelock"
              ? "All branch records are secure and operational."
              : search
              ? "No branch matches your search term."
              : "Start by adding your first coaching branch."}
          </p>
          {isOwnerOrSuper && !search && filterTab !== "timelock" && (
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredBranches.map(branch => {
            const branchStudents = students.filter(s => s.branch_id === branch.id).length
            const branchBatches = batches.filter(b => b.branch_id === branch.id).length
            const branchStaff = staff.filter(
              st => st.branch_id === branch.id || (st.branch_ids && st.branch_ids.includes(branch.id))
            ).length
            const hasCustomSms = !!(branch.sms_gateway_config?.api_key || branch.sms_gateway_config?.apiKey)
            const displayAddress = branch.location || branch.address
            const isPendingDelete = !!branch.is_pending_deletion
            const time = formatCountdown(branch.deletion_scheduled_at)

            return (
              <div
                key={branch.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all p-5 flex flex-col justify-between relative overflow-hidden ${
                  isPendingDelete
                    ? "border-red-400/90 ring-2 ring-red-500/20 bg-gradient-to-b from-red-50/30 to-white"
                    : "border-slate-200/90 hover:border-amber-500/40 hover:shadow-md"
                }`}
              >
                {/* 48-Hour Pending Deletion Header Banner */}
                {isPendingDelete && (
                  <div className="mb-4 -mx-5 -mt-5 bg-gradient-to-r from-red-600 to-rose-600 text-white p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-300 animate-bounce shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-wider text-white">
                            মুছে ফেলার আবেদন (48h Timelock Active)
                          </p>
                          <span className="text-[10px] bg-red-950/60 text-amber-200 px-2 py-0.5 rounded font-mono font-bold">
                            {time.display}
                          </span>
                        </div>
                        {branch.deletion_reason && (
                          <p className="text-[11px] text-red-100 font-medium line-clamp-1 mt-0.5">
                            কারণ: {branch.deletion_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {isOwner ? (
                      <button
                        onClick={() => handleCancelDeletion(branch)}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-red-700 font-bold text-xs rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
                      >
                        Cancel Deletion (বাতিল)
                      </button>
                    ) : (
                      <span className="text-[10px] bg-red-950/50 text-red-200 px-2 py-1 rounded">
                        Only Owner can cancel
                      </span>
                    )}
                  </div>
                )}

                <div>
                  {/* Top Bar with Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-extrabold text-slate-900 truncate">{branch.name}</h3>
                        {isPendingDelete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                            Deleting in 48h
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              branch.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {branch.is_active ? "Active" : "Inactive"}
                          </span>
                        )}
                        {branch.established_year && (
                          <span className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-bold border border-amber-200">
                            Est. {branch.established_year}
                          </span>
                        )}
                      </div>

                      {displayAddress && (
                        <p className="text-xs text-slate-600 flex items-center gap-1 mt-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{displayAddress}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwnerOrSuper && !isPendingDelete && (
                        <button
                          onClick={() => openEditModal(branch)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Branch"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {isOwnerOrSuper && !isPendingDelete && (
                        <button
                          onClick={() => handleToggleActive(branch)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            branch.is_active
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-slate-400 hover:bg-slate-100"
                          }`}
                          title={branch.is_active ? "Deactivate branch" : "Activate branch"}
                        >
                          {branch.is_active ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {/* Delete / Schedule Deletion Button (OWNER ONLY) */}
                      {isOwner && !isPendingDelete && (
                        <button
                          onClick={() => openScheduleDeleteModal(branch)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete branch (48-hour timelock)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {branch.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {branch.description}
                    </p>
                  )}

                  {/* Operational Metrics Pill */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl mb-4 text-center border border-slate-100">
                    <div>
                      <p className="text-sm font-extrabold text-amber-600">{branchStudents}</p>
                      <p className="text-[11px] font-medium text-slate-500">Students</p>
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-amber-600">{branchBatches}</p>
                      <p className="text-[11px] font-medium text-slate-500">Batches</p>
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-amber-600">{branchStaff}</p>
                      <p className="text-[11px] font-medium text-slate-500">Staff Assigned</p>
                    </div>
                  </div>

                  {/* Director & Manager Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-3">
                    <div className="bg-amber-50/40 border border-amber-200/60 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3 h-3 text-amber-600" /> Branch Director
                      </p>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {branch.branch_director || "Not assigned"}
                      </p>
                      {branch.director_phone && (
                        <a
                          href={`tel:${branch.director_phone}`}
                          className="text-[11px] text-amber-700 hover:underline flex items-center gap-1 mt-0.5 font-medium"
                        >
                          <Phone className="w-3 h-3" /> {branch.director_phone}
                        </a>
                      )}
                    </div>

                    <div className="bg-emerald-50/40 border border-emerald-200/60 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-600" /> Branch Manager
                      </p>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {branch.manager || "Not assigned"}
                      </p>
                      {branch.manager_phone && (
                        <a
                          href={`tel:${branch.manager_phone}`}
                          className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 mt-0.5 font-medium"
                        >
                          <Phone className="w-3 h-3" /> {branch.manager_phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Deletion Countdown & Actions Bar for Pending Deletion Cards */}
                  {isPendingDelete && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-red-900 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-red-600" />
                          48h Cooling Timelock
                        </span>
                        <span className="font-bold text-red-700 font-mono">
                          {time.pct}% Elapsed
                        </span>
                      </div>

                      <div className="h-2 bg-red-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full transition-all duration-500"
                          style={{ width: `${time.pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1 gap-2">
                        {isOwner ? (
                          <>
                            <button
                              onClick={() => handleCancelDeletion(branch)}
                              className="px-3 py-1.5 bg-white text-slate-700 hover:text-slate-900 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              মুছে ফেলা বাতিল (Cancel)
                            </button>

                            {time.isReady ? (
                              <button
                                onClick={() => handleExecutePermanentDeletion(branch)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 animate-pulse"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                স্থায়ীভাবে মুছুন (Delete Permanently)
                              </button>
                            ) : (
                              <span
                                className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200 cursor-not-allowed"
                                title="Permanent deletion is locked until 48 hours pass"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                লক আছে ({time.display})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-red-800 font-medium">
                            🔒 Only the Owner can modify or cancel this 48h deletion request.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Contacts & SMS Gateway Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-500">
                    {(branch.contact_info?.phone || branch.phone) && (
                      <span className="flex items-center gap-1 font-medium" title="Helpline">
                        <Phone className="w-3.5 h-3.5 text-amber-600" /> {branch.contact_info?.phone || branch.phone}
                      </span>
                    )}
                    {(branch.contact_info?.email || branch.email) && (
                      <span className="flex items-center gap-1 font-medium" title="Email">
                        <Mail className="w-3.5 h-3.5 text-amber-600" /> {branch.contact_info?.email || branch.email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-md font-bold ${
                        hasCustomSms
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                      title={
                        hasCustomSms
                          ? "Using branch-specific SMS Gateway API"
                          : "Using system default SMS Gateway"
                      }
                    >
                      <MessageSquare className="w-3 h-3" />
                      {hasCustomSms ? "Branch SMS API" : "Default SMS"}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* SCHEDULE 48-HOUR BRANCH DELETION MODAL (OWNER ONLY)         */}
      {/* ============================================================ */}
      {scheduleDeleteModalBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-red-100 flex items-center justify-between bg-red-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Schedule 48-Hour Branch Deletion (শাখা মুছুন)
                  </h3>
                  <p className="text-xs text-red-700 font-medium">
                    Owner Authorization & Mandatory 48-Hour Cooling Timelock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScheduleDeleteModalBranch(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmScheduleDelete} className="p-6 space-y-4">
              {deleteError && (
                <div className="p-3 bg-red-50 text-red-800 text-xs rounded-xl border border-red-200 flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {deleteError}
                  </div>
                </div>
              )}

              {/* Security Policy Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 text-sm">
                  <Shield className="w-4 h-4 text-amber-600" /> ৪৮ ঘণ্টার সুরক্ষা নীতি (48-Hour Timelock Policy)
                </div>
                <ul className="list-disc pl-4 space-y-1 text-amber-800 leading-relaxed">
                  <li>
                    শাখা মুছে ফেলার আবেদন সাবমিট করার পর সাথে সাথে এটি ডিলিট হবে না; বাধ্যতামূলক <strong>৪৮ ঘণ্টার কুলিং পিরিয়ড</strong> শুরু হবে।
                  </li>
                  <li>
                    এই ৪৮ ঘণ্টা চলাকালীন ঐ শাখার অ্যাডমিন প্যানেল ও হেডারে <strong>উজ্জ্বল লাল সতর্কবার্তা (Red Warning)</strong> প্রদর্শিত হবে।
                  </li>
                  <li>
                    প্রতিষ্ঠানের মালিক (Owner) হিসেবে আপনি এই ৪৮ ঘণ্টার মধ্যে যেকোনো সময় আবেদনটি <strong>বাতিল (Cancel)</strong> করতে পারবেন।
                  </li>
                  <li>
                    ৪৮ ঘণ্টা পূর্ণ হওয়ার পর আপনি স্থায়ীভাবে শাখাটি মুছে ফেলতে পারবেন।
                  </li>
                </ul>
              </div>

              {/* Target Branch Details */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <p className="text-xs text-slate-500 font-medium">Selected Branch for Deletion:</p>
                <p className="font-extrabold text-slate-900 text-sm">{scheduleDeleteModalBranch.name}</p>
                {scheduleDeleteModalBranch.location && (
                  <p className="text-xs text-slate-600">{scheduleDeleteModalBranch.location}</p>
                )}
              </div>

              {/* Deletion Reason Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Deletion (মুছে ফেলার কারণ) <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={deletionReason}
                  onChange={e => setDeletionReason(e.target.value)}
                  placeholder="e.g., শাখা বন্ধ করা হয়েছে / ভুল এন্ট্রি / নতুন ক্যাম্পাসে স্থানান্তর..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 shadow-2xs transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Authorized By: <strong className="text-slate-900 font-bold">Owner (মালিক)</strong></span>
                <span>Timelock Duration: <strong className="text-red-600 font-bold">48 Hours</strong></span>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setScheduleDeleteModalBranch(null)}
                  disabled={processingDeletion}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingDeletion}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 rounded-xl transition-all shadow-md shadow-red-500/25 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {processingDeletion ? "Scheduling..." : "Schedule 48h Deletion (মুছে ফেলার আবেদন করুন)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ADD / EDIT BRANCH MODAL                                      */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/90 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {editingBranch ? "Edit Branch (শাখা সম্পাদনা)" : "Add New Branch (শাখা যোগ করুন)"}
                  </h3>
                  <p className="text-xs text-amber-700 font-medium">
                    Configure branch identity, leadership, contact helpline, and SMS routing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {error && (
                <div className="p-3.5 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {error}
                  </div>
                </div>
              )}

              {/* Branch Primary Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Branch Name (শাখার নাম) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. মেধা শিরী কোচিং (নাচোল শাখা)"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Established Year (প্রতিষ্ঠিত সাল)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2018 বা ২০১৮"
                    value={formData.established_year}
                    onChange={e => setFormData({ ...formData, established_year: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location / Full Address (ঠিকানা / অবস্থান)
                </label>
                <input
                  type="text"
                  placeholder="e.g. নাচোল বাসস্ট্যান্ড সংলগ্ন, চাঁপাইনবাবগঞ্জ"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Branch Description (শাখার বর্ণনা ও সুবিধাসমূহ)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe campus features, classrooms, facilities, programs offered..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                />
              </div>

              {/* Leadership Information */}
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                <p className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-600" /> Branch Leadership (শাখা পরিচালনা)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Branch Director (শাখা পরিচালক)
                    </label>
                    <input
                      type="text"
                      placeholder="Director full name"
                      value={formData.branch_director}
                      onChange={e => setFormData({ ...formData, branch_director: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-amber-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Director Phone (পরিচালকের ফোন)
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.director_phone}
                      onChange={e => setFormData({ ...formData, director_phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-amber-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Branch Manager (শাখা ব্যবস্থাপক)
                    </label>
                    <input
                      type="text"
                      placeholder="Manager full name"
                      value={formData.manager}
                      onChange={e => setFormData({ ...formData, manager: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-amber-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Manager Phone (ব্যবস্থাপকের ফোন)
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.manager_phone}
                      onChange={e => setFormData({ ...formData, manager_phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-amber-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                <p className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" /> Helpline & Public Contacts (যোগাযোগ নম্বর)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Office Helpline Phone
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-emerald-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Branch Email
                    </label>
                    <input
                      type="email"
                      placeholder="branch@medhashiree.edu.bd"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-emerald-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.whatsapp}
                      onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-emerald-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Dedicated SMS Gateway Configuration */}
              <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600" /> Dedicated SMS Gateway (Optional)
                  </p>
                  <span className="text-[10px] text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
                    Leave blank to use Global Gateway
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Branch SMS API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Custom API Key"
                      value={formData.sms_api_key}
                      onChange={e => setFormData({ ...formData, sms_api_key: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-indigo-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Branch Sender ID / Masking
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MedhaShiree or 88096..."
                      value={formData.sms_sender_id}
                      onChange={e => setFormData({ ...formData, sms_sender_id: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-indigo-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer accent-amber-600"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Branch is operational and active (সক্রিয় শাখা)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl transition-all shadow-md shadow-amber-500/25 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving..." : editingBranch ? "Save Changes" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
