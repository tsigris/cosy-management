'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { getSupabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Αν δεν υπάρχει session (π.χ. άνοιξε το link σε άλλο browser), θα δείξει error ούτως ή άλλως.
  }, [])

  const handleSave = async () => {
    if (!pw1.trim() || pw1.trim().length < 6) return toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.')
    if (pw1 !== pw2) return toast.error('Οι κωδικοί δεν ταιριάζουν.')

    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch (err: any) {
      toast.error('Σφάλμα: Λείπουν env variables της Supabase στο Vercel.')
      console.error(err)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1.trim() })
      if (error) throw error

      toast.success('Ο κωδικός άλλαξε! Συνδέσου ξανά.')
      await new Promise((r) => setTimeout(r, 400))
      router.replace('/login')
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αλλαγής κωδικού.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f8fafc' }}>
      <Toaster richColors position="top-center" />
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Νέος κωδικός</h1>
        <p style={{ marginTop: 6, marginBottom: 14, color: '#64748b', fontWeight: 700, fontSize: 12 }}>
          Βάλε νέο κωδικό και αποθήκευση.
        </p>

        <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#94a3b8' }}>ΝΕΟΣ ΚΩΔΙΚΟΣ</label>
        <input
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', marginTop: 6 }}
        />

        <label style={{ display: 'block', fontSize: 10, fontWeight: 900, color: '#94a3b8', marginTop: 12 }}>ΕΠΑΝΑΛΗΨΗ</label>
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', marginTop: 6 }}
        />

        <button
          onClick={handleSave}
          disabled={loading}
          style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 900 }}
        >
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ'}
        </button>

        <button
          onClick={() => router.replace('/login')}
          style={{ marginTop: 10, width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 900 }}
        >
          ΠΙΣΩ
        </button>
      </div>
    </main>
  )
}