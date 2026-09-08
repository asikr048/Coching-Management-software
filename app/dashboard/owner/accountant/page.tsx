import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import AccountantClient from "./AccountantClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AccountantDeskPage() {
  const admin = createAdminClient()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: staff } = user
    ? await supabase.from("staff").select("id, name, email, role").eq("auth_user_id", user.id).maybeSingle()
    : { data: null }

  const [studentsRes, batchesRes, duesRes, paymentsRes, branchesRes] = await Promise.all([
    admin
      .from("students")
      .select("*, enrollments(id, batch_id, status, created_at, batch:batches(id, name, monthly_fee, admission_fee, branch_id, class_level))")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    admin
      .from("batches")
      .select("id, name, monthly_fee, admission_fee, branch_id, class_level, current_seats, max_seats, is_active, status, branch:branches(id, name)")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    admin
      .from("fee_dues")
      .select("id, student_id, batch_id, due_month, due_amount, paid_amount, due_date, status, branch_id, batch:batches(id, name, monthly_fee)")
      .order("due_date", { ascending: false }),

    admin
      .from("payments")
      .select("id, student_id, batch_id, amount, total_paid, payment_method, payment_for, payment_month, receipt_number, created_at, notes, student:students(name, student_id), batch:batches(name)")
      .order("created_at", { ascending: false })
      .limit(100),

    admin
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ])

  const currentStaff = staff || {
    id: user?.id || "accountant",
    name: user?.user_metadata?.name || "Accountant",
    email: user?.email || "accountant@medhashiree.com",
    role: "accountant" as const,
  }

  return (
    <AccountantClient
      initialStudents={studentsRes.data || []}
      initialBatches={batchesRes.data || []}
      initialDues={duesRes.data || []}
      initialPayments={paymentsRes.data || []}
      branches={branchesRes.data || []}
      currentStaff={currentStaff}
    />
  )
}
