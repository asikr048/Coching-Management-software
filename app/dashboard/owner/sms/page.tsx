"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Send,
  Loader2,
  MessageSquare,
  Settings,
  History,
  Users,
  Layers,
  AlertTriangle,
  Search,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Smartphone,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  FileText,
  Check,
  X,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Trash2,
} from "lucide-react"

interface Student {
  id: string
  name: string
  student_id: string
  phone: string | null
  guardian_phone: string | null
  guardian_name: string | null
  batch_id?: string | null
}

interface Batch {
  id: string
  name: string
  current_seats?: number
  subject?: string
}

interface DueRecord {
  id: string
  student_id: string
  due_amount: number
  due_month: string
  status: string
  student?: {
    id: string
    name: string
    student_id: string
    phone: string | null
    guardian_phone: string | null
  }
}

interface GatewayConfig {
  apiKey: string
  callType: "GET" | "POST_FORM" | "POST_JSON"
  urlTemplate: string
  senderId?: string
}

interface SmsLog {
  id: string
  to_phone: string
  message: string
  type: string
  status: string
  sent_at: string | null
  error_message: string | null
  created_at: string
}

interface CsvRecipient {
  phone: string
  name?: string
  isValid: boolean
}

export default function SmsPage() {
  const supabase = useMemo(() => createClient(), [])

  // Active Tab: "compose" | "gateway" | "logs"
  const [activeTab, setActiveTab] = useState<"compose" | "gateway" | "logs">("compose")

  // Core Data
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [dues, setDues] = useState<DueRecord[]>([])
  const [logs, setLogs] = useState<SmsLog[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Gateway Configuration State
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
    apiKey: "",
    callType: "GET",
    urlTemplate: "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}",
    senderId: "",
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingGateway, setSavingGateway] = useState(false)
  const [testingGateway, setTestingGateway] = useState(false)
  const [testPhone, setTestPhone] = useState("")
  const [testResult, setTestResult] = useState<any>(null)

  // Audience Target Selection
  // "all" | "batch" | "due" | "search" | "csv"
  const [targetType, setTargetType] = useState<"all" | "batch" | "due" | "search" | "csv">("all")
  const [targetPhoneType, setTargetPhoneType] = useState<"guardian" | "student" | "both">("guardian")

  // Batch Filter
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])

  // Individual Search & Selection
  const [studentSearchQuery, setStudentSearchQuery] = useState("")
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  // CSV Upload
  const [csvRecipients, setCsvRecipients] = useState<CsvRecipient[]>([])
  const [csvFileName, setCsvFileName] = useState("")

  // Compose Message
  const [message, setMessage] = useState("")
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null)
  const urlTemplateInputRef = useRef<HTMLInputElement>(null)

  // Sending State & Progress
  const [sending, setSending] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })

  // 1. Load Initial Data & Settings
  useEffect(() => {
    async function loadAll() {
      try {
        const [studentsRes, batchesRes, enrollRes, duesRes, settingsRes, logsRes] = await Promise.all([
          supabase.from("students").select("id, name, student_id, phone, guardian_phone, guardian_name, batch_id").eq("is_active", true),
          supabase.from("batches").select("id, name, current_seats, subject"),
          supabase.from("enrollments").select("student_id, batch_id, status").eq("status", "active"),
          supabase.from("fee_dues").select("id, student_id, due_amount, due_month, status, student:students(id, name, student_id, phone, guardian_phone)").eq("status", "pending"),
          supabase.from("site_settings").select("value").eq("key", "sms_gateway_config").maybeSingle(),
          supabase.from("sms_queue").select("*").order("created_at", { ascending: false }).limit(40),
        ])

        if (studentsRes.data) setStudents(studentsRes.data)
        if (batchesRes.data) setBatches(batchesRes.data)
        if (enrollRes.data) setEnrollments(enrollRes.data)
        if (duesRes.data) setDues(duesRes.data as any)
        if (logsRes.data) setLogs(logsRes.data)

        if (settingsRes.data?.value) {
          try {
            const parsed = JSON.parse(settingsRes.data.value)
            setGatewayConfig((prev) => ({ ...prev, ...parsed }))
          } catch (e) {
            console.error("Failed to parse gateway config:", e)
          }
        }
      } catch (err: any) {
        console.error("Error loading SMS data:", err)
        toast.error("Failed to load initial SMS data")
      } finally {
        setLoadingData(false)
      }
    }
    loadAll()
  }, [supabase])

  // Save Gateway Configuration
  async function handleSaveGateway(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!gatewayConfig.apiKey.trim()) {
      toast.error("Please enter your SMS Gateway API Key")
      return
    }
    if (!gatewayConfig.urlTemplate.includes("{msg}") && !gatewayConfig.urlTemplate.includes("{MSG}")) {
      toast.error("URL Template must include {msg} token")
      return
    }
    if (!gatewayConfig.urlTemplate.includes("{to}") && !gatewayConfig.urlTemplate.includes("{TO}")) {
      toast.error("URL Template must include {to} token")
      return
    }

    setSavingGateway(true)
    try {
      const { error } = await supabase.from("site_settings").upsert({
        key: "sms_gateway_config",
        value: JSON.stringify(gatewayConfig),
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      toast.success("SMS Gateway configuration saved! All message options are now active.")
    } catch (err: any) {
      toast.error(err.message || "Failed to save gateway config")
    } finally {
      setSavingGateway(false)
    }
  }

  // Send Test SMS
  async function handleSendTestSms() {
    if (!testPhone.trim()) {
      toast.error("Please enter a test recipient phone number")
      return
    }
    if (!gatewayConfig.apiKey) {
      toast.error("Please enter an API Key first")
      return
    }

    setTestingGateway(true)
    setTestResult(null)

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: [testPhone.trim()],
          message: "MedhaShiree: Test SMS gateway configuration verified successfully!",
          configOverride: gatewayConfig,
        }),
      })

      const data = await res.json()
      setTestResult(data)

      if (res.ok && data.sentCount > 0) {
        toast.success(`✓ Test SMS sent successfully to ${testPhone}!`)
        refreshLogs()
      } else {
        toast.error(`Test failed: ${data.error || "Gateway returned error"}`)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send test SMS")
      setTestResult({ error: err.message })
    } finally {
      setTestingGateway(false)
    }
  }

  // Refresh Delivery Logs
  async function refreshLogs() {
    const { data } = await supabase.from("sms_queue").select("*").order("created_at", { ascending: false }).limit(40)
    if (data) setLogs(data)
  }

  // Drag & Drop Handler for Gateway URL Builder
  function handleDragStart(e: React.DragEvent, token: string) {
    e.dataTransfer.setData("text/plain", token)
  }

  function handleDropToken(e: React.DragEvent) {
    e.preventDefault()
    const token = e.dataTransfer.getData("text/plain")
    if (token) {
      insertTokenIntoUrl(token)
    }
  }

  function insertTokenIntoUrl(token: string) {
    setGatewayConfig((prev) => {
      // Append or insert at cursor
      const input = urlTemplateInputRef.current
      if (!input) {
        return { ...prev, urlTemplate: prev.urlTemplate + token }
      }
      const start = input.selectionStart || prev.urlTemplate.length
      const end = input.selectionEnd || prev.urlTemplate.length
      const newUrl = prev.urlTemplate.substring(0, start) + token + prev.urlTemplate.substring(end)
      return { ...prev, urlTemplate: newUrl }
    })
    toast.info(`Added ${token} to URL pattern`)
  }

  // Gateway Configuration Checklist Status
  const isGatewayReady = useMemo(() => {
    const hasKey = Boolean(gatewayConfig.apiKey && gatewayConfig.apiKey.trim().length > 0)
    const hasMsg = gatewayConfig.urlTemplate.includes("{msg}") || gatewayConfig.urlTemplate.includes("{MSG}")
    const hasTo = gatewayConfig.urlTemplate.includes("{to}") || gatewayConfig.urlTemplate.includes("{TO}")
    return hasKey && hasMsg && hasTo
  }, [gatewayConfig])

  // Presets for Bangladeshi SMS Providers
  function applyGatewayPreset(preset: "sms_net_bd" | "greenweb" | "mimsms" | "ssl_wireless") {
    if (preset === "sms_net_bd") {
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "GET",
        urlTemplate: "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}",
        senderId: "",
      })
      toast.success("Applied sms.net.bd preset URL template")
    } else if (preset === "greenweb") {
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "GET",
        urlTemplate: "http://api.greenweb.com.bd/api.php?token={api_key}&to={to}&message={msg}",
        senderId: "",
      })
      toast.success("Applied Greenweb BD preset URL template")
    } else if (preset === "mimsms") {
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "POST_JSON",
        urlTemplate: "https://api.mimsms.com/api/v3/send-sms",
        senderId: "",
      })
      toast.success("Applied MIM SMS BD preset (POST JSON)")
    } else if (preset === "ssl_wireless") {
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "POST_FORM",
        urlTemplate: "http://sms.sslwireless.com/pushapi/dynamic/server.php",
        senderId: "",
      })
      toast.success("Applied SSL Wireless preset (POST Form)")
    }
  }

  // CSV File Upload Handler
  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFileName(file.name)
    const reader = new FileReader()

    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      if (lines.length === 0) return

      // Inspect header
      const headerLine = lines[0].toLowerCase()
      const isHeader =
        headerLine.includes("phone") ||
        headerLine.includes("mobile") ||
        headerLine.includes("number") ||
        headerLine.includes("name")

      const dataLines = isHeader ? lines.slice(1) : lines
      const parsed: CsvRecipient[] = []

      for (const line of dataLines) {
        // Split by comma or semicolon
        const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""))
        let phone = ""
        let name = ""

        if (parts.length === 1) {
          phone = parts[0]
        } else if (parts.length >= 2) {
          // If first part looks like phone
          if (parts[0].replace(/[^0-9]/g, "").length >= 10) {
            phone = parts[0]
            name = parts[1]
          } else {
            name = parts[0]
            phone = parts[1]
          }
        }

        const cleanedPhone = phone.replace(/[^0-9]/g, "")
        const isValid = cleanedPhone.length >= 10

        if (phone) {
          parsed.push({
            phone,
            name: name || undefined,
            isValid,
          })
        }
      }

      setCsvRecipients(parsed)
      toast.success(`Loaded ${parsed.length} contacts from CSV file (${parsed.filter((p) => p.isValid).length} valid)`)
    }

    reader.readAsText(file)
  }

  // Dynamic Audience Calculation
  interface ResolvedRecipient {
    phone: string
    name: string
    studentId?: string
    batchName?: string
    dueAmount?: number
  }

  const resolvedRecipients: ResolvedRecipient[] = useMemo(() => {
    const list: ResolvedRecipient[] = []

    function addRecipient(s: Student, dueAmt?: number, bName?: string) {
      const phonesToAdd: string[] = []
      if (targetPhoneType === "guardian" || targetPhoneType === "both") {
        if (s.guardian_phone) phonesToAdd.push(s.guardian_phone)
      }
      if (targetPhoneType === "student" || targetPhoneType === "both") {
        if (s.phone) phonesToAdd.push(s.phone)
      }
      // If neither was matched but one exists, fallback to available phone
      if (phonesToAdd.length === 0) {
        if (s.guardian_phone) phonesToAdd.push(s.guardian_phone)
        else if (s.phone) phonesToAdd.push(s.phone)
      }

      for (const ph of phonesToAdd) {
        list.push({
          phone: ph,
          name: s.name,
          studentId: s.student_id,
          batchName: bName,
          dueAmount: dueAmt,
        })
      }
    }

    if (targetType === "all") {
      students.forEach((s) => addRecipient(s))
    } else if (targetType === "batch") {
      if (selectedBatchIds.length === 0) return []
      // Find students enrolled in selected batches
      const enrolledStudentIds = new Set(
        enrollments.filter((e) => selectedBatchIds.includes(e.batch_id)).map((e) => e.student_id)
      )
      students.filter((s) => enrolledStudentIds.has(s.id)).forEach((s) => {
        const batchObj = batches.find((b) => selectedBatchIds.includes(b.id))
        addRecipient(s, undefined, batchObj?.name)
      })
    } else if (targetType === "due") {
      dues.forEach((d) => {
        if (d.student) {
          const sObj: Student = {
            id: d.student_id,
            name: d.student.name,
            student_id: d.student.student_id,
            phone: d.student.phone,
            guardian_phone: d.student.guardian_phone,
            guardian_name: null,
          }
          addRecipient(sObj, d.due_amount, d.due_month)
        }
      })
    } else if (targetType === "search") {
      const selected = students.filter((s) => selectedStudentIds.includes(s.id))
      selected.forEach((s) => addRecipient(s))
    } else if (targetType === "csv") {
      csvRecipients
        .filter((r) => r.isValid)
        .forEach((r) => {
          list.push({
            phone: r.phone,
            name: r.name || "Student",
          })
        })
    }

    // Deduplicate by phone number
    const seen = new Set<string>()
    return list.filter((item) => {
      const clean = item.phone.replace(/[^0-9]/g, "")
      if (!clean || seen.has(clean)) return false
      seen.add(clean)
      return true
    })
  }, [targetType, targetPhoneType, students, batches, enrollments, selectedBatchIds, dues, selectedStudentIds, csvRecipients])

  // Filtered students for individual selection search
  const filteredStudentsForSearch = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase()
    if (!q) return students.slice(0, 30)
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.student_id || "").toLowerCase().includes(q) ||
        (s.phone || "").includes(q) ||
        (s.guardian_phone || "").includes(q)
    )
  }, [students, studentSearchQuery])

  // Character and SMS Count Calculator
  const smsStats = useMemo(() => {
    const len = message.length
    // Check if Unicode (contains characters outside standard 7-bit ASCII/GSM)
    const isUnicode = /[^\u0000-\u007F]/.test(message)
    const charLimit = isUnicode ? 70 : 160
    const multiLimit = isUnicode ? 67 : 153

    let parts = 1
    if (len > charLimit) {
      parts = Math.ceil(len / multiLimit)
    }
    return { len, parts, isUnicode, charLimit }
  }, [message])

  // Insert merge variable into message textarea
  function insertMergeTag(tag: string) {
    const textarea = messageTextareaRef.current
    if (!textarea) {
      setMessage((prev) => prev + " " + tag)
      return
    }
    const start = textarea.selectionStart || message.length
    const end = textarea.selectionEnd || message.length
    const updated = message.substring(0, start) + tag + message.substring(end)
    setMessage(updated)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tag.length, start + tag.length)
    }, 50)
  }

  // Pre-made Templates
  const templates = [
    {
      label: "Fee Due Reminder",
      text: "Dear Parent, your child {{name}} (ID: {{student_id}}) has a pending fee due of {{due_amount}}. Please complete payment at the earliest. - MedhaShiree",
    },
    {
      label: "Exam Schedule",
      text: "Dear Parent, the upcoming exam for {{name}} in {{batch}} is scheduled for next week. Please ensure regular attendance and preparation. - MedhaShiree",
    },
    {
      label: "Class Notice",
      text: "Dear Parent, please note that classes for {{batch}} will follow a special routine this week. Thank you. - MedhaShiree",
    },
    {
      label: "General Announcement",
      text: "Notice: Academic activities will remain closed on the upcoming public holiday. Regular classes will resume on Sunday. - MedhaShiree",
    },
  ]

  // Render Sample Preview
  const sampleMessagePreview = useMemo(() => {
    if (!message) return "Your message preview will appear here..."
    const sample = resolvedRecipients[0] || {
      name: "Md Asikur Rahman",
      studentId: "MS-00007",
      batchName: "Physics 10 AM",
      dueAmount: 2500,
    }
    let res = message
    res = res.replace(/\{\{name\}\}/gi, sample.name || "Student Name")
    res = res.replace(/\{\{student_id\}\}/gi, sample.studentId || "MS-00007")
    res = res.replace(/\{\{batch\}\}/gi, sample.batchName || "Batch Name")
    res = res.replace(/\{\{due_amount\}\}/gi, sample.dueAmount ? `৳${sample.dueAmount}` : "৳2,500")
    res = res.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"))
    return res
  }, [message, resolvedRecipients])

  // Execute Bulk Send
  async function handleExecuteBulkSend() {
    if (resolvedRecipients.length === 0) {
      toast.error("No recipients selected")
      return
    }
    if (!message.trim()) {
      toast.error("Please compose a message")
      return
    }
    if (!gatewayConfig.apiKey) {
      toast.error("Please configure your SMS Gateway API Key first in Gateway Settings")
      setActiveTab("gateway")
      return
    }

    setSending(true)
    setShowConfirmModal(false)
    setSendProgress({ current: 0, total: resolvedRecipients.length, success: 0, failed: 0 })

    const batchSize = 10
    let totalSuccess = 0
    let totalFailed = 0

    try {
      for (let i = 0; i < resolvedRecipients.length; i += batchSize) {
        const chunk = resolvedRecipients.slice(i, i + batchSize)

        // Personalized message for each recipient
        const payloadRecipients = chunk.map((rec) => {
          let customMsg = message
          customMsg = customMsg.replace(/\{\{name\}\}/gi, rec.name || "Student")
          customMsg = customMsg.replace(/\{\{student_id\}\}/gi, rec.studentId || "")
          customMsg = customMsg.replace(/\{\{batch\}\}/gi, rec.batchName || "")
          customMsg = customMsg.replace(/\{\{due_amount\}\}/gi, rec.dueAmount ? `৳${rec.dueAmount}` : "")
          customMsg = customMsg.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"))

          return {
            phone: rec.phone,
            message: customMsg,
            name: rec.name,
            studentId: rec.studentId,
          }
        })

        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: payloadRecipients,
          }),
        })

        const data = await res.json()
        if (data.sentCount) totalSuccess += data.sentCount
        if (data.failedCount) totalFailed += data.failedCount

        setSendProgress({
          current: Math.min(i + batchSize, resolvedRecipients.length),
          total: resolvedRecipients.length,
          success: totalSuccess,
          failed: totalFailed,
        })
      }

      toast.success(`Finished! Sent ${totalSuccess} SMS successfully (${totalFailed} failed)`)
      refreshLogs()
    } catch (err: any) {
      console.error("Bulk send error:", err)
      toast.error(err.message || "Bulk send encountered an error")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Bulk SMS Management
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Send targeted SMS notices, fee reminders, and announcements with custom gateway support
            </p>
          </div>
        </div>

        {/* Gateway Status Badge */}
        <div className="flex items-center gap-3">
          {isGatewayReady ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Gateway Connected & Active
            </div>
          ) : (
            <button
              onClick={() => setActiveTab("gateway")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Configure Gateway API Key
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("compose")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "compose"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Send className="w-4 h-4" /> Send Bulk SMS
        </button>

        <button
          onClick={() => setActiveTab("gateway")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "gateway"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Settings className="w-4 h-4" /> Gateway & API Settings
          {!isGatewayReady && <span className="w-2 h-2 rounded-full bg-amber-500" />}
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "logs"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <History className="w-4 h-4" /> Delivery Logs ({logs.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SEND BULK SMS */}
      {/* ========================================================================= */}
      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Target Audience Selector */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  1. Select Target Audience
                </h2>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  {resolvedRecipients.length} Recipient{resolvedRecipients.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Target Mode Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { id: "all", label: "All Active", icon: Users },
                  { id: "batch", label: "Batch-wise", icon: Layers },
                  { id: "due", label: "Due Fees", icon: AlertTriangle },
                  { id: "search", label: "Search & Pick", icon: Search },
                  { id: "csv", label: "Custom CSV", icon: Upload },
                ].map((mode) => {
                  const Icon = mode.icon
                  const isActive = targetType === mode.id
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTargetType(mode.id as any)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                        isActive
                          ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 font-black shadow-sm"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-gray-400"}`} />
                      <span className="text-[11px] leading-tight">{mode.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Phone Target Selector (Guardian vs Student) */}
              {targetType !== "csv" && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-gray-700">Send To:</span>
                  <div className="flex items-center gap-2">
                    {[
                      { id: "guardian", label: "Guardian Phone" },
                      { id: "student", label: "Student Phone" },
                      { id: "both", label: "Both" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTargetPhoneType(opt.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          targetPhoneType === opt.id
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: All Students */}
              {targetType === "all" && (
                <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100 text-center space-y-1">
                  <p className="text-xs font-bold text-gray-800">Targeting All Active Enrolled Students</p>
                  <p className="text-[11px] text-gray-500">
                    Total {students.length} active students enrolled in coaching.
                  </p>
                </div>
              )}

              {/* SUB-PANEL: Batch-wise */}
              {targetType === "batch" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700">Choose Batches:</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBatchIds.length === batches.length) setSelectedBatchIds([])
                        else setSelectedBatchIds(batches.map((b) => b.id))
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      {selectedBatchIds.length === batches.length ? "Deselect All" : "Select All Batches"}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                    {batches.map((b) => {
                      const isChecked = selectedBatchIds.includes(b.id)
                      const count = enrollments.filter((e) => e.batch_id === b.id).length
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? "bg-indigo-50 border border-indigo-200" : "hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedBatchIds([...selectedBatchIds, b.id])
                                else setSelectedBatchIds(selectedBatchIds.filter((id) => id !== b.id))
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-gray-900">{b.name}</span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 font-mono font-bold">
                            {count} Students
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: Due Fees */}
              {targetType === "due" && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900">
                      <p className="font-bold">Students with Outstanding Dues ({dues.length})</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        You can use the tag <code className="px-1 py-0.5 bg-amber-100 rounded font-mono font-bold">{"{{due_amount}}"}</code> in your message to insert each student's exact owed amount!
                      </p>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
                    {dues.map((d) => (
                      <div key={d.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-900">{d.student?.name || "Student"}</p>
                          <p className="text-[11px] text-gray-500 font-mono">
                            {d.student?.student_id} • Month: {d.due_month}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold text-xs">
                          ৳{d.due_amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: Search & Individual Selection */}
              {targetType === "search" && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      placeholder="Search student by name, ID, or phone..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">
                      Selected: <strong className="text-indigo-600">{selectedStudentIds.length}</strong> students
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = filteredStudentsForSearch.map((s) => s.id)
                        const allSelected = visibleIds.every((id) => selectedStudentIds.includes(id))
                        if (allSelected) {
                          setSelectedStudentIds(selectedStudentIds.filter((id) => !visibleIds.includes(id)))
                        } else {
                          setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...visibleIds])))
                        }
                      }}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      Select All Filtered
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
                    {filteredStudentsForSearch.map((s) => {
                      const isSelected = selectedStudentIds.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? "bg-indigo-50/60" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, s.id])
                                else setSelectedStudentIds(selectedStudentIds.filter((id) => id !== s.id))
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-bold text-gray-900">{s.name}</p>
                              <p className="text-[11px] text-gray-500 font-mono">
                                {s.student_id} • {s.guardian_phone || s.phone || "No phone"}
                              </p>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: Custom CSV File */}
              {targetType === "csv" && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 hover:border-indigo-400 bg-gray-50/60 hover:bg-indigo-50/30 rounded-2xl p-5 text-center transition-all">
                    <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-800">
                      Upload CSV / TXT Contact List
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      File format: Columns for <span className="font-mono font-bold">phone</span> and optional <span className="font-mono font-bold">name</span>
                    </p>
                    <label className="mt-3 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer">
                      Browse File
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleCsvUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {csvFileName && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold truncate">{csvFileName}</span>
                        <span>({csvRecipients.filter((r) => r.isValid).length} valid numbers)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCsvFileName("")
                          setCsvRecipients([])
                        }}
                        className="text-rose-600 hover:text-rose-800 font-bold text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recipient Preview Count Summary Card */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-100 font-semibold uppercase tracking-wider">Ready to Deliver</p>
                <h3 className="text-2xl font-black mt-0.5">
                  {resolvedRecipients.length} Recipient{resolvedRecipients.length !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold inline-block">
                  Target: {targetPhoneType.toUpperCase()}
                </span>
                <p className="text-[11px] text-indigo-100 mt-1">Est. {resolvedRecipients.length * smsStats.parts} SMS Parts</p>
              </div>
            </div>
          </div>

          {/* Right Column: Compose Message, Merge Tags & Preview */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  2. Compose Message & Dynamic Merge Tags
                </h2>
              </div>

              {/* Quick Template Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Load Quick Template:</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMessage(t.text)}
                      className="p-2 border border-gray-200 rounded-xl text-left hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-xs cursor-pointer truncate"
                    >
                      <span className="font-bold text-gray-800 block truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Merge Tag Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700">Click to Insert Dynamic Tag:</label>
                  <span className="text-[11px] text-gray-400">Replaced automatically per recipient</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "{{name}}", label: "Student Name" },
                    { tag: "{{student_id}}", label: "Student ID" },
                    { tag: "{{batch}}", label: "Batch Name" },
                    { tag: "{{due_amount}}", label: "Due (৳)" },
                    { tag: "{{date}}", label: "Date" },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => insertMergeTag(item.tag)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>{item.tag}</span>
                      <span className="text-[10px] text-indigo-500 font-sans font-normal">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Message Content *</label>
                <textarea
                  ref={messageTextareaRef}
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your SMS here or select a template above... (e.g. Dear Parent, your child {{name}} has class at 10 AM)"
                  className="w-full p-3.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all"
                />

                {/* SMS Parts Counter & Unicode indicator */}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-1.5">
                  <span>
                    <strong className="text-gray-800">{smsStats.len}</strong> characters •{" "}
                    <strong className="text-indigo-600">{smsStats.parts}</strong> SMS part{smsStats.parts !== 1 ? "s" : ""}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium text-[11px]">
                    {smsStats.isUnicode ? "Unicode / Bengali (70 chars/part)" : "Standard GSM (160 chars/part)"}
                  </span>
                </div>
              </div>

              {/* Live Smartphone Screen Mockup */}
              <div className="p-3.5 bg-slate-900 rounded-2xl text-white space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    Recipient Mobile View Simulation
                  </span>
                  <span>MedhaShiree</span>
                </div>
                <div className="p-3 bg-slate-800/90 rounded-xl text-xs text-slate-100 font-medium leading-relaxed shadow-inner">
                  {sampleMessagePreview}
                </div>
              </div>

              {/* Submit / Action Button */}
              <button
                type="button"
                onClick={() => {
                  if (resolvedRecipients.length === 0) {
                    toast.error("Please select at least 1 recipient")
                    return
                  }
                  if (!message.trim()) {
                    toast.error("Please compose a message")
                    return
                  }
                  setShowConfirmModal(true)
                }}
                disabled={sending || resolvedRecipients.length === 0 || !message.trim()}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:shadow-none cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Dispatching SMS Queue...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Bulk SMS to {resolvedRecipients.length} Recipient{resolvedRecipients.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GATEWAY & API SETTINGS (DRAG AND DROP BUILDER) */}
      {/* ========================================================================= */}
      {activeTab === "gateway" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <form onSubmit={handleSaveGateway} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900">Custom SMS Gateway API Builder</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Connect any SMS provider (sms.net.bd, Greenweb, SSL Wireless, etc.) with drag & drop token configuration
                    </p>
                  </div>
                </div>
              </div>

              {/* Provider 1-Click Presets */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">1-Click Provider Templates:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("sms_net_bd")}
                    className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    🚀 sms.net.bd (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("greenweb")}
                    className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    Greenweb BD
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("mimsms")}
                    className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    MIM SMS (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("ssl_wireless")}
                    className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    SSL Wireless
                  </button>
                </div>
              </div>

              {/* 1. API Key Field */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  1. Provider API Key *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    required
                    value={gatewayConfig.apiKey}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, apiKey: e.target.value })}
                    placeholder="e.g. 48673a5a87b1c4e92... (paste your API key here)"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm font-mono text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Provided in your SMS account dashboard (e.g. from sms.net.bd / developer settings).
                </p>
              </div>

              {/* 2. Call Type Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  2. HTTP Call Type / Request Method *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "GET", label: "GET (URL Parameters)", hint: "Standard for sms.net.bd" },
                    { id: "POST_FORM", label: "POST (Form UrlEncoded)", hint: "Traditional form post" },
                    { id: "POST_JSON", label: "POST (JSON Body)", hint: "Modern REST API" },
                  ].map((ct) => (
                    <label
                      key={ct.id}
                      className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                        gatewayConfig.callType === ct.id
                          ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold shadow-sm"
                          : "border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="callType"
                          checked={gatewayConfig.callType === ct.id}
                          onChange={() => setGatewayConfig({ ...gatewayConfig, callType: ct.id as any })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="text-xs">{ct.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 mt-1 ml-6">{ct.hint}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Drag & Drop Tokens */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 rounded-2xl border border-indigo-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    3. Draggable Variables (Drag into URL or Click to Append):
                  </span>
                  <span className="text-[11px] text-indigo-700 font-medium">Drag & drop anywhere into the input below</span>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {[
                    { token: "{msg}", label: "Message Content", desc: "Encoded SMS text" },
                    { token: "{to}", label: "Phone Number", desc: "Recipient mobile" },
                    { token: "{api_key}", label: "API Key", desc: "Your auth token" },
                  ].map((item) => (
                    <div
                      key={item.token}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.token)}
                      onClick={() => insertTokenIntoUrl(item.token)}
                      className="px-3 py-2 bg-white border-2 border-indigo-400 hover:border-indigo-600 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex items-center gap-2 group"
                    >
                      <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {item.token}
                      </span>
                      <span className="text-xs font-bold text-gray-800">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. URL Pattern / Endpoint Drop Target */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700">
                    4. Gateway URL Template (Drop target) *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setGatewayConfig({
                        ...gatewayConfig,
                        urlTemplate: "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}",
                      })
                    }
                    className="text-[11px] text-indigo-600 font-bold hover:underline"
                  >
                    Reset to sms.net.bd default
                  </button>
                </div>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropToken}
                  className="relative group"
                >
                  <input
                    ref={urlTemplateInputRef}
                    type="text"
                    required
                    value={gatewayConfig.urlTemplate}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, urlTemplate: e.target.value })}
                    placeholder="https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}"
                    className="w-full px-4 py-3 bg-white border-2 border-indigo-300 group-hover:border-indigo-500 rounded-xl font-mono text-xs text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 shadow-sm transition-all"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Ensure <code className="font-bold text-gray-600">{"{api_key}"}</code>, <code className="font-bold text-gray-600">{"{msg}"}</code>, and <code className="font-bold text-gray-600">{"{to}"}</code> placeholders are positioned where your provider requires them.
                </p>
              </div>

              {/* Live Assembled URL Preview */}
              <div className="p-4 bg-slate-900 rounded-xl text-slate-300 font-mono text-xs space-y-1 overflow-x-auto border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-sans font-bold">
                  Live Request Sample Preview
                </p>
                <p className="text-emerald-400 break-all">
                  {gatewayConfig.callType === "GET"
                    ? gatewayConfig.urlTemplate
                        .replace(/\{api_key\}|\{API_KEY\}/g, gatewayConfig.apiKey || "YOUR_API_KEY")
                        .replace(/\{msg\}|\{MSG\}/g, "Hello%20MedhaShiree")
                        .replace(/\{to\}|\{TO\}/g, "8801800000000")
                    : `[${gatewayConfig.callType}] ${gatewayConfig.urlTemplate} (payload: api_key, msg, to)`}
                </p>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={savingGateway}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400 cursor-pointer"
              >
                {savingGateway ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving Gateway Configuration...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Save Gateway Configuration & Activate
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Gateway Status & Live Test Sender */}
          <div className="lg:col-span-4 space-y-6">
            {/* Setup Status Checklist */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Gateway Readiness Checklist
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  {gatewayConfig.apiKey ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className={gatewayConfig.apiKey ? "text-gray-800 font-bold" : "text-gray-400"}>
                    API Key Entered
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {gatewayConfig.urlTemplate.includes("{msg}") || gatewayConfig.urlTemplate.includes("{MSG}") ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span
                    className={
                      gatewayConfig.urlTemplate.includes("{msg}") || gatewayConfig.urlTemplate.includes("{MSG}")
                        ? "text-gray-800 font-bold"
                        : "text-gray-400"
                    }
                  >
                    Message Token {"{msg}"} Configured
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {gatewayConfig.urlTemplate.includes("{to}") || gatewayConfig.urlTemplate.includes("{TO}") ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span
                    className={
                      gatewayConfig.urlTemplate.includes("{to}") || gatewayConfig.urlTemplate.includes("{TO}")
                        ? "text-gray-800 font-bold"
                        : "text-gray-400"
                    }
                  >
                    Phone Token {"{to}"} Configured
                  </span>
                </div>
              </div>

              {isGatewayReady ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-medium">
                  ✓ Setup complete! You can now send single or bulk SMS anytime.
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                  Please complete the checklist to enable SMS dispatching.
                </div>
              )}
            </div>

            {/* Test Gateway Sender Tool */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3.5">
              <h3 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                Live Test SMS Sender
              </h3>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Test Recipient Phone</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. 01800000000 or 88018..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono text-gray-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={testingGateway || !testPhone.trim() || !gatewayConfig.apiKey}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:bg-gray-300 cursor-pointer"
              >
                {testingGateway ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending Test...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Dispatch Test SMS
                  </>
                )}
              </button>

              {testResult && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-xs">
                  <p className="font-bold text-gray-800">Gateway Response:</p>
                  <pre className="text-[11px] font-mono text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-32">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DELIVERY LOGS & SMS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
            <div>
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                Recent Message Delivery Logs
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time status of messages dispatched through the system</p>
            </div>
            <button
              onClick={refreshLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-bold">
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Message Snippet</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{log.to_phone}</td>
                    <td className="px-4 py-3 max-w-md truncate text-gray-700 font-medium">{log.message}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-semibold uppercase">
                        {log.type || "bulk"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          log.status === "sent"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : log.status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {log.status === "sent" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : log.status === "pending" ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      No SMS delivery logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRM BULK SEND MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                Confirm Bulk SMS Dispatch
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="p-3 bg-indigo-50/70 rounded-xl space-y-1.5 text-indigo-900">
                <div className="flex justify-between">
                  <span>Total Recipients:</span>
                  <strong className="text-sm font-black">{resolvedRecipients.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Estimated SMS Parts:</span>
                  <strong className="text-sm font-black">{resolvedRecipients.length * smsStats.parts}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Target Destination:</span>
                  <strong className="font-bold">{targetPhoneType.toUpperCase()}</strong>
                </div>
              </div>

              <div>
                <p className="font-bold text-gray-800 mb-1">Message Preview:</p>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-medium max-h-36 overflow-y-auto">
                  {sampleMessagePreview}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkSend}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Start Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SENDING PROGRESS MODAL */}
      {sending && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-gray-100">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-black text-gray-900">Dispatching Messages...</h3>
              <p className="text-xs text-gray-500 mt-1">
                Please keep this window open while sending.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${sendProgress.total ? (sendProgress.current / sendProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 font-mono font-bold">
                <span>
                  {sendProgress.current} / {sendProgress.total} Sent
                </span>
                <span className="text-emerald-600">✓ {sendProgress.success}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
