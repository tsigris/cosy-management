'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primaryDark: '#0f172a', 
  secondaryText: '#64748b', 
  accentGreen: '#10b981',
  bgLight: '#f8fafc',     
  border: '#e2e8f0',      
  white: '#ffffff'
};

function AddIncomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL Params
  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  // Form State
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [incomeType, setIncomeType] = useState('Είσπραξη')
  const [loading, setLoading] = useState(true)
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [storeId, setStoreId] = useState<string | null>(null)

  // ✅ ΛΟΓΙΚΗ ΦΟΡΤΩΣΗΣ ΔΕΔΟΜΕΝΩΝ (INITIAL & EDIT)
  const loadFormData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, store_id')
        .eq('id', session.user.id)
        .maybeSingle()
      
      if (profile) {
        setCurrentUsername(profile.username || 'Admin')
        setStoreId(profile.store_id)

        // 🛠 ΑΝ ΕΙΝΑΙ ΕΠΕΞΕΡΓΑΣΙΑ (EDIT MODE)
        if (editId) {
          const { data: tx, error: txErr } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', editId)
            .single()

          if (tx && !txErr) {
            setAmount(tx.amount.toString())
            setMethod(tx.method || 'Μετρητά')
            setNotes(tx.notes || '')
            // Αναγνώριση τύπου εσόδου από την κατηγορία
            setIncomeType(tx.category === 'income' ? 'Είσπραξη' : 'Άλλο')
          }
        }
      }
    } catch (error) {
      console.error('Error loading form:', error)
    } finally {
      setLoading(false)
    }
  }, [editId, router])

  useEffect(() => {
    loadFormData()
  }, [loadFormData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !amount) return
    setLoading(true)

    try {
      if (!storeId) throw new Error('Δεν βρέθηκε κατάστημα')

      const payload = {
        amount: parseFloat(amount),
        type: 'income',
        category: incomeType === 'Είσπραξη' ? 'income' : 'other_income',
        method: method,
        notes: notes,
        date: selectedDate,
        store_id: storeId,
        created_by_name: currentUsername
      }

      const { error } = editId 
        ? await supabase.from('transactions').update(payload).eq('id', editId)
        : await supabase.from('transactions').insert([payload])

      if (error) throw error
      
      toast.success(editId ? 'Ενημερώθηκε επιτυχώς!' : 'Καταχωρήθηκε επιτυχώς!')
      router.push(`/?date=${selectedDate}`)
      router.refresh()
    } catch (err: any) {
      toast.error('Σφάλμα: ' + err.message)
      setLoading(false)
    }
  }

  if (loading && !amount) return <div style={loaderStyle}>Φόρτωση...</div>

  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh', padding: '16px' }}>
      <Toaster position="top-center" richColors />
      <div style={formCardStyle}>
        
        {/* HEADER */}
        <div style={headerLayout}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>💰</div>
            <div>
              <h1 style={titleStyle}>{editId ? 'Επεξεργασία' : 'Νέο Έσοδο'}</h1>
              <p style={dateSubtitle}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <div style={userIndicator}>
          <span style={userLabel}>👤 ΚΑΤΑΧΩΡΗΣΗ: {currentUsername.toUpperCase()}</span>
        </div>

        <form onSubmit={handleSubmit}>
          
          <label style={labelStyle}>ΤΥΠΟΣ ΕΣΟΔΟΥ</label>
          <div style={typeGrid}>
            {['Είσπραξη', 'Από Πελάτη', 'Επιστροφή', 'Κεφάλαιο'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setIncomeType(t)}
                style={{
                  ...typeBtnStyle,
                  backgroundColor: incomeType === t ? colors.accentGreen : colors.white,
                  color: incomeType === t ? colors.white : colors.secondaryText,
                  border: incomeType === t ? 'none' : `1px solid ${colors.border}`
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={inputRow}>
            <div style={{ flex: 1.5 }}>
              <label style={labelStyle}>ΠΟΣΟ (€)</label>
              <input 
                type="number" 
                inputMode="decimal"
                step="0.01" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                style={amountInput} 
                placeholder="0.00"
                autoFocus 
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ΤΡΟΠΟΣ</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
                <option value="Μετρητά">Μετρητά</option>
                <option value="Κάρτα">Κάρτα</option>
                <option value="Τράπεζα">Τράπεζα</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ / ΑΙΤΙΟΛΟΓΙΑ</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              style={textareaStyle} 
              placeholder="Περιγραφή εσόδου..." 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              ...submitBtn, 
              backgroundColor: loading ? colors.secondaryText : colors.accentGreen,
              boxShadow: loading ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.2)'
            }}
          >
            {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : (editId ? 'ΕΝΗΜΕΡΩΣΗ ΕΣΟΔΟΥ' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΙΣΠΡΑΞΗΣ')}
          </button>
        </form>
      </div>
    </main>
  )
}

// --- STYLES ---
const formCardStyle = { maxWidth: '500px', margin: '0 auto', backgroundColor: colors.white, borderRadius: '24px', padding: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const headerLayout = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleStyle = { fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark };
const dateSubtitle = { margin: 0, fontSize: '10px', color: colors.accentGreen, fontWeight: '700', letterSpacing: '0.5px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f0fdf4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight, borderRadius: '10px', border: `1px solid ${colors.border}` };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block', letterSpacing: '0.5px' };
const inputStyle: any = { width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box' as const, outline: 'none', color: colors.primaryDark };
const textareaStyle: any = { ...inputStyle, height: '70px', paddingTop: '12px', fontWeight: '500' };
const amountInput: any = { ...inputStyle, fontSize: '22px', color: colors.accentGreen };
const userIndicator = { marginBottom: '20px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '10px', textAlign: 'center' as any, border: `1px solid ${colors.border}` };
const userLabel = { fontSize: '11px', fontWeight: '800', color: colors.secondaryText };
const typeGrid = { display: 'flex', flexWrap: 'wrap' as any, gap: '8px', marginBottom: '24px' };
const typeBtnStyle: any = { padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' };
const inputRow = { display: 'flex', gap: '12px', marginBottom: '20px' };
const submitBtn: any = { width: '100%', padding: '18px', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };
const loaderStyle = { padding: '40px', textAlign: 'center' as any, color: colors.secondaryText, fontWeight: '600' };

export default function AddIncomePage() {
  return <Suspense fallback={<div style={loaderStyle}>Φόρτωση φόρμας...</div>}><AddIncomeForm /></Suspense>
}