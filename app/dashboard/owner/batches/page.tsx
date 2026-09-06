import { createClient } from "@/lib/supabase/server"
import BatchesClient from "./BatchesClient"

export default async function BatchesPage() {
  const supabase = await createClient()
  const { data: batches } = await supabase
    .from("batches")
    .select("*, teacher:staff(name, subject), branch:branches(id, name)")
    .order("created_at", { ascending: false })
  const { data: teachers } = await supabase
    .from("staff")
    .select("id, name, subject, branch_id")
    .in("role", ["teacher", "course_teacher"])
    .eq("is_active", true)
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, capacity, branch_id")
    .eq("is_active", true)
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

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
      <BatchesClient 
        batches={batches || []} 
        teachers={teachers || []} 
        rooms={rooms || []} 
        branches={branches || []}
        batchDues={batchDues} 
      />
    </div>
  )
}

