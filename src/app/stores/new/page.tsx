'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'

export default function NewStorePage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return toast.error('Δώστε όνομα')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      // 1. Δημιουργία Καταστήματος
      const { data: store, error: sErr } = await supabase
        .from('stores')
        .insert([{ name: name.toUpperCase() }])
        .select().single()
      if (sErr) throw sErr

      // 2. Σύνδεση με τον χρήστη
      const { error: aErr } = await supabase
        .from('store_access')
        .insert([{ user_id: session?.user.id, store_id: store.id }])
      if (aErr) throw aErr

      toast.success('Το κατάστημα δημιουργήθηκε!')
      setTimeout(() => router.push('/select-store'), 1500)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px 20px', backgroundColor: '#f8fafc', minHeight: '100dvh' }}>
      <Toaster richColors position="top-center" />
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>🏠 Νέο Κατάστημα</h1>
        <form onSubmit={handleCreate}>
          <input 
            style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '15px' }}
            placeholder="Όνομα Καταστήματος"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button 
            disabled={loading}
            style={{ width: '100%', padding: '16px', backgroundColor: '#1e293b', color: 'white', borderRadius: '12px', fontWeight: '700', border: 'none' }}
          >
            {loading ? 'ΓΙΝΕΤΑΙ ΔΗΜΙΟΥΡΓΙΑ...' : 'ΔΗΜΙΟΥΡΓΙΑ'}
          </button>
        </form>
        <button onClick={() => router.push('/select-store')} style={{ width: '100%', marginTop: '15px', color: '#64748b', background: 'none', border: 'none', fontWeight: '600' }}>Ακύρωση</button>
      </div>
    </div>
  )
}