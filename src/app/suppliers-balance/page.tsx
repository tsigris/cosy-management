'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Receipt, Users, Trash2, Edit3, CreditCard } from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentOrange: '#f97316',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  accentBlue: '#2563eb',
  accentRed: '#dc2626'
};

function BalancesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Η ΜΟΝΑΔΙΚΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ: Το ID από το URL
  const storeIdFromUrl = searchParams.get('store')

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')

  const fetchBalances = useCallback(async () => {
    if (!storeIdFromUrl) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Ανάκτηση ΜΟΝΟ των δεδομένων που ανήκουν στο συγκεκριμένο store_id
      const [supsRes, transRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select('*')
          .eq('store_id', storeIdFromUrl)
          .order('name'),
        supabase
          .from('transactions')
          .select('*')
          .eq('store_id', storeIdFromUrl)
      ]);

      if (supsRes.error) throw supsRes.error
      if (transRes.error) throw transRes.error

      const suppliers = supsRes.data || []
      const transactions = transRes.data || []

      // Υπολογισμός υπολοίπου ανά προμηθευτή
      const balanceList = suppliers.map(s => {
        const sTrans = transactions.filter(t => t.supplier_id === s.id)
        
        // totalCredit: Συναλλαγές με "is_credit: true" (Αγορές με πίστωση)
        const totalCredit = sTrans
          .filter(t => t.is_credit === true)
          .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
        
        // totalPaid: Συναλλαγές τύπου "debt_payment" (Πληρωμές έναντι χρέους)
        const totalPaid = sTrans
          .filter(t => t.type === 'debt_payment')
          .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

        return { 
          ...s, 
          balance: totalCredit - totalPaid 
        }
      }).filter(s => s.balance !== 0) // Εμφανίζουμε όσους έχουν υπόλοιπο (θετικό ή αρνητικό)

      setData(balanceList)
    } catch (err: any) { 
      console.error(err)
      toast.error('Σφάλμα κατά τον υπολογισμό υπολοίπων')
    } finally { 
      setLoading(false) 
    }
  }, [storeIdFromUrl])

  useEffect(() => { 
    fetchBalances() 
  }, [fetchBalances])

  async function handleDeleteDebt(supplierId: string, supplierName: string) {
    const confirmAction = window.confirm(`Προσοχή! Θέλετε να μηδενίσετε την καρτέλα του προμηθευτή ${supplierName.toUpperCase()}; Αυτό θα διαγράψει τις εγγραφές χρέους και πληρωμών του.`);
    if (!confirmAction) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('supplier_id', supplierId)
        .eq('store_id', storeIdFromUrl)
        .or('is_credit.eq.true,type.eq.debt_payment');

      if (error) throw error;
      
      toast.success('Το υπόλοιπο μηδενίστηκε');
      fetchBalances();
    } catch (err: any) {
      toast.error('Σφάλμα κατά τη διαγραφή');
    }
  }

  const filteredData = useMemo(() => {
    if (selectedSupplierId === 'all') return data;
    return data.filter(s => s.id === selectedSupplierId);
  }, [selectedSupplierId, data]);

  const totalDebtDisplay = filteredData.reduce((acc, s) => acc + s.balance, 0);

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '120px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}><Receipt size={22} color="#f97316" /></div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Καρτέλες</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '1px' }}>ΥΠΟΛΟΙΠΑ ΠΡΟΜΗΘΕΥΤΩΝ</p>
            </div>
          </div>
          <Link href={`/?store=${storeIdFromUrl}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
        </div>

        {/* SELECT SUPPLIER */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>ΕΠΙΛΟΓΗ ΠΡΟΜΗΘΕΥΤΗ</label>
          <select 
            value={selectedSupplierId} 
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            style={selectStyle}
          >
            <option value="all">📊 ΟΛΟΙ ΟΙ ΠΡΟΜΗΘΕΥΤΕΣ</option>
            {data.map(s => (
              <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* TOTAL DEBT CARD */}
        <div style={totalCardStyle}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#fed7aa', letterSpacing: '1px' }}>
            {selectedSupplierId === 'all' ? 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ' : 'ΥΠΟΛΟΙΠΟ ΠΡΟΜΗΘΕΥΤΗ'}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
            {totalDebtDisplay.toFixed(2)}€
          </p>
        </div>

        {/* LIST AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ΛΙΣΤΑ ΥΠΟΛΟΙΠΩΝ ({filteredData.length})
          </p>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
               <div style={spinnerStyle}></div>
               <p style={{ color: colors.secondaryText, fontWeight: '600', marginTop: '15px' }}>Υπολογισμός...</p>
            </div>
          ) : filteredData.length > 0 ? (
            filteredData.map(s => (
              <div key={s.id} style={supplierCardStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '800', margin: 0, fontSize: '16px', color: colors.primaryDark }}>{s.name.toUpperCase()}</p>
                  <span style={badgeStyle}>{s.category || 'Εμπορεύματα'}</span>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                    <button 
                      onClick={() => router.push(`/suppliers?store=${storeIdFromUrl}&edit=${s.id}`)} 
                      style={editBtnSmall}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteDebt(s.id, s.name)} 
                      style={delBtnSmall}
                    >
                      <Trash2 size={12} /> Μηδενισμός
                    </button>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: '900', fontSize: '20px', color: s.balance > 0 ? colors.accentOrange : colors.accentBlue, margin: 0 }}>
                    {s.balance.toFixed(2)}€
                  </p>
                  <button 
                    onClick={() => router.push(`/expenses/add?store=${storeIdFromUrl}&supId=${s.id}&mode=debt`)}
                    style={payBtnStyle}
                  >
                    <CreditCard size={12} /> ΕΞΟΦΛΗΣΗ
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
              <p style={{ fontWeight: '800', color: colors.primaryDark, margin: 0 }}>Δεν υπάρχουν εκκρεμότητες</p>
              <p style={{ fontSize: '12px', color: colors.secondaryText, marginTop: '5px' }}>Όλα τα υπόλοιπα είναι μηδενικά.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', position: 'relative' };
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#fff7ed', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, backgroundColor: colors.white, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: `1px solid ${colors.border}` };
const totalCardStyle: any = { backgroundColor: colors.primaryDark, padding: '35px 20px', borderRadius: '28px', marginBottom: '30px', textAlign: 'center', color: 'white', boxShadow: '0 15px 30px rgba(30, 41, 59, 0.15)' };
const supplierCardStyle: any = { backgroundColor: colors.white, padding: '20px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', border: `1px solid ${colors.border}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const payBtnStyle: any = { backgroundColor: colors.accentBlue, color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', color: colors.secondaryText, padding: '5px 10px', borderRadius: '8px', marginTop: '8px', display: 'inline-block', textTransform: 'uppercase' };
const emptyStateStyle: any = { textAlign: 'center', padding: '60px 20px', background: colors.white, borderRadius: '28px', border: `2px dashed ${colors.border}` };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: colors.secondaryText, marginBottom: '8px', display: 'block', letterSpacing: '0.5px' };
const selectStyle: any = { width: '100%', padding: '16px', borderRadius: '16px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.white, outline: 'none', color: colors.primaryDark, appearance: 'none' };
const editBtnSmall: any = { background: '#f8fafc', color: colors.primaryDark, border: `1px solid ${colors.border}`, padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' };
const delBtnSmall: any = { ...editBtnSmall, background: '#fff1f2', color: colors.accentRed, border: '1px solid #fecdd3' };
const spinnerStyle: any = { width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid #f97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' };

export default function SuppliersBalancePage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>}>
        <BalancesContent />
      </Suspense>
    </main>
  )
}