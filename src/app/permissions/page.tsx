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

      // ΕΛΕΓΧΟΣ: Είσαι Admin;
      const { data: access, error: accessError } = await supabase
        .from('store_access')
        .select('role')
        .eq('user_id', user.id)
        .eq('store_id', activeStoreId)
        .maybeSingle()

      if (accessError || !access || access.role !== 'admin') {
        alert("Δεν έχετε δικαιώματα διαχειριστή!");
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
      setLoading(true)
      // ΒΗΜΑ 1: Παίρνουμε όλες τις εγγραφές πρόσβασης για το κατάστημα
      const { data: accessData, error: accessError } = await supabase
        .from('store_access')
        .select('*')
        .eq('store_id', sId)
        .order('role', { ascending: true })

      if (accessError) throw accessError

      // ΒΗΜΑ 2: Για κάθε χρήστη, παίρνουμε το προφίλ του χειροκίνητα (παράκαμψη Join Error)
      const formattedUsers = await Promise.all((accessData || []).map(async (entry: any) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, email')
          .eq('id', entry.user_id)
          .maybeSingle()

        return {
          id: entry.user_id,
          email: profile?.email || 'cosystgeorge@gmail.com',
          username: profile?.username || 'ADMIN',
          role: entry.role,
          can_view_analysis: entry.can_view_analysis,
          can_view_history: entry.can_view_history,
          can_edit_transactions: entry.can_edit_transactions
        }
      }))

      setUsers(formattedUsers)
    } catch (err: any) {
      console.error('Fetch Error:', err)
      toast.error('Σφάλμα συγχρονισμού: ' + err.message)
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
    
    if (confirm('Θέλετε σίγουρα να αφαιρέσετε αυτόν τον χρήστη;')) {
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
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      
      {/* HEADER */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>🔐</div>
          <div>
            <h1 style={titleStyle}>Δικαιώματα</h1>
            <p style={subtitleStyle}>ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΒΑΣΗΣ & ΡΟΛΟΙ</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {loading ? (
        <div style={loadingTextStyle}>Φόρτωση χρηστών...</div>
      ) : (
        <>
          {/* SECTION: ADMINS */}
          <p style={sectionLabelStyle}>ΔΙΑΧΕΙΡΙΣΤΕΣ ({admins.length})</p>
          {admins.map(u => (
            <div key={u.id} style={adminCardStyle}>
              <div style={{ flex: 1 }}>
                <p style={adminNameStyle}>
                  {u.username?.toUpperCase()} {u.id === myId ? '(ΕΣΕΙΣ)' : ''}
                </p>
                <p style={adminEmailStyle}>{u.email}</p>
              </div>
              <span style={adminBadgeStyle}>FULL ACCESS</span>
            </div>
          ))}

          <div style={{ height: '30px' }} />

          {/* SECTION: STAFF */}
          <p style={sectionLabelStyle}>ΠΡΟΣΩΠΙΚΟ ({staff.length})</p>
          {staff.map(u => (
            <div key={u.id} style={userCardStyle}>
              <div style={userCardHeaderStyle}>
                <div>
                  <p style={userNameStyle}>{u.username}</p>
                  <p style={userEmailStyle}>{u.email}</p>
                </div>
                <button onClick={() => handleDelete(u.id)} style={deleteBtnStyle}>🗑️</button>
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
                style={promoteBtnStyle}
              >
                🆙 ΑΝΑΒΑΘΜΙΣΗ ΣΕ ADMIN
              </button>
            </div>
          ))}

          {staff.length === 0 && (
            <div style={emptyStateStyle}>
              Δεν υπάρχουν άλλοι χρήστες με πρόσβαση.
            </div>
          )}

          <Link href="/admin/invite" style={inviteBtnStyle}>+ ΠΡΟΣΚΛΗΣΗ ΝΕΟΥ ΧΡΗΣΤΗ</Link>
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
        padding: '12px 5px',
        borderRadius: '12px',
        fontSize: '10px',
        fontWeight: '900',
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

// STYLES
const containerStyle: any = { maxWidth: '500px', margin: '0 auto', padding: '20px', paddingBottom: '60px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingTop: '10px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const titleStyle: any = { fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a' };
const subtitleStyle: any = { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '0.5px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#64748b', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 'bold' };
const loadingTextStyle: any = { textAlign: 'center', padding: '50px', fontWeight: '800', color: '#64748b' };
const sectionLabelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#475569', marginBottom: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' };
const adminCardStyle: any = { backgroundColor: '#0f172a', padding: '18px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' };
const adminNameStyle: any = { fontWeight: '900', margin: 0, fontSize: '14px', color: 'white' };
const adminEmailStyle: any = { fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: '600' };
const adminBadgeStyle: any = { color: '#4ade80', fontSize: '9px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px', border: '1px solid #166534' };
const userCardStyle: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '15px' };
const userCardHeaderStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const userNameStyle: any = { fontWeight: '800', margin: 0, fontSize: '15px', color: '#0f172a' };
const userEmailStyle: any = { fontSize: '12px', color: '#64748b', margin: 0, fontWeight: '600' };
const deleteBtnStyle: any = { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' };
const promoteBtnStyle: any = { width: '100%', marginTop: '15px', padding: '12px', borderRadius: '14px', backgroundColor: '#f8fafc', color: '#1e293b', fontSize: '11px', fontWeight: '900', border: '1px solid #e2e8f0', cursor: 'pointer' };
const inviteBtnStyle: any = { display: 'block', textAlign: 'center', marginTop: '30px', padding: '18px', backgroundColor: '#0f172a', color: 'white', borderRadius: '18px', textDecoration: 'none', fontWeight: '900', fontSize: '14px' };
const emptyStateStyle: any = { textAlign: 'center', padding: '40px', border: '2px dashed #cbd5e1', borderRadius: '24px', color: '#64748b', fontSize: '13px', fontWeight: '700' };

export default function PermissionsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Suspense fallback={<div>Συγχρονισμός...</div>}><PermissionsContent /></Suspense>
    </main>
  )
}