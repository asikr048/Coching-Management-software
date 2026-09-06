import { createClient } from "@/lib/supabase/server"
import StaffClient from "./StaffClient"
import type { Branch } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: staff } = await supabase.from("staff").select("*").order("created_at", { ascending: false })
  const { data: branches } = await supabase.from("branches").select("*").order("name", { ascending: true })
  const { data: { user } } = await supabase.auth.getUser()
  let currentStaff: any = null
  if (user?.id) {
    const { data: staffByAuth } = await supabase
      .from("staff")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle()
    if (staffByAuth) currentStaff = staffByAuth
  }

  if (!currentStaff && user?.email) {
    const { data: staffByEmail } = await supabase
      .from("staff")
      .select("*")
      .eq("email", user.email)
      .maybeSingle()
    if (staffByEmail) {
      currentStaff = staffByEmail
    }
  }

  // Load persistent multi-branch assignments and custom roles from site_settings as resilient backup
  let branchAssignmentsMap: Record<string, string[]> = {}
  let customRolesMap: Record<string, string> = {}
  try {
    const { data: settingRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["staff_branch_assignments", "staff_custom_roles"])
    
    if (settingRows) {
      settingRows.forEach(row => {
        if (row.key === "staff_branch_assignments" && row.value) {
          try { branchAssignmentsMap = JSON.parse(row.value) } catch {}
        }
        if (row.key === "staff_custom_roles" && row.value) {
          try { customRolesMap = JSON.parse(row.value) } catch {}
        }
      })
    }
  } catch (e) {}

  // Enrich staff with multi-branch assignments and custom roles
  const enrichedStaff = (staff || []).map((s: any) => {
    const customBranches = branchAssignmentsMap[s.id]
    const customRole = customRolesMap[s.id]
    const existingBranchIds = Array.isArray(s.branch_ids) && s.branch_ids.length > 0 
      ? s.branch_ids 
      : (s.branch_id ? [s.branch_id] : [])
    return {
      ...s,
      role: customRole || s.role,
      branch_ids: customBranches !== undefined ? customBranches : existingBranchIds
    }
  })

  const effectiveCallerRole = (currentStaff?.id && customRolesMap[currentStaff.id]) || currentStaff?.role || "owner"
  const hasSuperFinancial = effectiveCallerRole === "owner" || effectiveCallerRole === "branch_director" || !!currentStaff?.has_super_financial_access
  const myBranchIds = (currentStaff?.id && branchAssignmentsMap[currentStaff.id]) ||
    currentStaff?.branch_ids ||
    (currentStaff?.branch_id ? [currentStaff.branch_id] : [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Staff Management (কর্মী ও শিক্ষক ব্যবস্থাপনা)
        </h2>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Manage teachers, receptionists, accountants, managers, branch directors, multi-branch access, and permissions.
        </p>
      </div>
      <StaffClient
        staff={enrichedStaff}
        branches={(branches as Branch[]) || []}
        myRole={effectiveCallerRole}
        myStaffId={currentStaff?.id || ""}
        hasSuperFinancial={hasSuperFinancial}
        myBranchIds={myBranchIds}
      />
    </div>
  )
}

