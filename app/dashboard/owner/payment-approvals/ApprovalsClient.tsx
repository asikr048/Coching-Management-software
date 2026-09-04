"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  CheckCircle, XCircle, Clock, Loader2, Phone, Hash, FileText,
  AlertCircle, Filter, Banknote
} from "lucide-react"

interface Submission {
  id: string
  student_id: string
  batch_id: string
  amount: number
  total_fee: number
  due_amount: number
  due_date: string | null
  payment_method: string
  sender_number: string | null
  transaction_id: string | null
  notes: string | null
  status: string
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  student?: { name: string; student_id: string; phone: string | null; email: string | null }
  batch?: { name: string; subject: string | null }
}

const methodLabels: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", offline: "Offline" }
const methodColors: Record<string, string> = {
  bkash: "bg-pink-100 text-pink-700 border-pink-200",
  nagad: "bg-orange-100 text-orange-700 border-orange-200",
  rocket: "bg-purple-100 text-purple-700 border-purple-200",
  upay: "bg-blue-100 text-blue-700 border-blue-200",
  offline: "bg-gray-100 text-gray-700 border-gray-200",
}
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
}
const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
}

export default function ApprovalsClient({
  submissions: initial, canApprove, staffId
}: { submissions: Submission[]; canApprove: boolean; staffId: string }) {
  const [submissions, setSubmissions] = useState(initial)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [approveModal, setApproveModal] = useState<Submission | null>(null)
  const supabase = createClient()

  const filtered = filter === "all" ? submissions : submissions.filter(s => s.status === filter)
  const pendingCount = submissions.filter(s => s.status === "pending").length

  async function handleApprove(id: string, sub: Submission) {
    setProcessing(id)
    try {
      // 1. Update submission status
      const { error: updateErr } = await supabase.from("payment_submissions").update({
        status: "approved", approved_by: staffId, approved_at: new Date().toISOString(),
      }).eq("id", id)
      if (updateErr) throw updateErr

      // 2. Create enrollment record if not already enrolled
      const { data: existingEnr } = await supabase
        .from("enrollments")
        .select("id")
        .eq("student_id", sub.student_id)
        .eq("batch_id", sub.batch_id)
        .maybeSingle()

      if (!existingEnr) {
        const { error: enrollErr } = await supabase.from("enrollments").insert({
          student_id: sub.student_id, batch_id: sub.batch_id, status: "active",
        }).select().maybeSingle()
        // Ignore duplicate enrollment error if race condition occurs
        if (enrollErr && !enrollErr.message.includes("duplicate") && enrollErr.code !== "23505") throw enrollErr
      }

      // 3. Create payment record
      const receiptNo = `RCP-${Date.now().toString(36).toUpperCase()}`
      const { error: payErr } = await supabase.from("payments").insert({
        student_id: sub.student_id, batch_id: sub.batch_id,
        amount: sub.amount, total_paid: sub.amount, discount: 0, late_fee: 0,
        payment_method: sub.payment_method, transaction_id: sub.transaction_id || null,
        payment_for: "enrollment", receipt_number: receiptNo,
        notes: sub.sender_number ? `Sender: ${sub.sender_number}` : null,
      })
      if (payErr) throw payErr

      // 4. Create fee_due if there's remaining amount (handle duplicate month constraint safely)
      if (sub.due_amount > 0 && sub.due_date) {
        const dueMonth = new Date(sub.due_date).toISOString().slice(0, 7)
        const { data: existingDue } = await supabase
          .from("fee_dues")
          .select("id, due_amount")
          .eq("student_id", sub.student_id)
          .eq("batch_id", sub.batch_id)
          .eq("due_month", dueMonth)
          .maybeSingle()

        if (existingDue) {
          await supabase.from("fee_dues").update({
            due_amount: Math.max(existingDue.due_amount, sub.due_amount),
            due_date: sub.due_date,
            status: "pending"
          }).eq("id", existingDue.id)
        } else {
          const { error: dueErr } = await supabase.from("fee_dues").insert({
            student_id: sub.student_id, batch_id: sub.batch_id,
            due_month: dueMonth,
            due_amount: sub.due_amount, due_date: sub.due_date,
            paid_amount: 0, status: "pending",
          })
          if (dueErr && !dueErr.message.includes("duplicate") && dueErr.code !== "23505") {
            console.warn("Could not insert fee due:", dueErr)
          }
        }
      }

      // 5. Increment batch current_seats
      try {
        const { data: batchData } = await supabase.from("batches").select("current_seats").eq("id", sub.batch_id).single()
        if (batchData) {
          await supabase.from("batches").update({ current_seats: (batchData.current_seats || 0) + 1 }).eq("id", sub.batch_id)
        }
      } catch { /* ignore seat increment errors */ }

      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: "approved", approved_by: staffId, approved_at: new Date().toISOString() } : s))
      toast.success("Payment approved! Student enrolled successfully.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    } finally { setProcessing(null) }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { toast.error("Please enter a reason"); return }
    setProcessing(id)
    try {
      const { error } = await supabase.from("payment_submissions").update({
        status: "rejected", approved_by: staffId, approved_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
      }).eq("id", id)
      if (error) throw error
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: "rejected", rejection_reason: rejectReason.trim() } : s))
      setRejectModal(null); setRejectReason("")
      toast.success("Payment rejected")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally { setProcessing(null) }
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-gray-400" />
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Submissions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Banknote className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {filter === "all" ? "" : filter} payment submissions</p>
          <p className="text-sm mt-1">{filter === "pending" ? "All caught up! No payments waiting for approval." : "Try changing the filter."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sub => (
            <div key={sub.id} className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${sub.status === "pending" ? "border-amber-200 border-l-4 border-l-amber-400" : "border-gray-200"}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">
                      {sub.student?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{sub.student?.name || "Unknown"}</p>
                      <p className="text-xs text-gray-500 font-mono">{sub.student?.student_id || ""}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[sub.status]}`}>
                      {statusIcons[sub.status]} {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                    <div>
                      <p className="text-xs text-gray-400">Batch</p>
                      <p className="font-medium text-gray-700 truncate">{sub.batch?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Amount</p>
                      <p className="font-bold text-emerald-600">{formatCurrency(sub.amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Due</p>
                      <p className={`font-semibold ${sub.due_amount > 0 ? "text-red-600" : "text-gray-400"}`}>{formatCurrency(sub.due_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Method</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${methodColors[sub.payment_method] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {methodLabels[sub.payment_method] || sub.payment_method}
                      </span>
                    </div>
                  </div>

                  {/* Transaction details */}
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                    {sub.sender_number && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sub.sender_number}</span>
                    )}
                    {sub.transaction_id && (
                      <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> TrxID: <strong className="text-gray-700">{sub.transaction_id}</strong></span>
                    )}
                    {sub.notes && (
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {sub.notes}</span>
                    )}
                    <span className="text-gray-400">{formatDate(sub.created_at)}</span>
                  </div>

                  {/* Rejection reason */}
                  {sub.status === "rejected" && sub.rejection_reason && (
                    <div className="mt-2 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg p-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">Rejected: {sub.rejection_reason}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {sub.status === "pending" && canApprove && (
                  <div className="flex lg:flex-col gap-2 lg:min-w-[120px]">
                    <button
                      onClick={() => setApproveModal(sub)}
                      disabled={processing === sub.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Approve
                    </button>
                    <button
                      onClick={() => setRejectModal(sub.id)}
                      disabled={processing === sub.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" /> Reject Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection *</label>
                <textarea
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[80px]"
                  placeholder="e.g. Transaction ID not found, amount mismatch..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRejectModal(null); setRejectReason("") }} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => handleReject(rejectModal)}
                  disabled={processing === rejectModal}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center gap-2"
                >
                  {processing === rejectModal ? <><Loader2 className="w-4 h-4 animate-spin" /> Rejecting...</> : "Reject Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve confirmation modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Confirm Payment Approval</h3>
                  <p className="text-emerald-100 text-sm">Please review the details before approving</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Student info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                  {approveModal.student?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{approveModal.student?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-500 font-mono">{approveModal.student?.student_id} {approveModal.student?.phone && `· ${approveModal.student.phone}`}</p>
                </div>
              </div>

              {/* Payment details grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Amount Paid</p>
                  <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{formatCurrency(approveModal.amount)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Due Remaining</p>
                  <p className={`text-xl font-extrabold mt-0.5 ${approveModal.due_amount > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {formatCurrency(approveModal.due_amount)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Batch</span>
                  <span className="font-semibold text-gray-800">{approveModal.batch?.name || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Payment Method</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${methodColors[approveModal.payment_method] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {methodLabels[approveModal.payment_method] || approveModal.payment_method}
                  </span>
                </div>
                {approveModal.sender_number && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Sender No.</span>
                    <span className="font-mono font-semibold text-gray-800">{approveModal.sender_number}</span>
                  </div>
                )}
                {approveModal.transaction_id && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Transaction ID</span>
                    <span className="font-mono font-bold text-gray-900">{approveModal.transaction_id}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Submitted</span>
                  <span className="text-gray-700">{formatDate(approveModal.created_at)}</span>
                </div>
                {approveModal.notes && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-500">Notes</span>
                    <span className="text-gray-700 text-right max-w-[200px]">{approveModal.notes}</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Approving will <strong>enroll the student</strong> in the batch and create a payment record. This action cannot be undone.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setApproveModal(null)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { handleApprove(approveModal.id, approveModal); setApproveModal(null) }}
                  disabled={processing === approveModal.id}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing === approveModal.id
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving...</>
                    : <><CheckCircle className="w-4 h-4" /> Confirm Approve</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
