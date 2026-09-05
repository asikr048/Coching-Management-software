"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
  Settings, Smartphone, Shield, Plus, X, Loader2, Trash2, ToggleLeft, ToggleRight,
  UserCheck, Crown, Phone, CheckCircle
} from "lucide-react"

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
  bkash: "text-pink-400 bg-pink-500/10 border-pink-500/30",
  nagad: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  rocket: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  upay: "text-blue-400 bg-blue-500/10 border-blue-500/30"
}

export default function SettingsClient({ myRole }: { myRole: string }) {
  const supabase = createClient()
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

  async function addAccount(e: React.FormEvent) {
    e.preventDefault(); setAddingAcc(true)
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

  const inputClass = "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs transition-all"
  const approverIds = approvers.map(a => a.staff_id)
  const availableStaff = allStaff.filter(s => !approverIds.includes(s.id))

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>

  return (
    <div className="max-w-3xl space-y-6">
      {/* General Settings */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
        <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-amber-400" /> General Settings</h3>
        <div className="space-y-3 text-sm text-slate-300">
          <p>Center Name: <strong className="text-white font-bold">MedhaShiree</strong></p>
          <p>Default Fee Due Day: <strong className="text-white font-bold">10th of every month</strong></p>
        </div>
      </div>

      {/* Payment Accounts — Owner only */}
      {isOwner && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2"><Smartphone className="w-5 h-5 text-amber-400" /> Payment Accounts</h3>
            <button onClick={() => setShowAddAccount(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Number
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">These payment numbers will be shown to students when they make a payment. Students will send money to these numbers.</p>

          {accounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No payment accounts added yet.</p>
              <p className="text-xs text-slate-500">Add bKash, Nagad, Rocket, or Upay numbers for students to pay.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(acc => (
                <div key={acc.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${acc.is_active ? "bg-slate-950 border-slate-200" : "bg-slate-950/50 border-slate-200 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${methodColors[acc.method] || "text-slate-400 bg-slate-800 border-slate-700"}`}>
                      {methodLabels[acc.method] || acc.method}
                    </span>
                    <div>
                      <p className="font-mono font-bold text-white text-sm">{acc.account_number}</p>
                      {acc.account_name && <p className="text-xs text-slate-400">{acc.account_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleAccount(acc.id, acc.is_active)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title={acc.is_active ? "Disable" : "Enable"}>
                      {acc.is_active ? <ToggleRight className="w-6 h-6 text-emerald-400" /> : <ToggleLeft className="w-6 h-6 text-slate-600" />}
                    </button>
                    <button onClick={() => deleteAccount(acc.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer" title="Delete Account">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add account modal */}
          {showAddAccount && (
            <div className="fixed inset-0 bg-slate-50 backdrop-blur-md flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl w-full text-slate-900 max-w-md p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900">Add Payment Number</h3>
                  <button onClick={() => setShowAddAccount(false)} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={addAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Payment Method *</label>
                    <select value={accMethod} onChange={e => setAccMethod(e.target.value)} className={inputClass}>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="upay">Upay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Account Number *</label>
                    <input required value={accNumber} onChange={e => setAccNumber(e.target.value)} className={inputClass} placeholder="01XXXXXXXXX" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Account Name</label>
                    <input value={accName} onChange={e => setAccName(e.target.value)} className={inputClass} placeholder="e.g. MedhaShiree Official" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddAccount(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-300 rounded-xl font-bold hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">Cancel</button>
                    <button type="submit" disabled={addingAcc} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-black shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center justify-center gap-2 transition-all cursor-pointer">
                      {addingAcc ? <><Loader2 className="w-4 h-4 animate-spin text-slate-950" /> Adding...</> : "Add Account"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Approvers — Owner only */}
      {isOwner && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
          <h3 className="font-black text-slate-900 text-base mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-amber-400" /> Payment Approvers</h3>
          <p className="text-xs text-slate-400 mb-4">Staff members who can approve or reject student payment submissions. Owners and Super Managers can always approve.</p>

          {/* Current approvers */}
          {approvers.length > 0 && (
            <div className="space-y-2 mb-4">
              {approvers.map(app => (
                <div key={app.id} className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{app.staff?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-400">{app.staff?.email} • {app.staff?.role}</p>
                    </div>
                  </div>
                  <button onClick={() => removeApprover(app.id)} className="p-1.5 hover:bg-rose-500/10 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new approver */}
          <div className="flex gap-2">
            <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className={`${inputClass} flex-1`}>
              <option value="">Select staff member...</option>
              {availableStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
            <button onClick={addApprover} disabled={!selectedStaff || addingApprover} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl text-sm shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer shrink-0">
              {addingApprover ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Plus className="w-4 h-4" />} Add
            </button>
          </div>
        </div>
      )}

      {/* Supabase Connection */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 shadow-xl">
        <h3 className="font-black text-slate-900 text-base mb-2">Supabase Connection</h3>
        <p className="text-sm text-slate-400">Configure your Supabase URL and keys in the <code className="bg-white border border-slate-300 text-amber-400 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> file.</p>
      </div>
    </div>
  )
}
