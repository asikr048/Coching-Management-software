import { createClient } from "@/lib/supabase/server"
import ApprovalsClient from "./ApprovalsClient"

export default async function PaymentApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: currentStaff } = await supabase.from("staff").select("id, role").eq("auth_user_id", user?.id || "").maybeSingle()

  // Check if user is an approver (owner/super_manager always can, or designated approvers)
  const isOwnerOrSM = ["owner", "super_manager"].includes(currentStaff?.role || "")
  let canApprove = isOwnerOrSM
  if (!canApprove && currentStaff) {
    const { data: approverCheck } = await supabase.from("payment_approvers").select("id").eq("staff_id", currentStaff.id).maybeSingle()
    canApprove = !!approverCheck
  }

  const { data: submissions } = await supabase
    .from("payment_submissions")
    .select("*, student:students(name, student_id, phone, email), batch:batches(name, subject), course:courses(title, category)")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment Approvals</h2>
        <p className="text-sm text-gray-500 mt-1">Review and approve student payment submissions</p>
      </div>
      <ApprovalsClient submissions={submissions || []} canApprove={canApprove} staffId={currentStaff?.id || ""} />
    </div>
  )
}
