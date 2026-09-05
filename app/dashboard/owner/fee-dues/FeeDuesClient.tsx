"use client"
import { useState, useEffect, Fragment } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, formatDate, getMonthLabel } from "@/lib/utils"
import {
  AlertCircle, Search, Filter, Calendar, DollarSign, CheckCircle,
  X, Loader2, MessageSquare, Download, Clock, ArrowUpDown, ShieldAlert,
  ChevronDown, ChevronUp, CreditCard, Check, Receipt
} from "lucide-react"
import { checkFinancialAccess } from "@/lib/financial-access"

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
  const [hasFinancialAccess, setHasFinancialAccess] = useState(true)

  useEffect(() => {
    checkFinancialAccess().then(({ hasAccess }) => setHasFinancialAccess(hasAccess))
  }, [])

  // Modals & Expandable Pay State
  const [expandedDueId, setExpandedDueId] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({
    amount: "",
    discount: "0",
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    next_due_date: "",
    referral_name: "",
    referral_reason: "",
    notes: "",
  })
  const [submittingPayment, setSubmittingPayment] = useState(false)

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

  function togglePayExpand(d: Due) {
    if (expandedDueId === d.id) {
      setExpandedDueId(null)
      return
    }
    const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
    const defaultNextDate = d.due_date ? d.due_date.split("T")[0] : (() => {
      const nextM = new Date()
      nextM.setMonth(nextM.getMonth() + 1)
      nextM.setDate(10)
      return nextM.toISOString().split("T")[0]
    })()

    setPayForm({
      amount: String(outstanding),
      discount: "0",
      payment_method: "cash",
      payment_date: new Date().toISOString().split("T")[0],
      next_due_date: defaultNextDate,
      referral_name: "",
      referral_reason: "",
      notes: "",
    })
    setExpandedDueId(d.id)
  }

  async function handleRecordPayment(due: Due) {
    if (!hasFinancialAccess) {
      toast.error("Financial access required")
      return
    }
    const payAmt = parseFloat(payForm.amount)
    if (isNaN(payAmt) || payAmt <= 0) {
      toast.error("Please enter a valid payment amount")
      return
    }
    const discAmt = parseFloat(payForm.discount || "0")
    if (isNaN(discAmt) || discAmt < 0) {
      toast.error("Please enter a valid discount amount")
      return
    }

    if (payForm.payment_method === "referral") {
      if (!payForm.referral_name.trim()) {
        toast.error("Please enter the Referral Student Name or ID")
        return
      }
      if (!payForm.referral_reason.trim()) {
        toast.error("Please enter the reason for the referral payment")
        return
      }
    }

    setSubmittingPayment(true)
    try {
      const now = new Date()
      const receiptNo = `RCP-${now.getFullYear()}-${Date.now().toString().slice(-6)}`
      const totalCredited = payAmt + discAmt

      let paymentNotes: string | null = payForm.notes.trim() || null
      if (payForm.payment_method === "referral") {
        const refNotes = `Referral: ${payForm.referral_name.trim()} | Reason: ${payForm.referral_reason.trim()}`
        paymentNotes = paymentNotes ? `${refNotes} | ${paymentNotes}` : refNotes
      }

      // 1. Insert into payments table
      const { error: pError } = await supabase.from("payments").insert({
        student_id: due.student_id,
        batch_id: due.batch_id || null,
        amount: payAmt + discAmt,
        discount: discAmt,
        total_paid: payAmt,
        payment_method: payForm.payment_method,
        payment_for: "monthly",
        payment_month: due.due_month,
        receipt_number: receiptNo,
        notes: paymentNotes,
        created_at: payForm.payment_date ? `${payForm.payment_date}T12:00:00Z` : undefined,
      })

      if (pError) throw pError

      // 2. Update fee_dues
      const currentPaid = Number(due.paid_amount) || 0
      const newPaidTotal = currentPaid + totalCredited
      const remainingDue = Math.max(0, due.due_amount - newPaidTotal)
      const isFullyPaid = remainingDue <= 0

      if (isFullyPaid) {
        const { error: dError } = await supabase
          .from("fee_dues")
          .update({
            paid_amount: due.due_amount,
            status: "paid",
          })
          .eq("id", due.id)

        if (dError) throw dError

        setDues(prev => prev.filter(item => item.id !== due.id))
        toast.success(`✓ Full payment of ${formatCurrency(payAmt)} recorded for ${due.student?.name}! Due cleared. Receipt #${receiptNo}`)
      } else {
        const nextDate = payForm.next_due_date || due.due_date
        const { error: dError } = await supabase
          .from("fee_dues")
          .update({
            paid_amount: newPaidTotal,
            status: "partial",
            due_date: nextDate,
          })
          .eq("id", due.id)

        if (dError) throw dError

        setDues(prev => prev.map(item => item.id === due.id ? {
          ...item,
          paid_amount: newPaidTotal,
          status: "partial",
          due_date: nextDate,
        } : item))

        toast.success(`✓ Partial payment of ${formatCurrency(payAmt)} recorded! Remaining due of ${formatCurrency(remainingDue)} listed as partial due. Receipt #${receiptNo}`)
      }

      setExpandedDueId(null)
    } catch (err: any) {
      console.error("Payment recording failed:", err)
      toast.error(err.message || "Failed to record payment")
    } finally {
      setSubmittingPayment(false)
    }
  }

  async function waiveEntireDue(due: Due) {
    if (!hasFinancialAccess) {
      toast.error("Financial access required")
      return
    }
    if (!confirm(`Are you sure you want to completely waive the remaining balance for ${due.student?.name}?`)) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from("fee_dues").update({ status: "waived", paid_amount: due.due_amount }).eq("id", due.id)
      if (error) throw error
      setDues(prev => prev.filter(d => d.id !== due.id))
      setExpandedDueId(null)
      toast.success(`${due.student?.name}'s remaining due marked as waived`)
    } catch (err: any) {
      toast.error(err.message || "Failed to waive due")
    } finally {
      setActionLoading(false)
    }
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
                const isExpanded = expandedDueId === d.id
                return (
                  <Fragment key={d.id}>
                    <tr className={`transition-colors ${overdue ? "bg-red-50/50" : isExpanded ? "bg-emerald-50/40 font-medium" : "hover:bg-gray-50"}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-800">{d.student?.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{d.student?.student_id}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.batch?.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getMonthLabel(d.due_month)}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(d.due_amount)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-semibold">{formatCurrency(d.paid_amount || 0)}</td>
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
                        <div className="flex items-center gap-1.5">
                          {hasFinancialAccess ? (
                            <>
                              <button onClick={() => { setExtendModal(d); setNewDate(d.due_date) }} title="Extend due date"
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"><Calendar className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setReduceModal(d)} title="Reduce due"
                                className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-600 transition-colors"><DollarSign className="w-3.5 h-3.5" /></button>
                              <button
                                onClick={() => togglePayExpand(d)}
                                title={isExpanded ? "Close payment panel" : "Pay / Settle Due (Enter amount)"}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  isExpanded
                                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Pay</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> No access</span>
                          )}
                          <button onClick={() => { setSmsModal(d); setSmsMessage(`Dear Parent, fee of ${formatCurrency(outstanding)} for ${d.student?.name} is due on ${formatDate(d.due_date)}. Please pay to avoid late charges. - MedhaShiree`) }} title="Send SMS reminder"
                            className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600 transition-colors"><MessageSquare className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Detailed Payment Drawer */}
                    {isExpanded && (
                      <tr className="bg-gradient-to-r from-emerald-50/70 via-indigo-50/40 to-emerald-50/70 border-y-2 border-emerald-200/90">
                        <td colSpan={9} className="p-3 sm:p-5">
                          <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-lg space-y-4 max-w-4xl mx-auto">
                            {/* Top Summary Banner */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                                  <CreditCard className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                    Record Payment for {d.student?.name}
                                    <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                                      {d.student?.student_id}
                                    </span>
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Batch: <strong className="text-gray-700">{d.batch?.name}</strong> • Month:{" "}
                                    <strong className="text-gray-700">{getMonthLabel(d.due_month)}</strong>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-right">
                                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">Total Due</span>
                                  <strong className="text-xs font-bold text-gray-900">{formatCurrency(d.due_amount)}</strong>
                                </div>
                                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                                  <span className="text-[10px] text-emerald-600 uppercase block font-semibold">Already Paid</span>
                                  <strong className="text-xs font-bold text-emerald-700">{formatCurrency(d.paid_amount || 0)}</strong>
                                </div>
                                <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-right">
                                  <span className="text-[10px] text-rose-600 uppercase block font-semibold">Outstanding</span>
                                  <strong className="text-xs font-black text-rose-700">{formatCurrency(outstanding)}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Payment Form Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                              {/* Pay Amount */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-bold text-gray-700">Pay Amount (৳) *</label>
                                  <button
                                    type="button"
                                    onClick={() => setPayForm((f) => ({ ...f, amount: String(outstanding) }))}
                                    className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                  >
                                    Pay Full (৳{outstanding})
                                  </button>
                                </div>
                                <input
                                  type="number"
                                  min="1"
                                  max={outstanding}
                                  value={payForm.amount}
                                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                                  placeholder="e.g. 1000"
                                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-bold text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                />
                              </div>

                              {/* Payment Method */}
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Payment Method *</label>
                                <select
                                  value={payForm.payment_method}
                                  onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-semibold text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                >
                                  <option value="cash">Cash (নগদ)</option>
                                  <option value="bkash">bKash (বিকাশ)</option>
                                  <option value="nagad">Nagad (নগদ)</option>
                                  <option value="rocket">Rocket (রকেট)</option>
                                  <option value="bank">Bank Transfer</option>
                                  <option value="referral">Referral / Waiver</option>
                                </select>
                              </div>

                              {/* Payment Date */}
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Payment Date</label>
                                <input
                                  type="date"
                                  value={payForm.payment_date}
                                  onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
                                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl font-medium text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                />
                              </div>

                              {/* Referral Fields (Conditional) */}
                              {payForm.payment_method === "referral" && (
                                <>
                                  <div>
                                    <label className="block font-bold text-purple-900 mb-1">Referral Student Name / ID *</label>
                                    <input
                                      type="text"
                                      required
                                      value={payForm.referral_name}
                                      onChange={(e) => setPayForm((f) => ({ ...f, referral_name: e.target.value }))}
                                      placeholder="e.g. Shakib (MS-12345)"
                                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-300 rounded-xl font-medium text-xs text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="block font-bold text-purple-900 mb-1">Referral Reason / Note *</label>
                                    <input
                                      type="text"
                                      required
                                      value={payForm.referral_reason}
                                      onChange={(e) => setPayForm((f) => ({ ...f, referral_reason: e.target.value }))}
                                      placeholder="e.g. Referred 2 new students for Chemistry batch"
                                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-300 rounded-xl font-medium text-xs text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                  </div>
                                </>
                              )}

                              {/* Discount / Fee Waiver */}
                              <div>
                                <label className="block font-bold text-gray-700 mb-1">Fee Waiver / Discount (৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={payForm.discount}
                                  onChange={(e) => setPayForm((f) => ({ ...f, discount: e.target.value }))}
                                  placeholder="0"
                                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                                />
                              </div>

                              {/* Partial Payment Calculation & Next Due Date */}
                              {(() => {
                                const enteredPay = parseFloat(payForm.amount || "0")
                                const enteredDisc = parseFloat(payForm.discount || "0")
                                const totalCredit = enteredPay + enteredDisc
                                const remaining = Math.max(0, outstanding - totalCredit)

                                if (remaining > 0) {
                                  return (
                                    <div className="sm:col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                      <div>
                                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                          Partial Payment: Remaining due of{" "}
                                          <strong className="text-red-700 font-black">৳{remaining.toLocaleString("en-BD")}</strong> will
                                          remain as partial due!
                                        </span>
                                        <span className="text-[11px] text-amber-700 block mt-0.5">
                                          This row will stay in Fee Dues with status partial and the remaining balance.
                                        </span>
                                      </div>
                                      <div className="shrink-0 w-full sm:w-auto">
                                        <label className="block text-[10px] font-bold uppercase text-amber-800 mb-0.5">
                                          Next Due Date:
                                        </label>
                                        <input
                                          type="date"
                                          value={payForm.next_due_date}
                                          onChange={(e) => setPayForm((f) => ({ ...f, next_due_date: e.target.value }))}
                                          className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  )
                                } else if (totalCredit >= outstanding && outstanding > 0) {
                                  return (
                                    <div className="sm:col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800">
                                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                      <span className="text-xs font-bold">
                                        ✓ Full Payment: This due will be completely settled and cleared from pending dues.
                                      </span>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => waiveEntireDue(d)}
                                disabled={submittingPayment || actionLoading}
                                className="text-xs text-rose-600 hover:text-rose-800 hover:underline font-bold cursor-pointer"
                              >
                                Waive Entire Remaining Balance (100% Waiver)
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedDueId(null)}
                                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecordPayment(d)}
                                  disabled={submittingPayment || !payForm.amount || parseFloat(payForm.amount) <= 0}
                                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                >
                                  {submittingPayment ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording Payment...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> Confirm & Record Payment
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
