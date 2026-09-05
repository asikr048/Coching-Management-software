"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Landmark, Plus, Search, MapPin, Phone, Mail, MessageSquare,
  User, Shield, Edit2, Trash2, CheckCircle2, XCircle, Users,
  BookOpen, Calendar, ExternalLink, Sliders, Globe
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
              sender_id: formData.sms_sender_id.trim() || undefined,
              api_url: formData.sms_api_url.trim() || undefined,
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
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Total Branches</p>
            <p className="text-xl font-bold text-gray-900">{branches.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Active Branches</p>
            <p className="text-xl font-bold text-gray-900">{activeBranches}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">All Students</p>
            <p className="text-xl font-bold text-gray-900">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">All Batches</p>
            <p className="text-xl font-bold text-gray-900">{totalBatches}</p>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Add */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by branch name, location, director, or manager..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {isOwnerOrSuper && (
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add New Branch
          </button>
        )}
      </div>

      {/* Branch Cards Grid */}
      {filteredBranches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <Landmark className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">No branches found</h3>
          <p className="text-sm text-gray-500 mt-1">
            {search ? "No branch matches your search term." : "Start by adding your first coaching branch."}
          </p>
          {isOwnerOrSuper && !search && (
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
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
                className="bg-white rounded-2xl border border-gray-200/90 hover:border-indigo-200 transition-all p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{branch.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            branch.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-100 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {branch.is_active ? "Active" : "Inactive"}
                        </span>
                        {branch.established_year && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium border border-indigo-100">
                            Est. {branch.established_year}
                          </span>
                        )}
                      </div>

                      {branch.location && (
                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span>{branch.location}</span>
                        </p>
                      )}
                    </div>

                    {isOwnerOrSuper && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEditModal(branch)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Branch"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(branch)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            branch.is_active
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-gray-400 hover:bg-gray-100"
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
                    <p className="text-xs text-gray-600 line-clamp-2 mb-4 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                      {branch.description}
                    </p>
                  )}

                  {/* Operational Metrics Pill */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-gray-50/80 rounded-xl mb-4 text-center border border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-indigo-700">{branchStudents}</p>
                      <p className="text-[11px] text-gray-500">Students</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-700">{branchBatches}</p>
                      <p className="text-[11px] text-gray-500">Batches</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-700">{branchStaff}</p>
                      <p className="text-[11px] text-gray-500">Staff Assigned</p>
                    </div>
                  </div>

                  {/* Director & Manager Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-3">
                    <div className="bg-white border border-gray-100 p-2.5 rounded-xl shadow-2xs">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Shield className="w-3 h-3 text-indigo-500" /> Branch Director
                      </p>
                      <p className="font-bold text-gray-800 mt-0.5">
                        {branch.branch_director || "Not assigned"}
                      </p>
                      {branch.director_phone && (
                        <a
                          href={`tel:${branch.director_phone}`}
                          className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3" /> {branch.director_phone}
                        </a>
                      )}
                    </div>

                    <div className="bg-white border border-gray-100 p-2.5 rounded-xl shadow-2xs">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-500" /> Branch Manager
                      </p>
                      <p className="font-bold text-gray-800 mt-0.5">
                        {branch.manager || "Not assigned"}
                      </p>
                      {branch.manager_phone && (
                        <a
                          href={`tel:${branch.manager_phone}`}
                          className="text-[11px] text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3" /> {branch.manager_phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contacts & SMS Gateway Footer */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-3 text-gray-500">
                    {branch.contact_info?.phone && (
                      <span className="flex items-center gap-1" title="Helpline">
                        <Phone className="w-3.5 h-3.5 text-gray-400" /> {branch.contact_info.phone}
                      </span>
                    )}
                    {branch.contact_info?.email && (
                      <span className="flex items-center gap-1" title="Email">
                        <Mail className="w-3.5 h-3.5 text-gray-400" /> {branch.contact_info.email}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium ${
                        hasCustomSms
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-gray-100 text-gray-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 to-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {editingBranch ? "Edit Branch" : "Add New Branch (শাখা যোগ করুন)"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Configure branch identity, leadership, contact helpline, and SMS routing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {error}
                </div>
              )}

              {/* Branch Primary Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Branch Name (শাখার নাম) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. মেধা শিরী কোচিং (নাচোল শাখা)"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Established Year (প্রতিষ্ঠিত সাল)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2018 বা ২০১৮"
                    value={formData.established_year}
                    onChange={e => setFormData({ ...formData, established_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Location / Full Address (ঠিকানা / অবস্থান)
                </label>
                <input
                  type="text"
                  placeholder="e.g. নাচোল বাসস্ট্যান্ড সংলগ্ন, চাঁপাইনবাবগঞ্জ"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Branch Description (শাখার বর্ণনা ও সুবিধাসমূহ)
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe campus features, classrooms, facilities, programs offered..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Leadership Information */}
              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200/80 space-y-3">
                <p className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" /> Branch Leadership
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Branch Director (শাখা পরিচালক)
                    </label>
                    <input
                      type="text"
                      placeholder="Director full name"
                      value={formData.branch_director}
                      onChange={e => setFormData({ ...formData, branch_director: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Director Phone (পরিচালকের ফোন)
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.director_phone}
                      onChange={e => setFormData({ ...formData, director_phone: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Branch Manager (শাখা ব্যবস্থাপক)
                    </label>
                    <input
                      type="text"
                      placeholder="Manager full name"
                      value={formData.manager}
                      onChange={e => setFormData({ ...formData, manager: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Manager Phone (ব্যবস্থাপকের ফোন)
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.manager_phone}
                      onChange={e => setFormData({ ...formData, manager_phone: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information (For Homepage & Invoices) */}
              <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200/80 space-y-3">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> Helpline & Public Contacts
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Office Helpline Phone
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Branch Email
                    </label>
                    <input
                      type="email"
                      placeholder="branch@medhashiree.edu.bd"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      placeholder="017xxxxxxxx"
                      value={formData.whatsapp}
                      onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Dedicated SMS Gateway Configuration */}
              <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-600" /> Dedicated SMS Gateway (Optional)
                  </p>
                  <span className="text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
                    Leave blank to use Global Gateway
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Branch SMS API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Custom API Key"
                      value={formData.sms_api_key}
                      onChange={e => setFormData({ ...formData, sms_api_key: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-purple-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Branch Sender ID / Masking
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MedhaShiree or 88096..."
                      value={formData.sms_sender_id}
                      onChange={e => setFormData({ ...formData, sms_sender_id: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-purple-200 rounded-lg bg-white"
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
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="is_active" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Branch is operational and active (সক্রিয় শাখা)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
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
