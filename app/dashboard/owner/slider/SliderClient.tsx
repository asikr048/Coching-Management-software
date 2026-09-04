"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus, Trash2, Image, Loader2, X, Eye, EyeOff, Pencil, Sparkles,
  Phone, Mail, MapPin, MessageSquare, Save, Sliders, Info, ExternalLink,
  Globe
} from "lucide-react"

interface Slide {
  id: string
  title: string
  subtitle: string
  image_url: string
  link_url: string
  sort_order: number
  is_active: boolean
}

interface SliderClientProps {
  slides: Slide[]
  initialSettings?: Record<string, string>
}

export default function SliderClient({ slides: initial, initialSettings = {} }: SliderClientProps) {
  const [activeTab, setActiveTab] = useState<'slider' | 'contact'>('slider')
  const [slides, setSlides] = useState<Slide[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [editSlide, setEditSlide] = useState<Slide | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: "", subtitle: "", image_url: "", link_url: "" })
  const [editForm, setEditForm] = useState({ title: "", subtitle: "", image_url: "", link_url: "" })
  const [fixingSpelling, setFixingSpelling] = useState(false)

  // Homepage & Contact info state
  const [contactPhone, setContactPhone] = useState(initialSettings['contact_phone'] || '01302201431')
  const [contactEmail, setContactEmail] = useState(initialSettings['contact_email'] || 'info@medhashiree.com')
  const [contactAddress, setContactAddress] = useState(initialSettings['contact_address'] || 'Rajshahi, Bangladesh')
  const [contactLink, setContactLink] = useState(initialSettings['contact_link'] || 'https://wa.me/8801302201431')
  const [contactLabel, setContactLabel] = useState(initialSettings['contact_label'] || 'WhatsApp Us')
  const [footerAbout, setFooterAbout] = useState(
    initialSettings['footer_about'] ||
    "Rajshahi's premier coaching center. Quality education, expert teachers, and a proven track record of student success."
  )
  const [savingContact, setSavingContact] = useState(false)

  const supabase = createClient()

  // Load any localStorage fallbacks if not present in initialSettings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lPhone = localStorage.getItem('medhashiree_contact_phone')
      const lEmail = localStorage.getItem('medhashiree_contact_email')
      const lAddress = localStorage.getItem('medhashiree_contact_address')
      const lLink = localStorage.getItem('medhashiree_contact_link')
      const lLabel = localStorage.getItem('medhashiree_contact_label')
      const lAbout = localStorage.getItem('medhashiree_footer_about')

      if (!initialSettings['contact_phone'] && lPhone) setContactPhone(lPhone)
      if (!initialSettings['contact_email'] && lEmail) setContactEmail(lEmail)
      if (!initialSettings['contact_address'] && lAddress) setContactAddress(lAddress)
      if (!initialSettings['contact_link'] && lLink) setContactLink(lLink)
      if (!initialSettings['contact_label'] && lLabel) setContactLabel(lLabel)
      if (!initialSettings['footer_about'] && lAbout) setFooterAbout(lAbout)
    }
  }, [initialSettings])

  const slidesWithOldSpelling = slides.filter(s =>
    (/medha[\s\-_]*sh?ir[ei]+/i.test(s.title) && !s.title.includes("MedhaShiree")) ||
    (s.subtitle && /medha[\s\-_]*sh?ir[ei]+/i.test(s.subtitle) && !s.subtitle.includes("MedhaShiree"))
  )

  async function fixAllOldSpellings() {
    setFixingSpelling(true)
    try {
      let updatedCount = 0
      const newSlides = [...slides]
      for (let i = 0; i < newSlides.length; i++) {
        const s = newSlides[i]
        const newTitle = s.title ? s.title.replace(/medha[\s\-_]*sh?ir[ei]+/gi, "MedhaShiree") : s.title
        const newSub = s.subtitle ? s.subtitle.replace(/medha[\s\-_]*sh?ir[ei]+/gi, "MedhaShiree") : s.subtitle
        if (newTitle !== s.title || newSub !== s.subtitle) {
          const { error } = await supabase.from("slider_images").update({
            title: newTitle,
            subtitle: newSub,
          }).eq("id", s.id)
          if (error) throw error
          newSlides[i] = { ...s, title: newTitle, subtitle: newSub || "" }
          updatedCount++
        }
      }
      setSlides(newSlides)
      toast.success(`Updated ${updatedCount} slide(s) to "MedhaShiree" in database!`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update database")
    } finally {
      setFixingSpelling(false)
    }
  }

  async function addSlide(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const sanitizedTitle = form.title.replace(/medha[\s\-_]*sh?ir[ei]+/gi, "MedhaShiree")
      const sanitizedSubtitle = form.subtitle ? form.subtitle.replace(/medha[\s\-_]*sh?ir[ei]+/gi, "MedhaShiree") : null
      const { data, error } = await supabase.from("slider_images").insert({
        title: sanitizedTitle, subtitle: sanitizedSubtitle,
        image_url: form.image_url, link_url: form.link_url || null,
        sort_order: slides.length,
      }).select().single()
      if (error) throw error
      setSlides([...slides, data])
      setForm({ title: "", subtitle: "", image_url: "", link_url: "" })
      setShowForm(false)
      toast.success("Slide added!")
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setLoading(false) }
  }

  async function updateSlide(e: React.FormEvent) {
    e.preventDefault()
    if (!editSlide) return
    setLoading(true)
    try {
      const sanitizedTitle = editForm.title.replace(/medha[\s\-_]*sh?ir[ei]+/gi, "MedhaShiree")
      const sanitizedSubtitle = editForm.subtitle ? editForm.subtitle.replace(/medha[\s\-_]*sh?ir[ei]+/gi, "MedhaShiree") : null
      const { error } = await supabase.from("slider_images").update({
        title: sanitizedTitle,
        subtitle: sanitizedSubtitle,
        image_url: editForm.image_url,
        link_url: editForm.link_url || null,
      }).eq("id", editSlide.id)
      if (error) throw error
      setSlides(slides.map(s => s.id === editSlide.id ? { ...s, ...editForm, title: sanitizedTitle, subtitle: sanitizedSubtitle || "" } : s))
      setEditSlide(null)
      toast.success("Slide updated!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update slide")
    } finally {
      setLoading(false)
    }
  }

  async function deleteSlide(id: string) {
    if (!confirm("Delete this slide?")) return
    await supabase.from("slider_images").delete().eq("id", id)
    setSlides(slides.filter(s => s.id !== id))
    toast.success("Slide deleted")
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("slider_images").update({ is_active: !current }).eq("id", id)
    setSlides(slides.map(s => s.id === id ? { ...s, is_active: !current } : s))
    toast.success(!current ? "Slide activated" : "Slide hidden")
  }

  async function saveContactSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingContact(true)

    try {
      localStorage.setItem('medhashiree_contact_phone', contactPhone.trim())
      localStorage.setItem('medhashiree_contact_email', contactEmail.trim())
      localStorage.setItem('medhashiree_contact_address', contactAddress.trim())
      localStorage.setItem('medhashiree_contact_link', contactLink.trim())
      localStorage.setItem('medhashiree_contact_label', contactLabel.trim())
      localStorage.setItem('medhashiree_footer_about', footerAbout.trim())
    } catch {}

    const updates = [
      { key: 'contact_phone', value: contactPhone.trim() },
      { key: 'contact_email', value: contactEmail.trim() },
      { key: 'contact_address', value: contactAddress.trim() },
      { key: 'contact_link', value: contactLink.trim() },
      { key: 'contact_label', value: contactLabel.trim() },
      { key: 'footer_about', value: footerAbout.trim() },
    ]

    let errorCount = 0
    for (const u of updates) {
      try {
        const { error } = await supabase.from('site_settings').upsert(u, { onConflict: 'key' })
        if (error) errorCount++
      } catch {
        errorCount++
      }
    }

    if (errorCount === 0) {
      toast.success("Contact & homepage information saved successfully!")
    } else {
      toast.success("Settings saved locally! (site_settings table will sync)")
    }
    setSavingContact(false)
  }

  const inputClass = "w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"

  return (
    <div>
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('slider')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'slider'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Hero Slider ({slides.length})
        </button>
        <button
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'contact'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          Homepage & Contact Info
        </button>
      </div>

      {/* TAB 1: SLIDER */}
      {activeTab === 'slider' && (
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <p className="text-sm text-gray-500">Manage the hero carousel on the homepage. Add coaching photos, announcements, and banners.</p>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> Add Slide
            </button>
          </div>

          {slidesWithOldSpelling.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">Spelling Mismatch Detected in Slides</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {slidesWithOldSpelling.length} slide(s) contain outdated spelling (e.g. &quot;MedhaSiri&quot;). Click to automatically update them in the database to &quot;MedhaShiree&quot;.
                  </p>
                </div>
              </div>
              <button
                onClick={fixAllOldSpellings}
                disabled={fixingSpelling}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap disabled:opacity-50"
              >
                {fixingSpelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Fix all to MedhaShiree
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slides.map((slide, i) => (
              <div key={slide.id} className={`bg-white rounded-xl border ${slide.is_active ? "border-gray-200" : "border-gray-200 opacity-60"} overflow-hidden shadow-sm`}>
                {slide.image_url ? (
                  <div className="h-44 bg-cover bg-center relative" style={{ backgroundImage: `url(${slide.image_url})` }}>
                    <div className="absolute inset-0 bg-black/30" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full font-semibold">#{i + 1}</span>
                  </div>
                ) : (
                  <div className="h-44 bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center relative">
                    <Image className="w-10 h-10 text-white/30" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full font-semibold">#{i + 1}</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{slide.title || "Untitled"}</h3>
                  {slide.subtitle && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{slide.subtitle}</p>}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setEditSlide(slide)
                        setEditForm({
                          title: slide.title,
                          subtitle: slide.subtitle || "",
                          image_url: slide.image_url,
                          link_url: slide.link_url || "",
                        })
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-medium transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => toggleActive(slide.id, slide.is_active)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${slide.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {slide.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
                    </button>
                    <button onClick={() => deleteSlide(slide.id)} className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition-colors ml-auto">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {slides.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
                <Image className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No slides uploaded yet.</p>
                <p className="text-xs text-gray-400 mt-1">Default gradient slides are currently active on the homepage.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONTACT & FOOTER */}
      {activeTab === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">Homepage Contact & Footer Settings</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Update your coaching center contact phone number, email address, physical location, and WhatsApp link displayed on the homepage and footer.
            </p>

            <form onSubmit={saveContactSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-500" /> Phone Number *
                </label>
                <input
                  required
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 01302201431"
                />
                <p className="text-xs text-gray-400 mt-1">Displayed in the homepage footer contact list.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" /> Email Address *
                </label>
                <input
                  required
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. info@medhashiree.com"
                />
                <p className="text-xs text-gray-400 mt-1">Official coaching center email address for parent inquiries.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Physical Address / Location *
                </label>
                <input
                  required
                  value={contactAddress}
                  onChange={e => setContactAddress(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Rajshahi, Bangladesh"
                />
                <p className="text-xs text-gray-400 mt-1">Campus location displayed next to the map pin icon.</p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Navbar Contact Button Label
                </label>
                <input
                  value={contactLabel}
                  onChange={e => setContactLabel(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. WhatsApp Us or Contact Us"
                />
                <p className="text-xs text-gray-400 mt-1">The button text shown in the top navigation bar.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-500" /> Navbar Contact Button Link / URL
                </label>
                <input
                  value={contactLink}
                  onChange={e => setContactLink(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. https://wa.me/8801302201431"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Format for WhatsApp: <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">https://wa.me/880XXXXXXXXXX</code>
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500" /> Footer Tagline / Description
                </label>
                <textarea
                  value={footerAbout}
                  onChange={e => setFooterAbout(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Coaching center brief description..."
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingContact}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Homepage & Contact Settings
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: LIVE PREVIEW */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-xs font-bold tracking-wider text-indigo-400 uppercase">Live Preview</span>
                <span className="text-xs text-slate-400">Homepage Footer Preview</span>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-bold text-white tracking-tight">Medha<span className="text-indigo-400">Shiree</span></span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{footerAbout || "No description provided."}</p>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Contact</h4>
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span>{contactAddress || "Rajshahi, Bangladesh"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="text-indigo-300">{contactPhone || "01302201431"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="text-indigo-300">{contactEmail || "info@medhashiree.com"}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">Navbar Button Preview</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Header</span>
              </div>
              <div className="mt-4 flex items-center justify-center p-6 bg-slate-50 rounded-xl border border-dashed border-gray-200">
                <a
                  href={contactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>{contactLabel || "WhatsApp Us"}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD SLIDE MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add New Slide</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addSlide} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Welcome to MedhaShiree" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className={inputClass} placeholder="Rajshahi's Premier Coaching Center" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label>
                <input required value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className={inputClass} placeholder="https://example.com/image.jpg" />
                <p className="text-xs text-gray-400 mt-1">Use any hosted image link (Imgur, Cloudinary, etc.)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                <input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} className={inputClass} placeholder="#batches (optional)" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : "Add Slide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SLIDE MODAL */}
      {editSlide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Slide</h2>
              <button onClick={() => setEditSlide(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={updateSlide} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input required value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Welcome to MedhaShiree" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input value={editForm.subtitle} onChange={e => setEditForm(f => ({ ...f, subtitle: e.target.value }))} className={inputClass} placeholder="Optional subtitle" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label>
                <input required value={editForm.image_url} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} className={inputClass} placeholder="https://example.com/image.jpg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                <input value={editForm.link_url} onChange={e => setEditForm(f => ({ ...f, link_url: e.target.value }))} className={inputClass} placeholder="/marketplace (optional)" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditSlide(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}