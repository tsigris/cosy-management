'use client'
export const dynamic = 'force-dynamic'

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
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => {
    async function loadHistory() {
      if (!assetId) return
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
          if (profile?.store_id) {
            setStoreId(profile.store_id)
            
            // Φέρνουμε τις κινήσεις ΜΟΝΟ για το συγκεκριμένο κατάστημα και πάγιο
            const { data } = await supabase
              .from('transactions')
              .select('*')
              .eq('fixed_asset_id', assetId)
              .eq('store_id', profile.store_id)
              .order('date', { ascending: false })
            
            if (data) setHistory(data)
          }
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    loadHistory()
  }, [assetId])

  const totalSpent = history.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>🔌</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              {assetName?.toUpperCase()}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΙΣΤΟΡΙΚΟ ΠΛΗΡΩΜΩΝ
            </p>
          </div>
        </div>
        <Link href="/fixed-assets" style={backBtnStyle}>✕</Link>
      </div>

      {/* TOTAL SPENT CARD */}
      <div style={totalCardStyle}>
        <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>Συνολική Δαπάνη Παγίου</p>
        <p style={{ margin: '8px 0 0 0', fontSize: '36px', fontWeight: '900', color: '#f87171' }}>
          {totalSpent.toFixed(2)}€
        </p>
      </div>

      {/* LIST SECTION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ανάλυση Κινήσεων ({history.length})</p>
        
        {loading ? (
           <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Φόρτωση κινήσεων...</div>
        ) : history.length > 0 ? (
          history.map(item => (
            <div key={item.id} style={historyCardStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '15px' }}>
                  {new Date(item.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <span style={methodBadgeStyle}>{item.method}</span>
                  <span style={userBadgeStyle}>👤 {item.created_by_name?.split(' ')[0]}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '900', color: '#dc2626', fontSize: '18px' }}>
                  -{Number(item.amount).toFixed(2)}€
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📄</div>
            <p style={{ margin: 0, fontWeight: '900', color: '#1e293b' }}>Καμία καταγραφή</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Δεν έχουν βρεθεί πληρωμές για αυτό το πάγιο.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// STYLES (Fixed with :any for TS)
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const totalCardStyle: any = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '28px', marginBottom: '25px', textAlign: 'center', color: 'white', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const historyCardStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', backgroundColor: 'white', borderRadius: '22px', border: '1px solid #f1f5f9' };
const methodBadgeStyle: any = { fontSize: '9px', fontWeight: '800', color: '#64748b', backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' };
const userBadgeStyle: any = { fontSize: '9px', fontWeight: '800', color: '#2563eb', backgroundColor: '#dbeafe', padding: '3px 8px', borderRadius: '6px' };
const emptyStateStyle: any = { textAlign: 'center', marginTop: '30px', padding: '50px 20px', backgroundColor: 'white', borderRadius: '28px', border: '1px dashed #e2e8f0' };

export default function AssetHistoryPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <HistoryContent />
      </Suspense>
    </main>
  )
}