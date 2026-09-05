import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { User, Phone, Mail, MapPin, BookOpen, CreditCard, Calendar, Fingerprint } from "lucide-react"
import Link from "next/link"

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: student } = await supabase.from("students").select("*").eq("id", id).single()
  if (!student) notFound()

  const [enrollments, payments, attendance, results] = await Promise.all([
    supabase.from("enrollments").select("*, batch:batches(name, subject, monthly_fee)").eq("student_id", id),
    supabase.from("payments").select("*, batch:batches(name)").eq("student_id", id).order("paid_at", { ascending: false }).limit(10),
    supabase.from("attendance").select("date, status, batch:batches(name)").eq("student_id", id).order("date", { ascending: false }).limit(20),
    supabase.from("exam_results").select("*, exam:exams(title, total_marks, exam_date)").eq("student_id", id).order("created_at", { ascending: false }),
  ])

  const totalPaid = (payments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const presentDays = (attendance.data || []).filter(a => a.status === "present").length
  const totalDays = attendance.data?.length || 0
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700 font-bold text-2xl">{student.name.charAt(0)}</div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
            <p className="text-sm text-gray-500 font-mono">{student.student_id}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${student.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{student.is_active ? "Active" : "Inactive"}</span>
              {student.biometric_enrolled && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1"><Fingerprint className="w-3 h-3" /> Biometric</span>}
              {student.referral_code && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Ref: {student.referral_code}</span>}
            </div>
          </div>
        </div>
        <Link href={`/dashboard/owner/students/${id}/edit`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Edit Student</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className="text-xs text-gray-500">Total Paid</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className="text-xs text-gray-500">Attendance</p><p className="text-xl font-bold text-indigo-600">{attendancePct}%</p><p className="text-xs text-gray-400">{presentDays}/{totalDays} days</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className="text-xs text-gray-500">Batches</p><p className="text-xl font-bold text-blue-600">{(enrollments.data || []).filter(e => e.status === "active").length}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className="text-xs text-gray-500">Exams</p><p className="text-xl font-bold text-purple-600">{results.data?.length || 0}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Personal Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600"><User className="w-4 h-4 text-gray-400" /> Gender: {student.gender || "-"}</div>
            <div className="flex items-center gap-2 text-gray-600"><Calendar className="w-4 h-4 text-gray-400" /> DOB: {student.date_of_birth ? formatDate(student.date_of_birth) : "-"}</div>
            <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-gray-400" /> {student.phone || "-"}</div>
            <div className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4 text-gray-400" /> {student.email || "-"}</div>
            <div className="flex items-center gap-2 text-gray-600"><MapPin className="w-4 h-4 text-gray-400" /> {student.address || "-"}</div>
            <div className="flex items-center gap-2 text-gray-600"><BookOpen className="w-4 h-4 text-gray-400" /> {student.school_college || "-"} ({student.class_level || "-"})</div>
          </div>
          <h4 className="font-medium text-gray-700 mt-4 mb-2">Guardian</h4>
          <p className="text-sm text-gray-600">{student.guardian_name || "-"} ({student.guardian_relation})</p>
          <p className="text-sm text-gray-500">{student.guardian_phone}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Enrolled Batches</h3>
          {(enrollments.data || []).map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
              <div><p className="font-medium text-gray-800 text-sm">{e.batch?.name}</p><p className="text-xs text-gray-500">{e.batch?.subject || ""}</p></div>
              <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{e.status}</span></div>
            </div>
          ))}
          {(!enrollments.data || enrollments.data.length === 0) && <p className="text-gray-400 text-sm text-center py-4">Not enrolled</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4"><CreditCard className="w-4 h-4 inline mr-1" /> Payment History</h3>
        <table className="w-full"><thead><tr className="bg-gray-50 border-b"><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Receipt</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Batch</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Amount</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Method</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Date</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {(payments.data || []).map(p => (<tr key={p.id}><td className="px-3 py-2 text-xs font-mono text-indigo-600">{p.receipt_number}</td><td className="px-3 py-2 text-sm">{p.batch?.name || p.payment_for}</td><td className="px-3 py-2 text-sm font-semibold text-emerald-700">{formatCurrency(p.total_paid)}</td><td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 uppercase">{p.payment_method}</span></td><td className="px-3 py-2 text-xs text-gray-500">{formatDate(p.paid_at)}</td></tr>))}
          {(!payments.data || payments.data.length === 0) && <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-sm">No payments</td></tr>}
        </tbody></table>
      </div>
    </div>
  )
}