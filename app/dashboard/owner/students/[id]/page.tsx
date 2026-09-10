import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { User, Phone, Mail, MapPin, BookOpen, CreditCard, Calendar, Fingerprint, AlertCircle, CheckCircle, Package } from "lucide-react"
import Link from "next/link"
import StudentIdCardTrigger from "@/components/id-card/StudentIdCardTrigger"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  let { data: student } = await admin.from("students").select("*").eq("id", id).maybeSingle()
  if (!student) {
    const { data: fallback } = await supabase.from("students").select("*").eq("id", id).maybeSingle()
    student = fallback
  }
  if (!student) notFound()

  const [enrollments, payments, attendance, results, duesRes, issuesRes] = await Promise.all([
    admin.from("enrollments").select("*, batch:batches(name, subject, monthly_fee)").eq("student_id", id),
    admin.from("payments").select("*, batch:batches(name)").eq("student_id", id).order("paid_at", { ascending: false }).limit(20),
    admin.from("attendance").select("date, status, batch:batches(name)").eq("student_id", id).order("date", { ascending: false }).limit(20),
    admin.from("exam_results").select("*, exam:exams(title, total_marks, exam_date)").eq("student_id", id).order("created_at", { ascending: false }),
    admin.from("fee_dues").select("*, batch:batches(name)").eq("student_id", id).order("due_date", { ascending: false }),
    admin.from("material_issues").select("*, material:materials(name, type, subject, total_stock), batch:batches(name)").eq("student_id", id).order("issued_at", { ascending: false }),
  ])

  const duesList = duesRes.data || []
  const issuesList = (issuesRes.data || []).filter((i: any) => i.status !== "returned")
  const totalPaid = (payments.data || []).reduce((s, p) => s + (p.total_paid || 0), 0)
  const totalOutstandingDue = duesList
    .filter(d => d.status !== "paid" && d.status !== "waived")
    .reduce((s, d) => s + Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0)), 0)

  const presentDays = (attendance.data || []).filter(a => a.status === "present").length
  const totalDays = attendance.data?.length || 0
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/10 shrink-0">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{student.name}</h2>
            <p className="text-sm text-amber-600 font-mono font-bold">{student.student_id}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${student.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>{student.is_active ? "Active" : "Inactive"}</span>
              {(student.roll_no != null || student.batch_roll != null) && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                  রোল #{student.roll_no || student.batch_roll}
                </span>
              )}
              {student.biometric_enrolled && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-300 flex items-center gap-1"><Fingerprint className="w-3.5 h-3.5" /> Biometric</span>}
              {student.referral_code && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">Ref: {student.referral_code}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center flex-wrap">
          <StudentIdCardTrigger
            student={{
              ...student,
              roll_no: student.roll_no || student.batch_roll || enrollments.data?.[0]?.roll_no,
              batch_roll: student.roll_no || student.batch_roll || enrollments.data?.[0]?.roll_no,
            }}
            batchName={enrollments.data?.[0]?.batch?.name}
            buttonVariant="primary"
            buttonText="🪪 ID Card"
          />
          <Link href={`/dashboard/owner/students/${id}/edit`} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all">
            Edit Student
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-500 font-medium">Total Paid</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-500 font-medium">Outstanding Due</p>
          <p className={`text-xl font-black mt-1 ${totalOutstandingDue > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {formatCurrency(totalOutstandingDue)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-500 font-medium">Attendance</p>
          <p className="text-xl font-black text-amber-600 mt-1">{attendancePct}%</p>
          <p className="text-xs text-slate-500 mt-0.5">{presentDays}/{totalDays} days</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-500 font-medium">Active Batches</p>
          <p className="text-xl font-black text-blue-600 mt-1">{(enrollments.data || []).filter(e => e.status === "active").length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-500 font-medium">Exams Taken</p>
          <p className="text-xl font-black text-purple-600 mt-1">{results.data?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-center shadow-xl">
          <p className="text-xs text-slate-500 font-medium">Materials Received</p>
          <p className="text-xl font-black text-teal-600 mt-1">{issuesList.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">{issuesList.length === 1 ? "1 item" : `${issuesList.length} items`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-4">Personal Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2.5 text-slate-600"><User className="w-4 h-4 text-amber-600" /> Gender: <span className="font-semibold text-slate-900">{student.gender || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-600"><Calendar className="w-4 h-4 text-amber-600" /> DOB: <span className="font-semibold text-slate-900">{student.date_of_birth ? formatDate(student.date_of_birth) : "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-600"><Phone className="w-4 h-4 text-amber-600" /> Phone: <span className="font-semibold text-slate-900">{student.phone || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-600"><Mail className="w-4 h-4 text-amber-600" /> Email: <span className="font-semibold text-slate-900">{student.email || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-600"><MapPin className="w-4 h-4 text-amber-600" /> Address: <span className="font-semibold text-slate-900">{student.address || "-"}</span></div>
            <div className="flex items-center gap-2.5 text-slate-600"><BookOpen className="w-4 h-4 text-amber-600" /> Academic: <span className="font-semibold text-slate-900">{student.school_college || "-"} ({student.class_level || "-"})</span></div>
          </div>
          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="font-bold text-slate-800 text-sm mb-2">Guardian Information</h4>
            <p className="text-sm text-slate-700">{student.guardian_name || "-"} <span className="text-slate-500">({student.guardian_relation})</span></p>
            <p className="text-sm text-amber-700 font-mono font-bold mt-0.5">{student.guardian_phone || "No phone registered"}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-4">Enrolled Batches</h3>
          <div className="space-y-2.5">
            {(enrollments.data || []).map(e => {
              const roll = e.roll_no ?? student.roll_no ?? student.batch_roll
              return (
                <div key={e.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    {roll != null && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        রোল #{roll}
                      </span>
                    )}
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{e.batch?.name}</p>
                      <p className="text-xs text-slate-500">{e.batch?.subject || ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StudentIdCardTrigger
                      student={student}
                      batchName={e.batch?.name}
                      rollNo={roll}
                      buttonVariant="badge"
                      buttonText="🪪 ID Card"
                    />
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${e.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>{e.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {(!enrollments.data || enrollments.data.length === 0) && <p className="text-slate-500 text-sm text-center py-6">Not enrolled in any batches</p>}
        </div>
      </div>

      {/* Fee Dues & Due Balance History */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Fee Dues & Due History
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {duesList.length} Total Records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-2.5">Batch</th>
                <th className="px-3 py-2.5">Month</th>
                <th className="px-3 py-2.5">Total Fee</th>
                <th className="px-3 py-2.5">Paid Amount</th>
                <th className="px-3 py-2.5">Remaining Due</th>
                <th className="px-3 py-2.5">Due Date</th>
                <th className="px-3 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {duesList.map(d => {
                const remaining = Math.max(0, (d.due_amount || 0) - (d.paid_amount || 0))
                const isSettled = d.status === "paid" || d.status === "waived" || remaining <= 0
                return (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">{d.batch?.name || "General"}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-700">{d.due_month}</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-slate-900">{formatCurrency(d.due_amount)}</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-emerald-600">{formatCurrency(d.paid_amount || 0)}</td>
                    <td className="px-3 py-2.5 text-sm font-black text-rose-600">{formatCurrency(remaining)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{formatDate(d.due_date)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        isSettled
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : d.status === "partial"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : d.status === "waived"
                          ? "bg-slate-100 text-slate-700 border-slate-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}>
                        {isSettled ? "Settled / Paid" : d.status === "partial" ? "Partial Due" : d.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {duesList.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">No fee dues on record</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl overflow-hidden">
        <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-500" /> Payment History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-2.5">Receipt</th>
                <th className="px-3 py-2.5">Batch</th>
                <th className="px-3 py-2.5">Amount</th>
                <th className="px-3 py-2.5">Method</th>
                <th className="px-3 py-2.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payments.data || []).map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs font-mono font-bold text-amber-600">{p.receipt_number}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-900 font-medium">{p.batch?.name || p.payment_for}</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-emerald-600">{formatCurrency(p.total_paid)}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 text-right">{formatDate(p.paid_at)}</td>
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

      {/* Study Materials & Handouts Distributed */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-600" /> Study Materials Distributed & Received
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            {issuesList.length} Distributed
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold tracking-wider">
                <th className="px-3 py-2.5">Material Name</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Batch / Subject</th>
                <th className="px-3 py-2.5">Date Distributed</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-3 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issuesList.map((iss: any) => (
                <tr key={iss.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-sm font-bold text-slate-900">{iss.material?.name || "Study Material"}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {iss.material?.type || "sheet"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 font-medium">
                    {iss.batch?.name || iss.material?.subject || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(iss.issued_at)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{iss.notes || "Distributed"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> ✓ Received
                    </span>
                  </td>
                </tr>
              ))}
              {issuesList.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 text-sm">
                    No study materials have been distributed to this student yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}