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
  RefreshCw,
  Coins,
  History,
  Sparkles,
  Target,
  Lock,
  Info
} from 'lucide-react'

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  indigo: '#6366f1',
  purple: '#7c3aed',
  background: '#f8fafc',
  border: '#e2e8f0'
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

        {/* INTRO */}

        <section style={section}>

          <div style={sectionHeader}>

            <div style={{ ...iconBox, background: '#eef2ff', color: colors.indigo }}>
              <Info size={20} />
            </div>

            <h2 style={sectionTitle}>Σχετικά με το PROFITRO Management</h2>

          </div>

          <div style={card}>

            <p style={text}>
              Το PROFITRO Management είναι ένα σύστημα διαχείρισης επιχείρησης που
              σας επιτρέπει να παρακολουθείτε οικονομικά δεδομένα, κινήσεις,
              προσωπικό και βασικούς δείκτες απόδοσης σε πραγματικό χρόνο.
            </p>

            <p style={text}>
              Οι παρακάτω ενότητες εξηγούν τις βασικές λειτουργίες της εφαρμογής
              και πώς μπορείτε να τις χρησιμοποιήσετε για την αποτελεσματική
              οργάνωση της επιχείρησης σας.
            </p>

          </div>

        </section>

        {/* DASHBOARD */}

        <HelpSection
          icon={<Sparkles size={20} />}
          title="Αρχική (Πίνακας Ελέγχου)"
          text={[
            'Η Αρχική σελίδα λειτουργεί ως ο κεντρικός πίνακας ελέγχου της επιχείρησης.',
            'Εδώ εμφανίζονται βασικά στοιχεία όπως το διαθέσιμο ταμείο, οι τελευταίες κινήσεις και βασικοί δείκτες απόδοσης.',
            'Χρησιμοποιήστε την για καθημερινή παρακολούθηση της επιχείρησης.'
          ]}
        />

        {/* ΟΙΚΟΝΟΜΙΚΑ */}

        <HelpSection
          icon={<Coins size={20} />}
          title="Οικονομικά (Σύνοψη)"
          text={[
            'Η ενότητα Οικονομικά παρουσιάζει συνοπτική εικόνα της οικονομικής κατάστασης της επιχείρησης.',
            'Εμφανίζονται τα συνολικά έσοδα, τα έξοδα και το διαθέσιμο κεφάλαιο για την επιλεγμένη περίοδο.',
            'Μπορείτε να συγκρίνετε μήνες ή έτη για καλύτερη κατανόηση της πορείας της επιχείρησης.'
          ]}
        />

        {/* ΚΙΝΗΣΕΙΣ */}

        <HelpSection
          icon={<RefreshCw size={20} />}
          title="Κινήσεις (Καταχώρηση)"
          text={[
            'Στην ενότητα Κινήσεις καταχωρούνται όλες οι οικονομικές συναλλαγές της επιχείρησης.',
            'Περιλαμβάνονται πωλήσεις, αγορές, πληρωμές και διορθώσεις.',
            'Η σωστή καθημερινή καταχώρηση εξασφαλίζει ακριβή οικονομική εικόνα.'
          ]}
        />

        {/* ΕΣΟΔΑ */}

        <HelpSection
          icon={<BadgeEuro size={20} />}
          title="Έσοδα"
          text={[
            'Καταγράφονται όλες οι εισροές χρημάτων της επιχείρησης.',
            'Μπορείτε να δείτε ποιες δραστηριότητες ή πηγές φέρνουν τα περισσότερα έσοδα.',
            'Βοηθά στον εντοπισμό των πιο αποδοτικών δραστηριοτήτων.'
          ]}
        />

        {/* ΕΞΟΔΑ */}

        <HelpSection
          icon={<Landmark size={20} />}
          title="Έξοδα"
          text={[
            'Καταχωρούνται όλες οι επιχειρηματικές δαπάνες όπως προμηθευτές, μισθοί και λειτουργικά έξοδα.',
            'Η κατηγοριοποίηση βοηθά στην καλύτερη κατανόηση του κόστους λειτουργίας.',
            'Επιτρέπει τον εντοπισμό σημείων όπου μπορούν να μειωθούν έξοδα.'
          ]}
        />

        {/* ΚΕΡΔΟΣ */}

        <HelpSection
          icon={<BadgeEuro size={20} />}
          title="Κέρδος"
          text={[
            'Υπολογίζει την πραγματική κερδοφορία της επιχείρησης.',
            'Συγκρίνει τα συνολικά έσοδα με τα συνολικά έξοδα.',
            'Χρησιμοποιείται για αξιολόγηση της οικονομικής απόδοσης.'
          ]}
        />

        {/* CASHFLOW */}

        <HelpSection
          icon={<Coins size={20} />}
          title="Ταμειακή Ροή"
          text={[
            'Παρακολουθεί τη συνεχή ροή χρημάτων μέσα στην επιχείρηση.',
            'Δείχνει τι χρήματα εισέρχονται και τι εξέρχονται από το ταμείο.',
            'Βοηθά στη σωστή διαχείριση ρευστότητας.'
          ]}
        />

        {/* REPORTS */}

        <HelpSection
          icon={<History size={20} />}
          title="Αναφορές"
          text={[
            'Παρέχει αναλυτικές και συγκεντρωτικές οικονομικές αναφορές.',
            'Μπορείτε να εξετάσετε δεδομένα ανά περίοδο, κατηγορία ή προμηθευτή.',
            'Χρήσιμο εργαλείο για κατανόηση της οικονομικής πορείας.'
          ]}
        />

        {/* ΚΟΥΜΠΑΡΑΣ */}

        <HelpSection
          icon={<Target size={20} />}
          title="Κουμπαράς (Στόχοι)"
          text={[
            'Ο Κουμπαράς χρησιμοποιείται για αποθήκευση κεφαλαίου για συγκεκριμένους στόχους.',
            'Μπορεί να αφορά επενδύσεις, φόρους ή αγορά εξοπλισμού.',
            'Τα χρήματα αυτά προστατεύονται από καθημερινή χρήση.'
          ]}
        />

        {/* ΚΑΡΤΕΣ */}

        <HelpSection
          icon={<CreditCard size={20} />}
          title="Κάρτες (Πληρωμές)"
          text={[
            'Επιτρέπει την παρακολούθηση πληρωμών που γίνονται μέσω καρτών.',
            'Βοηθά στη σύγκριση μεταξύ πληρωμών με μετρητά και καρτών.',
            'Διευκολύνει τον έλεγχο των συναλλαγών.'
          ]}
        />

        {/* ΠΡΟΜΗΘΕΥΤΕΣ */}

        <HelpSection
          icon={<Landmark size={20} />}
          title="Προμηθευτές"
          text={[
            'Διαχειρίζεστε καρτέλες προμηθευτών και το ιστορικό συναλλαγών.',
            'Παρακολουθείτε πληρωμές, αγορές και τυχόν οφειλές.',
            'Βοηθά στη σωστή διαχείριση συνεργασιών.'
          ]}
        />

        {/* ΠΡΟΣΩΠΙΚΟ */}

        <HelpSection
          icon={<Users size={20} />}
          title="Προσωπικό & Μισθοδοσία"
          text={[
            'Διαχείριση εργαζομένων και μισθοδοσίας.',
            'Καταγραφή μισθών, υπερωριών και άλλων αποδοχών.',
            'Εξασφαλίζει σωστή οικονομική καταγραφή του προσωπικού.'
          ]}
        />

        {/* SYSTEM */}

        <HelpSection
          icon={<SlidersHorizontal size={20} />}
          title="Διαχείριση Συστήματος"
          text={[
            'Ρύθμιση βασικών παραμέτρων της εφαρμογής.',
            'Διαχείριση καταστημάτων, χρηστών και ρόλων.',
            'Εξασφαλίζει σωστή λειτουργία του συστήματος.'
          ]}
        />

        {/* ROLES */}

        <section style={section}>

          <div style={sectionHeader}>

            <div style={{ ...iconBox, background: '#dcfce7', color: colors.success }}>
              <ShieldCheck size={20} />
            </div>

            <h2 style={sectionTitle}>Ρόλοι Πρόσβασης</h2>

          </div>

          <div style={card}>

            <div style={roleBox}>

              <div style={roleLabel}>
                <Lock size={14} /> USER
              </div>

              <div style={roleDesc}>
                Καταχώρηση κινήσεων και βασική προβολή ταμείου.
                Ιδανικό για ταμίες ή προσωπικό καταστήματος.
              </div>

            </div>

            <div style={{ ...roleBox, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>

              <div style={{ ...roleLabel, color: colors.indigo }}>
                <Sparkles size={14} /> ADMIN
              </div>

              <div style={roleDesc}>
                Πλήρης πρόσβαση σε αναφορές, ρυθμίσεις και διαχείριση χρηστών.
              </div>

            </div>

          </div>

        </section>

      </div>

    </div>
  )
}

