'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ShieldCheck, UserPlus, Trash2, X, ChevronUp, ChevronDown, Users } from 'lucide-react'

function PermissionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState('')

  const checkAdminAndFetchUsers = useCallback(async () => {
    if (!storeId) {
      toast.error("Λείπει το αναγνωριστικό καταστήματος")
      router.push('/select-store')
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setMyId(user.id)

      const { data: access, error: accessError } = await supabase
        .from('store_access')
        .select('role')
        .eq('user_id', user.id)
        .eq('store_id', storeId)
        .maybeSingle()

      if (accessError || !access || access.role !== 'admin') {
        toast.error("Δεν έχετε δικαιώματα διαχειριστή!")
        router.push(`/?store=${storeId}`)
        return
      }

      await fetchUsersList(storeId)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [storeId, router])

  useEffect(() => {
    checkAdminAndFetchUsers()
  }, [checkAdminAndFetchUsers])

  async function fetchUsersList(sId: string) {
    const { data: accessData, error: accessError } = await supabase
      .from('store_access')
      .select('*')
      .eq('store_id', sId)

    if (accessError) throw accessError

    const userIds = accessData.map(a => a.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds)

    const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || [])

    const formattedUsers = accessData.map(entry => ({
      ...entry,
      username: profileMap[entry.user_id]?.username || 'Χρήστης',
      email: profileMap[entry.user_id]?.email || '---'
    }))

    setUsers(formattedUsers)
  }

  async function updatePermission(userId: string, field: string, newValue: any) {
    // Προστασία εαυτού
    if (userId === myId && field === 'role' && newValue !== 'admin') {
      toast.error("Δεν μπορείτε να αφαιρέσετε τον εαυτό σας από Admin!");
      return;
    }

    try {
      const { error } = await supabase
        .from('store_access')
        .update({ [field]: newValue })
        .eq('user_id', userId)
        .eq('store_id', storeId);

      if (error) throw error;
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, [field]: newValue } : u));
      toast.success("Η αλλαγή αποθηκεύτηκε");
    } catch (error: any) {
      toast.error("Αποτυχία ενημέρωσης");
    }
  }

  async function removeUser(userId: string) {
    if (userId === myId) return;
    if (!confirm('Οριστική αφαίρεση πρόσβασης;')) return;

    try {
      const { error } = await supabase
        .from('store_access')
        .delete()
        .eq('user_id', userId)
        .eq('store_id', storeId);

      if (error) throw error;
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      toast.success("Ο χρήστης αφαιρέθηκε");
    } catch (err) {
      toast.error("Αποτυχία διαγραφής");
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const staff = users.filter(u => u.role !== 'admin')

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}><ShieldCheck size={24} color="#b45309" /></div>
          <div>
            <h1 style={titleStyle}>Δικαιώματα</h1>
            <p style={subtitleStyle}>ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΒΑΣΗΣ</p>
          </div>
        </div>
        <Link href={`/?store=${storeId}`} style={backBtnStyle}><X size={20} /></Link>
      </header>

      {loading ? (
        <div style={loadingTextStyle}>ΣΥΓΧΡΟΝΙΣΜΟΣ ΧΡΗΣΤΩΝ...</div>
      ) : (
        <>
          <p style={sectionLabelStyle}>ΔΙΑΧΕΙΡΙΣΤΕΣ ({admins.length})</p>
          {admins.map(u => (
            <div key={u.user_id} style={adminCardStyle}>
              <div style={{ flex: 1 }}>
                <p style={adminNameStyle}>
                  {u.username.toUpperCase()} {u.user_id === myId ? '(ΕΣΕΙΣ)' : ''}
                </p>
                <p style={adminEmailStyle}>{u.email}</p>
                
                {/* Κουμπί Υποβιβασμού μόνο για άλλους Admins */}
                {u.user_id !== myId && (
                  <button 
                    onClick={() => updatePermission(u.user_id, 'role', 'staff')}
                    style={demoteBtnStyle}
                  >
                    <ChevronDown size={12} /> ΥΠΟΒΙΒΑΣΜΟΣ ΣΕ ΠΡΟΣΩΠΙΚΟ
                  </button>
                )}
              </div>
              <span style={adminBadgeStyle}>FULL ACCESS</span>
            </div>
          ))}

          <div style={{ height: '30px' }} />

          <p style={sectionLabelStyle}>ΠΡΟΣΩΠΙΚΟ ({staff.length})</p>
          {staff.map(u => (
            <div key={u.user_id} style={userCardStyle}>
              <div style={userCardHeaderStyle}>
                <div>
                  <p style={userNameStyle}>{u.username}</p>
                  <p style={userEmailStyle}>{u.email}</p>
                </div>
                <button onClick={() => removeUser(u.user_id)} style={deleteBtnStyle}><Trash2 size={18} color="#ef4444" /></button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <PermissionToggle 
                  label="Ανάλυση" 
                  active={u.can_view_analysis} 
                  onClick={() => updatePermission(u.user_id, 'can_view_analysis', !u.can_view_analysis)} 
                />
                <PermissionToggle 
                  label="Ιστορικό" 
                  active={u.can_view_history} 
                  onClick={() => updatePermission(u.user_id, 'can_view_history', !u.can_view_history)} 
                />
                <PermissionToggle 
                  label="Edit" 
                  active={u.can_edit_transactions} 
                  onClick={() => updatePermission(u.user_id, 'can_edit_transactions', !u.can_edit_transactions)} 
                />
              </div>
              
              <button 
                onClick={() => updatePermission(u.user_id, 'role', 'admin')}
                style={promoteBtnStyle}
              >
                <ChevronUp size={14} /> ΑΝΑΒΑΘΜΙΣΗ ΣΕ ΔΙΑΧΕΙΡΙΣΤΗ
              </button>
            </div>
          ))}

          {staff.length === 0 && (
            <div style={emptyStateStyle}>
              <Users size={32} color="#cbd5e1" style={{marginBottom: '10px'}} />
              <p>Δεν υπάρχουν συνεργάτες.</p>
            </div>
          )}

          <Link href={`/admin/invite?store=${storeId}`} style={inviteBtnStyle}>
            <UserPlus size={20} /> ΠΡΟΣΚΛΗΣΗ ΣΥΝΕΡΓΑΤΗ
          </Link>
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
        borderRadius: '14px',
        fontSize: '11px',
        fontWeight: '800',
        cursor: 'pointer',
        border: '1px solid',
        backgroundColor: active ? '#f0fdf4' : '#f8fafc',
        color: active ? '#166534' : '#94a3b8',
        borderColor: active ? '#bbf7d0' : '#e2e8f0'
      }}
    >
      {label}
    </button>
  )
}

