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
  RefreshCw,
  FileText,
  Check,
  X,
  ShieldCheck,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  PhoneCall,
  Link2,
  Copy,
  Trophy,
  GripVertical,
  Award,
} from "lucide-react"
import { getGrade, cn } from "@/lib/utils"
import { useBranch } from "@/components/providers/BranchContext"

interface ExamItem {
  id: string
  title: string
  subject?: string
  total_marks: number
  pass_marks: number
  exam_date?: string
  batch_id?: string
  batch?: { id: string; name: string }
}

interface ExamStudentRow {
  id: string
  student_id: string
  name: string
  phone: string | null
  guardian_phone: string | null
  obtainedMarks: number | string | null
  grade: string | null
  rank: number | null
}

interface Student {
  id: string
  name: string
  student_id: string
  phone: string | null
  guardian_phone: string | null
  guardian_name: string | null
  is_active?: boolean | null
  batch_id?: string | null
  enrollments?: Array<{ batch_id: string; status?: string }>
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

interface ParamItem {
  id: string
  key: string
  value: string
  description?: string
  isStandard?: boolean
}

interface GatewayConfig {
  apiKey: string
  callType: "GET" | "POST_FORM" | "POST_JSON"
  baseUrl: string
  urlTemplate: string
  params: ParamItem[]
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
  const { selectedBranchId, branches, currentBranch } = useBranch()

  // Navigation Tabs: "compose" | "gateway" | "logs"
  const [activeTab, setActiveTab] = useState<"compose" | "gateway" | "logs">("compose")

  // Core Data
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [dues, setDues] = useState<DueRecord[]>([])
  const [logs, setLogs] = useState<SmsLog[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // ==========================================
  // GATEWAY & API BUILDER STATE
  // ==========================================
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
    apiKey: "",
    callType: "GET",
    baseUrl: "https://api.sms.net.bd/sendsms",
    urlTemplate: "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={msg}&to={to}",
    params: [
      { id: "p1", key: "api_key", value: "{api_key}", description: "Your API Key / Secret Token", isStandard: true },
      { id: "p2", key: "msg", value: "{msg}", description: "URL-encoded SMS text content", isStandard: true },
      { id: "p3", key: "to", value: "{to}", description: "Recipient mobile number", isStandard: true },
    ],
    senderId: "",
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingGateway, setSavingGateway] = useState(false)
  const [testingGateway, setTestingGateway] = useState(false)
  const [testPhone, setTestPhone] = useState("")
  const [testResult, setTestResult] = useState<any>(null)
  const [hasMissingTable, setHasMissingTable] = useState(false)

  // Drag over target tracking
  const [activeDragSlot, setActiveDragSlot] = useState<string | null>(null)

  // ==========================================
  // AUDIENCE TARGET SELECTION STATE
  // ==========================================
  // "all" | "batch" | "due" | "exam_result" | "custom_picker" | "direct_numbers" | "csv"
  const [targetType, setTargetType] = useState<"all" | "batch" | "due" | "exam_result" | "custom_picker" | "direct_numbers" | "csv">("all")
  const [targetPhoneType, setTargetPhoneType] = useState<"guardian" | "student" | "both">("guardian")

