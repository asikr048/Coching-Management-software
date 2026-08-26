import { createClient } from "@/lib/supabase/server"
import PaymentsClient from "../../owner/payments/PaymentsClient"

export default async function ReceptionPaymentsPage() {
  const supabase = await createClient()
  const { data: payments } = await supabase.from("payments").select("*, student:students(name, student_id), batch:batches(name)").order("paid_at", { ascending: false }).limit(100)
  const { data: students } = await supabase.from("students").select("id, name, student_id").eq("is_active", true)
  const { data: batches } = await supabase.from("batches").select("id, name, monthly_fee").eq("is_active", true)
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Collect Fee</h2><p className="text-sm text-gray-500 mt-1">Record fee payments</p></div>
      <PaymentsClient payments={payments || []} students={students || []} batches={batches || []} />
    </div>
  )
}
