'use client'
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast, Toaster } from 'sonner';
import { X, Plus, Trash2, Users, Receipt, Wrench, Package, Store, ChevronLeft } from 'lucide-react';
import { Suspense } from 'react';

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
};

type CategoryTab = 'suppliers' | 'staff' | 'utility' | 'worker' | 'other';

function ManageListsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('store') || '';

  const [activeTab, setActiveTab] = useState<CategoryTab>('suppliers');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      let data, error;
      if (activeTab === 'suppliers') {
        ({ data, error } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('store_id', storeId)
          .order('name'));
      } else {
        ({ data, error } = await supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', storeId)
          .eq('sub_category', activeTab)
          .order('name'));
      }
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [storeId, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setIsAdding(true);
    try {
      let error;
      if (activeTab === 'suppliers') {
        ({ error } = await supabase.from('suppliers').insert([
          { name: newItemName.trim().toUpperCase(), store_id: storeId, is_active: true }
        ]));
      } else {
        ({ error } = await supabase.from('fixed_assets').insert([
          { name: newItemName.trim().toUpperCase(), store_id: storeId, sub_category: activeTab }
        ]));
      }
      if (error) throw error;
      toast.success('Προστέθηκε επιτυχώς!');
      setNewItemName('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Είσαι σίγουρος για τη διαγραφή;')) return;
    try {
      const table = activeTab === 'suppliers' ? 'suppliers' : 'fixed_assets';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Διαγράφηκε!');
      fetchData();
    } catch (e: any) {
      toast.error('Δεν μπορεί να διαγραφεί αν έχει ήδη κινήσεις.');
    }
  };

  const tabs = [
    { id: 'suppliers', label: 'Προμηθ.', icon: <Store size={16} /> },
    { id: 'staff', label: 'Προσωπ.', icon: <Users size={16} /> },
    { id: 'utility', label: 'Λογαρ.', icon: <Receipt size={16} /> },
    { id: 'worker', label: 'Μάστορ.', icon: <Wrench size={16} /> },
    { id: 'other', label: 'Λοιπά', icon: <Package size={16} /> },
  ];

  return (
    <div style={containerStyle}>
      <Toaster position="top-center" richColors />
      
      {/* HEADER */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Διαχείριση</h1>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div style={tabsWrapper}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id as CategoryTab)}
            style={{
              ...tabItem,
              borderBottom: activeTab === tab.id ? `3px solid ${colors.accentBlue}` : 'none',
              color: activeTab === tab.id ? colors.accentBlue : colors.secondaryText,
            }}
          >
            {tab.icon}
            <span style={{ fontSize: 11, fontWeight: 700 }}>{tab.label}</span>
          </div>
        ))}
      </div>

      {/* ADD NEW ITEM SECTION */}
      <div style={addBox}>
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={`Όνομα νέου ${activeTab === 'suppliers' ? 'προμηθευτή' : 'στοιχείου'}...`}
          style={inputStyle}
        />
        <button onClick={handleAdd} disabled={isAdding} style={addBtn}>
          {isAdding ? '...' : <Plus size={24} />}
        </button>
      </div>

      {/* LIST SECTION */}
      <div style={listWrapper}>
        {loading ? (
          <p style={{ textAlign: 'center', color: colors.secondaryText }}>Φόρτωση...</p>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', color: colors.secondaryText, padding: 20 }}>Η λίστα είναι κενή.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={itemRow}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
              <button onClick={() => handleDelete(item.id)} style={deleteBtn}>
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- STYLES ---
const containerStyle: any = { backgroundColor: '#f8fafc', minHeight: '100vh', padding: '20px' };
const headerStyle = { marginBottom: 20 };
const backBtnStyle: any = { padding: 8, backgroundColor: 'white', borderRadius: 10, border: `1px solid ${colors.border}`, display: 'flex', color: colors.primaryDark };
const tabsWrapper = { display: 'flex', gap: 5, backgroundColor: 'white', padding: '10px 5px', borderRadius: 15, marginBottom: 20, overflowX: 'auto' as const };
const tabItem: any = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', paddingBottom: 5, minWidth: '65px' };
const addBox = { display: 'flex', gap: 10, marginBottom: 20 };
const inputStyle: any = { flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 16, fontWeight: 600, outline: 'none' };
const addBtn: any = { width: 50, height: 50, backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const listWrapper = { backgroundColor: 'white', borderRadius: 20, border: `1px solid ${colors.border}`, overflow: 'hidden' };
const itemRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${colors.border}` };
const deleteBtn = { background: 'none', border: 'none', color: colors.accentRed, cursor: 'pointer' };

export default function ManageListsPage() {
  return (
    <Suspense fallback={null}>
      <ManageListsContent />
    </Suspense>
  );
}