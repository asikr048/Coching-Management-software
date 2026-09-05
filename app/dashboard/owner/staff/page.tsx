import { createClient } from "@/lib/supabase/server"
import StaffClient from "./StaffClient"
import type { Branch } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: staff } = await supabase.from("staff").select("*").order("created_at", { ascending: false })
  const { data: branches } = await supabase.from("branches").select("*").order("name", { ascending: true })
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentStaff } = await supabase
    .from("staff")
    .select("role, id, branch_id, branch_ids, has_super_financial_access")
    .eq("auth_user_id", user?.id || "")
    .maybeSingle()

  const myRole = currentStaff?.role || "manager"
  const hasSuperFinancial = myRole === "owner" || !!currentStaff?.has_super_financial_access
  const myBranchIds = currentStaff?.branch_ids || (currentStaff?.branch_id ? [currentStaff.branch_id] : [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Staff Management (কর্মী ও শিক্ষক ব্যবস্থাপনা)
        </h2>
        <p className="text-sm text-amber-400/90 font-medium mt-1">
          Manage teachers, receptionists, accountants, managers, multi-branch access, and financial permissions.
        </p>
      </div>
      <StaffClient
        staff={staff || []}
        branches={(branches as Branch[]) || []}
        myRole={myRole}
        myStaffId={currentStaff?.id || ""}
        hasSuperFinancial={hasSuperFinancial}
        myBranchIds={myBranchIds}
      />
    </div>
  )
}

