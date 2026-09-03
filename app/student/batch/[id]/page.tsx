"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency } from '@/lib/utils'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  CreditCard,
  BookOpen,
  GraduationCap,
  Info,
  Loader2
} from 'lucide-react'

export default function StudentBatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const batchId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')
  const [error, setError] = useState<string | null>(null)
  
  const [student, setStudent] = useState<any>(null)
  const [batch, setBatch] = useState<any>(null)
  const [enrollment, setEnrollment] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [dues, setDues] = useState<any[]>([])
  const [examResults, setExamResults] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  
  const supabase = createClient()
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // 1. Get current user and student profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        
        // Find user profile first
        let userProf: any = null
        const { data: byId } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        userProf = byId

        if (!userProf && user.email) {
          const { data: byEmail } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', user.email)
            .maybeSingle()
          userProf = byEmail
        }

        const currentProfile = userProf || {
          user_id: user.user_metadata?.user_id || 'MS-' + user.id.slice(0, 5).toUpperCase(),
          email: user.email,
        }

        // Find linked student record
        let studentData: any = null
        if (currentProfile.email || currentProfile.user_id) {
          const { data: sData } = await supabase
            .from('students')
            .select('*')
            .or(`email.eq.${currentProfile.email},student_id.eq.${currentProfile.user_id}`)
            .maybeSingle()
          studentData = sData
        }
           
        if (!studentData) throw new Error('Student profile not found')
        setStudent(studentData)
        const studentId = studentData.id
        
        // 2. Get batch info
        const { data: batchData, error: batchError } = await supabase
          .from('batches')
          .select('*, teacher:staff(name), room:rooms(name)')
          .eq('id', batchId)
          .single()
          
        if (batchError || !batchData) throw new Error('Batch not found')
        setBatch(batchData)
        
        // 3. Get enrollment info
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .single()
          
        if (enrollData) setEnrollment(enrollData)
        
        // 4. Get attendance
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .order('date', { ascending: false })
          
        if (attData) setAttendance(attData)
        
        // 5. Get payments & dues
        const { data: paymentData } = await supabase
          .from('payments')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .order('paid_at', { ascending: false })
          
        if (paymentData) setPayments(paymentData)
        
        const { data: dueData } = await supabase
          .from('fee_dues')
          .select('*')
          .eq('student_id', studentId)
          .eq('batch_id', batchId)
          .in('status', ['pending', 'partial'])
          .order('due_month', { ascending: false })
          
        if (dueData) setDues(dueData)
        
        // 6. Get exam results
        const { data: examData } = await supabase
          .from('exam_results')
          .select('*, exam:exams(title, exam_date, total_marks, pass_marks, batch_id)')
          .eq('student_id', studentId)
          
        if (examData) {
          const batchExams = examData.filter((r: any) => r.exam?.batch_id === batchId)
          setExamResults(batchExams)
        }
        
        // 7. Get material issues
        const { data: materialData } = await supabase
          .from('material_issues')
          .select('*, material:materials(name, type, batch_id)')
          .eq('student_id', studentId)
          
        if (materialData) {
          const batchMaterials = materialData.filter((m: any) => m.material?.batch_id === batchId)
          setMaterials(batchMaterials)
        }
        
      } catch (err: any) {
        console.error('Error fetching data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    if (batchId) {
      fetchData()
    }
  }, [batchId, router, supabase])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="rounded-2xl bg-red-50 p-6 text-red-600 border border-red-100 flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-10 w-10" />
          <h2 className="text-xl font-semibold">Error Loading Batch</h2>
          <p>{error || 'Batch details could not be found.'}</p>
          <Link href="/student/profile" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            Return to Profile
          </Link>
        </div>
      </div>
    )
  }

  const presentCount = attendance.filter(a => a.status === 'present').length
  const attendancePercentage = attendance.length > 0 
    ? Math.round((presentCount / attendance.length) * 100) 
    : 0
    
  const totalDuesAmount = dues.reduce((sum, due) => sum + (due.due_amount - (due.paid_amount || 0)), 0)

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6 pb-20">
      {/* Header & Back Button */}
      <div className="flex items-center gap-4">
        <Link 
          href="/student/profile" 
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
      </div>

      {/* Batch Header Card */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-900 opacity-20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wider uppercase mb-4 backdrop-blur-sm border border-white/10">
                {batch.subject}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{batch.name}</h1>
              <div className="flex items-center gap-2 text-indigo-100 mt-2">
                <User className="h-4 w-4 opacity-80" />
                <span>{batch.teacher?.name || 'TBA'}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 bg-black/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm md:min-w-64">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-indigo-200" />
                <div>
                  <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Schedule</div>
                  <div className="font-medium text-white">{batch.schedule || 'Not scheduled'}</div>
                </div>
              </div>
              <div className="h-px bg-white/10 w-full my-1"></div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-indigo-200" />
                <div>
                  <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Room</div>
                  <div className="font-medium text-white">{batch.room?.name || 'TBA'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">Attendance</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{attendancePercentage}%</div>
          <div className="text-xs text-slate-400 mt-1">{presentCount} of {attendance.length} days</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CreditCard className="h-4 w-4 text-rose-500" />
            <span className="text-sm font-medium">Pending Dues</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{formatCurrency(totalDuesAmount)}</div>
          <div className="text-xs text-slate-400 mt-1">{dues.length} pending items</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <GraduationCap className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">Exams Taken</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{examResults.length}</div>
          <div className="text-xs text-slate-400 mt-1">Recorded results</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Materials</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{materials.length}</div>
          <div className="text-xs text-slate-400 mt-1">Issued items</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto py-2 no-scrollbar gap-2 sticky top-0 bg-slate-50/90 backdrop-blur z-20 -mx-4 px-4 md:mx-0 md:px-0">
        {[
          { id: 'info', label: 'Info', icon: Info },
          { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
          { id: 'fees', label: 'Fees & Dues', icon: CreditCard },
          { id: 'exams', label: 'Exam Results', icon: GraduationCap },
          { id: 'materials', label: 'Materials', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
            `}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'opacity-100' : 'opacity-70'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[400px]">
        {/* INFO TAB */}
        {activeTab === 'info' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <Info className="h-5 w-5 text-indigo-500" />
              Batch Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Batch Name</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.name}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Subject</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.subject}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Class Level</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.class_level || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Teacher</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.teacher?.name || 'TBA'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Schedule</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.schedule || 'N/A'}</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Fee Type</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900 capitalize">{batch.fee_type || 'N/A'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Monthly Fee</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{formatCurrency(batch.monthly_fee || 0)}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Admission Fee</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{formatCurrency(batch.admission_fee || 0)}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">Start Date</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.start_date ? formatDate(batch.start_date) : 'N/A'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                  <div className="text-sm text-slate-500 font-medium">End Date</div>
                  <div className="col-span-2 text-sm font-medium text-slate-900">{batch.end_date ? formatDate(batch.end_date) : 'N/A'}</div>
                </div>
              </div>
            </div>
            
            {enrollment && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-md font-semibold text-slate-800 mb-4">Enrollment Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-slate-500 font-medium">Enrollment Date</div>
                    <div className="col-span-2 text-sm font-medium text-slate-900">{formatDate(enrollment.enrollment_date)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-slate-500 font-medium">Status</div>
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${
                        enrollment.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        enrollment.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {enrollment.status || 'active'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                Attendance Record
              </h3>
              <div className="text-sm font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600">
                Overall: <span className={attendancePercentage >= 75 ? 'text-emerald-600' : attendancePercentage >= 50 ? 'text-amber-500' : 'text-red-500'}>{attendancePercentage}%</span>
              </div>
            </div>
            
            {attendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map((record: any, idx: number) => (
                      <tr key={record.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            record.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 
                            record.status === 'absent' ? 'bg-rose-100 text-rose-700' : 
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {record.note || <span className="text-slate-400 italic">No notes</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>No attendance records found for this batch.</p>
              </div>
            )}
          </div>
        )}

        {/* FEES & DUES TAB */}
        {activeTab === 'fees' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-500" />
              Pending Dues
            </h3>
            
            {dues.length > 0 ? (
              <div className="grid gap-4 mb-8">
                {dues.map((due: any, idx: number) => (
                  <div key={due.id || idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-rose-100 bg-rose-50/50 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-100 text-rose-600 rounded-lg shrink-0 mt-0.5">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800">Fee for {due.due_month ? new Date(due.due_month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Unknown Month'}</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          Amount due: <span className="font-semibold text-slate-900">{formatCurrency(due.due_amount - (due.paid_amount || 0))}</span>
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center self-start md:self-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 capitalize border border-rose-200">
                      {due.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 mb-8 text-center text-slate-500 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 mb-3" />
                <p className="font-medium text-emerald-800">All caught up!</p>
                <p className="text-sm mt-1">No pending dues for this batch.</p>
              </div>
            )}
            
            <h3 className="text-lg font-semibold text-slate-800 mb-4 mt-8 flex items-center gap-2 pt-6 border-t border-slate-100">
              <FileText className="h-5 w-5 text-indigo-500" />
              Payment History
            </h3>
            
            {payments.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Method</th>
                      <th className="px-6 py-4 font-medium">Receipt No</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((payment: any, idx: number) => (
                      <tr key={payment.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                          {formatDate(payment.paid_at)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 capitalize">
                          {payment.payment_method || '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                          {payment.receipt_number || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                            payment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {payment.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 border border-slate-200 border-dashed rounded-xl">
                <p>No payment history found for this batch.</p>
              </div>
            )}
          </div>
        )}

        {/* EXAM RESULTS TAB */}
        {activeTab === 'exams' && (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-500" />
                Exam Results
              </h3>
            </div>
            
            {examResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Exam Name</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Marks</th>
                      <th className="px-6 py-4 font-medium">%</th>
                      <th className="px-6 py-4 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {examResults.map((result: any, idx: number) => {
                      const totalMarks = result.exam?.total_marks || 100
                      const obtained = result.marks_obtained || 0
                      const percentage = Math.round((obtained / totalMarks) * 100)
                      const passMarks = result.exam?.pass_marks || 0
                      const passed = obtained >= passMarks
                      
                      return (
                        <tr key={result.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {result.exam?.title || 'Unknown Exam'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                            {result.exam?.exam_date ? formatDate(result.exam.exam_date) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-900">{obtained}</span>
                            <span className="text-slate-400"> / {totalMarks}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {percentage}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {result.grade || '-'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-500">
                <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>No exam results recorded for this batch yet.</p>
              </div>
            )}
          </div>
        )}

        {/* MATERIALS TAB */}
        {activeTab === 'materials' && (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                Issued Materials
              </h3>
            </div>
            
            {materials.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-medium">Item</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Issued Date</th>
                      <th className="px-6 py-4 font-medium">Due Date</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((item: any, idx: number) => {
                      const isReturned = !!item.returned_at
                      const isOverdue = !isReturned && item.return_due_date && new Date(item.return_due_date) < new Date()
                      
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {item.material?.name || 'Unknown Item'}
                          </td>
                          <td className="px-6 py-4 capitalize text-slate-500">
                            {item.material?.type || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.issued_at ? formatDate(item.issued_at) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.return_due_date ? formatDate(item.return_due_date) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            {isReturned ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                Returned on {formatDate(item.returned_at)}
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                                Overdue
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                Issued
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center text-slate-500">
                <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p>No materials have been issued to you for this batch.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
