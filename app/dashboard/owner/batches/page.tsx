import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import BatchesClient from "./BatchesClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function BatchesPage() {
  const supabase = await createClient()
  const hasServiceKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder")
  )
  const db = hasServiceKey ? createAdminClient() : supabase

  let rawBatches: any[] = []
  let rawTeachers: any[] = []
  let rawRooms: any[] = []
  let rawBranches: any[] = []
  let rawDues: any[] = []
  let rawEnrs: any[] = []
  let rawStudents: any[] = []

  try {
    const [batchesRes, teachersRes, roomsRes, branchesRes, duesRes, enrsRes, studentsRes] = await Promise.all([
      db
        .from("batches")
        .select("*, teacher:staff(name, subject), branch:branches(id, name)")
        .order("created_at", { ascending: false }),
      db
        .from("staff")
        .select("id, name, subject, branch_id")
        .in("role", ["teacher", "course_teacher"])
        .eq("is_active", true),
      db
        .from("rooms")
        .select("id, name, capacity, branch_id")
        .eq("is_active", true),
      db
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      db
        .from("fee_dues")
        .select("id, student_id, batch_id, due_amount, paid_amount, status"),
      db
        .from("enrollments")
        .select("id, student_id, batch_id, status, roll_no")
        .eq("status", "active"),
      db
        .from("students")
        .select("id, student_id, name, roll_no, batch_roll, class_level, branch_id, is_active, enrollment_date, created_at")
        .order("created_at", { ascending: true }),
    ])

    if (batchesRes.error || !batchesRes.data) {
      console.warn("Batches relational join query error/empty, falling back to simple select:", batchesRes.error?.message)
      const simpleRes = await db
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false })

      if (simpleRes.data && simpleRes.data.length > 0) {
        rawBatches = simpleRes.data
      } else {
        // Fallback to supabase server client
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
    rawStudents = studentsRes.data || []
  } catch (err) {
    console.error("Failed to load batches page data:", err)
    try {
      const { data: fbBatches } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false })
      rawBatches = fbBatches || []
    } catch {}
  }

  // AUTO-HEAL: Detect students who belong to a batch but lack an active enrollment row
  const enrollmentsByBatch = new Map<string, any[]>()
  const studentEnrolledBatchMap = new Set<string>() // key: `${student_id}_${batch_id}`
  const allActiveEnrolledStudentIds = new Set<string>()

  rawEnrs.forEach((e: any) => {
    if (e.batch_id && e.student_id) {
      const list = enrollmentsByBatch.get(e.batch_id) || []
      list.push(e)
      enrollmentsByBatch.set(e.batch_id, list)
      studentEnrolledBatchMap.add(`${e.student_id}_${e.batch_id}`)
      allActiveEnrolledStudentIds.add(String(e.student_id))
    }
  })

  const studentMap = new Map<string, any>()
  rawStudents.forEach((s: any) => {
    if (s.id) studentMap.set(String(s.id), s)
  })

  const newEnrollmentsToInsert: any[] = []

  // Check 1: Fee dues with batch_id indicating student enrolled in that batch
  rawDues.forEach((d: any) => {
    if (d.batch_id && d.student_id && !studentEnrolledBatchMap.has(`${d.student_id}_${d.batch_id}`)) {
      const student = studentMap.get(String(d.student_id))
      const batch = rawBatches.find((b: any) => b.id === d.batch_id)
      if (batch) {
        studentEnrolledBatchMap.add(`${d.student_id}_${d.batch_id}`)
        allActiveEnrolledStudentIds.add(String(d.student_id))
        const batchList = enrollmentsByBatch.get(d.batch_id) || []
        const assignedRoll = student?.roll_no || student?.batch_roll || (batchList.length + 1)
        const newEnr = {
          student_id: d.student_id,
          batch_id: d.batch_id,
          branch_id: batch.branch_id || student?.branch_id || null,
          status: "active",
          roll_no: assignedRoll,
          final_monthly_fee: Number(batch.monthly_fee) || 0,
          enrollment_date: student?.enrollment_date || new Date().toISOString().split("T")[0]
        }
        newEnrollmentsToInsert.push(newEnr)
        batchList.push(newEnr)
        enrollmentsByBatch.set(d.batch_id, batchList)
        rawEnrs.push(newEnr)
      }
    }
  })

  // Check 2: Active students with NO enrollment anywhere in the system
  const unEnrolledStudents = rawStudents.filter(
    (s: any) => s.is_active !== false && !allActiveEnrolledStudentIds.has(String(s.id))
  )
  if (unEnrolledStudents.length > 0 && rawBatches.length > 0) {
    unEnrolledStudents.forEach((s: any) => {
      // Find target batch: matching class_level, or single active batch, or matching branch
      let targetBatch = rawBatches.find(
        (b: any) => b.class_level && s.class_level && b.class_level.toLowerCase() === s.class_level.toLowerCase()
      )
      if (!targetBatch && rawBatches.length === 1) {
        targetBatch = rawBatches[0]
      }
      if (!targetBatch) {
        targetBatch = rawBatches.find((b: any) => b.branch_id && s.branch_id && b.branch_id === s.branch_id) || rawBatches[0]
      }

      if (targetBatch && !studentEnrolledBatchMap.has(`${s.id}_${targetBatch.id}`)) {
        studentEnrolledBatchMap.add(`${s.id}_${targetBatch.id}`)
        allActiveEnrolledStudentIds.add(String(s.id))
        const batchList = enrollmentsByBatch.get(targetBatch.id) || []
        const assignedRoll = s.roll_no || s.batch_roll || (batchList.length + 1)
        const newEnr = {
          student_id: s.id,
          batch_id: targetBatch.id,
          branch_id: targetBatch.branch_id || s.branch_id || null,
          status: "active",
          roll_no: assignedRoll,
          final_monthly_fee: Number(targetBatch.monthly_fee) || 0,
          enrollment_date: s.enrollment_date || new Date().toISOString().split("T")[0]
        }
        newEnrollmentsToInsert.push(newEnr)
        batchList.push(newEnr)
        enrollmentsByBatch.set(targetBatch.id, batchList)
        rawEnrs.push(newEnr)
      }
    })
  }

  // Insert any missing enrollments into database
  if (newEnrollmentsToInsert.length > 0) {
    try {
      await db.from("enrollments").insert(newEnrollmentsToInsert)
    } catch (insertErr) {
      console.warn("Auto-heal enrollments insert notice:", insertErr)
    }
  }

  // Count live active enrollments per batch
  const liveCounts = new Map<string, number>()
  rawEnrs.forEach((e: any) => {
    if (e.batch_id) {
      liveCounts.set(e.batch_id, (liveCounts.get(e.batch_id) || 0) + 1)
    }
  })

  // Normalize batches, ensuring seat count reflects true enrollments
  const batchesToUpdateSeats: { id: string; current_seats: number }[] = []

  const normalizedBatches = rawBatches.map((b: any) => {
    const liveCount = liveCounts.get(b.id) || 0
    const effectiveCount = Math.max(Number(b.current_seats) || 0, liveCount)
    const teacher = b.teacher || rawTeachers.find((t: any) => t.id === b.teacher_id)
    const branch = b.branch || rawBranches.find((br: any) => br.id === b.branch_id)

    if (b.current_seats !== effectiveCount) {
      batchesToUpdateSeats.push({ id: b.id, current_seats: effectiveCount })
    }

    return {
      ...b,
      current_seats: effectiveCount,
      teacher: teacher ? { name: teacher.name, subject: teacher.subject } : null,
      branch: branch ? { id: branch.id, name: branch.name } : null
    }
  })

  // Persist corrected seat counts to the batches table in database
  if (batchesToUpdateSeats.length > 0) {
    try {
      for (const item of batchesToUpdateSeats) {
        await db.from("batches").update({ current_seats: item.current_seats }).eq("id", item.id)
      }
    } catch (err) {
      console.warn("Failed to sync batch seat count to db:", err)
    }
  }

  const batchDues = rawDues
    .filter((due: any) => due.status === "pending" || due.status === "partial")
    .reduce((acc: Record<string, number>, due: any) => {
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
