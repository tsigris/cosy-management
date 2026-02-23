'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Plus, X, CreditCard, History } from 'lucide-react'
import { toast, Toaster } from 'sonner'

type FixedAsset = {
  id: string
  name: string
  store_id: string
}

function FixedAssetsContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')
  const supabase = useMemo(() => getSupabase(), [])

  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!storeId || storeId === 'null') {
      setAssets([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('id, name, store_id')
        .eq('store_id', storeId)
        .order('name')

      if (error) throw error
      setAssets((data ?? []) as FixedAsset[])
    } catch (err) {
      console.error(err)
      toast.error('Αποτυχία φόρτωσης παγίων.')
    } finally {
      setLoading(false)
    }
  }, [storeId, supabase])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleSave = async () => {
    const currentStoreId = storeId
    if (!currentStoreId || currentStoreId === 'null') {
      toast.error('Σφάλμα: Λείπει το ID καταστήματος.')
      return
    }

    if (!name.trim()) {
      toast.error('Δώστε ένα όνομα')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('fixed_assets').insert([
        {
          name: name.trim().toUpperCase(),
          store_id: currentStoreId,
        },
      ])

      if (error) throw error

      toast.success('Αποθηκεύτηκε!')
      setName('')
      setIsFormOpen(false)
      await fetchData()
    } catch (err: any) {
      toast.error('Αποτυχία: ' + (err?.message || 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (assetId: string) => {
    const activeStoreId = storeId
    if (!activeStoreId || activeStoreId === 'null') {
      toast.error('Σφάλμα: Λείπει το ID καταστήματος.')
      return
    }

    try {
      const { error } = await supabase
        .from('fixed_assets')
        .delete()
        .eq('id', assetId)
        .eq('store_id', activeStoreId)

      if (error) throw error

      toast.success('Διαγράφηκε')
      await fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Αποτυχία διαγραφής')
    }
  }

  return (
    <div
      style={{
        maxWidth: '500px',
        margin: '0 auto',
        padding: '20px',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
      }}
    >
      <Toaster position="top-center" richColors />

      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          paddingTop: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '45px',
              height: '45px',
              backgroundColor: '#0f172a',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            🔌
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Πάγια</h1>
        </div>

        <Link href={storeId ? `/?store=${storeId}` : '/'} style={{ color: '#64748b' }}>
          <X size={20} />
        </Link>
      </header>

      <button onClick={() => setIsFormOpen((v) => !v)} style={addBtnStyle}>
        {isFormOpen ? (
          'ΑΚΥΡΩΣΗ'
        ) : (
          <>
            <Plus size={18} /> ΝΕΟ ΠΑΓΙΟ
          </>
        )}
      </button>

      {isFormOpen && (
        <div style={formCardStyle}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Όνομα π.χ. ΔΕΗ"
            autoFocus
          />
          <button onClick={handleSave} disabled={isSaving} style={saveBtnStyle}>
            {isSaving ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ'}
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {loading ? (
          <p style={{ textAlign: 'center' }}>Φόρτωση...</p>
        ) : !storeId || storeId === 'null' ? (
          <div style={emptyCardStyle}>
            <p>Λείπει το store στο URL.</p>
          </div>
        ) : assets.length === 0 ? (
          <div style={emptyCardStyle}>
            <p>Η λίστα είναι κενή.</p>
          </div>
        ) : (
          assets.map((asset) => (
            <div key={asset.id} style={assetCardStyle}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 5px 0' }}>{asset.name}</h3>

                <Link href={`/add-expense?store=${storeId}&assetId=${asset.id}`} style={payLinkStyle}>
                  <CreditCard size={14} /> ΠΛΗΡΩΜΗ →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link
                  href={`/fixed-assets/history?store=${storeId}&id=${asset.id}&name=${encodeURIComponent(
                    asset.name
                  )}`}
                  style={{ color: '#6366f1' }}
                >
                  <History size={18} />
                </Link>

                <button
                  onClick={async () => {
                    if (confirm('Διαγραφή;')) await handleDelete(asset.id)
                  }}
                  style={delBtnStyle}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const addBtnStyle: any = {
  width: '100%',
  padding: '16px',
  backgroundColor: '#0f172a',
  color: 'white',
  border: 'none',
  borderRadius: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}
const formCardStyle: any = {
  marginTop: '15px',
  padding: '15px',
  backgroundColor: 'white',
  borderRadius: '15px',
  border: '1px solid #e2e8f0',
}
const inputStyle: any = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  marginBottom: '10px',
  boxSizing: 'border-box',
  fontWeight: 'bold',
}
const saveBtnStyle: any = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#10b981',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontWeight: 'bold',
  cursor: 'pointer',
}
const assetCardStyle: any = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '15px',
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  marginBottom: '10px',
}
const payLinkStyle: any = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#10b981',
  textDecoration: 'none',
}
const delBtnStyle: any = { background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }
const emptyCardStyle: any = {
  textAlign: 'center',
  padding: '40px',
  backgroundColor: 'white',
  borderRadius: '15px',
  color: '#64748b',
  border: '1px dashed #cbd5e1',
}

export default function FixedAssetsPage() {
  return (
    <Suspense fallback={null}>
      <FixedAssetsContent />
    </Suspense>
  )
}