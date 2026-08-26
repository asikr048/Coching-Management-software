"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, X, Loader2, CreditCard, Printer } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface StudentOpt { id: string; name: string; student_id: string }
interface BatchOpt { id: string; name: string; monthly_fee: number }
interface PaymentRow { id: string; amount: number; discount: number; total_paid: number; payment_method: string; payment_for: string; payment_month?: string; receipt_number: string; paid_at: string; student?: { name: string; student_id: string }; batch?: { name: string } }

export default function PaymentsClient({ payments: initial, students, batches }: { payments: PaymentRow[]; students: StudentOpt[]; batches: BatchOpt[] }) {
  const [payments, setPayments] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const [form, setForm] = useState({ student_id: "", batch_id: "", amount: "", discount: "0", payment_method: "cash", payment_for: "monthly", payment_month: "" })

  function update(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
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

      if (form.batch_id && form.payment_for === "monthly") {
        await supabase.from("fee_dues").update({ paid_amount: total, status: total >= amt ? "paid" : "partial" })
          .eq("student_id", form.student_id).eq("batch_id", form.batch_id).eq("due_month", month)
      }

      setPayments([data, ...payments])
      setShowModal(false)
      toast.success(`Payment of ${formatCurrency(total)} recorded! Receipt: ${data.receipt_number}`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Payment failed") }
    finally { setLoading(false) }
  }

  const selectedBatch = batches.find(b => b.id === form.batch_id)
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

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
