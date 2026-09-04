"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Plus, Trash2, Image, Loader2, GripVertical, X, Eye, EyeOff } from "lucide-react"

interface Slide { id: string; title: string; subtitle: string; image_url: string; link_url: string; sort_order: number; is_active: boolean }

export default function SliderClient({ slides: initial }: { slides: Slide[] }) {
  const [slides, setSlides] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: "", subtitle: "", image_url: "", link_url: "" })
  const supabase = createClient()

  async function addSlide(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.from("slider_images").insert({
        title: form.title, subtitle: form.subtitle || null,
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

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500">Manage the image slider on the homepage. Add coaching center photos, announcements, etc.</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add Slide
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slides.map((slide, i) => (
          <div key={slide.id} className={`bg-white rounded-xl border ${slide.is_active ? "border-gray-200" : "border-gray-200 opacity-60"} overflow-hidden`}>
            {slide.image_url ? (
              <div className="h-40 bg-cover bg-center relative" style={{ backgroundImage: `url(${slide.image_url})` }}>
                <div className="absolute inset-0 bg-black/20" />
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded-full">#{i + 1}</span>
              </div>
            ) : (
              <div className="h-40 bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center relative">
                <Image className="w-10 h-10 text-white/30" />
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded-full">#{i + 1}</span>
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm">{slide.title || "Untitled"}</h3>
              {slide.subtitle && <p className="text-xs text-gray-500 mt-0.5">{slide.subtitle}</p>}
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => toggleActive(slide.id, slide.is_active)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${slide.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                  {slide.is_active ? <><Eye className="w-3 h-3" /> Active</> : <><EyeOff className="w-3 h-3" /> Hidden</>}
                </button>
                <button onClick={() => deleteSlide(slide.id)} className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {slides.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Image className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No slides yet. Default gradient slides will be shown.</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add New Slide</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addSlide} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} placeholder="Welcome to MedhaShiree" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label><input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className={inputClass} placeholder="Optional subtitle" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label><input required value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className={inputClass} placeholder="https://example.com/image.jpg" /><p className="text-xs text-gray-400 mt-1">Use any image hosting URL (Imgur, Cloudinary, etc.)</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label><input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} className={inputClass} placeholder="/marketplace (optional)" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : "Add Slide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}