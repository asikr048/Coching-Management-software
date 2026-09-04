"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import {
  GraduationCap, Loader2, CheckCircle, ArrowRight, ArrowLeft,
  Copy, Check, User, Phone, Mail, Calendar, BookOpen, MapPin,
  Users, Lock, Clock, Sparkles, Video
} from "lucide-react"

interface Batch {
  id: string
  name: string
  subject: string | null
  class_level: string | null
  monthly_fee: number | null
  admission_fee: number | null
  schedule_days?: string | null
  schedule_time?: string | null
  description?: string | null
  max_seats?: number
  current_seats?: number
  status?: string
}

interface Course {
  id: string
  title: string
  description?: string | null
  price: number
  discount_price?: number | null
  category?: string | null
  level?: string | null
}

interface Gateways {
  [key: string]: {
    number: string
    type: string
  }
}

const DEFAULT_GATEWAYS: Gateways = {
  bkash: { number: "01302201431", type: "Send Money (Personal)" },
  nagad: { number: "01302201431", type: "Send Money (Personal)" },
  rocket: { number: "01302201431", type: "Send Money (Personal)" },
  upay: { number: "01302201431", type: "Send Money (Personal)" },
}

function EnrollContent() {
  const searchParams = useSearchParams()
  const batchIdParam = searchParams.get("batchId") || searchParams.get("batch") || ""
  const courseIdParam = searchParams.get("courseId") || searchParams.get("course") || ""
  const supabase = createClient()

  // Enrollment Type: "batch" or "course"
  const [enrollType, setEnrollType] = useState<"batch" | "course">(courseIdParam ? "course" : "batch")

  // State
  const [step, setStep] = useState<"admission" | "payment" | "success">("admission")
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [batches, setBatches] = useState<Batch[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batchIdParam)
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseIdParam)

  // Gateways loaded from site_settings / payment_accounts
  const [gateways, setGateways] = useState<Gateways>(DEFAULT_GATEWAYS)

  // Form State (Admission Form)
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "male",
    date_of_birth: "",
    class_level: "",
    school_college: "",
    address: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_relation: "Parent",
    referred_by_code: "",
  })

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<string>("bkash")
  const [senderNumber, setSenderNumber] = useState<string>("")
  const [transactionId, setTransactionId] = useState<string>("")

  // Submission Results
  const [submittedStudentId, setSubmittedStudentId] = useState<string>("")
  const [submittedStudentDbId, setSubmittedStudentDbId] = useState<string>("")
  const [existingPending, setExistingPending] = useState(false)
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)

  // Copy helpers
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [copiedStudentId, setCopiedStudentId] = useState(false)

  // Update admission form fields
  function updateForm(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  // Active target number based on selected payment method
  const activeGateway = gateways[paymentMethod] || gateways.bkash || { number: "01302201431", type: "Send Money" }
  const activeTargetNumber = activeGateway.number || "01302201431"
  const activeTargetType = activeGateway.type || "Send Money"

  // Load batches, courses, gateway numbers and site settings
  useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      try {
        // 1. Fetch active batches
        const { data: batchList, error: batchErr } = await supabase
          .from("batches")
          .select("id, name, subject, class_level, monthly_fee, admission_fee, schedule_days, schedule_time, description, max_seats, current_seats, status")
          .eq("is_active", true)
          .order("name")

        if (!batchErr && batchList) {
          setBatches(batchList)
          if (batchIdParam && batchList.some(b => b.id === batchIdParam)) {
            setSelectedBatchId(batchIdParam)
          } else if (batchList.length > 0 && !selectedBatchId) {
            setSelectedBatchId(batchList[0].id)
          }
        }

        // 2. Fetch published courses
        const { data: courseList, error: courseErr } = await supabase
          .from("courses")
          .select("id, title, description, price, discount_price, category, level")
          .eq("status", "published")
          .order("title")

        if (!courseErr && courseList) {
          setCourses(courseList)
          if (courseIdParam && courseList.some(c => c.id === courseIdParam)) {
            setSelectedCourseId(courseIdParam)
            setEnrollType("course")
          } else if (courseList.length > 0 && !selectedCourseId && courseIdParam) {
            setSelectedCourseId(courseList[0].id)
          }
        }

        // 3. Fetch payment numbers from site_settings and payment_accounts
        const newGateways: Gateways = { ...DEFAULT_GATEWAYS }
        try {
          const { data: settingsData } = await supabase
            .from("site_settings")
            .select("key, value")
            .in("key", [
              "payment_number_bkash", "payment_number_nagad", "payment_number_rocket", "payment_number_upay",
              "payment_type_bkash", "payment_type_nagad", "payment_type_rocket", "payment_type_upay",
              "contact_phone"
            ])

          if (settingsData) {
            const sm: Record<string, string> = {}
            settingsData.forEach(s => { sm[s.key] = s.value })

            const fallbackPhone = sm["contact_phone"] || "01302201431"

            newGateways.bkash = {
              number: sm["payment_number_bkash"] || fallbackPhone,
              type: sm["payment_type_bkash"] || "Send Money",
            }
            newGateways.nagad = {
              number: sm["payment_number_nagad"] || fallbackPhone,
              type: sm["payment_type_nagad"] || "Send Money",
            }
            newGateways.rocket = {
              number: sm["payment_number_rocket"] || fallbackPhone,
              type: sm["payment_type_rocket"] || "Send Money",
            }
            newGateways.upay = {
              number: sm["payment_number_upay"] || fallbackPhone,
              type: sm["payment_type_upay"] || "Send Money",
            }
          }

          // Also check payment_accounts table
          const { data: accountsData } = await supabase
            .from("payment_accounts")
            .select("method, account_number, account_name, is_active")
            .eq("is_active", true)

          if (accountsData) {
            accountsData.forEach(acc => {
              const m = acc.method?.toLowerCase()
              if (m && newGateways[m]) {
                if (acc.account_number) newGateways[m].number = acc.account_number
                if (acc.account_name) newGateways[m].type = acc.account_name
              }
            })
          }
        } catch (settingsErr) {
          console.warn("Gateway numbers load warning:", settingsErr)
        }
        setGateways(newGateways)

        // 4. Check if user is logged in — auto-fill student info
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          if (user.email) {
            updateForm("email", user.email)
          }
          const { data: student } = await supabase
            .from("students")
            .select("*")
            .or(`email.eq.${user.email || ""},auth_user_id.eq.${user.id}`)
            .maybeSingle()

          if (student) {
            setForm(prev => ({
              ...prev,
              name: student.name || prev.name,
              phone: student.phone || prev.phone,
              email: student.email || prev.email,
              gender: student.gender || prev.gender,
              date_of_birth: student.date_of_birth || prev.date_of_birth,
              class_level: student.class_level || prev.class_level,
              school_college: student.school_college || prev.school_college,
              address: student.address || prev.address,
              guardian_name: student.guardian_name || prev.guardian_name,
              guardian_phone: student.guardian_phone || prev.guardian_phone,
              guardian_relation: student.guardian_relation || prev.guardian_relation,
              referred_by_code: student.referred_by_code || prev.referred_by_code,
            }))
            setSubmittedStudentId(student.student_id)
            setSubmittedStudentDbId(student.id)

            // Check if already enrolled / pending for this batch
            if (enrollType === "batch") {
              const targetBatch = batchIdParam || (batchList && batchList[0]?.id)
              if (targetBatch) {
                const { data: enr } = await supabase
                  .from("enrollments")
                  .select("id")
                  .eq("student_id", student.id)
                  .eq("batch_id", targetBatch)
                  .eq("status", "active")
                  .maybeSingle()
                if (enr) setAlreadyEnrolled(true)

                const { data: pend } = await supabase
                  .from("payment_submissions")
                  .select("id")
                  .eq("student_id", student.id)
                  .eq("batch_id", targetBatch)
                  .eq("status", "pending")
                  .maybeSingle()
                if (pend) setExistingPending(true)
              }
            } else {
              // Course check
              const targetCourse = courseIdParam || (courseList && courseList[0]?.id)
              if (targetCourse) {
                const { data: cp } = await supabase
                  .from("course_purchases")
                  .select("id")
                  .eq("student_id", student.id)
                  .eq("course_id", targetCourse)
                  .maybeSingle()
                if (cp) setAlreadyEnrolled(true)
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading initial data:", err)
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [batchIdParam, courseIdParam, enrollType])

  // Current selected batch or course
  const selectedBatch = batches.find(b => b.id === selectedBatchId) || batches[0]
  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0]

  const isCourse = enrollType === "course"

  // Calculate pricing
  const batchMonthlyFee = Number(selectedBatch?.monthly_fee || 0)
  const batchAdmissionFee = Number(selectedBatch?.admission_fee || 0)
  const batchTotal = batchMonthlyFee + batchAdmissionFee

  const coursePrice = selectedCourse ? Number(selectedCourse.price || 0) : 0
  const totalAmount = isCourse ? coursePrice : batchTotal

  // Validate and advance from Step 1 to Step 2
  function handleProceedToPayment(e: React.FormEvent) {
    e.preventDefault()

    if (isCourse) {
      if (!selectedCourse) {
        toast.error("Please select a course to enroll in")
        return
      }
      if (!form.name.trim()) {
        toast.error("Please enter your full name")
        return
      }
      if (!form.phone.trim() || form.phone.trim().length < 11) {
        toast.error("Please enter a valid 11-digit phone number (01XXXXXXXXX)")
        return
      }
    } else {
      if (!selectedBatch) {
        toast.error("Please select a batch to enroll in")
        return
      }
      if (!form.name.trim()) {
        toast.error("Please enter your full name")
        return
      }
      if (!form.phone.trim() || form.phone.trim().length < 11) {
        toast.error("Please enter a valid 11-digit student phone number (01XXXXXXXXX)")
        return
      }
      if (!form.guardian_phone.trim() || form.guardian_phone.trim().length < 11) {
        toast.error("Please enter a valid 11-digit guardian phone number (01XXXXXXXXX)")
        return
      }
    }

    // Default sender number to student's phone for convenience
    if (!senderNumber && form.phone.trim()) {
      setSenderNumber(form.phone.trim())
    }

    window.scrollTo({ top: 0, behavior: "smooth" })
    setStep("payment")
  }

  // Submit payment in Step 2
  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault()

    if (!paymentMethod) {
      toast.error("Please select a payment method (bKash, Nagad, Rocket, or Upay)")
      return
    }
    if (!senderNumber.trim() || senderNumber.trim().length < 11) {
      toast.error("Please enter your 11-digit sender phone number (01XXXXXXXXX)")
      return
    }
    if (!transactionId.trim() || transactionId.trim().length < 4) {
      toast.error("Please enter the Transaction ID (TrxID) from your payment SMS/App")
      return
    }

    setSubmitting(true)
    try {
      let stDbId = submittedStudentDbId
      let stCode = submittedStudentId

      // 1. Check if student already exists in DB by phone or email
      if (!stDbId) {
        if (form.phone.trim()) {
          const { data: stByPhone } = await supabase
            .from("students")
            .select("id, student_id")
            .eq("phone", form.phone.trim())
            .maybeSingle()
          if (stByPhone) {
            stDbId = stByPhone.id
            stCode = stByPhone.student_id
          }
        }
        if (!stDbId && form.email.trim()) {
          const { data: stByEmail } = await supabase
            .from("students")
            .select("id, student_id")
            .eq("email", form.email.trim())
            .maybeSingle()
          if (stByEmail) {
            stDbId = stByEmail.id
            stCode = stByEmail.student_id
          }
        }
      }

      // 2. If student does not exist, insert new student record
      if (!stDbId) {
        const genId = `MS-${String(Math.floor(10000 + Math.random() * 90000))}`
        const { data: newStudent, error: createErr } = await supabase
          .from("students")
          .insert({
            student_id: genId,
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim() || null,
            gender: form.gender,
            date_of_birth: form.date_of_birth || null,
            guardian_name: form.guardian_name.trim() || null,
            guardian_phone: form.guardian_phone.trim() || form.phone.trim(),
            guardian_relation: form.guardian_relation,
            school_college: form.school_college.trim() || null,
            class_level: form.class_level.trim() || null,
            address: form.address.trim() || null,
            referred_by_code: form.referred_by_code.trim() || null,
          })
          .select("id, student_id")
          .single()

        if (createErr) throw createErr
        stDbId = newStudent.id
        stCode = newStudent.student_id
      } else {
        // Update existing student details
        await supabase
          .from("students")
          .update({
            name: form.name.trim(),
            ...(form.guardian_name.trim() ? { guardian_name: form.guardian_name.trim() } : {}),
            ...(form.guardian_phone.trim() ? { guardian_phone: form.guardian_phone.trim() } : {}),
            ...(form.school_college.trim() ? { school_college: form.school_college.trim() } : {}),
            ...(form.class_level.trim() ? { class_level: form.class_level.trim() } : {}),
            ...(form.address.trim() ? { address: form.address.trim() } : {}),
            ...(form.referred_by_code.trim() ? { referred_by_code: form.referred_by_code.trim() } : {}),
          })
          .eq("id", stDbId)
      }

      setSubmittedStudentDbId(stDbId)
      setSubmittedStudentId(stCode)

      if (isCourse && selectedCourse) {
        // Check for already purchased course
        const { data: activeCp } = await supabase
          .from("course_purchases")
          .select("id")
          .eq("student_id", stDbId)
          .eq("course_id", selectedCourse.id)
          .maybeSingle()

        if (activeCp) {
          setAlreadyEnrolled(true)
          setStep("success")
          toast.info("You have already purchased this course! View it in your student dashboard.")
          return
        }

        // Insert payment submission for course
        const { error: paySubErr } = await supabase
          .from("payment_submissions")
          .insert({
            student_id: stDbId,
            course_id: selectedCourse.id,
            item_type: "course",
            amount: totalAmount,
            total_fee: totalAmount,
            due_amount: 0,
            payment_method: paymentMethod.toLowerCase(),
            sender_number: senderNumber.trim(),
            transaction_id: transactionId.trim().toUpperCase(),
            status: "pending",
            notes: `Online Course enrollment for ${selectedCourse.title}. Student: ${form.name} (${form.phone}).`,
          })

        if (paySubErr) throw paySubErr
      } else if (selectedBatch) {
        // Check for already active enrollment in this batch
        const { data: activeEnr } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", stDbId)
          .eq("batch_id", selectedBatch.id)
          .eq("status", "active")
          .maybeSingle()

        if (activeEnr) {
          setAlreadyEnrolled(true)
          setStep("success")
          toast.info("You are already enrolled in this batch! Go to your profile to view courses.")
          return
        }

        // Check for duplicate pending payment submission for this batch
        const { data: existingSub } = await supabase
          .from("payment_submissions")
          .select("id, transaction_id")
          .eq("student_id", stDbId)
          .eq("batch_id", selectedBatch.id)
          .eq("status", "pending")
          .maybeSingle()

        if (existingSub) {
          setExistingPending(true)
          setStep("success")
          toast.info("You already have a pending payment submitted for this batch!")
          return
        }

        // Insert payment submission for batch
        const { error: paySubErr } = await supabase
          .from("payment_submissions")
          .insert({
            student_id: stDbId,
            batch_id: selectedBatch.id,
            item_type: "batch",
            amount: totalAmount,
            total_fee: totalAmount,
            due_amount: 0,
            payment_method: paymentMethod.toLowerCase(),
            sender_number: senderNumber.trim(),
            transaction_id: transactionId.trim().toUpperCase(),
            status: "pending",
            notes: `Batch enrollment for ${selectedBatch.name}. Student: ${form.name} (${form.phone}).`,
          })

        if (paySubErr) throw paySubErr
      }

      window.scrollTo({ top: 0, behavior: "smooth" })
      setStep("success")
      toast.success("Payment submitted successfully! Admin will verify and activate your access.")
    } catch (err: unknown) {
      console.error("Submission error:", err)
      toast.error(err instanceof Error ? err.message : "Failed to submit payment. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Copy actions
  function handleCopyPhone() {
    navigator.clipboard.writeText(activeTargetNumber)
    setCopiedPhone(true)
    toast.success(`${paymentMethod.toUpperCase()} number copied!`)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  function handleCopyAmount() {
    navigator.clipboard.writeText(String(totalAmount))
    setCopiedAmount(true)
    toast.success("Amount copied!")
    setTimeout(() => setCopiedAmount(false), 2000)
  }

  function handleCopyStudentId() {
    navigator.clipboard.writeText(submittedStudentId)
    setCopiedStudentId(true)
    toast.success("Student ID copied!")
    setTimeout(() => setCopiedStudentId(false), 2000)
  }

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
  const labelClass = "block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5"

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-500">Loading enrollment details...</p>
        </div>
      </div>
    )
  }

  // ==========================================
  // STEP 3: SUCCESS CONFIRMATION
  // ==========================================
  if (step === "success") {
    const itemName = isCourse ? (selectedCourse?.title || "Online Course") : (selectedBatch?.name || "Coaching Batch")
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col justify-between p-4 md:p-8">
        <div className="max-w-2xl mx-auto w-full pt-6 pb-12">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black bg-gradient-to-r from-white via-indigo-200 to-cyan-400 bg-clip-text text-transparent">
                MedhaShiree
              </span>
            </Link>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden text-center">
            <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
              {alreadyEnrolled
                ? "Already Enrolled! 🎓"
                : existingPending
                ? "Payment Pending Verification! ⏳"
                : "Payment Submitted Successfully! 🎉"}
            </h1>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              {alreadyEnrolled
                ? `You have already completed enrollment for this ${isCourse ? "course" : "batch"}. You can access your classes from your profile.`
                : "Your payment details have been received securely. An admin will verify the transaction and grant access within 24 hours."}
            </p>

            {/* Student ID Card */}
            {submittedStudentId && (
              <div className="bg-[#142036] border border-[#223354] rounded-2xl p-5 mb-6 max-w-sm mx-auto">
                <p className="text-xs uppercase font-bold tracking-wider text-cyan-400 mb-1">Your Student ID</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-black font-mono tracking-wider text-white">
                    {submittedStudentId}
                  </span>
                  <button
                    onClick={handleCopyStudentId}
                    className="p-2 bg-[#1e2f4c] hover:bg-[#283e63] border border-[#314a73] rounded-lg transition-colors cursor-pointer"
                    title="Copy Student ID"
                  >
                    {copiedStudentId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-300" />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Save this ID for logging in and accessing coaching updates.</p>
              </div>
            )}

            {/* Summary details */}
            <div className="bg-[#111a2e] border border-[#1b2a47] rounded-xl p-4 text-left text-xs space-y-2 mb-8 max-w-md mx-auto">
              <div className="flex justify-between py-1 border-b border-[#1c2c4a]">
                <span className="text-gray-400">Student Name</span>
                <span className="font-semibold text-white">{form.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1c2c4a]">
                <span className="text-gray-400">{isCourse ? "Enrolled Course" : "Batch"}</span>
                <span className="font-semibold text-cyan-300">{itemName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1c2c4a]">
                <span className="text-gray-400">Total Amount</span>
                <span className="font-bold text-emerald-400">{formatCurrency(totalAmount)}</span>
              </div>
              {paymentMethod && (
                <div className="flex justify-between py-1 border-b border-[#1c2c4a]">
                  <span className="text-gray-400">Payment Method</span>
                  <span className="font-semibold text-white uppercase">{paymentMethod}</span>
                </div>
              )}
              {senderNumber && (
                <div className="flex justify-between py-1 border-b border-[#1c2c4a]">
                  <span className="text-gray-400">Sender Number</span>
                  <span className="font-mono text-white">{senderNumber}</span>
                </div>
              )}
              {transactionId && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Transaction ID</span>
                  <span className="font-mono text-cyan-400 font-bold">{transactionId}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <Link
                href="/student/profile"
                className="flex-1 py-3 px-5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 text-center"
              >
                Go to My Profile
              </Link>
              <Link
                href="/"
                className="flex-1 py-3 px-5 bg-[#1e293b] hover:bg-[#334155] text-gray-200 font-semibold rounded-xl text-sm transition-all text-center border border-[#334155]"
              >
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-500 pb-4">
          © {new Date().getFullYear()} MedhaShiree Coaching Management. All rights reserved.
        </footer>
      </div>
    )
  }

  // ==========================================
  // STEP 2: PAYMENT SCREEN (Matching Image 2 Reference)
  // ==========================================
  if (step === "payment") {
    const isBkash = paymentMethod === "bkash"
    const isNagad = paymentMethod === "nagad"
    const isRocket = paymentMethod === "rocket"
    const isUpay = paymentMethod === "upay"

    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
        {/* Top Navigation Bar */}
        <header className="border-b border-[#152238] bg-[#090f1c]/90 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between">
          <button
            onClick={() => setStep("admission")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#121c2e] hover:bg-[#1a2842] text-gray-300 hover:text-white border border-[#1f304e] text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <h1 className="text-base md:text-lg font-bold text-white tracking-wide">
            Complete Purchase
          </h1>

          <div className="w-20 text-right">
            <span className="text-xs text-cyan-400 font-mono font-medium hidden sm:inline-block">Step 2 of 2</span>
          </div>
        </header>

        {/* Main Payment Container */}
        <main className="max-w-5xl mx-auto w-full px-4 py-8 md:py-12 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Package details, Total Amount, Pay Via & Instructions */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Batch / Package Card */}
              <div className="bg-[#0e1728] border border-[#1a2b47] rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-600/30">
                    {isCourse ? <Video className="w-7 h-7 text-white" /> : <GraduationCap className="w-7 h-7 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isCourse ? (
                      <>
                        <h2 className="text-lg font-bold text-white leading-snug">
                          {selectedCourse?.title} <span className="text-cyan-400 font-normal">📦 : Online Video Course • {selectedCourse?.category || "General"}</span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {selectedCourse?.description || "Complete video course with class materials, quizzes, and instant access upon approval."}
                        </p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-bold text-white leading-snug">
                          {selectedBatch?.name} <span className="text-cyan-400 font-normal">📦 : {selectedBatch?.class_level || "Academic"} • {selectedBatch?.subject || "Coaching"}</span>
                        </h2>
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {selectedBatch?.description || `Join our ${selectedBatch?.name} batch for comprehensive coaching with expert instructors, regular mock tests, and personalized progress tracking.`}
                        </p>
                        {selectedBatch?.schedule_days && (
                          <div className="flex items-center gap-3 mt-3 text-xs text-indigo-300/90 font-medium">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {selectedBatch.schedule_days}</span>
                            {selectedBatch.schedule_time && (
                              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {selectedBatch.schedule_time}</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Amount Box */}
              <div className="bg-[#0e1728] border border-[#1a2b47] rounded-2xl p-6 flex items-center justify-between shadow-xl">
                <span className="text-gray-300 font-medium text-sm md:text-base">Total Amount</span>
                <span className="text-3xl md:text-4xl font-black text-[#00ffff] tracking-tight drop-shadow-[0_0_12px_rgba(0,255,255,0.4)]">
                  ৳{totalAmount}
                </span>
              </div>

              {/* PAY VIA row (Clickable Badges to switch active number) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">PAY VIA (CLICK TO SELECT)</p>
                  <span className="text-xs text-cyan-400 font-medium">Selected: <strong className="uppercase">{paymentMethod}</strong></span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("bkash")}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      isBkash
                        ? "bg-[#e2136e] text-white border-[#e2136e] shadow-lg shadow-[#e2136e]/30 scale-[1.02]"
                        : "bg-[#e2136e]/10 text-[#ff4b94] border-[#e2136e]/30 hover:bg-[#e2136e]/20"
                    }`}
                  >
                    <span className="text-sm font-extrabold">bKash</span>
                    <span className="text-[10px] opacity-80">{gateways.bkash?.number || "01302201431"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("nagad")}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      isNagad
                        ? "bg-[#f05a22] text-white border-[#f05a22] shadow-lg shadow-[#f05a22]/30 scale-[1.02]"
                        : "bg-[#f05a22]/10 text-[#ff7a45] border-[#f05a22]/30 hover:bg-[#f05a22]/20"
                    }`}
                  >
                    <span className="text-sm font-extrabold">Nagad</span>
                    <span className="text-[10px] opacity-80">{gateways.nagad?.number || "01302201431"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("rocket")}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      isRocket
                        ? "bg-[#8c3fa8] text-white border-[#8c3fa8] shadow-lg shadow-[#8c3fa8]/30 scale-[1.02]"
                        : "bg-[#8c3fa8]/10 text-[#ba68c8] border-[#8c3fa8]/30 hover:bg-[#8c3fa8]/20"
                    }`}
                  >
                    <span className="text-sm font-extrabold">Rocket</span>
                    <span className="text-[10px] opacity-80">{gateways.rocket?.number || "01302201431"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("upay")}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      isUpay
                        ? "bg-[#00a884] text-white border-[#00a884] shadow-lg shadow-[#00a884]/30 scale-[1.02]"
                        : "bg-[#00a884]/10 text-[#20c997] border-[#00a884]/30 hover:bg-[#00a884]/20"
                    }`}
                  >
                    <span className="text-sm font-extrabold">Upay</span>
                    <span className="text-[10px] opacity-80">{gateways.upay?.number || "01302201431"}</span>
                  </button>
                </div>
              </div>

              {/* HOW TO PAY section (Dynamically shows selected method's configured number) */}
              <div className="bg-[#0e1728]/90 border border-[#1a2b47] rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#00ffff] uppercase tracking-wider">
                    HOW TO PAY VIA {paymentMethod.toUpperCase()}
                  </p>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                    {activeTargetType}
                  </span>
                </div>
                
                <div className="space-y-3.5 text-xs md:text-sm text-gray-300">
                  <div className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">📱</span>
                    <p className="leading-relaxed">
                      Open your <strong className="text-cyan-400 font-bold uppercase">{paymentMethod}</strong> App — or Dial USSD on Phone
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">👉</span>
                    <p className="leading-relaxed">
                      Choose <strong className="text-[#00ffff] font-bold">&quot;{activeTargetType}&quot;</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base flex-shrink-0">📞</span>
                    <span className="text-gray-300">Send to ({paymentMethod.toUpperCase()}):</span>
                    <span className="px-3 py-1 rounded-lg bg-[#16233a] border border-[#23375c] text-pink-300 font-mono font-bold text-sm tracking-wider">
                      {activeTargetNumber}
                    </span>
                    <button
                      onClick={handleCopyPhone}
                      type="button"
                      className="px-3 py-1 bg-[#1a2a46] hover:bg-[#253b61] text-xs font-medium text-gray-200 hover:text-white rounded-lg border border-[#2f4874] transition-colors cursor-pointer"
                    >
                      {copiedPhone ? "✓ Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base flex-shrink-0">💰</span>
                    <span className="text-gray-300">Enter exact amount:</span>
                    <span className="px-3 py-0.5 rounded-lg bg-[#00ffff]/15 text-[#00ffff] font-mono font-bold text-sm border border-[#00ffff]/30">
                      {totalAmount}
                    </span>
                    <span className="text-gray-400">BDT</span>
                    <button
                      onClick={handleCopyAmount}
                      type="button"
                      className="px-2.5 py-1 bg-[#1a2a46] hover:bg-[#253b61] text-xs font-medium text-gray-200 hover:text-white rounded-lg border border-[#2f4874] transition-colors cursor-pointer"
                    >
                      {copiedAmount ? "✓ Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-0.5">🔑</span>
                    <p className="leading-relaxed">
                      Enter your <strong className="text-cyan-300 font-semibold">PIN</strong> to confirm and note down the <strong className="text-yellow-300">Transaction ID</strong>
                    </p>
                  </div>
                </div>

                {/* Edit Admission Form Button (Satisfies 'form is edited in payment') */}
                <div className="pt-4 border-t border-[#182842] flex items-center justify-between">
                  <div className="text-xs text-gray-400 truncate max-w-[240px] sm:max-w-none">
                    Student: <strong className="text-white">{form.name}</strong> • <span className="font-mono">{form.phone}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("admission")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    Edit Details ✎
                  </button>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Payment Details Form */}
            <div className="lg:col-span-5">
              <form onSubmit={handleSubmitPayment} className="bg-[#0e1728] border border-[#1a2b47] rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
                
                <div>
                  <h3 className="text-xs font-bold text-[#00ffff] uppercase tracking-wider">
                    PAYMENT DETAILS
                  </h3>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Payment Method <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-[#142036] border border-[#223354] rounded-xl text-white text-sm focus:outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff] transition-all cursor-pointer"
                  >
                    <option value="bkash" className="bg-[#0e1728] text-white">bKash ({gateways.bkash?.number})</option>
                    <option value="nagad" className="bg-[#0e1728] text-white">Nagad ({gateways.nagad?.number})</option>
                    <option value="rocket" className="bg-[#0e1728] text-white">Rocket ({gateways.rocket?.number})</option>
                    <option value="upay" className="bg-[#0e1728] text-white">Upay ({gateways.upay?.number})</option>
                  </select>
                </div>

                {/* Sender Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Your Sender Number <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={senderNumber}
                    onChange={e => setSenderNumber(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-4 py-3.5 bg-[#142036] border border-[#223354] rounded-xl text-white text-sm font-mono focus:outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff] transition-all placeholder-gray-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">Enter the phone number you sent money from</p>
                </div>

                {/* Transaction ID */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Transaction ID (TrxID) <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value)}
                    placeholder="e.g. ABC1234XYZ"
                    className="w-full px-4 py-3.5 bg-[#142036] border border-[#223354] rounded-xl text-white text-sm font-mono uppercase focus:outline-none focus:border-[#00ffff] focus:ring-1 focus:ring-[#00ffff] transition-all placeholder-gray-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5">Found in your bKash / Nagad / Rocket confirmation SMS</p>
                </div>

                {/* Security Guarantee Box */}
                <div className="bg-[#091b2e]/80 border border-[#11395f] rounded-xl p-4 flex items-start gap-3">
                  <Lock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-sky-200/90 leading-relaxed">
                    Your payment info is submitted securely. An admin will verify your transaction and grant access within 24 hours.
                  </p>
                </div>

                {/* Submit Payment Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl bg-[#00ffff] hover:bg-[#1fe6f7] active:bg-[#00d0e0] text-black font-extrabold text-base tracking-wide transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-black" />
                      Submitting Payment...
                    </>
                  ) : (
                    <>
                      Submit Payment ✓
                    </>
                  )}
                </button>

                {/* Cancel link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("admission")}
                    className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel &amp; Edit Details
                  </button>
                </div>
              </form>
            </div>

          </div>
        </main>

        <footer className="border-t border-[#121c2e] py-4 text-center text-xs text-gray-500">
          MedhaShiree • Direct Online Payment Gateway
        </footer>
      </div>
    )
  }

  // ==========================================
  // STEP 1: ENROLLMENT FORM (BATCH OR COURSE)
  // ==========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/40">
      {/* Top Navbar */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-indigo-700 to-violet-700 bg-clip-text text-transparent">
              MedhaShiree
            </span>
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-200">
            <span>Step 1: {isCourse ? "Student Info" : "Admission Form"}</span>
            <ArrowRight className="w-3 h-3 text-indigo-400" />
            <span className="text-gray-400 font-normal">Step 2: Payment</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-4 py-1.5 rounded-full mb-3 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> {isCourse ? "Online Course Enrollment" : "Batch Admission Form"}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
            {isCourse ? (
              <>
                Course <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Enrollment</span>
              </>
            ) : (
              <>
                Student <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Admission</span>
              </>
            )}
          </h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {isCourse
              ? "Provide your basic student details below, then proceed to direct online payment."
              : "Fill in your student & guardian information below, then proceed to the payment step."}
          </p>

          {/* Toggle between Batch and Course if available */}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200">
              <button
                type="button"
                onClick={() => setEnrollType("batch")}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  !isCourse ? "bg-white text-indigo-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Classroom Batch
              </button>
              <button
                type="button"
                onClick={() => setEnrollType("course")}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isCourse ? "bg-white text-purple-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Video className="w-4 h-4" />
                Online Course
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleProceedToPayment} className="space-y-6">
          
          {/* Program Selection Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCourse ? "bg-purple-50 text-purple-600" : "bg-indigo-50 text-indigo-600"}`}>
                  {isCourse ? <Video className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {isCourse ? "Select Online Course" : "Enrolling Batch"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isCourse ? "Choose the online video course you want to purchase" : "Select the batch program you are enrolling in"}
                  </p>
                </div>
              </div>

              {/* Selector Dropdown */}
              <div className="sm:w-72">
                {isCourse ? (
                  <select
                    value={selectedCourseId}
                    onChange={e => setSelectedCourseId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} — {formatCurrency(c.price)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedBatchId}
                    onChange={e => setSelectedBatchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.class_level || "All"})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Selected Summary Banner */}
            {isCourse && selectedCourse ? (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 rounded-xl border border-purple-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-900 text-base">{selectedCourse.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Online Course • {selectedCourse.category || "General"} • Lifetime Portal Access
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Course Fee</p>
                  <p className="text-2xl font-black text-purple-700">{formatCurrency(selectedCourse.price)}</p>
                </div>
              </div>
            ) : selectedBatch ? (
              <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50/60 to-violet-50/60 rounded-xl border border-indigo-100/80 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-900 text-base">{selectedBatch.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedBatch.class_level || "All Levels"} • {selectedBatch.subject || "General"}
                    {selectedBatch.schedule_days ? ` • ${selectedBatch.schedule_days}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Payable</p>
                  <p className="text-2xl font-black text-indigo-700">{formatCurrency(totalAmount)}</p>
                  {batchAdmissionFee > 0 && (
                    <p className="text-[11px] text-gray-400">Monthly ৳{batchMonthlyFee} + Admission ৳{batchAdmissionFee}</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Student Personal Information */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className={`px-6 py-4 flex items-center justify-between ${isCourse ? "bg-gradient-to-r from-purple-600 to-indigo-600" : "bg-gradient-to-r from-indigo-600 to-violet-600"}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-white text-base">Student Information</h3>
              </div>
              {isCourse && (
                <span className="text-xs px-2.5 py-0.5 bg-white/20 text-white rounded-full font-medium">
                  No extra info required
                </span>
              )}
            </div>
            
            {/* If COURSE: Only student name and phone (and optional email). No extra information! */}
            {isCourse ? (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Student Full Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      value={form.name}
                      onChange={e => updateForm("name", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone Number (bKash/SMS) <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={e => updateForm("phone", e.target.value)}
                      className={`${inputClass} pl-10 font-mono`}
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Email Address (For login / course updates)</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => updateForm("email", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="student@example.com (optional)"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* If BATCH: Full student information */
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      value={form.name}
                      onChange={e => updateForm("name", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="Enter student's full name"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={e => updateForm("phone", e.target.value)}
                      className={`${inputClass} pl-10 font-mono`}
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => updateForm("email", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="student@example.com (optional)"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Gender</label>
                  <select
                    value={form.gender}
                    onChange={e => updateForm("gender", e.target.value)}
                    className={inputClass}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Class / Level</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.class_level}
                      onChange={e => updateForm("class_level", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="e.g. Class 9, Class 10, HSC 1st Year"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={e => updateForm("date_of_birth", e.target.value)}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>School / College Name</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.school_college}
                      onChange={e => updateForm("school_college", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="e.g. Dhaka College, Ideal School"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Present Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.address}
                      onChange={e => updateForm("address", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="Area / Street address"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guardian Information (Only rendered for Batch enrollment) */}
          {!isCourse && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-white text-base">Guardian Information</h3>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Guardian Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.guardian_name}
                      onChange={e => updateForm("guardian_name", e.target.value)}
                      className={`${inputClass} pl-10`}
                      placeholder="Father / Mother / Guardian Name"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Guardian Phone Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="tel"
                      value={form.guardian_phone}
                      onChange={e => updateForm("guardian_phone", e.target.value)}
                      className={`${inputClass} pl-10 font-mono`}
                      placeholder="01XXXXXXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Relationship</label>
                  <select
                    value={form.guardian_relation}
                    onChange={e => updateForm("guardian_relation", e.target.value)}
                    className={inputClass}
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Legal Guardian</option>
                    <option value="Parent">Parent</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Referral Code (Optional)</label>
                  <input
                    value={form.referred_by_code}
                    onChange={e => updateForm("referred_by_code", e.target.value)}
                    className={inputClass}
                    placeholder="Referral code if recommended"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Button: Proceed to Payment */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-indigo-300/40 hover:shadow-indigo-400/50 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99]"
            >
              <span>Proceed to Payment</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              You will be redirected to the payment screen to send fee via bKash, Nagad, Rocket, or Upay.
            </p>
          </div>

        </form>

        <p className="text-center text-gray-400 text-xs mt-10">
          © {new Date().getFullYear()} MedhaShiree · All rights reserved
        </p>
      </div>
    </div>
  )
}

export default function PublicEnrollPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
  )
}
