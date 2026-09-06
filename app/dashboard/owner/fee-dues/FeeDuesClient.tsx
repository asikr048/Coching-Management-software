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
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "partial" | "pending" | "paid" | "overdue">("active")
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

    const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
    const isSettled = d.status === "paid" || d.status === "waived" || outstanding <= 0
    const isOverdue = new Date(d.due_date) < new Date()

    let matchStatus = true
    if (statusFilter === "active") {
      matchStatus = !isSettled && (d.status === "pending" || d.status === "partial")
    } else if (statusFilter === "partial") {
      matchStatus = !isSettled && d.status === "partial"
    } else if (statusFilter === "pending") {
      matchStatus = !isSettled && d.status === "pending"
    } else if (statusFilter === "paid") {
      matchStatus = isSettled
    } else if (statusFilter === "overdue") {
      matchStatus = !isSettled && isOverdue
    } else if (statusFilter === "all") {
      matchStatus = true
    }

    return matchSearch && matchBatch && matchStatus
  }).sort((a, b) => {
    if (sortBy === "amount") return (b.due_amount - b.paid_amount) - (a.due_amount - a.paid_amount)
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const totalOutstanding = dues
    .filter(d => d.status !== "paid" && d.status !== "waived")
    .reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

  const activeCount = dues.filter(d => (d.status === "pending" || d.status === "partial") && Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)) > 0).length
  const partialCount = dues.filter(d => d.status === "partial" && Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)) > 0).length
  const paidCount = dues.filter(d => d.status === "paid" || d.status === "waived" || Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)) <= 0).length
  const overdueCount = dues.filter(d => (d.status === "pending" || d.status === "partial") && Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)) > 0 && new Date(d.due_date) < new Date()).length

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
    setDues(prev => prev.map(d => d.id === reduceModal.id ? { ...d, due_amount: newDueAmount, status: newStatus } : d))
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

        setDues(prev => prev.map(item => item.id === due.id ? {
          ...item,
          paid_amount: due.due_amount,
          status: "paid",
        } : item))
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
      setDues(prev => prev.map(d => d.id === due.id ? { ...d, status: "waived", paid_amount: due.due_amount } : d))
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Fee Dues & Due History</h2>
          <p className="text-sm text-slate-500 mt-1">
            {activeCount} active receivables ({partialCount} partial) · {paidCount} settled in history · {overdueCount} overdue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-5 py-2.5 backdrop-blur-md">
            <p className="text-xs text-red-400 font-medium uppercase tracking-wider">Total Outstanding</p>
            <p className="text-xl font-black text-red-300">{formatCurrency(totalOutstanding)}</p>
          </div>
          <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2.5 text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all cursor-pointer">
            <Download className="w-4 h-4 text-amber-600" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters & Status Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student name or student ID (MS-...)"
            className="w-full pl-10 pr-3 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 placeholder:text-slate-400 transition-all" />
        </div>
        <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer">
          <option value="">All Batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-semibold cursor-pointer">
          <option value="active">Active Receivables ({activeCount})</option>
          <option value="partial">Partial Dues Only ({partialCount})</option>
          <option value="pending">Pending Dues Only ({Math.max(0, activeCount - partialCount)})</option>
          <option value="paid">Settled / Paid History ({paidCount})</option>
          <option value="overdue">Overdue Receivables ({overdueCount})</option>
          <option value="all">All Dues & History ({dues.length})</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as "date" | "amount")}
          className="px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 cursor-pointer">
          <option value="date">Sort by Due Date</option>
          <option value="amount">Sort by Amount (highest)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3.5 text-left">Student</th>
                <th className="px-4 py-3.5 text-left">Batch</th>
                <th className="px-4 py-3.5 text-left">Month</th>
                <th className="px-4 py-3.5 text-left">Total Fee</th>
                <th className="px-4 py-3.5 text-left">Paid</th>
                <th className="px-4 py-3.5 text-left">Remaining Due</th>
                <th className="px-4 py-3.5 text-left">Due Date</th>
                <th className="px-4 py-3.5 text-left">Status</th>
                <th className="px-4 py-3.5 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-sm">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-14 text-slate-500 text-sm">No dues found for selected filter</td></tr>
              ) : filtered.map(d => {
                const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
                const isSettled = d.status === "paid" || d.status === "waived" || outstanding <= 0
                const overdue = !isSettled && new Date(d.due_date) < new Date()
                const isExpanded = expandedDueId === d.id
                return (
                  <Fragment key={d.id}>
                    <tr className={`transition-colors ${isSettled ? "bg-emerald-50/20" : overdue ? "bg-red-50/60" : isExpanded ? "bg-amber-50/80 font-medium" : "hover:bg-slate-50/70"}`}>
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900">{d.student?.name}</p>
                        <p className="text-xs text-amber-700 font-mono font-bold mt-0.5">{d.student?.student_id}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 font-medium">{d.batch?.name}</td>
                      <td className="px-4 py-3.5 text-slate-700">{getMonthLabel(d.due_month)}</td>
                      <td className="px-4 py-3.5 text-slate-700 font-semibold">{formatCurrency(d.due_amount)}</td>
                      <td className="px-4 py-3.5 text-emerald-600 font-bold">{formatCurrency(d.paid_amount || 0)}</td>
                      <td className="px-4 py-3.5 text-base font-black text-rose-600">{formatCurrency(outstanding)}</td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        {formatDate(d.due_date)}
                        {overdue && <AlertCircle className="w-3.5 h-3.5 text-rose-600 inline ml-1.5" />}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          d.status === "paid" || outstanding <= 0
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : d.status === "partial"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : d.status === "waived"
                            ? "bg-slate-100 text-slate-700 border-slate-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}>
                          {d.status === "paid" || outstanding <= 0 ? "Paid / Settled" : d.status === "waived" ? "Waived" : d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {isSettled ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Settled
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {hasFinancialAccess ? (
                              <>
                                <button onClick={() => { setExtendModal(d); setNewDate(d.due_date) }} title="Extend due date"
                                  className="p-2 hover:bg-slate-100 rounded-lg text-blue-600 transition-colors cursor-pointer"><Calendar className="w-4 h-4" /></button>
                                <button onClick={() => setReduceModal(d)} title="Reduce due"
                                  className="p-2 hover:bg-slate-100 rounded-lg text-amber-600 transition-colors cursor-pointer"><DollarSign className="w-4 h-4" /></button>
                                <button
                                  onClick={() => togglePayExpand(d)}
                                  title={isExpanded ? "Close payment panel" : "Pay / Settle Due (Enter amount)"}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                    isExpanded
                                      ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/40"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300"
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
                              <span className="text-xs text-slate-500 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Locked</span>
                            )}
                            <button onClick={() => { setSmsModal(d); setSmsMessage(`Dear Parent, fee of ${formatCurrency(outstanding)} for ${d.student?.name} is due on ${formatDate(d.due_date)}. Please pay to avoid late charges. - MedhaShiree`) }} title="Send SMS reminder"
                              className="p-2 hover:bg-purple-50 rounded-lg text-purple-600 transition-colors cursor-pointer"><MessageSquare className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Detailed Payment Drawer */}
                    {isExpanded && (
                      <tr className="bg-amber-50/40 border-y border-amber-200">
                        <td colSpan={9} className="p-3 sm:p-5">
                          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-lg space-y-4 max-w-4xl mx-auto">
                            {/* Top Summary Banner */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black border border-amber-200">
                                  <CreditCard className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    Record Payment for {d.student?.name}
                                    <span className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                                      {d.student?.student_id}
                                    </span>
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Batch: <strong className="text-slate-800">{d.batch?.name}</strong> • Month:{" "}
                                    <strong className="text-slate-800">{getMonthLabel(d.due_month)}</strong>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
                                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Due</span>
                                  <strong className="text-xs font-bold text-slate-900">{formatCurrency(d.due_amount)}</strong>
                                </div>
                                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
                                  <span className="text-[10px] text-emerald-600 uppercase block font-bold">Already Paid</span>
                                  <strong className="text-xs font-bold text-emerald-700">{formatCurrency(d.paid_amount || 0)}</strong>
                                </div>
                                <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-right">
                                  <span className="text-[10px] text-rose-600 uppercase block font-bold">Outstanding</span>
                                  <strong className="text-xs font-black text-rose-700">{formatCurrency(outstanding)}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Payment Form Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                              {/* Pay Amount */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-bold text-slate-700">Pay Amount (৳) *</label>
                                  <button
                                    type="button"
                                    onClick={() => setPayForm((f) => ({ ...f, amount: String(outstanding) }))}
                                    className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
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
                                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
                                />
                              </div>

                              {/* Payment Method */}
                              <div>
                                <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
                                <select
                                  value={payForm.payment_method}
                                  onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm cursor-pointer"
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
                                <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                                <input
                                  type="date"
                                  value={payForm.payment_date}
                                  onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
                                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-medium text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
                                />
                              </div>

                              {/* Referral Fields (Conditional) */}
                              {payForm.payment_method === "referral" && (
                                <>
                                  <div>
                                    <label className="block font-bold text-purple-700 mb-1">Referral Student Name / ID *</label>
                                    <input
                                      type="text"
                                      required
                                      value={payForm.referral_name}
                                      onChange={(e) => setPayForm((f) => ({ ...f, referral_name: e.target.value }))}
                                      placeholder="e.g. Shakib (MS-12345)"
                                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-300 rounded-xl font-medium text-xs text-purple-900 focus:outline-none focus:border-purple-500"
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className="block font-bold text-purple-700 mb-1">Referral Reason / Note *</label>
                                    <input
                                      type="text"
                                      required
                                      value={payForm.referral_reason}
                                      onChange={(e) => setPayForm((f) => ({ ...f, referral_reason: e.target.value }))}
                                      placeholder="e.g. Referred 2 new students for Chemistry batch"
                                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-300 rounded-xl font-medium text-xs text-purple-900 focus:outline-none focus:border-purple-500"
                                    />
                                  </div>
                                </>
                              )}

                              {/* Discount / Fee Waiver */}
                              <div>
                                <label className="block font-bold text-slate-700 mb-1">Fee Waiver / Discount (৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={payForm.discount}
                                  onChange={(e) => setPayForm((f) => ({ ...f, discount: e.target.value }))}
                                  placeholder="0"
                                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
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
                                          <strong className="text-rose-600 font-black">৳{remaining.toLocaleString("en-BD")}</strong> will
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
                                          className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none"
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
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                              <button
                                type="button"
                                onClick={() => waiveEntireDue(d)}
                                disabled={submittingPayment || actionLoading}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-bold cursor-pointer"
                              >
                                Waive Entire Remaining Balance (100% Waiver)
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedDueId(null)}
                                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRecordPayment(d)}
                                  disabled={submittingPayment || !payForm.amount || parseFloat(payForm.amount) <= 0}
                                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
      <p className="text-xs text-slate-500 text-center">Showing {filtered.length} of {dues.length} dues</p>

      {/* Extend Due Date Modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Extend Due Date</h3>
              <button onClick={() => setExtendModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-1">Student: <strong className="text-slate-900">{extendModal.student?.name}</strong></p>
            <p className="text-sm text-slate-600 mb-4">Current: <strong className="text-amber-700 font-bold">{formatDate(extendModal.due_date)}</strong></p>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">New Due Date</label>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 mb-5" />
            <div className="flex gap-3">
              <button onClick={() => setExtendModal(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={extendDueDate} disabled={actionLoading} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} Extend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reduce Due Modal */}
      {reduceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Reduce Due Amount</h3>
              <button onClick={() => setReduceModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-1">Student: <strong className="text-slate-900">{reduceModal.student?.name}</strong></p>
            <p className="text-sm text-slate-600 mb-4">Current Due: <strong className="text-rose-600 font-bold">{formatCurrency(reduceModal.due_amount - (reduceModal.paid_amount || 0))}</strong></p>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Reduce By (৳)</label>
            <input type="number" value={reduceAmount} onChange={e => setReduceAmount(e.target.value)} min="1" max={reduceModal.due_amount - (reduceModal.paid_amount || 0)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 mb-5" placeholder="Amount to reduce" />
            <div className="flex gap-3">
              <button onClick={() => setReduceModal(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={reduceDue} disabled={actionLoading || !reduceAmount} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} Reduce
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Reminder Modal */}
      {smsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Send SMS Reminder</h3>
              <button onClick={() => setSmsModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-1">To: <strong className="text-slate-900">{smsModal.student?.name}</strong></p>
            <p className="text-sm text-slate-600 mb-4">Phone: <span className="font-mono text-amber-700 font-bold">{smsModal.student?.guardian_phone || smsModal.student?.phone || "N/A"}</span></p>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Message</label>
            <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} rows={4}
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 mb-5" />
            <div className="flex gap-3">
              <button onClick={() => setSmsModal(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={() => { toast.success("SMS sent (mock)!"); setSmsModal(null) }} className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition-all">
                <MessageSquare className="w-4 h-4" /> Send SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
