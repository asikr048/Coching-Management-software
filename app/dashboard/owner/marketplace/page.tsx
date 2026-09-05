import { createClient } from "@/lib/supabase/server"
import MarketplaceClient from "./MarketplaceClient"

export default async function MarketplacePage() {
  const supabase = await createClient()
  const [coursesRes, studentsRes] = await Promise.all([
    supabase.from("courses").select("*, teacher:staff(name)").order("created_at", { ascending: false }),
    supabase.from("students").select("id, name, student_id, phone, email").eq("is_active", true),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight">Course Marketplace</h2>
        <p className="text-sm text-slate-400 mt-1">Manage courses and sell to students</p>
      </div>
      <MarketplaceClient courses={coursesRes.data || []} students={studentsRes.data || []} />
    </div>
  )
}
