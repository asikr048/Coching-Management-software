"use client"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
  CreditCard, ArrowLeft, Loader2, CheckCircle, Copy, Check,
  Banknote, AlertCircle, Info, Smartphone, Send, KeyRound, Hash, Phone
} from "lucide-react"
import Link from "next/link"

interface Batch {
  id: string; name: string; subject: string | null; class_level: string | null
  monthly_fee: number; admission_fee: number; fee_type: string; current_seats: number; max_seats: number
}

interface PaymentAccount {
  id: string; method: string; account_number: string; account_name: string | null; is_active: boolean
}

const methodConfig: Record<string, { label: string; color: string; activeColor: string; gradient: string; icon: string }> = {
  bkash: { label: "bKash", color: "border-pink-300 bg-pink-50 text-pink-700", activeColor: "border-pink-500 bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-200", gradient: "from-pink-500 to-pink-600", icon: "📱" },
  nagad: { label: "Nagad", color: "border-orange-300 bg-orange-50 text-orange-700", activeColor: "border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-200", gradient: "from-orange-500 to-orange-600", icon: "📱" },
  rocket: { label: "Rocket", color: "border-purple-300 bg-purple-50 text-purple-700", activeColor: "border-purple-500 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-200", gradient: "from-purple-500 to-purple-600", icon: "🚀" },
  upay: { label: "Upay", color: "border-blue-300 bg-blue-50 text-blue-700", activeColor: "border-blue-500 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200", gradient: "from-blue-500 to-blue-600", icon: "💳" },
  offline: { label: "Offline / Cash", color: "border-gray-300 bg-gray-50 text-gray-700", activeColor: "border-gray-600 bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg shadow-gray-200", gradient: "from-gray-600 to-gray-700", icon: "💵" },
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
  const isOffline = paymentMethod === "offline"
  const isMobile = ["bkash", "nagad", "rocket", "upay"].includes(paymentMethod)
  const activeAccount = accounts.find(a => a.method === paymentMethod)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBatch || !paymentMethod) { toast.error("Please select batch and payment method"); return }
    if (payAmountNum <= 0) { toast.error("Payment amount must be greater than 0"); return }
    if (isMobile && !transactionId.trim()) { toast.error("Please enter your Transaction ID"); return }
    if (isMobile && !senderNumber.trim()) { toast.error("Please enter your sender number"); return }

    setSubmitting(true)
    try {
      const dueDate = new Date()
      dueDate.setMonth(dueDate.getMonth() + 1)
      dueDate.setDate(10)

      const { error } = await supabase.from("payment_submissions").insert({
        student_id: studentDbId, batch_id: selectedBatch,
        amount: payAmountNum, total_fee: totalFee, due_amount: dueAmount,
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
    } finally { setSubmitting(false) }
  }

  function copyText(text: string, type: "number" | "amount") {
    navigator.clipboard.writeText(text)
    if (type === "number") { setCopiedNumber(true); setTimeout(() => setCopiedNumber(false), 2000) }
    else { setCopiedAmount(true); setTimeout(() => setCopiedAmount(false), 2000) }
    toast.success("Copied!")
  }

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all"

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" /><p className="text-sm text-gray-500">Loading payment details...</p></div>
    </div>
  )

  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100 p-10 max-w-md w-full text-center border border-gray-100">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted!</h2>
        <p className="text-gray-600 mb-6">Your payment of <strong className="text-indigo-600">{formatCurrency(payAmountNum)}</strong> has been submitted for verification.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0"><AlertCircle className="w-4 h-4 text-amber-600" /></div>
            <p className="text-sm text-amber-700 text-left">An admin will verify your transaction and approve your enrollment within <strong>24 hours</strong>.</p>
          </div>
        </div>
        <Link href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all">Go to Homepage</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/enroll" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm hover:shadow">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center"><CreditCard className="w-5 h-5 text-white" /></div>
            Complete Payment
          </h1>
          <div className="w-20" />
        </div>

        {/* Student Banner */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{studentName || "Student"}</p>
            <p className="text-sm text-gray-500">Student ID: <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{studentCode}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Batch + Fee */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">1</div>
                <h3 className="font-bold text-gray-900">Select Batch</h3>
              </div>
              <select value={selectedBatch} onChange={e => { setSelectedBatch(e.target.value); setPayAmount("") }} required className={inputClass}>
                <option value="">Choose a batch...</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id} disabled={b.current_seats >= b.max_seats}>
                    {b.name} {b.subject ? `(${b.subject})` : ""} {b.class_level ? `- ${b.class_level}` : ""} — {formatCurrency(b.admission_fee + b.monthly_fee)} {b.current_seats >= b.max_seats ? "(Full)" : ""}
                  </option>
                ))}
              </select>

              {batch && (
                <div className="mt-5 space-y-3">
                  <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                    <span className="text-gray-500">Admission Fee</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(batch.admission_fee)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                    <span className="text-gray-500">Monthly Fee <span className="text-xs text-gray-400">({batch.fee_type})</span></span>
                    <span className="font-semibold text-gray-800">{formatCurrency(batch.monthly_fee)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-gray-900">Total Amount</span>
                    <span className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">৳{totalFee.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Amount */}
            {batch && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">2</div>
                  <h3 className="font-bold text-gray-900">Payment Amount</h3>
                </div>
                <label className="block text-sm font-medium text-gray-600 mb-2">How much are you paying now? (৳)</label>
                <input type="number" required min="1" max={totalFee} value={payAmount} onChange={e => setPayAmount(e.target.value)} className={`${inputClass} text-lg font-semibold`} placeholder={`Max ৳${totalFee.toLocaleString()}`} />

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-xs text-emerald-600 font-semibold mb-1 uppercase tracking-wider">Paying Now</p>
                    <p className="text-2xl font-black text-emerald-700">৳{payAmountNum.toLocaleString()}</p>
                  </div>
                  <div className={`border rounded-xl p-4 text-center ${dueAmount > 0 ? "bg-gradient-to-br from-red-50 to-red-100 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                    <p className={`text-xs font-semibold mb-1 uppercase tracking-wider ${dueAmount > 0 ? "text-red-600" : "text-gray-400"}`}>Due Amount</p>
                    <p className={`text-2xl font-black ${dueAmount > 0 ? "text-red-600" : "text-gray-300"}`}>৳{dueAmount.toLocaleString()}</p>
                  </div>
                </div>
                {dueAmount > 0 && (
                  <div className="flex items-start gap-2 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">Remaining <strong>৳{dueAmount.toLocaleString()}</strong> will be due on the 10th of next month.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Payment Method + HOW TO PAY + Form */}
          {batch && payAmountNum > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Pay Via + Instructions */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-xs">3</div>
                    <h3 className="font-bold text-gray-900">Pay Via</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(methodConfig).map(([key, cfg]) => (
                      <button
                        key={key} type="button"
                        onClick={() => setPaymentMethod(key)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${paymentMethod === key ? cfg.activeColor : cfg.color + " hover:scale-105"}`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* HOW TO PAY - Mobile Payment */}
                {isMobile && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-5">How to Pay</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><Smartphone className="w-4 h-4 text-gray-600" /></div>
                        <p className="text-sm text-gray-700 pt-1">Open <strong className={`bg-gradient-to-r ${methodConfig[paymentMethod]?.gradient} bg-clip-text text-transparent`}>{methodConfig[paymentMethod]?.label}</strong>, <strong className={`bg-gradient-to-r ${methodConfig[paymentMethod]?.gradient} bg-clip-text text-transparent`}>Nagad</strong>, <strong className={`bg-gradient-to-r ${methodConfig[paymentMethod]?.gradient} bg-clip-text text-transparent`}>Rocket</strong>, or <strong className={`bg-gradient-to-r ${methodConfig[paymentMethod]?.gradient} bg-clip-text text-transparent`}>Upay</strong> App — or Dial on Phone</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><Send className="w-4 h-4 text-gray-600" /></div>
                        <p className="text-sm text-gray-700 pt-1">Choose &quot;<strong className="text-emerald-600">Send Money</strong>&quot;</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><Phone className="w-4 h-4 text-gray-600" /></div>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <p className="text-sm text-gray-700">Send to:</p>
                          {activeAccount ? (
                            <>
                              <span className={`px-3 py-1 rounded-lg font-mono font-black text-sm bg-gradient-to-r ${methodConfig[paymentMethod]?.gradient} text-white`}>
                                {activeAccount.account_number}
                              </span>
                              <button type="button" onClick={() => copyText(activeAccount.account_number, "number")} className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1">
                                {copiedNumber ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-lg">Contact admin for payment number</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><Banknote className="w-4 h-4 text-gray-600" /></div>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <p className="text-sm text-gray-700">Enter exact amount:</p>
                          <span className={`px-3 py-1 rounded-lg font-black text-sm bg-gradient-to-r ${methodConfig[paymentMethod]?.gradient} text-white`}>
                            {payAmountNum.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">BDT</span>
                          <button type="button" onClick={() => copyText(String(payAmountNum), "amount")} className="px-2 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors flex items-center gap-1">
                            {copiedAmount ? <><Check className="w-3 h-3 text-emerald-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0"><KeyRound className="w-4 h-4 text-gray-600" /></div>
                        <p className="text-sm text-gray-700 pt-1">Enter your <strong className="text-indigo-600">PIN</strong> to confirm</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Offline Info */}
                {isOffline && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">Offline / Cash Payment</h4>
                        <p className="text-sm text-gray-500">Visit <strong>MedhaShiree</strong> center to pay in person. Add a reference note below so staff can identify your payment.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Payment Details Form */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-6">Payment Details</h3>

                <div className="space-y-5">
                  {isMobile && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Sender Number *</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input required value={senderNumber} onChange={e => setSenderNumber(e.target.value)} className={`${inputClass} pl-10`} placeholder="01XXXXXXXXX" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction ID (TrxID) *</label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input required value={transactionId} onChange={e => setTransactionId(e.target.value)} className={`${inputClass} pl-10`} placeholder="e.g. ABC1234XYZ" />
                        </div>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{isOffline ? "Reference Note" : "Additional Notes"}</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder={isOffline ? "e.g. Will pay at center on Monday" : "Optional notes"} />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">Your payment info is submitted securely. An admin will verify your transaction and grant access within <strong>24 hours</strong>.</p>
                  </div>

                  <button type="submit" disabled={submitting} className="w-full py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                    {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : <><CreditCard className="w-5 h-5" /> Submit Payment ✓</>}
                  </button>

                  <Link href="/enroll" className="block text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-1">Cancel</Link>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <PaymentContent />
    </Suspense>
  )
}
