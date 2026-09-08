import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  return handleGenerate(req)
}

export async function POST(req: NextRequest) {
  return handleGenerate(req)
}

async function handleGenerate(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { searchParams } = new URL(req.url)

    // Parse target month (e.g. "2026-09"); default to current YYYY-MM
    let targetMonth = searchParams.get("month")?.trim()
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      const now = new Date()
      targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    }

    // Default due deadline: 10th of that month
    const targetDueDate = `${targetMonth}-10`

    // 1. Fetch active monthly batches
    const { data: monthlyBatches, error: bErr } = await admin
      .from("batches")
      .select("id, name, monthly_fee, branch_id, is_active, status, fee_type")
      .eq("is_active", true)
      .gt("monthly_fee", 0)

    if (bErr) throw bErr

    const batches = monthlyBatches || []
    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        month: targetMonth,
        message: "No active monthly batches found",
        batchesProcessed: 0,
        duesCreated: 0,
        existingDues: 0,
        totalBilledAmount: 0,
      })
    }

    const batchIds = batches.map((b) => b.id)

    // 2. Fetch active enrollments in these batches
    const { data: enrollments, error: enrErr } = await admin
      .from("enrollments")
      .select("id, student_id, batch_id, branch_id, status, created_at, student:students(id, name, student_id, is_active)")
      .in("batch_id", batchIds)
      .eq("status", "active")

    if (enrErr) throw enrErr

    const activeEnrollments = (enrollments || []).filter((e: any) => {
      return e.student && e.student.is_active !== false
    })

    // 3. Fetch existing fee_dues for this target month to prevent duplicates
    const { data: existingDues, error: dueErr } = await admin
      .from("fee_dues")
      .select("id, student_id, batch_id, due_month")
      .in("batch_id", batchIds)
      .eq("due_month", targetMonth)

    if (dueErr) throw dueErr

    const existingDueKeySet = new Set((existingDues || []).map((d: any) => `${d.student_id}_${d.batch_id}`))

    const batchMap = new Map(batches.map((b) => [b.id, b]))
    const duesToInsert: any[] = []
    let totalBilled = 0

    for (const enr of activeEnrollments) {
      const key = `${enr.student_id}_${enr.batch_id}`
      if (existingDueKeySet.has(key)) {
        continue
      }

      // If student enrolled in a future month, don't bill prior months
      if (enr.created_at) {
        const enrMonth = new Date(enr.created_at).toISOString().slice(0, 7)
        if (enrMonth > targetMonth) {
          continue
        }
      }

      const batch = batchMap.get(enr.batch_id)
      if (!batch) continue

      const monthlyAmt = Number(batch.monthly_fee) || 0
      if (monthlyAmt <= 0) continue

      duesToInsert.push({
        student_id: enr.student_id,
        batch_id: enr.batch_id,
        due_month: targetMonth,
        due_amount: monthlyAmt,
        paid_amount: 0,
        due_date: targetDueDate,
        status: "pending",
      })

      totalBilled += monthlyAmt
      existingDueKeySet.add(key)
    }

    let createdCount = 0
    if (duesToInsert.length > 0) {
      const chunkSize = 50
      for (let i = 0; i < duesToInsert.length; i += chunkSize) {
        const chunk = duesToInsert.slice(i, i + chunkSize)
        const { error: insErr } = await admin.from("fee_dues").insert(chunk)
        if (insErr) {
          console.warn("Insert chunk note:", insErr.message)
        } else {
          createdCount += chunk.length
        }
      }
    }

    return NextResponse.json({
      success: true,
      month: targetMonth,
      message: `Monthly billing cycle for ${targetMonth} processed successfully`,
      batchesProcessed: batches.length,
      totalStudentsEnrolled: activeEnrollments.length,
      duesCreated: createdCount,
      existingDues: (existingDues || []).length,
      totalBilledAmount: totalBilled,
    })
  } catch (err: any) {
    console.error("Monthly billing generation error:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
