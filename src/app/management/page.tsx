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
  BookOpen, 
  ShieldCheck,
  Store,
  Wallet
} from 'lucide-react'

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  indigo: '#6366f1',
  background: '#f8fafc',
  border: '#e2e8f0',
  surface: '#ffffff'
}

function ManagementContent() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const menuItems = [
    {
      title: 'Βασική Διαχείριση',
      items: [
        { label: 'Προμηθευτές', icon: <ShoppingCart size={20} />, path: '/suppliers', color: '#0ea5e9' },
        { label: 'Προσωπικό', icon: <Users size={20} />, path: '/employees', color: '#6366f1' },
        { label: 'Κατάλογοι & Μενού', icon: <BookOpen size={20} />, path: '/categories', color: '#10b981' },
      ]
    },
    {
      title: 'Οικονομικός Προγραμματισμός',
      items: [
        { label: 'Δάνεια & Ρυθμίσεις', icon: <Landmark size={20} />, path: '/loans', color: '#f59e0b' },
        { label: 'Στόχοι & Κουμπαράδες', icon: <Target size={20} />, path: '/savings', color: '#7c3aed' },
        { label: 'Καρτέλες Πιστώσεων', icon: <Wallet size={20} />, path: '/suppliers-balance', color: '#f43f5e' },
      ]
    },
    {
      title: 'Σύστημα & Υποστήριξη',
      items: [
        { label: 'Δικαιώματα Χρηστών', icon: <ShieldCheck size={20} />, path: '/permissions', color: '#64748b' },
        { label: 'Οδηγίες Χρήσης', icon: <Settings size={20} />, path: '/help', color: '#475569' },
        { label: 'Αλλαγή Καταστήματος', icon: <Store size={20} />, path: '/select-store', color: colors.primary },
      ]
    }
  ]

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <h1 style={headerTitle}>Διαχείριση</h1>
        <p style={headerSub}>Ρυθμίσεις και έλεγχος επιχείρησης</p>
      </div>

      <div style={content}>
        {menuItems.map((group, idx) => (
          <div key={idx} style={section}>
            <h2 style={sectionTitle}>{group.title}</h2>
            <div style={grid}>
              {group.items.map((item) => (
                <Link 
                  key={item.label} 
                  href={`${item.path}?store=${storeId}`}
                  style={card}
                >
                  <div style={{ ...iconBox, backgroundColor: `${item.color}15`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div style={labelWrap}>
                    <span style={label}>{item.label}</span>
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

const container: React.CSSProperties = {
  background: colors.background,
  minHeight: '100vh',
  paddingBottom: '100px', // Χώρος για το BottomNav
}

const header: React.CSSProperties = {
  padding: '40px 20px 20px 20px',
  background: colors.surface,
  borderBottom: `1px solid ${colors.border}`,
}

const headerTitle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 900,
  color: colors.primary,
  margin: 0
}

const headerSub: React.CSSProperties = {
  fontSize: '14px',
  color: colors.secondary,
  marginTop: '4px',
  fontWeight: 600
}

const content: React.CSSProperties = {
  padding: '20px 16px',
  maxWidth: '600px',
  margin: '0 auto'
}

const section: React.CSSProperties = {
  marginBottom: '28px'
}

const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  color: colors.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '12px',
  marginLeft: '4px'
}

const grid: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
}

const card: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '16px',
  background: colors.surface,
  borderRadius: '18px',
  textDecoration: 'none',
  border: `1px solid ${colors.border}`,
  transition: 'transform 0.1s ease',
}

const iconBox: React.CSSProperties = {
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: '16px',
  flexShrink: 0
}

const labelWrap: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flex: 1
}

const label: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: colors.primary
}