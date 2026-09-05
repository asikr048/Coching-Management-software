"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Landmark, Plus, Search, MapPin, Phone, Mail, MessageSquare,
  User, Shield, Edit2, CheckCircle2, XCircle, Users,
  BookOpen, Sparkles
} from "lucide-react"
import type { Branch } from "@/lib/supabase/types"

interface Props {
  initialBranches: Branch[]
  students: { id: string; branch_id?: string | null }[]
  batches: { id: string; branch_id?: string | null }[]
  staff: { id: string; branch_id?: string | null; branch_ids?: string[] | null }[]
  myRole: string
}

export default function BranchesClient({
  initialBranches,
  students,
  batches,
  staff,
  myRole,
}: Props) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwnerOrSuper = myRole === "owner" || myRole === "super_manager"
  const supabase = createClient()

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    branch_director: "",
    director_phone: "",
    manager: "",
    manager_phone: "",
    phone: "",
    email: "",
    whatsapp: "",
    established_year: "",
    is_active: true,
    sms_api_key: "",
    sms_sender_id: "",
    sms_api_url: "",
  })

  function openCreateModal() {
    setEditingBranch(null)
    setFormData({
      name: "",
      location: "",
      description: "",
      branch_director: "",
      director_phone: "",
      manager: "",
      manager_phone: "",
      phone: "",
      email: "",
      whatsapp: "",
      established_year: "2018",
      is_active: true,
      sms_api_key: "",
      sms_sender_id: "",
      sms_api_url: "",
    })
    setError(null)
    setIsModalOpen(true)
  }

  function openEditModal(branch: Branch) {
    setEditingBranch(branch)
    const contacts = branch.contact_info || {}
    const sms = branch.sms_gateway_config || {}
    setFormData({
      name: branch.name || "",
      location: branch.location || "",
      description: branch.description || "",
      branch_director: branch.branch_director || "",
      director_phone: branch.director_phone || "",
      manager: branch.manager || "",
      manager_phone: branch.manager_phone || "",
      phone: contacts.phone || "",
      email: contacts.email || "",
      whatsapp: branch.whatsapp || contacts.whatsapp || "",
      established_year: branch.established_year || contacts.established_year || "",
      is_active: branch.is_active ?? true,
      sms_api_key: sms.api_key || sms.apiKey || "",
      sms_sender_id: sms.sender_id || sms.senderId || "",
      sms_api_url: sms.api_url || sms.urlTemplate || "",
    })
    setError(null)
    setIsModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError("Branch name is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: Partial<Branch> = {
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        description: formData.description.trim() || null,
        branch_director: formData.branch_director.trim() || null,
        director_phone: formData.director_phone.trim() || null,
        manager: formData.manager.trim() || null,
        manager_phone: formData.manager_phone.trim() || null,
        whatsapp: formData.whatsapp.trim() || null,
        established_year: formData.established_year.trim() || null,
        is_active: formData.is_active,
        contact_info: {
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          established_year: formData.established_year.trim() || null,
          address: formData.location.trim() || null,
        },
        sms_gateway_config: formData.sms_api_key.trim()
          ? {
              api_key: formData.sms_api_key.trim(),
              apiKey: formData.sms_api_key.trim(),
              sender_id: formData.sms_sender_id.trim() || undefined,
              senderId: formData.sms_sender_id.trim() || undefined,
              api_url: formData.sms_api_url.trim() || undefined,
              urlTemplate: formData.sms_api_url.trim() || undefined,
            }
          : null,
      }

      if (editingBranch) {
        const { data, error: updateError } = await supabase
          .from("branches")
          .update(payload)
          .eq("id", editingBranch.id)
          .select()
          .single()

        if (updateError) throw updateError
        setBranches(prev => prev.map(b => (b.id === editingBranch.id ? (data as Branch) : b)))
      } else {
        const { data, error: insertError } = await supabase
          .from("branches")
          .insert([payload])
          .select()
          .single()

        if (insertError) throw insertError
        setBranches(prev => [...prev, data as Branch])
      }

      setIsModalOpen(false)
    } catch (err: any) {
      console.error("Save branch error:", err)
      setError(err.message || "Failed to save branch")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(branch: Branch) {
    const newStatus = !branch.is_active
    try {
      const { error: updateError } = await supabase
        .from("branches")
        .update({ is_active: newStatus })
        .eq("id", branch.id)

      if (updateError) throw updateError
      setBranches(prev =>
        prev.map(b => (b.id === branch.id ? { ...b, is_active: newStatus } : b))
      )
    } catch (err: any) {
      alert("Error updating status: " + err.message)
    }
  }

  const filteredBranches = branches.filter(b => {
    const q = search.toLowerCase()
    return (
      b.name.toLowerCase().includes(q) ||
      (b.location && b.location.toLowerCase().includes(q)) ||
      (b.branch_director && b.branch_director.toLowerCase().includes(q)) ||
      (b.manager && b.manager.toLowerCase().includes(q))
    )
  })

  // Quick stats
  const totalStudents = students.length
  const totalBatches = batches.length
  const activeBranches = branches.filter(b => b.is_active).length

  return (
    <div className="space-y-6">
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Branches</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{branches.length}</p>
          </div>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Branches</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{activeBranches}</p>
          </div>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-3">
          <div className="w-11 h-11 bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">All Students</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-3">
          <div className="w-11 h-11 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">All Batches</p>
            <p className="text-xl font-extrabold text-white mt-0.5">{totalBatches}</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Add */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by branch name, location, director, or manager..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
          />
        </div>

        {isOwnerOrSuper && (
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-sm font-extrabold transition-all shadow-md shadow-amber-500/20 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Add New Branch (শাখা যোগ)
          </button>
        )}
      </div>

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="bg-slate-900/80 rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <Landmark className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No branches found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {search ? "No branch matches your search term." : "Start by adding your first coaching branch."}
          </p>
          {isOwnerOrSuper && !search && (
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs"
            >
              <Plus className="w-4 h-4" /> Add Branch
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredBranches.map(branch => {
            const branchStudents = students.filter(s => s.branch_id === branch.id).length
            const branchBatches = batches.filter(b => b.branch_id === branch.id).length
            const branchStaff = staff.filter(
              st => st.branch_id === branch.id || (st.branch_ids && st.branch_ids.includes(branch.id))
            ).length
            const hasCustomSms = !!(branch.sms_gateway_config?.api_key || branch.sms_gateway_config?.apiKey)

            return (
              <div
                key={branch.id}
                className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 hover:border-amber-500/40 transition-all p-5 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-extrabold text-white truncate">{branch.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            branch.is_active
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {branch.is_active ? "Active" : "Inactive"}
                        </span>
                        {branch.established_year && (
                          <span className="text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-md font-bold border border-amber-500/30">
                            Est. {branch.established_year}
                          </span>
                        )}
                      </div>

                      {branch.location && (
                        <p className="text-xs text-slate-300 flex items-center gap-1 mt-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span>{branch.location}</span>
                        </p>
                      )}
                    </div>

                    {isOwnerOrSuper && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEditModal(branch)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Branch"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(branch)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            branch.is_active
                              ? "text-emerald-400 hover:bg-emerald-500/15"
                              : "text-slate-500 hover:bg-slate-800"
                          }`}
                          title={branch.is_active ? "Deactivate branch" : "Activate branch"}
                        >
                          {branch.is_active ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {branch.description && (
                    <p className="text-xs text-slate-300 line-clamp-2 mb-4 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      {branch.description}
                    </p>
                  )}

                  {/* Operational Metrics Pill */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-950/70 rounded-xl mb-4 text-center border border-slate-800/90">
                    <div>
                      <p className="text-sm font-extrabold text-amber-400">{branchStudents}</p>
                      <p className="text-[11px] text-slate-400">Students</p>
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-amber-400">{branchBatches}</p>
                      <p className="text-[11px] text-slate-400">Batches</p>
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-amber-400">{branchStaff}</p>
                      <p className="text-[11px] text-slate-400">Staff Assigned</p>
                    </div>
                  </div>

                  {/* Director & Manager Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-3">
                    <div className="bg-slate-950/60 border border-slate-800/90 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3 h-3 text-amber-400" /> Branch Director
                      </p>
                      <p className="font-bold text-white mt-0.5">
                        {branch.branch_director || "Not assigned"}
                      </p>
                      {branch.director_phone && (
                        <a
                          href={`tel:${branch.director_phone}`}
                          className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 mt-0.5 font-medium"
                        >
                          <Phone className="w-3 h-3" /> {branch.director_phone}
                        </a>
                      )}
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/90 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-400" /> Branch Manager
                      </p>
                      <p className="font-bold text-white mt-0.5">
                        {branch.manager || "Not assigned"}
                      </p>
                      {branch.manager_phone && (
                        <a
                          href={`tel:${branch.manager_phone}`}
                          className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 mt-0.5 font-medium"
                        >
                          <Phone className="w-3 h-3" /> {branch.manager_phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contacts & SMS Gateway Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-400">
                    {branch.contact_info?.phone && (
                      <span className="flex items-center gap-1" title="Helpline">
                        <Phone className="w-3.5 h-3.5 text-amber-400" /> {branch.contact_info.phone}
                      </span>
                    )}
                    {branch.contact_info?.email && (
                      <span className="flex items-center gap-1" title="Email">
                        <Mail className="w-3.5 h-3.5 text-amber-400" /> {branch.contact_info.email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-bold ${
                        hasCustomSms
                          ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                      title={
                        hasCustomSms
                          ? "Using branch-specific SMS Gateway API"
                          : "Using system default SMS Gateway"
                      }
                    >
                      <MessageSquare className="w-3 h-3" />
                      {hasCustomSms ? "Branch SMS API" : "Default SMS"}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#0f172a] text-slate-100 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-700 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 flex items-center justify-center shadow-md font-bold">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    {editingBranch ? "Edit Branch" : "Add New Branch (শাখা যোগ করুন)"}
                  </h3>
                  <p className="text-xs text-amber-400/90 font-medium">
                    Configure branch identity, leadership, contact helpline, and SMS routing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-rose-500/15 text-rose-300 text-xs rounded-xl border border-rose-500/30">
                  {error}
                </div>
              )}

              {/* Branch Primary Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Branch Name (শাখার নাম) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. মেধা শিরী কোচিং (নাচোল শাখা)"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-700 bg-slate-950 rounded-xl text-white placeholder:text-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Established Year (প্রতিষ্ঠিত সাল)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2018 বা ২০১৮"
                    value={formData.established_year}
                    onChange={e => setFormData({ ...formData, established_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-700 bg-slate-950 rounded-xl text-white placeholder:text-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Location / Full Address (ঠিকানা / অবস্থান)
                </label>
                <input
                  type="text"
                  placeholder="e.g. নাচোল বাসস্ট্যান্ড সংলগ্ন, চাঁপাইনবাবগঞ্জ"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-700 bg-slate-950 rounded-xl text-white placeholder:text-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Branch Description (শাখার বর্ণনা ও সুবিধাসমূহ)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe campus features, classrooms, facilities, programs offered..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-700 bg-slate-950 rounded-xl text-white placeholder:text-slate-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Leadership Information */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" /> Branch Leadership
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Branch Director (শাখা পরিচালক)
                    </label>
                    <input
                      type="text"
                      placeholder="Director full name"
                      value={formData.branch_director}
                      onChange={e => setFormData({ ...formData, branch_director: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Director Phone (পরিচালকের ফোন)
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.director_phone}
                      onChange={e => setFormData({ ...formData, director_phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Branch Manager (শাখা ব্যবস্থাপক)
                    </label>
                    <input
                      type="text"
                      placeholder="Manager full name"
                      value={formData.manager}
                      onChange={e => setFormData({ ...formData, manager: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Manager Phone (ব্যবস্থাপকের ফোন)
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.manager_phone}
                      onChange={e => setFormData({ ...formData, manager_phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Helpline & Public Contacts
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Office Helpline Phone
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Branch Email
                    </label>
                    <input
                      type="email"
                      placeholder="branch@medhashiree.edu.bd"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.whatsapp}
                      onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-700 rounded-xl bg-slate-900 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Dedicated SMS Gateway Configuration */}
              <div className="bg-purple-950/40 p-4 rounded-2xl border border-purple-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" /> Dedicated SMS Gateway (Optional)
                  </p>
                  <span className="text-[10px] text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded-full font-semibold border border-purple-700/60">
                    Leave blank to use Global Gateway
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Branch SMS API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Custom API Key"
                      value={formData.sms_api_key}
                      onChange={e => setFormData({ ...formData, sms_api_key: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-purple-800/80 rounded-xl bg-slate-950 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Branch Sender ID / Masking
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MedhaShiree or 88096..."
                      value={formData.sms_sender_id}
                      onChange={e => setFormData({ ...formData, sms_sender_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-purple-800/80 rounded-xl bg-slate-950 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer accent-amber-500"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-slate-300 cursor-pointer">
                  Branch is operational and active (সক্রিয় শাখা)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingBranch ? "Save Changes" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