/* COMPONENT */

function HelpSection({ icon, title, text }: any) {

  return (

    <section style={section}>

      <div style={sectionHeader}>

        <div style={{ ...iconBox, background: '#f8fafc', color: colors.secondary }}>
          {icon}
        </div>

        <h2 style={sectionTitle}>{title}</h2>

      </div>

      <div style={card}>

        {text.map((t: string, i: number) => (
          <p key={i} style={textStyle}>{t}</p>
        ))}

      </div>

    </section>

  )
}

/* STYLES */

const container = {
  background: colors.background,
  minHeight: '100vh'
}

const header = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  background: '#fff',
  borderBottom: `1px solid ${colors.border}`
}

const headerTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: colors.primary
}

const backBtn = {
  width: 40,
  height: 40,
  borderRadius: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
  background: '#f1f5f9'
}

const content = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '24px 16px'
}

const section = {
  marginBottom: 32
}

const sectionHeader = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12
}

const iconBox = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const sectionTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: colors.primary
}

const card = {
  background: '#fff',
  borderRadius: 24,
  padding: 20,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
}

const textStyle = {
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.secondary,
  marginBottom: 8
}

const roleBox = {
  marginBottom: 12
}

const roleLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  color: colors.secondary,
  marginBottom: 4
}

const roleDesc = {
  fontSize: 13,
  color: colors.secondary,
  lineHeight: 1.4
}