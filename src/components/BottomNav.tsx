'use client'
import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ui } from '@/lib/uiTheme';
import { resolveActiveStoreId } from '@/lib/storeResolution';

const colors = {
  primary: ui.text,
  secondary: ui.muted,
  indigo: '#6366f1', // Accent color remains
  background: ui.surface,
  border: ui.border,
};

// ✅ Επαναφορά των Emojis και προσθήκη του ⚙️ για τη Διαχείριση
const navItems = [
  { label: 'Αρχική', icon: '🏠', path: '/' },
  { label: 'Οικονομικά', icon: '📊', path: '/economics' },
  { label: 'Καρτέλες', icon: '🚩', path: '/suppliers-balance' },
  { label: 'Προσωπικό', icon: '👤', path: '/employees' },
  { label: 'Διαχείριση', icon: '⚙️', path: '/management' },
];

function NavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const storeId = resolveActiveStoreId(searchParams);

  const hideOnPaths = ['/login', '/register', '/signup', '/select-store'];
  const isFormPage = pathname.includes('/add-');
  
  if (hideOnPaths.includes(pathname) || isFormPage) return null;

  return (
    <nav style={navWrapper}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        .nav-item { transition: transform 0.2s ease; -webkit-tap-highlight-color: transparent; }
        .nav-item:active { transform: scale(0.9); }
      `}} />

      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const fullPath = storeId ? `${item.path}?store=${storeId}` : item.path;

        return (
          <Link key={item.path} href={fullPath} style={navLink} className="nav-item">
            <div style={{
              ...iconBox,
              backgroundColor: isActive ? 'var(--surfaceSolid)' : 'transparent',
            }}>
              <span style={{ 
                fontSize: '22px', 
                filter: isActive ? 'grayscale(0)' : 'grayscale(1)',
                opacity: isActive ? 1 : 0.5,
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'block',
                color: isActive ? 'var(--text)' : 'var(--muted)',
              }}>
                {item.icon}
              </span>
            </div>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: isActive ? '800' : '600', 
              color: isActive ? 'var(--text)' : 'var(--muted)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginTop: '4px',
              letterSpacing: '0.02em'
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
  backgroundColor: 'var(--surface)', 
  backdropFilter: 'blur(15px)', 
  WebkitBackdropFilter: 'blur(15px)', 
  borderTop: `1px solid var(--border)`, 
  display: 'flex', 
  justifyContent: 'space-around', 
  alignItems: 'center', 
  paddingBottom: '20px', 
  zIndex: 1000, 
  boxShadow: 'var(--shadow)' 
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
  width: '42px', 
  height: '32px', 
  borderRadius: '12px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  transition: 'all 0.3s ease' 
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