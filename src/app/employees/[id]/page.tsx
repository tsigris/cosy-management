import { notFound } from 'next/navigation'
import EmployeeProfilePreview from '@/components/employee-ledger-preview/EmployeeProfilePreview'
import { isEmployeeLedgerPreviewEnabled } from '@/lib/featureFlags'

type EmployeeProfilePageProps = {
  params: { id: string }
  searchParams: { store?: string }
}

export default function EmployeeProfilePage({ params, searchParams }: EmployeeProfilePageProps) {
  if (!isEmployeeLedgerPreviewEnabled()) {
    notFound()
  }

  return <EmployeeProfilePreview employeeId={params.id} storeId={String(searchParams.store || '')} />
}
