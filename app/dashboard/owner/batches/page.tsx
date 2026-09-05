import { createClient } from "@/lib/supabase/server"
import BatchesClient from "./BatchesClient"

export default async function BatchesPage() {
  const supabase = await createClient()
  const { data: batches } = await supabase.from("batches").select("*, teacher:staff(name, subject)").order("created_at", { ascending: false })
  const { data: teachers } = await supabase.from("staff").select("id, name, subject").in("role", ["teacher", "course_teacher"]).eq("is_active", true)
  const { data: rooms } = await supabase.from("rooms").select("id, name, capacity").eq("is_active", true)

  const { data: rawDues } = await supabase
    .from("fee_dues")
    .select("batch_id, due_amount, paid_amount")
    .in("status", ["pending", "partial"])

  const batchDues = (rawDues || []).reduce((acc: Record<string, number>, due) => {
    acc[due.batch_id] = (acc[due.batch_id] || 0) + (Number(due.due_amount) - Number(due.paid_amount))
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">Batches & Classes</h2><p className="text-sm text-gray-500 mt-1">{batches?.length || 0} total batches</p></div>
      </div>
      <BatchesClient batches={batches || []} teachers={teachers || []} rooms={rooms || []} batchDues={batchDues} />
    </div>
  )
}

