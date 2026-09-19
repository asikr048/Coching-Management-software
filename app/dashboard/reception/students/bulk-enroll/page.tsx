import { createClient } from "@/lib/supabase/server"
import BulkEnrollClient from "../../../owner/students/bulk-enroll/BulkEnrollClient"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ReceptionBulkEnrollPage() {
  const supabase = await createClient()

  let batches: any[] = []
  try {
    const { data: rawList } = await supabase
      .from("batches")
      .select("*, branch:branches(id, name)")
      .order("name")
    if (rawList && rawList.length > 0) {
      batches = rawList.filter((b: any) => b.is_active !== false && b.status !== "finished")
    }
  } catch {}

  let branches: any[] = []
  try {
    const { data: fbBr } = await supabase.from("branches").select("id, name, address").order("name")
    if (fbBr) branches = fbBr
  } catch {}

  // 1. Fetch Students
  let studentsList: any[] = []
  try {
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("id, name, student_id, branch_id, phone, email, guardian_name, guardian_phone, address, class_level, school_college, roll_no, batch_roll, qr_code, is_active")
      .order("name")
    if (fallbackStudents) studentsList = fallbackStudents
  } catch {}

  // 2. Fetch Payments, Dues in parallel
  const [paymentsRes, duesRes] = await Promise.all([
    supabase.from("payments").select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, paid_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("fee_dues").select("id, student_id, batch_id, due_amount, paid_amount, due_date, status").limit(300),
  ])

  // 3. Fetch Enrollments
  let rawEnrollments: any[] = []
  try {
    const { data: fbEnr } = await supabase
      .from("enrollments")
      .select("id, created_at, status, batch_id, student_id, branch_id, roll_no")
      .order("created_at", { ascending: false })
      .limit(300)
    if (fbEnr && fbEnr.length > 0) {
      rawEnrollments = fbEnr
    } else {
      const { data: rawAll } = await supabase.from("enrollments").select("*").order("created_at", { ascending: false }).limit(300)
      if (rawAll) rawEnrollments = rawAll
    }
  } catch {}

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/reception/students"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to Students list"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Multi-Enroll Students by CSV</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Bulk Enrollment
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              সিএসভি (CSV) ফাইল থেকে একসাথে একাধিক শিক্ষার্থী ভর্তি করুন এবং আইডি কার্ড ও মানি রসিদ তৈরি করুন।
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/reception/enroll"
          className="text-xs font-medium text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        >
          Single Student Enrollment →
        </Link>
      </div>

      <BulkEnrollClient 
        initialBatches={batches} 
        branches={branches}
        initialStudents={studentsList}
        initialEnrollments={rawEnrollments}
        initialPayments={paymentsRes.data || []}
        initialDues={duesRes.data || []}
      />
    </div>
  )
}
