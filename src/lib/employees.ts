import { getSupabase } from '@/lib/supabase'

function parseStartDay(startDate: unknown): number | null {
  if (typeof startDate !== 'string' || !startDate) return null
  const datePart = startDate.slice(0, 10)
  const parts = datePart.split('-').map((p) => Number(p))
  if (parts.length !== 3) return null
  const day = parts[2]
  if (!Number.isFinite(day) || day < 1 || day > 31) return null
  return day
}

function withCompatibilityFields(row: any) {
  const startDay = parseStartDay(row?.start_date)
  const payDay = row?.pay_day ?? row?.salary_day ?? row?.payment_day ?? startDay ?? null

  return {
    ...row,
    // Compatibility for modules that previously read from employees table.
    salary: row?.salary ?? row?.monthly_salary ?? null,
    pay_day: payDay,
    salary_day: row?.salary_day ?? payDay,
    payment_day: row?.payment_day ?? payDay,
  }
}

export async function getEmployees(storeId: string): Promise<any[]> {
  if (!storeId) return []

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('fixed_assets')
    .select('*')
    .eq('store_id', storeId)
    .eq('sub_category', 'staff')
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map(withCompatibilityFields)
}
