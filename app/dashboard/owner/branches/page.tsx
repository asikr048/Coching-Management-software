import { createClient } from "@/lib/supabase/server"
import BranchesClient from "./BranchesClient"
import type { Branch } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function BranchesPage() {
  const supabase = await createClient()

  // Fetch branches
  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .order("created_at", { ascending: true })

  // Fetch student and batch counts per branch
  const { data: students } = await supabase.from("students").select("id, branch_id")
  const { data: batches } = await supabase.from("batches").select("id, branch_id")
  const { data: staff } = await supabase.from("staff").select("id, branch_id, branch_ids")

  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentStaff } = await supabase
    .from("staff")
    .select("role, id, branch_id, branch_ids, has_super_financial_access")
    .eq("auth_user_id", user?.id || "")
    .maybeSingle()

  const myRole = currentStaff?.role || "owner"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Branch Management (শাখা ব্যবস্থাপনা)
        </h2>
        <p className="text-sm text-amber-400/90 font-medium mt-1">
          Add, configure, and monitor branches, branch directors, managers, contacts, and custom SMS gateways.
        </p>
      </div>

      <BranchesClient
        initialBranches={(branches as Branch[]) || []}
        students={students || []}
        batches={batches || []}
        staff={staff || []}
        myRole={myRole}
      />
    </div>
  )
}
