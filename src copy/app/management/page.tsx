'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { 
  Settings, 
  Users, 
  ShoppingCart, 
  Landmark, 
  Target, 
  ChevronRight, 
  ListTree, 
  ShieldCheck,
  Store,
  Wallet,
  Info
} from 'lucide-react'

/* ---------------- CONFIG ---------------- */

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  indigo: '#6366f1',
  background: '#f8fafc',
  border: '#e2e8f0',
  surface: '#ffffff'
}

/* ---------------- CONTENT ---------------- */

function ManagementContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  // ✅ Ευθυγράμμιση με τα σωστά URL (manage-lists, settlements, goals)
  const menuItems = [
    {
      title: 'Οργάνωση Επιχείρησης',
      items: [
        { 
          label: 'Μητρώο & Συνεργάτες', 
          subLabel: 'Προμηθευτές, Πηγές Εσόδων, Λογαριασμοί, κ.α.',
          icon: <ListTree size={20} />, 
          path: '/manage-lists', 
          color: '#10b981' 
        },
        { 
          label: 'Προσωπικό', 
          subLabel: 'Διαχείριση ομάδας και πληρωμών',
          icon: <Users size={20} />, 
          path: '/employees', 
          color: '#6366f1' 
        },
        
      ]
    },
    {
      title: 'Οικονομικός Έλεγχος',
      items: [
        { 
          label: 'Δάνεια & Ρυθμίσεις', 
          subLabel: 'Παρακολούθηση δόσεων και διακανονισμών',
          icon: <Landmark size={20} />, 
          path: '/settlements', 
          color: '#f59e0b' 
        },
        { 
          label: 'Στόχοι & Κουμπαράδες', 
          subLabel: 'Αποταμίευση για εξοπλισμό και ανάγκες',
          icon: <Target size={20} />, 
          path: '/goals', 
          color: '#7c3aed' 
        },
        { 
          label: 'Καρτέλες Πιστώσεων', 
          subLabel: 'Ανάλυση οφειλών ανά προμηθευτή',
          icon: <Wallet size={20} />, 
          path: '/suppliers-balance', 
          color: '#f43f5e' 
        },
      ]
    },
    {
      title: 'Σύστημα & Βοήθεια',
      items: [
        { 
          label: 'Δικαιώματα Πρόσβασης', 
          subLabel: 'Διαχείριση ρόλων Admin & User',
          icon: <ShieldCheck size={20} />, 
          path: '/permissions', 
          color: '#64748b' 
        },
        { 
          label: 'Οδηγίες Χρήσης', 
          subLabel: 'Αναλυτικό manual εφαρμογής',
          icon: <Info size={20} />, 
          path: '/help', 
          color: '#475569' 
        },
        { 
          label: 'Αλλαγή Καταστήματος', 
          subLabel: 'Επιλογή διαφορετικού business unit',
          icon: <Store size={20} />, 
          path: '/select-store', 
          color: colors.primary 
        },
      ]
    }
  ]

  return (
    <div style={container}>
      <div style={header}>
        <h1 style={headerTitle}>Διαχείριση</h1>
        <p style={headerSub}>Κεντρικός έλεγχος καταστήματος</p>
      </div>

      <div style={content}>
        {menuItems.map((group, idx) => (
          <div key={idx} style={section}>
            <h2 style={sectionTitle}>{group.title}</h2>
            <div style={grid}>
              {group.items.map((item) => (
                <Link 
                  key={item.label} 
                  href={storeId ? `${item.path}?store=${storeId}` : item.path}
                  style={card}
                >
                  <div style={{ ...iconBox, backgroundColor: `${item.color}15`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div style={labelWrap}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={label}>{item.label}</span>
                      <span style={subLabelStyle}>{item.subLabel}</span>
                    </div>
                    <ChevronRight size={16} color={colors.secondary} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ManagementPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Φόρτωση...</div>}>
      <ManagementContent />
    </Suspense>
  )
}

/* ---------------- STYLES ---------------- */

const container: React.CSSProperties = { background: colors.background, minHeight: '100vh', paddingBottom: '110px' }
const header: React.CSSProperties = { padding: '40px 20px 24px 20px', background: colors.surface, borderBottom: `1px solid ${colors.border}` }
const headerTitle: React.CSSProperties = { fontSize: '32px', fontWeight: 900, color: colors.primary, margin: 0, letterSpacing: '-0.02em' }
const headerSub: React.CSSProperties = { fontSize: '15px', color: colors.secondary, marginTop: '4px', fontWeight: 600 }
const content: React.CSSProperties = { padding: '24px 16px', maxWidth: '600px', margin: '0 auto' }
const section: React.CSSProperties = { marginBottom: '32px' }
const sectionTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 800, color: colors.secondary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px', marginLeft: '4px' }
const grid: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '10px' }
const card: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '18px', background: colors.surface, borderRadius: '20px', textDecoration: 'none', border: `1px solid ${colors.border}`, transition: 'all 0.2s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }
const iconBox: React.CSSProperties = { width: '46px', height: '46px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }
const labelWrap: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }
const label: React.CSSProperties = { fontSize: '16px', fontWeight: 800, color: colors.primary, lineHeight: 1.2 }
const subLabelStyle: React.CSSProperties = { fontSize: '12px', color: colors.secondary, fontWeight: 500, marginTop: '2px' }