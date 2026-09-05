import { createClient } from "@/lib/supabase/server"
import ExamsClient from "./ExamsClient"

export default async function ExamsPage() {
  const supabase = await createClient()
  const { data: exams } = await supabase.from("exams").select("*, batch:batches(name)").order("created_at", { ascending: false })
  const { data: batches } = await supabase.from("batches").select("id, name").eq("is_active", true)
  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Exams & Results</h2><p className="text-sm text-gray-500 mt-1">Create exams, enter marks, and view leaderboards</p></div>
      <ExamsClient exams={exams || []} batches={batches || []} />
    </div>
  )
}
