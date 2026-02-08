'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PermissionsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminAndFetchUsers()
  }, [])

  async function checkAdminAndFetchUsers() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Έλεγχος αν ο τρέχων χρήστης είναι όντως admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        alert("Δεν έχετε πρόσβαση σε αυτή τη σελίδα!")
        router.push('/')
        return
      }
      
      setIsAdmin(true)
      fetchUsers()
    }
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true })
    if (data) setUsers(data)
    setLoading(false)
  }

  async function updateField(userId: string, field: string, newValue: any) {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue })
      .eq('id', userId)
    
    if (!error) {
      fetchUsers()
    } else {
      alert("Σφάλμα ενημέρωσης: " + error.message)
    }
  }

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Προστατευμένη σύνδεση...</div>

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>🔐 Δικαιώματα</h2>
        </div>

        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
          Επιλέξτε τι επιτρέπεται να βλέπει και να κάνει ο κάθε χρήστης στο σύστημα.
        </p>

        {users.map(u => (
          <div key={u.id} style={userCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <span style={{ fontWeight: '900', fontSize: '16px', color: '#0f172a' }}>
                  {u.username || 'Χωρίς Όνομα'}
                </span>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>ID: {u.id.slice(0,8)}...</div>
              </div>
              
              {/* ΑΛΛΑΓΗ ΡΟΛΟΥ */}
              <select 
                value={u.role} 
                onChange={(e) => updateField(u.id, 'role', e.target.value)}
                style={{...roleSelect, backgroundColor: u.role === 'admin' ? '#0f172a' : '#f1f5f9', color: u.role === 'admin' ? 'white' : '#475569'}}
              >
                <option value="user">USER</option>
                <option value="admin">ADMIN</option>
              </select>
            </div>

            <div style={divider} />

            {/* TOGGLE: ΑΝΑΛΥΣΗ */}
            <div style={toggleRow}>
              <div>
                <div style={permTitle}>📊 Πρόσβαση στην Ανάλυση</div>
                <div style={permSub}>Τζίροι, ποσοστά και κέρδη</div>
              </div>
              <button onClick={() => updateField(u.id, 'can_view_analysis', !u.can_view_analysis)} 
                      style={{...toggleBtn, backgroundColor: u.can_view_analysis ? '#10b981' : '#cbd5e1'}}>
                {u.can_view_analysis ? 'ΝΑΙ' : 'ΟΧΙ'}
              </button>
            </div>

            {/* TOGGLE: ΙΣΤΟΡΙΚΟ */}
            <div style={toggleRow}>
              <div>
                <div style={permTitle}>📜 Προβολή Ιστορικού</div>
                <div style={permSub}>Λίστα κινήσεων στην Αρχική</div>
              </div>
              <button onClick={() => updateField(u.id, 'can_view_history', !u.can_view_history)} 
                      style={{...toggleBtn, backgroundColor: u.can_view_history ? '#10b981' : '#cbd5e1'}}>
                {u.can_view_history ? 'ΝΑΙ' : 'ΟΧΙ'}
              </button>
            </div>

            {/* TOGGLE: ΕΠΕΞΕΡΓΑΣΙΑ (Προαιρετικό) */}
            <div style={toggleRow}>
              <div>
                <div style={permTitle}>✏️ Επεξεργασία/Διαγραφή</div>
                <div style={permSub}>Δυνατότητα αλλαγής κινήσεων</div>
              </div>
              <button onClick={() => updateField(u.id, 'can_edit_transactions', !u.can_edit_transactions)} 
                      style={{...toggleBtn, backgroundColor: u.can_edit_transactions ? '#10b981' : '#cbd5e1'}}>
                {u.can_edit_transactions ? 'ΝΑΙ' : 'ΟΧΙ'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

// STYLES
const userCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', marginBottom: '15px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const toggleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' };
const permTitle = { fontSize: '13px', fontWeight: '800', color: '#334155' };
const permSub = { fontSize: '10px', color: '#94a3b8' };
const toggleBtn = { border: 'none', color: 'white', padding: '6px 14px', borderRadius: '10px', fontWeight: '900', fontSize: '11px', cursor: 'pointer', transition: '0.2s', width: '60px' };
const roleSelect = { border: 'none', padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', outline: 'none' };
const divider = { height: '1px', backgroundColor: '#f1f5f9', margin: '5px 0 10px 0' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '20px' };