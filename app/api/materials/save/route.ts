import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      name,
      type = "sheet",
      subject,
      branch_id,
      batch_id,
      batch_ids = [],
      total_stock = 0,
      available_stock,
      price = 0,
      description,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Material name is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const cleanName = name.trim()
    const cleanType = type || "sheet"
    const cleanSubject = subject?.trim() || null
    const cleanDescription = description?.trim() || null
    const parsedTotalStock = Math.max(0, parseInt(String(total_stock)) || 0)
    const parsedAvailableStock = available_stock !== undefined
      ? Math.max(0, parseInt(String(available_stock)) || 0)
      : parsedTotalStock
    const parsedPrice = Math.max(0, parseFloat(String(price)) || 0)

    // Validate UUIDs: if empty string or invalid UUID format, treat as null to prevent Postgres error 22P02
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const validBranchId = branch_id && uuidRegex.test(String(branch_id)) ? String(branch_id) : null
    
    // Normalize batch_ids array
    let normalizedBatchIds: string[] = []
    if (Array.isArray(batch_ids)) {
      normalizedBatchIds = batch_ids.map(String).filter(bid => uuidRegex.test(bid))
    } else if (typeof batch_ids === "string" && batch_ids.trim()) {
      try {
        const parsed = JSON.parse(batch_ids)
        if (Array.isArray(parsed)) {
          normalizedBatchIds = parsed.map(String).filter(bid => uuidRegex.test(bid))
        }
      } catch {
        if (uuidRegex.test(batch_ids)) normalizedBatchIds = [batch_ids]
      }
    }

    let validBatchId = batch_id && uuidRegex.test(String(batch_id)) ? String(batch_id) : null
    if (!validBatchId && normalizedBatchIds.length > 0) {
      validBatchId = normalizedBatchIds[0]
    }
    if (validBatchId && !normalizedBatchIds.includes(validBatchId)) {
      normalizedBatchIds.unshift(validBatchId)
    }

    const payload: Record<string, any> = {
      name: cleanName,
      type: cleanType,
      subject: cleanSubject,
      branch_id: validBranchId,
      batch_id: validBatchId,
      batch_ids: normalizedBatchIds,
      total_stock: parsedTotalStock,
      available_stock: parsedAvailableStock,
      price: parsedPrice,
      description: cleanDescription,
      updated_at: new Date().toISOString()
    }

    // Check if updating existing material (only if id is a valid UUID)
    const isExistingUuid = id && uuidRegex.test(String(id))
    // Execute with automatic schema fallback if database columns are missing from schema cache
    let currentPayload = { ...payload }
    let savedMaterial: any = null
    let saveError: any = null

    for (let attempt = 0; attempt < 6; attempt++) {
      let res: any
      if (isExistingUuid) {
        res = await admin
          .from("materials")
          .update(currentPayload)
          .eq("id", id)
          .select()
          .single()
      } else {
        res = await admin
          .from("materials")
          .insert({
            ...currentPayload,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
      }

      if (!res.error) {
        savedMaterial = res.data
        saveError = null
        break
      }

      const errMsg = String(res.error?.message || "")
      console.warn(`[materials/save] Attempt ${attempt + 1} failed:`, errMsg)

      // Fallback 1: batch_ids missing in schema cache
      if (errMsg.includes("batch_ids") && "batch_ids" in currentPayload) {
        delete currentPayload.batch_ids
        continue
      }
      // Fallback 2: description missing in schema cache
      if (errMsg.includes("description") && "description" in currentPayload) {
        delete currentPayload.description
        continue
      }
      // Fallback 3: branch_id missing in schema cache
      if (errMsg.includes("branch_id") && "branch_id" in currentPayload) {
        delete currentPayload.branch_id
        continue
      }
      // Fallback 4: materials_type_check constraint violation ('sheet', 'exam_paper', etc.)
      if (errMsg.includes("materials_type_check") || (errMsg.includes("violates check constraint") && errMsg.includes("type"))) {
        if (currentPayload.type === "sheet" || currentPayload.type === "exam_paper") {
          currentPayload.type = "worksheet"
          continue
        }
        if (currentPayload.type !== "other") {
          currentPayload.type = "other"
          continue
        }
      }

      saveError = res.error
      break
    }

    if (saveError || !savedMaterial) {
      console.error("Material save error:", saveError)
      return NextResponse.json({ error: saveError?.message || "Failed to save material" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      material: savedMaterial,
      message: isExistingUuid ? "Material updated successfully!" : "Material created successfully!"
    })
  } catch (err: any) {
    console.error("Unexpected error in /api/materials/save:", err)
    return NextResponse.json(
      { error: err?.message || "Internal server error saving material" },
      { status: 500 }
    )
  }
}