  // Batch Filter
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])

  // Exam Results Filter & Selection
  const [exams, setExams] = useState<ExamItem[]>([])
  const [selectedExamId, setSelectedExamId] = useState<string>("")
  const [examStudents, setExamStudents] = useState<ExamStudentRow[]>([])
  const [selectedExamStudentIds, setSelectedExamStudentIds] = useState<string[]>([])
  const [loadingExamData, setLoadingExamData] = useState(false)
  const [isDraggingOverTextarea, setIsDraggingOverTextarea] = useState(false)
  const [previewRecipientIndex, setPreviewRecipientIndex] = useState(0)

  // Custom Student Picker Filter & Checkbox Selection
  const [pickerSearchQuery, setPickerSearchQuery] = useState("")
  const [pickerBatchFilter, setPickerBatchFilter] = useState<string>("all")
  const [customSelectedStudentIds, setCustomSelectedStudentIds] = useState<string[]>([])

  // Direct Custom Numbers
  const [directNumbersText, setDirectNumbersText] = useState("")

  // CSV Upload
  const [csvRecipients, setCsvRecipients] = useState<CsvRecipient[]>([])
  const [csvFileName, setCsvFileName] = useState("")

  // ==========================================
  // COMPOSE & DISPATCH STATE
  // ==========================================
  const [message, setMessage] = useState("")
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [sending, setSending] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })

  // Clean Base URL helper (strips query parameters if pasted by user)
  function cleanBaseUrl(url: string) {
    if (!url) return ""
    return url.split("?")[0].trim()
  }

  // Synchronize urlTemplate when baseUrl or params change
  function syncUrlTemplate(base: string, paramsList: ParamItem[]) {
    const cleanBase = cleanBaseUrl(base)
    if (!cleanBase) return ""
    const queryString = paramsList
      .filter((p) => p.key.trim().length > 0)
      .map((p) => `${encodeURIComponent(p.key.trim())}=${p.value || ""}`)
      .join("&")
    return queryString ? `${cleanBase}?${queryString}` : cleanBase
  }

  // 1. Load Data on Mount
  useEffect(() => {
    // 1a. Load from localStorage cache immediately
    try {
      const cached = localStorage.getItem("medhashiree_sms_gateway_config")
      if (cached) {
        const parsed = JSON.parse(cached)
        const base = cleanBaseUrl(parsed.baseUrl || "https://api.sms.net.bd/sendsms")
        const params = parsed.params?.length ? parsed.params : []
        setGatewayConfig((prev) => ({
          ...prev,
          ...parsed,
          baseUrl: base,
          urlTemplate: parsed.urlTemplate ? syncUrlTemplate(base, params) : prev.urlTemplate,
        }))
      }
    } catch (e) {
      console.warn("Could not read local gateway config:", e)
    }

    async function loadAll() {
      try {
        // 1. Batches
        const batchesRes = await supabase.from("batches").select("id, name, current_seats, subject")
        if (batchesRes.data) setBatches(batchesRes.data)

        // 2. Enrollments (with student info joined)
        let loadedEnrollments: any[] = []
        try {
          const enrollRes = await supabase
            .from("enrollments")
            .select("student_id, batch_id, status, student:students(id, name, student_id, phone, guardian_phone, guardian_name, is_active)")
          if (enrollRes.data) loadedEnrollments = enrollRes.data
        } catch {
          const fallbackEnroll = await supabase.from("enrollments").select("student_id, batch_id, status")
          if (fallbackEnroll.data) loadedEnrollments = fallbackEnroll.data
        }

        // 3. Students (without non-existent batch_id column)
        let loadedStudents: Student[] = []
        try {
          const studentsRes = await supabase
            .from("students")
            .select("id, name, student_id, phone, guardian_phone, guardian_name, is_active")
          if (studentsRes.data) {
            loadedStudents = studentsRes.data.filter((s: any) => s.is_active !== false)
          }
        } catch (err) {
          console.warn("Students table query issue:", err)
        }

        // Cross-merge students from enrollments if missing from students query
        loadedEnrollments.forEach((en: any) => {
          if (en.student && !loadedStudents.some((s) => s.id === en.student.id)) {
            if (en.student.is_active !== false) {
              loadedStudents.push(en.student)
            }
          }
        })

        setStudents(loadedStudents)
        setEnrollments(loadedEnrollments)

        // 4. Fee Dues
        try {
          const duesRes = await supabase
            .from("fee_dues")
            .select("id, student_id, due_amount, due_month, status, student:students(id, name, student_id, phone, guardian_phone)")
            .eq("status", "pending")
          if (duesRes.data) setDues(duesRes.data as any)
        } catch (e) {
          console.warn("Fee dues query issue:", e)
        }

        // 5. Site Settings (SMS Gateway)
        try {
          const settingsRes = await supabase
            .from("site_settings")
            .select("value")
            .eq("key", "sms_gateway_config")
            .maybeSingle()

          if (settingsRes?.error) {
            if (settingsRes.error.message?.includes("site_settings") || settingsRes.error.code === "PGRST205") {
              setHasMissingTable(true)
            }
          } else if (settingsRes?.data?.value) {
            setHasMissingTable(false)
            try {
              const parsed = JSON.parse(settingsRes.data.value)
              const base = cleanBaseUrl(parsed.baseUrl || "https://api.sms.net.bd/sendsms")
              const params = parsed.params?.length ? parsed.params : []
              setGatewayConfig((prev) => ({
                ...prev,
                ...parsed,
                baseUrl: base,
                urlTemplate: syncUrlTemplate(base, params.length ? params : prev.params),
                params: params.length ? params : prev.params,
              }))
            } catch (e) {
              console.error("Failed to parse gateway config from database:", e)
            }
          }
        } catch (e) {
          console.warn("Site settings query issue:", e)
        }

        // 6. SMS Queue logs
        try {
          const logsRes = await supabase.from("sms_queue").select("*").order("created_at", { ascending: false }).limit(40)
          if (logsRes.data) setLogs(logsRes.data)
        } catch (e) {
          console.warn("SMS queue query issue:", e)
        }

        // 7. Exams list
        try {
          const { data: exList } = await supabase
            .from("exams")
            .select("*, batch:batches(id, name)")
            .order("created_at", { ascending: false })
          if (exList) setExams(exList)
        } catch (e) {
          console.warn("Exams query issue in SMS page:", e)
        }

        // 8. Check URL parameters for direct exam result mode
        try {
          if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search)
            const examId = urlParams.get("exam_id")
            const mode = urlParams.get("mode")
            if (examId || mode === "exam_result") {
              setActiveTab("compose")
              setTargetType("exam_result")
              if (examId) setSelectedExamId(examId)
            }
          }
        } catch {}
      } catch (err: any) {
        console.warn("SMS data load issue:", err)
      } finally {
        setLoadingData(false)
      }
    }
    loadAll()
  }, [supabase])

  // Load Exam Students and Exam Results when selectedExamId changes
  useEffect(() => {
    if (!selectedExamId) {
      setExamStudents([])
      setSelectedExamStudentIds([])
      return
    }

    let isCancelled = false

    async function loadExamData() {
      setLoadingExamData(true)
      try {
        let currentExam = exams.find((e) => e.id === selectedExamId)
        if (!currentExam) {
          const { data: exData } = await supabase
            .from("exams")
            .select("*, batch:batches(id, name)")
            .eq("id", selectedExamId)
            .single()
          if (exData) {
            currentExam = exData
            setExams((prev) => (prev.some((e) => e.id === exData.id) ? prev : [exData, ...prev]))
          }
        }

        const batchId = currentExam?.batch_id
        let studentList: Student[] = []

        if (batchId) {
          const { data: enrs } = await supabase
            .from("enrollments")
            .select("student:students(id, name, student_id, phone, guardian_phone, is_active)")
            .eq("batch_id", batchId)
            .eq("status", "active")
          studentList = (enrs || [])
            .map((e: any) => e.student)
            .filter((s: any) => s && s.is_active !== false)
        } else {
          studentList = students.filter((s) => s.is_active !== false)
        }

        // Fetch exam results
        const { data: resultsData } = await supabase
          .from("exam_results")
          .select("*")
          .eq("exam_id", selectedExamId)

        // Fetch online submissions if any
        const { data: subsData } = await supabase
          .from("exam_submissions")
          .select("*")
          .eq("exam_id", selectedExamId)
          .eq("is_submitted", true)

        const resultMap = new Map<string, any>()
        resultsData?.forEach((r) => resultMap.set(r.student_id, r))
        subsData?.forEach((s) => {
          if (!resultMap.has(s.student_id)) {
            resultMap.set(s.student_id, {
              obtained_marks: s.total_obtained,
              grade: "",
            })
          }
        })

        const rows: ExamStudentRow[] = studentList.map((s) => {
          const r = resultMap.get(s.id)
          const rawMark = r?.obtained_marks
          const numMark = rawMark !== undefined && rawMark !== null && rawMark !== "" ? Number(rawMark) : null
          const totalM = currentExam?.total_marks || 100
          const calcGrade = r?.grade || (numMark !== null ? getGrade(numMark, totalM) : null)
          return {
            id: s.id,
            student_id: s.student_id,
            name: s.name,
            phone: s.phone,
            guardian_phone: s.guardian_phone,
            obtainedMarks: numMark,
            grade: calcGrade,
            rank: null,
          }
        })

        // Rank students with valid numeric marks descending (highest to lowest)
        const scoredStudents = [...rows]
          .filter((s) => s.obtainedMarks !== null && !isNaN(s.obtainedMarks as number))
          .sort((a, b) => (b.obtainedMarks as number) - (a.obtainedMarks as number))

        const rankMap = new Map<string, number>()
        scoredStudents.forEach((st, idx) => rankMap.set(st.id, idx + 1))

        const finalRows = rows.map((s) => ({
          ...s,
          rank: rankMap.get(s.id) || null,
        }))

        if (!isCancelled) {
          setExamStudents(finalRows)
          // Default: select all students of the exam!
          setSelectedExamStudentIds(finalRows.map((s) => s.id))

          // Auto-write default exam result SMS message if currently blank or generic
          setMessage((prev) => {
            if (!prev.trim() || prev.includes("pending fee due") || prev.includes("classes for") || prev.includes("Type your SMS")) {
              return "Dear Guardian, {{name}} (ID: {{student_id}}) has obtained {{number}}/{{total_marks}} marks in {{exam_title}} (Batch: {{batch}}). Grade: {{grade}}, Merit Rank: {{rank}}. - MedhaShiree"
            }
            return prev
          })
        }
      } catch (err) {
        console.error("Failed to load exam student results:", err)
      } finally {
        if (!isCancelled) setLoadingExamData(false)
      }
    }

    loadExamData()
    return () => {
      isCancelled = true
    }
  }, [selectedExamId, exams, students, supabase])

  // Check if navigating from Students page with pre-selected students
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sms_selected_student_ids")
      const searchParams = new URLSearchParams(window.location.search)
      const targetParam = searchParams.get("target")

      let idsToSelect: string[] = []
      if (stored) {
        try {
          idsToSelect = JSON.parse(stored)
        } catch {
          idsToSelect = stored.split(",").filter(Boolean)
        }
        sessionStorage.removeItem("sms_selected_student_ids")
      } else if (searchParams.get("student_ids")) {
        idsToSelect = (searchParams.get("student_ids") || "").split(",").filter(Boolean)
      }

      if (idsToSelect.length > 0 || targetParam === "custom_picker") {
        setActiveTab("compose")
        setTargetType("custom_picker")
        if (idsToSelect.length > 0) {
          setCustomSelectedStudentIds(idsToSelect)
          toast.success(`✓ Loaded ${idsToSelect.length} selected students from Students page!`, {
            description: "Review recipients and type your message below to send.",
          })
        }
      }
    } catch (e) {
      console.warn("Could not parse transferred sms student ids:", e)
    }
  }, [])

  // Update a parameter key
  function updateParamKey(id: string, newKey: string) {
    const updated = gatewayConfig.params.map((p) => (p.id === id ? { ...p, key: newKey } : p))
    const newTemplate = syncUrlTemplate(gatewayConfig.baseUrl, updated)
    setGatewayConfig({ ...gatewayConfig, params: updated, urlTemplate: newTemplate })
  }

  // Assign token to parameter slot (via drop or click)
  function assignTokenToParam(paramId: string, token: string) {
    const updated = gatewayConfig.params.map((p) => (p.id === paramId ? { ...p, value: token } : p))
    const newTemplate = syncUrlTemplate(gatewayConfig.baseUrl, updated)
    setGatewayConfig({ ...gatewayConfig, params: updated, urlTemplate: newTemplate })
    toast.success(`Assigned ${token} token`)
  }

  // Add a new custom parameter
  function addCustomParam() {
    const newId = "param_" + Date.now()
    const updated = [...gatewayConfig.params, { id: newId, key: "custom_key", value: "value", isStandard: false }]
    const newTemplate = syncUrlTemplate(gatewayConfig.baseUrl, updated)
    setGatewayConfig({ ...gatewayConfig, params: updated, urlTemplate: newTemplate })
    toast.info("Added custom parameter slot")
  }

  // Remove a parameter
  function removeParam(id: string) {
    const updated = gatewayConfig.params.filter((p) => p.id !== id)
    const newTemplate = syncUrlTemplate(gatewayConfig.baseUrl, updated)
    setGatewayConfig({ ...gatewayConfig, params: updated, urlTemplate: newTemplate })
  }

  // Apply Quick Gateway Preset
  function applyGatewayPreset(preset: "sms_net_bd" | "greenweb" | "mimsms" | "ssl_wireless") {
    if (preset === "sms_net_bd") {
      const base = "https://api.sms.net.bd/sendsms"
      const paramsList: ParamItem[] = [
        { id: "p1", key: "api_key", value: "{api_key}", description: "sms.net.bd API Key", isStandard: true },
        { id: "p2", key: "msg", value: "{msg}", description: "Encoded SMS message", isStandard: true },
        { id: "p3", key: "to", value: "{to}", description: "Recipient (88018...)", isStandard: true },
      ]
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "GET",
        baseUrl: base,
        params: paramsList,
        urlTemplate: syncUrlTemplate(base, paramsList),
        senderId: "",
      })
      toast.success("Applied sms.net.bd preset (GET)")
    } else if (preset === "greenweb") {
      const base = "http://api.greenweb.com.bd/api.php"
      const paramsList: ParamItem[] = [
        { id: "p1", key: "token", value: "{api_key}", description: "Greenweb Token", isStandard: true },
        { id: "p2", key: "message", value: "{msg}", description: "SMS text", isStandard: true },
        { id: "p3", key: "to", value: "{to}", description: "Mobile number", isStandard: true },
      ]
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "GET",
        baseUrl: base,
        params: paramsList,
        urlTemplate: syncUrlTemplate(base, paramsList),
        senderId: "",
      })
      toast.success("Applied Greenweb BD preset")
    } else if (preset === "mimsms") {
      const base = "https://api.mimsms.com/api/v3/send-sms"
      const paramsList: ParamItem[] = [
        { id: "p1", key: "api_key", value: "{api_key}", description: "MIM SMS Key", isStandard: true },
        { id: "p2", key: "msg", value: "{msg}", description: "SMS text", isStandard: true },
        { id: "p3", key: "to", value: "{to}", description: "Recipient", isStandard: true },
      ]
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "POST_JSON",
        baseUrl: base,
        params: paramsList,
        urlTemplate: base,
        senderId: "",
      })
      toast.success("Applied MIM SMS preset (POST JSON)")
    } else if (preset === "ssl_wireless") {
      const base = "http://sms.sslwireless.com/pushapi/dynamic/server.php"
      const paramsList: ParamItem[] = [
        { id: "p1", key: "api_token", value: "{api_key}", description: "SSL Wireless API Token", isStandard: true },
        { id: "p2", key: "sms", value: "{msg}", description: "SMS text", isStandard: true },
        { id: "p3", key: "msisdn", value: "{to}", description: "Recipient Phone", isStandard: true },
      ]
      setGatewayConfig({
        apiKey: gatewayConfig.apiKey,
        callType: "POST_FORM",
        baseUrl: base,
        params: paramsList,
        urlTemplate: base,
        senderId: "",
      })
      toast.success("Applied SSL Wireless preset (POST Form)")
    }
  }

  const SITE_SETTINGS_SQL = `-- Run this in your Supabase Project -> SQL Editor -> Run:
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Public read settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage settings" ON public.site_settings;
CREATE POLICY "Staff manage settings" ON public.site_settings FOR ALL USING (true);`

  // Save Gateway Configuration
  async function handleSaveGateway(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!gatewayConfig.apiKey.trim()) {
      toast.error("Please enter your SMS Gateway API Key")
      return
    }

    const hasMsg = gatewayConfig.params.some((p) => p.value === "{msg}") || gatewayConfig.urlTemplate.includes("{msg}")
    const hasTo = gatewayConfig.params.some((p) => p.value === "{to}") || gatewayConfig.urlTemplate.includes("{to}")

    if (!hasMsg) {
      toast.error("Please assign the {msg} token to your message parameter")
      return
    }
    if (!hasTo) {
      toast.error("Please assign the {to} token to your phone number parameter")
      return
    }

    setSavingGateway(true)

    // 1. ALWAYS persist to browser localStorage first so it works immediately
    try {
      localStorage.setItem("medhashiree_sms_gateway_config", JSON.stringify(gatewayConfig))
    } catch (e) {
      console.warn("Could not save to localStorage:", e)
    }

    // 2. Attempt to save to Supabase site_settings
    let savedToCloud = false
    let isTableMissing = false

    try {
      const { error } = await supabase.from("site_settings").upsert({
        key: "sms_gateway_config",
        value: JSON.stringify(gatewayConfig),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        if (error.message?.includes("site_settings") || error.code === "PGRST205" || (error as any).status === 404) {
          isTableMissing = true
        } else {
          console.warn("Cloud save error:", error)
        }
      } else {
        savedToCloud = true
      }
    } catch (err: any) {
      if (err?.message?.includes("site_settings") || err?.code === "PGRST205") {
        isTableMissing = true
      }
    } finally {
      setSavingGateway(false)
    }

    if (savedToCloud) {
      setHasMissingTable(false)
      toast.success("✓ SMS Gateway saved & synced to Supabase! All messaging options are active.")
    } else if (isTableMissing) {
      setHasMissingTable(true)
      toast.success("✓ Gateway saved locally and ACTIVE! You can now send SMS.", { duration: 5000 })
      toast.info("Database table 'site_settings' not created yet. See SQL script below to sync cloud.", { duration: 8000 })
    } else {
      toast.success("✓ Gateway configuration saved locally and active.")
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
        toast.error(`Test failed: ${data.error || "Gateway returned an error"}`)
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

  // Gateway Readiness Indicator
  const isGatewayReady = useMemo(() => {
    const hasKey = Boolean(gatewayConfig.apiKey && gatewayConfig.apiKey.trim().length > 0)
    const hasMsg = gatewayConfig.params.some((p) => p.value === "{msg}") || gatewayConfig.urlTemplate.includes("{msg}")
    const hasTo = gatewayConfig.params.some((p) => p.value === "{to}") || gatewayConfig.urlTemplate.includes("{to}")
    return hasKey && hasMsg && hasTo
  }, [gatewayConfig])

  // ==========================================
  // AUDIENCE RESOLUTION LOGIC
  // ==========================================
  interface ResolvedRecipient {
    phone: string
    name: string
    studentId?: string
    batchName?: string
    dueAmount?: number
    examTitle?: string
    obtainedMarks?: number | string
    totalMarks?: number | string
    grade?: string
    rank?: number | string
  }

  // Parse Direct Custom Numbers Textarea
  const parsedDirectNumbers = useMemo(() => {
    if (!directNumbersText.trim()) return []
    // Split by commas, semicolons, whitespace, or newlines
    const rawTokens = directNumbersText.split(/[,;\s\n\r]+/).filter(Boolean)
    const valid: string[] = []
    for (const t of rawTokens) {
      const clean = t.replace(/[^0-9]/g, "")
      if (clean.length >= 10 && clean.length <= 14) {
        valid.push(clean)
      }
    }
    return Array.from(new Set(valid))
  }, [directNumbersText])

  // Filtered Students in the Custom Student Picker
  const filteredStudentsInPicker = useMemo(() => {
    return students.filter((s) => {
      // 1. Batch filter
      if (pickerBatchFilter !== "all") {
        const isEnrolled = enrollments.some((e) => e.student_id === s.id && e.batch_id === pickerBatchFilter)
        if (!isEnrolled && s.batch_id !== pickerBatchFilter) return false
      }
      // 2. Search query
      const q = pickerSearchQuery.trim().toLowerCase()
      if (q) {
        const nameMatch = (s.name || "").toLowerCase().includes(q)
        const idMatch = (s.student_id || "").toLowerCase().includes(q)
        const phoneMatch = (s.phone || "").includes(q)
        const gPhoneMatch = (s.guardian_phone || "").includes(q)
        if (!nameMatch && !idMatch && !phoneMatch && !gPhoneMatch) return false
      }
      return true
    })
  }, [students, pickerBatchFilter, pickerSearchQuery, enrollments])

  // CSV File Handler
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

      const headerLine = lines[0].toLowerCase()
      const isHeader =
        headerLine.includes("phone") ||
        headerLine.includes("mobile") ||
        headerLine.includes("number") ||
        headerLine.includes("name")

      const dataLines = isHeader ? lines.slice(1) : lines
      const parsed: CsvRecipient[] = []

      for (const line of dataLines) {
        const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ""))
        let phone = ""
        let name = ""

        if (parts.length === 1) {
          phone = parts[0]
        } else if (parts.length >= 2) {
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
          parsed.push({ phone, name: name || undefined, isValid })
        }
      }

      setCsvRecipients(parsed)
      toast.success(`Loaded ${parsed.length} contacts (${parsed.filter((p) => p.isValid).length} valid numbers)`)
    }

    reader.readAsText(file)
  }

  // Complete Resolved Audience List
  const resolvedRecipients: ResolvedRecipient[] = useMemo(() => {
    const list: ResolvedRecipient[] = []

    function addStudentPhones(s: Student, dueAmt?: number, bName?: string) {
      const phonesToAdd: string[] = []
      if (targetPhoneType === "guardian" || targetPhoneType === "both") {
        if (s.guardian_phone) phonesToAdd.push(s.guardian_phone)
      }
      if (targetPhoneType === "student" || targetPhoneType === "both") {
        if (s.phone) phonesToAdd.push(s.phone)
      }
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
      students.forEach((s) => addStudentPhones(s))
    } else if (targetType === "batch") {
      if (selectedBatchIds.length === 0) return []
      const enrolledStudentIds = new Set(
        enrollments.filter((e) => selectedBatchIds.includes(e.batch_id)).map((e) => e.student_id)
      )
      students.filter((s) => enrolledStudentIds.has(s.id)).forEach((s) => {
        const batchId = enrollments.find((e) => e.student_id === s.id && selectedBatchIds.includes(e.batch_id))?.batch_id
        const batchObj = batches.find((b) => b.id === batchId)
        addStudentPhones(s, undefined, batchObj?.name)
      })

      // Also ensure students loaded directly inside enrollments are included
      enrollments.forEach((e) => {
        if (selectedBatchIds.includes(e.batch_id) && e.student) {
          const alreadyAdded = list.some((item) => item.studentId === e.student?.student_id)
          if (!alreadyAdded) {
            const batchObj = batches.find((b) => b.id === e.batch_id)
            addStudentPhones(e.student, undefined, batchObj?.name)
          }
        }
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
          addStudentPhones(sObj, d.due_amount, d.due_month)
        }
      })
    } else if (targetType === "exam_result") {
      const selectedEx = exams.find((e) => e.id === selectedExamId)
      const selectedStudents = examStudents.filter((s) => selectedExamStudentIds.includes(s.id))

      selectedStudents.forEach((s) => {
        const phonesToAdd: string[] = []
        if (targetPhoneType === "guardian" || targetPhoneType === "both") {
          if (s.guardian_phone) phonesToAdd.push(s.guardian_phone)
        }
        if (targetPhoneType === "student" || targetPhoneType === "both") {
          if (s.phone) phonesToAdd.push(s.phone)
        }
        if (phonesToAdd.length === 0) {
          if (s.guardian_phone) phonesToAdd.push(s.guardian_phone)
          else if (s.phone) phonesToAdd.push(s.phone)
        }

        for (const ph of phonesToAdd) {
          list.push({
            phone: ph,
            name: s.name,
            studentId: s.student_id,
            batchName: selectedEx?.batch?.name || "All Batches",
            examTitle: selectedEx?.title || "Exam",
            obtainedMarks: s.obtainedMarks !== null ? s.obtainedMarks : "N/A",
            totalMarks: selectedEx?.total_marks || 100,
            grade: s.grade || "N/A",
            rank: s.rank ? `#${s.rank}` : "N/A",
          })
        }
      })
    } else if (targetType === "custom_picker") {
      const selected = students.filter((s) => customSelectedStudentIds.includes(s.id))
      selected.forEach((s) => addStudentPhones(s))
    } else if (targetType === "direct_numbers") {
      parsedDirectNumbers.forEach((num, idx) => {
        list.push({
          phone: num,
          name: `Recipient ${idx + 1}`,
        })
      })
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

    // Deduplicate and filter out invalid short numbers
    const seen = new Set<string>()
    return list.filter((item) => {
      const clean = item.phone.replace(/[^0-9]/g, "")
      // Valid Bangladeshi numbers have at least 10 or 11 digits (e.g. 01XXXXXXXXX)
      if (!clean || clean.length < 10 || seen.has(clean)) return false
      seen.add(clean)
      return true
    })
  }, [
    targetType,
    targetPhoneType,
    students,
    batches,
    enrollments,
    selectedBatchIds,
    dues,
    exams,
    selectedExamId,
    examStudents,
    selectedExamStudentIds,
    customSelectedStudentIds,
    parsedDirectNumbers,
    csvRecipients,
  ])

  // Message length & SMS Parts
  const smsStats = useMemo(() => {
    const len = message.length
    const isUnicode = /[^\u0000-\u007F]/.test(message)
    const charLimit = isUnicode ? 70 : 160
    const multiLimit = isUnicode ? 67 : 153

    let parts = 1
    if (len > charLimit) {
      parts = Math.ceil(len / multiLimit)
    }
    return { len, parts, isUnicode, charLimit }
  }, [message])

  // Insert merge tag into message
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
      label: "Exam Result (Full)",
      text: "Dear Guardian, {{name}} (ID: {{student_id}}) has obtained {{number}}/{{total_marks}} marks in {{exam_title}} (Batch: {{batch}}). Grade: {{grade}}, Merit Rank: {{rank}}. - MedhaShiree",
    },
    {
      label: "পরীক্ষার ফলাফল (বাংলা)",
      text: "অভিভাবক মহোদয়, আপনার সন্তান {{name}} (আইডি: {{student_id}}) {{exam_title}} পরীক্ষায় {{number}}/{{total_marks}} নম্বর পেয়েছে। মেধা স্থান: {{rank}}। - মেধাশিরী",
    },
    {
      label: "Exam Result (Short)",
      text: "Dear Guardian, {{name}} got {{number}}/{{total_marks}} in {{exam_title}}. Grade: {{grade}}. - MedhaShiree",
    },
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
      label: "General Notice",
      text: "Notice: Academic activities will remain closed on the upcoming public holiday. Regular classes will resume on Sunday. - MedhaShiree",
    },
  ]

  // Sample Preview text
  const sampleMessagePreview = useMemo(() => {
    if (!message) return "Your message preview will appear here..."
    const sample = resolvedRecipients[previewRecipientIndex] || resolvedRecipients[0] || {
      name: "Md Asikur Rahman",
      studentId: "MS-00007",
      batchName: "Physics 10 AM",
      dueAmount: 2500,
      examTitle: "Physics Term Exam",
      obtainedMarks: 85,
      totalMarks: 100,
      grade: "A+",
      rank: "#1",
    }
    let res = message
    res = res.replace(/\{\{name\}\}/gi, sample.name || "Student Name")
    res = res.replace(/\{\{student_id\}\}/gi, sample.studentId || "MS-00007")
    res = res.replace(/\{\{batch\}\}/gi, sample.batchName || "Batch Name")
    res = res.replace(/\{\{due_amount\}\}/gi, sample.dueAmount ? `৳${sample.dueAmount}` : "৳2,500")
    res = res.replace(/\{\{exam_title\}\}/gi, sample.examTitle || "Physics Exam")
    res = res.replace(/\{\{number\}\}|\{\{marks\}\}/gi, sample.obtainedMarks !== undefined && sample.obtainedMarks !== null ? String(sample.obtainedMarks) : "85")
    res = res.replace(/\{\{total_marks\}\}/gi, String(sample.totalMarks || "100"))
    res = res.replace(/\{\{grade\}\}/gi, sample.grade || "A+")
    res = res.replace(/\{\{rank\}\}/gi, sample.rank ? String(sample.rank) : "#1")
    res = res.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString("en-GB"))
    return res
  }, [message, resolvedRecipients, previewRecipientIndex])

  // Execute Bulk Dispatch
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
    let lastError = ""

    try {
      for (let i = 0; i < resolvedRecipients.length; i += batchSize) {
        const chunk = resolvedRecipients.slice(i, i + batchSize)

        const payloadRecipients = chunk.map((rec) => {
          let customMsg = message
          customMsg = customMsg.replace(/\{\{name\}\}/gi, rec.name || "Student")
          customMsg = customMsg.replace(/\{\{student_id\}\}/gi, rec.studentId || "")
          customMsg = customMsg.replace(/\{\{batch\}\}/gi, rec.batchName || "")
          customMsg = customMsg.replace(/\{\{due_amount\}\}/gi, rec.dueAmount ? `৳${rec.dueAmount}` : "")
          customMsg = customMsg.replace(/\{\{exam_title\}\}/gi, rec.examTitle || "")
          customMsg = customMsg.replace(/\{\{number\}\}|\{\{marks\}\}/gi, rec.obtainedMarks !== undefined && rec.obtainedMarks !== null ? String(rec.obtainedMarks) : "")
          customMsg = customMsg.replace(/\{\{total_marks\}\}/gi, rec.totalMarks ? String(rec.totalMarks) : "")
          customMsg = customMsg.replace(/\{\{grade\}\}/gi, rec.grade || "")
          customMsg = customMsg.replace(/\{\{rank\}\}/gi, rec.rank ? String(rec.rank) : "")
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
            configOverride: gatewayConfig,
            branchId: selectedBranchId !== "all" ? selectedBranchId : undefined,
          }),
        })

        const data = await res.json()
        if (data.sentCount) totalSuccess += data.sentCount
        if (data.failedCount) totalFailed += data.failedCount

        if (data.results && Array.isArray(data.results)) {
          const failItem = data.results.find((r: any) => !r.success)
          if (failItem?.error) lastError = failItem.error
        }
        if (!res.ok && data.error) {
          lastError = data.error
        }

        setSendProgress({
          current: Math.min(i + batchSize, resolvedRecipients.length),
          total: resolvedRecipients.length,
          success: totalSuccess,
          failed: totalFailed,
        })
      }

      if (totalSuccess > 0 && totalFailed === 0) {
        toast.success(`✓ Successfully sent ${totalSuccess} SMS!`)
      } else if (totalSuccess > 0 && totalFailed > 0) {
        toast.warning(`Sent ${totalSuccess} SMS, ${totalFailed} failed. (${lastError || "Gateway error"})`)
      } else {
        toast.error(`SMS send failed: ${lastError || "Gateway returned an error"}`)
      }
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white backdrop-blur-md p-5 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Bulk SMS Management
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Visual SMS Gateway builder and multi-mode student audience targeting
            </p>
          </div>
        </div>

        {/* Gateway Status Badge */}
        <div className="flex items-center gap-3">
          {isGatewayReady ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Gateway Connected & Active
            </div>
          ) : (
            <button
              onClick={() => setActiveTab("gateway")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-950/40 text-amber-300 border border-amber-800/50 text-xs font-bold hover:bg-amber-900/50 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Configure Gateway API Key
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("compose")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "compose"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Send className="w-4 h-4" /> Send Bulk SMS
        </button>

        <button
          onClick={() => setActiveTab("gateway")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "gateway"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Settings className="w-4 h-4" /> Gateway & API Settings
          {!isGatewayReady && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === "logs"
              ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-900 hover:bg-slate-100/80"
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
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  1. Select Target Audience
                </h2>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                  {resolvedRecipients.length} Recipient{resolvedRecipients.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Target Mode Navigation */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  { id: "all", label: "All Active", icon: Users },
                  { id: "batch", label: "Batch-wise", icon: Layers },
                  { id: "due", label: "Due Fees", icon: AlertTriangle },
                  { id: "exam_result", label: "Exam Results", icon: Trophy },
                  { id: "custom_picker", label: "Student Picker", icon: Search },
                  { id: "direct_numbers", label: "Custom Numbers", icon: PhoneCall },
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
                          ? "border-amber-500 bg-amber-500/15 text-amber-300 font-black shadow-sm"
                          : "border-slate-200 bg-slate-950 text-slate-400 hover:bg-slate-800/60 font-medium hover:text-slate-200"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                      <span className="text-[10px] leading-tight font-bold">{mode.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Phone Target Selector (Guardian vs Student) */}
              {targetType !== "csv" && targetType !== "direct_numbers" && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-400">Send To:</span>
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
                            ? "bg-amber-500 text-slate-950 shadow-sm"
                            : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: All Active */}
              {targetType === "all" && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-200">Targeting All Active Enrolled Students</p>
                  <p className="text-[11px] text-slate-400">
                    Total {students.length} active students enrolled in coaching.
                  </p>
                </div>
              )}

              {/* SUB-PANEL: Batch-wise */}
              {targetType === "batch" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400">Choose Batches:</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBatchIds.length === batches.length) setSelectedBatchIds([])
                        else setSelectedBatchIds(batches.map((b) => b.id))
                      }}
                      className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                    >
                      {selectedBatchIds.length === batches.length ? "Deselect All" : "Select All Batches"}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                    {batches.map((b) => {
                      const isChecked = selectedBatchIds.includes(b.id)
                      const count = enrollments.filter((e) => e.batch_id === b.id).length
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isChecked ? "bg-slate-800/80 border border-amber-500/40" : "hover:bg-slate-900"
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
                              className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-400 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-white">{b.name}</span>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-200 text-slate-400 font-mono font-bold">
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
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-300">
                      <p className="font-bold">Students with Outstanding Dues ({dues.length})</p>
                      <p className="text-[11px] text-amber-400/80 mt-0.5">
                        Use <code className="px-1 py-0.5 bg-amber-900/60 rounded font-mono font-bold text-amber-200">{"{{due_amount}}"}</code> in your message to automatically insert each student's exact owed amount!
                      </p>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-950">
                    {dues.map((d) => (
                      <div key={d.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{d.student?.name || "Student"}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            <span className="text-amber-400">{d.student?.student_id}</span> • Month: {d.due_month}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 bg-rose-950/50 text-rose-300 border border-rose-800/50 rounded-md font-bold text-xs">
                          ৳{d.due_amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: Exam Results */}
              {targetType === "exam_result" && (
                <div className="space-y-3">
                  <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl flex items-start gap-2.5">
                    <Trophy className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-purple-300 flex-1">
                      <p className="font-bold">Exam Results SMS Dispatch</p>
                      <p className="text-[11px] text-purple-400/80 mt-0.5">
                        Deliver individual student exam marks, grade, and merit rank directly to students and guardians.
                        Drag <code className="px-1 py-0.5 bg-purple-900/60 rounded font-mono font-bold text-purple-200">{"{{number}}"}</code> token into your message!
                      </p>
                    </div>
                  </div>

                  {/* Exam Selector Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Exam:</label>
                    <select
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400 shadow-sm"
                    >
                      <option value="">-- Choose an Exam --</option>
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} ({ex.batch?.name || "All Batches"} • {ex.total_marks} Marks)
                        </option>
                      ))}
                    </select>
                  </div>

                  {loadingExamData ? (
                    <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      Loading students and results for this exam...
                    </div>
                  ) : selectedExamId && examStudents.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs px-1">
                        <span className="text-slate-400 font-medium">
                          Total Students: <strong className="text-purple-400">{examStudents.length}</strong> • Selected:{" "}
                          <strong className="text-amber-400">{selectedExamStudentIds.length}</strong>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedExamStudentIds(examStudents.map((s) => s.id))}
                            className="text-amber-400 font-bold hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span className="text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedExamStudentIds([])}
                            className="text-rose-400 font-bold hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {/* Student Table with Draggable Number Badges */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-950 shadow-inner">
                        {examStudents.map((s) => {
                          const isSelected = selectedExamStudentIds.includes(s.id)
                          const selectedEx = exams.find((e) => e.id === selectedExamId)
                          return (
                            <div
                              key={s.id}
                              className={`p-2.5 flex items-center justify-between gap-2 transition-colors ${
                                isSelected ? "bg-slate-50" : "opacity-60 hover:bg-slate-900/40"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedExamStudentIds([...selectedExamStudentIds, s.id])
                                    else setSelectedExamStudentIds(selectedExamStudentIds.filter((id) => id !== s.id))
                                  }}
                                  className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-400 cursor-pointer shrink-0"
                                />
                                <div className="truncate">
                                  <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                    {s.name}
                                    {s.rank && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
                                        #{s.rank}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-400 font-mono">
                                    <span className="font-semibold text-amber-400">{s.student_id}</span> • G:{" "}
                                    {s.guardian_phone || "N/A"} • S: {s.phone || "N/A"}
                                  </p>
                                </div>
                              </div>

                              {/* Draggable Student Marks / Number */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", "{{number}}")
                                    toast.info(`Dragging {{number}} token for ${s.name}`)
                                  }}
                                  onClick={() => insertMergeTag("{{number}}")}
                                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono font-bold text-[11px] cursor-grab active:cursor-grabbing flex items-center gap-1 shadow-sm transition-all select-none"
                                  title="Drag this marks token into the message box (or click to insert)"
                                >
                                  <GripVertical className="w-3 h-3 text-amber-400" />
                                  {s.obtainedMarks !== null ? `${s.obtainedMarks}/${selectedEx?.total_marks || 100}` : "N/A"}
                                </span>
                                {s.grade && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 text-[10px] font-bold">
                                    {s.grade}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : selectedExamId ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-200">
                      No active students found in this exam's batch.
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-200">
                      Please select an exam above to load students and marks.
                    </div>
                  )}
                </div>
              )}

              {/* SUB-PANEL: CUSTOM STUDENT PICKER (Comprehensive selection) */}
              {targetType === "custom_picker" && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={pickerSearchQuery}
                        onChange={(e) => setPickerSearchQuery(e.target.value)}
                        placeholder="Search student name, ID, or phone..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-sm"
                      />
                    </div>
                    <select
                      value={pickerBatchFilter}
                      onChange={(e) => setPickerBatchFilter(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400 shadow-sm"
                    >
                      <option value="all">All Batches</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-400 font-medium">
                      Showing {filteredStudentsInPicker.length} • Selected:{" "}
                      <strong className="text-amber-400 font-bold">{customSelectedStudentIds.length}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const visibleIds = filteredStudentsInPicker.map((s) => s.id)
                          setCustomSelectedStudentIds(Array.from(new Set([...customSelectedStudentIds, ...visibleIds])))
                        }}
                        className="text-amber-400 font-bold hover:underline cursor-pointer"
                      >
                        Select All Filtered
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        type="button"
                        onClick={() => setCustomSelectedStudentIds([])}
                        className="text-rose-400 font-bold hover:underline cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-950 shadow-inner">
                    {filteredStudentsInPicker.map((s) => {
                      const isSelected = customSelectedStudentIds.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? "bg-slate-50" : "hover:bg-slate-900/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setCustomSelectedStudentIds([...customSelectedStudentIds, s.id])
                                else setCustomSelectedStudentIds(customSelectedStudentIds.filter((id) => id !== s.id))
                              }}
                              className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-400 cursor-pointer shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{s.name}</p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                <span className="font-semibold text-amber-400">{s.student_id}</span> • G:{" "}
                                {s.guardian_phone || "N/A"} • S: {s.phone || "N/A"}
                              </p>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                    {filteredStudentsInPicker.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-500">No matching students found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-PANEL: DIRECT CUSTOM PHONE NUMBERS */}
              {targetType === "direct_numbers" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400">
                      Paste / Type Custom Phone Numbers:
                    </label>
                    <span className="text-xs font-bold text-amber-400">
                      {parsedDirectNumbers.length} Valid Numbers
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={directNumbersText}
                    onChange={(e) => setDirectNumbersText(e.target.value)}
                    placeholder="Enter phone numbers separated by comma, space, or newline...&#10;e.g.&#10;01800000000&#10;01711111111&#10;01922222222"
                    className="w-full p-3 bg-slate-950 border-2 border-slate-700 rounded-xl font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    Supports Bangladeshi formats: <code className="font-bold text-slate-300">01XXXXXXXXX</code> or{" "}
                    <code className="font-bold text-slate-300">8801XXXXXXXXX</code>
                  </p>
                </div>
              )}

              {/* SUB-PANEL: Custom CSV File */}
              {targetType === "csv" && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-50 rounded-2xl p-5 text-center transition-all">
                    <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-white">Upload CSV / TXT Contact List</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      File format: Column for <span className="font-mono font-bold text-amber-400">phone</span> and optional{" "}
                      <span className="font-mono font-bold text-amber-400">name</span>
                    </p>
                    <label className="mt-3 inline-block px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer">
                      Browse File
                      <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
                    </label>
                  </div>

                  {csvFileName && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-bold truncate">{csvFileName}</span>
                        <span>({csvRecipients.filter((r) => r.isValid).length} valid numbers)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCsvFileName("")
                          setCsvRecipients([])
                        }}
                        className="text-rose-400 hover:text-rose-300 font-bold text-[11px] cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recipient Count Summary Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 rounded-2xl p-4 text-white shadow-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-400/90 font-semibold uppercase tracking-wider">Ready to Deliver</p>
                <h3 className="text-2xl font-black mt-0.5 text-slate-900">
                  {resolvedRecipients.length} Recipient{resolvedRecipients.length !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs font-bold inline-block text-amber-300">
                  {targetType.toUpperCase().replace("_", " ")}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Est. {resolvedRecipients.length * smsStats.parts} SMS Parts</p>
              </div>
            </div>
          </div>

          {/* Right Column: Compose Message, Merge Tags & Preview */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  2. Compose Message & Dynamic Merge Tags
                </h2>
              </div>

              {/* Quick Template Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Load Quick Template:</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMessage(t.text)}
                      className="p-2 border border-slate-700 bg-slate-950 rounded-xl text-left hover:border-amber-500/50 hover:bg-slate-850 transition-all text-xs cursor-pointer truncate"
                    >
                      <span className="font-bold text-slate-200 block truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Merge Tag Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-400">Drag or Click to Insert Dynamic Tag:</label>
                  <span className="text-[11px] text-slate-500">Drag tag directly into message or click to insert</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "{{number}}", label: "Marks / Number", isHighlight: true },
                    { tag: "{{total_marks}}", label: "Total Marks" },
                    { tag: "{{exam_title}}", label: "Exam Title" },
                    { tag: "{{rank}}", label: "Merit Rank" },
                    { tag: "{{grade}}", label: "Grade" },
                    { tag: "{{name}}", label: "Student Name" },
                    { tag: "{{student_id}}", label: "Student ID" },
                    { tag: "{{batch}}", label: "Batch Name" },
                    { tag: "{{due_amount}}", label: "Due (৳)" },
                    { tag: "{{date}}", label: "Date" },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.tag)
                      }}
                      onClick={() => insertMergeTag(item.tag)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-grab active:cursor-grabbing flex items-center gap-1 shadow-sm select-none",
                        item.isHighlight
                          ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-2 border-amber-500/50 ring-2 ring-amber-500/20 animate-pulse"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      )}
                      title={`Drag ${item.tag} into the message box or click to insert`}
                    >
                      <GripVertical className={cn("w-3 h-3", item.isHighlight ? "text-amber-400" : "text-slate-400")} />
                      <span>{item.tag}</span>
                      <span className={cn("text-[10px] font-sans font-normal", item.isHighlight ? "text-amber-300 font-bold" : "text-slate-400")}>
                        ({item.label})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Message Content *</label>
                <textarea
                  ref={messageTextareaRef}
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDraggingOverTextarea(true)
                  }}
                  onDragLeave={() => setIsDraggingOverTextarea(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDraggingOverTextarea(false)
                    const tag = e.dataTransfer.getData("text/plain")
                    if (tag) insertMergeTag(tag)
                  }}
                  placeholder="Type your SMS here or drag tags/select a template above... (e.g. Dear Parent, your child {{name}} has obtained {{number}}/{{total_marks}} marks in {{exam_title}})"
                  className={cn(
                    "w-full p-3.5 bg-slate-950 border-2 rounded-xl text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none transition-all",
                    isDraggingOverTextarea
                      ? "border-amber-400 ring-4 ring-amber-400/20 bg-amber-950/20"
                      : "border-slate-700 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                  )}
                />

                {/* SMS Parts Counter & Unicode indicator */}
                <div className="flex items-center justify-between text-xs text-slate-400 mt-1.5">
                  <span>
                    <strong className="text-white">{smsStats.len}</strong> characters •{" "}
                    <strong className="text-amber-400">{smsStats.parts}</strong> SMS part{smsStats.parts !== 1 ? "s" : ""}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium text-[11px]">
                    {smsStats.isUnicode ? "Unicode / Bengali (70 chars/part)" : "Standard GSM (160 chars/part)"}
                  </span>
                </div>
              </div>

              {/* Live Smartphone Screen Mockup */}
              <div className="p-3.5 bg-slate-950 rounded-2xl text-white space-y-2 border border-slate-200 shadow-inner">
                <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                    Recipient Mobile View Simulation
                  </span>
                  <span className="text-amber-400/80 font-semibold">MedhaShiree</span>
                </div>
                {resolvedRecipients.length > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] text-slate-400 shrink-0">Simulate for:</span>
                    <select
                      value={previewRecipientIndex}
                      onChange={(e) => setPreviewRecipientIndex(Number(e.target.value))}
                      className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg text-[11px] px-2 py-1 max-w-[240px] truncate focus:outline-none"
                    >
                      {resolvedRecipients.slice(0, 50).map((r, i) => (
                        <option key={i} value={i}>
                          {r.name} {r.obtainedMarks !== undefined ? `(Marks: ${r.obtainedMarks})` : ""} {r.rank ? `[${r.rank}]` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="p-3 bg-slate-900 rounded-xl text-xs text-slate-100 font-medium leading-relaxed border border-slate-200">
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
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
      {/* TAB 2: GATEWAY & API SETTINGS (VISUAL DRAG & DROP BUILDER) */}
      {/* ========================================================================= */}
      {activeTab === "gateway" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <form onSubmit={handleSaveGateway} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Custom SMS Gateway API Builder</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visual parameter mapping with drag-and-drop token placement for sms.net.bd and any SMS provider
                    </p>
                  </div>
                </div>
              </div>

              {/* 1-Click Provider Templates */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">1-Click Provider Presets:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("sms_net_bd")}
                    className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs text-center transition-all cursor-pointer shadow-sm"
                  >
                    🚀 sms.net.bd (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("greenweb")}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    Greenweb BD
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("mimsms")}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    MIM SMS (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGatewayPreset("ssl_wireless")}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs text-center transition-all cursor-pointer"
                  >
                    SSL Wireless
                  </button>
                </div>
              </div>

              {/* 1. API Key */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Provider API Key *
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    required
                    value={gatewayConfig.apiKey}
                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, apiKey: e.target.value })}
                    placeholder="e.g. 48673a5a87b1c4e92... (paste your API key here)"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 2. HTTP Call Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. HTTP Call Type / Request Method *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "GET", label: "GET (URL Query)", hint: "Matches sms.net.bd" },
                    { id: "POST_FORM", label: "POST (Form-urlencoded)", hint: "Standard Form POST" },
                    { id: "POST_JSON", label: "POST (JSON Body)", hint: "REST API format" },
                  ].map((ct) => (
                    <label
                      key={ct.id}
                      className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                        gatewayConfig.callType === ct.id
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-300 font-bold shadow-sm ring-1 ring-amber-500/30"
                          : "border-slate-200 hover:bg-amber-50/30 text-slate-400 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="callType"
                          checked={gatewayConfig.callType === ct.id}
                          onChange={() => setGatewayConfig({ ...gatewayConfig, callType: ct.id as any })}
                          className="w-4 h-4 text-amber-500 border-slate-700 focus:ring-amber-500 bg-slate-950"
                        />
                        <span className="text-xs">{ct.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 ml-6">{ct.hint}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3. Base Endpoint URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  3. Base Gateway Endpoint URL *
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={gatewayConfig.baseUrl}
                    onChange={(e) => {
                      const raw = e.target.value
                      const clean = cleanBaseUrl(raw)
                      const newTemplate = syncUrlTemplate(clean, gatewayConfig.params)
                      setGatewayConfig({ ...gatewayConfig, baseUrl: clean, urlTemplate: newTemplate })
                    }}
                    placeholder="https://api.sms.net.bd/sendsms"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* 4. DRAGGABLE TOKEN TOOLBOX */}
              <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    4. Draggable Variable Tokens (Drag into slots below or click to assign):
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold hidden sm:inline">
                    Drag tokens into the destination parameter slots below
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  {[
                    { token: "{msg}", label: "Message Content", desc: "Encoded SMS text", color: "amber" },
                    { token: "{to}", label: "Phone Number", desc: "Recipient mobile", color: "amber" },
                    { token: "{api_key}", label: "API Key", desc: "Your auth token", color: "amber" },
                  ].map((item) => (
                    <div
                      key={item.token}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.token)
                        e.dataTransfer.setData("tokenType", item.token)
                      }}
                      className="px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-amber-400/60 rounded-xl shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex items-center gap-2 group select-none"
                    >
                      <span className="font-mono font-black text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        {item.token}
                      </span>
                      <span className="text-xs font-bold text-slate-200">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. VISUAL PARAMETER SLOTS (DROP TARGETS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-white">
                    5. Parameter Mapping & Drop Targets:
                  </label>
                  <button
                    type="button"
                    onClick={addCustomParam}
                    className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom Parameter
                  </button>
                </div>

                <div className="space-y-3">
                  {gatewayConfig.params.map((param, idx) => {
                    const isOver = activeDragSlot === param.id
                    const isAssigned = param.value.startsWith("{") && param.value.endsWith("}")

                    return (
                      <div
                        key={param.id}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setActiveDragSlot(param.id)
                        }}
                        onDragLeave={() => setActiveDragSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setActiveDragSlot(null)
                          const token = e.dataTransfer.getData("text/plain")
                          if (token) assignTokenToParam(param.id, token)
                        }}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isOver
                            ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-500/40 scale-[1.01]"
                            : isAssigned
                            ? "border-emerald-500/30 bg-emerald-950/20"
                            : "border-slate-200 bg-slate-950"
                        }`}
                      >
                        {/* Parameter Key */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500 w-5">#{idx + 1}</span>
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block uppercase">Param Name</span>
                            <input
                              type="text"
                              value={param.key}
                              onChange={(e) => updateParamKey(param.id, e.target.value)}
                              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400 w-28"
                            />
                          </div>
                          <span className="text-slate-600 font-bold">=</span>
                        </div>

                        {/* Drop Target Box */}
                        <div className="flex-1 flex items-center gap-2">
                          <div
                            className={`flex-1 p-2.5 rounded-xl border-2 border-dashed flex items-center justify-between transition-all ${
                              isOver
                                ? "border-amber-400 bg-amber-500/20 text-amber-200 font-black animate-pulse"
                                : isAssigned
                                ? "border-emerald-500/40 bg-slate-900 text-emerald-300 font-bold"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                            }`}
                          >
                            <span className="text-xs font-mono">
                              {isOver ? "📥 Drop Token Here!" : param.value || "Drop token here"}
                            </span>

                            {isAssigned && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Configured
                              </span>
                            )}
                          </div>

                          {/* Quick assign buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {["{msg}", "{to}", "{api_key}"].map((tk) => (
                              <button
                                key={tk}
                                type="button"
                                onClick={() => assignTokenToParam(param.id, tk)}
                                className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                                  param.value === tk
                                    ? "bg-amber-500 text-slate-950 font-black"
                                    : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                                }`}
                                title={`Assign ${tk} to this slot`}
                              >
                                {tk}
                              </button>
                            ))}
                            {!param.isStandard && (
                              <button
                                type="button"
                                onClick={() => removeParam(param.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition-colors"
                                title="Remove parameter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Assembled Request URL Preview */}
              <div className="p-4 bg-slate-950 rounded-xl text-slate-300 font-mono text-xs space-y-1.5 border border-slate-200">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-sans font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Live Assembled Request URL
                </p>
                <p className="text-emerald-400 break-all text-xs">
                  {gatewayConfig.urlTemplate
                    .replace(/\{api_key\}|\{API_KEY\}/g, gatewayConfig.apiKey || "YOUR_API_KEY")
                    .replace(/\{msg\}|\{MSG\}/g, "Hello%20Student")
                    .replace(/\{to\}|\{TO\}/g, "8801800000000")}
                </p>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={savingGateway}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
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

              {/* Database Schema Cache / Missing Table Notice */}
              {hasMissingTable && (
                <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-amber-200 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm text-amber-300">
                          Supabase Table &apos;site_settings&apos; Not Created Yet
                        </h4>
                        <p className="text-xs text-amber-200/80 mt-0.5">
                          Your gateway settings are saved in your browser and <strong>fully active</strong> for this device (SMS will send normally). To enable multi-device sync and save settings permanently in Supabase, run this 1-click SQL in your Supabase SQL Editor:
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SITE_SETTINGS_SQL)
                        toast.success("Copied SQL to clipboard! Paste into Supabase SQL Editor.")
                      }}
                      className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy SQL Fix
                    </button>
                  </div>
                  <div className="bg-slate-950 text-slate-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-200">
                    <pre>{SITE_SETTINGS_SQL}</pre>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Gateway Status & Live Test Sender */}
          <div className="lg:col-span-4 space-y-6">
            {/* Setup Status Checklist */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Gateway Readiness Checklist
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5">
                  {gatewayConfig.apiKey ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className={gatewayConfig.apiKey ? "text-slate-200 font-bold" : "text-slate-500"}>
                    API Key Entered
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {gatewayConfig.params.some((p) => p.value === "{msg}") || gatewayConfig.urlTemplate.includes("{msg}") ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span
                    className={
                      gatewayConfig.params.some((p) => p.value === "{msg}") || gatewayConfig.urlTemplate.includes("{msg}")
                        ? "text-slate-200 font-bold"
                        : "text-slate-500"
                    }
                  >
                    Message Token {"{msg}"} Configured
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {gatewayConfig.params.some((p) => p.value === "{to}") || gatewayConfig.urlTemplate.includes("{to}") ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span
                    className={
                      gatewayConfig.params.some((p) => p.value === "{to}") || gatewayConfig.urlTemplate.includes("{to}")
                        ? "text-slate-200 font-bold"
                        : "text-slate-500"
                    }
                  >
                    Phone Token {"{to}"} Configured
                  </span>
                </div>
              </div>

              {isGatewayReady ? (
                <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs text-emerald-300 font-medium">
                  ✓ Setup complete! You can now send single or bulk SMS anytime.
                </div>
              ) : (
                <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-500/30 text-xs text-amber-300 font-medium">
                  Please complete the checklist to enable SMS dispatching.
                </div>
              )}
            </div>

            {/* Test Gateway Sender Tool */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 shadow-xl space-y-3.5">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                Live Test SMS Sender
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Test Recipient Phone</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="e.g. 01800000000 or 88018..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={testingGateway || !testPhone.trim() || !gatewayConfig.apiKey}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
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
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <p className="font-bold text-slate-200">Gateway Response:</p>
                  <pre className="text-[11px] font-mono text-emerald-400 bg-slate-900 p-2 rounded border border-slate-200 overflow-x-auto max-h-32">
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
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                Recent Message Delivery Logs
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time status of messages dispatched through the system</p>
            </div>
            <button
              onClick={refreshLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-bold">
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Message Snippet</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-white">{log.to_phone}</td>
                    <td className="px-4 py-3 max-w-md truncate text-slate-300 font-medium">{log.message}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold uppercase">
                        {log.type || "bulk"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          log.status === "sent"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : log.status === "pending"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
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
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">
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
                    <td colSpan={5} className="py-12 text-center text-slate-500">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 text-white">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                Confirm Bulk SMS Dispatch
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 text-amber-200">
                <div className="flex justify-between">
                  <span>Total Recipients:</span>
                  <strong className="text-sm font-black text-amber-300">{resolvedRecipients.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Estimated SMS Parts:</span>
                  <strong className="text-sm font-black text-amber-300">{resolvedRecipients.length * smsStats.parts}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Target Destination:</span>
                  <strong className="font-bold text-white">{targetPhoneType.toUpperCase()}</strong>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-200 mb-1">Message Preview:</p>
                <div className="p-3 bg-white border border-slate-300 rounded-xl text-slate-300 font-medium max-h-36 overflow-y-auto">
                  {sampleMessagePreview}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkSend}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Start Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SENDING PROGRESS MODAL */}
      {sending && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 text-white">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-black text-slate-900">Dispatching Messages...</h3>
              <p className="text-xs text-slate-400 mt-1">Please keep this window open while sending.</p>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-3 bg-white border border-slate-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${sendProgress.total ? (sendProgress.current / sendProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono font-bold">
                <span>
                  {sendProgress.current} / {sendProgress.total} Sent
                </span>
                <span className="text-emerald-400">✓ {sendProgress.success}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
