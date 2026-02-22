'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// --- MODERN PROFESSIONAL PALETTE ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentRed: '#dc2626',
  accentBlue: '#2563eb',
  border: '#e2e8f0',
  hoverBg: '#f8fafc',
  cardBg: '#ffffff'
};

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // ΔΙΑΒΑΖΟΥΜΕ ΤΟ ΤΡΕΧΟΝ ID ΑΠΟ ΤΟ URL ΓΙΑ ΝΑ ΤΟ ΜΕΤΑΦΕΡΟΥΜΕ ΣΤΑ LINKS
  const currentStoreId = searchParams.get('store')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('active_store_id')
    sessionStorage.clear()
    window.location.href = '/login'
  }

  // ΛΙΣΤΑ ΜΕΝΟΥ
  const menuItems = [
    { label: 'Υπάλληλοι', icon: '👥', path: '/employees' },
    { label: 'Προμηθευτές', icon: '🛒', path: '/suppliers' },
    { label: 'Πάγια', icon: '🔌', path: '/fixed-assets' },
    { label: 'Καρτέλες', icon: '🚩', path: '/suppliers-balance' },
    { label: 'Ανάλυση', icon: '📊', path: '/analysis' },
    { label: 'Δικαιώματα', icon: '🔐', path: '/permissions' },
    { label: 'Συνδρομή', icon: '💳', path: '/subscription' },
    { label: 'Ρυθμίσεις', icon: '⚙️', path: '/settings' },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={btnStyle}
      >
        ⋮
      </button>

      {isOpen && (
        <>
          {/* Backdrop για κλείσιμο του μενού */}
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
            onClick={() => setIsOpen(false)} 
          />
          
          <div style={dropdownStyle}>
            <p style={sectionLabel}>Διαχείριση</p>

            {menuItems.map((item, index) => {
              // ΠΡΟΣΘΗΚΗ ΤΟΥ STORE ID ΣΤΟ LINK ΓΙΑ ΝΑ ΜΗ ΧΑΝΕΤΑΙ ΤΟ ΚΑΤΑΣΤΗΜΑ
              const fullPath = currentStoreId 
                ? `${item.path}?store=${currentStoreId}` 
                : item.path;

              return (
                <div key={item.label}>
                  <Link 
                    href={fullPath}
                    onClick={() => setIsOpen(false)}
                    style={linkStyle}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                  {/* Διαχωριστικά για οργάνωση */}
                  {(index === 2 || index === 4) && (
                    <div style={dividerStyle} />
                  )}
                </div>
              )
            })}

            <div style={dividerStyle} />
            <div style={{ padding: '10px 15px' }}>
              <button 
                onClick={handleLogout}
                style={logoutBtnStyle}
              >
                ΑΠΟΣΥΝΔΕΣΗ 🚪
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- CSS-IN-JS STYLES ---
const btnStyle: any = {
  backgroundColor: colors.cardBg,
  border: `1px solid ${colors.border}`,
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  cursor: 'pointer',
  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primaryDark,
  fontSize: '20px',
  outline: 'none'
};

const dropdownStyle: any = {
  position: 'absolute',
  top: '50px',
  right: '0',
  backgroundColor: colors.cardBg,
  minWidth: '220px',
  borderRadius: '18px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
  border: `1px solid ${colors.border}`,
  zIndex: 999,
  padding: '10px 0',
  overflow: 'hidden'
};

const sectionLabel: any = { 
  fontSize: '10px', 
  color: colors.secondaryText, 
  fontWeight: '800', 
  padding: '10px 20px 5px', 
  margin: 0, 
  textTransform: 'uppercase', 
  letterSpacing: '1px' 
};

const linkStyle: any = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 20px',
  textDecoration: 'none',
  color: colors.primaryDark,
  fontSize: '14px',
  fontWeight: '600',
  transition: 'background 0.2s',
  border: 'none',
  background: 'none',
  width: '100%',
  cursor: 'pointer'
};

const dividerStyle: any = { 
  height: '1px', 
  backgroundColor: colors.border, 
  margin: '5px 15px' 
};

const logoutBtnStyle: any = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#fee2e2',
  color: colors.accentRed,
  border: 'none',
  borderRadius: '12px',
  fontWeight: '800',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '13px'
};