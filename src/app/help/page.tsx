'use client'

import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')
  const backHref = storeId ? `/?store=${storeId}` : '/'

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <Link href={backHref} style={backBtn}>
          <ChevronLeft size={24} />
        </Link>
        <h1 style={headerTitle}>Οδηγίες Χρήσης</h1>
        <div style={{ width: 40 }} />
      </div>

      <div style={content}>

        {/* SECTION: ΑΡΧΙΚΗ (DASHBOARD) */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#fff7ed', color: colors.purple }}>
              <Sparkles size={20} />
            </div>
            <h2 style={sectionTitle}>Αρχική (Πίνακας Ελέγχου)</h2>
          </div>
          <div style={card}>
            <p style={text}>Η Αρχική σελίδα δίνει γρήγορη εικόνα της επιχείρησης: σύνολο ταμείου, σημερινές κινήσεις και βασικά KPIs.</p>
            <p style={text}>Χρησιμοποιήστε την για γρήγορες αποφάσεις: δείτε εάν η μέρα είναι θετική ή χρειάζεται παρέμβαση.</p>
          </div>
        </section>

        {/* SECTION: ΟΙΚΟΝΟΜΙΚΑ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#eef2ff', color: colors.indigo }}>
              <Coins size={20} />
            </div>
            <h2 style={sectionTitle}>Οικονομικά (Σύνοψη)</h2>
          </div>
          <div style={card}>
            <p style={text}>Εδώ βρίσκετε συνοπτική εικόνα εσόδων, εξόδων και διαθέσιμου κεφαλαίου. Προβάλλει μηνιαίες τάσεις και τρέχουσες θέσεις ταμείου.</p>
            <p style={text}>Χρησιμοποιήστε τα φίλτρα περιόδου για να συγκρίνετε μήνες, έτη ή την πλήρη περίοδο λειτουργίας.</p>
          </div>
        </section>

        {/* SECTION: ΚΙΝΗΣΕΙΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#f1f5f9', color: colors.secondary }}>
              <RefreshCw size={20} />
            </div>
            <h2 style={sectionTitle}>Κινήσεις (Καταχώρηση)</h2>
          </div>
          <div style={card}>
            <p style={text}>Καταχωρείτε κάθε εισροή ή εκροή: πωλήσεις, αγορές, δόσεις και διορθώσεις.</p>
            <p style={text}>Οργανώστε τις κινήσεις με κατηγορίες και σημειώσεις για εύκολη αναζήτηση και ανάλυση.</p>
          </div>
        </section>

        {/* SECTION: ΕΣΟΔΑ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#ecfdf5', color: colors.success }}>
              <BadgeEuro size={20} />
            </div>
            <h2 style={sectionTitle}>Έσοδα</h2>
          </div>
          <div style={card}>
            <p style={text}>Δηλώνετε τις πωλήσεις και τις πιστώσεις που εισέρχονται στην επιχείρηση. Μπορείτε να διαχωρίσετε τα ζ/ημερήσια έσοδα από τις υπόλοιπες εισροές.</p>
            <p style={text}>Παρακολουθήστε με εύκολες προβολές ποια προϊόντα ή πηγές φέρνουν τα μεγαλύτερα έσοδα.</p>
          </div>
        </section>

        {/* SECTION: ΕΞΟΔΑ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#fff1f2', color: colors.danger }}>
              <ShoppingCart size={20} />
            </div>
            <h2 style={sectionTitle}>Έξοδα</h2>
          </div>
          <div style={card}>
            <p style={text}>Καταχωρείτε όλες τις επιχειρηματικές δαπάνες: προμηθευτές, μισθοδοσία, λογαριασμούς και μικροέξοδα.</p>
            <p style={text}>Χρησιμοποιήστε τις κατηγορίες για να δείτε που ξοδεύετε περισσότερο και να μειώσετε κόστη.</p>
          </div>
        </section>

        {/* SECTION: ΚΕΡΔΟΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#eef2ff', color: colors.indigo }}>
              <BadgeEuro size={20} />
            </div>
            <h2 style={sectionTitle}>Κέρδος (Profit)</h2>
          </div>
          <div style={card}>
            <p style={text}>Εμφανίζει την πραγματική κερδοφορία αφαιρώντας τα επιχειρηματικά έξοδα από τα έσοδα.</p>
            <p style={text}>Χρησιμοποιήστε αυτή την προβολή για να ελέγξετε αν η επιχείρηση είναι βιώσιμη και πού να στοχεύσετε βελτίωση.</p>
          </div>
        </section>

        {/* SECTION: ΤΑΜΕΙΑΚΗ ΡΟΗ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#ecfeff', color: colors.sky || '#0ea5e9' }}>
              <Coins size={20} />
            </div>
            <h2 style={sectionTitle}>Ταμειακή Ροή</h2>
          </div>
          <div style={card}>
            <p style={text}>Παρακολουθεί την πραγματική ροή μετρητών σε καθημερινή βάση: τι μπαίνει και τι βγαίνει από το ταμείο.</p>
            <p style={text}>Σας βοηθάει να διαχειριστείτε ρευστότητα και να προβλέψετε ελλείμματα ή πλεονάσματα.</p>
          </div>
        </section>

        {/* SECTION: ΑΝΑΦΟΡΕΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#f8fafc', color: colors.secondary }}>
              <History size={20} />
            </div>
            <h2 style={sectionTitle}>Αναφορές</h2>
          </div>
          <div style={card}>
            <p style={text}>Εξάγετε συνοπτικές και λεπτομερείς αναφορές για περίοδους, κατηγορίες και προμηθευτές.</p>
            <p style={text}>Οι αναφορές σας βοηθούν να κατανοήσετε την οικονομική πορεία και να προετοιμάσετε φορολογικά ή επιχειρησιακά σχέδια.</p>
          </div>
        </section>

        {/* SECTION: ΚΟΥΜΠΑΡΑΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#f5f3ff', color: colors.purple }}>
              <Target size={20} />
            </div>
            <h2 style={sectionTitle}>Κουμπαράς (Στόχοι)</h2>
          </div>
          <div style={card}>
            <p style={text}>Ο Κουμπαράς είναι εργαλείο προγραμματισμού: δεσμεύετε κεφάλαιο για συγκεκριμένους στόχους (εξοπλισμός, φόροι, ανανέωση).</p>
            <p style={text}>Μειώνει το διαθέσιμο ρευστό για καθημερινές ανάγκες αλλά προστατεύει χρήματα που προορίζονται για επενδύσεις.</p>
          </div>
        </section>

        {/* SECTION: ΜΑΥΡΟ ΚΟΥΤΙ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: colors.primary, color: '#fff' }}>
              <Zap size={20} />
            </div>
            <h2 style={sectionTitle}>Μαύρο Κουτί (Αποθεματικό Επιχείρησης)</h2>
          </div>
          <div style={card}>
            <p style={text}>Το Μαύρο Κουτί είναι το αποθεματικό ασφαλείας της επιχείρησης: κεφάλαιο για έκτακτες ανάγκες ή ασφαλείς περιόδους.</p>
            <p style={text}>Συνιστούμε να διατηρείτε ένα ρευστό αποθέμα για να καλύπτετε απρόβλεπτα έξοδα χωρίς να επηρεάζεται η λειτουργία.</p>
          </div>
        </section>

        {/* SECTION: ΚΑΡΤΕΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#eef2ff', color: colors.indigo }}>
              <CreditCard size={20} />
            </div>
            <h2 style={sectionTitle}>Κάρτες (Πληρωμές)</h2>
          </div>
          <div style={card}>
            <p style={text}>Διαχειριστείτε πληρωμές μέσω κάρτας και δείτε την κατανομή μετρητών vs κάρτας στις ημερήσιες κινήσεις.</p>
            <p style={text}>Η σωστή χρήση των μεθόδων πληρωμής βελτιώνει την πρόβλεψη ρευστότητας και τη συμφωνία με το ταμείο.</p>
          </div>
        </section>

        {/* SECTION: ΠΡΟΜΗΘΕΥΤΕΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#fff7ed', color: colors.purple }}>
              <Landmark size={20} />
            </div>
            <h2 style={sectionTitle}>Προμηθευτές</h2>
          </div>
          <div style={card}>
            <p style={text}>Κρατήστε καρτέλες προμηθευτών με οφειλές, πληρωμές και ιστορικό αγορών.</p>
            <p style={text}>Χρησιμοποιήστε αυτές τις πληροφορίες για να διαπραγματευτείτε καλύτερους όρους και να οργανώσετε τις πληρωμές.</p>
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
            <p style={text}>Διαχειριστείτε εργαζόμενους, καταχωρήστε μισθούς, υπερωρίες και κατανομή φιλοδωρημάτων.</p>
            <p style={text}>Χρησιμοποιήστε τις λειτουργίες για να διασφαλίσετε έγκαιρες πληρωμές και σωστή λογιστική καταγραφή.</p>
          </div>
        </section>

        {/* SECTION: ΔΙΑΧΕΙΡΙΣΗ ΣΥΣΤΗΜΑΤΟΣ */}
        <section style={section}>
          <div style={sectionHeader}>
            <div style={{ ...iconBox, background: '#f1f5f9', color: colors.secondary }}>
              <SlidersHorizontal size={20} />
            </div>
            <h2 style={sectionTitle}>Διαχείριση Συστήματος</h2>
          </div>
          <div style={card}>
            <p style={text}>Εδώ ρυθμίζετε καταστήματα, ρόλους χρηστών και βασικές παραμέτρους λειτουργίας.</p>
            <p style={text}>Οι σωστές ρυθμίσεις εξασφαλίζουν ορθή λειτουργία και διαχείριση πρόσβασης στην ομάδα σας.</p>
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
              <div style={roleDesc}>Καταχώρηση κινήσεων και βασική προβολή ταμείου. Ιδανικό για ταμίες και προσωπικό καταστήματος.</div>
            </div>
            <div style={{ ...roleBox, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
              <div style={{ ...roleLabel, color: colors.indigo }}><Sparkles size={14} /> ADMIN</div>
              <div style={roleDesc}>Πλήρης πρόσβαση σε αναφορές, ρυθμίσεις, διαχείριση χρηστών και ευρύτερες λειτουργίες διαχείρισης.</div>
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