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
    if (userId === myId && field === 'role' && newValue !== 'admin') {
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

  async function handleDelete(userId: string) {
    if (userId === myId) return alert("Δεν μπορείτε να διαγράψετε τον εαυτό σας!");
    if (confirm('Θέλετε σίγουρα να αφαιρέσετε αυτόν τον χρήστη;')) {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (!error) fetchUsers()
    }
  }

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Φόρτωση χρηστών...</div>

  const admins = users.filter(u => u.role === 'admin')
  const staff = users.filter(u => u.role === 'user')

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Δικαιώματα & Ρόλοι</h2>
        </div>

        {/* ΕΝΟΤΗΤΑ 1: ΔΙΑΧΕΙΡΙΣΤΕΣ */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>🏢 Διαχειριστές εταιρείας</h3>
          <p style={sectionSub}>Οι διαχειριστές της εταιρείας μπορούν να βλέπουν και να κάνουν τα πάντα.</p>
          
          <table style={tableStyle}>
            <thead>
              <tr style={headerRow}>
                <th style={thStyle}>ΟΝΟΜΑ</th>
                <th style={thStyle}>EMAIL</th>
                <th style={{...thStyle, textAlign: 'center'}}>ΕΝΕΡΓΕΙΑ</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(u => (
                <tr key={u.id} style={trStyle}>
                  <td style={tdStyle}><b>{u.username || 'Admin'}</b></td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={{...tdStyle, textAlign: 'center'}}>
                    <button onClick={() => handleDelete(u.id)} style={delBtn}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/admin/invite" style={inviteLinkText}>Προσκάλεσε διαχειριστή στην εταιρεία</Link>
        </div>

        {/* ΕΝΟΤΗΤΑ 2: ΧΡΗΣΤΕΣ ΕΠΙΧΕΙΡΗΣΗΣ */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>🏨 Χρήστες επιχείρησης</h3>
          <div style={legendBox}>
            <div>📊 <b>Ανάλυση:</b> Πρόσβαση σε τζίρους & ποσοστά.</div>
            <div>📜 <b>Ιστορικό:</b> Προβολή κινήσεων στην αρχική.</div>
            <div>✏️ <b>Edit:</b> Δυνατότητα διαγραφής/επεξεργασίας.</div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr style={headerRow}>
                <th style={thStyle}>ΟΝΟΜΑ</th>
                <th style={thStyle}>EMAIL</th>
                <th style={{...thStyle, textAlign: 'center'}}>ΡΟΛΟΣ / ΠΡΟΣΒΑΣΗ</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(u => (
                <tr key={u.id} style={trStyle}>
                  <td style={tdStyle}><b>{u.username || 'User'}</b></td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={{...tdStyle, textAlign: 'center'}}>
                    <div style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                       <button onClick={() => updateField(u.id, 'can_view_analysis', !u.can_view_analysis)} 
                               style={{...permBtn, opacity: u.can_view_analysis ? 1 : 0.3}}>📊</button>
                       <button onClick={() => updateField(u.id, 'can_view_history', !u.can_view_history)} 
                               style={{...permBtn, opacity: u.can_view_history ? 1 : 0.3}}>📜</button>
                       <button onClick={() => updateField(u.id, 'can_edit_transactions', !u.can_edit_transactions)} 
                               style={{...permBtn, opacity: u.can_edit_transactions ? 1 : 0.3}}>✏️</button>
                       <button onClick={() => updateField(u.id, 'role', 'admin')} 
                               style={{...permBtn, backgroundColor:'#f1f5f9'}}>🆙</button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={3} style={{padding:'20px', textAlign:'center', color:'#94a3b8'}}>Δεν υπάρχουν απλοί χρήστες.</td></tr>
              )}
            </tbody>
          </table>
          <Link href="/admin/invite" style={inviteLinkText}>Προσκάλεσε χρήστη στην επιχείρηση</Link>
        </div>

      </div>
    </main>
  )
}

// STYLES ΓΙΑ ΠΛΗΡΗ ΤΑΥΤΙΣΗ ΜΕ ΤΟ ΠΡΟΤΥΠΟ
const sectionCard = { backgroundColor: 'white', padding: '25px', borderRadius: '16px', marginBottom: '25px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const sectionTitle = { fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 5px 0' };
const sectionSub = { fontSize: '13px', color: '#64748b', marginBottom: '20px' };
const legendBox = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '12px', fontSize: '12px', color: '#475569', marginBottom: '20px', lineHeight: '1.6', border: '1px solid #f1f5f9' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const };
const headerRow = { borderBottom: '2px solid #f1f5f9' };
const thStyle = { textAlign: 'left' as const, fontSize: '11px', color: '#94a3b8', padding: '12px 10px', fontWeight: '800', letterSpacing: '0.5px' };
const tdStyle = { padding: '15px 10px', borderBottom: '1px solid #f8fafc', fontSize: '14px', color: '#334155' };
const trStyle = { transition: '0.2s' };
const permBtn = { border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', padding: '5px' };
const delBtn = { border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', opacity: 0.6 };
const inviteLinkText = { display: 'inline-block', marginTop: '20px', color: '#2563eb', fontWeight: '700', fontSize: '14px', textDecoration: 'none' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', color: '#64748b', border: '1px solid #e2e8f0' };