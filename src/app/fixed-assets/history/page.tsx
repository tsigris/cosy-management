'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, History, Trash2, Calendar, Receipt } from 'lucide-react'
import { toast, Toaster } from 'sonner'

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1'
}

// Βοηθητική συνάρτηση ελέγχου UUID
const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Σημείωση: Το regex για UUIDv4 είναι ελαφρώς διαφορετικό, αλλά αυτό καλύπτει τα βασικά
  const simpleRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && simpleRegex.test(id);
}

function HistoryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Λήψη παραμέτρων από το URL
  const storeId = searchParams.get('store')
  const assetId = searchParams.get('id')
  const assetName = searchParams.get('name') || 'Πάγιο'

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    // Έλεγχος αν έχουμε έγκυρα IDs
    if (!storeId || !isValidUUID(storeId) || !assetId || !isValidUUID(assetId)) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', storeId)
        .eq('fixed_asset_id', assetId)
        .order('date', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (err: any) {
      console.error(err)
      toast.error('Σφάλμα φόρτωσης ιστορικού')
    } finally {
      setLoading(false)
    }
  }, [storeId, assetId])

  useEffect(() => {
    if (!storeId || !isValidUUID(storeId) || !assetId || !isValidUUID(assetId)) {
      toast.error('Λείπουν στοιχεία αναγνώρισης')
      router.replace(storeId ? `/fixed-assets?store=${storeId}` : '/select-store')
    } else {
      fetchHistory()
    }
  }, [fetchHistory, storeId, assetId, router])

  const handleDelete = async (txId: string) => {
    if (!confirm('Διαγραφή αυτής της πληρωμής;')) return
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txId)
      if (error) throw error
      toast.success('Η πληρωμή διαγράφηκε')
      fetchHistory()
    } catch (err) {
      toast.error('Σφάλμα κατά τη διαγραφή')
    }
  }

  const totalSpent = transactions.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: colors.secondary }}>Φόρτωση ιστορικού...</div>

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />

      {/* HEADER */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBox}><History size={22} color="white" /></div>
          <div>
            <h1 style={titleStyle}>{assetName.toUpperCase()}</h1>
            <p style={subtitleStyle}>ΙΣΤΟΡΙΚΟ ΠΛΗΡΩΜΩΝ</p>
          </div>
        </div>
        <Link href={`/fixed-assets?store=${storeId}`} style={backBtn}>
          <ChevronLeft size={24} />
        </Link>
      </header>

      {/* SUMMARY CARD */}
      <div style={summaryCard}>
        <span style={summaryLabel}>ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ</span>
        <h2 style={summaryAmount}>-{totalSpent.toFixed(2)}€</h2>
      </div>

      {/* TRANSACTIONS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {transactions.length === 0 ? (
          <div style={emptyState}>Δεν βρέθηκαν πληρωμές για αυτό το πάγιο.</div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} style={txCard}>
              <div style={{ flex: 1 }}>
                <div style={dateRow}>
                  <Calendar size={14} />
                  {new Date(tx.date).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={amountStyle}>-{Math.abs(tx.amount).toFixed(2)}€</div>
                {tx.notes && <div style={notesStyle}>{tx.notes}</div>}
                <div style={methodBadge}>{tx.method || 'Μετρητά'}</div>
              </div>
              <button onClick={() => handleDelete(tx.id)} style={deleteBtn}>
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// STYLES
const containerStyle: any = { maxWidth: '500px', margin: '0 auto', padding: '20px', minHeight: '100vh', backgroundColor: colors.background };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const logoBox: any = { width: '45px', height: '45px', backgroundColor: colors.indigo, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const titleStyle: any = { fontSize: '18px', fontWeight: '800', color: colors.primary, margin: 0 };
const subtitleStyle: any = { fontSize: '10px', color: colors.secondary, fontWeight: '700', margin: 0, letterSpacing: '1px' };
const backBtn: any = { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: '12px', border: `1px solid ${colors.border}`, color: colors.primary };
const summaryCard: any = { backgroundColor: colors.primary, padding: '20px', borderRadius: '20px', marginBottom: '25px', color: 'white', textAlign: 'center', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.1)' };
const summaryLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.7, letterSpacing: '1px' };
const summaryAmount: any = { fontSize: '32px', fontWeight: '900', margin: '5px 0 0 0' };
const txCard: any = { backgroundColor: colors.surface, padding: '16px', borderRadius: '18px', border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: '15px' };
const dateRow: any = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.secondary, fontWeight: '700', marginBottom: '5px' };
const amountStyle: any = { fontSize: '18px', fontWeight: '800', color: colors.danger };
const notesStyle: any = { fontSize: '12px', color: colors.primary, marginTop: '4px', fontStyle: 'italic' };
const methodBadge: any = { display: 'inline-block', marginTop: '8px', padding: '3px 8px', backgroundColor: colors.background, borderRadius: '6px', fontSize: '10px', fontWeight: '800', color: colors.secondary, border: `1px solid ${colors.border}` };
const deleteBtn: any = { padding: '10px', color: colors.danger, backgroundColor: '#fff1f2', border: 'none', borderRadius: '12px', cursor: 'pointer' };
const emptyState: any = { textAlign: 'center', padding: '40px', color: colors.secondary, fontSize: '14px', fontWeight: '600' };

export default function FixedAssetHistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  )
}