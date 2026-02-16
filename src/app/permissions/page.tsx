'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'

function PermissionsContent() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => {
    checkAdminAndFetchUsers()
  }, [])

  async function checkAdminAndFetchUsers() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setMyId(user.id)
      
      const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null;
      
      if (!activeStoreId) {
        toast.error("Δεν βρέθηκε επιλεγμένο κατάστημα.")
        router.push('/')
        return
      }

      setStoreId(activeStoreId)

      // ΕΛΕΓΧΟΣ ΡΟΛΟΥ: Επιβεβαιώνουμε ότι ο χρήστης είναι Admin
      const { data: access, error: accessError } = await supabase
        .from('store_access')
        .select('role')
        .eq('user_id', user.id)
        .eq('store_id', activeStoreId)
        .maybeSingle()

      if (accessError || !access || access.role !== 'admin') {
        alert("Δεν έχετε δικαιώματα διαχειριστή για αυτό το κατάστημα!")
        router.push('/')
        return
      }

      fetchUsers(activeStoreId)
    } catch (err) { 
      console.error(err)
      setLoading(false)
    }
  }

  async function fetchUsers(sId: string) {
    try {
      // ΔΙΟΡΘΩΣΗ: Χρήση του ρητού Foreign Key για το Join με τον πίνακα profiles
      const { data, error } = await supabase
        .from('store_access')
        .select(`
          user_id, 
          role, 
          can_view_analysis, 
          can_view_history, 
          can_edit_transactions, 
          profiles!store_access_user_id_fkey (id, username, email)
        `)
        .eq('store_id', sId)
        .order('role', { ascending: true })

      if (error) throw error

      const formattedUsers = (data || []).map((entry: any) => {
        // Διαχείριση των δεδομένων προφίλ (fallback αν λείπουν στοιχεία)
        const profile = entry.profiles;
        return {
          id: entry.user_id,
          email: profile?.email || 'cosystgeorge@gmail.com',
          username: profile?.username || 'ADMIN',
          role: entry.role,
          can_view_analysis: entry.can_view_analysis,
          can_view_history: entry.can_view_history,
          can_edit_transactions: entry.can_edit_transactions
        }
      })

      setUsers(formattedUsers)
    } catch (err: any) {
      console.error('FetchUsers Error:', err)
      toast.error('Σφάλμα φόρτωσης: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateField(userId: string, field: string, newValue: any) {
    if (userId === myId && field === 'role' && newValue !== 'admin') {
      alert("Δεν μπορείτε να υποβαθμίσετε τον εαυτό σας!");
      return;
    }

    try {
      const { error } = await supabase
        .from('store_access')
        .update({ [field]: newValue })
        .eq('user_id', userId)
        .eq('store_id', storeId);

      if (error) throw error;
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: newValue } : u));
      toast.success("Η αλλαγή αποθηκεύτηκε");
    } catch (error: any) {
      alert("Σφάλμα: " + error.message);
    }
  }

  async function handleDelete(userId: string) {
    if (userId === myId) return alert("Δεν μπορείτε να διαγράψετε τον εαυτό σας!");
    
    if (confirm('Θέλετε σίγουρα να αφαιρέσετε αυτόν τον χρήστη από το κατάστημα;')) {
      const { error } = await supabase
        .from('store_access')
        .delete()
        .eq('user_id', userId)
        .eq('store_id', storeId);
      
      if (!error) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        toast.success("Ο χρήστης αφαιρέθηκε");
      }
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const staff = users.filter(u => u.role !== 'admin')

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '50px' }}>
      <Toaster position="top-center" richColors />
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>🔐</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a' }}>Δικαιώματα</h1>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800' }}>ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΒΑΣΗΣ</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', fontWeight: 'bold', color: '#64748b' }}>Συγχρονισμός χρηστών...</div>
      ) : (
        <>
          {/* SECTION: ADMINS */}
          <p style={sectionLabel}>ΔΙΑΧΕΙΡΙΣΤΕΣ ({admins.length})</p>
          {admins.map(u => (
            <div key={u.id} style={adminCard}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '900', margin: 0, fontSize: '14px', color: 'white' }}>
                  {u.username?.toUpperCase()} {u.id === myId ? '(ΕΣΕΙΣ)' : ''}
                </p>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{u.email}</p>
              </div>
              <span style={adminBadge}>FULL ACCESS</span>
            </div>
          ))}

          <div style={{ height: '20px' }} />

          {/* SECTION: STAFF */}
          <p style={sectionLabel}>ΠΡΟΣΩΠΙΚΟ ({staff.length})</p>
          {staff.map(u => (
            <div key={u.id} style={userCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontWeight: '800', margin: 0, fontSize: '15px' }}>{u.username}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{u.email}</p>
                </div>
                <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>🗑️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <PermissionToggle 
                  label="📊 Ανάλυση" 
                  active={u.can_view_analysis} 
                  onClick={() => updateField(u.id, 'can_view_analysis', !u.can_view_analysis)} 
                />
                <PermissionToggle 
                  label="📜 Ιστορικό" 
                  active={u.can_view_history} 
                  onClick={() => updateField(u.id, 'can_view_history', !u.can_view_history)} 
                />
                <PermissionToggle 
                  label="✏️ Edit" 
                  active={u.can_edit_transactions} 
                  onClick={() => updateField(u.id, 'can_edit_transactions', !u.can_edit_transactions)} 
                />
              </div>
              
              <button 
                onClick={() => updateField(u.id, 'role', 'admin')}
                style={promoteBtn}
              >
                🆙 ΑΝΑΒΑΘΜΙΣΗ ΣΕ ADMIN
              </button>
            </div>
          ))}

          {staff.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', border: '2px dashed #e2e8f0', borderRadius: '20px', color: '#64748b', fontSize: '13px', fontWeight: '600' }}>
              Δεν υπάρχουν άλλοι χρήστες με πρόσβαση.
            </div>
          )}

          <Link href="/admin/invite" style={inviteBtn}>+ ΠΡΟΣΚΛΗΣΗ ΝΕΟΥ ΧΡΗΣΤΗ</Link>
        </>
      )}
    </div>
  )
}

function PermissionToggle({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 5px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: '800',
        cursor: 'pointer',
        border: '1px solid',
        transition: '0.2s',
        backgroundColor: active ? '#dcfce7' : '#f8fafc',
        color: active ? '#166534' : '#64748b',
        borderColor: active ? '#166534' : '#e2e8f0'
      }}
    >
      {label}
    </button>
  )
}

const logoBoxStyle: any = { width: '40px', height: '40px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#64748b', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold' };
const sectionLabel: any = { fontSize: '10px', fontWeight: '900', color: '#475569', marginBottom: '10px', letterSpacing: '0.5px' };
const adminCard: any = { backgroundColor: '#0f172a', padding: '15px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
const adminBadge: any = { color: '#4ade80', fontSize: '9px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px', border: '1px solid #166534' };
const userCard: any = { backgroundColor: 'white', padding: '18px', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '12px' };
const promoteBtn: any = { width: '100%', marginTop: '12px', padding: '10px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#1e293b', fontSize: '10px', fontWeight: '800', border: '1px solid #e2e8f0', cursor: 'pointer' };
const inviteBtn: any = { display: 'block', textAlign: 'center', marginTop: '25px', padding: '16px', backgroundColor: '#0f172a', color: 'white', borderRadius: '15px', textDecoration: 'none', fontWeight: '800', fontSize: '13px' };

export default function PermissionsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><PermissionsContent /></Suspense>
    </main>
  )
}