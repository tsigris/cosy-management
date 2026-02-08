'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PermissionsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState('')

  useEffect(() => {
    checkAdminAndFetchUsers()
  }, [])

  async function checkAdminAndFetchUsers() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      setMyId(user.id)
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
      fetchUsers()
    }
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
    if (data) setUsers(data)
    setLoading(false)
  }

  async function updateField(userId: string, field: string, newValue: any) {
    if (userId === myId && field === 'role') {
      alert("Δεν μπορείτε να αφαιρέσετε τον ρόλο Admin από τον εαυτό σας!");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: newValue })
      .eq('id', userId)
    
    if (!error) fetchUsers()
    else alert("Σφάλμα: " + error.message)
  }

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Φόρτωση χρηστών...</div>

  const admins = users.filter(u => u.role === 'admin')
  const staff = users.filter(u => u.role === 'user')

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Δικαιώματα & Ρόλοι</h2>
        </div>

        {/* ΔΙΑΧΕΙΡΙΣΤΕΣ */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>🏢 ΔΙΑΧΕΙΡΙΣΤΕΣ ΕΤΑΙΡΕΙΑΣ</h3>
          <p style={sectionSub}>Έχουν πλήρη πρόσβαση σε όλα τα δεδομένα και τις ρυθμίσεις.</p>
          
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>ΧΡΗΣΤΗΣ</th>
                  <th style={thStyle}>ΡΟΛΟΣ</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}>
                       <div style={{fontWeight:'700'}}>{u.username || 'Admin'}</div>
                       <div style={{fontSize:'10px', color:'#94a3b8'}}>{u.email}</div>
                    </td>
                    <td style={tdStyle}>
                       <select 
                        value={u.role} 
                        onChange={(e) => updateField(u.id, 'role', e.target.value)}
                        style={miniSelect}
                       >
                         <option value="admin">ADMIN</option>
                         <option value="user">USER</option>
                       </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ΧΡΗΣΤΕΣ ΕΠΙΧΕΙΡΗΣΗΣ */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>🏨 ΧΡΗΣΤΕΣ ΕΠΙΧΕΙΡΗΣΗΣ</h3>
          <div style={legendBox}>
            <div>📊 <b>Ανάλυση:</b> Πρόσβαση σε τζίρους & ποσοστά.</div>
            <div>📜 <b>Ιστορικό:</b> Προβολή κινήσεων στην αρχική.</div>
            <div>✏️ <b>Edit:</b> Δυνατότητα διαγραφής/επεξεργασίας.</div>
          </div>

          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>ΧΡΗΣΤΗΣ</th>
                  <th style={thStyle}>ΔΙΚΑΙΩΜΑΤΑ</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}>
                       <div style={{fontWeight:'700'}}>{u.username || 'User'}</div>
                       <div style={{fontSize:'10px', color:'#94a3b8'}}>{u.email}</div>
                    </td>
                    <td style={tdStyle}>
                       <div style={{display:'flex', gap:'5px'}}>
                          <button onClick={() => updateField(u.id, 'can_view_analysis', !u.can_view_analysis)} 
                            style={{...permIcon, backgroundColor: u.can_view_analysis ? '#10b981' : '#e2e8f0'}}>📊</button>
                          <button onClick={() => updateField(u.id, 'can_view_history', !u.can_view_history)} 
                            style={{...permIcon, backgroundColor: u.can_view_history ? '#3b82f6' : '#e2e8f0'}}>📜</button>
                          <button onClick={() => updateField(u.id, 'can_edit_transactions', !u.can_edit_transactions)} 
                            style={{...permIcon, backgroundColor: u.can_edit_transactions ? '#f59e0b' : '#e2e8f0'}}>✏️</button>
                          <button onClick={() => updateField(u.id, 'role', 'admin')} style={{...permIcon, backgroundColor:'#f1f5f9'}}>🆙</button>
                       </div>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && <tr><td colSpan={2} style={{padding:'20px', textAlign:'center', color:'#94a3b8', fontSize:'12px'}}>Δεν υπάρχουν απλοί χρήστες</td></tr>}
              </tbody>
            </table>
          </div>

          <Link href="/admin/invite" style={inviteBtn}>
            ➕ ΠΡΟΣΚΛΗΣΗ ΝΕΟΥ ΧΡΗΣΤΗ
          </Link>
        </div>

      </div>
    </main>
  )
}

// STYLES
const sectionCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', marginBottom: '20px', border: '1px solid #e2e8f0' };
const sectionTitle = { fontSize: '14px', fontWeight: '900', color: '#0f172a', margin: '0 0 5px 0' };
const sectionSub = { fontSize: '11px', color: '#64748b', marginBottom: '15px' };
const legendBox = { backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', fontSize: '11px', color: '#475569', marginBottom: '15px', lineHeight: '1.6' };
const tableWrapper = { overflowX: 'auto' as const };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const };
const thStyle = { textAlign: 'left' as const, fontSize: '10px', color: '#94a3b8', padding: '10px', borderBottom: '1px solid #f1f5f9' };
const tdStyle = { padding: '12px 10px', borderBottom: '1px solid #f8fafc', fontSize: '13px' };
const trStyle = { verticalAlign: 'middle' as const };
const miniSelect = { padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '700' };
const permIcon = { border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inviteBtn = { display: 'block', textAlign: 'center' as const, backgroundColor: '#0f172a', color: 'white', padding: '14px', borderRadius: '12px', textDecoration: 'none', fontWeight: '900', fontSize: '12px', marginTop: '15px' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '35px', height: '35px', borderRadius: '10px', color: '#64748b', border: '1px solid #e2e8f0' };