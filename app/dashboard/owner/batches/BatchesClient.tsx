"use client"
import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  Plus, BookOpen, Users, Loader2, X, ChevronDown, Edit3, Trash2, 
  Sparkles, Calendar, Clock, DollarSign, DoorOpen, UserCheck, 
  ExternalLink, FileText, CheckCircle2, AlertCircle, Landmark, Building2
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { useBranch } from "@/components/providers/BranchContext"
import type { Branch } from "@/lib/supabase/types"

interface Teacher { id: string; name: string; subject?: string; branch_id?: string | null }
interface Room { id: string; name: string; capacity: number; branch_id?: string | null }
interface BatchData {
  id: string
  branch_id?: string | null
  name: string
  subject?: string
  class_level?: string
  teacher_id?: string
  room_id?: string
  max_seats: number
  current_seats: number
  monthly_fee: number
  admission_fee: number
  fee_type: string
  is_active: boolean
  teacher?: { name: string; subject?: string }
  branch?: { id?: string; name: string } | null
  origin_branch_id?: string | null
  origin_batch_id?: string | null
  approval_status?: "approved" | "pending_approval" | "rejected" | string
  schedule_days?: string
  schedule_time?: string
  description?: string
  image_url?: string
  classroom?: string
  branch_seats?: Record<string, number>
  status?: string
}

// Exactly the 3 requested statuses
const statusColors: Record<string, string> = {
  ongoing: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  admission_closed: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  finished: "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
}

const statusLabels: Record<string, string> = {
  ongoing: "Admission Ongoing",
  admission_closed: "Admission Closed",
  finished: "Finished"
}

