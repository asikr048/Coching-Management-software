"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, BookOpen, Users, Loader2, X, ChevronDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

interface Teacher { id: string; name: string; subject?: string }
interface Room { id: string; name: string; capacity: number }
interface BatchData {
  id: string; name: string; subject?: string; class_level?: string; teacher_id?: string
  max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
  fee_type: string; is_active: boolean; teacher?: { name: string; subject?: string }
  schedule_days?: string; schedule_time?: string; description?: string; image_url?: string;
  status?: string;
}

const statusColors: Record<string, string> = {
  ongoing: "bg-emerald-100 text-emerald-700",
  upcoming: "bg-blue-100 text-blue-700",
  started: "bg-indigo-100 text-indigo-700",
  admission_closed: "bg-orange-100 text-orange-700",
  finished: "bg-gray-100 text-gray-700"
}
const statusLabels: Record<string, string> = {
  ongoing: "Ongoing", upcoming: "Upcoming", started: "Started", admission_closed: "Admission Closed", finished: "Finished"
}

export default function BatchesClient({ batches: initialBatches, teachers, rooms, batchDues = {} }: { batches: BatchData[]; teachers: Teacher[]; rooms: Room[], batchDues?: Record<string, number> }) {
  const [batches, setBatches] = useState(initialBatches)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const supabase = createClient()
  const [form, setForm] = useState({ name: "", subject: "", class_level: "", teacher_id: "", room_id: "", max_seats: "30", monthly_fee: "0", admission_fee: "0", fee_type: "monthly", schedule_days: "", schedule_time: "", description: "", status: "ongoing" })

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.from("batches").insert({
        name: form.name, subject: form.subject || null, class_level: form.class_level || null,
        teacher_id: form.teacher_id || null, room_id: form.room_id || null,
        max_seats: parseInt(form.max_seats), monthly_fee: parseFloat(form.monthly_fee),
        admission_fee: parseFloat(form.admission_fee), fee_type: form.fee_type,
        schedule_days: form.schedule_days || null, schedule_time: form.schedule_time || null,
        description: form.description || null, status: form.status || "ongoing"
      }).select("*, teacher:staff(name, subject)").single()
      if (error) throw error
      setBatches([data, ...batches])
      setShowModal(false)
      setForm({ name: "", subject: "", class_level: "", teacher_id: "", room_id: "", max_seats: "30", monthly_fee: "0", admission_fee: "0", fee_type: "monthly", schedule_days: "", schedule_time: "", description: "", status: "ongoing" })
      toast.success(`Batch "${form.name}" created!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create batch")
    } finally { setLoading(false) }
  }

  async function handleStatusChange(batchId: string, newStatus: string) {
    try {
      const { error } = await supabase.from("batches").update({ status: newStatus }).eq("id", batchId)
      if (error) throw error
      setBatches(batches.map(b => b.id === batchId ? { ...b, status: newStatus } : b))
      toast.success("Status updated")
    } catch (err: unknown) {
      toast.error("Failed to update status")
    }
  }

  const filteredBatches = batches.filter(b => filterStatus === "All" || (b.status || "ongoing") === filterStatus.toLowerCase().replace(" ", "_"))

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"

  const filterTabs = ["All", "Ongoing", "Upcoming", "Started", "Admission Closed", "Finished"]

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === tab ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBatches.map(batch => {
          const pct = Math.round((batch.current_seats / Math.max(batch.max_seats, 1)) * 100)
          const currentStatus = batch.status || "ongoing"
          const totalDue = batchDues[batch.id] || 0
          
          return (
            <div key={batch.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow relative group">
              <Link href={`/batch/${batch.id}`} className="absolute inset-0 z-0"></Link>
              <div className="flex items-start justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 rounded-lg"><BookOpen className="w-4 h-4 text-indigo-600" /></div>
                  <div><p className="font-semibold text-gray-800 text-sm">{batch.name}</p><p className="text-xs text-gray-500">{batch.subject || batch.class_level || "General"}</p></div>
                </div>
                
                <div className="relative inline-block">
                  <select 
                    className={`appearance-none px-2.5 py-1 pr-6 rounded-full text-xs font-medium cursor-pointer border-0 outline-none focus:ring-2 focus:ring-indigo-500 ${statusColors[currentStatus]}`}
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(batch.id, e.target.value)}
                  >
                    {Object.entries(statusLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1.5 pointer-events-none opacity-60" />
                </div>
              </div>
              
              <div className="space-y-2 relative z-10 pointer-events-none">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600"><Users className="w-3.5 h-3.5" /><span>{batch.current_seats}/{batch.max_seats} enrolled</span></div>
                  {totalDue > 0 && <div className="text-orange-600 font-medium text-xs">Due: {formatCurrency(totalDue)}</div>}
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>Teacher: {batch.teacher?.name || "Unassigned"}</span>
                  <span className="font-medium text-gray-700">{formatCurrency(batch.monthly_fee)}/mo</span>
                </div>
                {(batch.schedule_days || batch.schedule_time) && (
                  <div className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1.5 mt-1">
                    📅 {batch.schedule_days}{batch.schedule_time ? ` • ${batch.schedule_time}` : ""}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {filteredBatches.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No batches found for this filter.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 relative z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New Batch</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Batch Name *</label><input required value={form.name} onChange={e => update("name", e.target.value)} className={inputClass} placeholder="e.g., Physics Morning Batch" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject</label><input value={form.subject} onChange={e => update("subject", e.target.value)} className={inputClass} placeholder="Physics" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Class Level</label><input value={form.class_level} onChange={e => update("class_level", e.target.value)} className={inputClass} placeholder="HSC" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => update("status", e.target.value)} className={inputClass}>
                    {Object.entries(statusLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                  <select value={form.teacher_id} onChange={e => update("teacher_id", e.target.value)} className={inputClass}>
                    <option value="">-- Select --</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.subject || "N/A"})</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <select value={form.room_id} onChange={e => update("room_id", e.target.value)} className={inputClass}>
                    <option value="">-- Select --</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} seats)</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Seats</label><input type="number" value={form.max_seats} onChange={e => update("max_seats", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Monthly Fee (৳)</label><input type="number" value={form.monthly_fee} onChange={e => update("monthly_fee", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Admission Fee (৳)</label><input type="number" value={form.admission_fee} onChange={e => update("admission_fee", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                  <select value={form.fee_type} onChange={e => update("fee_type", e.target.value)} className={inputClass}>
                    <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="one_time">One-time</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Schedule Days</label><input value={form.schedule_days} onChange={e => update("schedule_days", e.target.value)} className={inputClass} placeholder="e.g., Sat, Mon, Wed" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Schedule Time</label><input value={form.schedule_time} onChange={e => update("schedule_time", e.target.value)} className={inputClass} placeholder="e.g., 4:00 PM - 6:00 PM" /></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description (shown on website)</label><textarea value={form.description} onChange={e => update("description", e.target.value)} className={inputClass} rows={2} placeholder="Brief description for prospective students..." /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
