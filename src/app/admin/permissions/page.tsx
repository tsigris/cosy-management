'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ShieldCheck, X, Settings, UserPlus, Trash2 } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'

function PermissionsContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [myId, setMyId] = useState('')

  // 1. ΦΟΡΤΩΣΗ ΔΕΔΟΜΕΝΩΝ
  const fetchPermissionsData = useCallback(async () => {
    // Αν λείπει το storeId, μην κολλάς, στείλε τον χρήστη να διαλέξει μαγαζί
    if (!storeId) {
      router.push('/select-store')
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      setMyId(user.id)

      const { data: accessData, error: accErr } = await supabase
        .from('store_access')
        .select('user_id, role, can_view_analysis, can_view_history, can_edit_transactions, store_id')
        .eq('store_id', storeId);

      if (accErr) throw accErr;

      const safeAccessData = Array.isArray(accessData) ? accessData : []
      const userIds = safeAccessData
        .map((a: any) => a?.user_id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)

      if (safeAccessData.length === 0) {
        setUsers([])
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);

      const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p]) || []);

      const combinedData = safeAccessData.map((entry: any) => ({
        ...entry,
        username: profileMap?.[entry?.user_id]?.username || 'Χρήστης',
        email: profileMap?.[entry?.user_id]?.email || '---'
      }));

      setUsers(combinedData);
    } catch (err: any) {
      toast.error('Αποτυχία συγχρονισμού');
    } finally {
      setLoading(false)
    }
  }, [storeId, router])

  useEffect(() => {
    fetchPermissionsData()
  }, [fetchPermissionsData])

  // 2. ΕΝΗΜΕΡΩΣΗ ΔΙΚΑΙΩΜΑΤΩΝ
  const updatePermission = async (field: string) => {
    if (!selectedUser || !storeId) return;
    const newValue = !selectedUser[field];

    const { data: adminCheck } = await supabase
      .from('store_access')
      .select('role')
      .eq('user_id', myId)
      .eq('store_id', storeId)
      .single();

    if (adminCheck?.role !== 'admin') {
      toast.error('Μη εξουσιοδοτημένη ενέργεια. Απαιτούνται δικαιώματα Admin.');
      return;
    }
    
    // Optimistic UI update
    const updatedUser = { ...selectedUser, [field]: newValue };
    setSelectedUser(updatedUser);
    setUsers((prev) => (Array.isArray(prev) ? prev.map((u) => (u?.user_id === selectedUser?.user_id ? updatedUser : u)) : []));

    const { error } = await supabase
      .from('store_access')
      .update({ [field]: newValue })
      .eq('user_id', selectedUser.user_id)
      .eq('store_id', storeId);

    if (error) {
      toast.error("Σφάλμα στην ενημέρωση");
      fetchPermissionsData(); // Rollback σε περίπτωση σφάλματος
    } else {
      toast.success("Η αλλαγή αποθηκεύτηκε");
    }
  };

  // 3. ΔΙΑΓΡΑΦΗ ΧΡΗΣΤΗ
  const removeUser = async (userId: string) => {
    if (!storeId) return toast.error('Σφάλμα καταστήματος')
    if (userId === myId) return toast.error("Δεν μπορείτε να αφαιρέσετε τον εαυτό σας");
    if (!confirm('Οριστική αφαίρεση πρόσβασης;')) return;

    const { data: adminCheck } = await supabase
      .from('store_access')
      .select('role')
      .eq('user_id', myId)
      .eq('store_id', storeId)
      .single();

    if (adminCheck?.role !== 'admin') {
      toast.error('Μη εξουσιοδοτημένη ενέργεια. Απαιτούνται δικαιώματα Admin.');
      return;
    }

    const { error } = await supabase
      .from('store_access')
      .delete()
      .eq('user_id', userId)
      .eq('store_id', storeId);

    if (!error) {
      setUsers((prev) => (Array.isArray(prev) ? prev.filter((u) => u?.user_id !== userId) : []));
      toast.success("Ο χρήστης αφαιρέθηκε");
    }
  };

  const safeUsers = Array.isArray(users) ? users : []
  const admins = safeUsers.filter(u => u?.role === 'admin');
  const staff = safeUsers.filter(u => u?.role !== 'admin');

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
        <Link href={`/?store=${storeId}`} style={closeBtnStyle}><X size={20} /></Link>
      </header>

      {loading ? (
        <div style={loadingTextStyle}>ΣΥΓΧΡΟΝΙΣΜΟΣ ΧΡΗΣΤΩΝ...</div>
      ) : (
        <div style={{ paddingBottom: '100px' }}> {/* Padding για το BottomNav */}
          <p style={sectionLabel}>ΔΙΑΧΕΙΡΙΣΤΕΣ</p>
          {admins?.length > 0 ? admins.map((u: any) => (
            <div key={u.user_id} style={adminCard}>
              <div style={{ flex: 1 }}>
                <p style={adminNameText}>{String(u?.username || 'Χρήστης').toUpperCase()} {u?.user_id === myId ? '(ΕΣΕΙΣ)' : ''}</p>
                <p style={adminEmailText}>{u?.email || '---'}</p>
              </div>
              <span style={adminBadge}>FULL ACCESS</span>
            </div>
          )) : <div style={loadingTextStyle}>Δεν βρέθηκαν διαχειριστές</div>}

          <div style={{ height: '30px' }} />

          <p style={sectionLabel}>ΠΡΟΣΩΠΙΚΟ / ΣΥΝΕΡΓΑΤΕΣ ({staff.length})</p>
          <div style={listContainer}>
            {staff?.length > 0 ? staff.map((u: any) => (
              <div key={u.user_id} style={staffRow}>
                <div style={{ flex: 1 }}>
                  <p style={{fontWeight:'900', margin:0, fontSize:'15px', color:'#0f172a'}}>{u?.username || 'Χρήστης'}</p>
                  <div style={{display:'flex', gap:'5px', marginTop:'4px'}}>
                    {u?.can_view_analysis && <span>📊</span>}
                    {u?.can_view_history && <span>🏠</span>}
                    {u?.can_edit_transactions && <span>✏️</span>}
                  </div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => setSelectedUser(u)} style={editBtnStyle}><Settings size={18} /></button>
                    <button onClick={() => removeUser(String(u?.user_id || ''))} style={delBtnStyle}><Trash2 size={18} /></button>
                </div>
              </div>
            )) : <div style={loadingTextStyle}>Δεν βρέθηκαν συνεργάτες</div>}
          </div>

          <Link href={`/manage-users?store=${storeId}`} style={inviteBtn}>
            <UserPlus size={20} /> ΔΙΑΧΕΙΡΙΣΗ ΧΡΗΣΤΩΝ
          </Link>
        </div>
      )}

      {/* MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ */}
      {selectedUser && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{margin:0, fontWeight:'900'}}>Δικαιώματα</h3>
            <p style={{fontSize:'12px', color:'#64748b', marginBottom:'20px'}}>{selectedUser?.username || 'Χρήστης'}</p>
            
            <PermissionToggle label="📊 Ανάλυση" active={selectedUser?.can_view_analysis === true} onClick={() => updatePermission('can_view_analysis')} />
            <PermissionToggle label="🏠 Ιστορικό" active={selectedUser?.can_view_history === true} onClick={() => updatePermission('can_view_history')} />
            <PermissionToggle label="✏️ Επεξεργασία" active={selectedUser?.can_edit_transactions === true} onClick={() => updatePermission('can_edit_transactions')} />

            <button onClick={() => setSelectedUser(null)} style={closeModalBtn}>ΚΛΕΙΣΙΜΟ</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PermissionToggle({ label, active, onClick }: any) {
  return (
    <div style={toggleRow}>
      <span style={{fontSize:'14px', fontWeight:'700'}}>{label}</span>
      <button onClick={onClick} style={{...toggleBtn, backgroundColor: active ? '#10b981' : '#e2e8f0', transition: 'all 0.3s'}}>
        {active ? 'ΝΑΙ' : 'ΟΧΙ'}
      </button>
    </div>
  )
}

