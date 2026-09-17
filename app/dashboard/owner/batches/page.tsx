import { createClient } from "@/lib/supabase/server"
import BatchesClient from "./BatchesClient"

export default async function BatchesPage() {
  const supabase = await createClient()
  const [batchesRes, teachersRes, roomsRes, branchesRes, duesRes, enrsRes] = await Promise.all([
    supabase
      .from("batches")
      .select("*, teacher:staff(name, subject), branch:branches(id, name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("staff")
      .select("id, name, subject, branch_id")
      .in("role", ["teacher", "course_teacher"])
      .eq("is_active", true),
    supabase
      .from("rooms")
      .select("id, name, capacity, branch_id")
      .eq("is_active", true),
    supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("fee_dues")
      .select("batch_id, due_amount, paid_amount")
      .in("status", ["pending", "partial"]),
    supabase
      .from("enrollments")
      .select("id, batch_id, status")
      .eq("status", "active"),
  ])

  // Count live active enrollments per batch
  const liveCounts = new Map<string, number>()
  ;(enrsRes.data || []).forEach((e: any) => {
    if (e.batch_id) {
      liveCounts.set(e.batch_id, (liveCounts.get(e.batch_id) || 0) + 1)
    }
  })

  // Normalize batch current_seats based on real live active enrollments
  const normalizedBatches = (batchesRes.data || []).map((b: any) => {
    const liveCount = liveCounts.get(b.id)
    const effectiveCount = liveCount !== undefined ? liveCount : (b.current_seats || 0)
    return {
      ...b,
      current_seats: effectiveCount
    }
  })

  const batchDues = (duesRes.data || []).reduce((acc: Record<string, number>, due: any) => {
    acc[due.batch_id] = (acc[due.batch_id] || 0) + (Number(due.due_amount) - Number(due.paid_amount))
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <BatchesClient 
        batches={normalizedBatches} 
        teachers={teachersRes.data || []} 
        rooms={roomsRes.data || []} 
        branches={branchesRes.data || []} 
        batchDues={batchDues} 
      />
    </div>
  )
}

