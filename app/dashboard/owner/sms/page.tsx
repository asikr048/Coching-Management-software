"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Send, Loader2, MessageSquare } from "lucide-react"

export default function SmsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [target, setTarget] = useState("all")
  const [message, setMessage] = useState("")
  const [sentCount, setSentCount] = useState(0)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      let phones: string[] = []
      if (target === "all") {
        const { data } = await supabase.from("students").select("guardian_phone").eq("is_active", true)
        phones = (data || []).map(s => s.guardian_phone).filter(Boolean)
      } else if (target === "due") {
        const { data } = await supabase.from("fee_dues").select("student:students(guardian_phone)").eq("status", "pending")
        phones = (data || []).map((d: any) => d.student?.guardian_phone).filter(Boolean)
      }

      const unique = [...new Set(phones)]
      const smsItems = unique.map(phone => ({ to_phone: phone, message, type: "bulk" as const, status: "pending" as const }))

      if (smsItems.length > 0) {
        await supabase.from("sms_queue").insert(smsItems)
      }

      setSentCount(unique.length)
      toast.success(`${unique.length} SMS queued for sending!`)
      setMessage("")
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Bulk SMS</h2><p className="text-sm text-gray-500 mt-1">Send SMS to parents and guardians</p></div>
      <div className="max-w-2xl">
        <form onSubmit={handleSend} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-5 h-5 text-indigo-600" /><h3 className="font-semibold text-gray-800">Compose Message</h3></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <select value={target} onChange={e => setTarget(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Active Students (Guardians)</option>
              <option value="due">Students with Pending Dues</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Type your message here..." />
            <p className="text-xs text-gray-400 mt-1">{message.length} characters</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">SMS Provider: <span className="font-medium text-gray-700">{process.env.NEXT_PUBLIC_SMS_PROVIDER || "Mock (test mode)"}</span></p>
            <button type="submit" disabled={loading || !message} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send SMS</>}
            </button>
          </div>
          {sentCount > 0 && <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">Last batch: {sentCount} SMS queued successfully!</div>}
        </form>

        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Quick Templates</h3>
          <div className="space-y-2">
            {[
              { label: "Fee Reminder", text: "Dear Parent, your child's monthly fee is due. Please pay at the earliest to avoid late charges. - MedhaShiree" },
              { label: "Holiday Notice", text: "Dear Parent, please note that classes will be closed on [DATE] due to [REASON]. Regular classes will resume on [DATE]. - MedhaShiree" },
              { label: "Exam Notice", text: "Dear Parent, the upcoming exam is scheduled for [DATE]. Please ensure your child is prepared. - MedhaShiree" },
            ].map((t, i) => (
              <button key={i} onClick={() => setMessage(t.text)} className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                <p className="text-sm font-medium text-gray-700">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{t.text}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
