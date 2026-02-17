'use client'
import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const colors = {
  primary: '#0f172a',    
  secondary: '#94a3b8',
  indigo: '#6366f1',
  background: 'rgba(255, 255, 255, 0.85)',
  border: '#f1f5f9'
}

const navItems = [
  { label: 'Αρχική', icon: '🏠', path: '/' },
  { label: 'Ανάλυση', icon: '📊', path: '/analysis' },
  { label: 'Καρτέλες', icon: '🚩', path: '/suppliers-balance' },
  { label: 'Προσωπικό', icon: '👤', path: '/employees' },
  { label: 'Προμηθευτές', icon: '🛒', path: '/suppliers' },
];

function NavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // State για ΟΛΑ τα δικαιώματα
  const [permissions, setPermissions] = useState({
    canViewAnalysis: false,
    canViewHistory: false,
    canEditTransactions: false
  });

  const storeInUrl = searchParams.get('store');
  const storeInStorage = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null;
  const storeId = storeInUrl || storeInStorage;

  useEffect(() => {
    const checkPermissions = async () => {
      if (!storeId) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Τραβάμε και τα 3 δικαιώματα από τη βάση
        const { data, error } = await supabase
          .from('store_access')
          .select('role, can_view_analysis, can_view_history, can_edit_transactions')
          .eq('store_id', storeId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching permissions:', error);
          return;
        }

        if (data) {
          // 2. Αν είναι ADMIN -> Όλα TRUE
          if (data.role === 'admin') {
            setPermissions({
              canViewAnalysis: true,
              canViewHistory: true,
              canEditTransactions: true
            });
          } else {
            // 3. Αν είναι USER -> Ό,τι λέει η βάση
            setPermissions({
              canViewAnalysis: data.can_view_analysis === true,
              canViewHistory: data.can_view_history === true,
              canEditTransactions: data.can_edit_transactions === true
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    checkPermissions();
  }, [storeId]);

  // Σελίδες όπου το BottomNav κρύβεται
  const hideOnPaths = ['/login', '/register', '/signup', '/select-store'];
  const isFormPage = pathname.includes('/add-');
  
  if (hideOnPaths.includes(pathname) || isFormPage) return null;

  // 4. ΦΙΛΤΡΑΡΙΣΜΑ ΜΕΝΟΥ
  const visibleNavItems = navItems.filter(item => {
    // Κρύβουμε την Ανάλυση αν δεν έχει δικαίωμα
    if (item.label === 'Ανάλυση') {
      return permissions.canViewAnalysis;
    }
    // Εδώ μπορείς να κρύψεις κι άλλα αν θέλεις μελλοντικά
    // π.χ. αν το Ιστορικό ήταν tab, θα έβαζες: if (item.label === 'Ιστορικό') return permissions.canViewHistory;
    
    return true; // Τα υπόλοιπα εμφανίζονται κανονικά
  });

  return (
    <nav style={navWrapper}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        .nav-item { transition: transform 0.2s ease; -webkit-tap-highlight-color: transparent; }
        .nav-item:active { transform: scale(0.9); }
      `}} />

      {visibleNavItems.map((item) => {
        const isActive = pathname === item.path;
        const fullPath = storeId ? `${item.path}?store=${storeId}` : item.path;

        return (
          <Link key={item.path} href={fullPath} style={navLink} className="nav-item">
            <div style={{
              ...iconBox,
              backgroundColor: isActive ? '#f1f5f9' : 'transparent',
            }}>
              <span style={{ 
                fontSize: '22px', 
                filter: isActive ? 'grayscale(0)' : 'grayscale(1)',
                opacity: isActive ? 1 : 0.5,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}>
                {item.icon}
              </span>
            </div>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: isActive ? '800' : '600', 
              color: isActive ? colors.primary : colors.secondary,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginTop: '4px'
            }}>
              {item.label.toUpperCase()}
            </span>
            {isActive && <div style={activeIndicator} />}
          </Link>
        );
      })}
    </nav>
  );
}

export default function BottomNav() {
  return (
    <Suspense fallback={null}>
      <NavContent />
    </Suspense>
  );
}

// --- STYLES ---
const navWrapper: React.CSSProperties = { 
  position: 'fixed', 
  bottom: 0, 
  left: 0, 
  right: 0, 
  height: '85px', 
  backgroundColor: colors.background, 
  backdropFilter: 'blur(15px)', 
  WebkitBackdropFilter: 'blur(15px)', 
  borderTop: `1px solid ${colors.border}`, 
  display: 'flex', 
  justifyContent: 'space-around', 
  alignItems: 'center', 
  paddingBottom: '20px', 
  zIndex: 1000, 
  boxShadow: '0 -10px 30px rgba(0,0,0,0.03)' 
};

const navLink: React.CSSProperties = { 
  display: 'flex', 
  flexDirection: 'column', 
  alignItems: 'center', 
  textDecoration: 'none', 
  position: 'relative', 
  flex: 1, 
  height: '100%', 
  justifyContent: 'center' 
};

const iconBox: React.CSSProperties = { 
  width: '40px', 
  height: '32px', 
  borderRadius: '12px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  transition: 'background-color 0.3s ease' 
};

const activeIndicator: React.CSSProperties = { 
  position: 'absolute', 
  bottom: '10px', 
  width: '4px', 
  height: '4px', 
  backgroundColor: colors.indigo, 
  borderRadius: '50%', 
  boxShadow: `0 0 10px ${colors.indigo}` 
};