// --- STYLES ---
const containerStyle: any = { maxWidth: '480px', margin: '0 auto', padding: '20px', paddingBottom: '100px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#fef3c7', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const titleStyle: any = { fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' };
const subtitleStyle: any = { margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' };
const backBtnStyle: any = { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const loadingTextStyle: any = { textAlign: 'center', padding: '100px 0', fontWeight: '800', color: '#cbd5e1', letterSpacing: '1px' };
const sectionLabelStyle: any = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', letterSpacing: '1px' };
const adminCardStyle: any = { backgroundColor: '#1e293b', padding: '20px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' };
const adminNameStyle: any = { fontWeight: '900', margin: 0, fontSize: '14px', color: 'white' };
const adminEmailStyle: any = { fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: '700' };
const adminBadgeStyle: any = { color: '#4ade80', fontSize: '10px', fontWeight: '900', backgroundColor: 'rgba(74, 222, 128, 0.1)', padding: '6px 10px', borderRadius: '10px' };
const demoteBtnStyle: any = { background: 'none', border: 'none', color: '#f87171', fontSize: '9px', fontWeight: '800', cursor: 'pointer', padding: 0, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' };
const userCardStyle: any = { backgroundColor: 'white', padding: '24px', borderRadius: '28px', border: '1px solid #e2e8f0', marginBottom: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' };
const userCardHeaderStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' };
const userNameStyle: any = { fontWeight: '900', margin: 0, fontSize: '16px', color: '#0f172a' };
const userEmailStyle: any = { fontSize: '12px', color: '#64748b', margin: '2px 0 0', fontWeight: '600' };
const deleteBtnStyle: any = { background: 'none', border: 'none', cursor: 'pointer', padding: '5px' };
const promoteBtnStyle: any = { width: '100%', padding: '14px', borderRadius: '16px', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '900', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const inviteBtnStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '30px', padding: '18px', backgroundColor: '#0f172a', color: 'white', borderRadius: '20px', textDecoration: 'none', fontWeight: '900', fontSize: '15px' };
const emptyStateStyle: any = { textAlign: 'center', padding: '60px 20px', border: '2px dashed #e2e8f0', borderRadius: '28px', color: '#94a3b8', fontSize: '14px', fontWeight: '700' };

export default function PermissionsPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Suspense fallback={null}><PermissionsContent /></Suspense>
    </main>
  )
}