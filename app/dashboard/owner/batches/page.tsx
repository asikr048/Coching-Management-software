import { createClient } from "@/lib/supabase/server"
import BatchesClient from "./BatchesClient"

export default async function BatchesPage() {
  const supabase = await createClient()
  const { data: batches } = await supabase.from("batches").select("*, teacher:staff(name, subject)").order("created_at", { ascending: false })
  const { data: teachers } = await supabase.from("staff").select("id, name, subject").in("role", ["teacher", "course_teacher"]).eq("is_active", true)
  const { data: rooms } = await supabase.from("rooms").select("id, name, capacity").eq("is_active", true)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-gray-900">Batches & Classes</h2><p className="text-sm text-gray-500 mt-1">{batches?.length || 0} total batches</p></div>
      </div>
      <BatchesClient batches={batches || []} teachers={teachers || []} rooms={rooms || []} />
    </div>
  )
}
