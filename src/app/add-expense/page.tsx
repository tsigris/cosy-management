'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: 'var(--text)',
  secondaryText: 'var(--muted)',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: 'var(--bg-grad)',
  border: 'var(--border)',
  white: 'var(--surface)',
  modalBackdrop: 'rgba(2,6,23,0.6)',
}

const BANK_OPTIONS = ['Εθνική Τράπεζα', 'Eurobank', 'Alpha Bank', 'Viva Wallet', 'Τράπεζα Πειραιώς'] as const

// ✅ Canonical payment methods (keep consistent across the app)
const METHOD_VALUES = ['Μετρητά', 'Τράπεζα', 'Κάρτα', 'Πίστωση'] as const
type PaymentMethod = (typeof METHOD_VALUES)[number]

type SmartKind = 'supplier' | 'asset'
type AssetGroup = 'staff' | 'maintenance' | 'utility' | 'other'

type ProfileRole = 'admin' | 'user' | 'super_admin' | string

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

  // ✅ precomputed search keys
  name_norm: string
  name_latin: string
  name_fuzzy: string
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

// ✅ Harden helpers
const clampText = (v: any, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const upper = (v: any) => String(v ?? '').trim().toUpperCase()

// ✅ Amount parsing: accepts "10,50" and "10.50"
function parseAmount(input: string) {
  const s = String(input || '').trim().replace(/\s+/g, '').replace(',', '.')
  const n = Number(s)
  return n
}

function ymFromDate(dateStr: string) {
  // dateStr expected: YYYY-MM-DD
  const [y, m] = String(dateStr || '').split('-')
  const year = (y || '0000').padStart(4, '0')
  const month = (m || '01').padStart(2, '0')
  return { year, month }
}

function AddExpenseForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = getSupabase()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const urlStoreId = searchParams.get('store')

  const urlSupId = searchParams.get('supId')
  const urlAssetId = searchParams.get('assetId')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false)
  const [isAgainstDebt, setIsAgainstDebt] = useState(searchParams.get('mode') === 'debt')
  type DocumentType = 'Απόδειξη λιανικής' | 'Τιμολόγιο' | 'Χωρίς τιμολόγιο'
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)

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
  const [debouncedQuery, setDebouncedQuery] = useState('') // ✅ debounce
  const [smartOpen, setSmartOpen] = useState(false)
  const smartBoxRef = useRef<HTMLDivElement | null>(null)
  const smartBeneficiaryInputRef = useRef<HTMLInputElement | null>(null)
  const amountInputRef = useRef<HTMLInputElement | null>(null)

  // ✅ Role (SaaS)
  const [role, setRole] = useState<ProfileRole>('user')
  const canCreate = useMemo(() => ['admin', 'user', 'super_admin'].includes(String(role)), [role])

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

  // ✅ Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(smartQuery.trim())
    }, 150)
    return () => clearTimeout(t)
  }, [smartQuery])

  // ✅ Auto focus on beneficiary input when ready
  useEffect(() => {
    if (loading) return
    if (createOpen) return
    requestAnimationFrame(() => {
      smartBeneficiaryInputRef.current?.focus()
    })
  }, [loading, createOpen])

  // ✅ Make beneficiary field stand out (guided UX)
  const beneficiaryInputStyle = useMemo(() => {
    const empty = !smartQuery.trim() && !selectedEntity
    return {
      ...inputStyle,
      border: empty ? `2px solid ${colors.accentBlue}` : inputStyle.border,
      backgroundColor: empty ? 'rgba(37, 99, 235, 0.06)' : inputStyle.backgroundColor,
      boxShadow: empty ? '0 6px 18px rgba(37, 99, 235, 0.10)' : undefined,
    }
  }, [smartQuery, selectedEntity])

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

  // ✅ Memory cleanup for image preview (revoke object URL)
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const ua = navigator.userAgent || ''
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.matchMedia('(pointer: coarse)').matches
    if (!isMobile) return

    let rafId: number | null = null

    const blurActiveInput = () => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return

      const isEditable = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      if (!isEditable) return

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null
        const current = document.activeElement as HTMLElement | null
        if (!current) return

        const currentIsEditable = current.tagName === 'INPUT' || current.tagName === 'TEXTAREA' || current.isContentEditable
        if (currentIsEditable) current.blur()
      })
    }

    const listenerOptions: AddEventListenerOptions = { passive: true }
    const documentScrollOptions: AddEventListenerOptions = { passive: true, capture: true }

    window.addEventListener('scroll', blurActiveInput, listenerOptions)
    window.addEventListener('touchmove', blurActiveInput, listenerOptions)
    window.addEventListener('wheel', blurActiveInput, listenerOptions)

    document.addEventListener('scroll', blurActiveInput, documentScrollOptions)

    const scrollableContainers = new Set<HTMLElement>()

    const registerScrollableContainer = (node: Element) => {
      if (!(node instanceof HTMLElement)) return
      if (scrollableContainers.has(node)) return

      const styles = window.getComputedStyle(node)
      const overflowY = styles.overflowY
      const overflowX = styles.overflowX
      const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight
      const canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth

      if (!canScrollY && !canScrollX) return

      node.addEventListener('scroll', blurActiveInput, listenerOptions)
      node.addEventListener('touchmove', blurActiveInput, listenerOptions)
      node.addEventListener('wheel', blurActiveInput, listenerOptions)
      scrollableContainers.add(node)
    }

    const scanScrollableContainers = () => {
      document.querySelectorAll('*').forEach(registerScrollableContainer)
    }

    scanScrollableContainers()

    const observer = new MutationObserver(() => {
      scanScrollableContainers()
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }

      observer.disconnect()

      window.removeEventListener('scroll', blurActiveInput, listenerOptions)
      window.removeEventListener('touchmove', blurActiveInput, listenerOptions)
      window.removeEventListener('wheel', blurActiveInput, listenerOptions)

      document.removeEventListener('scroll', blurActiveInput, documentScrollOptions)

      scrollableContainers.forEach((node) => {
        node.removeEventListener('scroll', blurActiveInput, listenerOptions)
        node.removeEventListener('touchmove', blurActiveInput, listenerOptions)
        node.removeEventListener('wheel', blurActiveInput, listenerOptions)
      })
    }
  }, [])

  const getActiveStoreId = useCallback(() => {
    const ls = typeof window !== 'undefined' ? (localStorage.getItem('active_store_id') || '').trim() : ''
    const url = (urlStoreId || '').trim()
    if (ls) return ls
    if (url) {
      try {
        localStorage.setItem('active_store_id', url)
      } catch {}
      return url
    }
    return storeId || null
  }, [urlStoreId, storeId])

  const loadFormData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const activeStoreId = getActiveStoreId()
      if (!activeStoreId) {
        setLoading(false)
        toast.error('Δεν βρέθηκε κατάστημα (store)')
        return
      }

      setStoreId(activeStoreId)

      // ✅ fetch username + role together
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, role')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile?.username) setCurrentUsername(profile.username || 'Χρήστης')
      setRole((profile?.role as ProfileRole) || 'user')

      const [sRes, fRes, tRes] = await Promise.all([
        supabase.from('suppliers').select('id, name, phone, vat_number, bank_name, iban').eq('store_id', activeStoreId).order('name'),
        supabase
          .from('fixed_assets')
          .select('id, name, sub_category, phone, vat_number, bank_name, iban, monthly_days, monthly_salary, daily_rate, start_date, rf_code, pay_basis')
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

      // ✅ edit mode
      if (editId) {
        const { data: tx, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', editId)
          .eq('store_id', activeStoreId)
          .single()

        if (error) throw error

        if (tx) {
          setAmount(Math.abs(tx.amount).toString())

          // ✅ Canonical method loading
          const m = String(tx.method || '').trim()
          const safeMethod: PaymentMethod = (METHOD_VALUES as readonly string[]).includes(m) ? (m as PaymentMethod) : 'Μετρητά'
          setMethod(safeMethod === 'Πίστωση' ? 'Μετρητά' : safeMethod) // UI keeps credit via checkbox

          const notesText = String(tx.notes || '')
          setNotes(notesText)
          setIsCredit(!!tx.is_credit || m === 'Πίστωση')
          setIsAgainstDebt(tx.type === 'debt_payment')

          // Set documentType from notes prefix
          if (notesText.startsWith('Απόδειξη λιανικής')) setDocumentType('Απόδειξη λιανικής')
          else if (notesText.startsWith('Τιμολόγιο')) setDocumentType('Τιμολόγιο')
          else if (notesText.startsWith('Χωρίς τιμολόγιο')) setDocumentType('Χωρίς τιμολόγιο')
          else setDocumentType(null)

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
        // ✅ new mode pre-select
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

        // ✅ AUTO-NOTES για πληρωμή παλαιού χρέους (μόνο σε νέο, όχι edit)
        const isDebtMode = searchParams.get('mode') === 'debt'
        if (isDebtMode) {
          setIsAgainstDebt(true)
          setIsCredit(false)
          setNotes((prev) => (prev?.trim() ? prev : 'ΕΞΟΦΛΗΣΗ ΥΠΟΛΟΙΠΟΥ ΚΑΡΤΕΛΑΣ'))
        }
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || 'Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [editId, router, selectedDate, urlSupId, urlAssetId, searchParams, getActiveStoreId, supabase])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const currentBalance = useMemo(() => dayStats.income - dayStats.expenses, [dayStats])

  const smartItems = useMemo<SmartItem[]>(() => {
    const sList: SmartItem[] =
      suppliers?.map((s: any) => {
        const name = String(s.name || '')
        const norm = normalizeGreek(name)
        const latin = greekToGreeklish(name)
        const fuzzy = fuzzyIHI(latin)
        return {
          kind: 'supplier',
          id: String(s.id),
          name,
          phone: s.phone ?? null,
          vat_number: s.vat_number ?? null,
          bank_name: s.bank_name ?? null,
          iban: s.iban ?? null,
          name_norm: norm,
          name_latin: latin,
          name_fuzzy: fuzzy,
        }
      }) || []

    const aList: SmartItem[] =
      fixedAssets?.map((a: any) => {
        const name = String(a.name || '')
        const norm = normalizeGreek(name)
        const latin = greekToGreeklish(name)
        const fuzzy = fuzzyIHI(latin)
        return {
          kind: 'asset',
          id: String(a.id),
          name,
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
          name_norm: norm,
          name_latin: latin,
          name_fuzzy: fuzzy,
        }
      }) || []

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
    const raw = debouncedQuery.trim()
    if (!raw) return []

    const q = normalizeGreek(raw)
    const qF = fuzzyIHI(q)

    return smartItems
      .filter((item) => {
        // ✅ no re-normalize per keystroke (uses precomputed keys)
        return item.name_norm.includes(q) || item.name_latin.includes(q) || item.name_fuzzy.includes(qF)
      })
      .slice(0, 80)
  }, [debouncedQuery, smartItems])

  const groupedResultsSafe = useMemo(() => {
    const groups: Record<string, SmartItem[]> = {}
    for (const it of filtered) {
      const key = it.kind === 'supplier' ? 'suppliers' : it.group || 'other'
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
    requestAnimationFrame(() => {
      amountInputRef.current?.focus()
    })
  }

  const clearSelection = () => {
    setSelectedEntity(null)
    setSmartQuery('')
    setSmartOpen(true)
    requestAnimationFrame(() => {
      smartBeneficiaryInputRef.current?.focus()
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      // ✅ basic size guard (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Η φωτογραφία είναι πολύ μεγάλη (max 5MB)')
        return
      }
      setImageFile(file)

      // ✅ revoke old preview before setting new one
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const openCreateModal = () => {
    if (!canCreate) {
      toast.error('Δεν έχεις δικαίωμα δημιουργίας νέου δικαιούχου')
      return
    }

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
    const activeStoreId = getActiveStoreId()
    if (!activeStoreId) return toast.error('Δεν βρέθηκε κατάστημα (store)')

    const nm = clampText(cName, 80)
    if (!nm) return toast.error('Γράψε όνομα')

    if (createTab === 'utility') {
      const rf = clampText(cRf, 60)
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

      if (createTab === 'suppliers') {
        const payload: any = {
          name: nm,
          phone: clampText(cPhone, 30) || null,
          vat_number: clampText(cVat, 30) || null,
          bank_name: cBank || null,
          iban: upper(cIban) || null, // ✅ uppercase
          store_id: activeStoreId,
        }

        const { data, error } = await supabase
          .from('suppliers')
          .insert([payload])
          .select('id, name, phone, vat_number, bank_name, iban')
          .single()
        if (error) throw error

        setSuppliers((prev) => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
        setSelectedEntity({ kind: 'supplier', id: String(data.id) })
        setSmartQuery(String(data.name || nm))
        toast.success('Προστέθηκε στους Προμηθευτές')
        setCreateOpen(false)
        return
      }

      const sub_category =
        createTab === 'maintenance'
          ? 'Maintenance'
          : createTab === 'utility'
            ? 'utility'
            : createTab === 'staff'
              ? 'staff'
              : 'other'

      let payload: any = { store_id: activeStoreId, sub_category, name: nm }

      if (createTab === 'utility') {
        payload = {
          ...payload,
          rf_code: upper(cRf), // ✅ uppercase
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
          iban: upper(cIban) || null, // ✅ uppercase
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
        payload = {
          ...payload,
          phone: clampText(cPhone, 30) || null,
          vat_number: clampText(cVat, 30) || null,
          bank_name: cBank || null,
          iban: upper(cIban) || null, // ✅ uppercase
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

      setFixedAssets((prev) => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))))
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

  // ✅ Balance lock: block entries before last Z date (assumes type='z_report')
  const checkBalanceLock = async () => {
    const activeStoreId = getActiveStoreId()
    if (!activeStoreId) {
      toast.error('Δεν βρέθηκε κατάστημα (store)')
      return null
    }
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .eq('store_id', activeStoreId)
        .eq('type', 'z_report')
        .order('date', { ascending: false })
        .limit(1)

      if (error) return null
      const last = data?.[0]?.date ? String(data[0].date) : null
      return last
    } catch {
      return null
    }
  }

  // ✅ Duplicate detection: same day + same amount + same receiver (+ same txType)
  const checkPossibleDuplicate = async (txType: 'expense' | 'debt_payment', amtAbs: number) => {
    const activeStoreId = getActiveStoreId()
    if (!activeStoreId) {
      toast.error('Δεν βρέθηκε κατάστημα (store)')
      return null
    }
    try {
      let q = supabase
        .from('transactions')
        .select('id, amount, date, supplier_id, fixed_asset_id, created_at')
        .eq('store_id', activeStoreId)
        .eq('date', selectedDate)
        .in('type', [txType])
        .eq(selectedEntity?.kind === 'supplier' ? 'supplier_id' : 'fixed_asset_id', selectedEntity?.id || '')
        .eq('amount', -Math.abs(amtAbs)) // same signed amount (expenses negative)

      if (editId) q = q.neq('id', editId)

      const { data, error } = await q.limit(3)
      if (error) return null
      return data && data.length > 0 ? data : null
    } catch {
      return null
    }
  }

  const handleSave = async () => {
    // ✅ comma-safe parsing
    const amt = parseAmount(amount)
    if (!amount || !Number.isFinite(amt) || amt <= 0) return toast.error('Συμπλήρωσε σωστό ποσό')
    if (amt > 1_000_000) return toast.error('Το ποσό είναι υπερβολικά μεγάλο')
    if (!selectedEntity) return toast.error('Επίλεξε δικαιούχο από την αναζήτηση')
    if (!documentType) {
      return toast.error('Παρακαλώ επιλέξτε τύπο παραστατικού (Απόδειξη, Τιμολόγιο ή Χωρίς);')
    }

    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setLoading(false)
        return router.push('/login')
      }

      const { data: prof } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle()

      const createdByName = (prof?.username || session.user.email?.split('@')[0] || 'Χρήστης').trim()

      const activeStoreId = getActiveStoreId()
      if (!activeStoreId) {
        setLoading(false)
        return toast.error('Δεν βρέθηκε κατάστημα (store)')
      }

      setStoreId(activeStoreId)

      // ✅ Balance lock check
      const lastZ = await checkBalanceLock()
      if (lastZ && selectedDate < lastZ) {
        setLoading(false)
        toast.error(`Η ημερομηνία είναι κλειδωμένη λόγω Z Report (τελευταίο κλείσιμο: ${lastZ})`)
        return
      }

      const category = categoryFromSelection(selectedEntity, smartItemMap)

      // ✅ Canonical type
      const txType: 'expense' | 'debt_payment' = isAgainstDebt ? 'debt_payment' : 'expense'

      // ✅ HARD RULES:
      // 1) debt_payment cannot be credit
      // 2) if credit -> method stored as "Πίστωση"
      // 3) method must be one of METHOD_VALUES
      const finalIsCredit = txType === 'debt_payment' ? false : !!isCredit
      const chosenMethod: PaymentMethod = method === 'Πίστωση' ? 'Μετρητά' : method
      const finalMethod: PaymentMethod = finalIsCredit ? 'Πίστωση' : chosenMethod

      if (!(METHOD_VALUES as readonly string[]).includes(finalMethod)) {
        setLoading(false)
        return toast.error('Μη αποδεκτή μέθοδος πληρωμής')
      }

      // ✅ Duplicate detection confirm (only for new saves OR edits too—kept for both)
      const dup = await checkPossibleDuplicate(txType, amt)
      if (dup && dup.length > 0) {
        const label = smartQuery || 'Δικαιούχο'
        const ok = window.confirm(
          `⚠️ Πιθανό διπλό έξοδο!\n\nΒρέθηκε άλλη κίνηση την ίδια μέρα για ${amt.toFixed(2)}€ προς "${label}".\n\nΘες σίγουρα να συνεχίσεις;`,
        )
        if (!ok) {
          setLoading(false)
          return
        }
      }

      // ✅ notes hardening
      const baseNotes = clampText(notes, 500)
      const mustDebtNote = txType === 'debt_payment' ? 'ΕΞΟΦΛΗΣΗ ΥΠΟΛΟΙΠΟΥ ΚΑΡΤΕΛΑΣ' : ''
      const debtNote =
        txType === 'debt_payment'
          ? baseNotes
            ? baseNotes.toUpperCase().includes('ΕΞΟΦΛΗΣΗ')
              ? baseNotes
              : `${baseNotes} | ${mustDebtNote}`
            : mustDebtNote
          : baseNotes

      const finalNotes = documentType ? documentType + (debtNote ? ' | ' + debtNote : '') : debtNote

      const payload: any = {
        amount: -Math.abs(amt), // ✅ expenses negative
        method: finalMethod, // ✅ method column (exists in Supabase)
        is_credit: finalIsCredit,
        type: txType,
        date: selectedDate,
        user_id: session.user.id,
        store_id: activeStoreId,
        supplier_id: selectedEntity.kind === 'supplier' ? selectedEntity.id : null,
        fixed_asset_id: selectedEntity.kind === 'asset' ? selectedEntity.id : null,
        category,
        created_by_name: clampText(createdByName, 60),
        notes: finalNotes,
      }

      // ✅ invoice upload (only for new tx, only if not "Χωρίς τιμολόγιο")
      if (imageFile && documentType !== 'Χωρίς τιμολόγιο' && !editId) {
        const safeExt = (imageFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const fileExt = safeExt || 'jpg'
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`

        // ✅ storage path: store/YYYY/MM/file
        const { year, month } = ymFromDate(selectedDate)
        const filePath = `${activeStoreId}/${year}/${month}/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage.from('invoices').upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: imageFile.type || undefined,
        })
        if (uploadError) throw uploadError

        payload.invoice_image = uploadData?.path || null
      }

      let error: any = null
      if (editId) {
        const res = await supabase.from('transactions').update(payload).eq('id', editId).eq('store_id', activeStoreId)
        error = res.error
      } else {
        const res = await supabase.from('transactions').insert([payload])
        error = res.error
      }

      if (error) throw error

      toast.success(editId ? 'Η κίνηση ενημερώθηκε!' : 'Η κίνηση καταχωρήθηκε!')
      router.push(`/?date=${selectedDate}&store=${getActiveStoreId() || ''}`)
      router.refresh()
    } catch (error: any) {
      console.error(error)
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
    if (!canCreate) return false
    if (!smartOpen) return false
    if (!q) return false
    if (filtered.length > 0) return false
    return true
  }, [canCreate, smartOpen, smartQuery, filtered.length])

  return (
    <div style={iphoneWrapper}>
      {/* ✅ Toasts above modal */}
      <Toaster position="top-center" richColors toastOptions={{ style: { zIndex: 3000 } }} />

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

          <Link href={`/?store=${getActiveStoreId() || ''}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        <div style={formCard}>
          <label style={labelStyle}>Δικαιούχος</label>

          <div ref={smartBoxRef} style={{ position: 'relative' }}>
            <input
              ref={smartBeneficiaryInputRef}
              value={smartQuery}
              onChange={(e) => {
                setSmartQuery(e.target.value)
                setSelectedEntity(null)
                setSmartOpen(true)
              }}
              onFocus={() => setSmartOpen(true)}
              placeholder="Αναζήτηση"
              style={beneficiaryInputStyle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={80}
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
                    onPointerDown={(e) => {
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
                    <div style={{ padding: 14, fontSize: 14, fontWeight: 700, color: colors.secondaryText }}>Δεν βρέθηκε αποτέλεσμα</div>
                  ) : null
                ) : (
                  Object.entries(groupedResultsSafe).map(([group, items]) => (
                    <div key={group}>
                      <div style={groupHeader}>{group}</div>

                      {items.map((item) => (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            pickSmartItem(item)
                          }}
                          onTouchStart={(e) => {
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
              {!!selectedMeta && <span style={{ marginLeft: 8, color: colors.secondaryText, fontWeight: 800 }}>({selectedMeta})</span>}
            </div>
          )}

          <label style={{ ...labelStyle, marginTop: 20 }}>Ποσό (€)</label>
          <input
            ref={amountInputRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
            placeholder="0.00"
          />
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>
            Tip: δέχεται και <b>10,50</b>.
          </div>

          <label style={{ ...labelStyle, marginTop: 20 }}>ΤΥΠΟΣ ΠΑΡΑΣΤΑΤΙΚΟΥ *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {(['Απόδειξη λιανικής', 'Τιμολόγιο', 'Χωρίς τιμολόγιο'] as DocumentType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDocumentType(type)}
                style={{
                  border: documentType === type ? `2px solid ${colors.accentBlue}` : `1px solid ${colors.border}`,
                  fontWeight: documentType === type ? 900 : 700,
                  background: colors.white,
                  color: colors.primaryDark,
                  borderRadius: 10,
                  padding: '10px',
                  cursor: 'pointer',
                  outline: documentType === type ? 'none' : undefined,
                }}
              >
                {type}
              </button>
            ))}
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

            <button
              type="button"
              onClick={() => {
                setMethod('Κάρτα')
                setIsCredit(false)
              }}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Κάρτα' && !isCredit ? colors.primaryDark : colors.white,
                color: method === 'Κάρτα' && !isCredit ? 'white' : colors.secondaryText,
              }}
            >
              💳 Κάρτα
            </button>
          </div>

          <div style={creditPanel}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={isCredit}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIsCredit(checked)
                  if (checked) setIsAgainstDebt(false) // ✅ cannot both
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
                onChange={(e) => {
                  const checked = e.target.checked
                  setIsAgainstDebt(checked)
                  if (checked) setIsCredit(false) // ✅ cannot both
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, height: 80 }}
            maxLength={500}
            placeholder="π.χ. Απόδειξη, περιγραφή, αριθμός..."
          />

          {!editId && documentType !== 'Χωρίς τιμολόγιο' ? (
            <>
              <div style={{ marginTop: 20 }}>
                <label style={labelStyle}>📸 Φωτογραφία τιμολογίου</label>
                <div style={imageUploadContainer}>
                  {imagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: 140 }}>
                      <img src={imagePreview} alt="Preview" style={imagePreviewStyle} />
                      <button
                        type="button"
                        onClick={() => {
                          if (imagePreview) URL.revokeObjectURL(imagePreview)
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
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>
                  * Max 5MB. Δεν ανεβάζουμε αν έχεις “Χωρίς τιμολόγιο”. (Path: store/YYYY/MM)
                </div>
              </div>
            </>
          ) : null}

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
                <span style={{ fontSize: 14, opacity: 0.85, fontWeight: 800, marginTop: 6 }}>
                  Καθαρό ταμείο: {currentBalance.toFixed(2)}€
                </span>
              </div>
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>
            * Αποθηκεύουμε στη στήλη <b>method</b>. Για Πίστωση: <b>method="Πίστωση"</b> + <b>is_credit=true</b>.
          </div>
        </div>
      </div>

      {/* ✅ CREATE MODAL (allowed for admin/user/super_admin) */}
      {createOpen && canCreate && (
        <div style={modalOverlay} onMouseDown={() => !createSaving && setCreateOpen(false)}>
          <div style={modalCard} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: colors.primaryDark }}>Νέα καταχώρηση</h2>
              <button type="button" onClick={() => !createSaving && setCreateOpen(false)} style={modalCloseBtn} aria-label="Κλείσιμο">
                ✕
              </button>
            </div>

            <p style={{ margin: '8px 0 14px', fontSize: 13, fontWeight: 700, color: colors.secondaryText }}>
              Δεν βρέθηκε <strong>{smartQuery.trim()}</strong>. Διάλεξε κατηγορία και συμπλήρωσε τα πεδία.
            </p>

            <label style={modalLabel}>Κατηγορία</label>
            <select
              value={createTab}
              onChange={(e) => {
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

            <div style={{ marginTop: 12 }}>
              <label style={modalLabel}>{createTab === 'staff' ? 'Ονοματεπώνυμο' : 'Όνομα'}</label>
              <input value={cName} onChange={(e) => setCName(e.target.value)} style={modalInput} placeholder="π.χ. Τζήλιος" disabled={createSaving} maxLength={80} />
            </div>

            {(createTab === 'suppliers' || createTab === 'maintenance' || createTab === 'other') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={modalLabel}>Τηλέφωνο</label>
                    <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} style={modalInput} disabled={createSaving} maxLength={30} />
                  </div>
                  <div>
                    <label style={modalLabel}>ΑΦΜ</label>
                    <input value={cVat} onChange={(e) => setCVat(e.target.value)} style={modalInput} disabled={createSaving} maxLength={30} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τράπεζα</label>
                  <select value={cBank} onChange={(e) => setCBank(e.target.value)} style={modalSelect} disabled={createSaving}>
                    <option value="">Επιλέξτε...</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>IBAN</label>
                  <input
                    value={cIban}
                    onChange={(e) => setCIban(e.target.value.replace(/\s+/g, '').toUpperCase())} // ✅ strip spaces + uppercase
                    style={modalInput}
                    placeholder="GR..."
                    disabled={createSaving}
                    maxLength={40}
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>* IBAN αποθηκεύεται με ΚΕΦΑΛΑΙΑ.</div>
              </>
            )}

            {createTab === 'utility' && (
              <>
                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Κωδικός RF</label>
                  <input
                    value={cRf}
                    onChange={(e) => setCRf(e.target.value.replace(/\s+/g, '').toUpperCase())} // ✅ strip spaces + uppercase
                    style={modalInput}
                    placeholder="RF..."
                    disabled={createSaving}
                    maxLength={60}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τράπεζα</label>
                  <select value={cBank} onChange={(e) => setCBank(e.target.value)} style={modalSelect} disabled={createSaving}>
                    <option value="">Επιλέξτε...</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: colors.secondaryText }}>* RF αποθηκεύεται με ΚΕΦΑΛΑΙΑ.</div>
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
                      onChange={(e) => (cPayBasis === 'monthly' ? setCMonthlySalary(e.target.value) : setCDailyRate(e.target.value))}
                      style={modalInput}
                      inputMode="decimal"
                      disabled={createSaving}
                    />
                  </div>
                  <div>
                    <label style={modalLabel}>Μέρες μήνα</label>
                    <input value={cMonthlyDays} onChange={(e) => setCMonthlyDays(e.target.value)} style={modalInput} inputMode="numeric" disabled={createSaving} />
                  </div>
                  <div>
                    <label style={modalLabel}>Ημ. πρόσληψης</label>
                    <input value={cStartDate} onChange={(e) => setCStartDate(e.target.value)} style={modalInput} type="date" disabled={createSaving} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>Τράπεζα</label>
                  <select value={cBank} onChange={(e) => setCBank(e.target.value)} style={modalSelect} disabled={createSaving}>
                    <option value="">Επιλέξτε...</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={modalLabel}>IBAN</label>
                  <input
                    value={cIban}
                    onChange={(e) => setCIban(e.target.value.replace(/\s+/g, '').toUpperCase())} // ✅ strip spaces + uppercase
                    style={modalInput}
                    placeholder="GR..."
                    disabled={createSaving}
                    maxLength={40}
                  />
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
  color: 'var(--surface)',
  fontSize: 18,
  fontWeight: 900,
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  padding: '10px 12px',
  backgroundColor: colors.white,
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 900,
}

const formCard: any = { backgroundColor: colors.white, padding: 20, borderRadius: 24, border: `1px solid ${colors.border}` }
const labelStyle: any = { fontSize: 12, fontWeight: 900, color: colors.secondaryText, display: 'block', marginBottom: 8 }

const inputStyle: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 700,
  backgroundColor: colors.white,
  color: colors.primaryDark,
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
  backgroundColor: colors.white,
  color: colors.primaryDark,
}

const checkboxBox: any = {
  width: 20,
  height: 20,
  borderRadius: 6,
  border: '2px solid var(--muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--surface)',
  fontSize: 14,
  fontWeight: 900,
  backgroundColor: 'var(--surface)',
}

const creditPanel: any = { backgroundColor: colors.white, padding: 16, borderRadius: 14, border: `1px solid ${colors.border}`, marginTop: 20 }
const checkboxStyle: any = { width: 20, height: 20 }
const checkLabel: any = { fontSize: 14, fontWeight: 900, color: colors.primaryDark }

const smartSaveBtn: any = {
  width: '100%',
  padding: 16,
  color: 'var(--surface)',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  boxShadow: 'var(--shadow)',
  fontSize: 16,
}

const imageUploadContainer: any = {
  width: '100%',
  backgroundColor: colors.white,
  borderRadius: 14,
  border: `2px dashed ${colors.border}`,
  overflow: 'hidden',
}
const uploadPlaceholder: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }
const imagePreviewStyle: any = { width: '100%', height: 140, objectFit: 'cover' as const }
const removeImageBtn: any = {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: 'rgba(0,0,0,0.5)',
  color: 'var(--surface)',
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
  boxShadow: 'var(--shadow)',
}

const groupHeader: any = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: colors.white,
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
  background: colors.white,
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
  color: 'var(--surface)',
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
  backgroundColor: colors.white,
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
  background: colors.white,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16,
  boxShadow: 'var(--shadow)',
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
  backgroundColor: colors.white,
  color: colors.primaryDark,
  boxSizing: 'border-box',
}

const modalSelect: any = { ...modalInput }

const modalPrimaryBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: 'none',
  backgroundColor: colors.accentGreen,
  color: 'var(--surface)',
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