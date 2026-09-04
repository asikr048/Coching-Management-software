import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { Shield, ArrowRight } from "lucide-react"
import PaymentsClient from "./PaymentsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function PaymentsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [paymentsRes, studentsRes, batchesRes, duesRes, pendingRes] = await Promise.all([
    supabase.from("payments").select("*, student:students(name, student_id, phone, email, guardian_phone), batch:batches(name)").order("paid_at", { ascending: false }).limit(100),
    supabase.from("students").select("id, name, student_id, phone, email, guardian_phone").eq("is_active", true),
    supabase.from("batches").select("id, name, monthly_fee").eq("is_active", true),
    supabase.from("fee_dues").select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(name)").in("status", ["pending", "partial"]),
    admin.from("payment_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ])

  const pendingCount = pendingRes.count || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payments</h2>
          <p className="text-sm text-gray-500 mt-1">Record and manage offline fee collections and payment logs</p>
        </div>

        {pendingCount > 0 && (
          <Link
            href="/dashboard/owner/payment-approvals"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span>{pendingCount} Pending Online Approval{pendingCount > 1 ? "s" : ""}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {pendingCount} student payment{pendingCount > 1 ? "s are" : " is"} waiting for approval
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Students submitted via bKash, Nagad, Rocket, or Upay. Once approved, their enrollment will be activated.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/owner/payment-approvals"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold whitespace-nowrap transition-colors"
          >
            Review Now
          </Link>
        </div>
      )}

      <PaymentsClient payments={paymentsRes.data || []} students={studentsRes.data || []} batches={batchesRes.data || []} dues={duesRes.data || []} />
    </div>
  )
}
