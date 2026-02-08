'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function PermissionsPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null) // Ο χρήστης που επεξεργαζόμαστε

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('username')
    if (data) setUsers(data)
    setLoading(false)
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
      fetchUsers() // Ανανέωση της λίστας από πίσω
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const businessUsers = users.filter(u => u.role === 'user')

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Φόρτωση...</div>

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>Δικαιώματα Χρηστών</h2>
        </div>

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
                  <td style={tdStyle}>{u.username || '—'}</td>
                  <td style={tdStyle}>{u.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/admin/invite" style={inviteBtn}>Προσκάλεσε διαχειριστή</Link>
        </section>

        {/* ΧΡΗΣΤΕΣ ΕΠΙΧΕΙΡΗΣΗΣ */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>🏨 Χρήστες επιχείρησης</h3>
          <div style={legendBox}>
            <p style={legendItem}>🔒: Ανάλυση | 🏠: Αρχική</p>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={thRow}>
                <th style={thStyle}>Όνομα</th>
                <th style={thStyle}>Ρόλος</th>
                <th style={thStyle}>Επεξεργασία</th>
              </tr>
            </thead>
            <tbody>
              {businessUsers.map(u => (
                <tr key={u.id} style={trStyle}>
                  <td style={tdStyle}>{u.username || u.email}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {u.can_view_analysis && '🔒'} {u.can_view_history && '🏠'}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => setSelectedUser(u)} style={editBtn}>⚙️ Ρύθμιση</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/admin/invite" style={inviteBtn}>Προσκάλεσε χρήστη</Link>
        </section>

        {/* MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ ΔΙΚΑΙΩΜΑΤΩΝ */}
        {selectedUser && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ marginBottom: '5px' }}>Ρύθμιση Δικαιωμάτων</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Χρήστης: <b>{selectedUser.username}</b></p>
              
              <div style={toggleRow}>
                <span>🔒 Πρόσβαση στην Ανάλυση</span>
                <button 
                  onClick={() => togglePermission('can_view_analysis')}
                  style={{ ...toggleBtn, backgroundColor: selectedUser.can_view_analysis ? '#10b981' : '#cbd5e1' }}
                >
                  {selectedUser.can_view_analysis ? 'ΝΑΙ' : 'ΟΧΙ'}
                </button>
              </div>

              <div style={toggleRow}>
                <span>🏠 Πρόσβαση στην Αρχική (Ιστορικό)</span>
                <button 
                  onClick={() => togglePermission('can_view_history')}
                  style={{ ...toggleBtn, backgroundColor: selectedUser.can_view_history ? '#10b981' : '#cbd5e1' }}
                >
                  {selectedUser.can_view_history ? 'ΝΑΙ' : 'ΟΧΙ'}
                </button>
              </div>

              <div style={toggleRow}>
                <span>✏️ Δικαίωμα Επεξεργασίας/Διαγραφής</span>
                <button 
                  onClick={() => togglePermission('can_edit_transactions')}
                  style={{ ...toggleBtn, backgroundColor: selectedUser.can_edit_transactions ? '#10b981' : '#cbd5e1' }}
                >
                  {selectedUser.can_edit_transactions ? 'ΝΑΙ' : 'ΟΧΙ'}
                </button>
              </div>

              <button onClick={() => setSelectedUser(null)} style={closeBtn}>ΚΛΕΙΣΙΜΟ</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// STYLES
const sectionCard = { backgroundColor: 'white', borderRadius: '16px', padding: '20px', marginBottom: '25px', border: '1px solid #e2e8f0' };
const sectionTitle = { fontSize: '16px', fontWeight: '800', marginBottom: '15px' };
const legendBox = { backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '10px' };
const legendItem = { fontSize: '11px', margin: 0, color: '#64748b' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const };
const thRow = { backgroundColor: '#f1f5f9' };
const thStyle = { textAlign: 'left' as const, padding: '10px', fontSize: '11px', fontWeight: '800', color: '#64748b' };
const tdStyle = { padding: '12px 10px', fontSize: '13px', borderBottom: '1px solid #f1f5f9' };
const trStyle = { borderBottom: '1px solid #f1f5f9' };
const inviteBtn = { display: 'block', width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' as const, textDecoration: 'none', marginTop: '15px' };
const editBtn = { padding: '6px 10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0' };

// MODAL STYLES
const modalOverlay = { position: 'fixed' as const, top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' };
const toggleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f1f5f9' };
const toggleBtn = { border: 'none', color: 'white', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', minWidth: '60px' };
const closeBtn = { width: '100%', padding: '15px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', marginTop: '20px', fontWeight: 'bold', cursor: 'pointer' };