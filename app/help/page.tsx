'use client'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>❓</div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '24px', margin: 0, color: '#0f172a' }}>Οδηγός Χρήσης</h1>
              <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>COSY APP HELP CENTER</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        {/* SECTION 1: DASHBOARD */}
        <div style={helpCard}>
          <h3 style={sectionTitle}>1. Πίνακας Ελέγχου 📈</h3>
          <p style={textStyle}>Στην αρχική σελίδα βλέπετε το **Ταμείο της Ημέρας**. Οι δύο κάρτες στην κορυφή υπολογίζουν αυτόματα τα έσοδα και τα έξοδα που έχουν πληρωθεί.</p>
          <ul style={listStyle}>
            <li><b>Βέλη Ημερομηνίας:</b> Δείτε κινήσεις προηγούμενων ημερών.</li>
            <li><b>Εικονίδιο ⋮:</b> Πρόσβαση σε όλες τις λειτουργίες.</li>
          </ul>
        </div>

        {/* SECTION 2: TRANSACTIONS */}
        <div style={helpCard}>
          <h3 style={sectionTitle}>2. Έσοδα & Έξοδα 💸</h3>
          <p style={textStyle}>Χρησιμοποιήστε τα κουμπιά <b>+ΕΣΟΔΑ</b> και <b>-ΕΞΟΔΑ</b> για κάθε κίνηση.</p>
          <div style={iconBox}>
            <span>💵 Μετρητά</span>
            <span>💳 Κάρτα / Τράπεζα</span>
            <span>🚩 Επί Πίστωση (Χρέος)</span>
          </div>
          <p style={textNote}>⚠️ Οι κινήσεις με 🚩 **Πίστωση** δεν αφαιρούνται από το σημερινό ταμείο, αλλά αποθηκεύονται στις "Καρτέλες" για να εξοφληθούν αργότερα.</p>
        </div>

        {/* SECTION 3: Z-CLOSURE */}
        <div style={helpCard}>
          <h3 style={sectionTitle}>3. Κλείσιμο Ταμείου (Ζ) 📟</h3>
          <p style={textStyle}>Στο τέλος της βάρδιας, ο Admin περνάει τα σύνολα από τη φορολογική μηχανή.</p>
          <ul style={listStyle}>
            <li>Η εφαρμογή ομαδοποιεί τα Ζ και τα εμφανίζει ξεχωριστά στην κορυφή της λίστας.</li>
            <li>Πατώντας πάνω στο <b>"Σύνολο Ζ"</b>, βλέπετε την ανάλυση (πόσα σε μετρητά, πόσα σε κάρτα).</li>
          </ul>
        </div>

        {/* SECTION 4: SUPPLIERS & ASSETS */}
        <div style={helpCard}>
          <h3 style={sectionTitle}>4. Προμηθευτές & Πάγια 🛒</h3>
          <p style={textStyle}>Οργανώστε τους συνεργάτες σας για να έχετε πλήρη έλεγχο.</p>
          <ul style={listStyle}>
            <li><b>Προμηθευτές:</b> Δείτε το συνολικό τζίρο ανά εταιρεία και το ιστορικό πληρωμών.</li>
            <li><b>Πάγια:</b> Καταχωρήστε λογαριασμούς (ΔΕΗ, Ενοίκιο) για να ξέρετε το λειτουργικό κόστος.</li>
          </ul>
        </div>

        {/* SECTION 5: ADMIN RIGHTS */}
        <div style={helpCard}>
          <h3 style={sectionTitle}>5. Δικαιώματα & Διαγραφή 🔐</h3>
          <p style={textStyle}>Μόνο ο <b>Admin</b> έχει το δικαίωμα να:</p>
          <ul style={listStyle}>
            <li>Διαγράφει ή να επεξεργάζεται κινήσεις (πατώντας πάνω στην κίνηση).</li>
            <li>Βλέπει την "Ανάλυση" και τα κέρδη του μήνα.</li>
            <li>Ορίζει τι βλέπουν οι υπόλοιποι υπάλληλοι.</li>
          </ul>
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px' }}>
          Cosy App v1.0 • Σχεδιασμένο για μέγιστη αποδοτικότητα
        </div>
      </div>
    </main>
  )
}

// STYLES
const logoBoxStyle: any = { width: '48px', height: '48px', backgroundColor: '#0f172a', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.1)' };
const backBtnStyle: any = { textDecoration: 'none', color: '#64748b', fontSize: '18px', fontWeight: 'bold', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' };
const helpCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '28px', marginBottom: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' };
const sectionTitle: any = { margin: '0 0 12px 0', fontSize: '18px', fontWeight: '900', color: '#0f172a' };
const textStyle: any = { fontSize: '14px', lineHeight: '1.6', color: '#475569', margin: '0 0 15px 0' };
const listStyle: any = { fontSize: '14px', color: '#475569', paddingLeft: '20px', margin: '0' };
const iconBox: any = { display: 'flex', gap: '10px', fontSize: '12px', fontWeight: '800', margin: '15px 0', color: '#1e293b', flexWrap: 'wrap' };
const textNote: any = { fontSize: '13px', background: '#fefce8', padding: '12px', borderRadius: '12px', color: '#854d0e', border: '1px solid #fef08a' };