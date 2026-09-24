"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import {
  Settings, Smartphone, Shield, Plus, X, Loader2, Trash2, ToggleLeft, ToggleRight,
  UserCheck, Crown, Phone, CheckCircle, Palette, Sparkles, Upload, Image as ImageIcon,
  Check, RefreshCw, FileText, CreditCard, IdCard, ExternalLink, Globe, MapPin, Mail,
  GraduationCap
} from "lucide-react"
import { useBranding } from "@/components/providers/BrandingContext"
import {
  ThemeColor,
  THEME_PALETTES,
  PRESET_LOGOS,
  DEFAULT_BRANDING,
  InstituteBranding,
  isPresetLogoUrl,
  hexToRgb,
} from "@/lib/branding"

interface PaymentAccount {
  id: string; method: string; account_number: string; account_name: string | null; is_active: boolean
}
interface PaymentApprover {
  id: string; staff_id: string; staff?: { name: string; email: string; role: string }
}
interface StaffMember {
  id: string; name: string; email: string; role: string
}

const methodLabels: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay" }
const methodColors: Record<string, string> = {
  bkash: "text-pink-600 bg-pink-50 border-pink-200",
  nagad: "text-orange-600 bg-orange-50 border-orange-200",
  rocket: "text-purple-600 bg-purple-50 border-purple-200",
  upay: "text-blue-600 bg-blue-50 border-blue-200"
}

