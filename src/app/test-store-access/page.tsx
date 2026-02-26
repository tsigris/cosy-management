'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type Row = { store_id: string; role: string }

export default function TestStoreAccessPage() {

  const supabase = getSupabase()

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {

      const { data, error } = await supabase
        .from('v_my_store_access')
        .select('*')

      if (error) {
        setError(error.message)
      } else {
        setRows(data || [])
      }

      setLoading(false)
    }

    run()
  }, [])

  return (
    <div>
      <h1>Store Access Test</h1>

      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}

      <pre>{JSON.stringify(rows, null, 2)}</pre>
    </div>
  )
}