export function getPaymentMethod(tx: any): string {
  return String(tx?.payment_method ?? tx?.method ?? '').trim()
}

export function getUserLabelFromTx(tx: any): string {
  return tx?.created_by_name || tx?.profiles?.username || 'Χρήστης'
}
