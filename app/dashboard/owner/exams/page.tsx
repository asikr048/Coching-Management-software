import { createClient } from "@/lib/supabase/server"
import ExamsClient from "./ExamsClient"

export default async function ExamsPage() {
  const supabase = await createClient()
  const { data: exams } = await supabase
    .from("exams")
    .select("*, batch:batches(name), branch:branches(id, name)")
    .order("created_at", { ascending: false })
  const { data: batches } = await supabase
    .from("batches")
    .select("id, name, branch_id")
    .eq("is_active", true)
    .order("name", { ascending: true })
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <ExamsClient 
        exams={exams || []} 
        batches={batches || []} 
        branches={branches || []} 
      />
    </div>
  )
}