export default function PermissionsPage() {
  return (
    <main style={{backgroundColor:'#f8fafc', minHeight:'100vh'}}>
      <ErrorBoundary>
        <Suspense fallback={<div style={loadingTextStyle}>Φόρτωση δικαιωμάτων...</div>}>
          <PermissionsContent />
        </Suspense>
      </ErrorBoundary>
    </main>
  )
}

// --- STYLES (Παραμένουν ως έχουν) ---
const containerStyle: any = { maxWidth: '480px', margin: '0 auto', padding: '20px' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#fef3c7', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const titleStyle = { fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' };
const subtitleStyle = { fontSize: '10px', color: '#94a3b8', fontWeight: '800', margin: 0 };
const closeBtnStyle: any = { padding: '8px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' };
const loadingTextStyle: any = { textAlign: 'center', padding: '100px 0', fontWeight: '800', color: '#cbd5e1' };
const sectionLabel = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' as const };
const adminCard: any = { backgroundColor: '#1e293b', padding: '20px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' };
const adminNameText = { color: 'white', fontWeight: '900', margin: 0, fontSize: '15px' };
const adminEmailText = { color: '#94a3b8', fontSize: '11px', margin: 0, fontWeight: '700' };
const adminBadge = { color: '#4ade80', fontSize: '10px', fontWeight: '900', border: '1px solid #166534', padding: '5px 10px', borderRadius: '10px' };
const listContainer: any = { backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const staffRow: any = { padding: '18px 20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9' };
const editBtnStyle: any = { backgroundColor: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer' };
const delBtnStyle: any = { ...editBtnStyle, backgroundColor: '#fee2e2', color: '#ef4444' };
const inviteBtn: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '30px', padding: '18px', backgroundColor: '#0f172a', color: 'white', borderRadius: '20px', fontWeight: '900', textDecoration: 'none' };
const modalOverlay: any = { position: 'fixed', top:0, left:0, width:'100%', height:'100%', backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 1000, backdropFilter: 'blur(4px)' };
const modalContent: any = { backgroundColor:'white', padding:'30px', borderRadius:'28px', width:'90%', maxWidth:'350px' };
const toggleRow = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 0', borderBottom:'1px solid #f1f5f9' };
const toggleBtn: any = { border:'none', color:'white', padding:'8px 15px', borderRadius:'10px', fontWeight:'900', cursor:'pointer', minWidth:'65px', fontSize:'11px' };
const closeModalBtn: any = { width:'100%', padding:'16px', backgroundColor:'#0f172a', color:'white', borderRadius:'15px', border:'none', fontWeight:'900', marginTop:'20px', cursor:'pointer' };