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

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/fixed-assets" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b' }}>←</Link>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>{assetName}</h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>ΙΣΤΟΡΙΚΟ ΠΛΗΡΩΜΩΝ</p>
          </div>
        </div>

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
             <p style={{ textAlign: 'center', color: '#64748b' }}>Φόρτωση...</p>
          ) : history.length > 0 ? history.map(item => (
            <div key={item.id} style={historyCard}>
              <div>
                <div style={{ fontWeight: '800', color: '#1e293b' }}>
                  {new Date(item.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginTop: '2px' }}>
                  ΠΛΗΡΩΜΗ ΜΕΣΩ: {item.method.toUpperCase()}
                </div>
              </div>
              <div style={{ fontWeight: '900', color: '#ef4444', fontSize: '16px' }}>
                -{Number(item.amount).toFixed(2)}€
              </div>
            </div>
          )) : (
            <div style={{ textAlign: 'center', marginTop: '50px', color: '#94a3b8' }}>
              Δεν βρέθηκαν πληρωμές για αυτό το πάγιο.
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

const historyCard = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  padding: '16px', 
  backgroundColor: 'white', 
  borderRadius: '16px', 
  border: '1px solid #f1f5f9' 
};