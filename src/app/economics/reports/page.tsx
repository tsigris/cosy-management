"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState, Suspense, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import EconomicsHeaderNav from "@/components/economics/EconomicsHeaderNav"
import EconomicsPeriodFilter from "@/components/economics/EconomicsPeriodFilter"
import EconomicsContainer from "@/components/economics/EconomicsContainer"
import { toast, Toaster } from "sonner"
import { ChevronLeft } from "lucide-react"

const colors = {
  accentGreen: "#10b981",
  accentOrange: "#f97316",
  accentRed: "#dc2626",
}

type ReportsView = "summary" | "category" | "method" | "timeline" | "movements"

const isValidUUID = (id: any) => {
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === "string" && regex.test(id)
}

const moneyAbs = (n: any) => Math.abs(Number(n) || 0)

const getTxDate = (t: any) => {
  const raw = t?.date || t?.created_at
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const getTxYear = (t: any) => {
  const d = getTxDate(t)
  return d ? d.getFullYear() : null
}

function groupBy(rows: any[], keyFn: (r: any) => string | null) {
  const map: Record<string, { key: string; total: number; count: number }> = {}

  for (const r of rows) {
    const k = keyFn(r) || "Άγνωστο"

    if (!map[k]) map[k] = { key: k, total: 0, count: 0 }

    map[k].total += Number(r.amount || 0)
    map[k].count += 1
  }

  return Object.values(map).sort((a, b) => b.total - a.total)
}

function monthKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function ReportsContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()

  const storeIdFromUrl = searchParams.get("store")
  const hasValidStore = !!storeIdFromUrl && isValidUUID(storeIdFromUrl)

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  )
  const [view, setView] = useState<ReportsView>("summary")
  const [period, setPeriod] = useState<
    "month" | "year" | "30days" | "all"
  >("month")

  useEffect(() => {
    if (!hasValidStore) {
      router.replace("/select-store")
    }
  }, [hasValidStore, router])

  const load = useCallback(async () => {
    if (!storeIdFromUrl || !hasValidStore) return

    try {
      setLoading(true)

      const res = await supabase
        .from("transactions")
        .select("*")
        .eq("store_id", storeIdFromUrl)

      if (res.error) throw res.error

      setTransactions(res.data || [])
    } catch (err) {
      console.error(err)
      toast.error("Σφάλμα φόρτωσης αναφορών")
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl, hasValidStore, supabase])

  useEffect(() => {
    if (!hasValidStore) return
    load()
  }, [hasValidStore, load])

  if (!hasValidStore) {
    return null
  }

  const yearOptions = useMemo(() => {
    const s = new Set<number>()

    for (const t of transactions) {
      const y = getTxYear(t)
      if (y) s.add(y)
    }

    if (!s.size) s.add(new Date().getFullYear())

    return Array.from(s).sort((a, b) => b - a)
  }, [transactions])

  useEffect(() => {
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0])
    }
  }, [yearOptions, selectedYear])

  const getStartOfMonth = () => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  const getStartOfYear = () => {
    return new Date(selectedYear, 0, 1)
  }

  const getLast30Days = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }

  const filteredTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = getTxDate(tx)
      if (!d) return false

      if (period === "all") return true
      if (period === "month") return d >= getStartOfMonth()
      if (period === "year") return d >= getStartOfYear()
      if (period === "30days") return d >= getLast30Days()

      return true
    })
  }, [transactions, period, selectedYear])

  const incomeTypes = ["income", "income_collection", "debt_received"]
  const expenseTypes = ["expense", "debt_payment", "salary_advance"]

  const incomeTotal = useMemo(
    () =>
      filteredTx
        .filter((t) => incomeTypes.includes(t.type))
        .reduce((a, t) => a + Number(t.amount || 0), 0),
    [filteredTx]
  )

  const expenseTotal = useMemo(
    () =>
      filteredTx
        .filter((t) => expenseTypes.includes(t.type))
        .reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0),
    [filteredTx]
  )

  const netTotal = incomeTotal - expenseTotal

  const byCategory = useMemo(
    () => groupBy(filteredTx, (t) => String(t.category || t.type || "Άγνωστο")),
    [filteredTx]
  )

  const byMethod = useMemo(
    () =>
      groupBy(
        filteredTx,
        (t) =>
          String((t.payment_method || t.method || "").trim() || "Άγνωστη Μέθοδος")
      ),
    [filteredTx]
  )

  const byMonth = useMemo(() => {
    const map: Record<string, { key: string; total: number; count: number }> =
      {}

    for (const t of filteredTx) {
      const d = getTxDate(t)
      const k = d ? monthKey(d) : "Άγνωστο"

      if (!map[k]) map[k] = { key: k, total: 0, count: 0 }

      map[k].total += Number(t.amount || 0)
      map[k].count += 1
    }

    return Object.values(map).sort((a, b) =>
      String(b.key).localeCompare(String(a.key))
    )
  }, [filteredTx])

  const recent = useMemo(
    () =>
      filteredTx
        .slice()
        .sort(
          (a, b) =>
            (new Date(b.date || b.created_at).getTime() || 0) -
            (new Date(a.date || a.created_at).getTime() || 0)
        )
        .slice(0, 20),
    [filteredTx]
  )

  const card: any = {
    background: "var(--surface)",
    padding: 14,
    borderRadius: 16,
    border: "1px solid var(--border)",
    marginBottom: 12,
  }

  return (
    <EconomicsContainer>
      <Toaster position="top-center" richColors />

      <EconomicsHeaderNav
        title="Οικονομικό Κέντρο"
        subtitle="ΑΝΑΦΟΡΕΣ"
      />

      <EconomicsPeriodFilter
        period={period}
        onPeriodChange={(p) => setPeriod(p)}
        selectedYear={selectedYear}
        onYearChange={(y) => setSelectedYear(y)}
        yearOptions={yearOptions}
      />

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div>Έσοδα</div>
            <div style={{ color: colors.accentGreen, fontWeight: 900 }}>
              {incomeTotal.toLocaleString("el-GR", {
                minimumFractionDigits: 2,
              })}
              €
            </div>
          </div>

          <div>
            <div>Έξοδα</div>
            <div style={{ color: colors.accentOrange, fontWeight: 900 }}>
              {expenseTotal.toLocaleString("el-GR", {
                minimumFractionDigits: 2,
              })}
              €
            </div>
          </div>

          <div>
            <div>Καθαρό</div>
            <div
              style={{
                color: netTotal >= 0 ? colors.accentGreen : colors.accentRed,
                fontWeight: 900,
              }}
            >
              {netTotal.toLocaleString("el-GR", {
                minimumFractionDigits: 2,
              })}
              €
            </div>
          </div>
        </div>
      </div>

      {view === "category" && (
        <div>
          {byCategory.map((g) => (
            <div key={g.key} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>{g.key}</div>
                <div>
                  {g.total.toLocaleString("el-GR", {
                    minimumFractionDigits: 2,
                  })}
                  €
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "method" && (
        <div>
          {byMethod.map((g) => (
            <div key={g.key} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>{g.key}</div>
                <div>
                  {g.total.toLocaleString("el-GR", {
                    minimumFractionDigits: 2,
                  })}
                  €
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "timeline" && (
        <div>
          {byMonth.map((m) => (
            <div key={m.key} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>{m.key}</div>
                <div>
                  {m.total.toLocaleString("el-GR", {
                    minimumFractionDigits: 2,
                  })}
                  €
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "movements" && (
        <div>
          {recent.map((t) => (
            <div key={t.id} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>{t.category || t.type}</div>
                <div>
                  {moneyAbs(t.amount).toLocaleString("el-GR", {
                    minimumFractionDigits: 2,
                  })}
                  €
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </EconomicsContainer>
  )
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 50, textAlign: "center" }}>Φόρτωση...</div>
      }
    >
      <ReportsContent />
    </Suspense>
  )
}