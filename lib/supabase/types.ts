export type Role = "owner" | "branch_director" | "super_manager" | "manager" | "receptionist" | "teacher" | "accountant" | "course_teacher"

export interface Branch {
  id: string
  name: string
  address?: string | null
  location?: string | null
  description?: string | null
  phone?: string | null
  email?: string | null
  branch_director?: string | null
  director_phone?: string | null
  manager?: string | null
  manager_phone?: string | null
  whatsapp?: string | null
  established_year?: string | null
  contact_info?: Record<string, any> | null
  sms_gateway_config?: {
    apiKey?: string
    senderId?: string
    callType?: "GET" | "POST_FORM" | "POST_JSON"
    baseUrl?: string
    urlTemplate?: string
    params?: any[]
    headers?: Record<string, string>
    api_key?: string
    sender_id?: string
    api_url?: string
    [key: string]: any
  } | null
  is_active: boolean
  created_at?: string
}

export interface Staff {
  id: string
  auth_user_id?: string | null
  branch_id?: string | null
  branch_ids?: string[] | null
  name: string
  email: string
  phone?: string | null
  role: Role
  salary: number
  commission_rate?: number
  subject?: string | null
  has_financial_access?: boolean
  has_super_financial_access?: boolean
  is_active: boolean
  joined_at?: string
  created_at?: string
}

export interface Student {
  id: string; branch_id?: string; student_id: string; name: string
  email?: string; phone?: string; guardian_name?: string; guardian_phone: string
  guardian_relation: string; date_of_birth?: string; gender?: "male" | "female" | "other"
  address?: string; school_college?: string; class_level?: string; photo_url?: string
  biometric_enrolled: boolean; referral_code?: string; referred_by_code?: string
  is_active: boolean; enrollment_date: string; created_at: string
}

export interface Batch {
  id: string; branch_id?: string | null; name: string; subject?: string; class_level?: string
  teacher_id?: string; room_id?: string; schedule?: string; start_date?: string; end_date?: string
  max_seats: number; current_seats: number; monthly_fee: number; admission_fee: number
  fee_type: "monthly" | "quarterly" | "one_time"; is_active: boolean
  approval_status?: "approved" | "pending_approval" | "rejected"
  origin_branch_id?: string | null
  origin_batch_id?: string | null
  teacher?: Staff; branch?: Branch; origin_branch?: Branch; created_at: string
}

export interface Enrollment {
  id: string; student_id: string; batch_id: string; enrolled_by?: string
  enrollment_date: string; status: "active" | "inactive" | "transferred" | "completed"
  student?: Student; batch?: Batch; created_at: string
}

export interface Payment {
  id: string; student_id: string; batch_id?: string; enrollment_id?: string
  amount: number; discount: number; late_fee: number; total_paid: number
  payment_method: "cash" | "bkash" | "nagad" | "card" | "bank" | "online"
  transaction_id?: string; payment_for: string; payment_month?: string
  due_date?: string; paid_at: string; receipt_number: string
  student?: Student; batch?: Batch; created_at: string
}

export interface FeeDue {
  id: string; student_id: string; batch_id: string; due_month: string
  due_amount: number; due_date: string; paid_amount: number
  status: "pending" | "partial" | "paid" | "waived"
  student?: Student; batch?: Batch
}

export interface Attendance {
  id: string; student_id: string; batch_id: string; date: string
  status: "present" | "absent" | "late" | "excused"
  entry_method: "fingerprint" | "manual" | "qr"
  fee_alert_triggered: boolean; student?: Student; created_at: string
}

export interface Exam {
  id: string; branch_id?: string | null; batch_id?: string; batch_ids?: string[] | null; title: string
  exam_type: "mcq" | "written" | "mixed"; subject?: string; total_marks: number
  pass_marks: number; exam_date?: string; duration_minutes: number
  is_published: boolean; is_online?: boolean; batch?: Batch; branch?: Branch; created_at: string
}

export interface ExamResult {
  id: string; exam_id: string; student_id: string; obtained_marks?: number
  grade?: string; rank?: number; student?: Student; exam?: Exam
}

export interface Material {
  id: string; branch_id?: string | null; name: string
  type: "book" | "notes" | "worksheet" | "other"; batch_id?: string; batch_ids?: string[] | null
  subject?: string; total_stock: number; available_stock: number; price: number; created_at: string
}

export interface Course {
  id: string; teacher_id: string; title: string; description?: string
  thumbnail_url?: string; price: number; discount_price?: number; access_days: number
  commission_rate: number; category?: string; level: string; language: string
  is_published: boolean; status: "draft" | "pending_review" | "published" | "rejected"
  total_sales: number; rating: number; rating_count: number; teacher?: Staff; created_at: string
}

export interface Referral {
  id: string; referrer_id: string; referee_id: string; commission_amount: number
  commission_rate: number; status: "pending" | "approved" | "paid"
  referrer?: Student; referee?: Student; created_at: string
}

export interface Blog {
  id: string
  branch_id?: string | null
  title: string
  slug: string
  summary?: string
  content: string
  cover_image_url?: string
  author_name?: string
  category?: string
  is_published: boolean
  published_at?: string
  created_at: string
  updated_at?: string
  branch?: Branch
}

export interface Achievement {
  id: string
  branch_id?: string | null
  title: string
  subtitle?: string
  year?: string
  category?: string
  student_name?: string
  result_details?: string
  image_url?: string
  sort_order: number
  is_active: boolean
  created_at: string
  branch?: Branch
}

export interface Notice {
  id: string
  branch_id?: string | null
  title: string
  content: string
  priority: "low" | "normal" | "high" | "urgent"
  notice_date?: string
  is_active: boolean
  created_at: string
  branch?: Branch
}
