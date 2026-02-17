'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Wallet, Landmark, CreditCard, Plus, ArrowUpCircle } from 'lucide-react'

const colors = {
  primaryDark: '#0f172a', 
  secondaryText: '#64748b', 
  accentGreen: '#10b981',
  accentBlue: '#6366f1',
  bgLight: '#f8fafc',     
  border: '#e2e8f0',      
  white: '#ffffff',
  accentRed: '#f43f5e'
};

function AddIncomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('editId')
  const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const storeIdFromUrl = searchParams.get('store')
  
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [isCredit, setIsCredit] = useState(false) // ✅ ΝΕΟ: Επί πιστώσει έσοδο
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')
  const [storeId, setStoreId] = useState<string | null>(storeIdFromUrl)

  const loadFormData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const activeStoreId = storeIdFromUrl || (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null);
      if (!activeStoreId) return router.replace('/select-store')
      setStoreId(activeStoreId);

      // Φόρτωση Πηγών Εσόδων & Προφίλ
      const [sourcesRes, profileRes] = await Promise.all([
        supabase.from('revenue_sources').select('*').eq('store_id', activeStoreId).order('name'),
        supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
      ]);

      if (sourcesRes.data) setSources(sourcesRes.data)
      if (profileRes.data) setCurrentUsername(profileRes.data.username || 'Admin')

      if (editId) {
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', editId).single();
        if (tx) {
          setAmount(Math.abs(tx.amount).toString());
          setMethod(tx.method || 'Μετρητά');
          setNotes(tx.notes || '');
          setIsCredit(!!tx.is_credit);
          setSelectedSourceId(tx.revenue_source_id || '');
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [editId, router, storeIdFromUrl])

  useEffect(() => { loadFormData() }, [loadFormData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !selectedSourceId) return toast.error('Συμπληρώστε ποσό και πηγή εσόδου')
    setIsSaving(true)

    try {
      const payload = {
        amount: Math.abs(parseFloat(amount)),
        type: 'income',
        category: 'income',
        method: isCredit ? 'Πίστωση' : method,
        is_credit: isCredit,
        revenue_source_id: selectedSourceId,
        notes: notes,
        date: selectedDate,
        store_id: storeId,
        created_by_name: currentUsername
      }

      const { error } = editId 
        ? await supabase.from('transactions').update(payload).eq('id', editId)
        : await supabase.from('transactions').insert([payload])

      if (error) throw error
      
      toast.success('Το έσοδο καταχωρήθηκε!')
      router.push(`/?date=${selectedDate}&store=${storeId}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div style={loaderStyle}>Φόρτωση...</div>

  return (
    <main style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={formCardStyle}>
        
        <div style={headerLayout}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}><ArrowUpCircle color={colors.accentGreen} size={24} /></div>
            <div>
              <h1 style={titleStyle}>{editId ? 'Επεξεργασία' : 'Νέο Έσοδο'}</h1>
              <p style={dateSubtitle}>{new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}</p>
            </div>
          </div>
          <Link href={`/?date=${selectedDate}&store=${storeId}`} style={backBtnStyle}>✕</Link>
        </div>

        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>ΠΗΓΗ ΕΣΟΔΟΥ (AIRBNB, BOOKING κλπ)</label>
            <select 
              value={selectedSourceId} 
              onChange={(e) => setSelectedSourceId(e.target.value)} 
              style={inputStyle}
              required
            >
              <option value="">Επιλογή Πηγής...</option>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
            </select>
          </div>

          <div style={inputRow}>
            <div style={{ flex: 1.5 }}>
              <label style={labelStyle}>ΠΟΣΟ (€)</label>
              <input 
                type="number" 
                inputMode="decimal"
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                style={amountInput} 
                placeholder="0.00"
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ΤΡΟΠΟΣ</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle} disabled={isCredit}>
                <option value="Μετρητά">Μετρητά</option>
                <option value="Κάρτα">Κάρτα</option>
                <option value="Τράπεζα">Τράπεζα</option>
              </select>
            </div>
          </div>

          {/* ✅ ΝΕΟ: Toggle Επί Πιστώσει (Mirror του Expense) */}
          <div 
            onClick={() => { setIsCredit(!isCredit); if(!isCredit) setMethod('Πίστωση') }}
            style={{
              ...creditToggle,
              backgroundColor: isCredit ? '#ecfdf5' : colors.bgLight,
              border: `1px solid ${isCredit ? colors.accentGreen : colors.border}`
            }}
          >
            <div style={{...checkbox, backgroundColor: isCredit ? colors.accentGreen : 'white'}}>
              {isCredit && '✓'}
            </div>
            <span style={{ fontSize: '14px', fontWeight: '800', color: isCredit ? colors.accentGreen : colors.primaryDark }}>
              ΑΝΑΜΟΝΗ ΕΙΣΠΡΑΞΗΣ (ΠΙΣΤΩΣΗ)
            </span>
          </div>

          <div style={{ marginBottom: '25px', marginTop: '20px' }}>
            <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ / ΑΙΤΙΟΛΟΓΙΑ</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              style={textareaStyle} 
              placeholder="π.χ. Κράτηση #12345..." 
            />
          </div>

          <button 
            type="submit" 
            disabled={isSaving} 
            style={{ 
              ...submitBtn, 
              backgroundColor: isSaving ? colors.secondaryText : colors.accentGreen 
            }}
          >
            {isSaving ? 'ΚΑΤΑΧΩΡΗΣΗ...' : (editId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΙΣΠΡΑΞΗΣ')}
          </button>
        </form>
      </div>
    </main>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '16px' };
const formCardStyle: any = { maxWidth: '500px', margin: '0 auto', backgroundColor: colors.white, borderRadius: '24px', padding: '24px', border: `1px solid ${colors.border}` };
const headerLayout = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleStyle = { fontWeight: '900', fontSize: '20px', margin: 0, color: colors.primaryDark };
const dateSubtitle = { margin: 0, fontSize: '10px', color: colors.accentGreen, fontWeight: '800' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f0fdf4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight, borderRadius: '10px', border: `1px solid ${colors.border}` };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box' };
const amountInput: any = { ...inputStyle, fontSize: '24px', color: colors.accentGreen };
const textareaStyle: any = { ...inputStyle, height: '80px', fontWeight: '500' };
const inputRow = { display: 'flex', gap: '12px', marginBottom: '20px' };
const submitBtn: any = { width: '100%', padding: '18px', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '900', fontSize: '16px', cursor: 'pointer' };
const creditToggle: any = { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '12px', cursor: 'pointer' };
const checkbox: any = { width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px' };
const loaderStyle: any = { padding: '50px', textAlign: 'center', color: colors.secondaryText };

export default function AddIncomePage() {
  return <Suspense fallback={null}><AddIncomeForm /></Suspense>
}