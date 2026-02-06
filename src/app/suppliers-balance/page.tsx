'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SuppliersBalance() {
  const [balances, setBalances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBalances()
  }, [])

  async function fetchBalances() {
    setLoading(true)
    const { data: transactions } = await supabase.from('transactions').select('*')
    const { data: suppliers } = await supabase.from('suppliers').select('*')

    if (transactions && suppliers) {
      const calculatedBalances = suppliers.map(supplier => {
        // 1. ΣΥΝΟΛΟ ΤΙΜΟΛΟΓΙΩΝ ΠΟΥ ΠΗΡΑΜΕ ΜΕ ΠΙΣΤΩΣΗ
        const totalInvoices = transactions
          .filter(t => t.supplier_id === supplier.id && t.is_credit === true)
          .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

        // 2. ΣΥΝΟΛΟ ΠΛΗΡΩΜΩΝ ΠΟΥ ΚΑΝΑΜΕ ΓΙΑ ΕΞΟΦΛΗΣΗ ΧΡΕΟΥΣ
        const totalPayments = transactions
          .filter(t => t.supplier_id === supplier.id && t.is_debt_payment === true)
          .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

        return {
          id: supplier.id,
          name: supplier.name,
          debt: totalInvoices - totalPayments
        }
      }).filter(s => s.debt !== 0) // Εμφάνιση μόνο όσων έχουν υπόλοιπο

      setBalances(calculatedBalances)
    }
    setLoading(false)
  }

  const totalDebt = balances.reduce((acc, curr) => acc + curr.debt, 0)

  return (
    <main className="bg-[#f0f2f5] min-h-screen font-sans p-4">
      <div className="max-w-md mx-auto">
        
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-blue-600 font-bold bg-white px-4 py-2 rounded-xl shadow-sm text-[11px] uppercase">🏠 Αρχική</Link>
          <h1 className="text-lg font-black text-gray-800 uppercase tracking-tighter text-right">Καρτέλες<br/>Προμηθευτών</h1>
        </div>

        {/* ΜΕΓΑΛΗ ΚΑΡΤΑ ΣΥΝΟΛΟΥ */}
        <div className="bg-orange-500 p-8 rounded-[35px] shadow-xl mb-6 text-center border-b-8 border-orange-600">
          <p className="text-orange-100 uppercase text-[10px] font-black tracking-widest mb-2 opacity-80">ΣΥΝΟΛΙΚΟ ΑΝΕΞΟΦΛΗΤΟ ΥΠΟΛΟΙΠΟ</p>
          <h2 className="text-5xl font-black text-white drop-shadow-md">{totalDebt.toFixed(2)}€</h2>
        </div>

        {/* ΛΙΣΤΑ ΠΡΟΜΗΘΕΥΤΩΝ */}
        <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-4 mb-2">
             <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Προμηθευτής</span>
             <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Οφειλή</span>
          </div>
          
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin inline-block w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
              <p className="text-gray-400 font-bold text-[10px] uppercase">Υπολογισμός...</p>
            </div>
          ) : balances.length > 0 ? (
            balances.map((s, i) => (
              <div key={i} className="flex justify-between items-center py-3 group">
                <div className="flex flex-col">
                  <span className="font-black text-gray-800 uppercase text-[12px] tracking-tight">{s.name}</span>
                  <span className="text-[9px] text-gray-400 uppercase font-bold">Καθαρό Υπόλοιπο</span>
                </div>
                <div className="bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100">
                  <span className="font-black text-orange-600 text-base">{s.debt.toFixed(2)}€</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-300 font-bold uppercase text-[10px] tracking-widest">Όλα εξοφλημένα!</p>
            </div>
          )}
        </div>

        <button 
          onClick={fetchBalances} 
          className="w-full mt-8 py-4 bg-white rounded-2xl border border-gray-200 text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] shadow-sm active:bg-gray-50 transition-all"
        >
          🔄 Ανανέωση Δεδομένων
        </button>
      </div>
    </main>
  )
}