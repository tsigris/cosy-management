import React, { useState } from 'react';

interface StoreOption {
  id: string;
  name: string;
}

export interface TransferFundsModalProps {
  open: boolean;
  onClose: () => void;
  stores: StoreOption[];
  onTransfer: (fromId: string, toId: string, amount: number, description: string) => Promise<void>;
  loading: boolean;
  onRefresh?: () => Promise<void>;
}

const modalBg: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(15,23,42,0.7)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  background: '#1e293b',
  color: '#f1f5f9',
  borderRadius: 24,
  padding: 32,
  minWidth: 340,
  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  maxWidth: '90vw',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#f1f5f9',
  marginBottom: 18,
  fontSize: 16,
};

const labelStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  marginBottom: 6,
  color: '#f1f5f9',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 16,
  background: '#0f172a',
  color: '#fff',
  fontWeight: 800,
  fontSize: 16,
  border: 'none',
  marginTop: 10,
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const errorStyle: React.CSSProperties = {
  color: '#f43f5e',
  fontWeight: 700,
  marginBottom: 10,
  fontSize: 14,
};

export default function TransferFundsModal({ open, onClose, stores, onTransfer, loading, onRefresh }: TransferFundsModalProps) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fromId || !toId || !amount) {
      setError('Συμπλήρωσε όλα τα πεδία.');
      return;
    }
    if (fromId === toId) {
      setError('Τα καταστήματα πρέπει να είναι διαφορετικά.');
      return;
    }
    if (Number(amount) <= 0) {
      setError('Το ποσό πρέπει να είναι θετικό.');
      return;
    }
    await onTransfer(fromId, toId, Number(amount), desc);
    if (onRefresh) await onRefresh();
  };

  return (
    <div style={modalBg}>
      <div style={modalStyle}>
        <h2 style={{ fontWeight: 900, fontSize: 22, marginBottom: 18, color: '#fff' }}>Μεταφορά Κεφαλαίου</h2>
        <form onSubmit={handleSubmit}>
          <div style={labelStyle}>Από Κατάστημα</div>
          <select style={inputStyle} value={fromId} onChange={e => setFromId(e.target.value)} required>
            <option value="">Επιλογή...</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div style={labelStyle}>Προς Κατάστημα</div>
          <select style={inputStyle} value={toId} onChange={e => setToId(e.target.value)} required>
            <option value="">Επιλογή...</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div style={labelStyle}>Ποσό</div>
          <input style={inputStyle} type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          <div style={labelStyle}>Περιγραφή (προαιρετικό)</div>
          <input style={inputStyle} type="text" value={desc} onChange={e => setDesc(e.target.value)} maxLength={100} placeholder="π.χ. Μεταφορά Κεφαλαίου" />
          {error && <div style={errorStyle}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ ...btnStyle, background: '#334155' }} disabled={loading}>Ακύρωση</button>
            <button type="submit" style={{ ...btnStyle, background: fromId && toId && fromId !== toId ? '#0f172a' : '#64748b', cursor: fromId && toId && fromId !== toId ? 'pointer' : 'not-allowed' }} disabled={loading || !fromId || !toId || fromId === toId}>{loading ? 'Εκτέλεση...' : 'Εκτέλεση'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
