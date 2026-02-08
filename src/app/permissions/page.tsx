'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
      
      if (user) {
        setMyId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, store_id')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          alert("Δεν έχετε πρόσβαση σε αυτή τη σελίδα!")
          router.push('/')
          return
        }
        setStoreId(profile.store_id)
        fetchUsers(profile.store_id)
      }
    } catch (err) { console.error(err) }
  }

  async function fetchUsers(sId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('store_id', sId)
      .order('role', { ascending: true })
    
    if (data) setUsers(data)
    setLoading(false)
  }

  async function updateField(userId: string, field: string, newValue: any) {
    if (userId === myId && field === 'role' && newValue !== 'admin') {
      alert("Δεν μπορείτε να αφαιρέσετε τον ρόλο Admin από τον εαυτό σας!");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue })
      .eq('id', userId)
    
    if (!error) {
      fetchUsers(storeId!)
    } else {
      alert("Σφάλμα: " + error.message)
    }
  }

  async function handleDelete(userId: string) {
    if (userId === myId) return alert("Δεν μπορείτε να διαγράψετε τον εαυτό σας!");
    
    if (confirm('Θέλετε σίγουρα να αφαιρέσετε αυτόν τον χρήστη;')) {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (!error) fetchUsers(storeId!)
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const staff = users.filter(u => u.role === 'user')

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>🔐</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Δικαιώματα
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΕΛΕΓΧΟΣ ΠΡΟΣΒΑΣΗΣ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>Φόρτωση χρηστών...</div>
      ) : (
        <>
          {/* ADMINS SECTION */}
          <p style={sectionLabel}>ΔΙΑΧΕΙΡΙΣΤΕΣ ({admins.length})</p>
          {admins.map(u => (
            <div key={u.id} style={adminCard}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: 'white' }}>{u.username?.toUpperCase() || 'ADMIN'}</p>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{u.email}</p>
              </div>
              <span style={adminBadge}>FULL ACCESS</span>
            </div>
          ))}

          <div style={{ marginBottom: '30px' }} />

          {/* STAFF SECTION */}
          <p style={sectionLabel}>ΥΠΑΛΛΗΛΟΙ & ΧΡΗΣΤΕΣ ({staff.length})</p>
          <div style={legendBox}>
            <div style={{display:'flex', gap:'10px'}}>
                <span>📊 Ανάλυση</span>
                <span>📜 Ιστορικό</span>
                <span>✏️ Επεξεργασία</span>
            </div>
          </div>

          {staff.map(u => (
            <div key={u.id} style={userCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontWeight: '800', margin: 0, fontSize: '15px', color: '#1e293b' }}>{u.username || 'Χρήστης'}</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{u.email}</p>
                </div>
                <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => updateField(u.id, 'can_view_analysis', !u.can_view_analysis)} 
                  style={{ ...permBtn, backgroundColor: u.can_view_analysis ? '#dcfce7' : '#f1f5f9', color: u.can_view_analysis ? '#166534' : '#94a3b8' }}
                >
                  📊 Ανάλυση
                </button>
                <button 
                  onClick={() => updateField(u.id, 'can_view_history', !u.can_view_history)} 
                  style={{ ...permBtn, backgroundColor: u.can_view_history ? '#dcfce7' : '#f1f5f9', color: u.can_view_history ? '#166534' : '#94a3b8' }}
                >
                  📜 Ιστορικό
                </button>
                <button 
                  onClick={() => updateField(u.id, 'can_edit_transactions', !u.can_edit_transactions)} 
                  style={{ ...permBtn, backgroundColor: u.can_edit_transactions ? '#dcfce7' : '#f1f5f9', color: u.can_edit_transactions ? '#166534' : '#94a3b8' }}
                >
                  ✏️ Edit
                </button>
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
            <div style={{ textAlign: 'center', padding: '30px', backgroundColor: 'white', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Δεν υπάρχουν συνδεδεμένοι υπάλληλοι.</p>
            </div>
          )}

          <Link href="/admin/invite" style={inviteBtn}>+ ΠΡΟΣΚΛΗΣΗ ΝΕΟΥ ΧΡΗΣΤΗ</Link>
        </>
      )}
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const sectionLabel: any = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' };
const adminCard: any = { backgroundColor: '#0f172a', padding: '15px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const adminBadge: any = { backgroundColor: '#1e293b', color: '#4ade80', fontSize: '9px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px' };
const userCard: any = { backgroundColor: 'white', padding: '18px', borderRadius: '22px', border: '1px solid #f1f5f9', marginBottom: '12px' };
const legendBox: any = { marginBottom: '15px', fontSize: '10px', color: '#94a3b8', fontWeight: '700' };
const permBtn: any = { flex: 1, border: 'none', padding: '10px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', transition: '0.2s' };
const promoteBtn: any = { width: '100%', marginTop: '15px', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '10px', fontWeight: '900', cursor: 'pointer' };
const inviteBtn: any = { display: 'block', textAlign: 'center', marginTop: '30px', padding: '18px', backgroundColor: '#0f172a', color: 'white', borderRadius: '16px', textDecoration: 'none', fontWeight: '900', fontSize: '13px' };

export default function PermissionsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><PermissionsContent /></Suspense>
    </main>
  )
}