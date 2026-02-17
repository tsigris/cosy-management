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
  Save,
} from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  labelGray: '#334155',
  labelBlue: '#1d4ed8',
  labelGreen: '#047857',
}

const BANK_OPTIONS = [
  'Εθνική Τράπεζα',
  'Eurobank',
  'Alpha Bank',
  'Viva Wallet',
  'Τράπεζα Πειραιώς',
] as const

type TabKey = 'suppliers' | 'maintenance' | 'utility' | 'staff' | 'other'
const TABS: Array<{
  key: TabKey
  label: string
  icon: any
  subCategory: 'Maintenance' | 'utility' | 'staff' | 'other' | null
}> = [
  { key: 'suppliers', label: 'Προμηθευτές', icon: Users, subCategory: null },
  { key: 'maintenance', label: 'Συντήρηση', icon: Wrench, subCategory: 'Maintenance' },
  { key: 'utility', label: 'Λογαριασμοί', icon: Lightbulb, subCategory: 'utility' },
  { key: 'staff', label: 'Προσωπικό', icon: User, subCategory: 'staff' },
  { key: 'other', label: 'Λοιπά', icon: Package, subCategory: 'other' },
]

type PayBasis = 'monthly' | 'daily'

function ManageListsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlStoreId = searchParams.get('store')
  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [activeTab, setActiveTab] = useState<TabKey>('suppliers')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])

  // Common form fields (suppliers + fixed_assets depending tab)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')

  // Staff fields
  const [payBasis, setPayBasis] = useState<PayBasis>('monthly')
  const [monthlySalary, setMonthlySalary] = useState<string>('') // stored to monthly_salary
  const [dailyRate, setDailyRate] = useState<string>('') // stored to daily_rate
  const [monthlyDays, setMonthlyDays] = useState<string>('') // stored to monthly_days
  const [startDate, setStartDate] = useState<string>('') // stored to start_date (YYYY-MM-DD)

  // Utility fields
  const [rfCode, setRfCode] = useState('') // stored to rf_code (and also name for utility)

  const [search, setSearch] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  const currentTab = useMemo(() => TABS.find(t => t.key === activeTab)!, [activeTab])

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
  }, [])

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (activeTab === 'suppliers') {
      const base = suppliers
      if (!q) return base
      return base.filter((x: any) => {
        const n = String(x.name || '').toLowerCase()
        const v = String(x.vat_number || '').toLowerCase()
        const p = String(x.phone || '').toLowerCase()
        return n.includes(q) || v.includes(q) || p.includes(q)
      })
    }

    const base = fixedAssets.filter((x: any) => (x.sub_category || '') === currentTab.subCategory)
    if (!q) return base

    return base.filter((x: any) => {
      const n = String(x.name || '').toLowerCase()
      const rf = String(x.rf_code || '').toLowerCase()
      const v = String(x.vat_number || '').toLowerCase()
      const p = String(x.phone || '').toLowerCase()
      return n.includes(q) || rf.includes(q) || v.includes(q) || p.includes(q)
    })
  }, [activeTab, suppliers, fixedAssets, search, currentTab.subCategory])

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

      const [sRes, fRes] = await Promise.all([
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
      ])

      if (sRes.error) throw sRes.error
      if (fRes.error) throw fRes.error

      setSuppliers(sRes.data || [])
      setFixedAssets(fRes.data || [])
    } catch (e: any) {
      toast.error(e?.message || 'Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [router, urlStoreId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleEdit = (item: any) => {
    setEditingId(String(item.id))

    if (activeTab === 'suppliers') {
      setName(String(item.name || ''))
      setPhone(String(item.phone || ''))
      setVatNumber(String(item.vat_number || ''))
      setBankName(String(item.bank_name || ''))
      setIban(String(item.iban || ''))

      // reset non-supplier specific
      setPayBasis('monthly')
      setMonthlySalary('')
      setDailyRate('')
      setMonthlyDays('')
      setStartDate('')
      setRfCode('')
    } else {
      const sub = String(item.sub_category || '')

      // Defaults
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

      // If utility: we show ONLY RF code, so use that as main editable value.
      if (sub === 'utility') {
        setRfCode(String(item.rf_code || item.name || ''))
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

          setSuppliers(prev =>
            [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Προστέθηκε!')
        }

        resetForm()
        return
      }

      // -------------------- FIXED_ASSETS --------------------
      const subCategoryToSave = activeTab === 'maintenance' ? 'Maintenance' : currentTab.subCategory

      // Utility: show ONLY RF Code, so store it in rf_code and also name for identification
      if (activeTab === 'utility') {
        const code = rfCode.trim()
        if (!code) return toast.error('Γράψε Κωδικό RF')

        const payload: any = {
          name: code, // keeps it usable in list/title
          rf_code: code || null,
          // keep only required fields; still allowed by requirement list
          bank_name: null,
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

          setFixedAssets(prev =>
            [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Προστέθηκε!')
        }

        resetForm()
        return
      }

      // Staff validation + payload
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
          // keep these fields available (even if not used)
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

          setFixedAssets(prev =>
            [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Προστέθηκε!')
        }

        resetForm()
        return
      }

      // Maintenance + Other: add phone, vat_number, bank dropdown, iban
      if (activeTab === 'maintenance' || activeTab === 'other') {
        const trimmed = name.trim()
        if (!trimmed) return toast.error('Γράψε όνομα')

        const payload: any = {
          name: trimmed,
          phone: phone.trim() || null,
          vat_number: vatNumber.trim() || null,
          bank_name: bankName || null,
          iban: iban.trim() || null,
          // keep required fields present (per request)
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

          setFixedAssets(prev =>
            [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))),
          )
          toast.success('Προστέθηκε!')
        }

        resetForm()
        return
      }

      // Fallback (should not happen)
      toast.error('Άγνωστη καρτέλα')
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία καταχώρησης')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: any) => {
    const label = String(item?.name || '').trim()
    const ok = confirm(`Να διαγραφεί το "${label}"?`)
    if (!ok) return

    const activeStoreId =
      urlStoreId ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
      storeId

    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    try {
      setSaving(true)

      if (activeTab === 'suppliers') {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', item.id)
          .eq('store_id', activeStoreId)
        if (error) throw error
        setSuppliers(prev => prev.filter(x => x.id !== item.id))
      } else {
        const { error } = await supabase
          .from('fixed_assets')
          .delete()
          .eq('id', item.id)
          .eq('store_id', activeStoreId)
        if (error) throw error
        setFixedAssets(prev => prev.filter(x => x.id !== item.id))
      }

      if (editingId && String(item.id) === String(editingId)) resetForm()

      toast.success('Διαγράφηκε!')
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία διαγραφής')
    } finally {
      setSaving(false)
    }
  }

  const backHref = useMemo(() => {
    const s = urlStoreId || storeId || ''
    return s ? `/?store=${s}` : '/'
  }, [storeId, urlStoreId])

  const formTitle = useMemo(() => {
    if (editingId) return `EDIT: ${currentTab.label}`
    return `ΝΕΑ ΚΑΤΑΧΩΡΗΣΗ: ${currentTab.label}`
  }, [editingId, currentTab.label])

  const renderFormFields = () => {
    // ---------------- SUPPLIERS (unchanged behavior) ----------------
    if (activeTab === 'suppliers') {
      return (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Όνομα για "${currentTab.label}"`}
              style={inputStyle}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ ...iconBtn, opacity: saving || loading ? 0.7 : 1 }}
              aria-label={editingId ? 'Update' : 'Add'}
              title={editingId ? 'Update' : 'Add'}
            >
              {editingId ? <Save size={16} /> : <Plus size={16} />}
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={grid2}>
              <div>
                <label style={{ ...miniLabel, color: colors.labelGreen }}>ΤΗΛΕΦΩΝΟ</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="π.χ. 6970000000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...miniLabel, color: colors.labelGray }}>ΑΦΜ</label>
                <input
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                  placeholder="π.χ. 123456789"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={{ ...miniLabel, color: colors.labelGray }}>ΤΡΑΠΕΖΑ</label>
                <input
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="π.χ. Alpha / Eurobank"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...miniLabel, color: colors.labelBlue }}>IBAN</label>
                <input
                  value={iban}
                  onChange={e => setIban(e.target.value)}
                  placeholder="π.χ. GR12 3456 ...."
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={hintPill}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.secondaryText }}>
                * Η αναζήτηση ψάχνει και σε <span style={{ color: colors.labelGray }}>ΑΦΜ</span> /{' '}
                <span style={{ color: colors.labelGreen }}>Τηλέφωνο</span>.
              </span>
            </div>
          </div>
        </>
      )
    }

    // ---------------- UTILITY: ONLY RF CODE ----------------
    if (activeTab === 'utility') {
      return (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={rfCode}
              onChange={e => setRfCode(e.target.value)}
              placeholder="ΚΩΔΙΚΟΣ RF"
              style={inputStyle}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ ...iconBtn, opacity: saving || loading ? 0.7 : 1 }}
              aria-label={editingId ? 'Update' : 'Add'}
              title={editingId ? 'Update' : 'Add'}
            >
              {editingId ? <Save size={16} /> : <Plus size={16} />}
            </button>
          </div>

          <div style={{ marginTop: 10, ...hintPill }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: colors.secondaryText }}>
              * Στους <b>Λογαριασμούς</b> αποθηκεύουμε μόνο τον <b>Κωδικό RF</b>.
            </span>
          </div>
        </>
      )
    }

    // ---------------- STAFF: rebuilt layout like photo ----------------
    if (activeTab === 'staff') {
      const salaryLabel = payBasis === 'monthly' ? 'ΜΙΣΘΟΣ' : 'ΗΜΕΡΟΜΙΣΘΙΟ'
      const salaryValue = payBasis === 'monthly' ? monthlySalary : dailyRate
      const setSalaryValue = (v: string) => (payBasis === 'monthly' ? setMonthlySalary(v) : setDailyRate(v))

      return (
        <>
          {/* a) Full width name */}
          <div>
            <label style={{ ...miniLabel, color: colors.labelGray }}>ΟΝΟΜΑΤΕΠΩΝΥΜΟ</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="π.χ. Γιάννης Παπαδόπουλος"
              style={inputStyle}
            />
          </div>

          {/* b) Segmented control */}
          <div style={{ marginTop: 12 }}>
            <label style={{ ...miniLabel, color: colors.labelGray }}>ΤΥΠΟΣ ΣΥΜΦΩΝΙΑΣ</label>
            <div style={segWrap}>
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

          {/* c) Salary + Days + Start date in one row (grid) */}
          <div style={{ marginTop: 12, ...grid3 }}>
            <div>
              <label style={{ ...miniLabel, color: colors.labelGreen }}>{salaryLabel}</label>
              <input
                value={salaryValue}
                onChange={e => setSalaryValue(e.target.value)}
                placeholder={payBasis === 'monthly' ? 'π.χ. 1200' : 'π.χ. 50'}
                inputMode="decimal"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ ...miniLabel, color: colors.labelGray }}>ΜΕΡΕΣ ΜΗΝΑ</label>
              <input
                value={monthlyDays}
                onChange={e => setMonthlyDays(e.target.value)}
                placeholder="π.χ. 26"
                inputMode="numeric"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ ...miniLabel, color: colors.labelGray }}>ΗΜ. ΠΡΟΣΛΗΨΗΣ</label>
              <input value={startDate} onChange={e => setStartDate(e.target.value)} type="date" style={inputStyle} />
            </div>
          </div>

          {/* d) Bank dropdown */}
          <div style={{ marginTop: 12 }}>
            <label style={{ ...miniLabel, color: colors.labelGray }}>ΤΡΑΠΕΖΑ ΥΠΑΛΛΗΛΟΥ</label>
            <select value={bankName} onChange={e => setBankName(e.target.value)} style={selectStyle}>
              <option value="">Επιλογή...</option>
              {BANK_OPTIONS.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* e) IBAN full width */}
          <div style={{ marginTop: 12 }}>
            <label style={{ ...miniLabel, color: colors.labelBlue }}>IBAN ΥΠΑΛΛΗΛΟΥ</label>
            <input
              value={iban}
              onChange={e => setIban(e.target.value)}
              placeholder="π.χ. GR12 3456 ...."
              style={inputStyle}
            />
          </div>

          {/* SAVE row */}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ ...primaryBtnWide, opacity: saving || loading ? 0.7 : 1 }}
            >
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              <span style={{ fontSize: 16, fontWeight: 900 }}>{editingId ? 'ΑΠΟΘΗΚΕΥΣΗ' : 'ΠΡΟΣΘΗΚΗ'}</span>
            </button>
          </div>
        </>
      )
    }

    // ---------------- MAINTENANCE + OTHER: extra fields + bank dropdown ----------------
    if (activeTab === 'maintenance' || activeTab === 'other') {
      return (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Όνομα για "${currentTab.label}"`}
              style={inputStyle}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{ ...iconBtn, opacity: saving || loading ? 0.7 : 1 }}
              aria-label={editingId ? 'Update' : 'Add'}
              title={editingId ? 'Update' : 'Add'}
            >
              {editingId ? <Save size={16} /> : <Plus size={16} />}
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={grid2}>
              <div>
                <label style={{ ...miniLabel, color: colors.labelGreen }}>ΤΗΛΕΦΩΝΟ</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="π.χ. 6970000000"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...miniLabel, color: colors.labelGray }}>ΑΦΜ</label>
                <input
                  value={vatNumber}
                  onChange={e => setVatNumber(e.target.value)}
                  placeholder="π.χ. 123456789"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={grid2}>
              <div>
                <label style={{ ...miniLabel, color: colors.labelGray }}>ΤΡΑΠΕΖΑ</label>
                <select value={bankName} onChange={e => setBankName(e.target.value)} style={selectStyle}>
                  <option value="">Επιλογή...</option>
                  {BANK_OPTIONS.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...miniLabel, color: colors.labelBlue }}>IBAN</label>
                <input
                  value={iban}
                  onChange={e => setIban(e.target.value)}
                  placeholder="π.χ. GR12 3456 ...."
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </>
      )
    }

    // ---------------- Fallback (should not hit) ----------------
    return (
      <div style={hintBox}>
        <span style={{ fontSize: 16, fontWeight: 900 }}>Δεν υπάρχει φόρμα για αυτή την καρτέλα.</span>
      </div>
    )
  }

  const renderListMeta = (item: any) => {
    if (activeTab === 'suppliers') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGreen }}>Τηλέφωνο:</span>
            <span style={metaValue}>{String(item.phone || '-')}</span>
          </div>

          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>ΑΦΜ:</span>
            <span style={metaValue}>{String(item.vat_number || '-')}</span>
          </div>

          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>Τράπεζα:</span>
            <span style={metaValue}>{String(item.bank_name || '-')}</span>
          </div>

          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelBlue }}>IBAN:</span>
            <span style={metaValue}>{String(item.iban || '-')}</span>
          </div>
        </div>
      )
    }

    const sub = String(item.sub_category || '')

    if (sub === 'utility') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>ΚΩΔΙΚΟΣ RF:</span>
            <span style={metaValue}>{String(item.rf_code || item.name || '-')}</span>
          </div>
        </div>
      )
    }

    if (sub === 'staff') {
      const pb = item.pay_basis === 'daily' ? 'ΗΜΕΡΟΜΙΣΘΙΟ' : 'ΜΗΝΙΑΙΟΣ'
      const amount =
        item.pay_basis === 'daily' ? item.daily_rate ?? '-' : item.monthly_salary ?? '-'

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>Συμφωνία:</span>
            <span style={metaValue}>{pb}</span>
          </div>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGreen }}>Ποσό:</span>
            <span style={metaValue}>{String(amount)}</span>
          </div>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>Μέρες:</span>
            <span style={metaValue}>{String(item.monthly_days ?? '-')}</span>
          </div>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>Ημ. πρόσληψης:</span>
            <span style={metaValue}>{String(item.start_date ? String(item.start_date).slice(0, 10) : '-')}</span>
          </div>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelGray }}>Τράπεζα:</span>
            <span style={metaValue}>{String(item.bank_name || '-')}</span>
          </div>
          <div style={metaRow}>
            <span style={{ ...metaLabel, color: colors.labelBlue }}>IBAN:</span>
            <span style={metaValue}>{String(item.iban || '-')}</span>
          </div>
        </div>
      )
    }

    // Maintenance / Other
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={metaRow}>
          <span style={{ ...metaLabel, color: colors.labelGreen }}>Τηλέφωνο:</span>
          <span style={metaValue}>{String(item.phone || '-')}</span>
        </div>

        <div style={metaRow}>
          <span style={{ ...metaLabel, color: colors.labelGray }}>ΑΦΜ:</span>
          <span style={metaValue}>{String(item.vat_number || '-')}</span>
        </div>

        <div style={metaRow}>
          <span style={{ ...metaLabel, color: colors.labelGray }}>Τράπεζα:</span>
          <span style={metaValue}>{String(item.bank_name || '-')}</span>
        </div>

        <div style={metaRow}>
          <span style={{ ...metaLabel, color: colors.labelBlue }}>IBAN:</span>
          <span style={metaValue}>{String(item.iban || '-')}</span>
        </div>

        <span style={{ fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
          sub_category: {String(sub === 'Maintenance' ? 'Συντήρηση' : sub || '')}
        </span>
      </div>
    )
  }

  return (
    <div style={pageWrap}>
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>📋</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>Manage Lists</h1>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
                Διαχείριση Προμηθευτών &amp; Παγίων
              </p>
            </div>
          </div>

          <Link href={backHref} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        {/* TABS */}
        <div style={tabsRow}>
          {TABS.map(t => {
            const ActiveIcon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key)
                  setSearch('')
                  resetForm()
                }}
                style={{
                  ...tabBtn,
                  backgroundColor: active ? colors.primaryDark : colors.white,
                  border: `1px solid ${active ? colors.primaryDark : colors.border}`,
                  color: active ? 'white' : colors.primaryDark,
                }}
              >
                <ActiveIcon size={16} />
                <span style={{ fontSize: 16, fontWeight: 900 }}>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* FORM CARD */}
        <div style={cardPremium}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <label style={labelStyle}>{formTitle}</label>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={ghostBtn}
                disabled={saving || loading}
                title="Cancel edit"
                aria-label="Cancel edit"
              >
                <XCircle size={16} />
                <span style={{ fontSize: 16, fontWeight: 900 }}>Cancel</span>
              </button>
            )}
          </div>

          {/* Dynamic form fields */}
          {renderFormFields()}

          {/* SEARCH */}
          <label style={{ ...labelStyle, marginTop: 18 }}>ΑΝΑΖΗΤΗΣΗ</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: colors.secondaryText }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={
                activeTab === 'suppliers'
                  ? 'Όνομα / ΑΦΜ / Τηλέφωνο...'
                  : activeTab === 'utility'
                    ? 'Αναζήτηση (RF)...'
                    : 'Γράψτε για αναζήτηση...'
              }
              style={{ ...inputStyle, paddingLeft: 38 }}
            />
          </div>
        </div>

        {/* LIST CARD */}
        <div style={{ ...cardPremium, marginTop: 14 }}>
          <label style={labelStyle}>ΛΙΣΤΑ</label>

          {loading ? (
            <div style={hintBox}>Φόρτωση...</div>
          ) : visibleItems.length === 0 ? (
            <div style={hintBox}>Δεν υπάρχουν εγγραφές.</div>
          ) : (
            <div style={listWrap}>
              {visibleItems.map((item: any) => {
                const isEditingThis = editingId && String(editingId) === String(item.id)

                return (
                  <div
                    key={item.id}
                    style={{
                      ...listRowPremium,
                      borderColor: isEditingThis ? colors.accentBlue : colors.border,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>
                          {String(item.name || '').toUpperCase()}
                        </span>

                        {isEditingThis && (
                          <span style={editingBadge}>
                            <Pencil size={14} />
                            <span style={{ fontSize: 16, fontWeight: 900 }}>Editing</span>
                          </span>
                        )}
                      </div>

                      {renderListMeta(item)}
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        disabled={saving}
                        style={{ ...editBtn, opacity: saving ? 0.6 : 1 }}
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={saving}
                        style={{ ...dangerBtn, opacity: saving ? 0.6 : 1 }}
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 16, fontWeight: 800, color: colors.secondaryText }}>
          * Για ασφάλεια, η διαγραφή ζητά επιβεβαίωση.
        </div>
      </div>
    </div>
  )
}

// ✅ 16px everywhere for mobile stability
const pageWrap: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: 20,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
  fontSize: 16,
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: colors.primaryDark,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 16,
  fontWeight: 900,
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  padding: '10px 12px',
  backgroundColor: 'white',
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}

const tabsRow: any = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }

const tabBtn: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 12px',
  borderRadius: 14,
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 900,
  userSelect: 'none',
}

const cardPremium: any = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
}

