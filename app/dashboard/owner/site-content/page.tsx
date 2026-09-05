'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bell, MessageSquare, Trash2, Plus, Save, Link2, Eye, EyeOff, Loader2, Star, CheckCircle2 } from 'lucide-react'

export default function SiteContentPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'notices' | 'feedback' | 'settings'>('notices')

  // NOTICES
  const [notices, setNotices] = useState<any[]>([])
  const [loadingNotices, setLoadingNotices] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newPriority, setNewPriority] = useState('normal')
  const [addingNotice, setAddingNotice] = useState(false)

  // FEEDBACK
  const [feedback, setFeedback] = useState<any[]>([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  // SETTINGS
  const [contactLink, setContactLink] = useState('')
  const [contactLabel, setContactLabel] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    loadNotices()
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'feedback' && feedback.length === 0) loadFeedback()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function loadNotices() {
    setLoadingNotices(true)
    try {
      const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false })
      if (data) setNotices(data)
    } catch (e) {
      console.warn('Could not load notices:', e)
    } finally {
      setLoadingNotices(false)
    }
  }

  async function loadFeedback() {
    setLoadingFeedback(true)
    try {
      const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
      if (data) setFeedback(data)
    } catch (e) {
      console.warn('Could not load feedback:', e)
    } finally {
      setLoadingFeedback(false)
    }
  }

  async function loadSettings() {
    try {
      const { data, error } = await supabase.from('site_settings').select('key, value')
      if (data && !error) {
        setContactLink(data.find((s: any) => s.key === 'contact_link')?.value || '')
        setContactLabel(data.find((s: any) => s.key === 'contact_label')?.value || '')
      } else {
        const localLink = localStorage.getItem('medhashiree_contact_link')
        const localLabel = localStorage.getItem('medhashiree_contact_label')
        if (localLink) setContactLink(localLink)
        if (localLabel) setContactLabel(localLabel)
      }
    } catch {
      const localLink = localStorage.getItem('medhashiree_contact_link')
      const localLabel = localStorage.getItem('medhashiree_contact_label')
      if (localLink) setContactLink(localLink)
      if (localLabel) setContactLabel(localLabel)
    }
  }

  async function addNotice() {
    if (!newTitle.trim() || !newContent.trim()) { toast.error('Title and content are required'); return }
    setAddingNotice(true)
    const { error } = await supabase.from('notices').insert({ title: newTitle.trim(), content: newContent.trim(), priority: newPriority })
    if (error) { toast.error('Failed to add notice (table not found in database)') } else {
      toast.success('Notice posted!')
      setNewTitle(''); setNewContent(''); setNewPriority('normal')
      loadNotices()
    }
    setAddingNotice(false)
  }

  async function toggleNotice(id: string, is_active: boolean) {
    await supabase.from('notices').update({ is_active: !is_active }).eq('id', id)
    loadNotices()
  }

  async function deleteNotice(id: string) {
    if (!confirm('Delete this notice?')) return
    await supabase.from('notices').delete().eq('id', id)
    loadNotices()
    toast.success('Notice deleted')
  }

  async function markFeedbackRead(id: string) {
    await supabase.from('feedback').update({ is_read: true }).eq('id', id)
    setFeedback(fb => fb.map(f => f.id === id ? { ...f, is_read: true } : f))
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      localStorage.setItem('medhashiree_contact_link', contactLink.trim())
      localStorage.setItem('medhashiree_contact_label', contactLabel.trim())
    } catch {}

    const upserts = [
      { key: 'contact_link', value: contactLink.trim() },
      { key: 'contact_label', value: contactLabel.trim() },
    ]
    let errorCount = 0
    for (const u of upserts) {
      try {
        const { error } = await supabase.from('site_settings').upsert(u, { onConflict: 'key' })
        if (error) errorCount++
      } catch {
        errorCount++
      }
    }

    if (errorCount === 0) {
      toast.success('Settings saved!')
    } else {
      toast.success('Settings saved locally! (Table site_settings missing in database)')
    }
    setSavingSettings(false)
  }

  const priorityBadge: Record<string, string> = {
    urgent: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    high: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    normal: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    low: 'bg-slate-800 text-slate-400 border border-slate-700',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-black text-white tracking-tight">Site Content Management</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-1">
        {[
          { id: 'notices', label: 'Notice Board', icon: Bell },
          { id: 'feedback', label: 'Feedback', icon: MessageSquare },
          { id: 'settings', label: 'Contact Settings', icon: Link2 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-semibold border-b-2 transition-all cursor-pointer ${tab === t.id ? 'border-amber-400 text-amber-400 bg-amber-500/10' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* NOTICES TAB */}
      {tab === 'notices' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl p-6 space-y-4">
            <h2 className="font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-amber-400" /> Post New Notice</h2>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Notice title" className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all" />
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Notice content..." rows={3} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all resize-none" />
            <div className="flex items-center justify-between gap-4">
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10">
                <option value="low" className="bg-slate-950 text-white">Low Priority</option>
                <option value="normal" className="bg-slate-950 text-white">Normal</option>
                <option value="high" className="bg-slate-950 text-white">High Priority</option>
                <option value="urgent" className="bg-slate-950 text-white">Urgent</option>
              </select>
              <button onClick={addNotice} disabled={addingNotice} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm cursor-pointer">
                {addingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Post Notice
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loadingNotices ? (
              <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" /></div>
            ) : notices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No notices yet.</div>
            ) : notices.map((n: any) => (
              <div key={n.id} className={`bg-slate-900/90 backdrop-blur-md rounded-2xl border p-4 flex items-start justify-between gap-4 shadow-md transition-all ${n.is_active ? 'border-slate-800' : 'border-dashed border-slate-800/80 opacity-60'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${priorityBadge[n.priority] || priorityBadge.normal}`}>{n.priority}</span>
                    <span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleDateString('en-GB')}</span>
                    {!n.is_active && <span className="text-xs text-slate-500 italic">Hidden</span>}
                  </div>
                  <p className="font-semibold text-white">{n.title}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{n.content}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleNotice(n.id, n.is_active)} className="p-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer" title={n.is_active ? 'Hide' : 'Show'}>
                    {n.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteNotice(n.id)} className="p-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEEDBACK TAB */}
      {tab === 'feedback' && (
        <div className="space-y-3">
          {loadingFeedback ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" /></div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-12 text-slate-400"><MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-600" /><p>No feedback submissions yet.</p></div>
          ) : feedback.map((f: any) => (
            <div key={f.id} className={`bg-slate-900/90 backdrop-blur-md rounded-2xl border p-5 space-y-2 transition-all ${f.is_read ? 'border-slate-800 opacity-75' : 'border-amber-500/30 shadow-lg shadow-amber-500/5'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{f.name}</p>
                    {!f.is_read && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= (f.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />)}</div>
                  </div>
                  <p className="text-xs text-slate-400">{f.email && `${f.email} · `}{f.phone && `${f.phone} · `}{new Date(f.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                {!f.is_read && (
                  <button onClick={() => markFeedbackRead(f.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 transition-colors cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Read
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-300 bg-slate-950 border border-slate-800/80 rounded-xl p-3">{f.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl p-6 space-y-5 max-w-lg">
          <h2 className="font-bold text-white flex items-center gap-2"><Link2 className="w-4 h-4 text-amber-400" /> Contact / Message Link</h2>
          <p className="text-sm text-slate-400">This link appears as a button on the homepage and hero slider. Use a WhatsApp, Messenger, email, or any URL.</p>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Button Label</label>
            <input value={contactLabel} onChange={e => setContactLabel(e.target.value)} placeholder="e.g. WhatsApp Us" className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Link URL</label>
            <input value={contactLink} onChange={e => setContactLink(e.target.value)} placeholder="https://wa.me/880..." className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 transition-all" />
            <p className="text-xs text-slate-500 mt-1">WhatsApp: https://wa.me/880XXXXXXXXXX · Messenger: https://m.me/pagename</p>
          </div>
          <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm cursor-pointer">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
        </div>
      )}
    </div>
  )
}
