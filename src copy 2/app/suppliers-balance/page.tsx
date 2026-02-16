'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Receipt, CreditCard, Filter } from 'lucide-react'

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

// Βοηθητική συνάρτηση: Ελέγχει αν ένας κωδικός είναι πραγματικό UUID
const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && regex.test(id);
}

function BalancesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const storeIdFromUrl = searchParams.get('store')

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all')

  const fetchBalances = useCallback(async () => {
    // 1. ΑΥΣΤΗΡΟΣ ΕΛΕΓΧΟΣ: Αν το ID δεν είναι έγκυρο UUID, μην κάνεις τίποτα!
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      console.log("Invalid Store ID detected, skipping fetch.");
      setLoading(true); // Κρατάμε το loading για να μην φανεί άδειο content πριν το redirect
      return; 
    }

    try {
      setLoading(true)
      
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
          .not('supplier_id', 'is', null) // <-- Η ΣΩΣΤΗ ΣΥΝΤΑΞΗ ΓΙΑ "ΟΧΙ NULL"
      ]);

      if (supsRes.error) throw supsRes.error
      if (transRes.error) throw transRes.error

      const suppliers = supsRes.data || []
      const transactions = transRes.data || []

      const balanceList = suppliers.map(s => {
        const sTrans = transactions.filter(t => t.supplier_id === s.id)
        
        const totalCredit = sTrans
          .filter(t => t.is_credit === true)
          .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
        
        const totalPaid = sTrans
          .filter(t => t.type === 'debt_payment')
          .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

        return { 
          ...s, 
          balance: totalCredit - totalPaid 
        }
      })
      .filter(s => Math.abs(s.balance) > 0.1)
      .sort((a, b) => b.balance - a.balance)

      setData(balanceList)
    } catch (err: any) { 
      console.error(err)
      // Δεν δείχνουμε toast για το "invalid input syntax" για να μην τρομάζει ο χρήστης
      if (!err.message.includes("invalid input syntax")) {
        toast.error(`Σφάλμα: ${err.message}`)
      }
    } finally { 
      setLoading(false) 
    }
  }, [storeIdFromUrl])

  // --- ΕΛΕΓΧΟΣ ΑΣΦΑΛΕΙΑΣ & ΚΑΘΑΡΙΣΜΟΣ ---
  useEffect(() => {
    // Αν το ID στο URL είναι "null" ή λάθος, καθάρισε τα πάντα και γύρνα στην επιλογή
    if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('active_store_id'); // Σβήνουμε το "σκουπίδι" null
      }
      router.replace('/select-store');
    } else {
      fetchBalances();
    }
  }, [fetchBalances, storeIdFromUrl, router])

  async function handleDeleteDebt(supplierId: string, supplierName: string) {
    const confirmAction = window.confirm(`Προσοχή! Θέλετε να μηδενίσετε την καρτέλα του προμηθευτή ${supplierName.toUpperCase()};`);
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
          <Link href={isValidUUID(storeIdFromUrl) ? `/?store=${storeIdFromUrl}` : '/select-store'} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </div>

        {/* SELECT SUPPLIER */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{position: 'relative'}}>
            <Filter size={16} style={{position: 'absolute', left: '12px', top: '16px', color: colors.secondaryText}} />
            <select 
              value={selectedSupplierId} 
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              style={selectStyle}
            >
              <option value="all">ΟΛΟΙ ΟΙ ΠΡΟΜΗΘΕΥΤΕΣ</option>
              {data.map(s => (
                <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TOTAL DEBT CARD */}
        <div style={totalCardStyle}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#fed7aa', letterSpacing: '1px' }}>
            {selectedSupplierId === 'all' ? 'ΣΥΝΟΛΙΚΟ ΑΝΟΙΧΤΟ ΥΠΟΛΟΙΠΟ' : 'ΥΠΟΛΟΙΠΟ ΠΡΟΜΗΘΕΥΤΗ'}
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '38px', fontWeight: '900', color: '#ffffff' }}>
            {totalDebtDisplay.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
          </p>
        </div>

        {/* LIST AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: '5px' }}>
            ΛΙΣΤΑ ΟΦΕΙΛΩΝ ({filteredData.length})
          </p>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
               <div style={spinnerStyle}></div>
               <p style={{ color: colors.secondaryText, fontWeight: '600', marginTop: '15px', fontSize: '12px' }}>
                 {!isValidUUID(storeIdFromUrl) ? 'Ανακατεύθυνση...' : 'Υπολογισμός...'}
               </p>
            </div>
          ) : filteredData.length > 0 ? (
            filteredData.map(s => (
              <div key={s.id} style={supplierCardStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: colors.primaryDark }}>{s.name.toUpperCase()}</p>
                  <span style={badgeStyle}>{s.category || 'Γενικό'}</span>
                  
                  <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
                    <button 
                      onClick={() => router.push(`/suppliers?store=${storeIdFromUrl}&edit=${s.id}`)} 
                      style={linkBtnStyle}
                    >
                      ΚΑΡΤΕΛΑ
                    </button>
                    <button 
                      onClick={() => handleDeleteDebt(s.id, s.name)} 
                      style={linkBtnDangerStyle}
                    >
                      ΜΗΔΕΝΙΣΜΟΣ
                    </button>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: '900', fontSize: '18px', color: colors.accentOrange, margin: 0 }}>
                    {s.balance.toFixed(2)}€
                  </p>
                  <button 
                    onClick={() => router.push(`/add-expense?store=${storeIdFromUrl}&supId=${s.id}&mode=debt`)}
                    style={payBtnStyle}
                  >
                    <CreditCard size={14} /> ΕΞΟΦΛΗΣΗ
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
              <p style={{ fontWeight: '800', color: colors.primaryDark, margin: 0 }}>Δεν υπάρχουν εκκρεμότητες</p>
              <p style={{ fontSize: '12px', color: colors.secondaryText, marginTop: '5px' }}>Όλα τα υπόλοιπα είναι τακτοποιημένα.</p>
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
const totalCardStyle: any = { backgroundColor: colors.primaryDark, padding: '30px 20px', borderRadius: '24px', marginBottom: '30px', textAlign: 'center', color: 'white', boxShadow: '0 15px 30px rgba(30, 41, 59, 0.15)' };
const supplierCardStyle: any = { backgroundColor: colors.white, padding: '18px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', border: `1px solid ${colors.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const payBtnStyle: any = { backgroundColor: '#eff6ff', color: colors.accentBlue, border: `1px solid #dbeafe`, padding: '8px 12px', borderRadius: '10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: '#f1f5f9', color: colors.secondaryText, padding: '4px 8px', borderRadius: '6px', marginTop: '6px', display: 'inline-block', textTransform: 'uppercase' };
const emptyStateStyle: any = { textAlign: 'center', padding: '60px 20px', background: colors.white, borderRadius: '24px', border: `2px dashed ${colors.border}` };
const selectStyle: any = { width: '100%', padding: '14px 14px 14px 40px', borderRadius: '14px', border: `1px solid ${colors.border}`, fontSize: '13px', fontWeight: '700', backgroundColor: colors.white, outline: 'none', color: colors.primaryDark, appearance: 'none' };
const linkBtnStyle: any = { background: 'none', border: 'none', padding: 0, fontSize: '10px', fontWeight: '700', color: colors.secondaryText, cursor: 'pointer', textDecoration: 'underline' };
const linkBtnDangerStyle: any = { ...linkBtnStyle, color: colors.accentRed };
const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #f97316', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' };

export default function SuppliersBalancePage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>}>
        <BalancesContent />
      </Suspense>
    </main>
  )
}