const labelStyle: any = {
  fontSize: 16,
  fontWeight: 900,
  color: colors.secondaryText,
  display: 'block',
  marginBottom: 8,
}

const miniLabel: any = {
  fontSize: 16,
  fontWeight: 900,
  display: 'block',
  marginBottom: 6,
}

const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14, // ✅ as requested
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
  outline: 'none',
}

const selectStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14, // ✅ as requested
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
}

const iconBtn: any = {
  width: 52,
  minWidth: 52,
  height: 52,
  borderRadius: 14,
  border: 'none',
  backgroundColor: colors.primaryDark,
  color: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.14)',
}

const primaryBtnWide: any = {
  borderRadius: 14,
  border: 'none',
  backgroundColor: colors.primaryDark,
  color: 'white',
  padding: '14px 16px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 16,
  fontWeight: 900,
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.14)',
}

const ghostBtn: any = {
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  color: colors.primaryDark,
  padding: '10px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 16,
  fontWeight: 900,
}

const hintBox: any = {
  padding: 14,
  borderRadius: 14,
  backgroundColor: colors.bgLight,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  color: colors.secondaryText,
}

const hintPill: any = {
  padding: 12,
  borderRadius: 16,
  backgroundColor: colors.bgLight,
  border: `1px solid ${colors.border}`,
}

const grid2: any = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

const grid3: any = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 10,
}

const listWrap: any = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  marginTop: 10,
}

const listRowPremium: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  padding: 14,
  borderRadius: 18,
  backgroundColor: colors.white,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.06)',
}

const editingBadge: any = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: colors.accentBlue,
}

const metaRow: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const metaLabel: any = {
  fontSize: 16,
  fontWeight: 900,
}

const metaValue: any = {
  fontSize: 16,
  fontWeight: 800,
  color: colors.primaryDark,
  wordBreak: 'break-word',
}

const editBtn: any = {
  width: 46,
  minWidth: 46,
  height: 46,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.accentBlue,
}

const dangerBtn: any = {
  width: 46,
  minWidth: 46,
  height: 46,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.accentRed,
}

const segWrap: any = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

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
      <ManageListsInner />
    </Suspense>
  )
}