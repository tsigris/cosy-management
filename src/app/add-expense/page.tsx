'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  modalBackdrop: 'rgba(2,6,23,0.6)',
}

const BANK_OPTIONS = [
  'Εθνική Τράπεζα',
  'Eurobank',
  'Alpha Bank',
  'Viva Wallet',
  'Τράπεζα Πειραιώς',
] as const

type SmartKind = 'supplier' | 'asset'
type AssetGroup = 'staff' | 'maintenance' | 'utility' | 'other'

type SmartItem = {
  kind: SmartKind
  id: string
  name: string
  sub_category?: string | null
  group?: AssetGroup
  rf_code?: string | null
  bank_name?: string | null
  iban?: string | null
  phone?: string | null
  vat_number?: string | null
  // staff
  pay_basis?: 'monthly' | 'daily' | null
  monthly_salary?: number | null
  daily_rate?: number | null
  monthly_days?: number | null
  start_date?: string | null
}

type SelectedEntity = { kind: SmartKind; id: string } | null

type CreateTab = 'suppliers' | 'utility' | 'staff' | 'maintenance' | 'other'

function stripDiacritics(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeGreek(str: any) {
  return stripDiacritics(String(str || ''))
    .toLowerCase()
    .trim()
    .replace(/ς/g, 'σ')
}

function greekToGreeklish(input: string) {
  let s = normalizeGreek(input)

  const digraphs: Array<[RegExp, string]> = [
    [/ου/g, 'ou'],
    [/αι/g, 'ai'],
    [/ει/g, 'ei'],
    [/οι/g, 'oi'],
    [/υι/g, 'yi'],
    [/αυ/g, 'av'],
    [/ευ/g, 'ev'],
    [/γγ/g, 'ng'],
    [/γκ/g, 'gk'],
    [/ντ/g, 'nt'],
    [/μπ/g, 'mp'],
    [/τσ/g, 'ts'],
    [/τζ/g, 'tz'],
  ]
  digraphs.forEach(([r, v]) => (s = s.replace(r, v)))

  const map: Record<string, string> = {
    α: 'a',
    β: 'v',
    γ: 'g',
    δ: 'd',
    ε: 'e',
    ζ: 'z',
    η: 'h',
    θ: 'th',
    ι: 'i',
    κ: 'k',
    λ: 'l',
    μ: 'm',
    ν: 'n',
    ξ: 'x',
    ο: 'o',
    π: 'p',
    ρ: 'r',
    σ: 's',
    τ: 't',
    υ: 'y',
    φ: 'f',
    χ: 'x',
    ψ: 'ps',
    ω: 'o',
  }

  let out = ''
  for (const ch of s) out += map[ch] ?? ch
  return out
}

function fuzzyIHI(str: string) {
  return normalizeGreek(str)
    .replace(/h/g, 'i')
    .replace(/y/g, 'i')
    .replace(/u/g, 'i')
    .replace(/ei/g, 'i')
    .replace(/oi/g, 'i')
    .replace(/yi/g, 'i')
}

function smartMatch(name: string, query: string) {
  const q = normalizeGreek(query)
  if (!q) return false

  const n = normalizeGreek(name)
  if (n.includes(q)) return true

  const nLatin = greekToGreeklish(name)
  if (nLatin.includes(q)) return true

  const qF = fuzzyIHI(q)
  const nF = fuzzyIHI(nLatin)
  if (nF.includes(qF)) return true

  return false
}

function groupTitle(group: AssetGroup | 'suppliers') {
  if (group === 'suppliers') return 'Προμηθευτές'
  if (group === 'staff') return 'Προσωπικό'
  if (group === 'maintenance') return 'Συντήρηση'
  if (group === 'utility') return 'Λογαριασμοί'
  return 'Λοιπά'
}

function groupFromSubCategory(sub: any): AssetGroup {
  const raw = String(sub || '').trim()
  const s = raw.toLowerCase()
  if (s === 'staff') return 'staff'
  if (s === 'utility' || s === 'utilities') return 'utility'
  if (s === 'maintenance' || s === 'worker') return 'maintenance'
  if (s === 'other') return 'other'
  if (raw === 'Maintenance') return 'maintenance'
  return 'other'
}

function categoryFromSelection(sel: SelectedEntity, itemMap: Map<string, SmartItem>) {
  if (!sel) return 'Other'
  if (sel.kind === 'supplier') return 'Εμπορεύματα'

  const key = `asset:${sel.id}`
  const item = itemMap.get(key)
  const g = item?.group || 'other'

  if (g === 'staff') return 'Staff'
  if (g === 'utility') return 'Utilities'
  if (g === 'maintenance') return 'Maintenance'
  return 'Other'
}

function createTabLabel(t: CreateTab) {
  if (t === 'suppliers') return 'Προμηθευτές'
  if (t === 'utility') return 'Λογαριασμοί'
  if (t === 'staff') return 'Προσωπικό'
  if (t === 'maintenance') return 'Συντήρηση'
  return 'Λοιπά'
}

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const urlStoreId = searchParams.get('store')

  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false)
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  const [noInvoice, setNoInvoice] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [loading, setLoading] = useState(true)

  const [storeId, setStoreId] = useState<string | null>(urlStoreId)

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fixedAssets, setFixedAssets] = useState<any[]>([])

  const [dayStats, setDayStats] = useState({ income: 0, expenses: 0 })

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null)

  const [smartQuery, setSmartQuery] = useState('')
  const [smartOpen, setSmartOpen] = useState(false)
  const smartBoxRef = useRef<HTMLDivElement | null>(null)

  // ✅ Smart "Create new" modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createTab, setCreateTab] = useState<CreateTab>('suppliers')

  // shared
  const [cName, setCName] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cVat, setCVat] = useState('')
  const [cBank, setCBank] = useState<string>('')
  const [cIban, setCIban] = useState('')

  // utility
  const [cRf, setCRf] = useState('')

  // staff
  const [cPayBasis, setCPayBasis] = useState<'monthly' | 'daily'>('monthly')
  const [cMonthlySalary, setCMonthlySalary] = useState('')
  const [cDailyRate, setCDailyRate] = useState('')
  const [cMonthlyDays, setCMonthlyDays] = useState('')
  const [cStartDate, setCStartDate] = useState('')

  const resetCreateForm = useCallback(() => {
    setCName(smartQuery.trim() || '')
    setCPhone('')
    setCVat('')
    setCBank('')
    setCIban('')
    setCRf('')
    setCPayBasis('monthly')
    setCMonthlySalary('')
    setCDailyRate('')
    setCMonthlyDays('')
    setCStartDate('')
  }, [smartQuery])

  // close dropdown on outside
  useEffect(() => {
    const handler = (e: any) => {
      const el = smartBoxRef.current
      if (!el) return
      if (!el.contains(e.target)) setSmartOpen(false)
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [])

  const loadFormData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const activeStoreId =
        urlStoreId || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

      if (!activeStoreId) {
        setLoading(false)
        return
      }

      setStoreId(activeStoreId)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) setCurrentUsername(profile.username || 'Admin')

      const [sRes, fRes, tRes] = await Promise.all([
        supabase.from('suppliers').select('id, name, phone, vat_number, bank_name, iban').eq('store_id', activeStoreId).order('name'),
        supabase
          .from('fixed_assets')
          .select(
            'id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis',
          )
          .eq('store_id', activeStoreId)
          .order('name'),
        supabase.from('transactions').select('amount, type').eq('store_id', activeStoreId).eq('date', selectedDate),
      ])

      const supData = sRes.data || []
      const faAll = fRes.data || []

      const faData = faAll.filter((x: any) => {
        const g = groupFromSubCategory(x.sub_category)
        return g === 'staff' || g === 'maintenance' || g === 'utility' || g === 'other'
      })

      setSuppliers(supData)
      setFixedAssets(faData)

      if (tRes.data) {
        const inc = tRes.data
          .filter((t: any) => t.type === 'income')
          .reduce((acc: number, t: any) => acc + Number(t.amount), 0)

        const exp = tRes.data
          .filter((t: any) => t.type === 'expense' || t.type === 'debt_payment')
          .reduce((acc: number, t: any) => acc + Math.abs(Number(t.amount)), 0)

        setDayStats({ income: inc, expenses: exp })
      }

      if (editId) {
        const { data: tx } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', editId)
          .eq('store_id', activeStoreId)
          .single()

        if (tx) {
          setAmount(Math.abs(tx.amount).toString())
          setMethod(tx.method === 'Τράπεζα' ? 'Τράπεζα' : 'Μετρητά')
          setNotes(tx.notes || '')
          setIsCredit(!!tx.is_credit)
          setIsAgainstDebt(tx.type === 'debt_payment')
          setNoInvoice((tx.notes || '').includes('ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ'))

          if (tx.supplier_id) {
            const id = String(tx.supplier_id)
            setSelectedEntity({ kind: 'supplier', id })
            const found = supData.find((x: any) => String(x.id) === id)
            setSmartQuery(found?.name || '')
          } else if (tx.fixed_asset_id) {
            const id = String(tx.fixed_asset_id)
            setSelectedEntity({ kind: 'asset', id })
            const found = faData.find((x: any) => String(x.id) === id)
            setSmartQuery(found?.name || '')
          } else {
            setSelectedEntity(null)
            setSmartQuery('')
          }
        }
      } else {
        if (urlSupId) {
          const id = String(urlSupId)
          setSelectedEntity({ kind: 'supplier', id })
          const found = supData.find((x: any) => String(x.id) === id)
          setSmartQuery(found?.name || '')
        } else if (urlAssetId) {
          const id = String(urlAssetId)
          setSelectedEntity({ kind: 'asset', id })
          const found = faData.find((x: any) => String(x.id) === id)
          setSmartQuery(found?.name || '')
        } else {
          setSelectedEntity(null)
          setSmartQuery('')
        }
      }
    } catch (error) {
      console.error(error)
      toast.error('Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [editId, router, selectedDate, urlStoreId, urlSupId, urlAssetId])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const currentBalance = useMemo(() => dayStats.income - dayStats.expenses, [dayStats])

  const smartItems = useMemo<SmartItem[]>(() => {
    const sList: SmartItem[] =
      suppliers?.map((s: any) => ({
        kind: 'supplier',
        id: String(s.id),
        name: String(s.name || ''),
        phone: s.phone ?? null,
        vat_number: s.vat_number ?? null,
        bank_name: s.bank_name ?? null,
        iban: s.iban ?? null,
      })) || []

    const aList: SmartItem[] =
      fixedAssets?.map((a: any) => ({
        kind: 'asset',
        id: String(a.id),
        name: String(a.name || ''),
        sub_category: a.sub_category,
        group: groupFromSubCategory(a.sub_category),
        phone: a.phone ?? null,
        vat_number: a.vat_number ?? null,
        bank_name: a.bank_name ?? null,
        iban: a.iban ?? null,
        rf_code: a.rf_code ?? null,
        pay_basis: a.pay_basis ?? null,
        monthly_salary: a.monthly_salary ?? null,
        daily_rate: a.daily_rate ?? null,
        monthly_days: a.monthly_days ?? null,
        start_date: a.start_date ?? null,
      })) || []

    return [...sList, ...aList]
  }, [suppliers, fixedAssets])

  const smartItemMap = useMemo(() => {
    const m = new Map<string, SmartItem>()
    for (const it of smartItems) {
      const k = `${it.kind}:${it.id}`
      m.set(k, it)
    }
    return m
  }, [smartItems])

  const filtered = useMemo(() => {
    const q = smartQuery.trim()
    if (!q) return []
    return smartItems.filter(i => smartMatch(i.name, q)).slice(0, 80)
  }, [smartQuery, smartItems])

  const groupedResults = useMemo(() => {
    const groups: Record<string, SmartItem[]> = {}
    for (const it of filtered) {
      const key = it.kind === 'supplier' ? 'suppliers' : (it.group || 'other')
      const title = groupTitle(key as any)
      if (!groups[title]) groups[title] = []
      groups[title].push(it)
    }
    for (const g of Object.keys(groups)) {
      groups[g] = groups[g].sort((a, b) => String(a.name).localeCompare(String(b.name)))
    }
    return groups
  }, [filtered])

  // fix sort typo safely
  useEffect(() => {
    // no-op: kept to avoid TS unused warnings in some configs
  }, [])

  const groupedResultsSafe = useMemo(() => {
    const groups: Record<string, SmartItem[]> = {}
    for (const it of filtered) {
      const key = it.kind === 'supplier' ? 'suppliers' : (it.group || 'other')
      const title = groupTitle(key as any)
      if (!groups[title]) groups[title] = []
      groups[title].push(it)
    }
    for (const g of Object.keys(groups)) {
      groups[g] = groups[g].sort((a, b) => String(a.name).localeCompare(String(b.name)))
    }
    return groups
  }, [filtered])

  const pickSmartItem = (item: SmartItem) => {
    setSelectedEntity({ kind: item.kind, id: item.id })
    setSmartQuery(item.name)
    setSmartOpen(false)
  }

  const clearSelection = () => {
    setSelectedEntity(null)
    setSmartQuery('')
    setSmartOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const openCreateModal = () => {
    // default suggestion based on query hints
    const q = normalizeGreek(smartQuery)
    const suggest: CreateTab =
      q.includes('δεη') || q.includes('deh') || q.includes('dei') || q.includes('ενοικ') || q.includes('rf')
        ? 'utility'
        : 'suppliers'

    setCreateTab(suggest)
    resetCreateForm()
    setCreateOpen(true)
    setSmartOpen(false)
  }

  const doCreate = async () => {
    const activeStoreId =
      urlStoreId ||
      (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
      storeId

    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    const nm = cName.trim()
    if (!nm) return toast.error('Γράψε όνομα')

    // field checks
    if (createTab === 'utility') {
      const rf = cRf.trim()
      if (!rf) return toast.error('Γράψε κωδικό RF')
      if (!cBank) return toast.error('Επίλεξε τράπεζα')
    }

    if (createTab === 'staff') {
      const days = cMonthlyDays.trim()
      if (!days) return toast.error('Γράψε μέρες μήνα')
      if (cPayBasis === 'monthly' && !cMonthlySalary.trim()) return toast.error('Γράψε μισθό')
      if (cPayBasis === 'daily' && !cDailyRate.trim()) return toast.error('Γράψε ημερομίσθιο')
    }

    try {
      setCreateSaving(true)

      // ---------------- create SUPPLIER ----------------
      if (createTab === 'suppliers') {
        const payload: any = {
          name: nm,
          phone: cPhone.trim() || null,
          vat_number: cVat.trim() || null,
          bank_name: cBank || null,
          iban: cIban.trim() || null,
          store_id: activeStoreId,
        }

        const { data, error } = await supabase.from('suppliers').insert([payload]).select('id, name, phone, vat_number, bank_name, iban').single()
        if (error) throw error

        setSuppliers(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
        setSelectedEntity({ kind: 'supplier', id: String(data.id) })
        setSmartQuery(String(data.name || nm))
        toast.success('Προστέθηκε στους Προμηθευτές')
        setCreateOpen(false)
        return
      }

      // ---------------- create FIXED_ASSET ----------------
      const sub_category =
        createTab === 'maintenance' ? 'Maintenance' : createTab === 'utility' ? 'utility' : createTab === 'staff' ? 'staff' : 'other'

      let payload: any = { store_id: activeStoreId, sub_category, name: nm }

      if (createTab === 'utility') {
        payload = {
          ...payload,
          rf_code: cRf.trim(),
          bank_name: cBank,
          phone: null,
          vat_number: null,
          iban: null,
          pay_basis: null,
          monthly_days: null,
          monthly_salary: null,
          daily_rate: null,
          start_date: null,
        }
      } else if (createTab === 'staff') {
        payload = {
          ...payload,
          bank_name: cBank || null,
          iban: cIban.trim() || null,
          pay_basis: cPayBasis,
          monthly_days: cMonthlyDays.trim() ? Number(cMonthlyDays.trim()) : null,
          monthly_salary: cPayBasis === 'monthly' && cMonthlySalary.trim() ? Number(cMonthlySalary.trim()) : null,
          daily_rate: cPayBasis === 'daily' && cDailyRate.trim() ? Number(cDailyRate.trim()) : null,
          start_date: cStartDate.trim() || null,
          rf_code: null,
          phone: null,
          vat_number: null,
        }
      } else {
        // maintenance / other
        payload = {
          ...payload,
          phone: cPhone.trim() || null,
          vat_number: cVat.trim() || null,
          bank_name: cBank || null,
          iban: cIban.trim() || null,

          rf_code: null,
          pay_basis: null,
          monthly_days: null,
          monthly_salary: null,
          daily_rate: null,
          start_date: null,
        }
      }

      const { data, error } = await supabase
        .from('fixed_assets')
        .insert([payload])
        .select('id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis')
        .single()

      if (error) throw error

      setFixedAssets(prev => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
      setSelectedEntity({ kind: 'asset', id: String(data.id) })
      setSmartQuery(String(data.name || nm))
      toast.success(`Προστέθηκε σε: ${createTabLabel(createTab)}`)
      setCreateOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Αποτυχία καταχώρησης')
    } finally {
      setCreateSaving(false)
    }
  }

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Συμπλήρωσε το ποσό')
    if (!selectedEntity) return toast.error('Επίλεξε δικαιούχο από την αναζήτηση')

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return router.push('/login')
      }

      const activeStoreId =
        urlStoreId ||
        (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null) ||
        storeId

      if (!activeStoreId) {
        setLoading(false)
        return toast.error('Δεν βρέθηκε κατάστημα (store)')
      }

      const category = categoryFromSelection(selectedEntity, smartItemMap)

      const payload: any = {
        amount: -Math.abs(Number(amount)),
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        type: isAgainstDebt ? 'debt_payment' : 'expense',
        date: selectedDate,
        user_id: session.user.id,
        store_id: activeStoreId,

        supplier_id: selectedEntity.kind === 'supplier' ? selectedEntity.id : null,
        fixed_asset_id: selectedEntity.kind === 'asset' ? selectedEntity.id : null,

        category,
        created_by_name: currentUsername,
        notes: noInvoice ? (notes ? `${notes} (ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ)` : 'ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ') : notes,
      }

      if (imageFile && !noInvoice && !editId) {
        const fileExt = imageFile.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${activeStoreId}/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage.from('invoices').upload(filePath, imageFile)
        if (uploadError) throw uploadError

        payload.invoice_image = uploadData?.path || null
      }

      let error: any = null
      if (editId) {
        const res = await supabase.from('transactions').update(payload).eq('id', editId)
        error = res.error
      } else {
        const res = await supabase.from('transactions').insert([payload])
        error = res.error
      }

      if (error) throw error

      toast.success(editId ? 'Η κίνηση ενημερώθηκε!' : 'Η κίνηση καταχωρήθηκε!')
      router.push(`/?date=${selectedDate}&store=${activeStoreId}`)
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'Κάτι πήγε στραβά')
      setLoading(false)
    }
  }

  const selectedLabel = useMemo(() => {
    if (!selectedEntity) return ''
    const it = smartItemMap.get(`${selectedEntity.kind}:${selectedEntity.id}`)
    return it?.name || smartQuery || ''
  }, [selectedEntity, smartItemMap, smartQuery])

  const selectedMeta = useMemo(() => {
    if (!selectedEntity) return ''
    const it = smartItemMap.get(`${selectedEntity.kind}:${selectedEntity.id}`)
    if (!it) return ''
    if (it.kind === 'supplier') return 'Προμηθευτής'
    const g = it.group || 'other'
    if (g === 'maintenance') return 'Συντήρηση'
    if (g === 'staff') return 'Προσωπικό'
    if (g === 'utility') return 'Λογαριασμός'
    return 'Λοιπά'
  }, [selectedEntity, smartItemMap])

  const showCreateInline = useMemo(() => {
    const q = smartQuery.trim()
    if (!smartOpen) return false
    if (!q) return false
    if (filtered.length > 0) return false
    return true
  }, [smartOpen, smartQuery, filtered.length])

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>💸</div>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{editId ? 'Διόρθωση' : 'Έξοδο'}</h1>
              <p style={{ margin: 0, fontSize: 16, color: colors.secondaryText, fontWeight: 700 }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          <Link href={`/?store=${urlStoreId || storeId || ''}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={formCard}>
          <label style={labelStyle}>Δικαιούχος</label>

          <div ref={smartBoxRef} style={{ position: 'relative' }}>
            <input
              value={smartQuery}
              onChange={e => {
                setSmartQuery(e.target.value)
                setSelectedEntity(null)
                setSmartOpen(true)
              }}
              onFocus={() => setSmartOpen(true)}
              placeholder="Αναζήτηση"
              style={inputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {!!smartQuery && (
              <button type="button" onClick={clearSelection} style={clearBtn} aria-label="Καθαρισμός">
                ✕
              </button>
            )}

            {smartOpen && smartQuery.trim() && (
              <div style={resultsPanel}>
                {showCreateInline && (
                  <button
                    type="button"
                    onPointerDown={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      openCreateModal()
                    }}
                    style={createRow}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: colors.primaryDark }}>
                          Δεν βρέθηκε: <span style={{ color: colors.accentBlue }}>{smartQuery.trim()}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
                          Πάτα για καταχώρηση στη λίστα (επιλογή κατηγορίας)
                        </div>
                      </div>
                      <div style={plusPill}>＋</div>
                    </div>
                  </button>
                )}

                {Object.keys(groupedResultsSafe).length === 0 ? (
                  !showCreateInline ? (
                    <div style={{ padding: 14, fontSize: 14, fontWeight: 700, color: colors.secondaryText }}>
                      Δεν βρέθηκε αποτέλεσμα
                    </div>
                  ) : null
                ) : (
                  Object.entries(groupedResultsSafe).map(([group, items]) => (
                    <div key={group}>
                      <div style={groupHeader}>{group}</div>

                      {items.map(item => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onPointerDown={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            pickSmartItem(item)
                          }}
                          onTouchStart={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            pickSmartItem(item)
                          }}
                          style={resultRow}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 15, fontWeight: 900, color: colors.primaryDark }}>{item.name}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
                              {item.kind === 'supplier'
                                ? 'Προμηθευτής'
                                : item.group === 'maintenance'
                                  ? 'Συντήρηση'
                                  : item.group === 'staff'
                                    ? 'Προσωπικό'
                                    : item.group === 'utility'
                                      ? 'Λογαριασμός'
                                      : 'Λοιπά'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {!!selectedEntity && (
            <div style={selectedBox}>
              Επιλογή: <span style={{ fontWeight: 900 }}>{selectedLabel}</span>
              {!!selectedMeta && (
                <span style={{ marginLeft: 8, color: colors.secondaryText, fontWeight: 800 }}>({selectedMeta})</span>
              )}
            </div>
          )}

          <label style={{ ...labelStyle, marginTop: 20 }}>Ποσό (€)</label>
          <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />

          <div
            onClick={() => setNoInvoice(!noInvoice)}
            style={{
              ...noInvoiceToggle,
              backgroundColor: noInvoice ? '#fee2e2' : colors.bgLight,
              border: `1px solid ${noInvoice ? colors.accentRed : colors.border}`,
              marginTop: 15,
            }}
          >
            <div
              style={{
                ...checkboxBox,
                backgroundColor: noInvoice ? colors.accentRed : 'white',
                border: `2px solid ${noInvoice ? colors.accentRed : colors.secondaryText}`,
              }}
            >
              {noInvoice && '✓'}
            </div>
            <span style={{ fontSize: 14, fontWeight: 900, color: noInvoice ? colors.accentRed : colors.primaryDark }}>
              Χωρίς τιμολόγιο
            </span>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>Μέθοδος πληρωμής</label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                setMethod('Μετρητά')
                setIsCredit(false)
              }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Μετρητά' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Μετρητά' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              💵 Μετρητά
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('Τράπεζα')
                setIsCredit(false)
              }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Τράπεζα' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Τράπεζα' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              🏛️ Τράπεζα
            </button>
          </div>

          <div style={creditPanel}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={isCredit}
                onChange={e => {
                  setIsCredit(e.target.checked)
                  if (e.target.checked) setIsAgainstDebt(false)
                }}
                id="credit"
                style={checkboxStyle}
              />
              <label htmlFor="credit" style={checkLabel}>
                Επί πιστώσει (νέο χρέος)
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={isAgainstDebt}
                onChange={e => {
                  setIsAgainstDebt(e.target.checked)
                  if (e.target.checked) setIsCredit(false)
                }}
                id="against"
                style={checkboxStyle}
              />
              <label htmlFor="against" style={{ ...checkLabel, color: isAgainstDebt ? colors.accentBlue : colors.primaryDark }}>
                Έναντι παλαιού χρέους
              </label>
            </div>
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>Σημειώσεις</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, height: 80 }} />

          {!editId && !noInvoice && (
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>📸 Φωτογραφία τιμολογίου</label>
              <div style={imageUploadContainer}>
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: 140 }}>
                    <img src={imagePreview} alt="Preview" style={imagePreviewStyle} />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null)
                        setImagePreview(null)
                      }}
                      style={removeImageBtn}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label style={uploadPlaceholder}>
                    <span style={{ fontSize: 14, fontWeight: 900 }}>📷 Επιλογή φωτογραφίας</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 25 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                ...smartSaveBtn,
                backgroundColor: editId ? colors.accentBlue : colors.accentRed,
                opacity: loading ? 0.75 : 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 900 }}>{loading ? 'Αποθήκευση...' : editId ? 'Ενημέρωση' : 'Καταχώρηση'}</span>
                <span style={{ fontSize: 14, opacity: 0.85, fontWeight: 800, marginTop: 6 }}>Καθαρό ταμείο: {currentBalance.toFixed(2)}€</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ✅ CREATE MODAL */}
      {createOpen && (
        <div style={modalOverlay} onMouseDown={() => !createSaving && setCreateOpen(false)}>
          <div style={modalCard} onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>Νέα καταχώρηση</h2>
              <button
                type="button"
                onClick={() => !createSaving && setCreateOpen(false)}
                style={modalCloseBtn}
                aria-label="Κλείσιμο"
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '8px 0 14px', fontSize: 13, fontWeight: 700, color: colors.secondaryText }}>
              Δεν βρέθηκε <strong>{smartQuery.trim()}</strong>. Διάλεξε κατηγορία και συμπλήρωσε τα πεδία.
            </p>

            {/* category picker */}
            <label style={modalLabel}>Κατηγορία</label>
            <select
              value={createTab}
              onChange={e => {
                setCreateTab(e.target.value as CreateTab)
                resetCreateForm()
              }}
              style={modalSelect}
              disabled={createSaving}
            >
              <option value="suppliers">Προμηθευτές</option>
              <option value="utility">Λογαριασμοί</option>
              <option value="staff">Προσωπικό</option>
              <option value="maintenance">Συντήρηση</option>
              <option value="other">Λοιπά</option>
            </select>

            {/* forms */}
            <div style={{ marginTop: 12 }}>
              <label style={modalLabel}>{createTab === 'staff' ? 'Ονοματεπώνυμο' : 'Όνομα'}</label>
              <input value={cName} onChange={e => setCName(e.target.value)} style={modalInput} placeholder="π.χ. Τζήλιος" disabled={createSaving} />
            </div>

            {(createTab === 'suppliers' || createTab === 'maintenance' || createTab === 'other') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={modalLabel}>Τηλέφωνο</label>
                    <input value={cPhone} onChange={e => setCPhone(e.target.value)} style={modalInput} disabled={createSaving} />
                  </div>
                  <div>
                    <label style={modalLabel}>ΑΦΜ</label>
                    <input value={cVat} onChange={e => setCVat(e.target.value)} style={modalInput} disabled={createSaving} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τράπεζα</label>
                  <select value={cBank} onChange={e => setCBank(e.target.value)} style={modalSelect} disabled={createSaving}>
                    <option value="">Επιλέξτε...</option>
                    {BANK_OPTIONS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>IBAN</label>
                  <input value={cIban} onChange={e => setCIban(e.target.value)} style={modalInput} placeholder="GR..." disabled={createSaving} />
                </div>
              </>
            )}

            {createTab === 'utility' && (
              <>
                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Κωδικός RF</label>
                  <input value={cRf} onChange={e => setCRf(e.target.value)} style={modalInput} placeholder="RF..." disabled={createSaving} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τράπεζα</label>
                  <select value={cBank} onChange={e => setCBank(e.target.value)} style={modalSelect} disabled={createSaving}>
                    <option value="">Επιλέξτε...</option>
                    {BANK_OPTIONS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {createTab === 'staff' && (
              <>
                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τύπος συμφωνίας</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setCPayBasis('monthly')}
                      style={{
                        ...segBtn,
                        backgroundColor: cPayBasis === 'monthly' ? colors.primaryDark : colors.white,
                        color: cPayBasis === 'monthly' ? 'white' : colors.primaryDark,
                        borderColor: cPayBasis === 'monthly' ? colors.primaryDark : colors.border,
                      }}
                      disabled={createSaving}
                    >
                      Μηνιαίος
                    </button>
                    <button
                      type="button"
                      onClick={() => setCPayBasis('daily')}
                      style={{
                        ...segBtn,
                        backgroundColor: cPayBasis === 'daily' ? colors.primaryDark : colors.white,
                        color: cPayBasis === 'daily' ? 'white' : colors.primaryDark,
                        borderColor: cPayBasis === 'daily' ? colors.primaryDark : colors.border,
                      }}
                      disabled={createSaving}
                    >
                      Ημερομίσθιο
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={modalLabel}>{cPayBasis === 'monthly' ? 'Μισθός' : 'Ημερομίσθιο'}</label>
                    <input
                      value={cPayBasis === 'monthly' ? cMonthlySalary : cDailyRate}
                      onChange={e => (cPayBasis === 'monthly' ? setCMonthlySalary(e.target.value) : setCDailyRate(e.target.value))}
                      style={modalInput}
                      inputMode="decimal"
                      disabled={createSaving}
                    />
                  </div>
                  <div>
                    <label style={modalLabel}>Μέρες μήνα</label>
                    <input value={cMonthlyDays} onChange={e => setCMonthlyDays(e.target.value)} style={modalInput} inputMode="numeric" disabled={createSaving} />
                  </div>
                  <div>
                    <label style={modalLabel}>Ημ. πρόσληψης</label>
                    <input value={cStartDate} onChange={e => setCStartDate(e.target.value)} style={modalInput} type="date" disabled={createSaving} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τράπεζα</label>
                  <select value={cBank} onChange={e => setCBank(e.target.value)} style={modalSelect} disabled={createSaving}>
                    <option value="">Επιλέξτε...</option>
                    {BANK_OPTIONS.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>IBAN</label>
                  <input value={cIban} onChange={e => setCIban(e.target.value)} style={modalInput} placeholder="GR..." disabled={createSaving} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setCreateOpen(false)} style={modalSecondaryBtn} disabled={createSaving}>
                Ακύρωση
              </button>
              <button type="button" onClick={doCreate} style={modalPrimaryBtn} disabled={createSaving}>
                {createSaving ? 'Αποθήκευση...' : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// STYLES
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: 20,
  overflowY: 'auto',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  fontSize: 16,
  touchAction: 'pan-y',
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }
const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: colors.primaryDark,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 18,
  fontWeight: 900,
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  padding: '10px 12px',
  backgroundColor: 'white',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}

const formCard: any = { backgroundColor: 'white', padding: 20, borderRadius: 24, border: `1px solid ${colors.border}` }
const labelStyle: any = { fontSize: 12, fontWeight: 900, color: colors.secondaryText, display: 'block', marginBottom: 8 }

const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 700,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
}

const methodBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 16,
}

const noInvoiceToggle: any = { display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, cursor: 'pointer' }
const checkboxBox: any = {
  width: 20,
  height: 20,
  borderRadius: 6,
  border: '2px solid #cbd5e1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 14,
  fontWeight: 900,
}

const creditPanel: any = { backgroundColor: colors.bgLight, padding: 16, borderRadius: 14, border: `1px solid ${colors.border}`, marginTop: 20 }
const checkboxStyle: any = { width: 20, height: 20 }
const checkLabel: any = { fontSize: 14, fontWeight: 900, color: colors.primaryDark }

const smartSaveBtn: any = {
  width: '100%',
  padding: 16,
  color: 'white',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  fontSize: 16,
}

const imageUploadContainer: any = { width: '100%', backgroundColor: colors.bgLight, borderRadius: 14, border: `2px dashed ${colors.border}`, overflow: 'hidden' }
const uploadPlaceholder: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }
const imagePreviewStyle: any = { width: '100%', height: 140, objectFit: 'cover' as const }
const removeImageBtn: any = {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: 'rgba(0,0,0,0.5)',
  color: 'white',
  border: 'none',
  borderRadius: 999,
  width: 30,
  height: 30,
  fontSize: 16,
  fontWeight: 900,
}

const clearBtn: any = {
  position: 'absolute',
  top: 10,
  right: 10,
  width: 34,
  height: 34,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  fontSize: 16,
  fontWeight: 900,
  cursor: 'pointer',
  color: colors.secondaryText,
}

const resultsPanel: any = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 'calc(100% + 8px)',
  zIndex: 999,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  background: colors.white,
  maxHeight: 360,
  overflowY: 'auto',
  boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
}

const groupHeader: any = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: colors.bgLight,
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 900,
  color: colors.secondaryText,
  borderBottom: `1px solid ${colors.border}`,
}

const resultRow: any = {
  width: '100%',
  border: 'none',
  background: colors.white,
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: `1px solid ${colors.border}`,
}

const createRow: any = {
  width: '100%',
  border: 'none',
  background: '#eef2ff',
  padding: 12,
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: `1px solid ${colors.border}`,
}

const plusPill: any = {
  width: 34,
  height: 34,
  borderRadius: 999,
  backgroundColor: colors.accentBlue,
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: 18,
  flexShrink: 0,
}

const selectedBox: any = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  backgroundColor: colors.bgLight,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 700,
}

/* modal */
const modalOverlay: any = {
  position: 'fixed',
  inset: 0,
  backgroundColor: colors.modalBackdrop,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 2000,
}

const modalCard: any = {
  width: '100%',
  maxWidth: 520,
  background: 'white',
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16,
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
}

const modalCloseBtn: any = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  background: colors.white,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 16,
  color: colors.secondaryText,
}

const modalLabel: any = { display: 'block', fontSize: 12, fontWeight: 900, color: colors.secondaryText, marginBottom: 6 }

const modalInput: any = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 700,
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
}

const modalSelect: any = { ...modalInput }

const modalPrimaryBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: 'none',
  backgroundColor: colors.accentGreen,
  color: 'white',
  fontWeight: 900,
  cursor: 'pointer',
  fontSize: 14,
}

const modalSecondaryBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  color: colors.primaryDark,
  fontWeight: 900,
  cursor: 'pointer',
  fontSize: 14,
}

const segBtn: any = {
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  padding: '12px 12px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 900,
  userSelect: 'none',
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
      <AddExpenseForm />
    </Suspense>
  )
}