'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'
import {
  Users,
  Wrench,
  Lightbulb,
  User,
  Package,
  Trash2,
  Plus,
  Search,
  Pencil,
  XCircle,
  ChevronLeft,
  Building2,
  Hash,
  Phone,
  CreditCard,
  Tag,
  TrendingUp,
} from 'lucide-react'

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentGreen: '#10b981',
  accentRed: '#f43f5e',
  accentBlue: '#6366f1',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e',
}

const BANK_OPTIONS = [
  'Εθνική Τράπεζα',
  'Eurobank',
  'Alpha Bank',
  'Viva Wallet',
  'Τράπεζα Πειραιώς',
] as const

type TabKey = 'suppliers' | 'utility' | 'staff' | 'maintenance' | 'other'

const MENU: Array<{
  key: TabKey
  label: string
  icon: any
  subCategory: 'Maintenance' | 'utility' | 'staff' | 'other' | null
  addLabel: string
}> = [
  { key: 'suppliers', label: 'Προμηθευτές', icon: Users, subCategory: null, addLabel: 'ΝΕΟΣ ΠΡΟΜΗΘΕΥΤΗΣ' },
  { key: 'utility', label: 'Λογαριασμοί', icon: Lightbulb, subCategory: 'utility', addLabel: 'ΝΕΟΣ ΛΟΓΑΡΙΑΣΜΟΣ' },
  { key: 'staff', label: 'Προσωπικό', icon: User, subCategory: 'staff', addLabel: 'ΝΕΟΣ ΥΠΑΛΛΗΛΟΣ' },
  { key: 'maintenance', label: 'Συντήρηση', icon: Wrench, subCategory: 'Maintenance', addLabel: 'ΝΕΟΣ ΤΕΧΝΙΚΟΣ' },
  { key: 'other', label: 'Λοιπά', icon: Package, subCategory: 'other', addLabel: 'ΝΕΟ ΠΑΓΙΟ' },
]

type PayBasis = 'monthly' | 'daily'

function ManageListsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlStoreId = searchParams.get('store')
  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [currentStoreName, setCurrentStoreName] = useState('Φορτώνει...')

  const [activeTab, setActiveTab] = useState<TabKey>('suppliers')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([]) // ✅ για τζίρους

  const [search, setSearch] = useState('')

  // UI like Suppliers page
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Shared fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')

  // Staff
  const [payBasis, setPayBasis] = useState<PayBasis>('monthly')
  const [monthlySalary, setMonthlySalary] = useState<string>('')
  const [dailyRate, setDailyRate] = useState<string>('')
  const [monthlyDays, setMonthlyDays] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')

  // Utility
  const [rfCode, setRfCode] = useState<string>('')

  const currentTab = useMemo(() => MENU.find(t => t.key === activeTab)!, [activeTab])
  const CurrentIcon = currentTab.icon

  const copyToClipboard = async (text: string) => {
    const value = String(text || '').trim()
    if (!value) return toast.error('Δεν υπάρχει τιμή για αντιγραφή')

    try {
      await navigator.clipboard.writeText(value)
      toast.success('Αντιγράφηκε!')
    } catch {
      // fallback για Android/παλιότερα
      try {
        const ta = document.createElement('textarea')
        ta.value = value
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        toast.success('Αντιγράφηκε!')
      } catch {
        toast.error('Δεν μπόρεσα να αντιγράψω')
      }
    }
  }

  const resetForm = useCallback(() => {
    setName('')
    setPhone('')
    setVatNumber('')
    setBankName('')
    setIban('')

    setPayBasis('monthly')
    setMonthlySalary('')
    setDailyRate('')
    setMonthlyDays('')
    setStartDate('')

    setRfCode('')

    setEditingId(null)
    setExpandedId(null)
    setIsFormOpen(false)
  }, [])

  // ✅ totals για ranking/ποσά
  const supplierTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    transactions.forEach((t: any) => {
      if (!t?.supplier_id) return
      const amount = Math.abs(Number(t.amount)) || 0
      const id = String(t.supplier_id)
      totals[id] = (totals[id] || 0) + amount
    })
    return totals
  }, [transactions])

  const fixedAssetTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    transactions.forEach((t: any) => {
      if (!t?.fixed_asset_id) return
      const amount = Math.abs(Number(t.amount)) || 0
      const id = String(t.fixed_asset_id)
      totals[id] = (totals[id] || 0) + amount
    })
    return totals
  }, [transactions])

  const getTurnover = useCallback(
    (id: string) => {
      if (activeTab === 'suppliers') return supplierTotals[id] || 0
      return fixedAssetTotals[id] || 0
    },
    [activeTab, supplierTotals, fixedAssetTotals],
  )

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    let base: any[] = []
    if (activeTab === 'suppliers') {
      base = suppliers
    } else {
      base = fixedAssets.filter((x: any) => (x.sub_category || '') === currentTab.subCategory)
    }

    const filtered = !q
      ? base
      : base.filter((x: any) => {
          const n = String(x.name || '').toLowerCase()
          const rf = String(x.rf_code || '').toLowerCase()
          const v = String(x.vat_number || '').toLowerCase()
          const p = String(x.phone || '').toLowerCase()
          const b = String(x.bank_name || '').toLowerCase()
          const i = String(x.iban || '').toLowerCase()
          return n.includes(q) || rf.includes(q) || v.includes(q) || p.includes(q) || b.includes(q) || i.includes(q)
        })

    // ✅ SORT by turnover desc
    return [...filtered].sort((a: any, b: any) => {
      const ta = getTurnover(String(a.id))
      const tb = getTurnover(String(b.id))
      return tb - ta
    })
  }, [activeTab, suppliers, fixedAssets, search, currentTab.subCategory, getTurnover])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return router.push('/login')
      }

      const activeStoreId =
        urlStoreId || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

      if (!activeStoreId) {
        setLoading(false)
        return toast.error('Δεν βρέθηκε κατάστημα (store)')
      }

      setStoreId(activeStoreId)

      const [storeRes, sRes, fRes, tRes] = await Promise.all([
        supabase.from('stores').select('name').eq('id', activeStoreId).single(),
        supabase
          .from('suppliers')
          .select('id, name, phone, vat_number, bank_name, iban, is_active, created_at')
          .eq('store_id', activeStoreId)
          .order('name'),
        supabase
          .from('fixed_assets')
          .select(
            'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
          )
          .eq('store_id', activeStoreId)
          .order('name'),
        // ✅ transactions για τζίρους
        supabase
          .from('transactions')
          .select('amount, supplier_id, fixed_asset_id')
          .eq('store_id', activeStoreId),
      ])

      if (storeRes.data?.name) setCurrentStoreName(String(storeRes.data.name))

      if (sRes.error) throw sRes.error
      if (fRes.error) throw fRes.error
      if (tRes.error) throw tRes.error

      setSuppliers(sRes.data || [])
      setFixedAssets(fRes.data || [])
      setTransactions(tRes.data || [])
    } catch (e: any) {
      toast.error(e?.message || 'Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [router, urlStoreId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const backHref = useMemo(() => {
    const s = urlStoreId || storeId || ''
    return s ? `/?store=${s}` : '/'
  }, [storeId, urlStoreId])

  const handleEdit = (item: any) => {
    setEditingId(String(item.id))
    setExpandedId(String(item.id))
    setIsFormOpen(true)

    if (activeTab === 'suppliers') {
      setName(String(item.name || ''))
      setPhone(String(item.phone || ''))
      setVatNumber(String(item.vat_number || ''))
      setBankName(String(item.bank_name || ''))
      setIban(String(item.iban || ''))

      setPayBasis('monthly')
      setMonthlySalary('')
      setDailyRate('')
      setMonthlyDays('')
      setStartDate('')
      setRfCode('')
    } else {
      const sub = String(item.sub_category || '')

      setName(String(item.name || ''))
      setPhone(String(item.phone || ''))
      setVatNumber(String(item.vat_number || ''))
      setBankName(String(item.bank_name || ''))
      setIban(String(item.iban || ''))

      setPayBasis((item.pay_basis === 'daily' ? 'daily' : 'monthly') as PayBasis)
      setMonthlySalary(item.monthly_salary != null ? String(item.monthly_salary) : '')
      setDailyRate(item.daily_rate != null ? String(item.daily_rate) : '')
      setMonthlyDays(item.monthly_days != null ? String(item.monthly_days) : '')
      setStartDate(item.start_date ? String(item.start_date).slice(0, 10) : '')

      setRfCode(String(item.rf_code || ''))

      if (sub === 'utility') {
        setName(String(item.name || ''))
        setRfCode(String(item.rf_code || ''))
        setBankName(String(item.bank_name || ''))
      }
    }

    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = async () => {
    const activeStoreId =
      urlStoreId ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
      storeId

    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    try {
      setSaving(true)

      // -------------------- SUPPLIERS --------------------
      if (activeTab === 'suppliers') {
        const trimmed = name.trim()
        if (!trimmed) return toast.error('Γράψε όνομα')

        const payload: any = {
          name: trimmed,
          phone: phone.trim() || null,
          vat_number: vatNumber.trim() || null,
          bank_name: bankName.trim() || null,
          iban: iban.trim() || null,
        }

        if (editingId) {
          const { data, error } = await supabase
            .from('suppliers')
            .update(payload)
            .eq('id', editingId)
            .eq('store_id', activeStoreId)
            .select('id, name, phone, vat_number, bank_name, iban, is_active, created_at')
            .single()

          if (error) throw error

          setSuppliers(prev =>
            prev
              .map(x => (String(x.id) === String(editingId) ? data : x))
              .sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Ενημερώθηκε!')
        } else {
          const { data, error } = await supabase
            .from('suppliers')
            .insert([{ ...payload, store_id: activeStoreId }])
            .select('id, name, phone, vat_number, bank_name, iban, is_active, created_at')
            .single()

          if (error) throw error

          setSuppliers(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
          toast.success('Προστέθηκε!')
        }

        resetForm()
        loadData() // ✅ refresh totals & ranking
        return
      }

      // -------------------- FIXED_ASSETS --------------------
      const subCategoryToSave = activeTab === 'maintenance' ? 'Maintenance' : currentTab.subCategory

      // -------------------- UTILITY --------------------
      if (activeTab === 'utility') {
        const trimmedName = name.trim()
        const trimmedRf = rfCode.trim()
        if (!trimmedName) return toast.error('Γράψε Όνομα (π.χ. Ενοίκιο)')
        if (!trimmedRf) return toast.error('Γράψε Κωδικό RF')

        const payload: any = {
          name: trimmedName,
          rf_code: trimmedRf || null,
          bank_name: bankName || null,

          iban: null,
          monthly_days: null,
          monthly_salary: null,
          daily_rate: null,
          start_date: null,
          vat_number: null,
          phone: null,
          pay_basis: null,
        }

        if (editingId) {
          const { data, error } = await supabase
            .from('fixed_assets')
            .update(payload)
            .eq('id', editingId)
            .eq('store_id', activeStoreId)
            .select(
              'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
            )
            .single()

          if (error) throw error

          setFixedAssets(prev =>
            prev
              .map(x => (String(x.id) === String(editingId) ? data : x))
              .sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Ενημερώθηκε!')
        } else {
          const { data, error } = await supabase
            .from('fixed_assets')
            .insert([{ ...payload, store_id: activeStoreId, sub_category: subCategoryToSave }])
            .select(
              'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
            )
            .single()

          if (error) throw error

          setFixedAssets(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
          toast.success('Προστέθηκε!')
        }

        resetForm()
        loadData()
        return
      }

      // -------------------- STAFF --------------------
      if (activeTab === 'staff') {
        const trimmed = name.trim()
        if (!trimmed) return toast.error('Γράψε Ονοματεπώνυμο')

        const md = monthlyDays.trim()
        const sd = startDate.trim()
        const mSalary = monthlySalary.trim()
        const dRate = dailyRate.trim()

        const payload: any = {
          name: trimmed,
          bank_name: bankName || null,
          iban: iban.trim() || null,
          monthly_days: md ? Number(md) : null,
          monthly_salary: payBasis === 'monthly' && mSalary ? Number(mSalary) : null,
          daily_rate: payBasis === 'daily' && dRate ? Number(dRate) : null,
          start_date: sd || null,
          pay_basis: payBasis,

          rf_code: null,
          vat_number: null,
          phone: null,
        }

        if (editingId) {
          const { data, error } = await supabase
            .from('fixed_assets')
            .update(payload)
            .eq('id', editingId)
            .eq('store_id', activeStoreId)
            .select(
              'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
            )
            .single()

          if (error) throw error

          setFixedAssets(prev =>
            prev
              .map(x => (String(x.id) === String(editingId) ? data : x))
              .sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Ενημερώθηκε!')
        } else {
          const { data, error } = await supabase
            .from('fixed_assets')
            .insert([{ ...payload, store_id: activeStoreId, sub_category: subCategoryToSave }])
            .select(
              'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
            )
            .single()

          if (error) throw error

          setFixedAssets(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
          toast.success('Προστέθηκε!')
        }

        resetForm()
        loadData()
        return
      }

      // -------------------- MAINTENANCE + OTHER --------------------
      if (activeTab === 'maintenance' || activeTab === 'other') {
        const trimmed = name.trim()
        if (!trimmed) return toast.error('Γράψε όνομα')

        const payload: any = {
          name: trimmed,
          phone: phone.trim() || null,
          vat_number: vatNumber.trim() || null,
          bank_name: bankName || null,
          iban: iban.trim() || null,

          monthly_days: null,
          monthly_salary: null,
          daily_rate: null,
          start_date: null,
          rf_code: null,
          pay_basis: null,
        }

        if (editingId) {
          const { data, error } = await supabase
            .from('fixed_assets')
            .update(payload)
            .eq('id', editingId)
            .eq('store_id', activeStoreId)
            .select(
              'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
            )
            .single()

          if (error) throw error

          setFixedAssets(prev =>
            prev
              .map(x => (String(x.id) === String(editingId) ? data : x))
              .sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Ενημερώθηκε!')
        } else {
          const { data, error } = await supabase
            .from('fixed_assets')
            .insert([{ ...payload, store_id: activeStoreId, sub_category: subCategoryToSave }])
            .select(
              'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis, created_at',
            )
            .single()

          if (error) throw error

          setFixedAssets(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
          toast.success('Προστέθηκε!')
        }

        resetForm()
        loadData()
        return
      }

      toast.error('Άγνωστη επιλογή')
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία καταχώρησης')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = confirm('Οριστική διαγραφή;')
    if (!ok) return

    const activeStoreId =
      urlStoreId ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
      storeId

    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    try {
      setSaving(true)

      if (activeTab === 'suppliers') {
        const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('store_id', activeStoreId)
        if (error) throw error
        setSuppliers(prev => prev.filter(x => String(x.id) !== String(id)))
      } else {
        const { error } = await supabase.from('fixed_assets').delete().eq('id', id).eq('store_id', activeStoreId)
        if (error) throw error
        setFixedAssets(prev => prev.filter(x => String(x.id) !== String(id)))
      }

      if (editingId && String(id) === String(editingId)) resetForm()

      toast.success('Διαγράφηκε!')
      loadData()
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία διαγραφής')
    } finally {
      setSaving(false)
    }
  }

  const onChangeCategory = (key: TabKey) => {
    setActiveTab(key)
    setSearch('')
    resetForm()
  }

  // ---------------------- UI ----------------------
  const renderForm = () => {
    if (activeTab === 'suppliers') {
      return (
        <div style={formCard}>
          <div style={inputGroup}>
            <label style={labelStyle}>
              <Hash size={12} /> ΕΠΩΝΥΜΙΑ
            </label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="π.χ. COCA COLA" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={inputGroup}>
              <label style={labelStyle}>
                <Phone size={12} /> ΤΗΛΕΦΩΝΟ
              </label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>
                <Tag size={12} /> ΑΦΜ
              </label>
              <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>
              <Building2 size={12} /> ΤΡΑΠΕΖΑ
            </label>
            <select value={bankName} onChange={e => setBankName(e.target.value)} style={inputStyle}>
              <option value="">Επιλέξτε Τράπεζα...</option>
              {BANK_OPTIONS.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>
              <CreditCard size={12} /> IBAN
            </label>
            <input value={iban} onChange={e => setIban(e.target.value)} style={inputStyle} placeholder="GR..." />
          </div>

          <button onClick={handleSave} disabled={saving || loading} style={saveBtn}>
            {saving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )
    }

    if (activeTab === 'utility') {
      return (
        <div style={formCard}>
          <div style={inputGroup}>
            <label style={labelStyle}>
              <Hash size={12} /> ΟΝΟΜΑ
            </label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="π.χ. Ενοίκιο" />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>
              <Tag size={12} /> ΚΩΔΙΚΟΣ RF
            </label>
            <input value={rfCode} onChange={e => setRfCode(e.target.value)} style={inputStyle} placeholder="RF..." />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>
              <Building2 size={12} /> ΤΡΑΠΕΖΑ
            </label>
            <select value={bankName} onChange={e => setBankName(e.target.value)} style={inputStyle}>
              <option value="">Επιλέξτε Τράπεζα...</option>
              {BANK_OPTIONS.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleSave} disabled={saving || loading} style={saveBtn}>
            {saving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )
    }

    if (activeTab === 'staff') {
      const salaryLabel = payBasis === 'monthly' ? 'ΜΙΣΘΟΣ' : 'ΗΜΕΡΟΜΙΣΘΙΟ'
      const salaryValue = payBasis === 'monthly' ? monthlySalary : dailyRate
      const setSalaryValue = (v: string) => (payBasis === 'monthly' ? setMonthlySalary(v) : setDailyRate(v))

      return (
        <div style={formCard}>
          <div style={inputGroup}>
            <label style={labelStyle}>
              <Hash size={12} /> ΟΝΟΜΑΤΕΠΩΝΥΜΟ
            </label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="π.χ. Γιάννης Παπαδόπουλος" />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>ΤΥΠΟΣ ΣΥΜΦΩΝΙΑΣ</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setPayBasis('monthly')}
                style={{
                  ...segBtn,
                  backgroundColor: payBasis === 'monthly' ? colors.primaryDark : colors.white,
                  color: payBasis === 'monthly' ? 'white' : colors.primaryDark,
                  borderColor: payBasis === 'monthly' ? colors.primaryDark : colors.border,
                }}
              >
                ΜΗΝΙΑΙΟΣ
              </button>
              <button
                type="button"
                onClick={() => setPayBasis('daily')}
                style={{
                  ...segBtn,
                  backgroundColor: payBasis === 'daily' ? colors.primaryDark : colors.white,
                  color: payBasis === 'daily' ? 'white' : colors.primaryDark,
                  borderColor: payBasis === 'daily' ? colors.primaryDark : colors.border,
                }}
              >
                ΗΜΕΡΟΜΙΣΘΙΟ
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={inputGroup}>
              <label style={labelStyle}>{salaryLabel}</label>
              <input
                value={salaryValue}
                onChange={e => setSalaryValue(e.target.value)}
                style={inputStyle}
                placeholder={payBasis === 'monthly' ? 'π.χ. 1200' : 'π.χ. 50'}
                inputMode="decimal"
              />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>ΜΕΡΕΣ ΜΗΝΑ</label>
              <input value={monthlyDays} onChange={e => setMonthlyDays(e.target.value)} style={inputStyle} placeholder="π.χ. 26" inputMode="numeric" />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>ΗΜ. ΠΡΟΣΛΗΨΗΣ</label>
              <input value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} type="date" />
            </div>
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>
              <Building2 size={12} /> ΤΡΑΠΕΖΑ
            </label>
            <select value={bankName} onChange={e => setBankName(e.target.value)} style={inputStyle}>
              <option value="">Επιλέξτε Τράπεζα...</option>
              {BANK_OPTIONS.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>
              <CreditCard size={12} /> IBAN
            </label>
            <input value={iban} onChange={e => setIban(e.target.value)} style={inputStyle} placeholder="GR..." />
          </div>

          <button onClick={handleSave} disabled={saving || loading} style={saveBtn}>
            {saving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )
    }

    // maintenance & other share same form
    return (
      <div style={formCard}>
        <div style={inputGroup}>
          <label style={labelStyle}>
            <Hash size={12} /> ΟΝΟΜΑ
          </label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="π.χ. ΤΖΗΛΙΟΣ" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={inputGroup}>
            <label style={labelStyle}>
              <Phone size={12} /> ΤΗΛΕΦΩΝΟ
            </label>
            <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
          </div>
          <div style={inputGroup}>
            <label style={labelStyle}>
              <Tag size={12} /> ΑΦΜ
            </label>
            <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={inputGroup}>
          <label style={labelStyle}>
            <Building2 size={12} /> ΤΡΑΠΕΖΑ
          </label>
          <select value={bankName} onChange={e => setBankName(e.target.value)} style={inputStyle}>
            <option value="">Επιλέξτε Τράπεζα...</option>
            {BANK_OPTIONS.map(b => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div style={inputGroup}>
          <label style={labelStyle}>
            <CreditCard size={12} /> IBAN
          </label>
          <input value={iban} onChange={e => setIban(e.target.value)} style={inputStyle} placeholder="GR..." />
        </div>

        <button onClick={handleSave} disabled={saving || loading} style={saveBtn}>
          {saving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΚΑΤΑΧΩΡΗΣΗ'}
        </button>
      </div>
    )
  }

  const renderExpandedMeta = (item: any) => {
    const ibanValue = String(item?.iban || '').trim()

    const IbanLine = () => (
      <p style={infoText}>
        <strong>IBAN:</strong>{' '}
        {ibanValue ? (
          <span
            onClick={() => copyToClipboard(ibanValue)}
            style={{ fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}
            title="Πάτα για αντιγραφή"
          >
            {ibanValue}
          </span>
        ) : (
          '-'
        )}
      </p>
    )

    if (activeTab === 'suppliers') {
      return (
        <div style={infoGrid}>
          <p style={infoText}><strong>Τηλ:</strong> {item.phone || '-'}</p>
          <p style={infoText}><strong>ΑΦΜ:</strong> {item.vat_number || '-'}</p>
          <p style={infoText}><strong>Τράπεζα:</strong> {item.bank_name || '-'}</p>
          <IbanLine />
        </div>
      )
    }

    const sub = String(item.sub_category || '')
    if (sub === 'utility') {
      return (
        <div style={infoGrid}>
          <p style={infoText}><strong>RF:</strong> {item.rf_code || '-'}</p>
          <p style={infoText}><strong>Τράπεζα:</strong> {item.bank_name || '-'}</p>
          <p style={infoText}><strong>Κατηγορία:</strong> Λογαριασμοί</p>
        </div>
      )
    }

    if (sub === 'staff') {
      const pb = item.pay_basis === 'daily' ? 'ΗΜΕΡΟΜΙΣΘΙΟ' : 'ΜΗΝΙΑΙΟΣ'
      const amount = item.pay_basis === 'daily' ? item.daily_rate ?? '-' : item.monthly_salary ?? '-'
      return (
        <div style={infoGrid}>
          <p style={infoText}><strong>Συμφωνία:</strong> {pb}</p>
          <p style={infoText}><strong>Ποσό:</strong> {String(amount)}</p>
          <p style={infoText}><strong>Μέρες:</strong> {String(item.monthly_days ?? '-')}</p>
          <p style={infoText}><strong>Ημ. πρόσληψης:</strong> {item.start_date ? String(item.start_date).slice(0, 10) : '-'}</p>
          <p style={infoText}><strong>Τράπεζα:</strong> {item.bank_name || '-'}</p>
          <IbanLine />
        </div>
      )
    }

    return (
      <div style={infoGrid}>
        <p style={infoText}><strong>Τηλ:</strong> {item.phone || '-'}</p>
        <p style={infoText}><strong>ΑΦΜ:</strong> {item.vat_number || '-'}</p>
        <p style={infoText}><strong>Τράπεζα:</strong> {item.bank_name || '-'}</p>
        <IbanLine />
        <p style={infoText}><strong>Κατηγορία:</strong> {sub === 'Maintenance' ? 'Συντήρηση' : sub || '-'}</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      <div style={contentWrapper}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Manage Lists</h1>
            <p style={subtitleStyle}>
              ΚΑΤΑΣΤΗΜΑ: <span style={{ color: colors.accentBlue }}>{currentStoreName.toUpperCase()}</span>
            </p>
          </div>
          <Link href={backHref} style={closeBtn}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        {/* ✅ DROPDOWN MENU */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ</label>
          <select
            value={activeTab}
            onChange={e => onChangeCategory(e.target.value as TabKey)}
            style={inputStyle}
          >
            {MENU.map(m => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* ✅ ADD BUTTON */}
        <button
          onClick={() => {
            editingId ? resetForm() : setIsFormOpen(!isFormOpen)
          }}
          style={isFormOpen ? cancelBtn : addBtn}
        >
          {isFormOpen ? 'ΑΚΥΡΩΣΗ' : (
            <>
              <Plus size={16} /> {currentTab.addLabel}
            </>
          )}
        </button>

        {/* FORM */}
        {isFormOpen && (
          <>
            {editingId && (
              <button type="button" onClick={resetForm} style={miniCancel} disabled={saving || loading}>
                <XCircle size={14} /> Ακύρωση Επεξεργασίας
              </button>
            )}
            {renderForm()}
          </>
        )}

        {/* ✅ SEARCH (fixed icon overlap) */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>ΑΝΑΖΗΤΗΣΗ</label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.secondaryText,
                pointerEvents: 'none',
                opacity: 0.85,
              }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'suppliers' ? 'Όνομα / ΑΦΜ / Τηλέφωνο...' : 'Γράψτε για αναζήτηση...'}
              style={{ ...inputStyle, paddingLeft: 52 }}
            />
          </div>
        </div>

        {/* ✅ LIST (ranking by turnover + amount shown) */}
        <div style={listArea}>
          <div style={rankingHeader}>
            <TrendingUp size={14} />
            ΚΑΤΑΤΑΞΗ ΒΑΣΕΙ ΤΖΙΡΟΥ: {currentTab.label.toUpperCase()}
          </div>

          {loading ? (
            <p style={emptyText}>Συγχρονισμός δεδομένων...</p>
          ) : visibleItems.length === 0 ? (
            <p style={emptyText}>Δεν υπάρχουν εγγραφές.</p>
          ) : (
            visibleItems.map((item: any, idx: number) => {
              const isEditingThis = editingId && String(editingId) === String(item.id)
              const turnover = getTurnover(String(item.id))

              return (
                <div key={item.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div
                    style={rowWrapper}
                    onClick={() => setExpandedId(expandedId === String(item.id) ? null : String(item.id))}
                  >
                    <div style={rankNumber}>{idx + 1}</div>

                    <div style={{ flex: 1 }}>
                      <p style={rowName}>{String(item.name || '').toUpperCase()}</p>
                      <p style={categoryBadge}>
                        {activeTab === 'suppliers'
                          ? item.bank_name
                            ? `ΤΡΑΠΕΖΑ: ${item.bank_name}`
                            : '—'
                          : String(item.sub_category || '') === 'Maintenance'
                            ? 'ΣΥΝΤΗΡΗΣΗ'
                            : String(item.sub_category || '').toUpperCase() || '—'}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p style={turnoverText}>{turnover.toFixed(2)}€</p>
                    </div>

                    {isEditingThis && (
                      <span style={editingPill}>
                        <Pencil size={12} /> Editing
                      </span>
                    )}
                  </div>

                  {expandedId === String(item.id) && (
                    <div style={actionPanel}>
                      {renderExpandedMeta(item)}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button onClick={() => handleEdit(item)} style={editBtn}>
                          <Pencil size={14} /> Διόρθωση
                        </button>
                        <button onClick={() => handleDelete(String(item.id))} style={delBtn}>
                          <Trash2 size={14} /> Διαγραφή
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <p style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
          * Για ασφάλεια, η διαγραφή ζητά επιβεβαίωση.
        </p>
      </div>
    </div>
  )
}

/* ---------------- STYLES (Suppliers-like) ---------------- */

const containerStyle: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100%',
  width: '100%',
  padding: '20px',
  touchAction: 'pan-y',
}

const contentWrapper: any = { maxWidth: '560px', margin: '0 auto', paddingBottom: '120px' }

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }
const titleStyle: any = { fontSize: '22px', fontWeight: '800', color: colors.primaryDark, margin: 0 }
const subtitleStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginTop: '4px' }

const closeBtn: any = {
  padding: '8px',
  background: 'white',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  color: colors.primaryDark,
  textDecoration: 'none',
  display: 'flex',
}

const addBtn: any = {
  width: '100%',
  backgroundColor: colors.primaryDark,
  color: 'white',
  padding: '16px',
  borderRadius: '16px',
  fontWeight: '800',
  border: 'none',
  marginBottom: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
}

const cancelBtn: any = { ...addBtn, backgroundColor: '#fee2e2', color: colors.accentRed }

const miniCancel: any = {
  width: '100%',
  marginBottom: 12,
  padding: '12px',
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: 'white',
  color: colors.primaryDark,
  fontWeight: 800,
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
}

const formCard: any = {
  background: 'white',
  padding: '24px',
  borderRadius: '24px',
  marginBottom: '16px',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
}

const inputGroup: any = { marginBottom: '15px' }

const labelStyle: any = {
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  marginBottom: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const inputStyle: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontSize: '16px',
  fontWeight: '600',
  outline: 'none',
  backgroundColor: colors.bgLight,
}

const saveBtn: any = {
  width: '100%',
  padding: '16px',
  backgroundColor: colors.accentGreen,
  color: 'white',
  borderRadius: '16px',
  border: 'none',
  fontWeight: '800',
  fontSize: '14px',
  marginTop: '10px',
  cursor: 'pointer',
}

const listArea: any = {
  background: 'white',
  borderRadius: '24px',
  border: `1px solid ${colors.border}`,
  overflow: 'hidden',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
}

const rankingHeader: any = {
  padding: '14px 20px',
  backgroundColor: colors.bgLight,
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const rowWrapper: any = { display: 'flex', padding: '18px 20px', alignItems: 'center', cursor: 'pointer', gap: 10 }

const rankNumber: any = { width: '30px', fontWeight: '800', color: colors.secondaryText, fontSize: '14px' }

const rowName: any = { fontSize: '15px', fontWeight: '800', margin: 0, color: colors.primaryDark }

const categoryBadge: any = { fontSize: '10px', fontWeight: '700', color: colors.secondaryText, margin: 0 }

const turnoverText: any = { fontSize: '16px', fontWeight: '800', color: colors.accentGreen, margin: 0 }

const editingPill: any = {
  marginLeft: 10,
  fontSize: 11,
  fontWeight: 800,
  color: colors.accentBlue,
  backgroundColor: '#eef2ff',
  border: '1px solid #c7d2fe',
  padding: '6px 10px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
}

const actionPanel: any = { padding: '20px', backgroundColor: '#fcfcfc', borderTop: `1px dashed ${colors.border}` }

const infoGrid: any = { display: 'grid', gap: '8px' }

const infoText: any = { fontSize: '12px', margin: 0, color: colors.primaryDark }

const editBtn: any = {
  flex: 1,
  padding: '10px',
  background: colors.warning,
  color: colors.warningText,
  border: 'none',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  cursor: 'pointer',
}

const delBtn: any = {
  flex: 1,
  padding: '10px',
  background: '#fee2e2',
  color: colors.accentRed,
  border: 'none',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  cursor: 'pointer',
}

const emptyText: any = { padding: '40px', textAlign: 'center', color: colors.secondaryText, fontSize: '13px', fontWeight: '600' }

const segBtn: any = {
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  padding: '12px 12px',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 900,
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.06)',
  userSelect: 'none',
}

export default function ManageListsPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <ManageListsContent />
    </Suspense>
  )
}