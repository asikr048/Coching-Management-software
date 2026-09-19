"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, 
  Trash2, Key, Eye, EyeOff, Sparkles, Printer, FileText, 
  ArrowRight, Users, ShieldAlert, RefreshCw, Check, Clock,
  CreditCard, DollarSign, BookOpen, Layers, CheckCircle
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { checkFinancialAccess } from "@/lib/financial-access"
import { useBranch } from "@/components/providers/BranchContext"
import { 
  AdmissionSlipData, 
  StudentIdCardData, 
  printBulkAdmissionSlips, 
  printBulkStudentIdCards, 
  downloadBulkAdmissionSlipsPDF, 
  downloadBulkStudentIdCardsPDF,
  printAdmissionSlip,
  printStudentIdCard
} from "@/lib/id-card-generator"

interface Batch {
  id: string
  name: string
  branch_id?: string | null
  classroom?: string | null
  subject?: string
  class_level?: string
  max_seats: number
  current_seats: number
  monthly_fee: number
  admission_fee: number
  status?: string
}

interface Branch {
  id: string
  name: string
  address?: string | null
}

interface ParsedStudent {
  id: string
  name: string
  guardian_phone: string
  guardian_name?: string
  phone?: string
  address?: string
  school_college?: string
  gender?: "male" | "female" | "other"
  class_level?: string
  email?: string
  isValid: boolean
  errors: string[]
}

interface BulkEnrollClientProps {
  batches: Batch[]
  branches: Branch[]
}

