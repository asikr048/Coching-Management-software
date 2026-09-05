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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/10 shrink-0">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{student.name}</h2>
            <p className="text-sm text-amber-400 font-mono font-bold">{student.student_id}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${student.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>{student.is_active ? "Active" : "Inactive"}</span>
              {student.biometric_enrolled && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1"><Fingerprint className="w-3.5 h-3.5" /> Biometric</span>}
              {student.referral_code && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">Ref: {student.referral_code}</span>}
            </div>
          </div>
        </div>
        <Link href={`/dashboard/owner/students/${id}/edit`} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all shrink-0 self-start sm:self-center">Edit Student</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-400 font-medium">Total Paid</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-400 font-medium">Attendance</p>
          <p className="text-xl font-black text-amber-400 mt-1">{attendancePct}%</p>
          <p className="text-xs text-slate-500 mt-0.5">{presentDays}/{totalDays} days</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-400 font-medium">Active Batches</p>
          <p className="text-xl font-black text-blue-400 mt-1">{(enrollments.data || []).filter(e => e.status === "active").length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-400 font-medium">Exams Taken</p>
          <p className="text-xl font-black text-purple-400 mt-1">{results.data?.length || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-4">Personal Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2.5 text-slate-300"><User className="w-4 h-4 text-amber-400/80" /> Gender: <span className="font-semibold text-slate-900">{student.gender || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-300"><Calendar className="w-4 h-4 text-amber-400/80" /> DOB: <span className="font-semibold text-slate-900">{student.date_of_birth ? formatDate(student.date_of_birth) : "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-300"><Phone className="w-4 h-4 text-amber-400/80" /> Phone: <span className="font-semibold text-slate-900">{student.phone || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-300"><Mail className="w-4 h-4 text-amber-400/80" /> Email: <span className="font-semibold text-slate-900">{student.email || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-300"><MapPin className="w-4 h-4 text-amber-400/80" /> Address: <span className="font-semibold text-slate-900">{student.address || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-300"><BookOpen className="w-4 h-4 text-amber-400/80" /> Academic: <span className="font-semibold text-slate-900">{student.school_college || "-"} ({student.class_level || "-"})</span></div>
          </div>
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="font-bold text-slate-200 text-sm mb-2">Guardian Information</h4>
            <p className="text-sm text-slate-300">{student.guardian_name || "-"} <span className="text-slate-400">({student.guardian_relation})</span></p>
            <p className="text-sm text-amber-400 font-mono font-bold mt-0.5">{student.guardian_phone || "No phone registered"}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-4">Enrolled Batches</h3>
          <div className="space-y-2.5">
            {(enrollments.data || []).map(e => (
              <div key={e.id} className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{e.batch?.name}</p>
                  <p className="text-xs text-slate-400">{e.batch?.subject || ""}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${e.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-400 border border-slate-700"}`}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>
          {(!enrollments.data || enrollments.data.length === 0) && <p className="text-slate-500 text-sm text-center py-6">Not enrolled in any batches</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl overflow-hidden">
        <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-400" /> Payment History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-2.5">Receipt</th>
                <th className="px-3 py-2.5">Batch</th>
                <th className="px-3 py-2.5">Amount</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payments.data || []).map(p => (
                <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs font-mono font-bold text-amber-400">{p.receipt_number}</td>
                  <td className="px-3 py-2.5 text-sm text-white font-medium">{p.batch?.name || p.payment_for}</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-emerald-400">{formatCurrency(p.total_paid)}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400 text-right">{formatDate(p.paid_at)}</td>
                </tr>
              ))}
              {(!payments.data || payments.data.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-sm">No payment records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}