import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface GatewayConfig {
  apiKey: string
  callType: "GET" | "POST_FORM" | "POST_JSON"
  urlTemplate: string
  senderId?: string
}

function normalizeBdPhone(phone: string): string {
  if (!phone) return ""
  let cleaned = phone.replace(/[^0-9]/g, "")

  // In Bangladesh, all numbers begin with 01 (11 digits)
  // For SMS gateway APIs (sms.net.bd, AlphaNet, etc.), the number must be 88 + 01 + rest (13 digits: 8801XXXXXXXXX)
  if (cleaned.startsWith("8801") && cleaned.length === 13) {
    return cleaned
  }
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    return "88" + cleaned
  }
  if (cleaned.startsWith("1") && cleaned.length === 10) {
    return "880" + cleaned
  }
  if (cleaned.startsWith("8801")) {
    return cleaned.slice(0, 13)
  }
  if (cleaned.startsWith("01")) {
    return "88" + cleaned
  }
  return cleaned
}

function parseGatewayResponse(resOk: boolean, status: number, text: string): { success: boolean; data: any; errorMessage: string | null } {
  let responseData: any = null
  try {
    responseData = JSON.parse(text)
  } catch {
    responseData = text
  }

  if (!resOk) {
    return {
      success: false,
      data: responseData,
      errorMessage: `HTTP ${status}: ${typeof responseData === "object" ? JSON.stringify(responseData) : text}`,
    }
  }

  // Parse JSON response formats:
  // sms.net.bd returns: { error: 0, msg: "Request was successful", data: {...} }
  // On error it returns: { error: 401, msg: "Invalid API Key" } or { error: 402, msg: "Insufficient Balance" }
  if (responseData && typeof responseData === "object") {
    if ("error" in responseData) {
      const errVal = responseData.error
      if (errVal === 0 || errVal === "0" || errVal === false || errVal === null) {
        return { success: true, data: responseData, errorMessage: null }
      } else {
        const msg = responseData.msg || responseData.message || responseData.error_message || `Gateway error code ${errVal}`
        return { success: false, data: responseData, errorMessage: msg }
      }
    }

    if ("status" in responseData) {
      const s = String(responseData.status).toLowerCase()
      if (s === "success" || s === "true" || s === "ok" || s === "200" || s === "sent") {
        return { success: true, data: responseData, errorMessage: null }
      } else {
        const msg = responseData.msg || responseData.message || responseData.error || `Status: ${responseData.status}`
        return { success: false, data: responseData, errorMessage: msg }
      }
    }

    if ("code" in responseData) {
      const codeVal = responseData.code
      if (codeVal === 200 || codeVal === 0 || codeVal === "200" || codeVal === "0") {
        return { success: true, data: responseData, errorMessage: null }
      } else {
        const msg = responseData.message || responseData.msg || `Gateway response code ${codeVal}`
        return { success: false, data: responseData, errorMessage: msg }
      }
    }

    // Generic JSON with HTTP 200
    return { success: true, data: responseData, errorMessage: null }
  }

  // Raw text response (e.g. Greenweb or custom text)
  if (typeof text === "string") {
    const lower = text.toLowerCase()
    if (lower.includes("success") || lower.includes("ok") || lower.includes("sent")) {
      return { success: true, data: text, errorMessage: null }
    }
    if (lower.includes("invalid") || lower.includes("failed") || lower.includes("err_") || lower.includes("denied")) {
      return { success: false, data: text, errorMessage: text }
    }
    return { success: true, data: text, errorMessage: null }
  }

  return { success: true, data: responseData, errorMessage: null }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      recipients, // Array<{ phone, message, name?, studentId? }> | string (single phone)
      message, // Global message if recipients array only has phones
      configOverride, // Optional testing config
      branchId, // Optional branch ID to use branch-specific SMS gateway
    } = body

    if (!recipients || (!Array.isArray(recipients) && typeof recipients !== "string")) {
      return NextResponse.json({ error: "Recipients must be provided" }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Fetch Gateway Config from branch, site_settings or configOverride
    let config: GatewayConfig = {
      apiKey: "",
      callType: "GET",
      urlTemplate: "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}",
      senderId: "",
    }

    let branchFound = false
    let branchName = ""
    if (branchId && branchId !== "all") {
      try {
        const { data: branchRow } = await admin
          .from("branches")
          .select("sms_gateway_config, name")
          .eq("id", branchId)
          .maybeSingle()

        if (branchRow) {
          branchName = branchRow.name || ""
          const bConf = branchRow.sms_gateway_config
          if (bConf && (bConf.apiKey || bConf.api_key)) {
            config.apiKey = bConf.apiKey || bConf.api_key || ""
            if (bConf.callType) config.callType = bConf.callType
            if (bConf.senderId || bConf.sender_id) config.senderId = bConf.senderId || bConf.sender_id
            if (bConf.urlTemplate) {
              config.urlTemplate = bConf.urlTemplate
            } else if (bConf.api_url) {
              config.urlTemplate = bConf.api_url.includes("{api_key}")
                ? bConf.api_url
                : `${bConf.api_url}?api_key={api_key}&msg={msg}&to={to}`
            }
            branchFound = true
          }
        }
      } catch (bErr) {
        console.warn("Could not load branch-specific SMS config:", bErr)
      }
    }

    if (!branchFound) {
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
    }

    if (!config.apiKey) {
      return NextResponse.json(
        { error: "SMS Gateway API Key is not configured. Please set it in Branch or Gateway Settings." },
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

    // Filter out invalid items (must have valid phone number)
    items = items.filter((it) => {
      if (!it.phone || !it.message || !it.message.trim()) return false
      const clean = it.phone.replace(/[^0-9]/g, "")
      return clean.length >= 10
    })

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid recipient phone numbers or messages provided" }, { status: 400 })
    }

    const results: Array<{ phone: string; success: boolean; response?: any; error?: string }> = []
    const queueRows: any[] = []

    // 3. Dispatch messages
    for (const task of items) {
      const phoneToUse = normalizeBdPhone(task.phone)

      let success = false
      let responseData: any = null
      let errorMessage: string | null = null

      try {
        if (config.callType === "GET") {
          let targetUrl = config.urlTemplate
          targetUrl = targetUrl.replace(/\{api_key\}|\{API_KEY\}|\{YOUR_API_KEY\}/g, encodeURIComponent(config.apiKey))
          targetUrl = targetUrl.replace(/\{msg\}|\{MSG\}|\{YOUR_MSG\}|\{message\}/g, encodeURIComponent(task.message))
          // Replace {to} token or any template sample phone number
          targetUrl = targetUrl.replace(/\{to\}|\{TO\}|\{YOUR_TO\}|\{number\}|\{phone\}|\{msisdn\}|8801800000000/g, encodeURIComponent(phoneToUse))
          if (config.senderId) {
            targetUrl = targetUrl.replace(/\{sender_id\}|\{senderId\}|\{SENDER_ID\}|\{sender_id_value\}/g, encodeURIComponent(config.senderId))
          }

          const res = await fetch(targetUrl, { method: "GET" })
          const text = await res.text()
          const parsed = parseGatewayResponse(res.ok, res.status, text)
          success = parsed.success
          responseData = parsed.data
          errorMessage = parsed.errorMessage
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
          const parsed = parseGatewayResponse(res.ok, res.status, text)
          success = parsed.success
          responseData = parsed.data
          errorMessage = parsed.errorMessage
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
          const parsed = parseGatewayResponse(res.ok, res.status, text)
          success = parsed.success
          responseData = parsed.data
          errorMessage = parsed.errorMessage
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
      gatewayUsed: branchFound ? `Branch: ${branchName || branchId}` : "Global Default",
      branchUsed: branchName || null,
      results,
      sampleResponse: results[0]?.response || null,
    })
  } catch (err: any) {
    console.error("SMS Send API Error:", err)
    return NextResponse.json({ error: err?.message || "Failed to process SMS request" }, { status: 500 })
  }
}
