"use client"
import { useState, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
  ShoppingBag, Star, Search, X, Loader2, UserPlus, Check,
  CreditCard, Printer, ShieldAlert, Download
} from "lucide-react"

interface Course { id: string; title: string; description?: string; price: number; discount_price?: number; status: string; level?: string; total_sales: number; rating?: number; rating_count?: number; teacher?: { name: string } | { name: string }[] | null }
interface StudentOpt { id: string; name: string; student_id: string; phone?: string; email?: string }

export default function MarketplaceClient({ courses, students: initialStudents }: { courses: Course[]; students: StudentOpt[] }) {
  const supabase = createClient()
  const [students, setStudents] = useState(initialStudents)

  // Buy course modal state
  const [buyModal, setBuyModal] = useState<Course | null>(null)
  const [step, setStep] = useState<"select" | "payment" | "receipt">("select")
  const [search, setSearch] = useState("")
  const [selectedStudent, setSelectedStudent] = useState<StudentOpt | null>(null)
  const [isNewStudent, setIsNewStudent] = useState(false)
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "", guardian_phone: "" })
  const [payMethod, setPayMethod] = useState("cash")
  const [paidAmount, setPaidAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [receipt, setReceipt] = useState<{ receipt_number: string; student_name: string; student_id: string; course: string; amount: number; method: string; date: string } | null>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  function getTeacherName(t: Course["teacher"]): string {
    if (!t) return "Unknown"
    if (Array.isArray(t)) return t[0]?.name || "Unknown"
    return t.name || "Unknown"
  }

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return students.filter(s => s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))).slice(0, 8)
  }, [search, students])

  function openBuy(course: Course) {
    setBuyModal(course)
    setStep("select")
    setSearch("")
    setSelectedStudent(null)
    setIsNewStudent(false)
    setNewForm({ name: "", phone: "", email: "", guardian_phone: "" })
    setPayMethod("cash")
    setPaidAmount(String(course.discount_price || course.price))
    setReceipt(null)
  }

  function closeBuy() { setBuyModal(null); setReceipt(null) }

  async function handleBuy() {
    if (!buyModal) return
    setLoading(true)
    try {
      let student = selectedStudent

      // If new student, create account first
      if (isNewStudent) {
        if (!newForm.name.trim()) { toast.error("Student name is required"); setLoading(false); return }
        if (!newForm.guardian_phone.trim()) { toast.error("Guardian phone is required"); setLoading(false); return }

        const { data: newStudent, error: sErr } = await supabase.from("students").insert({
          name: newForm.name.trim(),
          phone: newForm.phone.trim() || null,
          email: newForm.email.trim() || null,
          guardian_phone: newForm.guardian_phone.trim(),
          guardian_relation: "Parent",
        }).select().single()
        if (sErr) throw new Error(sErr.message || "Failed to create student")

        student = { id: newStudent.id, name: newStudent.name, student_id: newStudent.student_id, phone: newStudent.phone }
        setStudents(prev => [student!, ...prev])
        setSelectedStudent(student)
      }

      if (!student) { toast.error("Please select a student"); setLoading(false); return }

      const amount = parseFloat(paidAmount) || buyModal.price

      // Insert purchase
      const { data: purchase, error: pErr } = await supabase.from("course_purchases").insert({
        course_id: buyModal.id,
        student_id: student.id,
        buyer_name: student.name,
        buyer_phone: student.phone || null,
        buyer_email: (student as any).email || null,
        amount_paid: amount,
        payment_method: payMethod,
        teacher_earnings: amount * 0.7,
        platform_earnings: amount * 0.3,
      }).select().single()
      if (pErr) throw new Error(pErr.message || "Failed to record purchase")

      // Also record as payment
      await supabase.from("payments").insert({
        student_id: student.id,
        amount: amount,
        total_paid: amount,
        payment_method: payMethod,
        payment_for: "material",
        payment_month: new Date().toISOString().slice(0, 7),
        notes: `Course: ${buyModal.title}`,
      })

      // Set receipt data
      setReceipt({
        receipt_number: purchase.id?.slice(0, 8).toUpperCase() || "N/A",
        student_name: student.name,
        student_id: student.student_id,
        course: buyModal.title,
        amount,
        method: payMethod,
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      })
      setStep("receipt")
      toast.success("Course purchased successfully!")
    } catch (err: any) {
      toast.error(err?.message || "Purchase failed")
    } finally { setLoading(false) }
  }

  function handlePrint() {
    if (!receiptRef.current) return
    const win = window.open("", "_blank", "width=400,height=600")
    if (!win) return
    win.document.write(`<html><head><title>Receipt</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; max-width: 350px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 15px; }
      .header h2 { margin: 0; font-size: 18px; } .header p { margin: 2px 0; font-size: 11px; color: #666; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .row .label { color: #666; } .row .value { font-weight: 600; }
      .total { border-top: 2px dashed #333; margin-top: 10px; padding-top: 10px; font-size: 16px; font-weight: bold; text-align: center; }
      .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #999; border-top: 1px dashed #ccc; padding-top: 10px; }
      @media print { body { margin: 0; } }
    </style></head><body>
      <div class="header"><h2>MedhaShiree</h2><p>Course Purchase Receipt</p></div>
      <div class="row"><span class="label">Receipt #</span><span class="value">${receipt?.receipt_number}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${receipt?.date}</span></div>
      <div class="row"><span class="label">Student</span><span class="value">${receipt?.student_name}</span></div>
      <div class="row"><span class="label">Student ID</span><span class="value">${receipt?.student_id}</span></div>
      <div class="row"><span class="label">Course</span><span class="value">${receipt?.course}</span></div>
      <div class="row"><span class="label">Method</span><span class="value">${receipt?.method?.toUpperCase()}</span></div>
      <div class="total">Total Paid: ৳${receipt?.amount?.toLocaleString("en-BD")}</div>
      <div class="footer"><p>Thank you for your purchase!</p><p>MedhaShiree Coaching Center</p></div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all"

  return (
    <div>
      {/* Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map(c => (
          <div key={c.id} className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-xl hover:border-amber-500/30 transition-all">
            <div className="h-32 bg-gradient-to-r from-amber-500/10 via-slate-800 to-amber-600/10 border-b border-slate-800 flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-amber-400/40" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-white text-base">{c.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">by {getTeacherName(c.teacher)}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
                  c.status === "published" 
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                    : c.status === "pending_review" 
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" 
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {c.status}
                </span>
              </div>
              {c.description && <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{c.description}</p>}
              <div className="flex items-center justify-between mt-3.5">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-semibold text-slate-300">{c.rating || 0} ({c.rating_count || 0})</span>
                </div>
                <div className="text-right">
                  {c.discount_price && c.discount_price < c.price ? (
                    <>
                      <span className="text-xs text-slate-500 line-through mr-1.5">{formatCurrency(c.price)}</span>
                      <span className="font-black text-amber-400 text-base">{formatCurrency(c.discount_price)}</span>
                    </>
                  ) : (
                    <span className="font-black text-amber-400 text-base">{formatCurrency(c.price)}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">{c.total_sales || 0} sales • {c.level || "All levels"}</p>
              <button 
                onClick={() => openBuy(c)} 
                className="w-full mt-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" /> Buy Course
              </button>
            </div>
          </div>
        ))}
        {courses.length === 0 && <div className="col-span-full text-center py-16 text-slate-500 font-medium">No courses available in the marketplace yet.</div>}
      </div>

      {/* Buy Course Modal */}
      {buyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-800 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">Buy Course</h3>
                <p className="text-sm text-slate-400">{buyModal.title} — <strong className="text-amber-400 font-bold">{formatCurrency(buyModal.discount_price || buyModal.price)}</strong></p>
              </div>
              <button onClick={closeBuy} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5">
              {/* Step 1: Select Student */}
              {step === "select" && (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Step 1: Select or Create Student</p>

                  {!isNewStudent && !selectedStudent && (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student by name, ID, or phone..."
                          className="w-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 border border-slate-700 rounded-xl focus:outline-none focus:border-amber-400 bg-slate-950" />
                        {filteredStudents.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
                            {filteredStudents.map(s => (
                              <button key={s.id} onClick={() => { setSelectedStudent(s); setSearch("") }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-sm flex items-center justify-between transition-colors cursor-pointer">
                                <div><p className="font-bold text-white">{s.name}</p><p className="text-xs text-slate-400"><span className="text-amber-400 font-mono">{s.student_id}</span> {s.phone ? `• ${s.phone}` : ""}</p></div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-slate-500">or</span>
                      </div>
                      <button onClick={() => setIsNewStudent(true)} className="w-full py-2.5 border-2 border-dashed border-amber-500/40 text-amber-400 rounded-xl text-sm font-bold hover:bg-amber-500/10 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                        <UserPlus className="w-4 h-4" /> Create New Student
                      </button>
                    </>
                  )}

                  {/* Selected student card */}
                  {selectedStudent && !isNewStudent && (
                    <div className="flex items-center justify-between p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/30">
                      <div>
                        <p className="text-sm font-bold text-white">{selectedStudent.name}</p>
                        <p className="text-xs text-amber-400 font-mono font-bold">{selectedStudent.student_id} {selectedStudent.phone ? `• ${selectedStudent.phone}` : ""}</p>
                      </div>
                      <button onClick={() => setSelectedStudent(null)} className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer">Change</button>
                    </div>
                  )}

                  {/* New student form */}
                  {isNewStudent && (
                    <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1"><UserPlus className="w-4 h-4 text-amber-400" /> New Student</p>
                        <button onClick={() => setIsNewStudent(false)} className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer">Cancel</button>
                      </div>
                      <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Student Name *" className={inputClass} />
                      <div className="grid grid-cols-2 gap-3">
                        <input value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={inputClass} />
                        <input value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputClass} />
                      </div>
                      <input value={newForm.guardian_phone} onChange={e => setNewForm(f => ({ ...f, guardian_phone: e.target.value }))} placeholder="Guardian Phone *" className={inputClass} />
                    </div>
                  )}

                  {(selectedStudent || isNewStudent) && (
                    <button onClick={() => setStep("payment")} className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-sm font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer">
                      Next → Payment
                    </button>
                  )}
                </div>
              )}

              {/* Step 2: Payment */}
              {step === "payment" && (
                <div className="space-y-4">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Step 2: Payment</p>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-slate-400">Course</span><span className="font-bold text-white">{buyModal.title}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Student</span><span className="font-bold text-white">{selectedStudent?.name || newForm.name}</span></div>
                    <div className="flex justify-between pt-1 border-t border-slate-800"><span className="text-slate-400">Price</span><span className="font-black text-amber-400">{formatCurrency(buyModal.discount_price || buyModal.price)}</span></div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Amount (৳)</label>
                    <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={`${inputClass} font-bold`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Payment Method</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputClass}>
                      <option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="card">Card</option><option value="bank">Bank Transfer</option>
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setStep("select")} className="flex-1 py-2.5 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer">← Back</button>
                    <button onClick={handleBuy} disabled={loading} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Check className="w-4 h-4 text-slate-950" />}
                      {loading ? "Processing..." : `Pay ${formatCurrency(parseFloat(paidAmount) || 0)}`}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Receipt */}
              {step === "receipt" && receipt && (
                <div className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-2"><Check className="w-7 h-7" /></div>
                    <p className="text-lg font-black text-white">Purchase Successful!</p>
                  </div>

                  <div ref={receiptRef} className="border border-slate-800 rounded-2xl p-5 bg-slate-950 space-y-2">
                    <div className="text-center border-b border-dashed border-slate-800 pb-3 mb-3">
                      <p className="font-black text-amber-400">MedhaShiree</p>
                      <p className="text-xs text-slate-400">Course Purchase Receipt</p>
                    </div>
                    {[
                      ["Receipt #", receipt.receipt_number],
                      ["Date", receipt.date],
                      ["Student", receipt.student_name],
                      ["Student ID", receipt.student_id],
                      ["Course", receipt.course],
                      ["Method", receipt.method.toUpperCase()],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-slate-400">{label}</span>
                        <span className="font-bold text-white">{value}</span>
                      </div>
                    ))}
                    <div className="border-t border-dashed border-slate-800 pt-3 mt-3 text-center">
                      <p className="text-lg font-black text-amber-400">Total: {formatCurrency(receipt.amount)}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handlePrint} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer">
                      <Printer className="w-4 h-4" /> Print Receipt
                    </button>
                    <button onClick={closeBuy} className="flex-1 py-2.5 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
