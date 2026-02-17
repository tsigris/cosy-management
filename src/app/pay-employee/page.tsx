'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Eye, EyeOff, Coins, Pencil, Trash2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

// --- ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  slate100: '#f1f5f9'
}

function EmployeesContent() {
  // employees = staff από fixed_assets
  const [employees, setEmployees] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [overtimes, setOvertimes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)

  // ✅ Τύπος πληρωμής (select)
  const [payBasis, setPayBasis] = useState<'monthly' | 'daily'>('monthly')

  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  // Active / Inactive
  const [showInactive, setShowInactive] = useState(false)

  // States για overtime modal
  const [otModal, setOtModal] = useState<{ empId: string; name: string } | null>(null)
  const [otHours, setOtHours] = useState('')

  // Quick Tips (create)
  const [tipModal, setTipModal] = useState<{ empId: string; name: string } | null>(null)
  const [tipAmount, setTipAmount] = useState('')

  // Tips Edit (edit existing tip)
  const [tipEditModal, setTipEditModal] = useState<{ id: string; name: string; amount: number } | null>(null)
  const [tipEditAmount, setTipEditAmount] = useState('')

  // ✅ Επιλογή μήνα για Month Tips (default: τρέχων μήνας)
  const [tipsMonth, setTipsMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() } // month: 0-11
  })

  // Tips Analysis (month + list)
  const [tipsStats, setTipsStats] = useState({
    monthlyTips: 0,
    lastTips: [] as Array<{ id: string; name: string; date: string; amount: number }>
  })
  const [showTipsList, setShowTipsList] = useState(false)

  const availableYears: number[] = []
  for (let y = 2024; y <= new Date().getFullYear(); y++) availableYears.push(y)

  // ✅ Επιλογές μηνών (τελευταίοι 12 μήνες)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      value: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString('el-GR', { month: 'long', year: 'numeric' })
    }
  })

  // ✅ FORM DATA (με οικονομικά πεδία)
  const [formData, setFormData] = useState({
    full_name: '',
    position: '',
    amka: '',
    iban: '',
    bank_name: 'Εθνική Τράπεζα',
    monthly_salary: '',
    daily_rate: '',
    monthly_days: '26', // ✅ Ημέρες συμφωνίας
    start_date: new Date().toISOString().split('T')[0]
  })

  // ✅ Tips stats fetcher (month + last 5 of selected month)
  const getTipsStats = useCallback(async () => {
    try {
      if (!storeId) return

      const { data, error } = await supabase
        .from('transactions')
        .select('id,date,notes,fixed_asset_id,amount,fixed_assets(name)')
        .eq('store_id', storeId)
        .ilike('notes', '%tips%')
        .order('date', { ascending: false })
        .limit(800)

      if (error) {
        console.error(error)
        return
      }

      let monthlyTips = 0

      const tipsThisSelectedMonth = (data || [])
        .map((t: any) => {
          const note = String(t.notes || '')
          const isTip = /tips/i.test(note)

          let amount = Number(t.amount) || 0
          if (isTip && amount === 0) {
            const m = note.replace(',', '.').match(/[\d.]+/)
            amount = m ? parseFloat(m[0]) : 0
          }

          return {
            id: t.id,
            name: t?.fixed_assets?.name || '—',
            date: t.date,
            amount,
            note
          }
        })
        .filter((t: any) => {
          const d = new Date(t.date)
          return d.getFullYear() === tipsMonth.year && d.getMonth() === tipsMonth.month
        })

      tipsThisSelectedMonth.forEach((t: any) => {
        monthlyTips += t.amount
      })

      setTipsStats({
        monthlyTips,
        lastTips: tipsThisSelectedMonth.slice(0, 5).map((t: any) => ({
          id: t.id,
          name: t.name,
          date: t.date,
          amount: t.amount
        }))
      })
    } catch (e) {
      console.error(e)
    }
  }, [storeId, tipsMonth])

  // ✅ UPDATED DATA FETCHING:
  // - employees -> fixed_assets (sub_category='staff')
  // - transactions -> όσα έχουν fixed_asset_id
  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null
      if (!activeStoreId) {
        setLoading(false)
        return
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session?.user) return

      setStoreId(activeStoreId)

      const [empsRes, transRes, otRes] = await Promise.all([
        supabase
          .from('fixed_assets')
          .select('*')
          .eq('sub_category', 'staff')
          .or(`store_id.eq.${activeStoreId},store_id.is.null`)
          .order('name'),
        supabase
          .from('transactions')
          .select('*')
          .eq('store_id', activeStoreId)
          .not('fixed_asset_id', 'is', null)
          .order('date', { ascending: false }),
        supabase.from('employee_overtimes').select('*').eq('store_id', activeStoreId).eq('is_paid', false)
      ])

      if (empsRes.data) setEmployees(empsRes.data)
      if (transRes.data) setTransactions(transRes.data)
      if (otRes.data) setOvertimes(otRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    if (storeId) getTipsStats()
  }, [storeId, getTipsStats])

  // Φιλτράρισμα λίστας βάσει showInactive
  const mainStoreId = 'e50a8803-a262-4303-9e90-c116c965e683'
  const visibleEmployees = employees.filter((emp) => {
    if (!showInactive && emp.is_active === false) return false
    if (storeId && storeId !== mainStoreId && emp.store_id == null) return false
    return true
  })

  async function toggleActive(empId: string, currentValue: boolean | null | undefined) {
    const nextValue = currentValue === false ? true : false

    setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, is_active: nextValue } : e)))

    const { error } = await supabase.from('fixed_assets').update({ is_active: nextValue }).eq('id', empId)

    if (error) {
      setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, is_active: currentValue } : e)))
      toast.error('Αποτυχία ενημέρωσης κατάστασης υπαλλήλου.')
      return
    }

    toast.success(nextValue ? 'Ο υπάλληλος ενεργοποιήθηκε ✅' : 'Ο υπάλληλος απενεργοποιήθηκε 🚫')
  }

  const getPendingOtHours = (empId: string) => {
    return overtimes.filter((ot: any) => ot.fixed_asset_id === empId).reduce((acc: number, curr: any) => acc + Number(curr.hours), 0)
  }

  async function handleQuickOvertime() {
    if (!otHours || !otModal) return

    const activeStoreId = storeId || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

    const { error } = await supabase.from('employee_overtimes').insert([
      {
        fixed_asset_id: otModal.empId,
        store_id: activeStoreId,
        hours: Number(otHours),
        date: new Date().toISOString().split('T')[0],
        is_paid: false
      }
    ])

    if (!error) {
      toast.success(`Προστέθηκαν ${otHours} ώρες στην ${otModal.name}`)
      setOtModal(null)
      setOtHours('')
      fetchInitialData()
    } else {
      toast.error('Αποτυχία καταγραφής υπερωρίας.')
    }
  }

  async function handleQuickTip() {
    if (!tipAmount || !tipModal) return

    const amountNum = Number(tipAmount)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Βάλε έγκυρο ποσό tips.')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const activeStoreId = storeId || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

    const { error } = await supabase.from('transactions').insert([
      {
        store_id: activeStoreId,
        fixed_asset_id: tipModal.empId,
        amount: amountNum,
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Μετρητά',
        date: today,
        notes: `Tips: ${amountNum}€ [${tipModal.name}]`
      }
    ])

    if (error) {
      toast.error('Αποτυχία καταγραφής tips.')
      return
    }

    toast.success(`Καταγράφηκαν Tips ${amountNum}€ για ${tipModal.name}`)
    setTipModal(null)
    setTipAmount('')
    fetchInitialData()
    getTipsStats()
  }

  async function handleEditTipSave() {
    if (!tipEditModal) return
    const amountNum = Number(tipEditAmount)

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Βάλε έγκυρο ποσό tips.')
      return
    }

    const activeStoreId = storeId || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null)

    const { error } = await supabase
      .from('transactions')
      .update({
        amount: amountNum,
        notes: `Tips: ${amountNum}€ [${tipEditModal.name}]`,
        store_id: activeStoreId
      })
      .eq('id', tipEditModal.id)

    if (error) {
      toast.error('Αποτυχία επεξεργασίας tips.')
      return
    }

    toast.success('Τα tips ενημερώθηκαν ✅')
    setTipEditModal(null)
    setTipEditAmount('')
    fetchInitialData()
    getTipsStats()
  }

  async function deleteTipTransaction(id: string) {
    if (!confirm('Διαγραφή αυτής της καταγραφής Tips;')) return

    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      toast.error('Αποτυχία διαγραφής tips.')
      return
    }

    toast.success('Διαγράφηκε ✅')
    fetchInitialData()
    getTipsStats()
  }

  const getDaysUntilPayment = (hireDateStr: string) => {
    if (!hireDateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const hireDate = new Date(hireDateStr)
    hireDate.setHours(0, 0, 0, 0)
    let nextPayDate = new Date(hireDate)
    nextPayDate.setMonth(nextPayDate.getMonth() + 1)
    while (nextPayDate <= today) nextPayDate.setMonth(nextPayDate.getMonth() + 1)
    const diffTime = nextPayDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getYearlyStats = (id: string) => {
    const yearTrans = transactions.filter((t: any) => t.fixed_asset_id === id && new Date(t.date).getFullYear() === viewYear)

    let stats = { base: 0, overtime: 0, bonus: 0, tips: 0, total: 0 }
    const processedDates = new Set()

    yearTrans.forEach((t: any) => {
      const note = String(t.notes || '')
      const isTip = /tips/i.test(note)

      if (!isTip) {
        stats.total += Number(t.amount) || 0
      }

      if (!processedDates.has(t.date)) {
        const extract = (label: string) => {
          const regex = new RegExp(`${label}:\\s*(\\d+(\\.\\d+)?)`, 'i')
          const match = note.match(regex)
          return match ? parseFloat(match[1]) : 0
        }

        stats.base += extract('Βασικός')
        stats.overtime += extract('Υπερ.')
        stats.bonus += extract('Bonus')

        if (isTip) {
          const amt = Number(t.amount) || 0
          if (amt > 0) stats.tips += amt
          else {
            const m = note.replace(',', '.').match(/[\d.]+/)
            stats.tips += m ? parseFloat(m[0]) : 0
          }
        }

        processedDates.add(t.date)
      }
    })

    return stats
  }

  // ✅ Save staff to fixed_assets (με οικονομικά πεδία)
  async function handleSave() {
    if (!formData.full_name.trim()) return alert('Συμπληρώστε το ονοματεπώνυμο!')

    // ✅ Amount (monthly_salary ή daily_rate)
    const rawAmount = payBasis === 'monthly' ? formData.monthly_salary : formData.daily_rate
    const amountNum = Math.abs(Number(rawAmount || 0))

    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      return alert('Βάλε έγκυρο ποσό (Μισθός/Ημερομίσθιο).')
    }

    // ✅ Days
    const daysNum = Math.abs(Number(formData.monthly_days || 0))
    if (!daysNum || Number.isNaN(daysNum) || daysNum <= 0) {
      return alert('Βάλε έγκυρες ημέρες συμφωνίας.')
    }

    setLoading(true)
    const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : storeId

    // ✅ payload με όλα τα οικονομικά fields
    const payload: any = {
      name: formData.full_name.trim(),
      sub_category: 'staff',
      store_id: activeStoreId,
      is_active: true,

      // ✅ οικονομικά πεδία
      pay_basis: payBasis,
      monthly_salary: payBasis === 'monthly' ? amountNum : null,
      daily_rate: payBasis === 'daily' ? amountNum : null,
      monthly_days: daysNum
    }

    const { error } = editingId
      ? await supabase.from('fixed_assets').update(payload).eq('id', editingId)
      : await supabase.from('fixed_assets').insert([payload])

    if (!error) {
      setEditingId(null)
      resetForm()
      setIsAdding(false)
      fetchInitialData()
    } else {
      alert(error.message)
      setLoading(false)
    }
  }

  async function deleteEmployee(id: string, name: string) {
    if (!confirm(`Οριστική διαγραφή του/της ${name}; Θα σβηστεί και το ιστορικό.`)) return
    setLoading(true)
    await supabase.from('transactions').delete().eq('fixed_asset_id', id)
    const { error } = await supabase.from('fixed_assets').delete().eq('id', id)
    if (!error) fetchInitialData()
    else alert(error.message)
    setLoading(false)
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Διαγραφή αυτής της πληρωμής;')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) fetchInitialData()
    else alert(error.message)
  }

  const resetForm = () => {
    setFormData({
      full_name: '',
      position: '',
      amka: '',
      iban: '',
      bank_name: 'Εθνική Τράπεζα',
      monthly_salary: '',
      daily_rate: '',
      monthly_days: '26',
      start_date: new Date().toISOString().split('T')[0]
    })
    setPayBasis('monthly')
    setEditingId(null)
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>👥</div>
            <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0, color: colors.primaryDark }}>Υπάλληλοι</h1>
          </div>
          <Link href="/" style={backBtnStyle}>
            ✕
          </Link>
        </div>

        {/* ✅ CREATE TIPS MODAL */}
        {tipModal && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Καταγραφή Tips</h3>
              <p style={{ fontSize: '12px', color: colors.secondaryText }}>{tipModal.name}</p>
              <input
                type="number"
                placeholder="Ποσό tips (π.χ. 10)"
                value={tipAmount}
                onFocus={(e) => {
                  if (e.target.value === '0') setTipAmount('')
                }}
                onChange={(e) => setTipAmount(e.target.value)}
                style={{ ...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => {
                    setTipModal(null)
                    setTipAmount('')
                  }}
                  style={cancelBtnSmall}
                >
                  ΑΚΥΡΟ
                </button>
                <button onClick={handleQuickTip} style={saveBtnSmall}>
                  ΠΡΟΣΘΗΚΗ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ EDIT TIPS MODAL */}
        {tipEditModal && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Επεξεργασία Tips</h3>
              <p style={{ fontSize: '12px', color: colors.secondaryText }}>{tipEditModal.name}</p>
              <input
                type="number"
                placeholder="Νέο ποσό tips"
                value={tipEditAmount}
                onChange={(e) => setTipEditAmount(e.target.value)}
                style={{ ...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => {
                    setTipEditModal(null)
                    setTipEditAmount('')
                  }}
                  style={cancelBtnSmall}
                >
                  ΑΚΥΡΟ
                </button>
                <button onClick={handleEditTipSave} style={saveBtnSmall}>
                  ΑΠΟΘΗΚΕΥΣΗ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OT MODAL */}
        {otModal && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Καταγραφή Υπερωρίας</h3>
              <p style={{ fontSize: '12px', color: colors.secondaryText }}>{otModal.name}</p>
              <input
                type="number"
                placeholder="Ώρες (π.χ. 1.5)"
                value={otHours}
                onFocus={(e) => {
                  if (e.target.value === '0') setOtHours('')
                }}
                onChange={(e) => setOtHours(e.target.value)}
                style={{ ...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => setOtModal(null)} style={cancelBtnSmall}>
                  ΑΚΥΡΟ
                </button>
                <button onClick={handleQuickOvertime} style={saveBtnSmall}>
                  ΠΡΟΣΘΗΚΗ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD + SHOW INACTIVE */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <button
            onClick={() => {
              if (isAdding) resetForm()
              setIsAdding(!isAdding)
            }}
            style={{ ...(isAdding ? cancelBtn : addBtn), marginBottom: 0, flex: 1 }}
          >
            {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΥΠΑΛΛΗΛΟΣ'}
          </button>

          <button
            onClick={() => setShowInactive((v) => !v)}
            style={iconToggleBtn}
            title={showInactive ? 'Απόκρυψη ανενεργών' : 'Εμφάνιση ανενεργών'}
          >
            {showInactive ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* ✅ MONTH TIPS (με επιλογή μήνα) */}
        <div style={tipsSingleWrap}>
          <div style={tipsCardSingle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div style={tipsHeader}>
                <Coins size={18} />
                <span style={tipsTitle}>MONTH TIPS</span>
              </div>

              <select
                value={`${tipsMonth.year}-${tipsMonth.month}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setTipsMonth({ year: y, month: m })
                }}
                style={tipsMonthSelect}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={tipsValue}>{tipsStats.monthlyTips.toFixed(2)}€</div>

            <button onClick={() => setShowTipsList((v) => !v)} style={tipsListBtn}>
              {showTipsList ? 'Hide List' : 'View List'}
            </button>
          </div>
        </div>

        {showTipsList && (
          <div style={tipsListWrap}>
            {tipsStats.lastTips.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: colors.secondaryText, fontWeight: 700 }}>
                Δεν υπάρχουν tips καταγραφές για αυτόν τον μήνα.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tipsStats.lastTips.map((t) => (
                  <div key={t.id} style={tipsListItem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 900, color: colors.primaryDark, fontSize: '12px' }}>{t.name}</span>
                        <span style={{ fontSize: '10px', color: colors.secondaryText, fontWeight: 800 }}>
                          {new Date(t.date).toLocaleDateString('el-GR')}
                        </span>
                        <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 900 }}>Tips</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 900, color: '#b45309', fontSize: '12px' }}>{t.amount.toFixed(2)}€</span>

                        <button
                          style={miniIconBtn}
                          title="Επεξεργασία"
                          onClick={() => {
                            setTipEditModal({ id: t.id, name: t.name, amount: t.amount })
                            setTipEditAmount(String(t.amount))
                          }}
                        >
                          <Pencil size={16} />
                        </button>

                        <button style={miniIconBtnDanger} title="Διαγραφή" onClick={() => deleteTipTransaction(t.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ FORM */}
        {isAdding && (
          <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : colors.primaryDark }}>
            <label style={labelStyle}>Ονοματεπώνυμο *</label>
            <input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              style={inputStyle}
            />

            {/* ✅ 1) Τύπος Πληρωμής (Select) */}
            <div style={{ marginTop: '16px' }}>
              <label style={labelStyle}>Τύπος Πληρωμής</label>
              <select
                value={payBasis}
                onChange={(e) => setPayBasis(e.target.value as 'monthly' | 'daily')}
                style={inputStyle}
              >
                <option value="monthly">Μηνιαίος</option>
                <option value="daily">Ημερομίσθιο</option>
              </select>
            </div>

            {/* ✅ 2) Ποσό + 3) Ημέρες Συμφωνίας */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Ποσό (€)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={payBasis === 'monthly' ? formData.monthly_salary : formData.daily_rate}
                  onChange={(e) => {
                    const v = e.target.value
                    setFormData({
                      ...formData,
                      monthly_salary: payBasis === 'monthly' ? v : formData.monthly_salary,
                      daily_rate: payBasis === 'daily' ? v : formData.daily_rate
                    })
                  }}
                  style={inputStyle}
                  placeholder={payBasis === 'monthly' ? 'π.χ. 1200' : 'π.χ. 50'}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Ημέρες Συμφωνίας</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={formData.monthly_days}
                  onChange={(e) => setFormData({ ...formData, monthly_days: e.target.value })}
                  style={inputStyle}
                  placeholder="π.χ. 26"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Ημ. Πρόσληψης</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={labelStyle}>Τράπεζα Υπαλλήλου</label>
              <select value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} style={inputStyle}>
                <option value="Εθνική Τράπεζα">Εθνική Τράπεζα</option>
                <option value="Eurobank">Eurobank</option>
                <option value="Alpha Bank">Alpha Bank</option>
                <option value="Τράπεζα Πειραιώς">Τράπεζα Πειραιώς</option>
                <option value="Viva Wallet">Viva Wallet</option>
              </select>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={labelStyle}>IBAN Υπαλλήλου</label>
              <input
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                placeholder="GR00 0000 0000..."
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              style={{ ...saveBtnStyle, backgroundColor: editingId ? '#f59e0b' : colors.primaryDark }}
            >
              {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΑΠΟΘΗΚΕΥΣΗ'}
            </button>
          </div>
        )}

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          {visibleEmployees.map((emp) => {
            const yearlyStats = getYearlyStats(emp.id)
            const isSelected = selectedEmpId === emp.id
            const daysLeft = getDaysUntilPayment(emp.start_date)
            const pendingOt = getPendingOtHours(emp.id)
            const isInactive = emp.is_active === false

            return (
              <div
                key={emp.id}
                style={{
                  ...employeeCard,
                  opacity: isInactive ? 0.6 : 1
                }}
              >
                <div
                  onClick={() => setSelectedEmpId(isSelected ? null : emp.id)}
                  style={{ padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', color: colors.primaryDark, fontSize: '16px', margin: 0 }}>
                      {String(emp.name || '—').toUpperCase()}
                    </p>

                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span
                        style={{
                          ...badgeStyle,
                          backgroundColor: daysLeft === 0 || daysLeft === null ? '#fef2f2' : '#eff6ff',
                          color: daysLeft === 0 || daysLeft === null ? colors.accentRed : colors.accentBlue
                        }}
                      >
                        {daysLeft === 0 ? 'ΣΗΜΕΡΑ 💰' : `ΣΕ ${daysLeft} ΗΜΕΡΕΣ 📅`}
                      </span>
                      {pendingOt > 0 && <span style={{ ...badgeStyle, backgroundColor: '#fff7ed', color: '#c2410c' }}>⏱️ {pendingOt} ΩΡΕΣ</span>}
                      {isInactive && <span style={{ ...badgeStyle, backgroundColor: '#fef2f2', color: colors.accentRed }}>ΑΝΕΝΕΡΓΟΣ</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {!isInactive && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOtModal({ empId: emp.id, name: emp.name })
                          }}
                          style={quickOtBtn}
                        >
                          + ⏱️
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setTipModal({ empId: emp.id, name: emp.name })
                          }}
                          style={quickTipBtn}
                        >
                          +💰 Tips
                        </button>
                      </>
                    )}

                    <Link
                      href={`/pay-employee?id=${emp.id}&name=${encodeURIComponent(emp.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      style={payBtnStyle}
                    >
                      ΠΛΗΡΩΜΗ
                    </Link>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ backgroundColor: '#ffffff', padding: '18px', borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: colors.slate100, borderRadius: '12px', fontSize: '12px' }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: '800', color: colors.secondaryText }}>ΣΤΟΙΧΕΙΑ ΠΛΗΡΩΜΗΣ</p>
                      <p style={{ margin: 0, fontWeight: '700' }}>🏦 {emp.bank_name || 'Δεν ορίστηκε'}</p>
                      <p style={{ margin: '3px 0 0 0', fontWeight: '600', color: colors.accentBlue, fontSize: '11px' }}>{emp.iban || 'Δεν ορίστηκε IBAN'}</p>
                      {pendingOt > 0 && (
                        <p style={{ margin: '8px 0 0 0', fontWeight: '800', color: '#c2410c', fontSize: '11px' }}>
                          ⚠️ ΕΚΚΡΕΜΟΥΝ: {pendingOt} ώρες υπερωρίας
                        </p>
                      )}
                    </div>

                    <div style={filterContainer}>
                      <label style={{ ...labelStyle, margin: 0, flex: 1, alignSelf: 'center' }}>ΕΤΗΣΙΑ ΑΝΑΛΥΣΗ</label>
                      <select value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value))} style={filterSelect}>
                        {availableYears.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={statsGrid}>
                      <div style={statBox}>
                        <p style={statLabel}>ΒΑΣΙΚΟΣ ({viewYear})</p>
                        <p style={statValue}>{yearlyStats.base.toFixed(2)}€</p>
                      </div>
                      <div style={statBox}>
                        <p style={statLabel}>BONUS ({viewYear})</p>
                        <p style={statValue}>{yearlyStats.bonus.toFixed(2)}€</p>
                      </div>
                      <div style={statBox}>
                        <p style={statLabel}>ΥΠΕΡΩΡΙΕΣ ({viewYear})</p>
                        <p style={statValue}>{yearlyStats.overtime.toFixed(2)}€</p>
                      </div>
                      <div style={statBox}>
                        <p style={statLabel}>TIPS ({viewYear})</p>
                        <p style={statValue}>{yearlyStats.tips.toFixed(2)}€</p>
                      </div>

                      <div style={{ ...statBox, backgroundColor: colors.primaryDark }}>
                        <p style={{ ...statLabel, color: '#94a3b8' }}>ΣΥΝΟΛΟ ΕΤΟΥΣ</p>
                        <p style={{ ...statValue, color: colors.accentGreen }}>{yearlyStats.total.toFixed(2)}€</p>
                      </div>
                    </div>

                    <p style={historyTitle}>ΙΣΤΟΡΙΚΟ ΠΛΗΡΩΜΩΝ {viewYear}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      {transactions
                        .filter((t: any) => t.fixed_asset_id === emp.id && new Date(t.date).getFullYear() === viewYear)
                        .map((t: any) => {
                          const isTip = /tips/i.test(t.notes || '')
                          const note = String(t.notes || '')
                          const noteLabel = isTip ? note.split('[')[0]?.trim() || 'Tips' : note.split('[')[1]?.replace(']', '') || 'Πληρωμή'

                          return (
                            <div key={t.id} style={historyItemExtended}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: colors.secondaryText, fontWeight: '700', fontSize: '11px' }}>
                                  {new Date(t.date).toLocaleDateString('el-GR')}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span>{t.method === 'Τράπεζα' ? '🏦' : '💵'}</span>
                                  <span style={{ fontWeight: '800', color: colors.primaryDark }}>{Number(t.amount).toFixed(2)}€</span>
                                  <button onClick={() => deleteTransaction(t.id)} style={transDeleteBtn}>
                                    🗑️
                                  </button>
                                </div>
                              </div>

                              <p
                                style={{
                                  margin: '4px 0 0',
                                  fontSize: '10px',
                                  color: isTip ? '#b45309' : colors.secondaryText,
                                  fontStyle: 'italic',
                                  fontWeight: isTip ? 900 : 600
                                }}
                              >
                                {noteLabel}
                              </p>
                            </div>
                          )
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                          // ✅ LOAD οικονομικά πεδία από DB
                          setPayBasis((emp.pay_basis as 'monthly' | 'daily') || 'monthly')
                          setFormData({
                            full_name: emp.name || '',
                            position: emp.position || '',
                            amka: emp.amka || '',
                            iban: emp.iban || '',
                            bank_name: emp.bank_name || 'Εθνική Τράπεζα',
                            monthly_salary: emp.monthly_salary?.toString() || '',
                            daily_rate: emp.daily_rate?.toString() || '',
                            monthly_days: emp.monthly_days?.toString() || '26',
                            start_date: emp.start_date || new Date().toISOString().split('T')[0]
                          })
                          setEditingId(emp.id)
                          setIsAdding(true)
                          window.scrollTo(0, 0)
                        }}
                        style={editBtn}
                      >
                        ΕΠΕΞΕΡΓΑΣΙΑ ✎
                      </button>

                      <button onClick={() => deleteEmployee(emp.id, emp.name)} style={deleteBtn}>
                        ΔΙΑΓΡΑΦΗ 🗑️
                      </button>

                      <button
                        onClick={() => toggleActive(emp.id, emp.is_active)}
                        style={emp.is_active === false ? activateBtn : deactivateBtn}
                        title={emp.is_active === false ? 'Ενεργοποίηση υπαλλήλου' : 'Απενεργοποίηση υπαλλήλου'}
                      >
                        {emp.is_active === false ? 'ΕΝΕΡΓΟΠΟΙΗΣΗ ✅' : 'ΑΠΕΝΕΡΓΟΠΙΗΣΗ 🚫'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100dvh',
  padding: '20px',
  overflowY: 'auto',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0
}

const logoBoxStyle: any = {
  width: '42px',
  height: '42px',
  backgroundColor: '#dbeafe',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px'
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondaryText,
  fontSize: '18px',
  fontWeight: 'bold',
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.white,
  borderRadius: '12px',
  border: `1px solid ${colors.border}`
}

const payBtnStyle: any = {
  backgroundColor: colors.accentBlue,
  color: 'white',
  padding: '8px 14px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '800',
  textDecoration: 'none',
  boxShadow: '0 4px 8px rgba(37, 99, 235, 0.2)'
}

const addBtn: any = {
  width: '100%',
  padding: '16px',
  backgroundColor: colors.primaryDark,
  color: 'white',
  border: 'none',
  borderRadius: '16px',
  fontWeight: '700',
  fontSize: '14px',
  marginBottom: '20px'
}

const cancelBtn: any = { ...addBtn, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}` }

const formCard: any = {
  backgroundColor: colors.white,
  padding: '24px',
  borderRadius: '24px',
  border: '2px solid',
  marginBottom: '25px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
}

const labelStyle: any = {
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  display: 'block',
  marginBottom: '6px',
  textTransform: 'uppercase'
}

const inputStyle: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontSize: '15px',
  fontWeight: '700',
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
  outline: 'none'
}

const saveBtnStyle: any = {
  width: '100%',
  color: 'white',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: '800',
  fontSize: '15px',
  marginTop: '20px'
}

const employeeCard: any = {
  backgroundColor: colors.white,
  borderRadius: '22px',
  border: `1px solid ${colors.border}`,
  overflow: 'hidden',
  marginBottom: '12px'
}

const badgeStyle: any = { fontSize: '9px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }

const filterContainer: any = {
  display: 'flex',
  gap: '8px',
  marginBottom: '15px',
  padding: '8px',
  backgroundColor: colors.slate100,
  borderRadius: '12px'
}

const filterSelect: any = {
  padding: '6px',
  borderRadius: '8px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  fontSize: '12px',
  fontWeight: '800'
}

const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }
const statBox: any = { padding: '15px', backgroundColor: colors.slate100, borderRadius: '16px', textAlign: 'center' }
const statLabel: any = { margin: 0, fontSize: '8px', fontWeight: '800', color: colors.secondaryText }
const statValue: any = { margin: '4px 0 0', fontSize: '16px', fontWeight: '900', color: colors.primaryDark }

const historyTitle: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '12px', textTransform: 'uppercase' }
const historyItemExtended: any = { padding: '12px', borderRadius: '14px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight, marginBottom: '8px' }
const transDeleteBtn: any = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.5 }

const editBtn: any = { flex: 3, background: '#fffbeb', border: `1px solid #fef3c7`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#92400e' }
const deleteBtn: any = { flex: 2, background: '#fef2f2', border: `1px solid #fee2e2`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: colors.accentRed }

const deactivateBtn: any = { flex: 3, background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: colors.accentRed }
const activateBtn: any = { flex: 3, background: '#ecfdf5', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: colors.accentGreen }

const quickOtBtn: any = { backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', padding: '10px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }
const quickTipBtn: any = { backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #67e8f9', padding: '10px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }

const modalOverlay: any = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px'
}
const modalCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }
const saveBtnSmall: any = { flex: 1, padding: '14px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700' }
const cancelBtnSmall: any = { flex: 1, padding: '14px', backgroundColor: 'white', color: colors.secondaryText, border: `1px solid ${colors.border}`, borderRadius: '12px', fontWeight: '700' }

const iconToggleBtn: any = {
  width: '56px',
  borderRadius: '16px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
}

const tipsSingleWrap: any = { marginBottom: '14px' }
const tipsCardSingle: any = { backgroundColor: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '16px', padding: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }
const tipsHeader: any = { display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 900 }
const tipsTitle: any = { fontSize: '10px', letterSpacing: '0.08em' }
const tipsValue: any = { marginTop: '8px', fontSize: '20px', fontWeight: 900, color: colors.primaryDark }
const tipsListBtn: any = { marginTop: '10px', width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #f59e0b', backgroundColor: '#fff7ed', color: '#b45309', fontWeight: 900, fontSize: '11px', cursor: 'pointer' }
const tipsListWrap: any = { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '14px', marginBottom: '18px' }
const tipsListItem: any = { padding: '10px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight }

const tipsMonthSelect: any = {
  padding: '8px 10px',
  borderRadius: '12px',
  border: '1px solid #f59e0b',
  backgroundColor: '#fff7ed',
  color: '#b45309',
  fontWeight: 900,
  fontSize: '11px',
  outline: 'none',
  cursor: 'pointer'
}

const miniIconBtn: any = {
  width: '34px',
  height: '34px',
  borderRadius: '10px',
  border: `1px solid ${colors.border}`,
  backgroundColor: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: colors.primaryDark
}

const miniIconBtnDanger: any = {
  ...miniIconBtn,
  border: '1px solid #fecaca',
  backgroundColor: '#fef2f2',
  color: colors.accentRed
}

export default function EmployeesPage() {
  return (
    <main>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <EmployeesContent />
      </Suspense>
    </main>
  )
}