'use client'

import React from 'react'
import Link from 'next/link'
import { 
  ChevronLeft, 
  Landmark, 
  BadgeEuro, 
  SlidersHorizontal, 
  ShieldCheck, 
  CreditCard, 
  Users, 
  Timer, 
  Zap,
  Lock,
  Target,
  ShoppingCart,
  RefreshCw,
  Coins,
  History,
  Info,
  Sparkles
} from 'lucide-react'

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  indigo: '#6366f1',
  purple: '#7c3aed',
  warning: '#f59e0b',
  background: '#f8fafc',
  border: '#e2e8f0',
}

export default function HelpPage() {
  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <Link href="/" style={backBtn}>
          <ChevronLeft size={24} />
        </Link>
        <h1 style={headerTitle}>Οδηγίες Χρήσης</h1>
        <div style={{ width: 40 }} />
      </div>

      <div style={content}>
        
        {/* SECTION: ΣΤΟΧΟΙ & ΕΞΟΠΛΙΣΜΟΣ (ΚΟΥΜΠΑΡΑΣ) */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#f5f3ff', color: colors.purple }}>
              <Target size={20} />
            </div>
            <h2 style={sectionTitle}>Στόχοι & Εξοπλισμός (Savings Goals)</h2>
          </div>
          <div style={card}>
            <p style={text}>
              Ο "Κουμπαράς" λειτουργεί ως εργαλείο <b>επένδυσης και προγραμματισμού</b>. Δεν είναι απλά λεφτά στην άκρη, αλλά πόροι για το μέλλον της επιχείρησης.
            </p>
            
            <div style={goalsGrid}>
              <div style={goalItem}>
                <div style={goalIcon}><ShoppingCart size={16} /></div>
                <div style={goalText}>Αγορά Εξοπλισμού</div>
              </div>
              <div style={goalItem}>
                <div style={goalIcon}><RefreshCw size={16} /></div>
                <div style={goalText}>Ανακαίνιση / Maintenance</div>
              </div>
              <div style={goalItem}>
                <div style={goalIcon}><Coins size={16} /></div>
                <div style={goalText}>Φόροι / Αποθεματικό</div>
              </div>
              <div style={goalItem}>
                <div style={goalIcon}><History size={16} /></div>
                <div style={goalText}>Μελλοντικές Δόσεις</div>
              </div>
            </div>

            <ul style={list}>
              <li><b>Δέσμευση Ποσού:</b> Όταν ορίζετε έναν στόχο (π.χ. νέα μηχανή καφέ), το ποσό "δεσμεύεται" εικονικά. Μειώνει το ρευστό που βλέπετε στο συρτάρι, προστατεύοντας το κεφάλαιο ανάπτυξης.</li>
              <li><b>Υλοποίηση:</b> Μόλις ο στόχος επιτευχθεί, κάνετε "Ανάληψη από Στόχο" για να πληρώσετε την αγορά, χωρίς να επηρεαστεί η καθημερινή ροή του ταμείου σας.</li>
            </ul>
          </div>
        </section>

        {/* SECTION: ΜΑΥΡΟ ΚΟΥΤΙ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: colors.primary, color: '#fff' }}>
              <Zap size={20} />
            </div>
            <h2 style={sectionTitle}>Το "Μαύρο Κουτί" (Business Performance)</h2>
          </div>
          <div style={card}>
            <p style={text}>Δείχνει την <b>πραγματική κερδοφορία</b> του καταστήματος, ανεξάρτητα από προσωπικές αποταμιεύσεις ή δάνεια.</p>
            <div style={formula}>
              (Έσοδα Ζ + Έσοδα Χωρίς Σήμανση) - (Επιχειρηματικά Έξοδα Μετρητών)
            </div>
            <p style={subText}>*Είναι το νούμερο που σας λέει αν το μαγαζί "μπαίνει μέσα" ή βγάζει κέρδος ως αυτόνομη οντότητα.</p>
          </div>
        </section>

        {/* SECTION: ΠΡΟΣΩΠΙΚΟ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#e0f2fe', color: '#0ea5e9' }}>
              <Users size={20} />
            </div>
            <h2 style={sectionTitle}>Προσωπικό & Μισθοδοσία</h2>
          </div>
          <div style={card}>
            <div style={item}>
              <Timer size={18} style={itemIcon} />
              <div>
                <div style={itemTitle}>Αντίστροφη Μέτρηση Πληρωμής</div>
                <div style={itemDesc}>Παρακολουθήστε αυτόματα τις ημέρες που απομένουν μέχρι την επόμενη πληρωμή κάθε υπαλλήλου.</div>
              </div>
            </div>
            <div style={item}>
              <BadgeEuro size={18} style={itemIcon} />
              <div>
                <div style={itemTitle}>Tips, Υπερωρίες & Bonus</div>
                <div style={itemDesc}>Εισάγετε φιλοδωρήματα ή έξτρα ώρες που προστίθενται αυτόματα στο σύνολο της καρτέλας.</div>
              </div>
            </div>
            <div style={item}>
              <CreditCard size={18} style={itemIcon} />
              <div>
                <div style={itemTitle}>Άμεση vs Μηνιαία Πληρωμή</div>
                <div style={itemDesc}><b>Άμεση:</b> Εξόφληση τοις μετρητοίς τώρα. <b>Μηνιαία:</b> Λογιστική εγγραφή που εκκαθαρίζεται στο τέλος του μήνα.</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: ΔΑΝΕΙΑ & ΠΙΣΤΩΣΕΙΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#fef3c7', color: '#b45309' }}>
              <Landmark size={20} />
            </div>
            <h2 style={sectionTitle}>Δάνεια, Ρυθμίσεις & Πιστώσεις</h2>
          </div>
          <div style={card}>
            <p style={text}><b>Έξυπνος Έλεγχος:</b> Η εφαρμογή αναγνωρίζει αυτόματα δόσεις δανείων ή ρυθμίσεις αν στις σημειώσεις περιέχεται η λέξη "Δάνειο", "Δόση" ή "Ρύθμιση".</p>
            <p style={{ ...text, marginTop: 12 }}><b>Επί Πιστώσει:</b> Οι αγορές/πωλήσεις με μέθοδο "Πίστωση" <b>δεν μειώνουν</b> το τρέχον ταμείο. Καταγράφονται ως εκκρεμότητα στην καρτέλα του προμηθευτή για πλήρη ανάλυση οφειλών.</p>
          </div>
        </section>

        {/* SECTION: ΡΟΛΟΙ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#dcfce7', color: colors.success }}>
              <ShieldCheck size={20} />
            </div>
            <h2 style={sectionTitle}>Ρόλοι Πρόσβασης</h2>
          </div>
          <div style={card}>
            <div style={roleBox}>
              <div style={roleLabel}><Lock size={14} /> USER</div>
              <div style={roleDesc}>Καταχώρηση κινήσεων, κλείσιμο Ζ και προβολή απλού ταμείου.</div>
            </div>
            <div style={{ ...roleBox, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
              <div style={{ ...roleLabel, color: colors.indigo }}><Sparkles size={14} /> ADMIN</div>
              <div style={roleDesc}>Πλήρης πρόσβαση σε PRO αναλύσεις, ρυθμίσεις, διαγραφές και διαχείριση χρηστών.</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

/* ---------------- STYLES ---------------- */

const container: React.CSSProperties = {
  background: colors.background,
  minHeight: '100vh',
  paddingBottom: 60,
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  background: '#fff',
  borderBottom: `1px solid ${colors.border}`,
  position: 'sticky',
  top: 0,
  zIndex: 10,
}

const headerTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: colors.primary,
}

const backBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
  background: '#f1f5f9',
}

const content: React.CSSProperties = {
  maxWidth: 600,
  margin: '0 auto',
  padding: '20px 16px',
}

const section: React.CSSProperties = {
  marginBottom: 32,
}

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
  paddingLeft: 4,
}

