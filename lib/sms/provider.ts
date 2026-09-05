export interface SmsProvider {
  send(to: string, message: string): Promise<{ success: boolean; error?: string }>
}

class MockSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    console.log(`[SMS Mock] To: ${to} | Message: ${message}`)
    return { success: true }
  }
}

class SslWirelessProvider implements SmsProvider {
  async send(to: string, message: string) {
    try {
      const res = await fetch("http://sms.sslwireless.com/pushapi/dynamic/server.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_token: process.env.SSL_WIRELESS_API_KEY || "",
          sid: process.env.SSL_WIRELESS_SID || "",
          sms: message,
          msisdn: to,
          csms_id: Date.now().toString(),
        }),
      })
      const text = await res.text()
      return { success: text.includes("SUCCESS") }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}

class TwilioProvider implements SmsProvider {
  async send(to: string, message: string) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM_NUMBER
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: from!, Body: message }),
        }
      )
      const data = await res.json()
      return { success: !!data.sid }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}

class DynamicGatewayProvider implements SmsProvider {
  private config: { apiKey: string; callType: string; urlTemplate: string; senderId?: string }

  constructor(config: { apiKey: string; callType: string; urlTemplate: string; senderId?: string }) {
    this.config = config
  }

  async send(to: string, message: string) {
    try {
      let cleaned = to.replace(/[^0-9]/g, "")
      let normalized = cleaned
      if (cleaned.startsWith("8801") && cleaned.length === 13) {
        normalized = cleaned
      } else if (cleaned.startsWith("01") && cleaned.length === 11) {
        normalized = "88" + cleaned
      } else if (cleaned.startsWith("1") && cleaned.length === 10) {
        normalized = "880" + cleaned
      } else if (cleaned.startsWith("01")) {
        normalized = "88" + cleaned
      }

      function isGatewaySuccess(ok: boolean, text: string): { isSuccess: boolean; err?: string } {
        if (!ok) return { isSuccess: false, err: text }
        try {
          const json = JSON.parse(text)
          if ("error" in json) {
            const isZero = json.error === 0 || json.error === "0" || json.error === false || json.error === null
            return { isSuccess: isZero, err: isZero ? undefined : (json.msg || json.message || JSON.stringify(json)) }
          }
          if ("status" in json) {
            const s = String(json.status).toLowerCase()
            const isStatusOk = s === "success" || s === "true" || s === "ok" || s === "200" || s === "sent"
            return { isSuccess: isStatusOk, err: isStatusOk ? undefined : (json.msg || json.message || JSON.stringify(json)) }
          }
        } catch {
          const lower = text.toLowerCase()
          if (lower.includes("success") || lower.includes("ok") || lower.includes("sent")) {
            return { isSuccess: true }
          }
          if (lower.includes("invalid") || lower.includes("failed") || lower.includes("insufficient")) {
            return { isSuccess: false, err: text }
          }
        }
        return { isSuccess: true }
      }

      if (this.config.callType === "POST_JSON") {
        const baseUrl = this.config.urlTemplate.split("?")[0]
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: this.config.apiKey, msg: message, to: normalized, sender_id: this.config.senderId }),
        })
        const text = await res.text()
        const check = isGatewaySuccess(res.ok, text)
        return { success: check.isSuccess, error: check.err }
      } else if (this.config.callType === "POST_FORM") {
        const baseUrl = this.config.urlTemplate.split("?")[0]
        const form = new URLSearchParams()
        form.append("api_key", this.config.apiKey)
        form.append("msg", message)
        form.append("to", normalized)
        if (this.config.senderId) form.append("sender_id", this.config.senderId)
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        })
        const text = await res.text()
        const check = isGatewaySuccess(res.ok, text)
        return { success: check.isSuccess, error: check.err }
      } else {
        // GET (default)
        let url = this.config.urlTemplate
        url = url.replace(/\{api_key\}|\{API_KEY\}|\{YOUR_API_KEY\}/g, encodeURIComponent(this.config.apiKey))
        url = url.replace(/\{msg\}|\{MSG\}|\{YOUR_MSG\}|\{message\}/g, encodeURIComponent(message))
        url = url.replace(/\{to\}|\{TO\}|\{YOUR_TO\}|\{number\}|\{phone\}|\{msisdn\}|8801800000000/g, encodeURIComponent(normalized))
        const res = await fetch(url, { method: "GET" })
        const text = await res.text()
        const check = isGatewaySuccess(res.ok, text)
        return { success: check.isSuccess, error: check.err }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) }
    }
  }
}

export function getSmsProvider(dynamicConfig?: { apiKey: string; callType: string; urlTemplate: string; senderId?: string }): SmsProvider {
  if (dynamicConfig?.apiKey && dynamicConfig?.urlTemplate) {
    return new DynamicGatewayProvider(dynamicConfig)
  }
  const provider = process.env.SMS_PROVIDER || "mock"
  if (provider === "ssl_wireless") return new SslWirelessProvider()
  if (provider === "twilio") return new TwilioProvider()
  return new MockSmsProvider()
}

export async function sendSms(to: string, message: string, dynamicConfig?: { apiKey: string; callType: string; urlTemplate: string; senderId?: string }) {
  return getSmsProvider(dynamicConfig).send(to, message)
}

export const SMS_TEMPLATES = {
  absent: (studentName: string, date: string, batchName: string) =>
    `MedhaShiree: Dear Parent, ${studentName} was ABSENT from ${batchName} class on ${date}. Please contact us.`,
  feeReminder: (studentName: string, amount: number, dueDate: string) =>
    `MedhaShiree: Dear Parent, Fee of BDT ${amount} for ${studentName} is due on ${dueDate}. Please pay to avoid late charges.`,
  paymentConfirmed: (studentName: string, amount: number, receiptNo: string) =>
    `MedhaShiree: Payment of BDT ${amount} for ${studentName} received. Receipt: ${receiptNo}. Thank you!`,
  feeAlert: (studentName: string, amount: number) =>
    `MedhaShiree: URGENT - ${studentName} has overdue fee of BDT ${amount}. Please clear immediately.`,
}
