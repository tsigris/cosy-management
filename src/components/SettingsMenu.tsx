'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuItems = [
    { label: 'Υπάλληλοι', icon: '👤', path: '/employees' },
    { label: 'Προμηθευτές', icon: '🛒', path: '/suppliers' },
    { label: 'Πάγια', icon: '🔄', path: '/fixed-assets' },
    { label: 'Καρτέλες', icon: '🚩', path: '/suppliers-balance' },
    { label: 'Ανάλυση', icon: '📈', path: '/analysis' },
    { label: 'Δικαιώματα', icon: '🔒', path: '/permissions' },
    { label: 'Συνδρομή', icon: '💳', path: '/subscription' },
    { label: 'Ρυθμίσεις', icon: '⚙️', path: '/settings' },
  ]

  return (
    <div style={{ position: 'relative' }}>
      {/* ΤΟ ΚΟΥΜΠΙ [+] ΣΤΑ ΔΕΞΙΑ */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          padding: '8px 14px',
          borderRadius: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#475569' }}>+</span>
        <span style={{ fontSize: '10px', color: '#475569' }}>▼</span>
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
            top: '55px',
            right: '0', // Εμφάνιση προς τα αριστερά αφού το κουμπί είναι δεξιά
            backgroundColor: 'white',
            minWidth: '220px',
            borderRadius: '18px',
            boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
            border: '1px solid #f1f5f9',
            zIndex: 999,
            padding: '10px 0',
            overflow: 'hidden'
          }}>
            <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '800', padding: '10px 20px', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
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
                    color: '#334155',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  {item.label}
                </Link>
                {/* Διαχωριστική γραμμή μετά τα Πάγια και μετά την Ανάλυση */}
                {(index === 2 || index === 4) && <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '5px 0' }} />}
              </div>
            ))}

            <div style={{ padding: '8px 12px' }}>
              <button 
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#fee2e2',
                  color: '#ef4444',
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