const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  accentRed: '#f43f5e',
  accentBlue: '#6366f1',
  accentGreen: '#10b981',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  warning: '#fffbeb',
  warningText: '#92400e',
}

export const iphoneWrapper: any = {
  backgroundColor: colors.bgLight,
  minHeight: '100%',
  width: '100%',
  padding: '20px',
  paddingBottom: '120px',
  touchAction: 'pan-y',
}

export const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }
export const brandArea = { display: 'flex', alignItems: 'center', gap: '12px' }
export const logoBox = {
  width: '42px',
  height: '42px',
  backgroundColor: colors.primaryDark,
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: '18px',
  fontWeight: '800',
}
export const storeTitleText = { fontSize: '16px', fontWeight: '800', margin: 0, color: colors.primaryDark }
export const switchBtnStyle: any = {
  fontSize: '9px',
  fontWeight: '800',
  color: colors.accentBlue,
  backgroundColor: '#eef2ff',
  border: 'none',
  padding: '4px 8px',
  borderRadius: '8px',
  cursor: 'pointer',
  textDecoration: 'none',
}
export const dashboardSub = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '0.5px' }
export const statusDot = { width: '6px', height: '6px', background: colors.accentGreen, borderRadius: '50%' }

export const menuToggle: any = {
  background: 'white',
  border: `1px solid ${colors.border}`,
  borderRadius: '12px',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: colors.primaryDark,
}
export const dropdownStyle: any = {
  position: 'absolute',
  top: '50px',
  right: 0,
  background: 'white',
  minWidth: '220px',
  borderRadius: '18px',
  boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
  padding: '10px',
  zIndex: 100,
  border: `1px solid ${colors.border}`,
}
export const menuItem: any = {
  display: 'block',
  padding: '12px 15px',
  textDecoration: 'none',
  color: colors.primaryDark,
  fontWeight: '700',
  fontSize: '14px',
  borderRadius: '12px',
}
export const menuSectionLabel = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, padding: '8px 15px 5px' }
export const menuDivider = { height: '1px', backgroundColor: colors.border, margin: '8px 0' }
export const logoutBtnStyle: any = {
  width: '100%',
  textAlign: 'left',
  padding: '12px 15px',
  background: '#fff1f2',
  color: colors.accentRed,
  border: 'none',
  borderRadius: '12px',
  fontWeight: '700',
  cursor: 'pointer',
}

export const dateCard: any = {
  backgroundColor: 'white',
  padding: '10px',
  borderRadius: '16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '25px',
  border: `1px solid ${colors.border}`,
}
export const dateText = { fontSize: '13px', fontWeight: '800', color: colors.primaryDark, margin: 0 }
export const businessHint: any = { margin: '6px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText, opacity: 0.9 }
export const dateNavBtn = { background: 'none', border: 'none', color: colors.secondaryText, cursor: 'pointer', display: 'flex', alignItems: 'center' }

export const heroCardStyle: any = {
  background: colors.primaryDark,
  padding: '30px 20px',
  borderRadius: '28px',
  color: 'white',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
  marginBottom: '30px',
  textAlign: 'center',
}
export const heroLabel: any = { fontSize: '10px', fontWeight: '700', opacity: 0.5, letterSpacing: '1px', marginBottom: '10px' }
export const heroAmountText: any = { fontSize: '38px', fontWeight: '900', margin: 0 }
export const heroStatsRow: any = { display: 'flex', gap: '20px', marginTop: '25px', justifyContent: 'center' }
export const heroStatItem: any = { display: 'flex', alignItems: 'center', gap: '8px' }
export const heroStatValue = { fontSize: '15px', fontWeight: '800' }
export const statCircle = (bg: string): any => ({
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
})

export const heroCreditWrap: any = { marginTop: '18px', display: 'flex', justifyContent: 'center' }
export const heroCreditPill: any = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
}
export const creditIconCircle: any = {
  width: '28px',
  height: '28px',
  borderRadius: '10px',
  background: 'rgba(99, 102, 241, 0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
}
export const heroCreditLabel: any = { fontSize: '10px', fontWeight: '900', opacity: 0.9, letterSpacing: '0.6px' }
export const heroCreditValue: any = { fontSize: '14px', fontWeight: '900' }

