'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Home', icon: '🏠', path: '/' },
  { label: 'Ανάλυση', icon: '📊', path: '/analysis' },
  { label: 'Καρτέλες', icon: '🚩', path: '/suppliers-balance' },
  { label: 'Υπάλληλοι', icon: '👥', path: '/employees' },
  { label: 'Προμηθευτές', icon: '🛒', path: '/suppliers' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav style={navWrapper}>
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link key={item.path} href={item.path} style={navLink}>
            <span style={{ 
              fontSize: '22px', 
              filter: isActive ? 'grayscale(0)' : 'grayscale(1)',
              opacity: isActive ? 1 : 0.6,
              transform: isActive ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              marginBottom: '4px'
            }}>
              {item.icon}
            </span>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '800', 
              color: isActive ? '#1e293b' : '#94a3b8',
              transition: 'color 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              {item.label}
            </span>
            {isActive && <div style={activeIndicator} />}
          </Link>
        );
      })}
    </nav>
  );
}

// --- STYLES ---
const navWrapper: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: '80px',
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(15px)',
  WebkitBackdropFilter: 'blur(15px)', // Για υποστήριξη iOS Safari
  borderTop: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  paddingBottom: '20px', // Χώρος για το Home Indicator του iPhone (Safe Area)
  zIndex: 1000,
  boxShadow: '0 -5px 25px rgba(0,0,0,0.04)',
};

const navLink: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textDecoration: 'none',
  position: 'relative',
  flex: 1,
  height: '100%',
  justifyContent: 'center',
};

const activeIndicator: React.CSSProperties = {
  position: 'absolute',
  bottom: '12px',
  width: '5px',
  height: '5px',
  backgroundColor: '#1e293b',
  borderRadius: '50%',
};