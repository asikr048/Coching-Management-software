import { createClient } from "@/lib/supabase/server"
import FeeDuesClient from "./FeeDuesClient"

export default async function FeeDuesPage() {
  const supabase = await createClient()

  const [duesRes, batchesRes] = await Promise.all([
    supabase.from("fee_dues")
      .select("*, student:students(id, name, student_id, guardian_phone, phone), batch:batches(id, name)")
      .in("status", ["pending", "partial"])
      .order("due_date", { ascending: true }),
    supabase.from("batches").select("id, name").eq("is_active", true).order("name"),
  ])

  return <FeeDuesClient dues={duesRes.data || []} batches={batchesRes.data || []} />
}
