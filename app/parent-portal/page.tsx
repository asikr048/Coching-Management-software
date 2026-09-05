"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { GraduationCap, Search, Loader2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function ParentPortal() {
  const supabase = createClient()
  const [studentId, setStudentId] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [student, setStudent] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [dues, setDues] = useState<any[]>([])
  const [error, setError] = useState("")

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("")
    try {
      const { data: s } = await supabase.from("students").select("*").eq("student_id", studentId).eq("guardian_phone", phone).maybeSingle()
      if (!s) { setError("Student not found. Check ID and phone number."); setStudent(null); return }
      setStudent(s)
      const [pmts, fDues] = await Promise.all([
        supabase.from("payments").select("*, batch:batches(name)").eq("student_id", s.id).order("paid_at", { ascending: false }).limit(10),
        supabase.from("fee_dues").select("*, batch:batches(name)").eq("student_id", s.id).in("status", ["pending", "partial"]),
      ])
      setPayments(pmts.data || [])
      setDues(fDues.data || [])
    } catch { setError("Something went wrong.") }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 rounded-2xl mb-3"><GraduationCap className="w-7 h-7 text-white" /></div>
          <h1 className="text-3xl font-bold text-gray-900">Parent Portal</h1>
          <p className="text-gray-500 mt-1">Check your child's payment and attendance</p>
        </div>
        <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label><input required value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="MS-12345" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Guardian Phone</label><input required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="01XXXXXXXXX" /></div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <button type="submit" disabled={loading} className="mt-4 w-full py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:bg-emerald-400 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</> : <><Search className="w-4 h-4" /> Search</>}
          </button>
        </form>

        {student && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Student Info</h3>
              <p className="text-sm"><strong>Name:</strong> {student.name}</p>
              <p className="text-sm"><strong>ID:</strong> {student.student_id}</p>
              <p className="text-sm"><strong>Class:</strong> {student.class_level || "-"}</p>
              <p className="text-sm"><strong>Enrolled:</strong> {formatDate(student.enrollment_date)}</p>
            </div>

            {dues.length > 0 && (
              <div className="bg-white rounded-xl border border-red-200 p-6">
                <h3 className="font-semibold text-red-700 mb-3">Pending Fees</h3>
                {dues.map(d => (
                  <div key={d.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div><p className="text-sm font-medium">{d.batch?.name}</p><p className="text-xs text-gray-500">{d.due_month}</p></div>
                    <p className="font-bold text-red-600">{formatCurrency(Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)))}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Recent Payments</h3>
              {payments.length === 0 ? <p className="text-gray-400 text-sm">No payments found</p> :
                payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div><p className="text-sm font-medium">{p.batch?.name || p.payment_for}</p><p className="text-xs text-gray-500">{p.receipt_number} • {formatDate(p.paid_at)}</p></div>
                    <p className="font-bold text-emerald-600">{formatCurrency(p.total_paid)}</p>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