export default function BatchesClient({ 
  batches: initialBatches, 
  teachers, 
  rooms, 
  branches = [],
  batchDues = {} 
}: { 
  batches: BatchData[]
  teachers: Teacher[]
  rooms: Room[]
  branches?: Branch[]
  batchDues?: Record<string, number> 
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const supabase = createClient()
  const { selectedBranchId, currentBranch } = useBranch()

  const defaultForm = {
    name: "",
    subject: "",
    class_level: "",
    branch_id: selectedBranchId !== "all" ? selectedBranchId : (branches[0]?.id || ""),
    deploy_branch_ids: [] as string[],
    branch_seats: {} as Record<string, string>,
    teacher_id: "",
    room_id: "",
    classroom: "",
    max_seats: "30",
    monthly_fee: "0",
    admission_fee: "0",
    fee_type: "monthly",
    schedule_days: "",
    schedule_time: "",
    description: "",
    status: "ongoing"
  }

  const [form, setForm] = useState(defaultForm)

  function updateForm(field: string, value: any) { 
    setForm(f => ({ ...f, [field]: value })) 
  }

  function openCreateModal() {
    const activeBranchId = selectedBranchId !== "all" 
      ? selectedBranchId 
      : (currentBranch?.id || branches[0]?.id || "")

    const initialBranchSeats: Record<string, string> = {}
    branches.forEach(b => {
      initialBranchSeats[b.id] = "30"
    })

    setForm({
      ...defaultForm,
      branch_id: activeBranchId,
      deploy_branch_ids: [],
      branch_seats: initialBranchSeats
    })
    setEditingBatch(null)
    setShowCreateModal(true)
  }

  function openEditModal(batch: BatchData) {
    const childBranches = batches
      .filter(b => b.origin_batch_id === batch.id && b.branch_id)
      .map(b => b.branch_id!)

    const initialBranchSeats: Record<string, string> = {}
    branches.forEach(b => {
      const child = batches.find(childB => childB.origin_batch_id === batch.id && childB.branch_id === b.id)
      if (child) {
        initialBranchSeats[b.id] = String(child.max_seats ?? 30)
      } else if (batch.branch_seats && batch.branch_seats[b.id]) {
        initialBranchSeats[b.id] = String(batch.branch_seats[b.id])
      } else if (b.id === batch.branch_id) {
        initialBranchSeats[b.id] = String(batch.max_seats ?? 30)
      } else {
        initialBranchSeats[b.id] = String(batch.max_seats ?? 30)
      }
    })

    setForm({
      name: batch.name || "",
      subject: batch.subject || "",
      class_level: batch.class_level || "",
      branch_id: batch.branch_id || (branches[0]?.id || ""),
      deploy_branch_ids: childBranches,
      branch_seats: initialBranchSeats,
      teacher_id: batch.teacher_id || "",
      room_id: batch.room_id || "",
      classroom: batch.classroom || "",
      max_seats: String(batch.max_seats ?? 30),
      monthly_fee: String(batch.monthly_fee ?? 0),
      admission_fee: String(batch.admission_fee ?? 0),
      fee_type: batch.fee_type || "monthly",
      schedule_days: batch.schedule_days || "",
      schedule_time: batch.schedule_time || "",
      description: batch.description || "",
      status: batch.status || "ongoing"
    })
    setEditingBatch(batch)
    setShowCreateModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Please enter a batch name")
      return
    }
    setLoading(true)
    try {
      const selectedBranches = [
        form.branch_id,
        ...form.deploy_branch_ids.filter(id => id && id !== form.branch_id)
      ]

      const payload = {
        id: editingBatch?.id,
        name: form.name.trim(),
        branch_id: form.branch_id || null,
        selected_branch_ids: selectedBranches,
        branch_seats: form.branch_seats,
        subject: form.subject.trim() || null,
        class_level: form.class_level.trim() || null,
        teacher_id: form.teacher_id || null,
        room_id: form.room_id || null,
        classroom: form.classroom.trim(),
        max_seats: parseInt(form.max_seats) || 30,
        monthly_fee: parseFloat(form.monthly_fee) || 0,
        admission_fee: parseFloat(form.admission_fee) || 0,
        fee_type: form.fee_type,
        schedule_days: form.schedule_days.trim() || null,
        schedule_time: form.schedule_time.trim() || null,
        description: form.description.trim() || null,
        status: form.status || "ongoing"
      }

      const res = await fetch("/api/batches/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save batch")
      }

      if (editingBatch) {
        if (data.batch) {
          setBatches(prev => prev.map(b => b.id === editingBatch.id ? { ...b, ...data.batch } : b))
        }
        toast.success(data.message || `Batch "${payload.name}" updated successfully!`)
      } else {
        if (data.batch) {
          setBatches(prev => [data.batch, ...prev])
        }
        toast.success(data.message || `Batch "${payload.name}" created successfully!`)
      }

      setShowCreateModal(false)
      setEditingBatch(null)
      setForm(defaultForm)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save batch")
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveBatch(batch: BatchData) {
    try {
      const { data, error } = await supabase
        .from("batches")
        .update({
          approval_status: "approved",
          is_active: true
        })
        .eq("id", batch.id)
        .select("*, teacher:staff(name, subject), branch:branches(id, name)")
        .single()

      if (error) throw error
      setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, ...data, approval_status: "approved", is_active: true } : b))
      toast.success(`ব্যাচ "${batch.name}" সফলভাবে অনুমোদন ও লাইভ করা হয়েছে! ✅`)
    } catch (err: any) {
      toast.error(err.message || "Failed to approve batch")
    }
  }

  async function handleRejectBatch(batch: BatchData) {
    if (!confirm(`আপনি কি "${batch.name}" ব্যাচটির অনুমোদন বাতিল করতে চান?`)) return
    try {
      const { error } = await supabase
        .from("batches")
        .update({
          approval_status: "rejected",
          is_active: false
        })
        .eq("id", batch.id)

      if (error) throw error
      setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, approval_status: "rejected", is_active: false } : b))
      toast.info(`ব্যাচ "${batch.name}" বাতিল করা হয়েছে।`)
    } catch (err: any) {
      toast.error(err.message || "Failed to reject batch")
    }
  }

  async function handleStatusChange(batchId: string, newStatus: string) {
    try {
      const batchObj = batches.find(b => b.id === batchId)
      const res = await fetch("/api/batches/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: batchId,
          name: batchObj?.name || "Batch",
          status: newStatus,
          branch_id: batchObj?.branch_id
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        const { error } = await supabase.from("batches").update({ status: newStatus }).eq("id", batchId)
        if (error) throw error
      }
      setBatches(batches.map(b => b.id === batchId ? { ...b, status: newStatus } : b))
      toast.success(`Status updated to ${statusLabels[newStatus] || newStatus}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    }
  }

  async function handleDelete(batch: BatchData) {
    if (!confirm(`Are you sure you want to delete batch "${batch.name}"? This cannot be undone.`)) return
    setDeletingId(batch.id)
    try {
      const { error } = await supabase.from("batches").delete().eq("id", batch.id)
      if (error) throw error
      setBatches(batches.filter(b => b.id !== batch.id))
      toast.success(`Batch "${batch.name}" deleted`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete batch. Check if students are enrolled.")
    } finally {
      setDeletingId(null)
    }
  }

  // Count pending batches for current branch view
  const pendingCount = useMemo(() => {
    return batches.filter(b => {
      const matchBranch = selectedBranchId === "all" || b.branch_id === selectedBranchId
      return matchBranch && b.approval_status === "pending_approval"
    }).length
  }, [batches, selectedBranchId])

  // Filter tabs
  const filterTabs = useMemo(() => {
    const tabs = [
      { key: "All", label: "All Batches" },
      { key: "ongoing", label: "Admission Ongoing" },
      { key: "admission_closed", label: "Admission Closed" },
      { key: "finished", label: "Finished" }
    ]
    if (pendingCount > 0) {
      tabs.push({ key: "pending_approval", label: `Pending Approval (${pendingCount})` })
    }
    return tabs
  }, [pendingCount])

  // Filter batches
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      // 1. Branch filter
      if (selectedBranchId !== "all" && b.branch_id && b.branch_id !== selectedBranchId) {
        return false
      }

      // 2. Pending Approval tab
      if (filterStatus === "pending_approval") {
        return b.approval_status === "pending_approval"
      }

      // If viewing other specific tabs, match status
      if (filterStatus !== "All") {
        return (b.status || "ongoing") === filterStatus && b.approval_status !== "pending_approval"
      }

      return true
    })
  }, [batches, selectedBranchId, filterStatus])

  // Branch-filtered teachers & classrooms for the modal form
  const branchTeachers = useMemo(() => {
    if (!form.branch_id) return teachers
    return teachers.filter(t => !t.branch_id || t.branch_id === form.branch_id)
  }, [teachers, form.branch_id])

  const branchRooms = useMemo(() => {
    if (!form.branch_id) return rooms
    return rooms.filter(r => !r.branch_id || r.branch_id === form.branch_id)
  }, [rooms, form.branch_id])

  const ic = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
  const lbl = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"

  return (
    <div className="space-y-6">
      {/* Pending Approval Alert Banner */}
      {pendingCount > 0 && filterStatus !== "pending_approval" && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                {pendingCount} টি ব্যাচ অন্য শাখা থেকে পাঠানো হয়েছে যা এখনো অনুমোদন অপেক্ষায় রয়েছে।
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5">
                শাখার ম্যানেজার অথবা এডমিন অনুমোদন করলেই ব্যাচটি এই শাখায় সরাসরি লাইভ হয়ে যাবে।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterStatus("pending_approval")}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all shrink-0"
          >
            অনুমোদন পেইজে যান (Review {pendingCount})
          </button>
        </div>
      )}

      {/* Top action & filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {filterTabs.map(tab => {
            const active = filterStatus === tab.key
            const isPendingTab = tab.key === "pending_approval"
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  active 
                    ? isPendingTab
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-500 text-white shadow-xs" 
                    : isPendingTab
                    ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  active 
                    ? "bg-white/20 text-white" 
                    : isPendingTab 
                    ? "bg-amber-200 text-amber-800 font-extrabold" 
                    : "bg-slate-200 text-slate-600"
                }`}>
                  {tab.key === "All" 
                    ? filteredBatches.length 
                    : tab.key === "pending_approval"
                    ? pendingCount
                    : batches.filter(b => (b.status || "ongoing") === tab.key && b.approval_status !== "pending_approval").length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Create Button */}
        <button
          type="button"
          onClick={openCreateModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-500/20 hover:scale-[1.02] transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Batch
        </button>
      </div>

      {/* Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBatches.map(batch => {
          const pct = Math.round((batch.current_seats / Math.max(batch.max_seats, 1)) * 100)
          const currentStatus = (batch.status === "admission_closed" || batch.status === "finished") 
            ? batch.status 
            : "ongoing"
          const totalDue = batchDues[batch.id] || 0
          const seatsLeft = Math.max(0, batch.max_seats - (batch.current_seats || 0))
          const isPending = batch.approval_status === "pending_approval"
          const originBranch = batch.origin_branch_id ? branches.find(b => b.id === batch.origin_branch_id) : null
          const batchBranch = batch.branch?.name 
            ? batch.branch.name 
            : branches.find(b => b.id === batch.branch_id)?.name

          return (
            <div 
              key={batch.id} 
              className={`bg-white rounded-2xl border ${
                isPending 
                  ? "border-amber-400 ring-2 ring-amber-400/20 shadow-lg" 
                  : "border-slate-200/90 shadow-sm"
              } hover:border-amber-500/40 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden group`}
            >
              {/* Header color accent */}
              <div className={`h-1.5 w-full ${
                isPending
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse"
                  : currentStatus === "ongoing" 
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500" 
                  : currentStatus === "admission_closed" 
                  ? "bg-gradient-to-r from-amber-400 to-orange-500" 
                  : "bg-slate-400"
              }`} />

              <div className="p-5 space-y-4">
                {/* Branch Badge & Status Tag */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80">
                    <Building2 className="w-3 h-3 text-indigo-600" />
                    {batchBranch || "All Branches"}
                  </span>

                  {isPending ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      <Clock className="w-3 h-3 text-amber-700" /> Awaiting Approval (অপেক্ষমান)
                    </span>
                  ) : (
                    <div className="relative shrink-0">
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(batch.id, e.target.value)}
                        className={`text-[11px] font-bold py-1 pl-2.5 pr-6 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all ${
                          currentStatus === "ongoing"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : currentStatus === "admission_closed"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        <option value="ongoing">Admission Ongoing</option>
                        <option value="admission_closed">Admission Closed</option>
                        <option value="finished">Finished</option>
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                  )}
                </div>

                {/* Batch Title and Subject */}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-slate-900 text-base truncate leading-tight group-hover:text-amber-600 transition-colors">
                      {batch.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
                      {batch.subject || "General"} {batch.class_level ? `• ${batch.class_level}` : ""}
                    </p>
                  </div>
                </div>

                {/* Pending Approval Callout Box */}
                {isPending && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="text-xs text-amber-950 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Created from: <b>{originBranch?.name || "Main Branch"}</b>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApproveBatch(batch)}
                        className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Make Live
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectBatch(batch)}
                        className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Seats progress bar */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      {batch.current_seats} / {batch.max_seats} Enrolled
                    </span>
                    <span className={`text-[11px] font-bold ${seatsLeft <= 5 && seatsLeft > 0 ? "text-rose-600" : "text-slate-500"}`}>
                      {seatsLeft === 0 ? "Full" : `${seatsLeft} seats left`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                      }`} 
                      style={{ width: `${Math.min(100, pct)}%` }} 
                    />
                  </div>
                </div>

                {/* Details list */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-medium">Monthly Fee</p>
                    <p className="font-extrabold text-amber-700 text-sm">{formatCurrency(batch.monthly_fee)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-medium">Admission Fee</p>
                    <p className="font-bold text-slate-800 text-sm">{batch.admission_fee > 0 ? formatCurrency(batch.admission_fee) : "Free"}</p>
                  </div>
                </div>

                {/* Teacher & Schedule */}
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Teacher: <b className="text-slate-900">{batch.teacher?.name || "Unassigned"}</b></span>
                  </div>
                  {batch.classroom && (
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px]">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Classroom: <b className="text-slate-900">{batch.classroom}</b></span>
                    </div>
                  )}
                  {(batch.schedule_days || batch.schedule_time) && (
                    <div className="flex items-center gap-1.5 text-amber-900 font-medium bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{batch.schedule_days} {batch.schedule_time ? `• ${batch.schedule_time}` : ""}</span>
                    </div>
                  )}
                  {totalDue > 0 && (
                    <div className="flex items-center justify-between text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 font-bold">
                      <span>Total Pending Dues:</span>
                      <span>{formatCurrency(totalDue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <Link
                  href={`/batch/${batch.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Public View
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(batch)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" /> Edit Info
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === batch.id}
                    onClick={() => handleDelete(batch)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Batch"
                  >
                    {deletingId === batch.id ? <Loader2 className="w-4 h-4 animate-spin text-rose-600" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filteredBatches.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center shadow-xs">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-800 font-bold text-base">No batches found</p>
            <p className="text-slate-500 text-xs mt-1">Try switching tabs or create a new batch.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-xs font-bold hover:scale-[1.02] shadow-md shadow-amber-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Create Batch
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Batch Modal */}
      {(showCreateModal || editingBatch) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-2xl shadow-2xl overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-transparent p-5 text-slate-900 flex items-center justify-between shrink-0 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-center text-amber-600">
                  {editingBatch ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {editingBatch ? `Edit Batch: ${editingBatch.name}` : "Create New Batch"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingBatch ? "Update schedule, fees, teacher, room, or admission status" : "Set up a new coaching program batch tied to branch"}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setShowCreateModal(false); setEditingBatch(null) }} 
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Branch & Seat Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Branch & Seat Allocation (শাখা ও আসন নির্ধারণ)</h4>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                  {/* Primary Branch Selection */}
                  <div>
                    <label className={lbl}>Primary Branch (মূল শাখা) *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
                      {branches.map(b => {
                        const isPrimary = form.branch_id === b.id
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              updateForm("branch_id", b.id)
                              setForm(f => ({
                                ...f,
                                branch_id: b.id,
                                deploy_branch_ids: f.deploy_branch_ids.filter(id => id !== b.id)
                              }))
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                              isPrimary
                                ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <span className="truncate">{b.name}</span>
                            {isPrimary && (
                              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-extrabold uppercase">
                                Primary
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Primary Branch Seats */}
                  <div className="pt-3 border-t border-slate-200">
                    <div className="max-w-xs">
                      <label className={lbl}>
                        Seats for {branches.find(b => b.id === form.branch_id)?.name || "Primary Branch"} *
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          min="1"
                          required
                          value={form.max_seats}
                          onChange={e => {
                            const val = e.target.value
                            updateForm("max_seats", val)
                            setForm(f => ({
                              ...f,
                              branch_seats: { ...f.branch_seats, [f.branch_id]: val }
                            }))
                          }}
                          className={`${ic} font-bold pr-12`}
                          placeholder="30"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                          Seats
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Additional Branches Mark Select (Available in BOTH Create & Edit) */}
                  {branches.length > 1 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Landmark className="w-3.5 h-3.5 text-amber-600" />
                          Deploy to Other Branches (অন্যান্য শাখায় মার্ক করে যুক্ত করুন)
                        </label>
                        <span className="text-[11px] text-slate-500 font-medium">প্রতি শাখার জন্য নির্দিষ্ট সিট সংখ্যা দিন</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        নিচের শাখাগুলোতে এই ব্যাচ পরিচালনা করতে চাইলে টিক দিন এবং প্রতি শাখার সিট সংখ্যা লিখে দিন।
                      </p>

                      <div className="space-y-2 pt-1">
                        {branches
                          .filter(b => b.id !== form.branch_id)
                          .map(b => {
                            const isChecked = form.deploy_branch_ids.includes(b.id)
                            const branchSeatVal = form.branch_seats[b.id] ?? form.max_seats ?? "30"
                            return (
                              <div
                                key={b.id}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                                  isChecked
                                    ? "bg-amber-50/70 border-amber-300"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <label className="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setForm(f => ({
                                          ...f,
                                          deploy_branch_ids: [...f.deploy_branch_ids, b.id],
                                          branch_seats: {
                                            ...f.branch_seats,
                                            [b.id]: f.branch_seats[b.id] || f.max_seats || "30"
                                          }
                                        }))
                                      } else {
                                        setForm(f => ({
                                          ...f,
                                          deploy_branch_ids: f.deploy_branch_ids.filter(id => id !== b.id)
                                        }))
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                                  />
                                  <span className="text-xs font-bold text-slate-800">{b.name}</span>
                                </label>

                                {isChecked && (
                                  <div className="flex items-center gap-2 pl-6 sm:pl-0">
                                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Seats (সিট):</span>
                                    <input
                                      type="number"
                                      min="1"
                                      required
                                      value={branchSeatVal}
                                      onChange={e => {
                                        const val = e.target.value
                                        setForm(f => ({
                                          ...f,
                                          branch_seats: { ...f.branch_seats, [b.id]: val }
                                        }))
                                      }}
                                      className="w-24 px-2.5 py-1 text-xs border border-amber-300 rounded-lg bg-white font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                                      placeholder="30"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 1: Basic Information */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">General Information</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="md:col-span-2">
                    <label className={lbl}>Batch Name *</label>
                    <input 
                      required 
                      value={form.name} 
                      onChange={e => updateForm("name", e.target.value)} 
                      className={ic} 
                      placeholder="e.g., HSC 2026 Physics First Paper" 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Status *</label>
                    <select 
                      value={form.status} 
                      onChange={e => updateForm("status", e.target.value)} 
                      className={`${ic} font-bold`}
                    >
                      <option value="ongoing">Admission Ongoing</option>
                      <option value="admission_closed">Admission Closed</option>
                      <option value="finished">Finished</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Subject</label>
                    <input 
                      value={form.subject} 
                      onChange={e => updateForm("subject", e.target.value)} 
                      className={ic} 
                      placeholder="e.g., Physics, Chemistry, Math" 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Class / Level</label>
                    <input 
                      value={form.class_level} 
                      onChange={e => updateForm("class_level", e.target.value)} 
                      className={ic} 
                      placeholder="e.g., Class 10, HSC 2025" 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Max Seats Capacity *</label>
                    <input 
                      type="number" 
                      min="1" 
                      required 
                      value={form.max_seats} 
                      onChange={e => updateForm("max_seats", e.target.value)} 
                      className={ic} 
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Teacher & Room Allocation */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Teacher & Classroom</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={lbl}>Assigned Teacher</label>
                    <select 
                      value={form.teacher_id} 
                      onChange={e => updateForm("teacher_id", e.target.value)} 
                      className={ic}
                    >
                      <option value="">-- No Teacher Assigned --</option>
                      {branchTeachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.subject ? `(${t.subject})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Classroom / Lab (রুম বা ল্যাব নং)</label>
                    <input 
                      type="text"
                      value={form.classroom} 
                      onChange={e => updateForm("classroom", e.target.value)} 
                      className={ic}
                      placeholder="e.g. Room 201, Lab 3, Ground Floor Hall"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">ক্লাসরুম বা ল্যাবের নাম/নম্বর লিখে দিন</p>
                  </div>
                </div>
              </div>

              {/* Section 3: Pricing & Fees */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Fee Structure</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className={lbl}>Monthly Tuition Fee (৳) *</label>
                    <input 
                      type="number" 
                      min="0" 
                      required 
                      value={form.monthly_fee} 
                      onChange={e => updateForm("monthly_fee", e.target.value)} 
                      className={`${ic} font-extrabold text-amber-700`} 
                      placeholder="0" 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Admission / Registration Fee (৳)</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={form.admission_fee} 
                      onChange={e => updateForm("admission_fee", e.target.value)} 
                      className={ic} 
                      placeholder="0" 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Billing Cycle</label>
                    <select 
                      value={form.fee_type} 
                      onChange={e => updateForm("fee_type", e.target.value)} 
                      className={ic}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="one_time">One-Time Complete Course</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Schedule */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Class Schedule & Timings</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={lbl}>Schedule Days</label>
                    <input 
                      value={form.schedule_days} 
                      onChange={e => updateForm("schedule_days", e.target.value)} 
                      className={ic} 
                      placeholder="e.g., Sat, Mon, Wed or Sun, Tue, Thu" 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Class Time</label>
                    <input 
                      value={form.schedule_time} 
                      onChange={e => updateForm("schedule_time", e.target.value)} 
                      className={ic} 
                      placeholder="e.g., 9:00 AM - 10:30 AM" 
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Public Description */}
              <div className="pt-2 border-t border-slate-200">
                <label className={lbl}>Public Description (Shown on Website & Portal)</label>
                <textarea 
                  value={form.description} 
                  onChange={e => updateForm("description", e.target.value)} 
                  className={ic} 
                  rows={3} 
                  placeholder="Provide brief details about curriculum, target exam, highlights for students and parents..." 
                />
              </div>

              {/* Sticky bottom submit bar */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button 
                  type="button" 
                  onClick={() => { setShowCreateModal(false); setEditingBatch(null) }} 
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50 hover:scale-[1.02]"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : editingBatch ? (
                    <><CheckCircle2 className="w-4 h-4" /> Save Changes</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create Batch</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
