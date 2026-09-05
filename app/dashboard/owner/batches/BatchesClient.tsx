"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { 
  Plus, BookOpen, Users, Loader2, X, ChevronDown, Edit3, Trash2, 
  Sparkles, Calendar, Clock, DollarSign, DoorOpen, UserCheck, 
  ExternalLink, FileText, CheckCircle2, AlertCircle
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { useBranch } from "@/components/providers/BranchContext"

interface Teacher { id: string; name: string; subject?: string }
interface Room { id: string; name: string; capacity: number }
interface BatchData {
  id: string; name: string; subject?: string; class_level?: string; teacher_id?: string
  room_id?: string; max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
  fee_type: string; is_active: boolean; teacher?: { name: string; subject?: string }
  schedule_days?: string; schedule_time?: string; description?: string; image_url?: string;
  status?: string;
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

const statusBadgeDot: Record<string, string> = {
  ongoing: "bg-emerald-500 animate-pulse",
  admission_closed: "bg-amber-500",
  finished: "bg-gray-400"
}

export default function BatchesClient({ 
  batches: initialBatches, 
  teachers, 
  rooms, 
  batchDues = {} 
}: { 
  batches: BatchData[]; 
  teachers: Teacher[]; 
  rooms: Room[]; 
  batchDues?: Record<string, number> 
}) {
  const [batches, setBatches] = useState(initialBatches)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState<BatchData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const supabase = createClient()

  const defaultForm = {
    name: "",
    subject: "",
    class_level: "",
    teacher_id: "",
    room_id: "",
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

  function updateForm(field: string, value: string) { 
    setForm(f => ({ ...f, [field]: value })) 
  }

  function openCreateModal() {
    setForm(defaultForm)
    setEditingBatch(null)
    setShowCreateModal(true)
  }

  function openEditModal(batch: BatchData) {
    setForm({
      name: batch.name || "",
      subject: batch.subject || "",
      class_level: batch.class_level || "",
      teacher_id: batch.teacher_id || "",
      room_id: batch.room_id || "",
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
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Please enter a batch name")
      return
    }
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim() || null,
        class_level: form.class_level.trim() || null,
        teacher_id: form.teacher_id || null,
        room_id: form.room_id || null,
        max_seats: parseInt(form.max_seats) || 30,
        monthly_fee: parseFloat(form.monthly_fee) || 0,
        admission_fee: parseFloat(form.admission_fee) || 0,
        fee_type: form.fee_type,
        schedule_days: form.schedule_days.trim() || null,
        schedule_time: form.schedule_time.trim() || null,
        description: form.description.trim() || null,
        status: form.status || "ongoing"
      }

      if (editingBatch) {
        // Update batch
        const { data, error } = await supabase
          .from("batches")
          .update(payload)
          .eq("id", editingBatch.id)
          .select("*, teacher:staff(name, subject)")
          .single()

        if (error) throw error
        setBatches(batches.map(b => b.id === editingBatch.id ? { ...b, ...data } : b))
        setEditingBatch(null)
        toast.success(`Batch "${payload.name}" updated successfully!`)
      } else {
        // Create batch
        const { data, error } = await supabase
          .from("batches")
          .insert(payload)
          .select("*, teacher:staff(name, subject)")
          .single()

        if (error) throw error
        setBatches([data, ...batches])
        setShowCreateModal(false)
        toast.success(`Batch "${payload.name}" created successfully!`)
      }
      setForm(defaultForm)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save batch")
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(batchId: string, newStatus: string) {
    try {
      const { error } = await supabase.from("batches").update({ status: newStatus }).eq("id", batchId)
      if (error) throw error
      setBatches(batches.map(b => b.id === batchId ? { ...b, status: newStatus } : b))
      toast.success(`Status updated to ${statusLabels[newStatus] || newStatus}`)
    } catch (err: unknown) {
      toast.error("Failed to update status")
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

  // Filter tabs: All, Admission Ongoing, Admission Closed, Finished
  const filterTabs = [
    { key: "All", label: "All Batches" },
    { key: "ongoing", label: "Admission Ongoing" },
    { key: "admission_closed", label: "Admission Closed" },
    { key: "finished", label: "Finished" }
  ]

  const { selectedBranchId } = useBranch()

  const filteredBatches = batches.filter(b => {
    if (selectedBranchId !== "all" && (b as any).branch_id && (b as any).branch_id !== selectedBranchId) {
      return false
    }
    if (filterStatus === "All") return true
    const current = b.status || "ongoing"
    return current === filterStatus
  })

  const ic = "w-full px-3.5 py-2.5 border border-slate-700 rounded-xl text-sm text-white bg-slate-950 focus:outline-none focus:border-amber-400 placeholder:text-slate-500 transition-all shadow-sm"
  const lbl = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"

  return (
    <div className="space-y-6">
      {/* Top action & filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-200">
          {filterTabs.map(tab => {
            const active = filterStatus === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  active 
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-xs" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${active ? "bg-amber-500/20 text-amber-300" : "text-slate-500"}`}>
                  {tab.key === "All" ? batches.length : batches.filter(b => (b.status || "ongoing") === tab.key).length}
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

          return (
            <div 
              key={batch.id} 
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:border-amber-500/40 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
            >
              {/* Header color accent */}
              <div className={`h-1.5 w-full ${
                currentStatus === "ongoing" 
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500" 
                  : currentStatus === "admission_closed" 
                  ? "bg-gradient-to-r from-amber-400 to-orange-500" 
                  : "bg-slate-700"
              }`} />

              <div className="p-5 space-y-4">
                {/* Header row: title, subject, status selector */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 transition-transform">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-base truncate leading-tight group-hover:text-amber-400 transition-colors">
                        {batch.name}
                      </h3>
                      <p className="text-xs font-medium text-slate-400 mt-0.5 truncate">
                        {batch.subject || "General"} {batch.class_level ? `• ${batch.class_level}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Quick status dropdown */}
                  <div className="relative shrink-0">
                    <select
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(batch.id, e.target.value)}
                      className={`text-[11px] font-bold py-1 pl-2.5 pr-6 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all ${
                        currentStatus === "ongoing"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : currentStatus === "admission_closed"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      <option value="ongoing" className="bg-slate-900 text-white">Admission Ongoing</option>
                      <option value="admission_closed" className="bg-slate-900 text-white">Admission Closed</option>
                      <option value="finished" className="bg-slate-900 text-white">Finished</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>
                </div>

                {/* Seats progress bar */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      {batch.current_seats} / {batch.max_seats} Enrolled
                    </span>
                    <span className={`text-[11px] ${seatsLeft <= 5 && seatsLeft > 0 ? "text-red-400 font-bold" : "text-slate-400"}`}>
                      {seatsLeft === 0 ? "Full" : `${seatsLeft} seats left`}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-200">
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
                    <p className="text-[10px] text-slate-400 font-medium">Monthly Fee</p>
                    <p className="font-extrabold text-amber-400 text-sm">{formatCurrency(batch.monthly_fee)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <p className="text-[10px] text-slate-400 font-medium">Admission Fee</p>
                    <p className="font-bold text-slate-200 text-sm">{batch.admission_fee > 0 ? formatCurrency(batch.admission_fee) : "Free"}</p>
                  </div>
                </div>

                {/* Teacher & Schedule */}
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Teacher: <b className="text-white">{batch.teacher?.name || "Unassigned"}</b></span>
                  </div>
                  {(batch.schedule_days || batch.schedule_time) && (
                    <div className="flex items-center gap-1.5 text-amber-300 font-medium bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{batch.schedule_days} {batch.schedule_time ? `• ${batch.schedule_time}` : ""}</span>
                    </div>
                  )}
                  {totalDue > 0 && (
                    <div className="flex items-center justify-between text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/25 font-bold">
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
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Public View
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(batch)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Info
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === batch.id}
                    onClick={() => handleDelete(batch)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Batch"
                  >
                    {deletingId === batch.id ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filteredBatches.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center shadow-xl">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-white font-bold text-base">No batches found</p>
            <p className="text-slate-400 text-xs mt-1">Try switching tabs or create a new batch.</p>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full text-slate-900 max-w-2xl shadow-2xl overflow-hidden border border-slate-200 text-white animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-950 via-[#0f172a] to-slate-900 p-5 text-white flex items-center justify-between shrink-0 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-center text-amber-400">
                  {editingBatch ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {editingBatch ? `Edit Batch: ${editingBatch.name}` : "Create New Batch"}
                  </h3>
                  <p className="text-xs text-amber-400/90 font-medium">
                    {editingBatch ? "Update schedule, fees, teacher, room, or admission status" : "Set up a new coaching program batch for students"}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setShowCreateModal(false); setEditingBatch(null) }} 
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Section 1: Basic Information */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">General Information</h4>
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
                      <option value="ongoing" className="bg-slate-900 text-white">Admission Ongoing</option>
                      <option value="admission_closed" className="bg-slate-900 text-white">Admission Closed</option>
                      <option value="finished" className="bg-slate-900 text-white">Finished</option>
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
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Teacher & Classroom</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={lbl}>Assigned Teacher</label>
                    <select 
                      value={form.teacher_id} 
                      onChange={e => updateForm("teacher_id", e.target.value)} 
                      className={ic}
                    >
                      <option value="" className="bg-slate-900 text-white">-- No Teacher Assigned --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                          {t.name} {t.subject ? `(${t.subject})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Classroom / Lab</label>
                    <select 
                      value={form.room_id} 
                      onChange={e => updateForm("room_id", e.target.value)} 
                      className={ic}
                    >
                      <option value="" className="bg-slate-900 text-white">-- Select Classroom --</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                          {r.name} ({r.capacity} seats capacity)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Pricing & Fees */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Fee Structure</h4>
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
                      className={`${ic} font-extrabold text-amber-400`} 
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
                      <option value="monthly" className="bg-slate-900 text-white">Monthly</option>
                      <option value="quarterly" className="bg-slate-900 text-white">Quarterly</option>
                      <option value="one_time" className="bg-slate-900 text-white">One-Time Complete Course</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Schedule */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Class Schedule & Timings</h4>
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
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-900">
                <button 
                  type="button" 
                  onClick={() => { setShowCreateModal(false); setEditingBatch(null) }} 
                  className="px-5 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-semibold hover:bg-slate-800 hover:text-white text-sm transition-colors"
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
