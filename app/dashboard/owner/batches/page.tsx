import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import BatchesClient from "./BatchesClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function BatchesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  let rawBatches: any[] = []
  let rawTeachers: any[] = []
  let rawRooms: any[] = []
  let rawBranches: any[] = []
  let rawDues: any[] = []
  let rawEnrs: any[] = []

  try {
    const [batchesRes, teachersRes, roomsRes, branchesRes, duesRes, enrsRes] = await Promise.all([
      admin
        .from("batches")
        .select("*, teacher:staff(name, subject), branch:branches(id, name)")
        .order("created_at", { ascending: false }),
      admin
        .from("staff")
        .select("id, name, subject, branch_id")
        .in("role", ["teacher", "course_teacher"])
        .eq("is_active", true),
      admin
        .from("rooms")
        .select("id, name, capacity, branch_id")
        .eq("is_active", true),
      admin
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      admin
        .from("fee_dues")
        .select("batch_id, due_amount, paid_amount")
        .in("status", ["pending", "partial"]),
      admin
        .from("enrollments")
        .select("id, batch_id, status")
        .eq("status", "active"),
    ])

    if (batchesRes.error || !batchesRes.data) {
      console.warn("Batches relational join query error/empty, falling back to simple select:", batchesRes.error?.message)
      const simpleRes = await admin
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false })

      if (simpleRes.data && simpleRes.data.length > 0) {
        rawBatches = simpleRes.data
      } else {
        // Secondary fallback to user session client
        const { data: userBatches } = await supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false })
        rawBatches = userBatches || []
      }
    } else {
      rawBatches = batchesRes.data
    }

    rawTeachers = teachersRes.data || []
    rawRooms = roomsRes.data || []
    rawBranches = branchesRes.data || []
    rawDues = duesRes.data || []
    rawEnrs = enrsRes.data || []
  } catch (err) {
    console.error("Failed to load batches page data via admin:", err)
    try {
      const { data: fbBatches } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false })
      rawBatches = fbBatches || []
    } catch {}
  }

  // Count live active enrollments per batch
  const liveCounts = new Map<string, number>()
  rawEnrs.forEach((e: any) => {
    if (e.batch_id) {
      liveCounts.set(e.batch_id, (liveCounts.get(e.batch_id) || 0) + 1)
    }
  })

  // Normalize and enrich batches with live seat counts and fallback teacher/branch joins
  const normalizedBatches = rawBatches.map((b: any) => {
    const liveCount = liveCounts.get(b.id)
    const effectiveCount = liveCount !== undefined ? liveCount : (b.current_seats || 0)
    const teacher = b.teacher || rawTeachers.find((t: any) => t.id === b.teacher_id)
    const branch = b.branch || rawBranches.find((br: any) => br.id === b.branch_id)

    return {
      ...b,
      current_seats: effectiveCount,
      teacher: teacher ? { name: teacher.name, subject: teacher.subject } : null,
      branch: branch ? { id: branch.id, name: branch.name } : null
    }
  })

  const batchDues = rawDues.reduce((acc: Record<string, number>, due: any) => {
    if (due.batch_id) {
      acc[due.batch_id] = (acc[due.batch_id] || 0) + (Number(due.due_amount || 0) - Number(due.paid_amount || 0))
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <BatchesClient 
        batches={normalizedBatches} 
        teachers={rawTeachers} 
        rooms={rawRooms} 
        branches={rawBranches} 
        batchDues={batchDues} 
      />
    </div>
  )
}
