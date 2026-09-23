import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import ExamsClient from "./ExamsClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ExamsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  let exams: any[] = []
  const { data: adminExams } = await admin
    .from("exams")
    .select("*, batch:batches(name), branch:branches(id, name)")
    .order("created_at", { ascending: false })

  if (adminExams && adminExams.length > 0) {
    exams = adminExams
  } else {
    const { data: sbExams } = await supabase
      .from("exams")
      .select("*, batch:batches(name), branch:branches(id, name)")
      .order("created_at", { ascending: false })
    if (sbExams) exams = sbExams
  }

  const { data: batches } = await admin
    .from("batches")
    .select("id, name, branch_id")
    .eq("is_active", true)
    .order("name", { ascending: true })

  const { data: branches } = await admin
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })

  const { data: notices } = await admin
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <ExamsClient 
        exams={exams || []} 
        batches={batches || []} 
        branches={branches || []} 
        initialNotices={notices || []}
      />
    </div>
  )
}