export default function BulkEnrollClient({ batches = [], branches = [] }: BulkEnrollClientProps) {
  const router = useRouter()
  const { selectedBranchId: contextBranchId, branches: contextBranches } = useBranch()

  const [financialAccess, setFinancialAccess] = useState<boolean | null>(null)
  useEffect(() => {
    checkFinancialAccess().then(({ hasAccess }) => setFinancialAccess(hasAccess))
  }, [])

  const effectiveBranches = useMemo(() => {
    if (branches && branches.length > 0) return branches
    if (contextBranches && contextBranches.length > 0) return contextBranches
    return []
  }, [branches, contextBranches])

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (contextBranchId && contextBranchId !== "all") return contextBranchId
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("medhashiree_admin_branch_id")
      if (saved && saved !== "all") return saved
    }
    const mainB = effectiveBranches.find(b => /main|প্রধান/i.test(b.name))
    return mainB?.id || effectiveBranches[0]?.id || ""
  })

  // Filter batches by branch
  const filteredBatches = useMemo(() => {
    if (!batches || batches.length === 0) return []
    if (!selectedBranchId || selectedBranchId === "all") return batches
    const matches = batches.filter(b => 
      b.branch_id === selectedBranchId ||
      (b as any).origin_branch_id === selectedBranchId ||
      ((b as any).branch_seats && (b as any).branch_seats[selectedBranchId] !== undefined)
    )
    const globalBatches = batches.filter(b => !b.branch_id && !(b as any).origin_branch_id)
    const combined = [...matches, ...globalBatches.filter(g => !matches.some(e => e.id === g.id))]
    return combined.length > 0 ? combined : batches
  }, [batches, selectedBranchId])

  // Batch selection & fee settings
  const [selectedBatchId, setSelectedBatchId] = useState<string>("")
  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId)
  }, [batches, selectedBatchId])

  // Auto-select first open batch
  useEffect(() => {
    if (filteredBatches.length > 0 && !selectedBatchId) {
      const firstOpen = filteredBatches.find(b => (b.current_seats || 0) < b.max_seats)
      if (firstOpen) {
        setSelectedBatchId(firstOpen.id)
      } else {
        setSelectedBatchId(filteredBatches[0].id)
      }
    }
  }, [filteredBatches, selectedBatchId])

  // Fee state
  const [admissionFee, setAdmissionFee] = useState<number>(0)
  const [monthlyFee, setMonthlyFee] = useState<number>(0)
  const [paidAmount, setPaidAmount] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(10)
    return d.toISOString().split("T")[0]
  })

  // Sync fee inputs when batch changes
  useEffect(() => {
    if (selectedBatch) {
      const adm = selectedBatch.admission_fee || 0
      const mon = selectedBatch.monthly_fee || 0
      setAdmissionFee(adm)
      setMonthlyFee(mon)
      setPaidAmount(String(adm + mon)) // default full paid
    }
  }, [selectedBatch])

  const totalPayable = admissionFee + monthlyFee
  const numericPaid = parseFloat(paidAmount) || 0
  const remainingDue = Math.max(0, totalPayable - numericPaid)

  // Password & confirm password state
  const [password, setPassword] = useState<string>("student123")
  const [confirmPassword, setConfirmPassword] = useState<string>("student123")
  const [showPassword, setShowPassword] = useState<boolean>(false)

  // CSV parsing state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>("")
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // Submission & Results state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [completedResults, setCompletedResults] = useState<{
    batch: any
    count: number
    roll_range: { start: number; end: number }
    results: Array<{
      student: any
      enrollment: any
      slip_data: AdmissionSlipData
      id_card_data: StudentIdCardData
    }>
  } | null>(null)

  // Calculate available seats
  const availableSeats = useMemo(() => {
    if (!selectedBatch) return 0
    return Math.max(0, (selectedBatch.max_seats || 0) - (selectedBatch.current_seats || 0))
  }, [selectedBatch])

  // Download Sample CSV
  const handleDownloadSampleCSV = () => {
    const headers = ["Name", "Guardian Phone", "Guardian Name", "Phone", "Address", "School / College", "Gender", "Class"]
    const sampleRows = [
      ["আবাব হোসেন", "01751380602", "শাকিলা খাতুন", "01751380602", "কামারপাড়া, রংপুর", "পুলিশ লাইন্স স্কুল এন্ড কলেজ", "Male", selectedBatch?.class_level || "Class 10"],
      ["তাযমীন", "01323077148", "বকুল মিয়া", "", "পার্ক মোড়, রংপুর", "পুলিশ লাইন্স স্কুল এন্ড কলেজ", "Female", selectedBatch?.class_level || "Class 10"],
      ["জান্নাতুল", "01314262623", "জিয়াদুল ইসলাম", "", "কামারপাড়া, রংপুর", "মুলাটোল মাদ্রাসা", "Female", selectedBatch?.class_level || "Class 10"],
      ["Farhan Ahmed", "01712345678", "Rafiqul Islam", "01987654321", "Dhanmondi, Dhaka", "Dhaka Residential Model College", "Male", selectedBatch?.class_level || "Class 10"]
    ]

    const csvContent = [
      headers.join(","),
      ...sampleRows.map(row => 
        row.map(cell => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(",")
      )
    ].join("\r\n")

    // \uFEFF ensures UTF-8 BOM so Excel opens Bengali characters properly
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `medhashiree_student_enrollment_template.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("নমুনা CSV ফাইল ডাউনলোড সম্পন্ন হয়েছে! (Sample CSV downloaded)")
  }

  // Robust CSV parser supporting quotes, commas in quotes, Bengali headers
  const parseCSVText = (text: string) => {
    // Remove UTF-8 BOM if present
    const cleanText = text.replace(/^\uFEFF/, "")
    const lines = cleanText.split(/\r\n|\n|\r/).filter(l => l.trim() !== "")
    if (lines.length < 2) {
      toast.error("CSV ফাইলে পর্যাপ্ত তথ্য পাওয়া যায়নি (At least header and 1 data row required)")
      return
    }

    // Delimiter detection (comma, semicolon, or tab)
    const firstLine = lines[0]
    let delimiter = ","
    if (firstLine.includes("\t") && !firstLine.includes(",")) delimiter = "\t"
    else if (firstLine.includes(";") && !firstLine.includes(",")) delimiter = ";"

    // Tokenizer regex for CSV line respecting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let cur = ""
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (c === delimiter && !inQuotes) {
          result.push(cur.trim())
          cur = ""
        } else {
          cur += c
        }
      }
      result.push(cur.trim())
      return result
    }

    const rawHeaders = parseLine(lines[0]).map(h => h.toLowerCase().trim())

    // Normalize header mapping
    const colIndex = {
      name: -1,
      guardian_phone: -1,
      guardian_name: -1,
      phone: -1,
      address: -1,
      school_college: -1,
      gender: -1,
      class_level: -1,
      email: -1
    }

    rawHeaders.forEach((h, idx) => {
      if (/^(name|student_name|নাম|শিক্ষার্থীর নাম)$/i.test(h)) colIndex.name = idx
      else if (/^(guardian_phone|parent_phone|guardian_mobile|অভিভাবকের মোবাইল|অভিভাবকের ফোন|পিতা\/মাতা মোবাইল)$/i.test(h)) colIndex.guardian_phone = idx
      else if (/^(guardian_name|parent_name|father_name|পিতা\/মাতা নাম|অভিভাবকের নাম|পিতার নাম)$/i.test(h)) colIndex.guardian_name = idx
      else if (/^(phone|student_phone|mobile|মোবাইল|ফোন|শিক্ষার্থীর মোবাইল)$/i.test(h)) colIndex.phone = idx
      else if (/^(address|ঠিকানা|বাসা|বর্তমান ঠিকানা)$/i.test(h)) colIndex.address = idx
      else if (/^(school|college|school_college|institution|স্কুল|কলেজ|স্কুল\/কলেজ|স্কুলের নাম|শিক্ষা প্রতিষ্ঠান)$/i.test(h)) colIndex.school_college = idx
      else if (/^(gender|sex|লিঙ্গ)$/i.test(h)) colIndex.gender = idx
      else if (/^(class|class_level|grade|শ্রেণী|ক্লাস)$/i.test(h)) colIndex.class_level = idx
      else if (/^(email|ইমেইল)$/i.test(h)) colIndex.email = idx
    })

    // Fallbacks if not strictly matched
    if (colIndex.name === -1) {
      // Find first column with 'name' or 'নাম'
      colIndex.name = rawHeaders.findIndex(h => h.includes("name") || h.includes("নাম"))
      if (colIndex.name === -1) colIndex.name = rawHeaders.length > 1 ? 1 : 0
    }
    if (colIndex.guardian_phone === -1) {
      // Look for phone or মোবাইল
      colIndex.guardian_phone = rawHeaders.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("মোবাইল") || h.includes("ফোন"))
      if (colIndex.guardian_phone === -1 && colIndex.phone !== -1) {
        colIndex.guardian_phone = colIndex.phone
      }
    }

    const students: ParsedStudent[] = []

    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i])
      if (cells.every(c => !c)) continue // skip empty rows

      const name = colIndex.name >= 0 && cells[colIndex.name] ? cells[colIndex.name].replace(/^["']|["']$/g, "").trim() : ""
      let guardianPhone = colIndex.guardian_phone >= 0 && cells[colIndex.guardian_phone] ? cells[colIndex.guardian_phone].replace(/[^0-9+]/g, "").trim() : ""
      let studentPhone = colIndex.phone >= 0 && cells[colIndex.phone] ? cells[colIndex.phone].replace(/[^0-9+]/g, "").trim() : ""
      const guardianName = colIndex.guardian_name >= 0 && cells[colIndex.guardian_name] ? cells[colIndex.guardian_name].replace(/^["']|["']$/g, "").trim() : ""
      const address = colIndex.address >= 0 && cells[colIndex.address] ? cells[colIndex.address].replace(/^["']|["']$/g, "").trim() : ""
      const school = colIndex.school_college >= 0 && cells[colIndex.school_college] ? cells[colIndex.school_college].replace(/^["']|["']$/g, "").trim() : ""
      const rawGender = colIndex.gender >= 0 && cells[colIndex.gender] ? cells[colIndex.gender].toLowerCase().trim() : ""
      const classLevel = colIndex.class_level >= 0 && cells[colIndex.class_level] ? cells[colIndex.class_level].trim() : (selectedBatch?.class_level || "")
      const email = colIndex.email >= 0 && cells[colIndex.email] ? cells[colIndex.email].trim() : ""

      // Standardize phone
      if (!guardianPhone && studentPhone) guardianPhone = studentPhone
      if (!studentPhone && guardianPhone) studentPhone = guardianPhone

      let gender: "male" | "female" | "other" = "male"
      if (rawGender.includes("f") || rawGender.includes("মেয়ে") || rawGender.includes("নারী")) gender = "female"
      else if (rawGender.includes("o") || rawGender.includes("অন্যান্য")) gender = "other"

      const errors: string[] = []
      if (!name) errors.push("নাম প্রয়োজন (Missing Name)")
      if (!guardianPhone && !studentPhone) errors.push("মোবাইল নম্বর প্রয়োজন (Missing Phone)")
      else if ((guardianPhone || studentPhone).length < 7) errors.push("মোবাইল নম্বর সঠিক নয় (Invalid Phone)")

      students.push({
        id: `stu_${i}_${Date.now().toString(36)}`,
        name,
        guardian_phone: guardianPhone,
        guardian_name: guardianName,
        phone: studentPhone,
        address,
        school_college: school,
        gender,
        class_level: classLevel,
        email,
        isValid: errors.length === 0,
        errors
      })
    }

    setParsedStudents(students)
    toast.success(`সফলভাবে ${students.length} জন শিক্ষার্থীর তথ্য পার্স করা হয়েছে! (Parsed ${students.length} rows)`)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) parseCSVText(content)
    }
    reader.readAsText(file, "UTF-8")
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".csv")) {
      toast.error("অনুগ্রহ করে একটি .csv ফাইল আপলোড করুন (Please upload a .csv file)")
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) parseCSVText(content)
    }
    reader.readAsText(file, "UTF-8")
  }

  const handleRemoveStudent = (id: string) => {
    setParsedStudents(prev => prev.filter(s => s.id !== id))
  }

  const handleUpdateStudentCell = (id: string, field: keyof ParsedStudent, val: any) => {
    setParsedStudents(prev => prev.map(s => {
      if (s.id !== id) return s
      const updated = { ...s, [field]: val }
      const errors: string[] = []
      if (!updated.name?.trim()) errors.push("Missing Name")
      if (!updated.guardian_phone?.trim() && !updated.phone?.trim()) errors.push("Missing Phone")
      return {
        ...updated,
        isValid: errors.length === 0,
        errors
      }
    }))
  }

  // Process Bulk Enrollment
  const handleExecuteBulkEnroll = async () => {
    if (!selectedBatchId) {
      toast.error("অনুগ্রহ করে একটি ব্যাচ নির্বাচন করুন (Please select a batch)")
      return
    }

    if (parsedStudents.length === 0) {
      toast.error("ভর্তি করার মতো কোনো শিক্ষার্থীর তথ্য নেই (No students to enroll)")
      return
    }

    const invalidCount = parsedStudents.filter(s => !s.isValid).length
    if (invalidCount > 0) {
      toast.error(`${invalidCount} জন শিক্ষার্থীর তথ্যে ত্রুটি রয়েছে। লাল চিহ্নিত ঘরগুলো ঠিক করুন। (Please fix invalid student rows)`)
      return
    }

    if (!password || password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)")
      return
    }

    if (password !== confirmPassword) {
      toast.error("পাসওয়ার্ড দুটি মিলছে না (Passwords do not match)")
      return
    }

    if (parsedStudents.length > availableSeats) {
      toast.error(`ব্যাচে আসন সংখ্যা (${availableSeats}) এর চেয়ে বেশি শিক্ষার্থী (${parsedStudents.length}) রয়েছে!`)
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        batch_id: selectedBatchId,
        branch_id: selectedBranchId || selectedBatch?.branch_id,
        password: password.trim(),
        fee_settings: {
          admission_fee: admissionFee,
          monthly_fee: monthlyFee,
          paid_amount: numericPaid,
          due_date: dueDate,
          payment_method: paymentMethod
        },
        students: parsedStudents.map(s => ({
          name: s.name.trim(),
          guardian_phone: s.guardian_phone.trim(),
          guardian_name: s.guardian_name?.trim() || "",
          phone: s.phone?.trim() || "",
          address: s.address?.trim() || "",
          school_college: s.school_college?.trim() || "",
          gender: s.gender || "male",
          class_level: s.class_level || selectedBatch?.class_level || "",
          email: s.email?.trim() || ""
        }))
      }

      const res = await fetch("/api/student/bulk-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to complete bulk enrollment")
      }

      toast.success(`🎉 সফলভাবে ${data.count} জন শিক্ষার্থীর ভর্তি সম্পন্ন হয়েছে! (Bulk Enrollment Complete)`, {
        duration: 5000
      })

      setCompletedResults(data)
    } catch (err: any) {
      console.error("Bulk enroll failure:", err)
      toast.error(err?.message || "Failed to complete bulk enrollment")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk Print & Download Handlers
  const handlePrintAllSlips = () => {
    if (!completedResults?.results) return
    const slips = completedResults.results.map(r => r.slip_data)
    printBulkAdmissionSlips(slips)
  }

  const handleDownloadAllSlipsPDF = () => {
    if (!completedResults?.results) return
    const slips = completedResults.results.map(r => r.slip_data)
    downloadBulkAdmissionSlipsPDF(slips)
  }

  const handlePrintAllIdCards = () => {
    if (!completedResults?.results) return
    const cards = completedResults.results.map(r => r.id_card_data)
    printBulkStudentIdCards(cards)
  }

  const handleDownloadAllIdCardsPDF = () => {
    if (!completedResults?.results) return
    const cards = completedResults.results.map(r => r.id_card_data)
    downloadBulkStudentIdCardsPDF(cards)
  }

  const handleResetForNewBatch = () => {
    setCompletedResults(null)
    setParsedStudents([])
    setFileName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (financialAccess === false) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center shadow-xl">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800">Financial Access Required</h3>
        <p className="text-sm text-rose-500 mt-1">
          You need financial access privileges to enroll students and record admission payments.
        </p>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // SUCCESS / POST-ENROLLMENT VIEW
  // --------------------------------------------------------------------------
  if (completedResults) {
    const { count, batch, roll_range, results } = completedResults
    return (
      <div className="space-y-6">
        {/* Celebration Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-emerald-500/30 border border-emerald-400/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-100 uppercase tracking-wide mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-200" />
              Bulk Enrollment Successful
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {count} জন শিক্ষার্থীর ভর্তি সফলভাবে সম্পন্ন হয়েছে!
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              ব্যাচ: <b>{batch.name}</b> • বরাদ্দকৃত রোল রেঞ্জ: <b>#{roll_range.start} থেকে #{roll_range.end}</b> • পাসওয়ার্ড তৈরি ও প্রোফাইল সংযুক্ত হয়েছে।
            </p>

            {/* Quick Bulk Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handlePrintAllSlips}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 hover:bg-emerald-50 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-700" />
                <span>সব ভর্তি রসিদ প্রিন্ট করুন ({count})</span>
              </button>

              <button
                onClick={handleDownloadAllSlipsPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-800/80 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm border border-emerald-600 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>রসিদ PDF ডাউনলোড</span>
              </button>

              <button
                onClick={handlePrintAllIdCards}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-200" />
                <span>সব আইডি কার্ড প্রিন্ট করুন ({count})</span>
              </button>

              <button
                onClick={handleDownloadAllIdCardsPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl font-bold text-sm border border-slate-700 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-300" />
                <span>আইডি কার্ড PDF ডাউনলোড</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base">ভর্তিকৃত শিক্ষার্থীদের তালিকা ও রসিদ</h3>
              <p className="text-xs text-slate-500 mt-0.5">নিচের তালিকা থেকে যেকোনো শিক্ষার্থীর ব্যক্তিগত স্লিপ বা আইডি কার্ড প্রিন্ট করতে পারেন</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResetForNewBatch}
                className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                + আরো ভর্তি করুন
              </button>
              <Link
                href="/dashboard/owner/students"
                className="text-xs font-bold px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                শিক্ষার্থী তালিকা দেখুন →
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-semibold text-xs border-b border-slate-200">
                  <th className="py-3 px-4">রোল (Roll)</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">নাম (Name)</th>
                  <th className="py-3 px-4">মোবাইল (Phone)</th>
                  <th className="py-3 px-4">অভিভাবক (Guardian)</th>
                  <th className="py-3 px-4">ফি স্ট্যাটাস (Fee)</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r, idx) => {
                  const slip = r.slip_data
                  const rollStr = slip.batch_roll != null ? String(slip.batch_roll) : String(idx + 1)
                  return (
                    <tr key={r.student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-black text-rose-600">#{rollStr}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{slip.student_id}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{slip.student_name}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">{slip.student_phone || slip.guardian_phone || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {slip.guardian_name || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          slip.due_amount <= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {slip.due_amount <= 0 ? "Paid Full" : `Due ৳${slip.due_amount}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => printAdmissionSlip(slip)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Admission Memo"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printStudentIdCard(r.id_card_data)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Student ID Card"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // MULTI-ENROLL FORM VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* 1. Step: Batch Selection & Fee Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
            ১
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">ব্যাচ ও ফি নির্বাচন (Select Batch & Fee Settings)</h2>
            <p className="text-xs text-slate-500">যে ব্যাচে শিক্ষার্থীদের একসাথে ভর্তি করানো হবে এবং ভর্তিকালীন ফি নির্ধারণ করুন</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Branch filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              শাখা (Branch)
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 shadow-2xs font-medium"
            >
              {effectiveBranches.map((br) => (
                <option key={br.id} value={br.id}>{br.name}</option>
              ))}
            </select>
          </div>

          {/* Batch select */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              ভর্তিকৃত ব্যাচ (Batch Selection) <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 shadow-2xs font-semibold"
            >
              {filteredBatches.map((b) => {
                const isFull = (b.current_seats || 0) >= b.max_seats
                return (
                  <option key={b.id} value={b.id} disabled={isFull}>
                    {b.name} ({b.class_level || "General"} - {b.subject || "All"}) • {b.current_seats || 0}/{b.max_seats} Seats {isFull ? "[FULL]" : `[${b.max_seats - (b.current_seats || 0)} Available]`}
                  </option>
                )
              })}
            </select>
          </div>
        </div>

        {/* Selected Batch Summary Card */}
        {selectedBatch && (
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{selectedBatch.name}</div>
                <div className="text-xs text-slate-500">
                  শ্রেণী: {selectedBatch.class_level || "General"} • বিষয়: {selectedBatch.subject || "All"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-500">আসন অবস্থা (Seats)</div>
                <div className="text-sm font-bold text-slate-800">
                  {selectedBatch.current_seats || 0} / {selectedBatch.max_seats}
                  <span className={`ml-2 text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    availableSeats > 5 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {availableSeats} ফাঁকা
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">ভর্তি ও মাসিক ফি</div>
                <div className="text-sm font-bold text-indigo-700">
                  ৳{(selectedBatch.admission_fee || 0) + (selectedBatch.monthly_fee || 0)}
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    (ভর্তি: ৳{selectedBatch.admission_fee || 0}, মাসিক: ৳{selectedBatch.monthly_fee || 0})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fee Configuration Sub-form */}
        <div className="pt-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span>ভর্তিকালীন ফি ও পরিশোধ সংক্রান্ত তথ্য (Admission & Payment Settings)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ভর্তি ফি (Admission Fee)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  min="0"
                  value={admissionFee}
                  onChange={(e) => setAdmissionFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">মাসিক ফি (Monthly Fee)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  min="0"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">পরিশোধিত অর্থ (Paid per Student)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  min="0"
                  max={totalPayable}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 text-slate-900 font-bold"
                />
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(totalPayable))}
                  className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Full Paid
                </button>
                <span className="text-slate-300 text-[10px]">•</span>
                <button
                  type="button"
                  onClick={() => setPaidAmount(String(admissionFee))}
                  className="text-[10px] font-bold text-slate-600 hover:underline cursor-pointer"
                >
                  Admission Only
                </button>
                <span className="text-slate-300 text-[10px]">•</span>
                <button
                  type="button"
                  onClick={() => setPaidAmount("0")}
                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  All Due (৳0)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">বকেয়া পরিশোধের তারিখ (Due Date)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={remainingDue <= 0}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 text-slate-900 disabled:bg-slate-100 disabled:opacity-60"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                বকেয়া: <b className={remainingDue > 0 ? "text-rose-600 font-bold" : "text-emerald-600"}>৳{remainingDue}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Step: CSV Template Format & Download */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
              ২
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">সিএসভি ফরম্যাট ও নমুনা ফাইল (CSV Format & Template)</h2>
              <p className="text-xs text-slate-500">নিচের ফরম্যাট অনুযায়ী এক্সেল বা গুগল শিটে তথ্য তৈরি করে ডাউনলোডকৃত ফাইলে পেস্ট করতে পারেন</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadSampleCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>নমুনা CSV ডাউনলোড করুন (Download Sample)</span>
          </button>
        </div>

        {/* Format Explanation Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">কলামের নাম (English)</th>
                <th className="py-2.5 px-3">বাংলা হেডলাইন (Bangla)</th>
                <th className="py-2.5 px-3">বাধ্যতামূলক? (Required)</th>
                <th className="py-2.5 px-3">বর্ণনা ও উদাহরণ (Description)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
              <tr>
                <td className="py-2 px-3 font-mono font-bold text-slate-900">Name</td>
                <td className="py-2 px-3 font-medium text-slate-800">নাম / শিক্ষার্থীর নাম</td>
                <td className="py-2 px-3"><span className="text-rose-600 font-bold">হ্যাঁ (Required)</span></td>
                <td className="py-2 px-3">শিক্ষার্থীর পুরো নাম (যেমন: আবাব হোসেন)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono font-bold text-slate-900">Guardian Phone</td>
                <td className="py-2 px-3 font-medium text-slate-800">অভিভাবকের মোবাইল / ফোন</td>
                <td className="py-2 px-3"><span className="text-rose-600 font-bold">হ্যাঁ (Required)</span></td>
                <td className="py-2 px-3">অভিভাবকের ১১ ডিজিট মোবাইল নম্বর (যেমন: 01751380602)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">Guardian Name</td>
                <td className="py-2 px-3 text-slate-800">পিতা/মাতা নাম / অভিভাবকের নাম</td>
                <td className="py-2 px-3 text-slate-500">ঐচ্ছিক (Recommended)</td>
                <td className="py-2 px-3">অভিভাবকের নাম (যেমন: শাকিলা খাতুন)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">Phone</td>
                <td className="py-2 px-3 text-slate-800">শিক্ষার্থীর মোবাইল / ফোন</td>
                <td className="py-2 px-3 text-slate-500">ঐচ্ছিক (Optional)</td>
                <td className="py-2 px-3">শিক্ষার্থীর নিজস্ব মোবাইল নম্বর</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">Address</td>
                <td className="py-2 px-3 text-slate-800">ঠিকানা</td>
                <td className="py-2 px-3 text-slate-500">ঐচ্ছিক (Optional)</td>
                <td className="py-2 px-3">বর্তমান বা স্থায়ী ঠিকানা (যেমন: কামারপাড়া, রংপুর)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-slate-700">School / College</td>
                <td className="py-2 px-3 text-slate-800">স্কুল/কলেজ / স্কুলের নাম</td>
                <td className="py-2 px-3 text-slate-500">ঐচ্ছিক (Optional)</td>
                <td className="py-2 px-3">বর্তমান শিক্ষা প্রতিষ্ঠানের নাম</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Step: Upload CSV File & Live Data Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
            ৩
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">সিএসভি ফাইল আপলোড ও প্রিভিউ (Import CSV)</h2>
            <p className="text-xs text-slate-500">আপনার প্রস্তুতকৃত CSV ফাইলটি ড্র্যাগ করুন অথবা ক্লিক করে সিলেক্ট করুন</p>
          </div>
        </div>

        {/* Upload dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragging 
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" 
              : fileName 
              ? "border-emerald-300 bg-emerald-50/30" 
              : "border-slate-300 bg-slate-50/50 hover:bg-slate-100/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            {fileName ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <Upload className="w-6 h-6" />}
          </div>

          <div className="text-sm font-bold text-slate-800">
            {fileName ? (
              <span className="text-emerald-700">ফাইল লোড হয়েছে: {fileName}</span>
            ) : (
              <span>ক্লিক করে CSV ফাইল নির্বাচন করুন অথবা এখানে ড্র্যাগ করুন</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            শুধুমাত্র .csv ফরম্যাটের স্প্রেডশীট ফাইল সমর্থিত
          </p>
        </div>

        {/* Parsed Students Table Preview */}
        {parsedStudents.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  মোট শিক্ষার্থী: <span className="text-indigo-600 font-extrabold">{parsedStudents.length}</span> জন
                </span>
                {parsedStudents.length > availableSeats && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    ⚠️ ব্যাচে ফাঁকা আসনের চেয়ে {parsedStudents.length - availableSeats} জন বেশি!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  সঠিক: <b>{parsedStudents.filter(s => s.isValid).length}</b> • 
                  ত্রুটিপূর্ণ: <b className="text-rose-600">{parsedStudents.filter(s => !s.isValid).length}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setParsedStudents([])}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium ml-2 cursor-pointer"
                >
                  সব মুছুন (Clear)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[380px] border border-slate-200 rounded-xl overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">নাম (Name) <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-3">অভিভাবকের মোবাইল <span className="text-rose-500">*</span></th>
                    <th className="py-2.5 px-3">পিতা/মাতার নাম</th>
                    <th className="py-2.5 px-3">শিক্ষার্থীর মোবাইল</th>
                    <th className="py-2.5 px-3">স্কুল/কলেজ</th>
                    <th className="py-2.5 px-3">ঠিকানা</th>
                    <th className="py-2.5 px-3">স্ট্যাটাস</th>
                    <th className="py-2.5 px-3 text-right">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {parsedStudents.map((st, idx) => (
                    <tr key={st.id} className={!st.isValid ? "bg-rose-50/40" : "hover:bg-slate-50/60"}>
                      <td className="py-2 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => handleUpdateStudentCell(st.id, "name", e.target.value)}
                          className={`px-2 py-1 border rounded text-xs font-semibold text-slate-900 w-36 ${
                            !st.name ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-transparent"
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={st.guardian_phone}
                          onChange={(e) => handleUpdateStudentCell(st.id, "guardian_phone", e.target.value)}
                          className={`px-2 py-1 border rounded text-xs font-mono text-slate-900 w-32 ${
                            !st.guardian_phone ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-transparent"
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={st.guardian_name || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "guardian_name", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 w-32 bg-transparent"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={st.phone || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "phone", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs font-mono text-slate-800 w-28 bg-transparent"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={st.school_college || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "school_college", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 w-36 bg-transparent"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={st.address || ""}
                          onChange={(e) => handleUpdateStudentCell(st.id, "address", e.target.value)}
                          className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-800 w-32 bg-transparent"
                        />
                      </td>
                      <td className="py-2 px-3">
                        {st.isValid ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={st.errors.join(", ")}>
                            ! {st.errors[0]}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(st.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 4. Step: Password & Confirm Password (Taken for all students) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
            ৪
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">শিক্ষার্থী পোর্টাল পাসওয়ার্ড (Account Password & Confirm Password)</h2>
            <p className="text-xs text-slate-500">ভর্তিকৃত সকল শিক্ষার্থীর অ্যাকাউন্টের জন্য পাসওয়ার্ড সেট করুন যা তাদের ভর্তি রসিদে উল্লেখ থাকবে</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              পাসওয়ার্ড (Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-mono shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              কনফার্ম পাসওয়ার্ড (Confirm Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className={`w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border rounded-xl focus:ring-2 text-slate-900 font-mono shadow-2xs ${
                  confirmPassword && password !== confirmPassword 
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" 
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20"
                }`}
              />
              {confirmPassword && password === confirmPassword && (
                <Check className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">পাসওয়ার্ড দুটি মিলছে না (Passwords do not match)</p>
            )}
          </div>
        </div>

        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2.5">
          <Key className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            শিক্ষার্থীরা তাদের <b>Student ID</b> (যেমন: MS-00012) এবং এই <b>পাসওয়ার্ড</b> ব্যবহার করে স্টুডেন্ট পোর্টালে লগইন করতে পারবে। প্রতিটি শিক্ষার্থীর ভর্তি রসিদে স্বয়ংক্রিয়ভাবে আইডি ও পাসওয়ার্ড মুদ্রিত হবে।
          </div>
        </div>
      </div>

      {/* 5. Execution Submit Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-xs text-slate-600">
          নির্বাচিত ব্যাচ: <b className="text-slate-900">{selectedBatch?.name || "None"}</b> • 
          ভর্তি হবে: <b className="text-indigo-600">{parsedStudents.length} জন</b>
        </div>

        <button
          type="button"
          disabled={isSubmitting || parsedStudents.length === 0 || !selectedBatchId}
          onClick={handleExecuteBulkEnroll}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>একসাথে ভর্তি সম্পন্ন হচ্ছে... (Enrolling...)</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>একসাথে ভর্তি ও স্লিপ তৈরি করুন (Enroll {parsedStudents.length} Students)</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
