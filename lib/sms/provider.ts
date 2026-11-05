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

class BdWebsProvider implements SmsProvider {
  private username: string
  private password: string
  private senderId?: string
  private apiUrl: string

  constructor(config?: { username?: string; password?: string; senderId?: string; apiUrl?: string }) {
    this.username = config?.username || process.env.BDWEBS_USERNAME || "decentraforce"
    this.password = config?.password || process.env.BDWEBS_PASSWORD || "asikr048@gmail"
    this.senderId = config?.senderId || process.env.BDWEBS_SENDER_ID || ""
    this.apiUrl = config?.apiUrl || process.env.BDWEBS_API_URL || "https://smsapi.cloudex.top/api/v1/campaigns/sendsms/plain"
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

      const params = new URLSearchParams()
      params.append("username", this.username)
      params.append("password", this.password)
      if (this.senderId) {
        params.append("sender", this.senderId)
      }
      params.append("text", message)
      params.append("to", normalized)

      // Add Unicode flag if message contains Bangla characters
      if (/[\u0980-\u09FF]/.test(message)) {
        params.append("type", "unicode")
      }

      const url = `${this.apiUrl}?${params.toString()}`
      const res = await fetch(url, { method: "GET" })
      const text = await res.text()

      let json: any = null
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }

      if (json && typeof json === "object") {
        if (json.status === 201 || json.status === "201" || String(json.message).toLowerCase() === "success") {
          return { success: true }
        }
        if (json.status === 207) {
          return { success: false, error: "BDWebs: Sender ID mismatch. Please configure an approved Sender ID in Gateway Settings or request one from BDWebs support." }
        }
        if (json.status === 205) {
          return { success: false, error: "BDWebs: Insufficient balance." }
        }
        if (json.status === 401) {
          return { success: false, error: "BDWebs: Invalid Username or Password." }
        }
        return { success: false, error: json.message || json.msg || `BDWebs Error (Code ${json.status})` }
      }

      if (text.includes("Success") || text.includes("201")) {
        return { success: true }
      }
      return { success: false, error: text }
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) }
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
            const isStatusOk = s === "success" || s === "true" || s === "ok" || s === "200" || s === "201" || s === "sent"
            if (s === "207") {
              return { isSuccess: false, err: "Sender ID mismatch: Your SMS account requires an approved Sender ID. Check your Gateway Settings or contact support." }
            }
            if (s === "205") {
              return { isSuccess: false, err: "Insufficient SMS Balance." }
            }
            if (s === "401") {
              return { isSuccess: false, err: "Invalid Gateway Username or Password." }
            }
            return { isSuccess: isStatusOk, err: isStatusOk ? undefined : (json.msg || json.message || JSON.stringify(json)) }
          }
          if ("message" in json && String(json.message).toLowerCase() === "success") {
            return { isSuccess: true }
          }
        } catch {
          const lower = text.toLowerCase()
          if (lower.includes("success") || lower.includes("ok") || lower.includes("sent")) {
            return { isSuccess: true }
          }
          if (lower.includes("invalid") || lower.includes("failed") || lower.includes("insufficient") || lower.includes("mismatch")) {
            return { isSuccess: false, err: text }
          }
        }
        return { isSuccess: true }
      }

      const [extractedUser, extractedPass] = this.config.apiKey.includes(":")
        ? this.config.apiKey.split(":")
        : [this.config.apiKey, ""]

      if (this.config.callType === "POST_JSON") {
        const baseUrl = this.config.urlTemplate.split("?")[0]
        const payload: any = {
          api_key: this.config.apiKey,
          msg: message,
          message: message,
          text: message,
          to: normalized,
        }
        if (extractedPass) {
          payload.username = extractedUser
          payload.password = extractedPass
        }
        if (this.config.senderId) {
          payload.sender_id = this.config.senderId
          payload.sender = this.config.senderId
        }
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const text = await res.text()
        const check = isGatewaySuccess(res.ok, text)
        return { success: check.isSuccess, error: check.err }
      } else if (this.config.callType === "POST_FORM") {
        const baseUrl = this.config.urlTemplate.split("?")[0]
        const form = new URLSearchParams()
        if (extractedPass) {
          form.append("username", extractedUser)
          form.append("password", extractedPass)
        } else {
          form.append("api_key", this.config.apiKey)
        }
        form.append("msg", message)
        form.append("text", message)
        form.append("to", normalized)
        if (this.config.senderId) {
          form.append("sender_id", this.config.senderId)
          form.append("sender", this.config.senderId)
        }
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
        if (extractedPass) {
          url = url.replace(/\{username\}|\{USERNAME\}|\{YOUR_USERNAME\}|\{user\}|\{USER\}/g, encodeURIComponent(extractedUser))
          url = url.replace(/\{password\}|\{PASSWORD\}|\{YOUR_PASSWORD\}|\{pass\}|\{PASS\}/g, encodeURIComponent(extractedPass))
        }
        url = url.replace(/\{msg\}|\{MSG\}|\{YOUR_MSG\}|\{message\}|\{text\}|\{TEXT\}/g, encodeURIComponent(message))
        url = url.replace(/\{to\}|\{TO\}|\{YOUR_TO\}|\{number\}|\{phone\}|\{msisdn\}|8801800000000/g, encodeURIComponent(normalized))
        if (this.config.senderId) {
          url = url.replace(/\{sender_id\}|\{senderId\}|\{SENDER_ID\}|\{sender\}|\{SENDER\}/g, encodeURIComponent(this.config.senderId))
        } else {
          url = url.replace(/([?&])sender=[^&]*(&|$)/g, (m, p1, p2) => (p2 === "&" ? p1 : ""))
          url = url.replace(/([?&])sender_id=[^&]*(&|$)/g, (m, p1, p2) => (p2 === "&" ? p1 : ""))
          url = url.replace(/\{sender_id\}|\{senderId\}|\{SENDER_ID\}|\{sender\}|\{SENDER\}/g, "")
        }
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
  if (provider === "bdwebs") return new BdWebsProvider()
  if (provider === "ssl_wireless") return new SslWirelessProvider()
  if (provider === "twilio") return new TwilioProvider()
  return new MockSmsProvider()
}

export async function sendSms(to: string, message: string, dynamicConfig?: { apiKey: string; callType: string; urlTemplate: string; senderId?: string }) {
  return getSmsProvider(dynamicConfig).send(to, message)
}

export const SMS_SENDER = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Coaching Center"

export const SMS_TEMPLATES = {
  absent: (studentName: string, date: string, batchName: string) =>
    `${SMS_SENDER}: Dear Parent, ${studentName} was ABSENT from ${batchName} class on ${date}. Please contact us.`,
  feeReminder: (studentName: string, amount: number, dueDate: string) =>
    `${SMS_SENDER}: Dear Parent, Fee of BDT ${amount} for ${studentName} is due on ${dueDate}. Please pay to avoid late charges.`,
  paymentConfirmed: (studentName: string, amount: number, receiptNo: string) =>
    `${SMS_SENDER}: Payment of BDT ${amount} for ${studentName} received. Receipt: ${receiptNo}. Thank you!`,
  feeAlert: (studentName: string, amount: number) =>
    `${SMS_SENDER}: URGENT - ${studentName} has overdue fee of BDT ${amount}. Please clear immediately.`,
}
