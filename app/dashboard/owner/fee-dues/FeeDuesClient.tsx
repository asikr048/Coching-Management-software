"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, formatDate, getMonthLabel } from "@/lib/utils"
import {
  AlertCircle, Search, Filter, Calendar, DollarSign, CheckCircle,
  X, Loader2, MessageSquare, Download, Clock, ArrowUpDown
} from "lucide-react"

interface Due {
  id: string; student_id: string; batch_id: string; due_month: string
  due_amount: number; paid_amount: number; due_date: string; status: string
  student?: { id: string; name: string; student_id: string; guardian_phone?: string; phone?: string }
  batch?: { id: string; name: string }
}
interface Batch { id: string; name: string }

export default function FeeDuesClient({ dues: initialDues, batches }: { dues: Due[]; batches: Batch[] }) {
  const supabase = createClient()
  const [dues, setDues] = useState(initialDues)
  const [search, setSearch] = useState("")
  const [batchFilter, setBatchFilter] = useState("")
  const [sortBy, setSortBy] = useState<"date" | "amount">("date")

  // Modals
  const [extendModal, setExtendModal] = useState<Due | null>(null)
  const [reduceModal, setReduceModal] = useState<Due | null>(null)
  const [smsModal, setSmsModal] = useState<Due | null>(null)
  const [newDate, setNewDate] = useState("")
  const [reduceAmount, setReduceAmount] = useState("")
  const [smsMessage, setSmsMessage] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // Filter & Sort
  const filtered = dues.filter(d => {
    const matchSearch = !search ||
      d.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.student?.student_id?.toLowerCase().includes(search.toLowerCase())
    const matchBatch = !batchFilter || d.batch_id === batchFilter
    return matchSearch && matchBatch
  }).sort((a, b) => {
    if (sortBy === "amount") return (b.due_amount - b.paid_amount) - (a.due_amount - a.paid_amount)
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const totalOutstanding = filtered.reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)
  const overdueCount = filtered.filter(d => new Date(d.due_date) < new Date()).length

  // Actions
  async function extendDueDate() {
    if (!extendModal || !newDate) return
    setActionLoading(true)
    const { error } = await supabase.from("fee_dues").update({ due_date: newDate }).eq("id", extendModal.id)
    if (error) { toast.error("Failed to extend"); setActionLoading(false); return }
    setDues(prev => prev.map(d => d.id === extendModal.id ? { ...d, due_date: newDate } : d))
    toast.success(`Due date extended to ${formatDate(newDate)}`)
    setExtendModal(null); setNewDate(""); setActionLoading(false)
  }

  async function reduceDue() {
    if (!reduceModal || !reduceAmount) return
    setActionLoading(true)
    const newDueAmount = Math.max(0, reduceModal.due_amount - parseFloat(reduceAmount))
    const newStatus = newDueAmount <= (reduceModal.paid_amount || 0) ? "paid" : reduceModal.status
    const { error } = await supabase.from("fee_dues").update({ due_amount: newDueAmount, status: newStatus }).eq("id", reduceModal.id)
    if (error) { toast.error("Failed to reduce"); setActionLoading(false); return }
    if (newStatus === "paid") {
      setDues(prev => prev.filter(d => d.id !== reduceModal.id))
    } else {
      setDues(prev => prev.map(d => d.id === reduceModal.id ? { ...d, due_amount: newDueAmount } : d))
    }
    toast.success(`Due reduced by ${formatCurrency(parseFloat(reduceAmount))}`)
    setReduceModal(null); setReduceAmount(""); setActionLoading(false)
  }

  async function markPaid(due: Due) {
    const { error } = await supabase.from("fee_dues").update({ status: "waived", paid_amount: due.due_amount }).eq("id", due.id)
    if (error) { toast.error("Failed"); return }
    setDues(prev => prev.filter(d => d.id !== due.id))
    toast.success(`${due.student?.name}'s due marked as paid/waived`)
  }

  function downloadCSV() {
    const rows = [["Student", "ID", "Batch", "Month", "Due Amount", "Paid", "Outstanding", "Due Date", "Status"]]
    filtered.forEach(d => {
      rows.push([
        d.student?.name || "", d.student?.student_id || "", d.batch?.name || "",
        d.due_month, String(d.due_amount), String(d.paid_amount || 0),
        String(Math.max(0, d.due_amount - (d.paid_amount || 0))),
        d.due_date, d.status
      ])
    })
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `fee-dues-${new Date().toISOString().split("T")[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success("Downloaded!")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fee Dues</h2>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} pending · {overdueCount} overdue</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <p className="text-xs text-red-500">Total Outstanding</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalOutstanding)}</p>
          </div>
          <button onClick={downloadCSV} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student name or ID..."
            className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
          className="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as "date" | "amount")}
          className="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="date">Sort by Due Date</option>
          <option value="amount">Sort by Amount (highest)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Outstanding</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No pending dues found</td></tr>
              ) : filtered.map(d => {
                const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
                const overdue = new Date(d.due_date) < new Date()
                return (
                  <tr key={d.id} className={`hover:bg-gray-50 ${overdue ? "bg-red-50/50" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{d.student?.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{d.student?.student_id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.batch?.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getMonthLabel(d.due_month)}</td>
                    <td className="px-4 py-3 text-sm">{formatCurrency(d.due_amount)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">{formatCurrency(d.paid_amount || 0)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600">{formatCurrency(outstanding)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(d.due_date)}
                      {overdue && <AlertCircle className="w-3 h-3 text-red-500 inline ml-1" />}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.status === "partial" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setExtendModal(d); setNewDate(d.due_date) }} title="Extend due date"
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"><Calendar className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setReduceModal(d)} title="Reduce due"
                          className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-600 transition-colors"><DollarSign className="w-3.5 h-3.5" /></button>
                        <button onClick={() => markPaid(d)} title="Mark as paid/waived"
                          className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setSmsModal(d); setSmsMessage(`Dear Parent, fee of ${formatCurrency(outstanding)} for ${d.student?.name} is due on ${formatDate(d.due_date)}. Please pay to avoid late charges. - MedhaShiree`) }} title="Send SMS reminder"
                          className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600 transition-colors"><MessageSquare className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center">Showing {filtered.length} of {dues.length} dues</p>

      {/* Extend Due Date Modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Extend Due Date</h3>
              <button onClick={() => setExtendModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Student: <strong>{extendModal.student?.name}</strong></p>
            <p className="text-sm text-gray-500 mb-4">Current: <strong>{formatDate(extendModal.due_date)}</strong></p>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Due Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setExtendModal(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={extendDueDate} disabled={actionLoading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} Extend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reduce Due Modal */}
      {reduceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Reduce Due Amount</h3>
              <button onClick={() => setReduceModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-1">Student: <strong>{reduceModal.student?.name}</strong></p>
            <p className="text-sm text-gray-500 mb-4">Current Due: <strong className="text-red-600">{formatCurrency(reduceModal.due_amount - (reduceModal.paid_amount || 0))}</strong></p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reduce By (৳)</label>
            <input type="number" value={reduceAmount} onChange={e => setReduceAmount(e.target.value)} min="1" max={reduceModal.due_amount - (reduceModal.paid_amount || 0)}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" placeholder="Amount to reduce" />
            <div className="flex gap-3">
              <button onClick={() => setReduceModal(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={reduceDue} disabled={actionLoading || !reduceAmount} className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} Reduce
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Reminder Modal */}
      {smsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Send SMS Reminder</h3>
              <button onClick={() => setSmsModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-1">To: <strong>{smsModal.student?.name}</strong></p>
            <p className="text-sm text-gray-400 mb-4">Phone: {smsModal.student?.guardian_phone || smsModal.student?.phone || "N/A"}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} rows={4}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setSmsModal(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => { toast.success("SMS sent (mock)!"); setSmsModal(null) }} className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                <MessageSquare className="w-4 h-4" /> Send SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
