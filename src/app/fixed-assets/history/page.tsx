'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function HistoryContent() {
  const searchParams = useSearchParams()
  const assetId = searchParams.get('id')
  const assetName = searchParams.get('name')
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      if (!assetId) return
      setLoading(true)
      
      // Προσθήκη RLS check: Φέρνουμε μόνο αν ανήκει στο store του χρήστη
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('fixed_asset_id', assetId)
        .order('date', { ascending: false })
      
      if (data) setHistory(data)
      setLoading(false)
    }
    loadHistory()
  }, [assetId])

  // Υπολογισμός Συνολικού Εξόδου για το συγκεκριμένο πάγιο
  const totalSpent = history.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Link href="/fixed-assets" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b' }}>←</Link>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>{assetName}</h1>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Ιστορικό Πληρωμών</p>
            </div>
          </div>
          {/* Συνολικό Badge */}
          <div style={totalBadge}>
            {totalSpent.toFixed(2)}€
          </div>
        </div>

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
             <p style={{ textAlign: 'center', color: '#64748b', fontWeight: 'bold', marginTop: '20px' }}>Φόρτωση κινήσεων...</p>
          ) : history.length > 0 ? (
            history.map(item => (
              <div key={item.id} style={historyCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '15px' }}>
                    {new Date(item.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <span style={methodBadge}>{item.method}</span>
                    {item.invoice_number && <span style={invoiceBadge}># {item.invoice_number}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '900', color: '#ef4444', fontSize: '17px' }}>
                    -{Number(item.amount).toFixed(2)}€
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={emptyStateStyle}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📄</div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Δεν βρέθηκαν πληρωμές</p>
              <p style={{ margin: 0, fontSize: '13px' }}>Οι πληρωμές που καταχωρείτε θα εμφανίζονται εδώ.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function AssetHistoryPage() {
  return (
    <Suspense fallback={<div style={{padding: '20px', textAlign: 'center'}}>Φόρτωση...</div>}>
      <HistoryContent />
    </Suspense>
  )
}

// STYLES
const historyCard = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  padding: '18px', 
  backgroundColor: 'white', 
  borderRadius: '20px', 
  border: '1px solid #f1f5f9',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const totalBadge = {
  backgroundColor: '#fee2e2',
  color: '#ef4444',
  padding: '8px 14px',
  borderRadius: '12px',
  fontWeight: '900',
  fontSize: '14px'
};

const methodBadge = {
  fontSize: '10px',
  fontWeight: '800',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  padding: '3px 7px',
  borderRadius: '6px',
  textTransform: 'uppercase' as const
};

const invoiceBadge = {
  fontSize: '10px',
  fontWeight: '800',
  color: '#2563eb',
  backgroundColor: '#dbeafe',
  padding: '3px 7px',
  borderRadius: '6px'
};

const emptyStateStyle = {
  textAlign: 'center' as const,
  marginTop: '50px',
  color: '#94a3b8',
  padding: '40px 20px',
  backgroundColor: 'white',
  borderRadius: '24px',
  border: '1px dashed #cbd5e1'
};