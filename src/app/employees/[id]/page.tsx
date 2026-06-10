import { notFound } from 'next/navigation'
import EmployeeWalletScreen from '@/components/employee-wallet/EmployeeWalletScreen'
import { isEmployeeLedgerPreviewEnabled } from '@/lib/featureFlags'

type EmployeeProfilePageProps = {
  params: { id: string } | Promise<{ id: string }>
  searchParams: { store?: string | string[] } | Promise<{ store?: string | string[] }>
}

export default async function EmployeeProfilePage({ params, searchParams }: EmployeeProfilePageProps) {
  if (!isEmployeeLedgerPreviewEnabled()) {
    notFound()
  }

  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams)

  const employeeId = String(resolvedParams?.id || '')
  const rawStore = resolvedSearchParams?.store
  const storeId = Array.isArray(rawStore) ? String(rawStore[0] || '') : String(rawStore || '')

  return <EmployeeWalletScreen employeeId={employeeId} storeId={storeId} />
}
