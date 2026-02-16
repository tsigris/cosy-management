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
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [storeId, setStoreId] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Παίρνουμε το store_id του Admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id, role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        router.push('/')
        return
      }

      setStoreId(profile.store_id)

      // Φέρνουμε ΜΟΝΟ τους χρήστες του ίδιου καταστήματος
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('store_id', profile.store_id)
        .order('username')
      
      if (data) setUsers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function togglePermission(field: string) {
    if (!selectedUser) return

    const newValue = !selectedUser[field]
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue })
      .eq('id', selectedUser.id)

    if (!error) {
      setSelectedUser({ ...selectedUser, [field]: newValue })
      // Ενημερώνουμε τοπικά τη λίστα για να μη χρειάζεται full reload
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, [field]: newValue } : u))
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const businessUsers = users.filter(u => u.role === 'user')

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
              ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΒΑΣΗΣ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>Φόρτωση χρηστών...</div>
      ) : (
        <>
          {/* ΔΙΑΧΕΙΡΙΣΤΕΣ */}
          <section style={sectionCard}>
            <h3 style={sectionTitle}>🏢 Διαχειριστές εταιρείας</h3>
            <table style={tableStyle}>
              <thead>
                <tr style={thRow}>
                  <th style={thStyle}>Όνομα</th>
                  <th style={thStyle}>Email</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}><b>{u.username?.toUpperCase() || '—'}</b></td>
                    <td style={tdStyle}>{u.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* ΔΙΟΡΘΩΣΗ: Προσθήκη ?role=admin */}
            <Link href="/admin/invite?role=admin" style={inviteLinkStyle}>+ Πρόσκληση διαχειριστή</Link>
          </section>

          {/* ΧΡΗΣΤΕΣ ΕΠΙΧΕΙΡΗΣΗΣ */}
          <section style={sectionCard}>
            <h3 style={sectionTitle}>🏨 Χρήστες επιχείρησης</h3>
            <div style={legendBox}>
              <p style={legendItem}>📊: Ανάλυση | 🏠: Αρχική | ✏️: Edit</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr style={thRow}>
                  <th style={thStyle}>Όνομα</th>
                  <th style={thStyle}>Πρόσβαση</th>
                  <th style={{...thStyle, textAlign: 'right'}}>Ρύθμιση</th>
                </tr>
              </thead>
              <tbody>
                {businessUsers.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}>{u.username || u.email}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '5px', fontSize: '16px' }}>
                        {u.can_view_analysis && '📊'} 
                        {u.can_view_history && '🏠'}
                        {u.can_edit_transactions && '✏️'}
                      </div>
                    </td>
                    <td style={{...tdStyle, textAlign: 'right'}}>
                      <button onClick={() => setSelectedUser(u)} style={editBtn}>⚙️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* ΔΙΟΡΘΩΣΗ: Προσθήκη ?role=user */}
            <Link href="/admin/invite?role=user" style={inviteBtnPrimary}>+ ΠΡΟΣΚΛΗΣΗ ΝΕΟΥ ΧΡΗΣΤΗ</Link>
          </section>
        </>
      )}

      {/* MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ */}
      {selectedUser && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ marginBottom: '5px', fontWeight: '900' }}>Ρύθμιση Δικαιωμάτων</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Χρήστης: <b>{selectedUser.username}</b></p>
            
            <div style={toggleRow}>
              <span style={toggleLabel}>📊 Πρόσβαση στην Ανάλυση</span>
              <button onClick={() => togglePermission('can_view_analysis')} style={{ ...toggleBtn, backgroundColor: selectedUser.can_view_analysis ? '#10b981' : '#cbd5e1' }}>
                {selectedUser.can_view_analysis ? 'ΝΑΙ' : 'ΟΧΙ'}
              </button>
            </div>

            <div style={toggleRow}>
              <span style={toggleLabel}>🏠 Πρόσβαση στην Αρχική</span>
              <button onClick={() => togglePermission('can_view_history')} style={{ ...toggleBtn, backgroundColor: selectedUser.can_view_history ? '#10b981' : '#cbd5e1' }}>
                {selectedUser.can_view_history ? 'ΝΑΙ' : 'ΟΧΙ'}
              </button>
            </div>

            <div style={toggleRow}>
              <span style={toggleLabel}>✏️ Δικαίωμα Επεξεργασίας</span>
              <button onClick={() => togglePermission('can_edit_transactions')} style={{ ...toggleBtn, backgroundColor: selectedUser.can_edit_transactions ? '#10b981' : '#cbd5e1' }}>
                {selectedUser.can_edit_transactions ? 'ΝΑΙ' : 'ΟΧΙ'}
              </button>
            </div>

            <button onClick={() => setSelectedUser(null)} style={closeBtn}>ΑΠΟΘΗΚΕΥΣΗ & ΚΛΕΙΣΙΜΟ</button>
          </div>
        </div>
      )}
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const sectionCard: any = { backgroundColor: 'white', borderRadius: '22px', padding: '20px', marginBottom: '20px', border: '1px solid #f1f5f9' };
const sectionTitle: any = { fontSize: '15px', fontWeight: '900', marginBottom: '15px', color: '#0f172a' };
const legendBox: any = { backgroundColor: '#f8fafc', padding: '10px', borderRadius: '10px', marginBottom: '15px' };
const legendItem: any = { fontSize: '10px', margin: 0, color: '#64748b', fontWeight: '700' };
const tableStyle: any = { width: '100%', borderCollapse: 'collapse' };
const thRow: any = { borderBottom: '2px solid #f8fafc' };
const thStyle: any = { textAlign: 'left', padding: '10px', fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' };
const tdStyle: any = { padding: '15px 10px', fontSize: '14px', borderBottom: '1px solid #f8fafc', color: '#334155' };
const trStyle: any = { transition: '0.2s' };
const inviteLinkStyle: any = { display: 'block', textAlign: 'center', color: '#2563eb', fontWeight: '800', fontSize: '12px', textDecoration: 'none', marginTop: '15px' };
const inviteBtnPrimary: any = { display: 'block', width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', borderRadius: '14px', fontWeight: '900', fontSize: '13px', textAlign: 'center', textDecoration: 'none', marginTop: '20px' };
const editBtn: any = { padding: '8px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' };

// MODAL STYLES
const modalOverlay: any = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContent: any = { backgroundColor: 'white', padding: '30px', borderRadius: '28px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' };
const toggleRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f1f5f9' };
const toggleLabel: any = { fontSize: '14px', fontWeight: '700', color: '#1e293b' };
const toggleBtn: any = { border: 'none', color: 'white', padding: '8px 15px', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', minWidth: '70px', fontSize: '12px' };
const closeBtn: any = { width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '14px', marginTop: '25px', fontWeight: '900', cursor: 'pointer' };

export default function PermissionsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <PermissionsContent />
      </Suspense>
    </main>
  )
}