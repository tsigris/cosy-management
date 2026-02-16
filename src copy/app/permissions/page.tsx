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
        // Get activeStoreId from localStorage
        const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null;
        if (!activeStoreId) {
          alert("Δεν βρέθηκε κατάστημα.")
          router.push('/')
          return;
        }

        // Check admin role in store_access table for this store
        const { data: access } = await supabase
          .from('store_access')
          .select('role')
          .eq('user_id', user.id)
          .eq('store_id', activeStoreId)
          .maybeSingle();

        if (!access || access.role !== 'admin') {
          alert("Δεν έχετε πρόσβαση σε αυτή τη σελίδα!")
          router.push('/')
          return;
        }
        setStoreId(activeStoreId);
        fetchUsers(activeStoreId);
      }
    } catch (err) { console.error(err) }
  }

  async function fetchUsers(sId: string | null) {
    if (!sId) return setLoading(false);
    // Join profiles and store_access to get all users associated with this store
    const { data, error } = await supabase
      .from('store_access')
      .select('user_id, role, can_view_analysis, can_view_history, can_edit_transactions, profiles:profiles(*)')
      .eq('store_id', sId)
      .order('role', { ascending: true });
    if (error) {
      alert('Σφάλμα φόρτωσης χρηστών: ' + error.message);
      setLoading(false);
      return;
    }
    // Map users to include profile info
    const usersWithProfiles = (data || []).map((entry: any) => ({
      ...entry.profiles,
      id: entry.user_id,
      role: entry.role,
      can_view_analysis: entry.can_view_analysis,
      can_view_history: entry.can_view_history,
      can_edit_transactions: entry.can_edit_transactions
    }));
    setUsers(usersWithProfiles);
    setLoading(false);
  }

  async function updateField(userId: string, field: string, newValue: any) {
    if (userId === myId && field === 'role' && newValue !== 'admin') {
      alert("Δεν μπορείτε να αφαιρέσετε τον ρόλο Admin από τον εαυτό σας!");
      return;
    }
    // Update the field in store_access for the current store
    const { error } = await supabase
      .from('store_access')
      .update({ [field]: newValue })
      .eq('user_id', userId)
      .eq('store_id', storeId);
    if (!error) {
      fetchUsers(storeId);
    } else {
      alert("Σφάλμα: " + error.message);
    }
  }

  async function handleDelete(userId: string) {
    if (userId === myId) return alert("Δεν μπορείτε να διαγράψετε τον εαυτό σας!");
    if (confirm('Θέλετε σίγουρα να αφαιρέσετε αυτόν τον χρήστη από το κατάστημα;')) {
      // Delete the store_access entry for this user and store
      const { error } = await supabase
        .from('store_access')
        .delete()
        .eq('user_id', userId)
        .eq('store_id', storeId);
      if (!error) fetchUsers(storeId);
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const staff = users.filter(u => u.role === 'user' || !u.role)

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>🔐</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Δικαιώματα
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#475569', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΕΛΕΓΧΟΣ ΠΡΟΣΒΑΣΗΣ & ΡΟΛΟΙ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#1e293b', fontWeight: 'bold' }}>Φόρτωση χρηστών...</div>
      ) : (
        <>
          {/* ADMINS SECTION */}
          <p style={sectionLabel}>ΔΙΑΧΕΙΡΙΣΤΕΣ ({admins.length})</p>
          {admins.map(u => (
            <div key={u.id} style={adminCard}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '900', margin: 0, fontSize: '15px', color: 'white' }}>{u.username?.toUpperCase() || 'ADMIN'}</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: '600' }}>{u.email}</p>
              </div>
              <span style={adminBadge}>FULL ACCESS</span>
            </div>
          ))}

          <div style={{ marginBottom: '30px' }} />

          {/* STAFF SECTION */}
          <p style={sectionLabel}>ΥΠΑΛΛΗΛΟΙ & ΧΡΗΣΤΕΣ ({staff.length})</p>
          <div style={legendBox}>
            <div style={{display:'flex', gap:'12px', flexWrap: 'wrap'}}>
                <span style={{fontWeight: '800'}}>📊 Ανάλυση</span>
                <span style={{fontWeight: '800'}}>📜 Ιστορικό</span>
                <span style={{fontWeight: '800'}}>✏️ Edit</span>
            </div>
          </div>

          {staff.map(u => (
            <div key={u.id} style={userCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <p style={{ fontWeight: '900', margin: 0, fontSize: '16px', color: '#0f172a' }}>{u.username || 'Νέος Χρήστης'}</p>
                  <p style={{ fontSize: '12px', color: '#475569', margin: 0, fontWeight: '700' }}>{u.email}</p>
                </div>
                <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>🗑️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => updateField(u.id, 'can_view_analysis', !u.can_view_analysis)} 
                  style={{ ...permBtn, backgroundColor: u.can_view_analysis ? '#dcfce7' : '#f1f5f9', color: u.can_view_analysis ? '#166534' : '#64748b', border: u.can_view_analysis ? '1px solid #166534' : '1px solid #e2e8f0' }}
                >
                  📊 Ανάλυση
                </button>
                <button 
                  onClick={() => updateField(u.id, 'can_view_history', !u.can_view_history)} 
                  style={{ ...permBtn, backgroundColor: u.can_view_history ? '#dcfce7' : '#f1f5f9', color: u.can_view_history ? '#166534' : '#64748b', border: u.can_view_history ? '1px solid #166534' : '1px solid #e2e8f0' }}
                >
                  📜 Ιστορικό
                </button>
                <button 
                  onClick={() => updateField(u.id, 'can_edit_transactions', !u.can_edit_transactions)} 
                  style={{ ...permBtn, backgroundColor: u.can_edit_transactions ? '#dcfce7' : '#f1f5f9', color: u.can_edit_transactions ? '#166534' : '#64748b', border: u.can_edit_transactions ? '1px solid #166534' : '1px solid #e2e8f0' }}
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
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '24px', border: '2px dashed #e2e8f0' }}>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0, fontWeight: '700' }}>Δεν υπάρχουν συνδεδεμένοι υπάλληλοι.</p>
            </div>
          )}

          {/* ΔΙΟΡΘΩΣΗ: Δυναμικό Link με ρόλο */}
          <Link href="/admin/invite?role=user" style={inviteBtn}>+ ΠΡΟΣΚΛΗΣΗ ΝΕΟΥ ΧΡΗΣΤΗ</Link>
        </>
      )}
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#fef3c7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#475569', fontSize: '20px', fontWeight: 'bold', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' };
const sectionLabel: any = { fontSize: '11px', fontWeight: '900', color: '#1e293b', marginBottom: '12px', letterSpacing: '0.8px', textTransform: 'uppercase' };
const adminCard: any = { backgroundColor: '#0f172a', padding: '18px', borderRadius: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const adminBadge: any = { backgroundColor: '#1e293b', color: '#4ade80', fontSize: '10px', fontWeight: '900', padding: '5px 10px', borderRadius: '8px', border: '1px solid #166534' };
const userCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '26px', border: '1px solid #f1f5f9', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const legendBox: any = { backgroundColor: '#f1f5f9', padding: '12px 15px', borderRadius: '14px', marginBottom: '15px', fontSize: '11px', color: '#0f172a', border: '1px solid #e2e8f0' };
const permBtn: any = { flex: 1, border: '1px solid #e2e8f0', padding: '12px 5px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', transition: '0.2s' };
const promoteBtn: any = { width: '100%', marginTop: '15px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: '#f8fafc', color: '#1e293b', fontSize: '11px', fontWeight: '900', cursor: 'pointer' };
const inviteBtn: any = { display: 'block', textAlign: 'center', marginTop: '30px', padding: '20px', backgroundColor: '#0f172a', color: 'white', borderRadius: '20px', textDecoration: 'none', fontWeight: '900', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };

export default function PermissionsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><PermissionsContent /></Suspense>
    </main>
  )
}