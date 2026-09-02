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

export function getSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER || "mock"
  if (provider === "ssl_wireless") return new SslWirelessProvider()
  if (provider === "twilio") return new TwilioProvider()
  return new MockSmsProvider()
}

export async function sendSms(to: string, message: string) {
  return getSmsProvider().send(to, message)
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
