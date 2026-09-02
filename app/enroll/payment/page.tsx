"use client"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
  CreditCard, ArrowLeft, Loader2, CheckCircle, Copy, Check,
  Smartphone, Banknote, AlertCircle, Info
} from "lucide-react"
import Link from "next/link"

interface Batch {
  id: string; name: string; subject: string | null; class_level: string | null
  monthly_fee: number; admission_fee: number; fee_type: string; current_seats: number; max_seats: number
}

interface PaymentAccount {
  id: string; method: string; account_number: string; account_name: string | null; is_active: boolean
}

const methodColors: Record<string, { bg: string; text: string; border: string; active: string }> = {
  bkash: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", active: "bg-pink-600 text-white border-pink-600" },
  nagad: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", active: "bg-orange-600 text-white border-orange-600" },
  rocket: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", active: "bg-purple-600 text-white border-purple-600" },
  upay: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", active: "bg-blue-600 text-white border-blue-600" },
  offline: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", active: "bg-gray-700 text-white border-gray-700" },
}

const methodLabels: Record<string, string> = {
  bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", offline: "Offline / Cash"
}

function PaymentContent() {
  const searchParams = useSearchParams()
  const studentDbId = searchParams.get("student_id") || ""
  const studentCode = searchParams.get("student_code") || ""
  const studentName = searchParams.get("name") || ""

  const supabase = createClient()
  const [batches, setBatches] = useState<Batch[]>([])
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [copiedNumber, setCopiedNumber] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)

  const [selectedBatch, setSelectedBatch] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [payAmount, setPayAmount] = useState("")
  const [senderNumber, setSenderNumber] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    async function load() {
      const [batchRes, accountRes] = await Promise.all([
        supabase.from("batches").select("id, name, subject, class_level, monthly_fee, admission_fee, fee_type, current_seats, max_seats").eq("is_active", true).order("name"),
        supabase.from("payment_accounts").select("*").eq("is_active", true).order("method"),
      ])
      setBatches(batchRes.data || [])
      setAccounts(accountRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const batch = batches.find(b => b.id === selectedBatch)
  const totalFee = batch ? (batch.admission_fee || 0) + (batch.monthly_fee || 0) : 0
  const payAmountNum = parseFloat(payAmount) || 0
  const dueAmount = Math.max(0, totalFee - payAmountNum)

  const activeAccounts = accounts.filter(a => a.method === paymentMethod)
  const selectedAccount = activeAccounts[0]

  const isOffline = paymentMethod === "offline"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBatch || !paymentMethod) { toast.error("Please select batch and payment method"); return }
    if (payAmountNum <= 0) { toast.error("Payment amount must be greater than 0"); return }
    if (!isOffline && !transactionId.trim()) { toast.error("Please enter your Transaction ID"); return }
    if (!isOffline && !senderNumber.trim()) { toast.error("Please enter your sender number"); return }

    setSubmitting(true)
    try {
      const dueDate = new Date()
      dueDate.setMonth(dueDate.getMonth() + 1)
      dueDate.setDate(10) // due on 10th of next month

      const { error } = await supabase.from("payment_submissions").insert({
        student_id: studentDbId,
        batch_id: selectedBatch,
        amount: payAmountNum,
        total_fee: totalFee,
        due_amount: dueAmount,
        due_date: dueDate.toISOString().split("T")[0],
        payment_method: paymentMethod,
        sender_number: isOffline ? null : senderNumber.trim(),
        transaction_id: isOffline ? null : transactionId.trim(),
        notes: isOffline ? notes.trim() || "Offline/Cash payment" : notes.trim() || null,
      })
      if (error) throw error
      setSuccess(true)
      toast.success("Payment submitted for review!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit payment")
    } finally {
      setSubmitting(false)
    }
  }

  function copyToClipboard(text: string, type: "number" | "amount") {
    navigator.clipboard.writeText(text)
    if (type === "number") { setCopiedNumber(true); setTimeout(() => setCopiedNumber(false), 2000) }
    else { setCopiedAmount(true); setTimeout(() => setCopiedAmount(false), 2000) }
    toast.success("Copied!")
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
          <p className="text-gray-600 mb-4">Your payment of <strong className="text-indigo-600">{formatCurrency(payAmountNum)}</strong> has been submitted for verification.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 text-left">An admin will verify your transaction and approve your enrollment within 24 hours.</p>
            </div>
          </div>
          <Link href="/" className="inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Go to Homepage</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/enroll" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-indigo-600" /> Complete Payment</h1>
          <div />
        </div>

        {/* Student info banner */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">{studentName.charAt(0).toUpperCase()}</div>
          <div>
            <p className="font-semibold text-gray-800">{studentName || "Student"}</p>
            <p className="text-sm text-gray-500">ID: <span className="font-mono text-indigo-600">{studentCode}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT SIDE */}
          <div className="space-y-6">
            {/* Batch Selection */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Select Batch</h3>
              <select value={selectedBatch} onChange={e => { setSelectedBatch(e.target.value); setPayAmount("") }} required className={inputClass}>
                <option value="">Choose a batch...</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id} disabled={b.current_seats >= b.max_seats}>
                    {b.name} {b.subject ? `(${b.subject})` : ""} {b.class_level ? `- ${b.class_level}` : ""} — {formatCurrency(b.admission_fee + b.monthly_fee)} {b.current_seats >= b.max_seats ? "(Full)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Fee Summary */}
            {batch && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Fee Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Admission Fee</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(batch.admission_fee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Monthly Fee ({batch.fee_type})</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(batch.monthly_fee)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="font-semibold text-gray-800">Total Fee</span>
                    <span className="text-2xl font-bold text-indigo-600">৳{totalFee.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Amount */}
            {batch && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Payment Amount</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paying Now (৳) *</label>
                    <input
                      type="number" required min="1" max={totalFee}
                      value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      className={inputClass} placeholder={`Max ${totalFee}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-emerald-600 font-medium mb-1">Paying</p>
                      <p className="text-lg font-bold text-emerald-700">{formatCurrency(payAmountNum)}</p>
                    </div>
                    <div className={`border rounded-lg p-3 text-center ${dueAmount > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                      <p className={`text-xs font-medium mb-1 ${dueAmount > 0 ? "text-red-600" : "text-gray-500"}`}>Due Amount</p>
                      <p className={`text-lg font-bold ${dueAmount > 0 ? "text-red-700" : "text-gray-400"}`}>{formatCurrency(dueAmount)}</p>
                    </div>
                  </div>
                  {dueAmount > 0 && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">Remaining ৳{dueAmount.toLocaleString()} will be due on the 10th of next month.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div className="space-y-6">
            {/* Payment Method */}
            {batch && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">Payment Method</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["bkash", "nagad", "rocket", "upay", "offline"].map(m => {
                    const hasAccount = m === "offline" || accounts.some(a => a.method === m)
                    if (!hasAccount && m !== "offline") return null
                    const colors = methodColors[m]
                    const isSelected = paymentMethod === m
                    return (
                      <button
                        key={m} type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${isSelected ? colors.active : `${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`}`}
                      >
                        {methodLabels[m]}
                      </button>
                    )
                  })}
                </div>

                {/* Payment Instructions (for mobile payments) */}
                {paymentMethod && !isOffline && selectedAccount && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">How to Pay</h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-base">📱</span>
                        <p className="text-gray-700">Open <strong className={methodColors[paymentMethod]?.text}>{methodLabels[paymentMethod]}</strong> App — or Dial on Phone</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">👆</span>
                        <p className="text-gray-700">Choose &quot;<strong>Send Money</strong>&quot;</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">📞</span>
                        <div className="flex items-center gap-2">
                          <p className="text-gray-700">Send to:</p>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-sm ${methodColors[paymentMethod]?.bg} ${methodColors[paymentMethod]?.text}`}>
                            {selectedAccount.account_number}
                          </span>
                          <button type="button" onClick={() => copyToClipboard(selectedAccount.account_number, "number")} className="text-gray-400 hover:text-gray-600">
                            {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      {selectedAccount.account_name && (
                        <div className="flex items-start gap-2">
                          <span className="text-base">👤</span>
                          <p className="text-gray-700">Account: <strong>{selectedAccount.account_name}</strong></p>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="text-base">💰</span>
                        <div className="flex items-center gap-2">
                          <p className="text-gray-700">Enter exact amount:</p>
                          <span className={`px-2 py-0.5 rounded font-bold text-sm ${methodColors[paymentMethod]?.bg} ${methodColors[paymentMethod]?.text}`}>
                            {payAmountNum || "___"}
                          </span>
                          {payAmountNum > 0 && (
                            <>
                              <span className="text-xs text-gray-400">BDT</span>
                              <button type="button" onClick={() => copyToClipboard(String(payAmountNum), "amount")} className="text-gray-400 hover:text-gray-600">
                                {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base">🔑</span>
                        <p className="text-gray-700">Enter your <strong className="text-indigo-600">PIN</strong> to confirm</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Offline payment info */}
                {isOffline && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <Banknote className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Offline / Cash Payment</p>
                        <p className="text-xs text-gray-500 mt-1">Visit MedhaShiri center to pay in person. Enter a note below for reference.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Details Form */}
            {paymentMethod && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-indigo-600 mb-4 uppercase tracking-wider text-xs">Payment Details</h3>

                <div className="space-y-4">
                  {!isOffline && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Sender Number *</label>
                        <input
                          required value={senderNumber} onChange={e => setSenderNumber(e.target.value)}
                          className={inputClass} placeholder="01XXXXXXXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID (TrxID) *</label>
                        <input
                          required value={transactionId} onChange={e => setTransactionId(e.target.value)}
                          className={inputClass} placeholder="e.g. ABC1234XYZ"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{isOffline ? "Reference Note" : "Additional Notes"}</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder={isOffline ? "e.g. Will pay at center on Monday" : "Optional notes"} />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700">Your payment info is submitted securely. An admin will verify your transaction and grant access within 24 hours.</p>
                  </div>

                  <button type="submit" disabled={submitting} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CreditCard className="w-4 h-4" /> Submit Payment ✓</>}
                  </button>

                  <Link href="/enroll" className="block text-center text-sm text-gray-500 hover:text-gray-700">Cancel</Link>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <PaymentContent />
    </Suspense>
  )
}