const iconBox: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: colors.primary,
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 24,
  padding: 20,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
}

const goalsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
  marginTop: '16px',
  marginBottom: '16px',
}

const goalItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: '#f8fafc',
  padding: '10px 12px',
  borderRadius: '14px',
  border: `1px solid ${colors.border}`,
}

const goalIcon: React.CSSProperties = {
  color: colors.purple,
  display: 'flex',
}

const goalText: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  color: colors.primary,
}

const text: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.secondary,
  margin: 0,
}

const subText: React.CSSProperties = {
  fontSize: 12,
  color: colors.secondary,
  fontStyle: 'italic',
  marginTop: 8,
}

const formula: React.CSSProperties = {
  background: colors.background,
  padding: '12px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 800,
  color: colors.primary,
  marginTop: 12,
  textAlign: 'center',
  border: `1px dashed ${colors.border}`,
}

const list: React.CSSProperties = {
  marginTop: 8,
  paddingLeft: 18,
  fontSize: 14,
  color: colors.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const item: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  marginBottom: 16,
}

const itemIcon: React.CSSProperties = {
  color: colors.indigo,
  marginTop: 2,
  flexShrink: 0,
}

const itemTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: colors.primary,
}

const itemDesc: React.CSSProperties = {
  fontSize: 13,
  color: colors.secondary,
  lineHeight: 1.4,
  marginTop: 2,
}

const roleBox: React.CSSProperties = {
  marginBottom: 12,
}

const roleLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 1000,
  color: colors.secondary,
  marginBottom: 4,
}

const roleDesc: React.CSSProperties = {
  fontSize: 13,
  color: colors.secondary,
  lineHeight: 1.4,
}