import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffRole, isAuthError } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const auth = await requireStaffRole(["owner", "super_manager", "manager"])
  if (isAuthError(auth)) return auth

  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get("branchId")

    const admin = createAdminClient()

    let apiKey = ""
    let username = process.env.BDWEBS_USERNAME || "decentraforce"
    let password = process.env.BDWEBS_PASSWORD || "asikr048@gmail"
    let urlTemplate = ""

    // 1. Check branch if specified
    if (branchId && branchId !== "all") {
      try {
        const { data: branchRow } = await admin
          .from("branches")
          .select("sms_gateway_config")
          .eq("id", branchId)
          .maybeSingle()

        if (branchRow?.sms_gateway_config) {
          const bConf = branchRow.sms_gateway_config
          apiKey = bConf.apiKey || bConf.api_key || ""
          username = bConf.username || username
          password = bConf.password || password
          urlTemplate = bConf.urlTemplate || bConf.api_url || ""
        }
      } catch (err) {
        console.warn("Branch SMS balance lookup error:", err)
      }
    }

    // 2. Check site_settings if no branch config
    if (!apiKey && !urlTemplate) {
      try {
        const { data: settingRow } = await admin
          .from("site_settings")
          .select("value")
          .eq("key", "sms_gateway_config")
          .maybeSingle()

        if (settingRow?.value) {
          try {
            const parsed = JSON.parse(settingRow.value)
            apiKey = parsed.apiKey || parsed.api_key || ""
            username = parsed.username || username
            password = parsed.password || password
            urlTemplate = parsed.urlTemplate || parsed.baseUrl || ""
          } catch (e) {
            console.error("Failed to parse sms_gateway_config JSON:", e)
          }
        }
      } catch (e) {
        console.warn("Site settings SMS balance lookup error:", e)
      }
    }

    // Parse username:password if apiKey contains colon
    if (apiKey && apiKey.includes(":")) {
      const parts = apiKey.split(":")
      username = parts[0]
      password = parts[1]
    }

    // 3. Dispatch balance check according to provider
    // BDWebs Check Balance
    if (urlTemplate.includes("bdwebs") || urlTemplate.includes("cloudex.top") || urlTemplate.includes("icombd") || username) {
      try {
        const balanceUrl = `https://smsapi.cloudex.top/balance?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        const res = await fetch(balanceUrl, { method: "GET" })
        const text = await res.text()

        try {
          const json = JSON.parse(text)
          return NextResponse.json({
            success: true,
            provider: "bdwebs",
            balance: json.credit || json.nonMaskingCredit || "0.00",
            nonMaskingCredit: json.nonMaskingCredit || "0.00",
            maskingCredit: json.maskingCredit || "0.00",
            currency: json.currency || "BDT",
            raw: json,
          })
        } catch {
          return NextResponse.json({
            success: res.ok,
            provider: "bdwebs",
            balance: text.trim(),
            currency: "BDT",
            raw: text,
          })
        }
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: `Failed to connect to BDWebs balance API: ${err?.message || err}`,
        }, { status: 502 })
      }
    }

    // sms.net.bd Check Balance
    if (urlTemplate.includes("sms.net.bd") && apiKey) {
      try {
        const res = await fetch(`https://api.sms.net.bd/user/balance?api_key=${encodeURIComponent(apiKey)}`)
        const json = await res.json()
        return NextResponse.json({
          success: json.error === 0,
          provider: "sms_net_bd",
          balance: json.data?.balance || "0",
          currency: "BDT",
          raw: json,
        })
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 502 })
      }
    }

    // Greenweb BD Check Balance
    if (urlTemplate.includes("greenweb") && apiKey) {
      try {
        const res = await fetch(`http://api.greenweb.com.bd/g_api.php?token=${encodeURIComponent(apiKey)}&balance`)
        const text = await res.text()
        return NextResponse.json({
          success: true,
          provider: "greenweb",
          balance: text.trim(),
          currency: "BDT",
          raw: text,
        })
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 502 })
      }
    }

    return NextResponse.json({
      success: false,
      error: "Unable to detect a supported balance checking endpoint for this gateway configuration.",
    }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
