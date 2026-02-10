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
  border: '#e2e8f0',
  hoverBg: '#f8fafc',
  cardBg: '#ffffff'
};

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  // ΑΥΤΟΜΑΤΙΣΜΟΣ: Σιωπηλό φρεσκάρισμα συνεδρίας όταν ανοίγει το μενού
  useEffect(() => {
    if (isOpen) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          router.refresh();
        }
      });
    }
  }, [isOpen, router]);

  const handleLogout = async () => {
    // Κανονική αποσύνδεση με πλήρη καθαρισμό
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    // Καθαρισμός Cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
    })
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
      {/* ΤΟ ΚΟΥΜΠΙ [⋮] ΣΤΑ ΔΕΞΙΑ */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
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
        }}
      >
        ⋮
      </button>

      {isOpen && (
        <>
          {/* Layer για να κλείνει όταν πατάς έξω */}
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
            onClick={() => setIsOpen(false)} 
          />
          
          <div style={{
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
          }}>
            <p style={{ 
              fontSize: '10px', 
              color: colors.secondaryText, 
              fontWeight: '800', 
              padding: '10px 20px 5px', 
              margin: 0, 
              textTransform: 'uppercase', 
              letterSpacing: '1px' 
            }}>
              Διαχείριση
            </p>

            {menuItems.map((item, index) => (
              <div key={item.label}>
                <Link 
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    textDecoration: 'none',
                    color: colors.primaryDark,
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </Link>
                {/* Διαχωριστικές γραμμές για οργάνωση */}
                {(index === 2 || index === 4) && (
                  <div style={{ height: '1px', backgroundColor: colors.border, margin: '5px 15px' }} />
                )}
              </div>
            ))}

            <div style={{ padding: '10px 15px' }}>
              <button 
                onClick={handleLogout}
                style={{
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
                }}
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