export const actionGrid: any = { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }
export const actionRow: any = { display: 'flex', gap: '12px' }
export const zRowWrap: any = { display: 'flex', justifyContent: 'center' }

export const actionBtn: any = {
  flex: 1,
  padding: '18px',
  borderRadius: '18px',
  color: 'white',
  textDecoration: 'none',
  textAlign: 'center',
  fontWeight: '800',
  fontSize: '14px',
  boxShadow: '0 8px 15px rgba(0,0,0,0.08)',
}
export const zBtnStyle: any = { flex: 'unset', width: '100%', maxWidth: '260px' }

export const listContainer = { backgroundColor: 'transparent' }
export const listHeader = { fontSize: '11px', fontWeight: '900', color: colors.secondaryText, marginBottom: '15px', letterSpacing: '0.5px' }
export const txRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', border: `1px solid ${colors.border}`, cursor: 'pointer' }
export const txIconContainer = (isInc: boolean): any => ({
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  background: isInc ? '#f0fdf4' : '#fef2f2',
  color: isInc ? colors.accentGreen : colors.accentRed,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})
export const txTitle = { fontWeight: '800', fontSize: '14px', margin: 0, color: colors.primaryDark }
export const txMeta = { fontSize: '11px', color: colors.secondaryText, margin: 0, fontWeight: '600' }
export const txAmount = { fontWeight: '900', fontSize: '16px' }
export const creditBadgeStyle = { fontSize: '8px', marginLeft: '6px', color: colors.accentBlue, background: '#eef2ff', padding: '2px 5px', borderRadius: '4px' }

export const actionPanel: any = { display: 'flex', gap: '10px', padding: '15px', backgroundColor: 'white', border: `1px solid ${colors.border}`, borderTop: 'none', borderRadius: '0 0 20px 20px', alignItems: 'stretch', flexWrap: 'wrap' }
export const editRowBtn: any = { flex: 1, padding: '10px', backgroundColor: colors.bgLight, color: colors.primaryDark, border: `1px solid ${colors.border}`, borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '140px', cursor: 'pointer' }
export const deleteRowBtn: any = { flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: colors.accentRed, border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px', minWidth: '120px', cursor: 'pointer' }

export const ytdCard: any = { width: '100%', padding: '14px', borderRadius: '16px', border: `1px solid ${colors.border}`, background: '#f8fafc', marginTop: '10px' }
export const ytdTitle: any = { margin: 0, fontSize: '10px', fontWeight: '900', color: colors.secondaryText, letterSpacing: '0.8px' }
export const ytdSubTitle: any = { margin: '6px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText, opacity: 0.85 }
export const ytdRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px' }
export const ytdLabel: any = { fontSize: '12px', fontWeight: '800', color: colors.primaryDark }
export const ytdValue: any = { fontSize: '12px', fontWeight: '900', color: colors.primaryDark }
export const ytdValueGreen: any = { fontSize: '12px', fontWeight: '900', color: colors.accentGreen }
export const ytdValueRed: any = { fontSize: '12px', fontWeight: '900', color: colors.accentRed }
export const ytdHint: any = { margin: '10px 0 0 0', fontSize: '10px', fontWeight: '800', color: colors.secondaryText }
export const ytdLoading: any = { margin: '10px 0 0 0', fontSize: '12px', fontWeight: '800', color: colors.secondaryText }

export const zBreakdownCard: any = { width: '100%', padding: '14px', borderRadius: '16px', border: `1px solid ${colors.border}`, background: '#f8fafc' }
export const zBreakdownRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px' }

export const emptyStateStyle: any = { textAlign: 'center', padding: '40px 20px', color: colors.secondaryText, fontWeight: '600', fontSize: '13px' }
export const spinnerStyle: any = { width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }
