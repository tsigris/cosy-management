"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState, Suspense, useCallback } from "react"
import { getSupabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import EconomicsHeaderNav from "@/components/economics/EconomicsHeaderNav"
import EconomicsPeriodFilter from "@/components/economics/EconomicsPeriodFilter"
import EconomicsContainer from "@/components/economics/EconomicsContainer"
import { toast, Toaster } from "sonner"
import { toBusinessDayDateFromInput } from "@/lib/businessDate"

const colors = {
  accentGreen: "#10b981",
  accentOrange: "#f97316",
  accentRed: "#dc2626",
}

type ReportsView = "summary" | "category" | "method" | "document" | "timeline" | "movements"

type DocumentBucket = "invoice" | "retail_receipt" | "no_document"

const viewOptions: Array<{ value: ReportsView; label: string }> = [
  { value: "summary", label: "Σύνοψη" },
  { value: "category", label: "Κατηγορία" },
  { value: "method", label: "Μέθοδος" },
  { value: "document", label: "Παραστατικό" },
  { value: "timeline", label: "Χρονική" },
  { value: "movements", label: "Κινήσεις" },
]

const DOCUMENT_ROW_ORDER: DocumentBucket[] = ["invoice", "retail_receipt", "no_document"]

const DOCUMENT_LABELS: Record<DocumentBucket, string> = {
  invoice: "Τιμολόγιο",
  retail_receipt: "Απόδειξη Λιανικής",
  no_document: "Χωρίς Τιμολόγιο",
}

const isValidUUID = (id: any) => {
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === "string" && regex.test(id)
}

const moneyAbs = (n: any) => Math.abs(Number(n) || 0)

const getTxDate = (t: any) => {
  if (!t) return null
  const raw = t?.date
  if (!raw) return null
  const d = toBusinessDayDateFromInput(raw, { normalizeToNoon: true })
  if (!d) return null
  return isNaN(d.getTime()) ? null : d
}

const getTxYear = (t: any) => {
  const d = getTxDate(t)
  return d ? d.getFullYear() : null
}

function groupBy(rows: any[], keyFn: (r: any) => string | null) {
  const map: Record<string, { key: string; total: number; count: number }> = {}

  for (const r of rows) {
    if (!r) continue
    const k = keyFn(r) || "Άγνωστο"

    if (!map[k]) map[k] = { key: k, total: 0, count: 0 }

    map[k].total += Number(r?.amount ?? 0)
    map[k].count += 1
  }

  return Object.values(map).sort((a, b) => b.total - a.total)
}

function monthKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function normalizeDocText(value: any) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function normalizeDocumentBucket(rawValue: any): DocumentBucket {
  const v = normalizeDocText(rawValue)

  if (!v) return "no_document"

  if (
    v.includes("χωρις τιμολογιο") ||
    v.includes("χωρις παραστατικο") ||
    v.includes("no invoice") ||
    v.includes("no document")
  ) {
    return "no_document"
  }

  if (
    v.includes("αποδειξη λιανικης") ||
    v.includes("λιανικη") ||
    v.includes("retail receipt")
  ) {
    return "retail_receipt"
  }

  if (v.includes("τιμολογιο") || v.includes("invoice")) {
    return "invoice"
  }

  return "no_document"
}

function getDocumentBucketFromTx(tx: any): DocumentBucket {
  // Expense form stores document type at the start of notes, keep fallback fields for compatibility.
  return normalizeDocumentBucket(
    tx?.notes ?? tx?.document_type ?? tx?.receipt_type ?? tx?.invoice_type ?? tx?.description
  )
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

    const transactionSelect = "id, store_id, date, created_at, type, amount, category, method, notes"

    try {
      setLoading(true)

      let q = supabase
        .from("transactions")
        .select(transactionSelect)
        .eq("store_id", storeIdFromUrl)

      if (period !== "all") {
        const toDateKey = (d: Date) => {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, "0")
          const day = String(d.getDate()).padStart(2, "0")
          return `${y}-${m}-${day}`
        }

        let fromDate = "1970-01-01"
        if (period === "month") {
          const now = new Date()
          fromDate = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
        } else if (period === "year") {
          fromDate = toDateKey(new Date(selectedYear, 0, 1))
        } else if (period === "30days") {
          const d = new Date()
          d.setDate(d.getDate() - 30)
          fromDate = toDateKey(d)
        }

        q = q.gte("date", fromDate).lte("date", "9999-12-31")
      }

      const res = await q

      if (res.error) throw res.error

      setTransactions(res.data || [])
    } catch (err) {
      const error = err as { message?: string; details?: string; hint?: string }
      console.error("Reports transactions query failed", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        query: {
          table: "transactions",
          select: transactionSelect,
          filters: {
            store_id: storeIdFromUrl,
            period,
            selectedYear,
          },
        },
      })
      toast.error("Σφάλμα φόρτωσης αναφορών")
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl, hasValidStore, supabase, period, selectedYear])

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
      if (!tx) return false
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
        .filter((t) => incomeTypes.includes(String(t?.type || "")))
        .reduce((a, t) => a + Number(t?.amount ?? 0), 0),
    [filteredTx]
  )

  const expenseSideTx = useMemo(
    () => filteredTx.filter((t) => expenseTypes.includes(String(t?.type || ""))),
    [filteredTx]
  )

  const expenseTotal = useMemo(
    () => expenseSideTx.reduce((a, t) => a + Math.abs(Number(t?.amount ?? 0)), 0),
    [expenseSideTx]
  )

  const netTotal = incomeTotal - expenseTotal

  const byCategory = useMemo(
    () => groupBy(filteredTx, (t) => String(t?.category ?? t?.type ?? "Άγνωστο")),
    [filteredTx]
  )

  const byMethod = useMemo(
    () =>
      groupBy(
        filteredTx,
        (t) =>
          String((t?.method ?? t?.payment_method ?? "").trim() || "Άγνωστη Μέθοδος")
      ),
    [filteredTx]
  )

  const byMonth = useMemo(() => {
    const map: Record<string, { key: string; total: number; count: number }> =
      {}

    for (const t of filteredTx) {
      if (!t) continue
      const d = getTxDate(t)
      const k = d ? monthKey(d) : "Άγνωστο"

      if (!map[k]) map[k] = { key: k, total: 0, count: 0 }

      map[k].total += Number(t?.amount ?? 0)
      map[k].count += 1
    }

    return Object.values(map).sort((a, b) =>
      String(b.key).localeCompare(String(a.key))
    )
  }, [filteredTx])

  const byDocument = useMemo(() => {
    const seed: Record<DocumentBucket, { key: DocumentBucket; total: number; count: number }> = {
      invoice: { key: "invoice", total: 0, count: 0 },
      retail_receipt: { key: "retail_receipt", total: 0, count: 0 },
      no_document: { key: "no_document", total: 0, count: 0 },
    }

    for (const t of expenseSideTx) {
      if (!t) continue
      const bucket = getDocumentBucketFromTx(t)
      seed[bucket].total += Math.abs(Number(t?.amount ?? 0))
      seed[bucket].count += 1
    }

    return DOCUMENT_ROW_ORDER.map((k) => seed[k])
  }, [expenseSideTx])

  const recent = useMemo(
    () =>
      filteredTx
        .slice()
        .sort((a, b) => (getTxDate(b)?.getTime() || 0) - (getTxDate(a)?.getTime() || 0))
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

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {viewOptions.map((opt) => {
          const isActive = view === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setView(opt.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: isActive ? "var(--text)" : "var(--surface)",
                color: isActive ? "var(--surfaceSolid)" : "var(--text)",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

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

      {view === "document" && (
        <div>
          {byDocument.map((row) => {
            const pct = expenseTotal > 0 ? (row.total / expenseTotal) * 100 : 0

            return (
              <div key={row.key} style={card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{DOCUMENT_LABELS[row.key]}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{row.count} κινήσεις</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900 }}>
                      {row.total.toLocaleString("el-GR", {
                        minimumFractionDigits: 2,
                      })}
                      €
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{pct.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )
          })}
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