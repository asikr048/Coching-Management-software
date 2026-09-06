import { createAdminClient } from "@/lib/supabase/admin"
import FeeDuesClient from "./FeeDuesClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function FeeDuesPage() {
  const admin = createAdminClient()

  // 1. Fetch fee dues, batches, and payment submissions
  const [duesRes, batchesRes, pendingSubsRes] = await Promise.all([
    admin.from("fee_dues")
      .select("*, student:students(id, name, student_id, guardian_phone, phone), batch:batches(id, name)")
      .in("status", ["pending", "partial", "paid", "waived"])
      .order("due_date", { ascending: false }),
    admin.from("batches").select("id, name, monthly_fee, admission_fee").eq("is_active", true).order("name"),
    admin.from("payment_submissions")
      .select("*, student:students(id, name, student_id, guardian_phone, phone), batch:batches(id, name, monthly_fee, admission_fee)")
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false }),
  ])

  let duesList = duesRes.data || []
  const batchesList = batchesRes.data || []
  const pendingSubs = pendingSubsRes.data || []

  // 2. Auto-heal: Ensure any student with remaining dues from payment submissions has a fee_dues record
  try {
    const dueKeys = new Set(duesList.map(d => `${d.student_id}_${d.batch_id}`))
    const targetDueDate = (() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      d.setDate(10)
      return d.toISOString().split("T")[0]
    })()
    const nowMonth = new Date().toISOString().slice(0, 7)

    for (const sub of pendingSubs) {
      if (!sub.student_id || !sub.batch_id) continue

      const amt = Number(sub.amount) || 0
      let due = Number(sub.due_amount) || 0
      if (due <= 0 && sub.notes) {
        const match = sub.notes.match(/Due:\s*৳?\s*([0-9]+(?:\.[0-9]+)?)/i)
        if (match && Number(match[1]) > 0) due = Number(match[1])
      }
      let total = Number(sub.total_fee) || 0
      if (total <= 0 && sub.batch?.monthly_fee) {
        total = (Number(sub.batch.monthly_fee) || 0) + (Number(sub.batch.admission_fee) || 0)
      }
      if (due <= 0 && total > amt) {
        due = total - amt
      }

      if (due > 0) {
        const key = `${sub.student_id}_${sub.batch_id}`
        if (!dueKeys.has(key)) {
          // Attempt to insert fee_due record
          const { data: newDue } = await admin.from("fee_dues").insert({
            student_id: sub.student_id,
            batch_id: sub.batch_id,
            due_month: sub.created_at ? new Date(sub.created_at).toISOString().slice(0, 7) : nowMonth,
            due_amount: total || (amt + due),
            paid_amount: sub.status === "approved" ? amt : 0,
            due_date: sub.due_date || targetDueDate,
            status: sub.status === "approved" ? "partial" : "pending",
          }).select("*, student:students(id, name, student_id, guardian_phone, phone), batch:batches(id, name)").maybeSingle()

          if (newDue) {
            duesList.push(newDue)
            dueKeys.add(key)
          } else {
            // Synthesize into view if insert blocked or duplicate constraint
            duesList.push({
              id: sub.id,
              student_id: sub.student_id,
              batch_id: sub.batch_id,
              due_month: nowMonth,
              due_amount: total || (amt + due),
              paid_amount: sub.status === "approved" ? amt : 0,
              due_date: sub.due_date || targetDueDate,
              status: sub.status === "approved" ? "partial" : "pending",
              student: sub.student,
              batch: sub.batch,
            })
            dueKeys.add(key)
          }
        }
      }
    }
  } catch (healErr) {
    console.warn("Fee dues auto-heal error:", healErr)
  }

  return <FeeDuesClient dues={duesList} batches={batchesList} />
}