export default function SettingsClient({ myRole }: { myRole: string }) {
  const supabase = createClient()
  const { branding, theme, updateBranding, resetToDefaults } = useBranding()

  // Tabs: "branding" | "payments" | "approvers"
  const [activeTab, setActiveTab] = useState<"branding" | "payments" | "approvers">("branding")

  // Branding Form State
  const [formData, setFormData] = useState<InstituteBranding>(branding)
  const [savingBranding, setSavingBranding] = useState(false)
  const [previewTab, setPreviewTab] = useState<"sidebar" | "result" | "idcard" | "receipt">("sidebar")

  // Keep form data in sync if context loads from DB
  useEffect(() => {
    setFormData(branding)
  }, [branding])

  // Payment Accounts state
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [approvers, setApprovers] = useState<PaymentApprover[]>([])
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  // Add account form
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [accMethod, setAccMethod] = useState("bkash")
  const [accNumber, setAccNumber] = useState("")
  const [accName, setAccName] = useState("")
  const [addingAcc, setAddingAcc] = useState(false)

  // Add approver
  const [selectedStaff, setSelectedStaff] = useState("")
  const [addingApprover, setAddingApprover] = useState(false)

  const isOwner = myRole === "owner"

  useEffect(() => {
    async function load() {
      const [accRes, appRes, staffRes] = await Promise.all([
        supabase.from("payment_accounts").select("*").order("method"),
        supabase.from("payment_approvers").select("*, staff:staff(name, email, role)").order("created_at"),
        supabase.from("staff").select("id, name, email, role").eq("is_active", true).order("name"),
      ])
      setAccounts(accRes.data || [])
      setApprovers(appRes.data || [])
      setAllStaff(staffRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // File Upload Handler for Logo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, SVG, WebP)")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file should be less than 2MB")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (result) {
        setFormData(prev => ({
          ...prev,
          logoUrl: result,
          faviconUrl: (!prev.faviconUrl || prev.faviconUrl === prev.logoUrl || isPresetLogoUrl(prev.faviconUrl)) ? result : prev.faviconUrl
        }))
        toast.success("Logo uploaded for preview! Click 'Save Branding' to apply.")
      }
    }
    reader.readAsDataURL(file)
  }

  // Save Branding
  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault()
    setSavingBranding(true)
    try {
      await updateBranding(formData)
      toast.success("Institution branding & styling updated across the entire system!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save branding")
    } finally {
      setSavingBranding(false)
    }
  }

  // Reset to default
  async function handleResetBranding() {
    if (!confirm("Reset institute branding, name, logo, and theme to default MIIS Academy settings?")) return
    setSavingBranding(true)
    try {
      await resetToDefaults()
      setFormData(DEFAULT_BRANDING)
      toast.success("Branding reset to default MIIS Academy configuration!")
    } catch (err: unknown) {
      toast.error("Failed to reset branding")
    } finally {
      setSavingBranding(false)
    }
  }

  // Payment Account Handlers
  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    setAddingAcc(true)
    try {
      const { data, error } = await supabase.from("payment_accounts").insert({
        method: accMethod, account_number: accNumber.trim(), account_name: accName.trim() || null,
      }).select().single()
      if (error) throw error
      setAccounts(prev => [...prev, data])
      setShowAddAccount(false); setAccNumber(""); setAccName("")
      toast.success(`${methodLabels[accMethod]} account added!`)
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed") }
    finally { setAddingAcc(false) }
  }

  async function toggleAccount(id: string, currentActive: boolean) {
    const { error } = await supabase.from("payment_accounts").update({ is_active: !currentActive }).eq("id", id)
    if (error) { toast.error("Failed"); return }
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentActive } : a))
    toast.success(currentActive ? "Account disabled" : "Account enabled")
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this payment account?")) return
    const { error } = await supabase.from("payment_accounts").delete().eq("id", id)
    if (error) { toast.error("Failed"); return }
    setAccounts(prev => prev.filter(a => a.id !== id))
    toast.success("Account deleted")
  }

  async function addApprover() {
    if (!selectedStaff) return
    setAddingApprover(true)
    try {
      const { data, error } = await supabase.from("payment_approvers").insert({ staff_id: selectedStaff }).select("*, staff:staff(name, email, role)").single()
      if (error) throw error
      setApprovers(prev => [...prev, data])
      setSelectedStaff("")
      toast.success("Approver added!")
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed (maybe already an approver)") }
    finally { setAddingApprover(false) }
  }

  async function removeApprover(id: string) {
    if (!confirm("Remove this payment approver?")) return
    const { error } = await supabase.from("payment_approvers").delete().eq("id", id)
    if (error) { toast.error("Failed"); return }
    setApprovers(prev => prev.filter(a => a.id !== id))
    toast.success("Approver removed")
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition-all"
  const approverIds = approvers.map(a => a.staff_id)
  const availableStaff = allStaff.filter(s => !approverIds.includes(s.id))

  const selectedPalette = THEME_PALETTES[formData.themeColor] || THEME_PALETTES.emerald

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>

  return (
    <div className="max-w-5xl space-y-6">
      {/* Top Header Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
            activeTab === "branding"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <Palette className="w-4 h-4 text-emerald-400" />
          <span>Branding &amp; Appearance (ব্র্যান্ডিং ও স্টাইল)</span>
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
              activeTab === "payments"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
            )}
          >
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>Payment Accounts</span>
            {accounts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {accounts.length}
              </span>
            )}
          </button>
        )}

        {isOwner && (
          <button
            type="button"
            onClick={() => setActiveTab("approvers")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
              activeTab === "approvers"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
            )}
          >
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Payment Approvers</span>
            {approvers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white">
                {approvers.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: BRANDING & APPEARANCE */}
      {activeTab === "branding" && (
        <form onSubmit={handleSaveBranding} className="space-y-6">
          {/* Main Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Institution Identity Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-emerald-600" />
                      Institution Identity (প্রতিষ্ঠানের পরিচিতি)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      The name and slogan here will automatically update across the sidebar, header, exam results, and ID cards.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Institute Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. MIIS ACADEMY"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Institute Name (বাংলা)
                    </label>
                    <input
                      type="text"
                      value={formData.nameBn}
                      onChange={e => setFormData({ ...formData, nameBn: e.target.value })}
                      placeholder="যেমন: এমআইআইএস একাডেমি"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Short Code / Acronym
                    </label>
                    <input
                      type="text"
                      value={formData.shortName}
                      onChange={e => setFormData({ ...formData, shortName: e.target.value })}
                      placeholder="e.g. MIIS"
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tagline / Slogan (English)
                    </label>
                    <input
                      type="text"
                      value={formData.tagline}
                      onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                      placeholder="e.g. Academic & Admission Care"
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tagline / স্লোগান (বাংলা)
                    </label>
                    <input
                      type="text"
                      value={formData.taglineBn}
                      onChange={e => setFormData({ ...formData, taglineBn: e.target.value })}
                      placeholder="যেমন: উন্নত ও নির্ভরযোগ্য শিক্ষা সেবা"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Logo Selection Studio */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-indigo-600" />
                      Institute Logo (প্রতিষ্ঠানের লোগো নির্বাচন)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select a preset vector emblem, upload your own logo image, or enter a custom URL.
                    </p>
                  </div>
                </div>

                {/* Preset Badges Grid */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Option A: Pick a Professional Preset Emblem (এক ক্লিকে লোগো নির্বাচন)
                  </label>
                  <div className="grid grid-cols-5 gap-2.5">
                    {PRESET_LOGOS.map((preset) => {
                      const isSelected = formData.logoUrl === preset.url
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            logoUrl: preset.url,
                            faviconUrl: (!prev.faviconUrl || prev.faviconUrl === prev.logoUrl || isPresetLogoUrl(prev.faviconUrl)) ? preset.url : prev.faviconUrl
                          }))}
                          className={cn(
                            "flex flex-col items-center p-2 rounded-xl border transition-all text-center group cursor-pointer",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/30 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white"
                          )}
                          title={preset.title}
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden p-1 flex items-center justify-center bg-white shadow-2xs">
                            <img src={preset.url} alt={preset.title} className="w-full h-full object-contain" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-700 mt-1 line-clamp-1 group-hover:text-slate-900">
                            {preset.title.split(" ")[0]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom File Upload & URL Inputs */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Option B: Upload Custom Logo Image / File
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span>Choose File (PNG, JPG, SVG)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-slate-400">or enter direct URL below</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Logo Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.logoUrl}
                      onChange={e => {
                        const val = e.target.value
                        setFormData(prev => ({
                          ...prev,
                          logoUrl: val,
                          faviconUrl: (!prev.faviconUrl || prev.faviconUrl === prev.logoUrl || isPresetLogoUrl(prev.faviconUrl)) ? val : prev.faviconUrl
                        }))
                      }}
                      placeholder="https://example.com/logo.png or /logo.jpg"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Theme Color & Styling Studio */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <Palette className="w-5 h-5 text-amber-500" />
                      Theme Style &amp; Accent Color (কালার থিম নির্বাচন)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select your institute's signature color theme across buttons, tags, badges, and printouts.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.keys(THEME_PALETTES) as ThemeColor[]).map((cKey) => {
                    const pal = THEME_PALETTES[cKey]
                    const isSelected = formData.themeColor === cKey
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, themeColor: cKey })
                          if (pal && typeof document !== "undefined") {
                            const root = document.documentElement
                            root.style.setProperty("--brand-primary", pal.primaryHex)
                            root.style.setProperty("--brand-secondary", pal.secondaryHex)
                            root.style.setProperty("--brand-bg-light", pal.bgLightHex)
                            root.style.setProperty("--brand-border", pal.borderHex)
                            root.style.setProperty("--brand-text", pal.textHex)
                            root.style.setProperty("--brand-primary-rgb", hexToRgb(pal.primaryHex))
                            root.style.setProperty("--brand-secondary-rgb", hexToRgb(pal.secondaryHex))
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer",
                          isSelected
                            ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
                        )}
                      >
                        <div
                          className="w-7 h-7 rounded-lg shadow-sm flex items-center justify-center shrink-0 text-white font-bold"
                          style={{ backgroundColor: pal.primaryHex }}
                        >
                          {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{pal.name.split(" ")[0]}</p>
                          <p className="text-[10px] text-slate-500 truncate">{pal.primaryHex}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contact Information (For Receipts, ID Cards, & Results) */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <Phone className="w-5 h-5 text-blue-600" />
                      Contact &amp; Campus Details (যোগাযোগ ও ঠিকানা)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Printed on money receipts, student ID cards, and result sheets.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hotline / Phone
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+880 1700-000000"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@miisacademy.com"
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Campus / Branch Address
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. Main Campus, Rangpur / Dhaka, Bangladesh"
                      className={inputClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Receipt Footer Note
                    </label>
                    <input
                      type="text"
                      value={formData.receiptFooterNote}
                      onChange={e => setFormData({ ...formData, receiptFooterNote: e.target.value })}
                      placeholder="Thank you for your payment! Keep this receipt for verification."
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Real-Time Previews (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-4 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Live Real-Time Preview
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Auto-syncing
                    </span>
                  </div>

                  {/* Preview Selector Tabs */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("sidebar")}
                      className={cn(
                        "py-1.5 rounded-lg transition-all text-center truncate cursor-pointer",
                        previewTab === "sidebar" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Sidebar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("result")}
                      className={cn(
                        "py-1.5 rounded-lg transition-all text-center truncate cursor-pointer",
                        previewTab === "result" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Result
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("idcard")}
                      className={cn(
                        "py-1.5 rounded-lg transition-all text-center truncate cursor-pointer",
                        previewTab === "idcard" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      ID Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("receipt")}
                      className={cn(
                        "py-1.5 rounded-lg transition-all text-center truncate cursor-pointer",
                        previewTab === "receipt" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Receipt
                    </button>
                  </div>

                  {/* PREVIEW 1: SIDEBAR */}
                  {previewTab === "sidebar" && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-white space-y-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Dashboard Sidebar Header
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white border border-slate-700 shadow-md shrink-0">
                          {formData.logoUrl ? (
                            <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <GraduationCap className="w-6 h-6 text-amber-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-black text-base text-white tracking-tight leading-none block truncate">
                            {formData.name || "MIIS ACADEMY"}
                          </span>
                          <span
                            className="text-[10px] font-bold tracking-wider uppercase mt-1 block truncate"
                            style={{ color: selectedPalette.secondaryHex }}
                          >
                            {formData.tagline || "Coaching Portal"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Header Badge:</span>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{
                              backgroundColor: selectedPalette.bgLightHex,
                              color: selectedPalette.textHex,
                              borderColor: selectedPalette.borderHex,
                            }}
                          >
                            ✨ {formData.name || "MIIS ACADEMY"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 2: RESULT SHEET HEADER */}
                  {previewTab === "result" && (
                    <div className="bg-white p-4 rounded-xl border-2 border-slate-900 text-slate-900 space-y-3 font-sans">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Official Exam &amp; Merit Sheet Header
                      </p>
                      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                            {formData.logoUrl ? (
                              <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              <GraduationCap className="w-6 h-6 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-black text-base text-slate-950 uppercase leading-none tracking-tight">
                              {formData.nameBn || formData.name || "MIIS ACADEMY"}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-700 tracking-wider mt-1 uppercase">
                              {formData.tagline || "Academic & Admission Care"} • {formData.address?.split(",")[0] || "Main Campus"}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-0.5">
                              {formData.phone ? `Hotline: ${formData.phone}` : "Official Examination Board"}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded border border-slate-900 text-[10px] font-black uppercase shrink-0 bg-slate-50">
                          মেধা তালিকা
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg text-center text-[10px] text-slate-500 font-mono">
                        Student Rolls &bull; Day Marks &bull; Grand Toppers Sheet
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 3: STUDENT ID CARD */}
                  {previewTab === "idcard" && (
                    <div className="flex justify-center p-2 bg-slate-100 rounded-xl">
                      <div className="w-[240px] bg-white rounded-2xl overflow-hidden border border-slate-300 shadow-md">
                        <div
                          className="p-3 text-center text-white"
                          style={{
                            background: `linear-gradient(135deg, ${selectedPalette.primaryHex}, #0f172a)`
                          }}
                        >
                          <p className="text-xs font-black tracking-wide text-amber-300 uppercase">
                            {formData.nameBn || formData.name || "MIIS ACADEMY"}
                          </p>
                          <p className="text-[9px] text-slate-200 mt-0.5 truncate">
                            {formData.name} &bull; {formData.shortName || "CAMPUS"}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-[8px] font-bold uppercase tracking-wider">
                            STUDENT PASS
                          </span>
                        </div>
                        <div className="p-3 text-center space-y-1.5">
                          <div
                            className="w-12 h-12 mx-auto rounded-full text-white font-black text-lg flex items-center justify-center shadow-xs"
                            style={{ backgroundColor: selectedPalette.primaryHex }}
                          >
                            S
                          </div>
                          <p className="font-extrabold text-xs text-slate-900">John Student</p>
                          <p className="text-[10px] font-mono text-slate-500">ID: STU-2026-001</p>
                          <div className="text-[9px] text-slate-600 bg-slate-50 p-1 rounded border border-slate-200">
                            ব্যাচ: HSC Special &bull; রোল: #01
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 4: RECEIPT */}
                  {previewTab === "receipt" && (
                    <div className="bg-white p-3.5 rounded-xl border border-slate-300 text-slate-900 text-xs space-y-2">
                      <div className="text-center border-b border-dashed border-slate-300 pb-2">
                        <h5 className="font-black text-sm text-slate-900">{formData.name}</h5>
                        <p className="text-[10px] text-slate-500">{formData.tagline || "Official Fee Payment Receipt"}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[9px] font-mono font-bold">
                          RCP-2026-0892
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between"><span className="text-slate-500">Student:</span><span className="font-bold">Rahim Ahmed</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Paid Amount:</span><span className="font-bold text-emerald-700">৳2,500</span></div>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 text-center text-[9px] text-slate-400">
                        {formData.receiptFooterNote || "Thank you for your payment!"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save and Reset Action Box */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-2.5">
                  <button
                    type="submit"
                    disabled={savingBranding}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-sm shadow-md shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {savingBranding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Saving Branding...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Save &amp; Apply Branding Changes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetBranding}
                    disabled={savingBranding}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to Default MIIS Academy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: PAYMENT ACCOUNTS */}
      {activeTab === "payments" && isOwner && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                Payment Gateway Numbers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                These mobile banking accounts are shown to students for admission and monthly tuition fee payments.
              </p>
            </div>
            <button
              onClick={() => setShowAddAccount(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Number
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No payment accounts added yet.</p>
              <p className="text-xs text-slate-500">Add bKash, Nagad, Rocket, or Upay numbers for students to pay.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${acc.is_active ? "bg-slate-50 border-slate-200" : "bg-slate-50/50 border-slate-200 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${methodColors[acc.method] || "text-slate-700 bg-slate-100 border-slate-200"}`}>
                      {methodLabels[acc.method] || acc.method}
                    </span>
                    <div>
                      <p className="font-mono font-bold text-slate-900 text-sm">{acc.account_number}</p>
                      {acc.account_name && <p className="text-xs text-slate-500">{acc.account_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleAccount(acc.id, acc.is_active)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer" title={acc.is_active ? "Disable" : "Enable"}>
                      {acc.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button onClick={() => deleteAccount(acc.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add account modal */}
          {showAddAccount && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-base">Add Payment Account</h4>
                  <button onClick={() => setShowAddAccount(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={addAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method *</label>
                    <select value={accMethod} onChange={e => setAccMethod(e.target.value)} className={inputClass}>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="upay">Upay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Account Number *</label>
                    <input required value={accNumber} onChange={e => setAccNumber(e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Account Name</label>
                    <input value={accName} onChange={e => setAccName(e.target.value)} className={inputClass} placeholder="e.g. MIIS Academy Official" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddAccount(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors cursor-pointer">Cancel</button>
                    <button type="submit" disabled={addingAcc} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center justify-center gap-2 transition-all cursor-pointer">
                      {addingAcc ? <><Loader2 className="w-4 h-4 animate-spin text-white" /> Adding...</> : "Add Account"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT APPROVERS */}
      {activeTab === "approvers" && isOwner && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" /> Payment Approvers
          </h3>
          <p className="text-xs text-slate-500">
            Staff members who can review and approve student fee payment submissions. Owners and Super Managers can always approve.
          </p>

          {approvers.length > 0 && (
            <div className="space-y-2 mb-4">
              {approvers.map(app => (
                <div key={app.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{app.staff?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-500">{app.staff?.email} • {app.staff?.role}</p>
                    </div>
                  </div>
                  <button onClick={() => removeApprover(app.id)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className={`${inputClass} flex-1`}>
              <option value="">Select staff member...</option>
              {availableStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
            <button onClick={addApprover} disabled={!selectedStaff || addingApprover} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-sm shadow-md disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer shrink-0">
              {addingApprover ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4" />} Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
