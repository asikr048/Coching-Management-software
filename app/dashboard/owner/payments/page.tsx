import { createClient } from "@/lib/supabase/server"
import PaymentsClient from "./PaymentsClient"

export default async function PaymentsPage() {
  const supabase = await createClient()
  const [paymentsRes, studentsRes, batchesRes, duesRes] = await Promise.all([
    supabase.from("payments").select("*, student:students(name, student_id), batch:batches(name)").order("paid_at", { ascending: false }).limit(100),
    supabase.from("students").select("id, name, student_id, phone").eq("is_active", true),
    supabase.from("batches").select("id, name, monthly_fee").eq("is_active", true),
    supabase.from("fee_dues").select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, batch:batches(name)").in("status", ["pending", "partial"]),
  ])

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Payments</h2><p className="text-sm text-gray-500 mt-1">Record and manage fee payments</p></div>
      <PaymentsClient payments={paymentsRes.data || []} students={studentsRes.data || []} batches={batchesRes.data || []} dues={duesRes.data || []} />
    </div>
  )
}
