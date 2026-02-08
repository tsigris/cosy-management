'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PermissionsPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('username')
    if (data) setUsers(data)
    setLoading(false)
  }

  // Φιλτράρισμα χρηστών βάσει ρόλου
  const admins = users.filter(u => u.role === 'admin')
  const businessUsers = users.filter(u => u.role === 'user')

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', fontWeight: 'bold' }}>Φόρτωση χρηστών...</div>

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Δικαιώματα Χρηστών</h2>
        </div>

        {/* ΠΙΝΑΚΑΣ 1: ΔΙΑΧΕΙΡΙΣΤΕΣ */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>🏢 Διαχειριστές εταιρείας</h3>
          <p style={sectionSub}>Οι διαχειριστές της εταιρείας μπορούν να βλέπουν και να κάνουν τα πάντα.</p>
          
          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={thRow}>
                  <th style={thStyle}>Όνομα</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>🗑️</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}>{u.username || '—'}</td>
                    <td style={tdStyle}>{u.email || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button style={iconBtn}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/admin/invite" style={inviteBtn}>Προσκάλεσε διαχειριστή στην εταιρεία</Link>
        </section>

        {/* ΠΙΝΑΚΑΣ 2: ΧΡΗΣΤΕΣ ΕΠΙΧΕΙΡΗΣΗΣ */}
        <section style={sectionCard}>
          <h3 style={sectionTitle}>🏨 Χρήστες επιχείρησης</h3>
          
          {/* Επεξήγηση Ρόλων (Legend) */}
          <div style={legendBox}>
            <p style={legendItem}>🔒 <b>Διαχειριστής:</b> βλέπει/κάνει τα πάντα, εκτός από πάγια/προμηθευτές.</p>
            <p style={legendItem}>📇 <b>Μισθοδοσία:</b> μπορεί να καταχωρεί και να βλέπει τις μισθοδοσίες.</p>
            <p style={legendItem}>🏠 <b>Αρχική:</b> έχει πρόσβαση μόνο στην αρχική σελίδα.</p>
          </div>

          <div style={tableWrapper}>
            <table style={tableStyle}>
              <thead>
                <tr style={thRow}>
                  <th style={thStyle}>Όνομα</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Ρόλος</th>
                </tr>
              </thead>
              <tbody>
                {businessUsers.map(u => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}>{u.username || '—'}</td>
                    <td style={tdStyle}>{u.email || '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '16px' }}>
                        {u.can_view_analysis && '🔒'}
                        {u.can_view_history && '🏠'}
                        {/* Εδώ μπορείς να προσθέσεις μελλοντικά το εικονίδιο μισθοδοσίας */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/admin/invite" style={inviteBtn}>Προσκάλεσε χρήστη στην επιχείρηση</Link>
        </section>

      </div>
    </main>
  )
}

// STYLES
const sectionCard = { backgroundColor: 'white', borderRadius: '16px', padding: '20px', marginBottom: '25px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const sectionTitle = { fontSize: '16px', fontWeight: '800', margin: '0 0 5px 0', color: '#0f172a' };
const sectionSub = { fontSize: '12px', color: '#64748b', marginBottom: '15px' };
const legendBox = { backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '15px', border: '1px solid #f1f5f9' };
const legendItem = { fontSize: '11px', margin: '3px 0', color: '#475569' };
const tableWrapper = { overflowX: 'auto' as const };
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, marginTop: '10px' };
const thRow = { backgroundColor: '#f1f5f9' };
const thStyle = { textAlign: 'left' as const, padding: '10px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' as const };
const tdStyle = { padding: '12px 10px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', color: '#334155' };
const trStyle = { borderBottom: '1px solid #f1f5f9' };
const inviteBtn = { display: 'block', width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', textAlign: 'center' as const, textDecoration: 'none', marginTop: '15px' };
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '36px', height: '36px', borderRadius: '10px', color: '#64748b', border: '1px solid #e2e8f0' };