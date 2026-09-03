"use client"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, CreditCard, Printer, Search, ShieldAlert, AlertCircle, Check, DollarSign } from "lucide-react"
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"

interface StudentOpt { id: string; name: string; student_id: string; phone?: string }
interface BatchOpt { id: string; name: string; monthly_fee: number }
interface DueRow { id: string; student_id: string; batch_id: string; due_month: string; due_amount: number; paid_amount: number; due_date: string; status: string; batch?: { name: string } | { name: string }[] | null }
interface PaymentRow { id: string; amount: number; discount: number; total_paid: number; payment_method: string; payment_for: string; payment_month?: string; receipt_number: string; paid_at: string; student?: { name: string; student_id: string }; batch?: { name: string } }

export default function PaymentsClient({ payments: initial, students, batches, dues: initialDues = [] }: { payments: PaymentRow[]; students: StudentOpt[]; batches: BatchOpt[]; dues?: DueRow[] }) {
  const [payments, setPayments] = useState(initial)
  const [dues, setDues] = useState(initialDues)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasAccess, setHasAccess] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<StudentOpt | null>(null)
  const [payingDue, setPayingDue] = useState<DueRow | null>(null)
  const supabase = createClient()

  const [form, setForm] = useState({ student_id: "", batch_id: "", amount: "", discount: "0", payment_method: "cash", payment_for: "monthly", payment_month: "" })
  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }
  function getBatchName(batch: { name: string } | { name: string }[] | null | undefined): string {
    if (!batch) return "—"
    if (Array.isArray(batch)) return batch[0]?.name || "—"
    return batch.name || "—"
  }

  useEffect(() => {
    checkFinancialAccess().then(({ hasAccess: a }) => setHasAccess(a))
  }, [])

  // Search students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return students.filter(s => s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))).slice(0, 8)
  }, [searchQuery, students])

  // Get dues for selected student
  const studentDues = useMemo(() => {
    if (!selectedStudent) return []
    return dues.filter(d => d.student_id === selectedStudent.id)
  }, [selectedStudent, dues])

  function selectStudent(s: StudentOpt) {
    setSelectedStudent(s)
    setSearchQuery("")
    setForm(f => ({ ...f, student_id: s.id }))
    setPayingDue(null)
  }

  function selectDueToPay(d: DueRow) {
    setPayingDue(d)
    const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
    setForm(f => ({ ...f, student_id: d.student_id, batch_id: d.batch_id, amount: String(outstanding), payment_for: "monthly", payment_month: d.due_month }))
  }

  function openRecordPaymentModal() {
    setForm({ student_id: "", batch_id: "", amount: "", discount: "0", payment_method: "cash", payment_for: "monthly", payment_month: "" })
    setSelectedStudent(null)
    setPayingDue(null)
    setSearchQuery("")
    setShowModal(true)
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!hasAccess) { toast.error("Financial access required"); return }
    setLoading(true)
    try {
      const amt = parseFloat(form.amount)
      const disc = parseFloat(form.discount || "0")
      const total = amt - disc
      const now = new Date()
      const month = form.payment_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const { data, error } = await supabase.from("payments").insert({
        student_id: form.student_id, batch_id: form.batch_id || null, amount: amt, discount: disc,
        total_paid: total, payment_method: form.payment_method, payment_for: form.payment_for, payment_month: month,
      }).select("*, student:students(name, student_id), batch:batches(name)").single()
      if (error) throw error

      // Update fee_due if paying a specific due
      if (payingDue) {
        const newPaid = (payingDue.paid_amount || 0) + total
        const newStatus = newPaid >= payingDue.due_amount ? "paid" : "partial"
        await supabase.from("fee_dues").update({ paid_amount: newPaid, status: newStatus }).eq("id", payingDue.id)
        setDues(prev => prev.map(d => d.id === payingDue.id ? { ...d, paid_amount: newPaid, status: newStatus } : d).filter(d => d.status !== "paid"))
      } else if (form.batch_id && form.payment_for === "monthly") {
        await supabase.from("fee_dues").update({ paid_amount: total, status: total >= amt ? "paid" : "partial" })
          .eq("student_id", form.student_id).eq("batch_id", form.batch_id).eq("due_month", month)
      }

      setPayments([data, ...payments])
      setShowModal(false)
      setSelectedStudent(null)
      setPayingDue(null)
      toast.success(`Payment of ${formatCurrency(total)} recorded! Receipt: ${data.receipt_number}`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Payment failed") }
    finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"

  // Financial access guard
  if (!hasAccess) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-red-700 mb-1">Financial Access Required</h3>
        <p className="text-sm text-red-600">You don&apos;t have financial access to record payments. Contact the Owner.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top: Search + Record Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedStudent(null); setPayingDue(null) }}
            placeholder="Search student by name, ID, or phone to pay due..."
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          />
          {/* Search dropdown */}
          {filteredStudents.length > 0 && !selectedStudent && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
              {filteredStudents.map(s => {
                const sDues = dues.filter(d => d.student_id === s.id)
                const totalDue = sDues.reduce((sum, d) => sum + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)
                return (
                  <button key={s.id} onClick={() => selectStudent(s)}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center justify-between border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.student_id} {s.phone ? `• ${s.phone}` : ""}</p>
                    </div>
                    {totalDue > 0 && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">Due: {formatCurrency(totalDue)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button onClick={openRecordPaymentModal} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all whitespace-nowrap">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Selected Student — Show Dues */}
      {selectedStudent && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">{selectedStudent.name}</h3>
              <p className="text-sm text-gray-500">{selectedStudent.student_id} {selectedStudent.phone ? `• ${selectedStudent.phone}` : ""}</p>
            </div>
            <button onClick={() => { setSelectedStudent(null); setPayingDue(null) }} className="p-1.5 hover:bg-white/50 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
          </div>

          {studentDues.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium"><Check className="w-4 h-4" /> No pending dues — all clear!</div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4 text-red-500" /> Pending Dues ({studentDues.length})</p>
              {studentDues.map(d => {
                const outstanding = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
                const isSelected = payingDue?.id === d.id
                return (
                  <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected ? "border-emerald-500 bg-emerald-100 shadow-md" : "border-gray-200 bg-white hover:border-emerald-300"
                  }`} onClick={() => selectDueToPay(d)}>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{getBatchName(d.batch)}</p>
                      <p className="text-xs text-gray-500">Month: {d.due_month} • Due: {formatDate(d.due_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(outstanding)}</p>
                      <p className="text-xs text-gray-400">of {formatCurrency(d.due_amount)}</p>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-emerald-600 ml-2" />}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pay button for selected due */}
          {payingDue && (
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <div className="bg-white rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><DollarSign className="w-4 h-4" /> Pay Due: {getBatchName(payingDue.batch)} — {payingDue.due_month}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount (৳)</label>
                    <input type="number" value={form.amount} onChange={e => update("amount", e.target.value)} className={`${inputClass} font-semibold`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Discount (৳)</label>
                    <input type="number" value={form.discount} onChange={e => update("discount", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                    <select value={form.payment_method} onChange={e => update("payment_method", e.target.value)} className={inputClass}>
                      <option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="card">Card</option><option value="bank">Bank</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button onClick={handlePay} disabled={loading} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {loading ? "Processing..." : `Pay ${formatCurrency(parseFloat(form.amount || "0") - parseFloat(form.discount || "0"))}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payments History Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Batch</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">For</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Print</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {payments.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">No payments recorded</td></tr> :
                payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-indigo-600">{p.receipt_number}</td>
                    <td className="px-4 py-3 text-sm">{p.student?.name}<br/><span className="text-xs text-gray-400">{p.student?.student_id}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.batch?.name || "-"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700">{formatCurrency(p.total_paid)}{p.discount > 0 && <span className="text-xs text-gray-400 block">disc: {formatCurrency(p.discount)}</span>}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 uppercase">{p.payment_method}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{p.payment_for}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(p.paid_at)}</td>
                    <td className="px-4 py-3"><button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Printer className="w-4 h-4" /></button></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal (manual entry) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-600" /> Record Payment</h3><button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handlePay} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
                <select required value={form.student_id} onChange={e => update("student_id", e.target.value)} className={inputClass}><option value="">-- Select Student --</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>)}</select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                <select value={form.batch_id} onChange={e => { update("batch_id", e.target.value); const b = batches.find(x => x.id === e.target.value); if (b) update("amount", String(b.monthly_fee)) }} className={inputClass}><option value="">-- Select Batch --</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name} (৳{b.monthly_fee})</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳) *</label><input type="number" required value={form.amount} onChange={e => update("amount", e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Discount (৳)</label><input type="number" value={form.discount} onChange={e => update("discount", e.target.value)} className={inputClass} /></div>
              </div>
              {form.amount && <div className="p-3 bg-emerald-50 rounded-lg text-sm font-medium text-emerald-800">Total: {formatCurrency(parseFloat(form.amount || "0") - parseFloat(form.discount || "0"))}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={form.payment_method} onChange={e => update("payment_method", e.target.value)} className={inputClass}><option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="card">Card</option><option value="bank">Bank Transfer</option></select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment For</label>
                  <select value={form.payment_for} onChange={e => update("payment_for", e.target.value)} className={inputClass}><option value="monthly">Monthly Fee</option><option value="admission">Admission Fee</option><option value="quarterly">Quarterly Fee</option><option value="material">Material</option><option value="other">Other</option></select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:bg-emerald-400 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
