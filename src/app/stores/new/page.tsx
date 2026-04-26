'use client'
import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { Home, ArrowLeft, Store } from 'lucide-react'

export default function NewStorePage() {
  const supabase = getSupabase()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Παρακαλώ δώστε ένα όνομα');
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Δεν βρέθηκε ενεργή συνεδρία χρήστη.');

      const payload = {
        name: name.trim().toUpperCase(),
      }

      console.log('[create-store] current auth user id:', session.user.id)
      console.log('[create-store] insert payload:', {
        ...payload,
        owner_id: session.user.id,
      })

      const response = await fetch('/api/stores/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Supabase-Auth': session.access_token,
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.ok) {
        console.error('[create-store] full Supabase error object:', result?.debug || result)
        throw new Error(result?.error || 'Κάτι πήγε στραβά κατά τη δημιουργία καταστήματος.')
      }

      toast.success('Το κατάστημα δημιουργήθηκε με επιτυχία!');
      
      // Καθαρίζουμε το localStorage για να αναγκάσουμε τον χρήστη να επιλέξει το νέο μαγαζί
      localStorage.removeItem('active_store_id');
      
      // Μικρή καθυστέρηση για να προλάβει το Trigger να ολοκληρώσει τις εγγραφές
      setTimeout(() => router.push('/select-store'), 1000);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Κάτι πήγε στραβά');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={containerStyle}>
      <Toaster richColors position="top-center" />
      
      <div style={cardStyle}>
        <div style={iconContainer}>
          <Store size={32} color="#1e293b" />
        </div>
        
        <h1 style={titleStyle}>Νέο Κατάστημα</h1>
        <p style={descStyle}>Δημιουργήστε έναν νέο χώρο διαχείρισης για την επιχείρησή σας.</p>

        <form onSubmit={handleCreate} style={{ marginTop: '25px' }}>
          <label htmlFor="store-name">ΟΝΟΜΑ ΚΑΤΑΣΤΗΜΑΤΟΣ</label>
          <input 
            id="store-name"
            autoFocus
            placeholder="π.χ. COSY CAFE 2"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={loading}
          />
          
          <button 
            type="submit"
            disabled={loading}
            style={submitBtnStyle}
          >
            {loading ? 'ΔΗΜΙΟΥΡΓΙΑ...' : 'ΕΠΙΒΕΒΑΙΩΣΗ'}
          </button>
        </form>

        <button 
          onClick={() => router.push('/select-store')} 
          style={cancelBtnStyle}
          disabled={loading}
        >
          <ArrowLeft size={16} /> Επιστροφή στην επιλογή
        </button>
      </div>
    </div>
  )
}

// --- STYLES (ΙΔΙΑ ΜΕ ΠΡΙΝ) ---
const containerStyle: any = { 
  padding: '40px 20px', 
  backgroundColor: '#f8fafc', 
  minHeight: '100dvh', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center' 
};

const cardStyle: any = { 
  backgroundColor: 'white', 
  padding: '30px', 
  borderRadius: '24px', 
  boxShadow: '0 10px 25px rgba(0,0,0,0.05)', 
  width: '100%', 
  maxWidth: '400px',
  textAlign: 'center'
};

const iconContainer: any = {
  width: '64px',
  height: '64px',
  backgroundColor: '#f1f5f9',
  borderRadius: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 20px'
};

const titleStyle: any = { 
  fontSize: '24px', 
  fontWeight: '800', 
  color: '#1e293b',
  margin: '0 0 8px 0'
};

const descStyle: any = {
  fontSize: '14px',
  color: '#64748b',
  fontWeight: '500',
  lineHeight: '1.5'
};

const submitBtnStyle: any = { 
  width: '100%', 
  padding: '16px', 
  backgroundColor: '#1e293b', 
  color: 'white', 
  borderRadius: '12px', 
  fontWeight: '700', 
  border: 'none', 
  marginTop: '10px',
  cursor: 'pointer'
};

const cancelBtnStyle: any = { 
  width: '100%', 
  marginTop: '20px', 
  color: '#64748b', 
  background: 'none', 
  border: 'none', 
  fontWeight: '700', 
  fontSize: '13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer'
};