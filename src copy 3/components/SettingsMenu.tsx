'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Επαγγελματική παλέτα για ομοιομορφία
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
  const [isSecure, setIsSecure] = useState(false)
  const router = useRouter()

  // Έλεγχος κατάστασης ασφαλείας όταν ανοίγει το μενού
  useEffect(() => {
    const pinEnabled = localStorage.getItem('fleet_track_pin_enabled') === 'true'
    const bioEnabled = localStorage.getItem('fleet_track_biometrics') === 'true'
    setIsSecure(pinEnabled || bioEnabled)
  }, [isOpen])

  // ΑΥΤΟΜΑΤΙΣΜΟΣ: Σιωπηλό φρεσκάρισμα συνεδρίας
  useEffect(() => {
    if (isOpen) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.refresh();
        }
      });
    }
  }, [isOpen, router]);

  const toggleSecurity = async () => {
    const currentStatus = localStorage.getItem('fleet_track_pin_enabled') === 'true'
    
    if (!currentStatus) {
      // Ενεργοποίηση
      const pin = prompt("Ορίστε ένα 4ψήφιο PIN για αυτή τη συσκευή:");
      if (pin && pin.length === 4) {
        localStorage.setItem('fleet_track_pin', pin);
        localStorage.setItem('fleet_track_pin_enabled', 'true');
        // Προαιρετικά ενεργοποιούμε και τα βιομετρικά αν υποστηρίζονται
        if (window.PublicKeyCredential) {
          localStorage.setItem('fleet_track_biometrics', 'true');
        }
        setIsSecure(true);
        alert('Η γρήγορη είσοδος ενεργοποιήθηκε!');
      } else {
        alert('Ακυρώθηκε. Το PIN πρέπει να είναι 4 ψηφία.');
      }
    } else {
      // Απενεργοποίηση
      if (confirm('Απενεργοποίηση γρήγορης εισόδου;')) {
        localStorage.removeItem('fleet_track_pin');
        localStorage.removeItem('fleet_track_pin_enabled');
        localStorage.removeItem('fleet_track_biometrics');
        setIsSecure(false);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // Διατηρούμε τα κλειδιά ασφαλείας, σβήνουμε μόνο τα session δεδομένα
    localStorage.removeItem('supabase.auth.token')
    sessionStorage.clear()
    window.location.href = '/login'
  }

  const menuItems = [
    { label: 'Υπάλληλοι', icon: '👥', path: '/employees' },
    { label: 'Προμηθευτές', icon: '🛒', path: '/suppliers' },
    { label: 'Πάγια', icon: '🔌', path: '/fixed-assets' },
    { label: 'Καρτέλες', icon: '🚩', path: '/suppliers-balance' },
    { label: 'Ανάλυση', icon: '📊', path: '/analysis' },
    { label: 'Δικαιώματα', icon: '🔐', path: '/admin/permissions' },
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
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
            onClick={() => setIsOpen(false)} 
          />
          
          <div style={dropdownStyle}>
            <p style={sectionLabel}>Διαχείριση</p>

            {menuItems.map((item, index) => (
              <div key={item.label}>
                <Link 
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  style={linkStyle}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </Link>
                {(index === 2 || index === 4) && (
                  <div style={dividerStyle} />
                )}
              </div>
            ))}

            <div style={dividerStyle} />
            <p style={sectionLabel}>Ασφάλεια Συσκευής</p>
            
            <button 
              onClick={toggleSecurity}
              style={{
                ...linkStyle,
                width: '100%',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: isSecure ? colors.accentBlue : colors.primaryDark
              }}
            >
              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>
                {isSecure ? '🛡️' : '🔓'}
              </span>
              {isSecure ? 'Αλλαγή/Απενεργ. PIN' : 'Ενεργοποίηση PIN'}
            </button>

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

// --- CSS IN JS STYLES ---
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
  transition: 'background 0.2s'
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