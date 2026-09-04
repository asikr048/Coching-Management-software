import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface GatewayConfig {
  apiKey: string
  callType: "GET" | "POST_FORM" | "POST_JSON"
  urlTemplate: string
  senderId?: string
}

function normalizeBdPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "")
  if (cleaned.startsWith("880")) {
    return cleaned
  }
  if (cleaned.startsWith("01")) {
    return "88" + cleaned
  }
  if (cleaned.startsWith("1") && cleaned.length === 10) {
    return "880" + cleaned
  }
  return cleaned
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      recipients, // Array of { phone: string; message?: string; name?: string; studentId?: string } or string[]
      message, // Global message fallback
      configOverride, // Optional testing config
    } = body

    if (!recipients || (!Array.isArray(recipients) && typeof recipients !== "string")) {
      return NextResponse.json({ error: "Recipients must be provided" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch Gateway Config from site_settings or configOverride
    let config: GatewayConfig = {
      apiKey: "",
      callType: "GET",
      urlTemplate: "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}",
      senderId: "",
    }

    if (configOverride && (configOverride.apiKey || configOverride.urlTemplate)) {
      config = { ...config, ...configOverride }
    } else {
      try {
        const { data: settingRow } = await admin
          .from("site_settings")
          .select("value")
          .eq("key", "sms_gateway_config")
          .maybeSingle()

        if (settingRow?.value) {
          try {
            const parsed = JSON.parse(settingRow.value)
            config = { ...config, ...parsed }
          } catch (e) {
            console.error("Failed to parse sms_gateway_config JSON:", e)
          }
        }
      } catch (e) {
        console.warn("Could not load gateway config from site_settings:", e)
      }
    }

    if (!config.apiKey) {
      return NextResponse.json(
        { error: "SMS Gateway API Key is not configured. Please set it in Gateway Settings." },
        { status: 400 }
      )
    }

    // 2. Normalize recipient items
    interface SmsTask {
      phone: string
      message: string
      name?: string
      studentId?: string
    }

    let items: SmsTask[] = []
    if (typeof recipients === "string") {
      items = [{ phone: recipients, message: message || "" }]
    } else if (Array.isArray(recipients)) {
      items = recipients.map((r) => {
        if (typeof r === "string") {
          return { phone: r, message: message || "" }
        }
        return {
          phone: r.phone,
          message: r.message || message || "",
          name: r.name,
          studentId: r.studentId,
        }
      })
    }

    // Filter out invalid items
    items = items.filter((it) => it.phone && it.phone.trim().length >= 8 && it.message.trim().length > 0)

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid recipient phone numbers or messages provided" }, { status: 400 })
    }

    const results: Array<{ phone: string; success: boolean; response?: any; error?: string }> = []
    const queueRows: any[] = []

    // 3. Dispatch messages
    for (const task of items) {
      const normalizedPhone = normalizeBdPhone(task.phone)
      const rawPhoneWithout88 = normalizedPhone.startsWith("88") ? normalizedPhone.substring(2) : normalizedPhone

      // Choose phone format matching template expectation (if template has 88 or standard)
      const phoneToUse = config.urlTemplate.includes("880") ? normalizedPhone : normalizedPhone

      let success = false
      let responseData: any = null
      let errorMessage: string | null = null

      try {
        if (config.callType === "GET") {
          let targetUrl = config.urlTemplate
          targetUrl = targetUrl.replace(/\{api_key\}|\{API_KEY\}|\{YOUR_API_KEY\}/g, encodeURIComponent(config.apiKey))
          targetUrl = targetUrl.replace(/\{msg\}|\{MSG\}|\{YOUR_MSG\}|\{message\}/g, encodeURIComponent(task.message))
          targetUrl = targetUrl.replace(/\{to\}|\{TO\}|\{YOUR_TO\}|\{number\}|\{phone\}|\{msisdn\}/g, encodeURIComponent(phoneToUse))

          const res = await fetch(targetUrl, { method: "GET" })
          const text = await res.text()
          try {
            responseData = JSON.parse(text)
          } catch {
            responseData = text
          }

          if (res.ok) {
            // Check for common BD SMS gateway error indicators
            if (typeof text === "string" && (text.includes("error") || text.includes("INVALID") || text.includes("FAILED"))) {
              success = false
              errorMessage = text
            } else {
              success = true
            }
          } else {
            success = false
            errorMessage = `HTTP ${res.status}: ${text}`
          }
        } else if (config.callType === "POST_FORM") {
          // POST with form urlencoded body
          const baseUrl = config.urlTemplate.split("?")[0]
          const formData = new URLSearchParams()
          formData.append("api_key", config.apiKey)
          formData.append("msg", task.message)
          formData.append("to", phoneToUse)
          if (config.senderId) formData.append("sender_id", config.senderId)

          const res = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
          })
          const text = await res.text()
          try {
            responseData = JSON.parse(text)
          } catch {
            responseData = text
          }
          success = res.ok
          if (!res.ok) errorMessage = text
        } else if (config.callType === "POST_JSON") {
          // POST with JSON body
          const baseUrl = config.urlTemplate.split("?")[0]
          const res = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: config.apiKey,
              msg: task.message,
              to: phoneToUse,
              sender_id: config.senderId,
            }),
          })
          const text = await res.text()
          try {
            responseData = JSON.parse(text)
          } catch {
            responseData = text
          }
          success = res.ok
          if (!res.ok) errorMessage = text
        }
      } catch (sendErr: any) {
        success = false
        errorMessage = sendErr?.message || "Network error when reaching SMS gateway"
      }

      results.push({
        phone: task.phone,
        success,
        response: responseData,
        error: errorMessage || undefined,
      })

      // Prepare queue log
      queueRows.push({
        to_phone: task.phone,
        message: task.message,
        type: "bulk",
        student_id: task.studentId || null,
        status: success ? "sent" : "failed",
        sent_at: success ? new Date().toISOString() : null,
        error_message: errorMessage,
      })
    }

    // 4. Batch insert into sms_queue for audit/logs
    if (queueRows.length > 0) {
      try {
        await admin.from("sms_queue").insert(queueRows)
      } catch (logErr) {
        console.warn("Could not insert into sms_queue:", logErr)
      }
    }

    const sentSuccessCount = results.filter((r) => r.success).length
    const failedCount = results.length - sentSuccessCount

    return NextResponse.json({
      success: sentSuccessCount > 0,
      total: results.length,
      sentCount: sentSuccessCount,
      failedCount,
      results,
      sampleResponse: results[0]?.response || null,
    })
  } catch (err: any) {
    console.error("SMS Send API Error:", err)
    return NextResponse.json({ error: err?.message || "Failed to process SMS request" }, { status: 500 })
  }
}
