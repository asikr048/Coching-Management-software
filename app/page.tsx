"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils"
import { GraduationCap, BookOpen, Users, User, Clock, Calendar, MapPin, Star, ArrowRight, Phone, Mail, ChevronRight, ChevronLeft, CheckCircle, TrendingUp, Shield, Bell, MessageSquare, Send, Loader2, Megaphone, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const [batches, setBatches] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [studentCount, setStudentCount] = useState<number>(0)
  const [slides, setSlides] = useState<any[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [notices, setNotices] = useState<any[]>([])
  const [contactLink, setContactLink] = useState('https://wa.me/8801302201431')
  const [contactLabel, setContactLabel] = useState('Contact Us')

  // Feedback form state
  const [fbName, setFbName] = useState('')
  const [fbEmail, setFbEmail] = useState('')
  const [fbPhone, setFbPhone] = useState('')
  const [fbMessage, setFbMessage] = useState('')
  const [fbRating, setFbRating] = useState(5)
  const [fbSubmitting, setFbSubmitting] = useState(false)
  const [fbDone, setFbDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUser(user)
          const { data: staff } = await supabase.from("staff").select("role").eq("auth_user_id", user.id).maybeSingle()
          setUserRole(staff?.role || "student")
        }
      } catch {}
      try {
        const { data: b } = await supabase.from("batches").select("*, teacher:staff(name)").eq("is_active", true).order("created_at", { ascending: false })
        if (b) setBatches(b)
      } catch {}
      try {
        const { data: c } = await supabase.from("courses").select("*, teacher:staff(name)").eq("status", "published").order("total_sales", { ascending: false }).limit(6)
        if (c) setCourses(c)
      } catch {}
      try {
        const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true)
        if (count) setStudentCount(count)
      } catch {}
      try {
        const { data: s } = await supabase.from("slider_images").select("*").eq("is_active", true).order("sort_order")
        if (s) setSlides(s)
      } catch {}
      // Notices
      try {
        const { data: n } = await supabase.from("notices").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(10)
        if (n) setNotices(n)
      } catch {}
      // Site settings (contact link)
      try {
        const { data: settings } = await supabase.from("site_settings").select("key, value")
        if (settings) {
          const link = settings.find((s: any) => s.key === 'contact_link')?.value
          const label = settings.find((s: any) => s.key === 'contact_label')?.value
          if (link) setContactLink(link)
          if (label) setContactLabel(label)
        }
      } catch {}
    }
    load()
  }, [])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => setCurrentSlide(i => (i + 1) % slides.length), 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  async function submitFeedback() {
    if (!fbName.trim() || !fbMessage.trim()) return
    setFbSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('feedback').insert({
        name: fbName.trim(),
        email: fbEmail.trim() || null,
        phone: fbPhone.trim() || null,
        message: fbMessage.trim(),
        rating: fbRating,
      })
      if (error) throw error
      setFbDone(true)
      setFbName(''); setFbEmail(''); setFbPhone(''); setFbMessage(''); setFbRating(5)
    } catch { } finally { setFbSubmitting(false) }
  }

  const defaultSlides = slides.length > 0 ? slides : [
    { title: "Welcome to MedhaShiree", subtitle: "Rajshahi's Premier Coaching Center", image_url: "" },
    { title: "Expert Teachers", subtitle: "Learn from the best faculty", image_url: "" },
    { title: "Admissions Open 2026", subtitle: "Limited seats available — enroll now", image_url: "" },
  ]

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 border-red-300 text-red-800',
    high: 'bg-amber-100 border-amber-300 text-amber-800',
    normal: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    low: 'bg-gray-50 border-gray-200 text-gray-700',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-xl border-b border-gray-200/60 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Medha<span className="text-indigo-600">Shiree</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <a href="#batches" className="px-4 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">Batches</a>
            <a href="#courses" className="px-4 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">Courses</a>
            <a href="#notices" className="px-4 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">Notices</a>
            <Link href="/parent-portal" className="px-4 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">Parent Portal</Link>
          </div>
          <div className="flex items-center gap-2">
            <a href={contactLink} target="_blank" rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
              <MessageSquare className="w-4 h-4" /> {contactLabel}
            </a>
            {currentUser ? (
              <Link href={["owner", "super_manager", "manager"].includes(userRole || "") ? "/dashboard/owner" : userRole === "teacher" ? "/dashboard/teacher" : userRole === "receptionist" ? "/dashboard/reception" : userRole === "accountant" ? "/dashboard/accountant" : "/student/profile"}
                className="px-4 py-2 text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-1.5 border border-indigo-200/80">
                <User className="w-4 h-4" /> {["owner", "super_manager", "manager"].includes(userRole || "") ? "Admin Panel" : "My Profile"}
              </Link>
            ) : (
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">Sign In</Link>
            )}
            <a href="#batches" className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all">Enroll Now</a>
          </div>
        </div>
      </nav>

      {/* IMAGE SLIDER HERO */}
      <section className="pt-16 relative">
        <div className="relative h-[500px] md:h-[600px] overflow-hidden">
          {defaultSlides.map((slide, i) => (
            <div key={i} className={`absolute inset-0 transition-all duration-700 ease-in-out ${i === currentSlide % defaultSlides.length ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}>
              {slide.image_url ? (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${slide.image_url})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-gray-900/20" />
                </div>
              ) : (
                <div className={`absolute inset-0 ${["bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700", "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700", "bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600"][i % 3]}`} />
              )}
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                  <div className="max-w-2xl">
                    <h2 className="text-4xl md:text-6xl font-extrabold text-white leading-tight drop-shadow-lg">{slide.title}</h2>
                    {slide.subtitle && <p className="mt-4 text-xl text-white/80 drop-shadow">{slide.subtitle}</p>}
                    <div className="mt-8 flex gap-3">
                      <a href="#batches" className="px-7 py-3.5 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 shadow-xl transition-all">Enroll Now</a>
                      <a href="#batches" className="px-7 py-3.5 border-2 border-white/40 text-white rounded-xl font-semibold hover:bg-white/10 backdrop-blur transition-all">View Batches</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Slider Controls */}
          {defaultSlides.length > 1 && (
            <>
              <button onClick={() => setCurrentSlide(i => (i - 1 + defaultSlides.length) % defaultSlides.length)} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all z-10">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={() => setCurrentSlide(i => (i + 1) % defaultSlides.length)} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all z-10">
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {defaultSlides.map((_, i) => (
                  <button key={i} onClick={() => setCurrentSlide(i)} className={`h-2 rounded-full transition-all ${i === currentSlide % defaultSlides.length ? "w-8 bg-white" : "w-2 bg-white/50"}`} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Stats Strip */}
      <section className="relative -mt-16 z-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            {[
              { label: "Active Students", value: studentCount || "500+", icon: Users, color: "text-indigo-600 bg-indigo-50" },
              { label: "Expert Teachers", value: "20+", icon: GraduationCap, color: "text-violet-600 bg-violet-50" },
              { label: "Active Batches", value: batches.length || "10+", icon: BookOpen, color: "text-emerald-600 bg-emerald-50" },
              { label: "Success Rate", value: "95%", icon: Star, color: "text-amber-600 bg-amber-50" },
            ].map((s, i) => (
              <div key={i} className="p-6 text-center">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Users, title: "Batch Management", desc: "Organized schedule & seats", bg: "from-indigo-500 to-violet-500" },
            { icon: Shield, title: "Biometric Entry", desc: "Automated attendance", bg: "from-emerald-500 to-teal-500" },
            { icon: TrendingUp, title: "Result Tracking", desc: "Grades, ranks & analytics", bg: "from-orange-500 to-rose-500" },
            { icon: BookOpen, title: "Course Sales", desc: "Online marketplace", bg: "from-cyan-500 to-blue-500" },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className={`w-14 h-14 bg-gradient-to-br ${f.bg} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <p className="font-bold text-gray-900">{f.title}</p>
              <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Batches */}
      <section id="batches" className="py-24 px-4 bg-gradient-to-b from-indigo-50/50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">Choose Your Batch</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Available Batches</h2>
              <p className="mt-2 text-gray-500 max-w-lg">Select a batch that fits your schedule. Each batch has limited seats.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map(batch => {
              const seatsLeft = batch.max_seats - (batch.current_seats || 0)
              return (
                <Link key={batch.id} href={`/batch/${batch.id}`} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300">
                  <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div><h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{batch.name}</h3><p className="text-sm text-gray-500 mt-0.5">{batch.subject || "General"} &bull; {batch.class_level || "All Levels"}</p></div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${seatsLeft <= 5 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{seatsLeft} left</span>
                    </div>
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="w-4 h-4 text-gray-400" />{batch.teacher?.name || "Expert Teacher"}</div>
                      {batch.schedule_days && <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar className="w-4 h-4 text-gray-400" />{batch.schedule_days}</div>}
                      {batch.schedule_time && <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="w-4 h-4 text-gray-400" />{batch.schedule_time}</div>}
                    </div>
                    <div className="mb-4"><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${seatsLeft <= 5 ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${((batch.current_seats || 0) / batch.max_seats) * 100}%` }} /></div></div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div><span className="text-2xl font-bold text-gray-900">{formatCurrency(batch.monthly_fee)}</span><span className="text-sm text-gray-400">/mo</span></div>
                      <span className="flex items-center gap-1 text-sm font-semibold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Enroll <ChevronRight className="w-4 h-4" /></span>
                    </div>
                  </div>
                </Link>
              )
            })}
            {batches.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-lg">Batches coming soon!</p>
                <p className="text-gray-400 text-sm mt-1">Contact us to learn about upcoming batches.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">Learn Online</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Online Courses</h2>
            <p className="mt-2 text-gray-500 max-w-lg mx-auto">Learn at your own pace with courses crafted by our best teachers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => (
              <div key={course.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="h-40 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative overflow-hidden">
                  <BookOpen className="w-10 h-10 text-white/20" />
                  <span className="absolute top-3 right-3 px-2.5 py-1 bg-black/20 backdrop-blur rounded-lg text-white text-xs font-medium capitalize">{course.level}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{course.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description || "Comprehensive course material"}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} className={`w-3 h-3 ${i < Math.round(course.rating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />)}</div>
                    <span className="text-xs text-gray-500">({course.rating_count})</span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">{course.teacher?.name} &bull; {course.total_sales} enrolled</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(course.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {courses.length === 0 && <div className="text-center py-12"><p className="text-gray-400">Courses coming soon!</p></div>}
        </div>
      </section>

      {/* Why Us */}
      <section className="py-24 px-4 bg-gradient-to-b from-white to-indigo-50/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">Why Choose Us</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">Everything you need to<br />succeed academically</h2>
              <div className="mt-8 space-y-5">
                {[
                  { title: "Structured Batch System", desc: "Choose from multiple batch schedules. Each batch is limited to 30 students for personal attention." },
                  { title: "Expert Faculty", desc: "Subject matter experts with years of coaching experience and proven track records." },
                  { title: "Smart Tracking", desc: "Biometric attendance, digital payments, exam results, and parent SMS notifications." },
                  { title: "Affordable Fees", desc: "Quality education at competitive pricing with flexible payment options." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mt-0.5"><CheckCircle className="w-4 h-4 text-indigo-600" /></div>
                    <div><p className="font-semibold text-gray-900">{item.title}</p><p className="text-sm text-gray-500 mt-0.5">{item.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center"><GraduationCap className="w-8 h-8 text-white" /></div>
                  <div><p className="text-4xl font-bold">95%</p><p className="text-white/70 text-sm">Pass Rate</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur"><p className="text-2xl font-bold">{studentCount || "500"}+</p><p className="text-white/70 text-xs mt-1">Students</p></div>
                  <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur"><p className="text-2xl font-bold">20+</p><p className="text-white/70 text-xs mt-1">Teachers</p></div>
                  <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur"><p className="text-2xl font-bold">{batches.length || "10"}+</p><p className="text-white/70 text-xs mt-1">Batches</p></div>
                  <div className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur"><p className="text-2xl font-bold">7+</p><p className="text-white/70 text-xs mt-1">Years</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-[2rem] p-12 md:p-16 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-60" />
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">Ready to Start Your<br />Academic Journey?</h2>
              <p className="mt-4 text-white/60 text-lg max-w-xl mx-auto">Join hundreds of students who trust MedhaShiree.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <a href="#batches" className="px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 shadow-xl transition-all">Enroll Now</a>
                <Link href="/parent-portal" className="px-8 py-4 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition-all">Parent Portal</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-950 text-gray-400 pt-16 pb-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-gray-800">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center"><GraduationCap className="w-4 h-4 text-white" /></div>
                <span className="text-lg font-bold text-white">Medha<span className="text-indigo-400">Shiree</span></span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">Rajshahi&apos;s premier coaching center. Quality education, expert teachers, and a proven track record of student success.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Quick Links</h4>
              <div className="space-y-2.5 text-sm">
                <p><a href="#batches" className="hover:text-white transition-colors">View Batches</a></p>
                <p><a href="#batches" className="hover:text-white transition-colors">Enroll Now</a></p>
                <p><Link href="/parent-portal" className="hover:text-white transition-colors">Parent Portal</Link></p>
                <p><Link href="/marketplace" className="hover:text-white transition-colors">Online Courses</Link></p>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Contact</h4>
              <div className="space-y-2.5 text-sm">
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 flex-shrink-0" /> Rajshahi, Bangladesh</p>
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 flex-shrink-0" /> 01302201431</p>
                <p className="flex items-center gap-2"><Mail className="w-4 h-4 flex-shrink-0" /> info@medhashiree.com</p>
              </div>
            </div>
          </div>
          <div className="pt-8 text-center text-xs text-gray-600"><p>&copy; {new Date().getFullYear()} MedhaShiree. All rights reserved.</p></div>
        </div>
      </footer>
    </div>
  )
}
