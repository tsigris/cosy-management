'use client'

export const dynamic = 'force-dynamic'



import { useCallback, useEffect, useMemo, useRef, useState, Suspense, type CSSProperties } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Link from 'next/link'

import { toast, Toaster } from 'sonner'

import { getSupabase } from '@/lib/supabase'
import { getBusinessDate } from '@/lib/businessDate'
import { formatDateDMY } from '@/lib/formatters'

import {

ChevronLeft,

HandCoins,

PlusCircle,

Copy,

ChevronDown,

ChevronUp,

CalendarDays,

Hash,

BadgeEuro,

Landmark,

Banknote,

CircleDashed,

CheckCircle2,

X,

AlertTriangle,

AlertOctagon,

Pencil,

Trash2,

Sun,

Snowflake,

Repeat,

} from 'lucide-react'



const colors = {

primaryDark: '#1e293b',

secondaryText: '#64748b',

accentBlue: '#2563eb',

accentGreen: '#059669',

accentRed: '#dc2626',

bgLight: '#f8fafc',

border: '#e2e8f0',

white: '#ffffff',

modalBackdrop: 'rgba(2,6,23,0.6)',



warningBg: '#fffbeb',

warningBorder: '#fde68a',

warningText: '#92400e',



dangerBg: '#fff1f2',

dangerBorder: '#fecdd3',

dangerText: '#be123c',

}



type Settlement = {

id: string

name: string

type?: 'settlement' | 'loan' | null

rf_code: string | null

total_amount: number | null

installments_count: number | null

installment_amount: number | null

first_due_date: string | null

store_id?: string | null

created_at?: string | null

}



type Installment = {

id: string

settlement_id: string

installment_number: number

due_date: string

amount: number

status: string | null

transaction_id: string | null

store_id?: string | null

}



type PaymentMethod = 'Μετρητά' | 'Τράπεζα'



type LoanPlan = 'fixed' | 'seasonal' | 'summer_only'

type AmountFocus = 'total' | 'installment'



// ✅ Business Date (όπως στο Dashboard): πριν τις 07:00 → χθεσινή ημερομηνία




// days between due - today (positive = future, 0 = today, negative = overdue)

function daysDiff(due: string, today: string) {

const a = new Date(`${due}T12:00:00`)

const b = new Date(`${today}T12:00:00`)

const ms = a.getTime() - b.getTime()

return Math.round(ms / (1000 * 60 * 60 * 24))

}



function addMonthsSafe(isoDate: string, months: number) {

const source = new Date(`${isoDate}T12:00:00`)

const day = source.getDate()



const target = new Date(source)

target.setMonth(target.getMonth() + months)



if (target.getDate() !== day) {

target.setDate(0)

}



const y = target.getFullYear()

const m = String(target.getMonth() + 1).padStart(2, '0')

const d = String(target.getDate()).padStart(2, '0')

return `${y}-${m}-${d}`

}



function monthOf(iso: string) {

return new Date(`${iso}T12:00:00`).getMonth() + 1 // 1..12

}

function isSummerMonth(iso: string) {

const m = monthOf(iso)

return m >= 5 && m <= 10 // May..Oct

}



function nextPayingDueDate(currentIso: string, plan: 'monthly' | 'summer_only') {

let d = addMonthsSafe(currentIso, 1)

if (plan === 'monthly') return d

while (!isSummerMonth(d)) d = addMonthsSafe(d, 1)

return d

}



function toMoney(value: number | null | undefined) {

return `${Number(value || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

}



function formatDateGr(dateStr: string | null | undefined) {
if (!dateStr) return '—'
return formatDateDMY(dateStr, String(dateStr))

}



function getErrorMessage(error: unknown) {

if (error instanceof Error) return error.message

return 'Κάτι πήγε στραβά'

}



type DueState = 'ok' | 'warning' | 'danger'



function getDueState(due: string, today: string): { state: DueState; text: string; days: number } {

const d = daysDiff(due, today)

// ✅ 3 μέρες πριν → κίτρινο

if (d >= 0 && d <= 3) {

const text = d === 0 ? 'λήγει σήμερα' : `σε ${d} μέρες`

return { state: 'warning', text, days: d }

}

// ✅ αν έχει λήξει → κόκκινο + καθυστέρηση

if (d < 0) {

const late = Math.abs(d)

return { state: 'danger', text: `${late} μέρες σε καθυστέρηση`, days: d }

}

return { state: 'ok', text: '', days: d }

}



// ---------------------- ✅ MONEY INPUT (Greek friendly) ----------------------

function normalizeMoneyInput(raw: string) {

return String(raw || '')

.replace(/\s/g, '')

.replace(/[^\d.,-]/g, '')

}



function parseMoney(raw: string): number | null {

const s0 = normalizeMoneyInput(raw)

if (!s0) return null



let s = s0

s = s.replace(/(?!^)-/g, '')



const hasComma = s.includes(',')

const hasDot = s.includes('.')



if (hasComma && hasDot) {

s = s.replace(/\./g, '').replace(',', '.')

} else if (hasComma && !hasDot) {

s = s.replace(',', '.')

} else {

// dot as decimal or integer

}



const parts = s.split('.')

if (parts.length > 2) {

s = parts[0] + '.' + parts.slice(1).join('')

}



const n = Number(s)

if (!Number.isFinite(n)) return null

return n

}



function formatMoneyInputEl(n: number) {

return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

}



function SettlementsContent({ onUpdate }: { onUpdate?: () => void }) {

const supabase = getSupabase()

const searchParams = useSearchParams()

const router = useRouter()

const storeId = searchParams.get('store')



const [loading, setLoading] = useState(true)

const [savingSettlement, setSavingSettlement] = useState(false)

const [savingPayment, setSavingPayment] = useState(false)

const previousLoanPlanRef = useRef<LoanPlan>('fixed')

const [savingDelete, setSavingDelete] = useState(false)



const [openCreateModal, setOpenCreateModal] = useState(false)

const [openPaymentModal, setOpenPaymentModal] = useState(false)



const [settlements, setSettlements] = useState<Settlement[]>([])

const [installmentsMap, setInstallmentsMap] = useState<Record<string, Installment[]>>({})

const [expandedSettlementId, setExpandedSettlementId] = useState<string | null>(null)



const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null)

const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)

const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Μετρητά')

const [paymentAmount, setPaymentAmount] = useState<string>('')



// Create / Edit settlement

const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null)



const [name, setName] = useState('')

const [type, setType] = useState<'settlement' | 'loan'>('settlement')

const [rfCode, setRfCode] = useState('')



// Amounts as strings (Greek friendly)

const [totalAmount, setTotalAmount] = useState('')

const [installmentsCount, setInstallmentsCount] = useState('12')

const [installmentAmount, setInstallmentAmount] = useState('')

const [firstDueDate, setFirstDueDate] = useState(getBusinessDate())



// ✅ Loan plans

const [loanPlan, setLoanPlan] = useState<LoanPlan>('fixed')

const [summerAmount, setSummerAmount] = useState('')

const [winterAmount, setWinterAmount] = useState('')



const [amountFocus, setAmountFocus] = useState<AmountFocus>('total')



const todayStr = useMemo(() => getBusinessDate(), [])



// ✅ prevent background scroll when modal open (helps mobile + PC)

useEffect(() => {

const anyOpen = openCreateModal || openPaymentModal

if (!anyOpen) return

const prev = document.body.style.overflow

document.body.style.overflow = 'hidden'

return () => {

document.body.style.overflow = prev

}

}, [openCreateModal, openPaymentModal])



const pendingStats = useMemo(() => {

let pendingCount = 0

let pendingAmount = 0

let warningCount = 0

let dangerCount = 0



Object.values(installmentsMap).forEach((rows) => {

rows.forEach((row) => {

const isPending = (row.status || 'pending').toLowerCase() === 'pending'

if (!isPending) return



pendingCount += 1

pendingAmount += Number(row.amount || 0)



const due = getDueState(String(row.due_date), todayStr)

if (due.state === 'warning') warningCount += 1

if (due.state === 'danger') dangerCount += 1

})

})



return { pendingCount, pendingAmount, warningCount, dangerCount }

}, [installmentsMap, todayStr])



const resetCreateForm = useCallback(() => {

setEditingSettlementId(null)

setName('')

setType('settlement')

setRfCode('')



setTotalAmount('')

setInstallmentsCount('12')

setInstallmentAmount('')

setFirstDueDate(getBusinessDate())



setLoanPlan('fixed')

setSummerAmount('')

setWinterAmount('')



setAmountFocus('total')

}, [])



// ---------------------- ✅ AUTO CALC (two-way) ----------------------

useEffect(() => {

const count = Number(installmentsCount)

if (!Number.isInteger(count) || count <= 0) return



if (type === 'loan' && loanPlan === 'seasonal') {

const s = parseMoney(summerAmount)

const w = parseMoney(winterAmount)

if (!firstDueDate) return

if (!Number.isFinite(s || NaN) || (s as number) <= 0) return

if (!Number.isFinite(w || NaN) || (w as number) <= 0) return



let due = firstDueDate

let sum = 0

for (let i = 0; i < count; i++) {

sum += isSummerMonth(due) ? (s as number) : (w as number)

due = addMonthsSafe(due, 1)

}

setTotalAmount(formatMoneyInputEl(sum))

return

}



if (type === 'loan' && loanPlan === 'summer_only') {

const s = parseMoney(summerAmount)

if (!firstDueDate) return

if (!Number.isFinite(s || NaN) || (s as number) <= 0) return

const sum = (s as number) * count

setTotalAmount(formatMoneyInputEl(sum))

return

}



if (amountFocus === 'total') {

const total = parseMoney(totalAmount)

if (!Number.isFinite(total || NaN) || (total as number) <= 0) return

const per = (total as number) / count

if (!Number.isFinite(per) || per <= 0) return

setInstallmentAmount(formatMoneyInputEl(per))

} else {

const per = parseMoney(installmentAmount)

if (!Number.isFinite(per || NaN) || (per as number) <= 0) return

const total = (per as number) * count

if (!Number.isFinite(total) || total <= 0) return

setTotalAmount(formatMoneyInputEl(total))

}

}, [

type,

loanPlan,

summerAmount,

winterAmount,

firstDueDate,

installmentsCount,

totalAmount,

installmentAmount,

amountFocus,

])



useEffect(() => {

const previousPlan = previousLoanPlanRef.current

previousLoanPlanRef.current = loanPlan

if (loanPlan !== 'summer_only' || previousPlan === 'summer_only') return

const parsedCount = Number(installmentsCount)

if (!Number.isInteger(parsedCount) || parsedCount <= 6) return

toast.warning('6 δόσεις αντιστοιχούν σε 1 πλήρη καλοκαιρινή σεζόν')

}, [loanPlan, installmentsCount])



const loadData = useCallback(async () => {

if (!storeId) {

setLoading(false)

return

}



setLoading(true)

try {

const { data: settlementsData, error: settlementsErr } = await supabase

.from('settlements')

.select('*')

.eq('store_id', storeId)

.order('created_at', { ascending: false })



if (settlementsErr) throw settlementsErr



const mappedSettlements = (settlementsData || []) as Settlement[]

setSettlements(mappedSettlements)



if (!mappedSettlements.length) {

setInstallmentsMap({})

return

}



const settlementIds = mappedSettlements.map((s) => s.id)



const { data: installmentsData, error: installmentsErr } = await supabase

.from('installments')

.select('*')

.eq('store_id', storeId)

.in('settlement_id', settlementIds)

.order('installment_number', { ascending: true })



if (installmentsErr) throw installmentsErr



const grouped: Record<string, Installment[]> = {}

for (const row of (installmentsData || []) as Installment[]) {

const sid = String(row.settlement_id)

if (!grouped[sid]) grouped[sid] = []

grouped[sid].push(row)

}

setInstallmentsMap(grouped)

} catch (error: unknown) {

toast.error(getErrorMessage(error) || 'Αποτυχία φόρτωσης ρυθμίσεων')

} finally {

setLoading(false)

}

}, [storeId])



useEffect(() => {

const bootstrap = async () => {

const {

data: { session },

} = await supabase.auth.getSession()



if (!session) {

router.replace('/login')

return

}



if (!storeId) {

toast.error('Δεν βρέθηκε store στο URL')

setLoading(false)

return

}



await loadData()

}



void bootstrap()

}, [router, storeId, loadData])



const startCreate = () => {

resetCreateForm()

setOpenCreateModal(true)

}



function inferLoanPlanFromInstallments(rows: Installment[]): LoanPlan {

const pendingOrAll = rows.slice().sort((a, b) => a.installment_number - b.installment_number)

if (!pendingOrAll.length) return 'fixed'



const months = new Set<number>()

const amounts = new Set<number>()

for (const r of pendingOrAll) {

months.add(monthOf(String(r.due_date)))

amounts.add(Number(r.amount || 0))

}



const hasWinterMonths = Array.from(months).some((m) => m <= 4 || m >= 11)

const hasSummerMonths = Array.from(months).some((m) => m >= 5 && m <= 10)



if (hasSummerMonths && !hasWinterMonths) return 'summer_only'

if (hasWinterMonths && hasSummerMonths && amounts.size >= 2) return 'seasonal'

return 'fixed'

}



const startEditSettlement = (s: Settlement) => {

setEditingSettlementId(String(s.id))

setName(String(s.name || ''))

setType((s.type === 'loan' ? 'loan' : 'settlement') as any)

setRfCode(String(s.rf_code || ''))



setTotalAmount(s.total_amount != null ? formatMoneyInputEl(Number(s.total_amount)) : '')

setInstallmentsCount(s.installments_count != null ? String(s.installments_count) : '12')

setInstallmentAmount(s.installment_amount != null ? formatMoneyInputEl(Number(s.installment_amount)) : '')

setFirstDueDate(s.first_due_date ? String(s.first_due_date).slice(0, 10) : getBusinessDate())



const rows = installmentsMap[String(s.id)] || []

if ((s.type || '') === 'loan') {

const plan = inferLoanPlanFromInstallments(rows)

setLoanPlan(plan)



if (plan === 'seasonal') {

let sAmt: number | null = null

let wAmt: number | null = null

for (const r of rows) {

const due = String(r.due_date)

const amt = Number(r.amount || 0)

if (isSummerMonth(due) && sAmt == null) sAmt = amt

if (!isSummerMonth(due) && wAmt == null) wAmt = amt

}

if (sAmt != null) setSummerAmount(formatMoneyInputEl(sAmt))

if (wAmt != null) setWinterAmount(formatMoneyInputEl(wAmt))

} else if (plan === 'summer_only') {

const first = rows.find((r) => isSummerMonth(String(r.due_date)))

if (first) setSummerAmount(formatMoneyInputEl(Number(first.amount || 0)))

} else {

setSummerAmount('')

setWinterAmount('')

}

} else {

setLoanPlan('fixed')

setSummerAmount('')

setWinterAmount('')

}



setAmountFocus('total')

setOpenCreateModal(true)

}



const buildInstallmentsForPlan = useCallback(

(settlementId: string, count: number) => {

if (!storeId) return []

const sid = storeId // keep as string



const due0 = firstDueDate

if (!due0) return []



const rows: Array<{

store_id: string

settlement_id: string

installment_number: number

amount: number

due_date: string

status: string

}> = []



if (type === 'loan' && loanPlan === 'seasonal') {

const sAmt = parseMoney(summerAmount)

const wAmt = parseMoney(winterAmount)

if (!Number.isFinite(sAmt || NaN) || (sAmt as number) <= 0) return []

if (!Number.isFinite(wAmt || NaN) || (wAmt as number) <= 0) return []



let due = due0

for (let i = 0; i < count; i++) {

const amount = isSummerMonth(due) ? (sAmt as number) : (wAmt as number)

rows.push({

store_id: sid,

settlement_id: settlementId,

installment_number: i + 1,

amount,

due_date: due,

status: 'pending',

})

due = addMonthsSafe(due, 1)

}

return rows

}



if (type === 'loan' && loanPlan === 'summer_only') {

const sAmt = parseMoney(summerAmount)

const parsedCount = Number(count)

if (!Number.isInteger(parsedCount) || parsedCount <= 0) return []

if (!Number.isFinite(sAmt || NaN) || (sAmt as number) <= 0) return []



let due = due0

while (!isSummerMonth(due)) due = addMonthsSafe(due, 1)



for (let i = 0; i < parsedCount; i++) {

rows.push({

store_id: sid,

settlement_id: settlementId,

installment_number: i + 1,

amount: sAmt as number,

due_date: due,

status: 'pending',

})

due = nextPayingDueDate(due, 'summer_only')

}

return rows

}



const per = parseMoney(installmentAmount)

if (!Number.isFinite(per || NaN) || (per as number) <= 0) return []



for (let i = 0; i < count; i++) {

rows.push({

store_id: sid,

settlement_id: settlementId,

installment_number: i + 1,

amount: per as number,

due_date: addMonthsSafe(due0, i),

status: 'pending',

})

}

return rows

},

[storeId, firstDueDate, type, loanPlan, installmentAmount, summerAmount, winterAmount],

)



const onSaveSettlement = async () => {

if (!storeId) return toast.error('Λείπει το store')



const cleanName = name.trim()

const cleanRf = rfCode.trim()

const parsedCount = Number(installmentsCount)



if (!cleanName) return toast.error('Συμπλήρωσε όνομα ρύθμισης')

if (!cleanRf) return toast.error('Συμπλήρωσε κωδικό RF / Ταυτότητα Οφειλής')

if (!Number.isInteger(parsedCount) || parsedCount <= 0) return toast.error('Μη έγκυρος αριθμός δόσεων')

if (!firstDueDate) return toast.error('Συμπλήρωσε ημερομηνία 1ης δόσης')



let totalNum: number | null = null

let installmentNum: number | null = null



if (type === 'loan' && loanPlan === 'seasonal') {

const sAmt = parseMoney(summerAmount)

const wAmt = parseMoney(winterAmount)

if (!Number.isFinite(sAmt || NaN) || (sAmt as number) <= 0) return toast.error('Μη έγκυρο ποσό Καλοκαιριού')

if (!Number.isFinite(wAmt || NaN) || (wAmt as number) <= 0) return toast.error('Μη έγκυρο ποσό Χειμώνα')

if (!firstDueDate) return toast.error('Λείπει ημερομηνία 1ης δόσης')



let due = firstDueDate

let sum = 0

for (let i = 0; i < parsedCount; i++) {

sum += isSummerMonth(due) ? (sAmt as number) : (wAmt as number)

due = addMonthsSafe(due, 1)

}

totalNum = sum

installmentNum = null

} else if (type === 'loan' && loanPlan === 'summer_only') {

const sAmt = parseMoney(summerAmount)

if (!Number.isFinite(sAmt || NaN) || (sAmt as number) <= 0) return toast.error('Μη έγκυρο ποσό Καλοκαιριού')

totalNum = (sAmt as number) * parsedCount

installmentNum = sAmt as number

} else {

totalNum = parseMoney(totalAmount)

installmentNum = parseMoney(installmentAmount)

if (!Number.isFinite(totalNum || NaN) || (totalNum as number) <= 0) return toast.error('Μη έγκυρο συνολικό ποσό')

if (!Number.isFinite(installmentNum || NaN) || (installmentNum as number) <= 0) return toast.error('Μη έγκυρο ποσό ανά δόση')

}



setSavingSettlement(true)

let createdSettlementId: string | null = null



try {

const {

data: { session },

} = await supabase.auth.getSession()

if (!session) throw new Error('Η συνεδρία έληξε. Συνδέσου ξανά.')



const settlementPayload: any = {

store_id: storeId,

user_id: session.user.id,

name: cleanName,

type,

rf_code: cleanRf,

total_amount: totalNum,

installments_count: parsedCount,

installment_amount: installmentNum,

first_due_date: firstDueDate,

}



if (editingSettlementId) {

const rows = installmentsMap[String(editingSettlementId)] || []

const paidCount = rows.filter((r) => String(r.status || '').toLowerCase() === 'paid').length

if (paidCount > 0) {

const { error } = await supabase

.from('settlements')

.update(settlementPayload)

.eq('id', editingSettlementId)

.eq('store_id', storeId)

if (error) throw error

toast.success('Ενημερώθηκε (χωρίς αλλαγή δόσεων γιατί υπάρχουν πληρωμένες)')

setOpenCreateModal(false)

resetCreateForm()

await loadData()

return

}



const { error: upErr } = await supabase

.from('settlements')

.update(settlementPayload)

.eq('id', editingSettlementId)

.eq('store_id', storeId)

if (upErr) throw upErr



const { error: delInstErr } = await supabase

.from('installments')

.delete()

.eq('store_id', storeId)

.eq('settlement_id', editingSettlementId)

if (delInstErr) throw delInstErr



const installmentsPayload = buildInstallmentsForPlan(editingSettlementId, parsedCount)

if (!installmentsPayload.length) throw new Error('Δεν μπορώ να δημιουργήσω δόσεις: έλεγξε ποσά/ημερομηνία.')



const { error: insErr } = await supabase.from('installments').insert(installmentsPayload)

if (insErr) throw insErr



toast.success('Η συμφωνία ενημερώθηκε και οι δόσεις ανανεώθηκαν')

setOpenCreateModal(false)

resetCreateForm()

await loadData()

return

}



const { data: settlementRow, error: settlementErr } = await supabase

.from('settlements')

.insert([settlementPayload])

.select('id')

.single()



if (settlementErr) throw settlementErr
      createdSettlementId = settlementRow.id

      // Προσθήκη του ! μετά το createdSettlementId για να φύγει το TypeScript error
      const installmentsPayload = buildInstallmentsForPlan(createdSettlementId!, parsedCount)
      
      if (!installmentsPayload.length) {
        throw new Error('Δεν μπορώ να δημιουργήσω δόσεις: έλεγξε ποσά/ημερομηνία.')
      }

      const { error: installmentsErr } = await supabase
        .from('installments')
        .insert(installmentsPayload)

      if (installmentsErr) throw installmentsErr

      toast.success('Η συμφωνία δημιουργήθηκε με επιτυχία')
      setOpenCreateModal(false)
      resetCreateForm()
      await loadData()

} catch (error: unknown) {

if (createdSettlementId) {

await supabase.from('settlements').delete().eq('id', createdSettlementId).eq('store_id', storeId)

}

toast.error(getErrorMessage(error) || 'Αποτυχία αποθήκευσης συμφωνίας')

} finally {

setSavingSettlement(false)

}

}



const openPaymentFor = (settlement: Settlement, installment: Installment) => {

setSelectedSettlement(settlement)

setSelectedInstallment(installment)

setPaymentMethod('Μετρητά')

setPaymentAmount(formatMoneyInputEl(Math.abs(Number(installment.amount || 0))))

setOpenPaymentModal(true)

}



const onConfirmPayment = async () => {

if (!storeId) return toast.error('Λείπει το store')

if (!selectedInstallment || !selectedSettlement) return toast.error('Δεν βρέθηκε επιλεγμένη δόση')



const parsedPay = parseMoney(paymentAmount)

if (!Number.isFinite(parsedPay || NaN) || (parsedPay as number) <= 0) return toast.error('Μη έγκυρο ποσό πληρωμής')



setSavingPayment(true)

try {

const {

data: { session },

} = await supabase.auth.getSession()

if (!session) throw new Error('Η συνεδρία έληξε. Συνδέσου ξανά.')

const businessToday = getBusinessDate()



const isLoan = selectedSettlement.type === 'loan'

const category = isLoan ? 'Δάνεια' : 'Ρυθμίσεις'



const notes = `${isLoan ? 'Πληρωμή Δανείου' : 'Πληρωμή Ρύθμισης'} • Δόση #${selectedInstallment.installment_number}: ${

selectedSettlement.name

}${selectedSettlement.rf_code ? ` (RF: ${selectedSettlement.rf_code})` : ''}`

const installmentPaymentPayload = {

p_store_id: storeId,

p_installment_id: selectedInstallment.id,

p_amount: Math.abs(parsedPay as number),

p_method: paymentMethod,

p_category: category,

p_date: businessToday,

p_notes: notes,

p_type: 'expense',

}

console.log('INSTALLMENT PAYMENT INPUT', {
amount: Math.abs(parsedPay as number),
method: paymentMethod,
p_date: businessToday,
installment_id: selectedInstallment.id,
store_id: storeId,
payload: installmentPaymentPayload,
})

console.log('PAYMENT DATE CHECK', {
p_date: businessToday,
now: new Date().toISOString(),
})

const { data, error: installmentRpcErr } = await supabase.rpc('installment_payment_atomic', installmentPaymentPayload)



if (installmentRpcErr) {
console.error('INSTALLMENT PAYMENT ERROR FULL:', installmentRpcErr)
console.error('MESSAGE:', installmentRpcErr.message)
console.error('DETAILS:', installmentRpcErr.details)
console.error('HINT:', installmentRpcErr.hint)
throw installmentRpcErr
}

console.log('INSTALLMENT PAYMENT SUCCESS', data)



toast.success('Η δόση πληρώθηκε και καταχωρήθηκε στα έξοδα')

setOpenPaymentModal(false)

setSelectedInstallment(null)

setSelectedSettlement(null)

await loadData()

if (onUpdate) onUpdate()

} catch (err: any) {

console.error('INSTALLMENT PAYMENT CATCH:', err)

toast.error(
err?.message ||
'Σφάλμα πληρωμής (δες console)'
)

} finally {

setSavingPayment(false)

}

}



const onDeleteSettlement = async (settlementId: string) => {

if (!storeId) return



const rows = installmentsMap[String(settlementId)] || []

const paidCount = rows.filter((r) => String(r.status || '').toLowerCase() === 'paid').length

const totalCount = rows.length



const ok = confirm(

`Είσαι σίγουρος;\n\nΘα διαγραφεί η συμφωνία και ΟΛΕΣ οι δόσεις (${totalCount}).\nΠληρωμένες δόσεις: ${paidCount}.\n\n⚠️ Οι πληρωμές που έχουν ήδη περαστεί στα Έξοδα (transactions) ΔΕΝ θα σβηστούν.`,

)

if (!ok) return



setSavingDelete(true)

try {

const { error: delInstErr } = await supabase

.from('installments')

.delete()

.eq('store_id', storeId)

.eq('settlement_id', settlementId)

if (delInstErr) throw delInstErr



const { error: delSetErr } = await supabase

.from('settlements')

.delete()

.eq('id', settlementId)

.eq('store_id', storeId)

if (delSetErr) throw delSetErr



toast.success('Η συμφωνία διαγράφηκε')

setExpandedSettlementId(null)

await loadData()

if (onUpdate) onUpdate()

} catch (error: unknown) {

toast.error(getErrorMessage(error) || 'Αποτυχία διαγραφής')

} finally {

setSavingDelete(false)

}

}



const onCopyRf = async (rf: string | null) => {

if (!rf) return

try {

await navigator.clipboard.writeText(rf)

toast.success('Ο κωδικός RF αντιγράφηκε')

} catch {

toast.error('Αποτυχία αντιγραφής')

}

}



const settlementStatus = useCallback(

(settlementId: string): { state: DueState; label: string } => {

const rows = installmentsMap[String(settlementId)] || []

const pending = rows.filter((r) => (r.status || 'pending').toLowerCase() === 'pending')

if (!pending.length) return { state: 'ok', label: 'ΟΛΑ ΠΛΗΡΩΜΕΝΑ' }



let hasDanger = false

let hasWarning = false

let minDays = Number.POSITIVE_INFINITY

let lateDays = 0



for (const inst of pending) {

const due = getDueState(String(inst.due_date), todayStr)

if (due.state === 'danger') {

hasDanger = true

lateDays = Math.max(lateDays, Math.abs(due.days))

} else if (due.state === 'warning') {

hasWarning = true

minDays = Math.min(minDays, due.days)

}

}



if (hasDanger) return { state: 'danger', label: `${lateDays}μ καθυστέρηση` }

if (hasWarning) return { state: 'warning', label: minDays === 0 ? 'ΛΗΓΕΙ ΣΗΜΕΡΑ' : `ΛΗΓΕΙ ΣΕ ${minDays}μ` }

return { state: 'ok', label: 'OK' }

},

[installmentsMap, todayStr],

)



if (loading) {

return (

<div style={wrapperStyle}>

<div style={contentStyle}>

<div style={loadingCardStyle}>

<CircleDashed size={20} className="animate-spin" />

<span>Φόρτωση ρυθμίσεων...</span>

</div>

</div>

</div>

)

}



const showLoanPlan = type === 'loan'



return (

<div style={wrapperStyle}>

<Toaster richColors position="top-center" />



<div style={contentStyle}>

<header style={headerStyle}>

<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

<div style={logoBoxStyle}>

<HandCoins size={20} color={colors.accentBlue} />

</div>

<div>

<h1 style={titleStyle}>Ρυθμίσεις & Δάνεια</h1>

<p style={subtitleStyle}>Διαχείριση δόσεων και πληρωμών</p>

</div>

</div>



<Link href={`/?store=${storeId || ''}`} style={backBtnStyle}>

<ChevronLeft size={18} />

</Link>

</header>



<div style={summaryCardStyle}>

<div>

<p style={summaryLabelStyle}>ΕΚΚΡΕΜΕΙΣ ΔΟΣΕΙΣ</p>

<p style={summaryValueStyle}>{pendingStats.pendingCount}</p>

<p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 800, opacity: 0.8 }}>

<span style={{ marginRight: 10 }}>🟡 {pendingStats.warningCount}</span>

<span>🔴 {pendingStats.dangerCount}</span>

</p>

</div>

<div style={{ textAlign: 'right' }}>

<p style={summaryLabelStyle}>ΣΥΝΟΛΟ ΥΠΟΛΟΙΠΟΥ</p>

<p style={summaryValueStyle}>{toMoney(pendingStats.pendingAmount)}</p>

<p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 800, opacity: 0.8 }}>

Business Date: {formatDateGr(todayStr)}

</p>

</div>

</div>



<button type="button" style={newBtnStyle} onClick={startCreate}>

<PlusCircle size={18} />

Νέα Ρύθμιση

</button>



{settlements.length === 0 ? (

<div style={emptyStateStyle}>

<HandCoins size={36} color="#cbd5e1" />

<p style={{ margin: '8px 0 0', fontWeight: 800, color: colors.secondaryText }}>Δεν υπάρχουν ρυθμίσεις ακόμη</p>

</div>

) : (

<div style={{ display: 'grid', gap: 12 }}>

{settlements.map((settlement) => {

const isOpen = expandedSettlementId === settlement.id

const settlementInstallments = installmentsMap[settlement.id] || []

const paidCount = settlementInstallments.filter((i) => (i.status || '').toLowerCase() === 'paid').length

const status = settlementStatus(settlement.id)



const statusPill =

status.state === 'danger'

? { bg: colors.dangerBg, bd: colors.dangerBorder, tx: colors.dangerText, icon: <AlertOctagon size={12} /> }

: status.state === 'warning'

? { bg: colors.warningBg, bd: colors.warningBorder, tx: colors.warningText, icon: <AlertTriangle size={12} /> }

: { bg: '#eff6ff', bd: '#bfdbfe', tx: '#1d4ed8', icon: <CheckCircle2 size={12} /> }



return (

<article key={settlement.id} style={cardStyle}>

<button

type="button"

style={accordionBtnStyle}

onClick={() => setExpandedSettlementId(isOpen ? null : settlement.id)}

>

<div style={{ textAlign: 'left' }}>

<div style={{ marginBottom: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

{settlement.type === 'loan' ? (

<span style={{ ...typeBadgeStyle, ...loanTypeBadgeStyle }}>

<Landmark size={12} />

ΔΑΝΕΙΟ

</span>

) : (

<span style={{ ...typeBadgeStyle, ...settlementTypeBadgeStyle }}>

<HandCoins size={12} />

ΡΥΘΜΙΣΗ

</span>

)}



<span

style={{

display: 'inline-flex',

alignItems: 'center',

gap: 6,

padding: '3px 8px',

borderRadius: 999,

border: `1px solid ${statusPill.bd}`,

background: statusPill.bg,

color: statusPill.tx,

fontSize: 10,

fontWeight: 900,

}}

title="Κατάσταση εκκρεμών δόσεων"

>

{statusPill.icon}

{status.label}

</span>

</div>



<h3 style={settlementTitleStyle}>{settlement.name}</h3>



<div style={rfRowStyle}>

<Hash size={14} color={colors.secondaryText} />

<span style={rfTextStyle}>RF: {settlement.rf_code || '—'}</span>

{settlement.rf_code && (

<span

role="button"

onClick={(e) => {

e.stopPropagation()

void onCopyRf(settlement.rf_code)

}}

style={copyBtnStyle}

>

<Copy size={14} />

</span>

)}

</div>

</div>



<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>

<span style={miniBadgeStyle}>

{paidCount} / {settlementInstallments.length} Πληρωμένες

</span>

{isOpen ? (

<ChevronUp size={18} color={colors.secondaryText} />

) : (

<ChevronDown size={18} color={colors.secondaryText} />

)}

</div>

</button>



<div style={rowInfoStyle}>

<div style={rowInfoItemStyle}>

<BadgeEuro size={14} color={colors.accentBlue} />

<span>Σύνολο: {toMoney(settlement.total_amount)}</span>

</div>

<div style={rowInfoItemStyle}>

<CalendarDays size={14} color={colors.accentBlue} />

<span>1η Δόση: {formatDateGr(settlement.first_due_date)}</span>

</div>

</div>



{isOpen && (

<div style={installmentsWrapStyle}>

<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>

<button

type="button"

onClick={() => startEditSettlement(settlement)}

style={{

border: `1px solid ${colors.border}`,

background: colors.white,

color: colors.primaryDark,

borderRadius: 12,

padding: '10px 12px',

fontWeight: 900,

cursor: 'pointer',

display: 'inline-flex',

alignItems: 'center',

gap: 8,

fontSize: 12,

}}

>

<Pencil size={14} /> Επεξεργασία

</button>



<button

type="button"

onClick={() => onDeleteSettlement(settlement.id)}

disabled={savingDelete}

style={{

border: `1px solid ${colors.dangerBorder}`,

background: colors.dangerBg,

color: colors.dangerText,

borderRadius: 12,

padding: '10px 12px',

fontWeight: 900,

cursor: 'pointer',

display: 'inline-flex',

alignItems: 'center',

gap: 8,

fontSize: 12,

opacity: savingDelete ? 0.7 : 1,

}}

>

<Trash2 size={14} /> Διαγραφή

</button>

</div>



{settlementInstallments.length === 0 ? (

<p style={{ margin: 0, color: colors.secondaryText, fontWeight: 700 }}>Δεν υπάρχουν δόσεις.</p>

) : (

settlementInstallments.map((inst) => {

const isPending = (inst.status || 'pending').toLowerCase() === 'pending'

const due = getDueState(String(inst.due_date), todayStr)



const rowTone =

due.state === 'danger'

? { bg: colors.dangerBg, bd: colors.dangerBorder }

: due.state === 'warning'

? { bg: colors.warningBg, bd: colors.warningBorder }

: { bg: colors.white, bd: colors.border }



return (

<div

key={inst.id}

style={{

...installmentRowStyle,

background: rowTone.bg,

borderColor: rowTone.bd,

}}

>

<div>

<p style={installmentTitleStyle}>Δόση #{inst.installment_number}</p>

<p style={installmentMetaStyle}>

Λήξη: {formatDateGr(inst.due_date)}

{isPending && due.state !== 'ok' ? (

<span

style={{

marginLeft: 8,

fontWeight: 900,

color: due.state === 'danger' ? colors.dangerText : colors.warningText,

}}

>

• {due.text}

</span>

) : null}

</p>

</div>



<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

<span style={amountChipStyle}>{toMoney(inst.amount)}</span>

{isPending ? (

<button type="button" style={payBtnStyle} onClick={() => openPaymentFor(settlement, inst)}>

Πληρωμή

</button>

) : (

<span style={paidChipStyle}>

<CheckCircle2 size={13} />

Πληρωμένη

</span>

)}

</div>

</div>

)

})

)}

</div>

)}

</article>

)

})}

</div>

)}

</div>



{/* CREATE / EDIT MODAL */}

{openCreateModal && (

<div style={modalBackdropStyle} onClick={() => !savingSettlement && setOpenCreateModal(false)}>

<div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>

<div style={modalHeaderStyle}>

<h2 style={modalTitleStyle}>{editingSettlementId ? 'Επεξεργασία Συμφωνίας' : 'Νέα Συμφωνία'}</h2>

<button

type="button"

style={iconCloseBtnStyle}

onClick={() => {

setOpenCreateModal(false)

resetCreateForm()

}}

disabled={savingSettlement}

>

<X size={16} />

</button>

</div>



{/* ✅ SCROLLABLE BODY */}

<div style={modalBodyStyle}>

<div style={formGridStyle}>

<div style={inputGroupStyle}>

<label style={labelStyle}>Τύπος Συμφωνίας</label>

<div style={typeToggleWrapStyle}>

<button

type="button"

style={{

...typeBtnStyle,

...(type === 'settlement' ? typeBtnActiveStyleGreen : {}),

}}

onClick={() => setType('settlement')}

>

Ρύθμιση (π.χ. Εφορία)

</button>

<button

type="button"

style={{

...typeBtnStyle,

...(type === 'loan' ? typeBtnActiveStyleBlue : {}),

}}

onClick={() => setType('loan')}

>

Δάνειο (Τράπεζα)

</button>

</div>

</div>



{showLoanPlan && (

<div style={inputGroupStyle}>

<label style={labelStyle}>Πλάνο Πληρωμών (Δάνειο)</label>

<div style={loanPlanWrapStyle}>

<button

type="button"

style={{ ...loanPlanBtnStyle, ...(loanPlan === 'fixed' ? loanPlanBtnActiveStyle : {}) }}

onClick={() => setLoanPlan('fixed')}

title="Ίδιο ποσό κάθε μήνα"

>

<Repeat size={14} /> Σταθερό

</button>

<button

type="button"

style={{ ...loanPlanBtnStyle, ...(loanPlan === 'seasonal' ? loanPlanBtnActiveStyle : {}) }}

onClick={() => setLoanPlan('seasonal')}

title="Μάιος–Οκτώβριος ένα ποσό, Νοέμβριος–Απρίλιος άλλο ποσό"

>

<Sun size={14} /> <Snowflake size={14} /> Εποχικό

</button>

<button

type="button"

style={{ ...loanPlanBtnStyle, ...(loanPlan === 'summer_only' ? loanPlanBtnActiveStyle : {}) }}

onClick={() => setLoanPlan('summer_only')}

title="Πληρώνω μόνο Μάιο–Οκτώβριο, χειμώνα 0 (δεν δημιουργούνται δόσεις)"

>

<Sun size={14} /> Μόνο Καλοκαίρι

</button>

</div>



<div style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText, marginTop: 6 }}>

* Στο «Μόνο Καλοκαίρι» δεν μπαίνουν χειμερινές δόσεις (0€).

</div>

</div>

)}



<div style={inputGroupStyle}>

<label style={labelStyle}>Όνομα</label>

<input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />

</div>



<div style={inputGroupStyle}>

<label style={labelStyle}>Κωδικός RF / Ταυτότητα Οφειλής</label>

<input style={inputStyle} value={rfCode} onChange={(e) => setRfCode(e.target.value)} />

</div>



<div style={twoColGridStyle}>

<div style={inputGroupStyle}>

<label style={labelStyle}>

{type === 'loan' && loanPlan !== 'fixed' ? 'Συνολικό Ποσό (Αυτόματο)' : 'Συνολικό Ποσό'}

</label>

<input

style={{

...inputStyle,

opacity: type === 'loan' && loanPlan !== 'fixed' ? 0.85 : 1,

}}

inputMode="decimal"

placeholder="π.χ. 3.056,32"

value={totalAmount}

onChange={(e) => {

const v = normalizeMoneyInput(e.target.value)

setAmountFocus('total')

setTotalAmount(v)

}}

onBlur={() => {

const n = parseMoney(totalAmount)

if (n != null) setTotalAmount(formatMoneyInputEl(n))

}}

disabled={type === 'loan' && loanPlan !== 'fixed'}

/>

<div style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText, marginTop: 6 }}>

Δέχεται: <span style={{ fontWeight: 900 }}>3.056,32</span> ή <span style={{ fontWeight: 900 }}>3056.32</span>

</div>

</div>



<div style={inputGroupStyle}>

<label style={labelStyle}>

{type === 'loan' && loanPlan === 'summer_only' ? 'Αριθμός Δόσεων (Πληρωμές)' : 'Αριθμός Δόσεων'}

</label>

<input

style={inputStyle}

type="number"

min="1"

step="1"

value={installmentsCount}

onChange={(e) => setInstallmentsCount(e.target.value)}

/>

</div>

</div>



{/* Amount area */}

{type === 'loan' && loanPlan === 'seasonal' ? (

<>

<div style={twoColGridStyle}>

<div style={inputGroupStyle}>

<label style={labelStyle}>Ποσό Καλοκαίρι (Μάιος–Οκτώβριος)</label>

<input

style={inputStyle}

inputMode="decimal"

placeholder="π.χ. 1.000,00"

value={summerAmount}

onChange={(e) => setSummerAmount(normalizeMoneyInput(e.target.value))}

onBlur={() => {

const n = parseMoney(summerAmount)

if (n != null) setSummerAmount(formatMoneyInputEl(n))

}}

/>

</div>

<div style={inputGroupStyle}>

<label style={labelStyle}>Ποσό Χειμώνας (Νοέμβριος–Απρίλιος)</label>

<input

style={inputStyle}

inputMode="decimal"

placeholder="π.χ. 150,00"

value={winterAmount}

onChange={(e) => setWinterAmount(normalizeMoneyInput(e.target.value))}

onBlur={() => {

const n = parseMoney(winterAmount)

if (n != null) setWinterAmount(formatMoneyInputEl(n))

}}

/>

</div>

</div>



{/* ✅ FIX #1: seasonal start date */}

<div style={inputGroupStyle}>

<label style={labelStyle}>Ημερομηνία 1ης Δόσης</label>

<input

style={inputStyle}

type="date"

value={firstDueDate}

onChange={(e) => setFirstDueDate(e.target.value)}

/>

<div style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText }}>

* Μπορείς να ξεκινήσεις από οποιονδήποτε μήνα (π.χ. από τον επόμενο μήνα).

</div>

</div>

</>

) : type === 'loan' && loanPlan === 'summer_only' ? (

<div style={twoColGridStyle}>

<div style={inputGroupStyle}>

<label style={labelStyle}>Ποσό Καλοκαιρινής Δόσης (Μάιος–Οκτώβριος)</label>

<input

style={inputStyle}

inputMode="decimal"

placeholder="π.χ. 1.000,00"

value={summerAmount}

onChange={(e) => setSummerAmount(normalizeMoneyInput(e.target.value))}

onBlur={() => {

const n = parseMoney(summerAmount)

if (n != null) setSummerAmount(formatMoneyInputEl(n))

}}

/>

<div style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText, marginTop: 6 }}>

* Χειμώνα δεν δημιουργούνται δόσεις (0€).

</div>

</div>

<div style={inputGroupStyle}>

<label style={labelStyle}>Ημερομηνία 1ης Δόσης</label>

<input

style={inputStyle}

type="date"

value={firstDueDate}

onChange={(e) => setFirstDueDate(e.target.value)}

/>

</div>

</div>

) : (

<div style={twoColGridStyle}>

<div style={inputGroupStyle}>

<label style={labelStyle}>Ποσό ανά Δόση</label>

<input

style={inputStyle}

inputMode="decimal"

placeholder="π.χ. 254,69"

value={installmentAmount}

onChange={(e) => {

const v = normalizeMoneyInput(e.target.value)

setAmountFocus('installment')

setInstallmentAmount(v)

}}

onBlur={() => {

const n = parseMoney(installmentAmount)

if (n != null) setInstallmentAmount(formatMoneyInputEl(n))

}}

/>

<div style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText }}>

Αυτόματο: γράψε Σύνολο ή Δόση — υπολογίζει το άλλο.

</div>

</div>



<div style={inputGroupStyle}>

<label style={labelStyle}>Ημερομηνία 1ης Δόσης</label>

<input

style={inputStyle}

type="date"

value={firstDueDate}

onChange={(e) => setFirstDueDate(e.target.value)}

/>

</div>

</div>

)}

</div>

</div>



{/* ✅ STICKY FOOTER (always reachable) */}

<div style={modalFooterStyle}>

<button type="button" style={saveBtnStyle} onClick={onSaveSettlement} disabled={savingSettlement}>

{savingSettlement ? 'Αποθήκευση...' : editingSettlementId ? 'Αποθήκευση Αλλαγών' : 'Αποθήκευση'}

</button>



{editingSettlementId && (

<button

type="button"

onClick={() => {

resetCreateForm()

setOpenCreateModal(false)

}}

disabled={savingSettlement}

style={{

width: '100%',

marginTop: 10,

border: `1px solid ${colors.border}`,

borderRadius: 12,

padding: 12,

fontWeight: 900,

background: colors.white,

cursor: 'pointer',

color: colors.primaryDark,

}}

>

Ακύρωση

</button>

)}

</div>

</div>

</div>

)}



{/* PAYMENT MODAL */}

{openPaymentModal && selectedInstallment && selectedSettlement && (

<div style={modalBackdropStyle} onClick={() => !savingPayment && setOpenPaymentModal(false)}>

<div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>

<div style={modalHeaderStyle}>

<h2 style={modalTitleStyle}>Πληρωμή Δόσης</h2>

<button type="button" style={iconCloseBtnStyle} onClick={() => setOpenPaymentModal(false)} disabled={savingPayment}>

<X size={16} />

</button>

</div>



<div style={modalBodyStyle}>

<div style={paymentInfoBoxStyle}>

<p style={paymentInfoTitleStyle}>{selectedSettlement.name}</p>

<p style={paymentInfoMetaStyle}>

Δόση #{selectedInstallment.installment_number} • {toMoney(selectedInstallment.amount)} • Λήξη:{' '}

{formatDateGr(selectedInstallment.due_date)}

</p>

</div>



<label style={{ ...labelStyle, marginTop: 10 }}>Ποσό Πληρωμής</label>

<input

style={inputStyle}

inputMode="decimal"

placeholder="π.χ. 150,00"

value={paymentAmount}

onChange={(e) => setPaymentAmount(normalizeMoneyInput(e.target.value))}

onBlur={() => {

const n = parseMoney(paymentAmount)

if (n != null) setPaymentAmount(formatMoneyInputEl(n))

}}

/>

<div style={{ fontSize: 11, fontWeight: 800, color: colors.secondaryText, marginTop: 6 }}>

* Μπορείς να αλλάξεις ποσό (μερική/διαφορετική πληρωμή). Θα γραφτεί αυτό στα Έξοδα και θα “κλειδώσει” η δόση ως πληρωμένη.

</div>



<label style={{ ...labelStyle, marginTop: 12 }}>Τρόπος Πληρωμής</label>

<div style={methodToggleWrapStyle}>

<button

type="button"

style={{ ...methodBtnStyle, ...(paymentMethod === 'Μετρητά' ? methodBtnActiveStyle : {}) }}

onClick={() => setPaymentMethod('Μετρητά')}

>

<Banknote size={15} />

Μετρητά

</button>

<button

type="button"

style={{ ...methodBtnStyle, ...(paymentMethod === 'Τράπεζα' ? methodBtnActiveStyle : {}) }}

onClick={() => setPaymentMethod('Τράπεζα')}

>

<Landmark size={15} />

Τράπεζα

</button>

</div>

</div>



<div style={modalFooterStyle}>

<button type="button" style={saveBtnStyle} onClick={onConfirmPayment} disabled={savingPayment}>

{savingPayment ? 'Καταχώρηση...' : 'Ολοκλήρωση Πληρωμής'}

</button>

</div>

</div>

</div>

)}

</div>

)

}



const wrapperStyle: CSSProperties = {

background: colors.bgLight,

minHeight: '100dvh',

padding: '20px',

}



const contentStyle: CSSProperties = {

maxWidth: '640px',

margin: '0 auto',

paddingBottom: '100px',

}



const headerStyle: CSSProperties = {

display: 'flex',

justifyContent: 'space-between',

alignItems: 'center',

marginBottom: '14px',

}



const logoBoxStyle: CSSProperties = {

width: '44px',

height: '44px',

borderRadius: '14px',

background: '#eef2ff',

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

}



const titleStyle: CSSProperties = {

margin: 0,

fontSize: '20px',

fontWeight: 900,

color: colors.primaryDark,

}



const subtitleStyle: CSSProperties = {

margin: 0,

fontSize: '12px',

fontWeight: 700,

color: colors.secondaryText,

}



const backBtnStyle: CSSProperties = {

textDecoration: 'none',

width: '40px',

height: '40px',

borderRadius: '12px',

background: colors.white,

border: `1px solid ${colors.border}`,

color: colors.secondaryText,

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

}



const summaryCardStyle: CSSProperties = {

background: colors.primaryDark,

borderRadius: '20px',

padding: '16px',

display: 'flex',

justifyContent: 'space-between',

color: colors.white,

marginBottom: '14px',

}



const summaryLabelStyle: CSSProperties = {

margin: 0,

opacity: 0.7,

fontWeight: 800,

fontSize: '11px',

}



const summaryValueStyle: CSSProperties = {

margin: '6px 0 0',

fontWeight: 900,

fontSize: '22px',

}



const newBtnStyle: CSSProperties = {

width: '100%',

border: 'none',

borderRadius: '14px',

background: colors.accentBlue,

color: colors.white,

fontWeight: 900,

padding: '14px 16px',

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

gap: 8,

cursor: 'pointer',

marginBottom: '12px',

}



const emptyStateStyle: CSSProperties = {

background: colors.white,

border: `1px solid ${colors.border}`,

borderRadius: '18px',

padding: '24px',

textAlign: 'center',

}



const cardStyle: CSSProperties = {

background: colors.white,

border: `1px solid ${colors.border}`,

borderRadius: '16px',

padding: '12px',

}



const accordionBtnStyle: CSSProperties = {

width: '100%',

border: 'none',

background: 'transparent',

cursor: 'pointer',

display: 'flex',

justifyContent: 'space-between',

alignItems: 'center',

gap: 8,

}



const settlementTitleStyle: CSSProperties = {

margin: 0,

fontSize: '16px',

fontWeight: 900,

color: colors.primaryDark,

}



const rfRowStyle: CSSProperties = {

marginTop: '4px',

display: 'flex',

alignItems: 'center',

gap: 6,

}



const rfTextStyle: CSSProperties = {

fontSize: '12px',

fontWeight: 700,

color: colors.secondaryText,

}



const copyBtnStyle: CSSProperties = {

width: '22px',

height: '22px',

borderRadius: '8px',

border: `1px solid ${colors.border}`,

background: '#f8fafc',

display: 'inline-flex',

alignItems: 'center',

justifyContent: 'center',

color: colors.secondaryText,

cursor: 'pointer',

}



const miniBadgeStyle: CSSProperties = {

background: '#eff6ff',

color: '#1d4ed8',

border: '1px solid #bfdbfe',

fontSize: '11px',

fontWeight: 800,

borderRadius: '999px',

padding: '4px 8px',

}



const typeBadgeStyle: CSSProperties = {

display: 'inline-flex',

alignItems: 'center',

gap: 4,

borderRadius: '999px',

border: '1px solid',

padding: '3px 8px',

fontSize: '10px',

fontWeight: 900,

letterSpacing: 0.3,

}



const loanTypeBadgeStyle: CSSProperties = {

background: '#eff6ff',

color: colors.accentBlue,

borderColor: '#bfdbfe',

}



const settlementTypeBadgeStyle: CSSProperties = {

background: '#ecfdf5',

color: colors.accentGreen,

borderColor: '#a7f3d0',

}



const rowInfoStyle: CSSProperties = {

marginTop: '10px',

display: 'flex',

flexWrap: 'wrap',

gap: 10,

}



const rowInfoItemStyle: CSSProperties = {

display: 'inline-flex',

alignItems: 'center',

gap: 6,

fontSize: '12px',

fontWeight: 700,

color: colors.secondaryText,

}



const installmentsWrapStyle: CSSProperties = {

marginTop: '10px',

borderTop: `1px solid ${colors.border}`,

paddingTop: '10px',

display: 'grid',

gap: 10,

}



const installmentRowStyle: CSSProperties = {

border: `1px solid ${colors.border}`,

borderRadius: '12px',

padding: '10px',

display: 'flex',

justifyContent: 'space-between',

alignItems: 'center',

gap: 8,

}



const installmentTitleStyle: CSSProperties = {

margin: 0,

fontWeight: 900,

fontSize: '13px',

color: colors.primaryDark,

}



const installmentMetaStyle: CSSProperties = {

margin: '3px 0 0',

color: colors.secondaryText,

fontSize: '12px',

fontWeight: 700,

}



const amountChipStyle: CSSProperties = {

background: '#f8fafc',

border: `1px solid ${colors.border}`,

borderRadius: '10px',

padding: '6px 8px',

fontWeight: 900,

fontSize: '12px',

whiteSpace: 'nowrap',

}



const payBtnStyle: CSSProperties = {

border: 'none',

borderRadius: '10px',

background: colors.accentGreen,

color: colors.white,

fontSize: '12px',

fontWeight: 800,

padding: '8px 10px',

cursor: 'pointer',

}



const paidChipStyle: CSSProperties = {

background: '#ecfdf5',

color: '#065f46',

border: '1px solid #a7f3d0',

borderRadius: '10px',

fontSize: '12px',

fontWeight: 800,

display: 'inline-flex',

alignItems: 'center',

gap: 4,

padding: '7px 9px',

whiteSpace: 'nowrap',

}



const loadingCardStyle: CSSProperties = {

marginTop: '40px',

background: colors.white,

border: `1px solid ${colors.border}`,

borderRadius: '14px',

padding: '22px',

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

gap: 10,

color: colors.secondaryText,

fontWeight: 800,

}



/* ✅ FIX #2: Backdrop scroll + align top */

const modalBackdropStyle: CSSProperties = {

position: 'fixed',

inset: 0,

background: colors.modalBackdrop,

zIndex: 120,

display: 'flex',

alignItems: 'flex-start',

justifyContent: 'center',

padding: '16px',

overflowY: 'auto',

WebkitOverflowScrolling: 'touch',

}



/* ✅ FIX #2: Card becomes flex column, body scroll, footer sticky */

const modalCardStyle: CSSProperties = {

display: 'flex',

flexDirection: 'column',

position: 'relative',

width: '100%',

maxWidth: '520px',

background: colors.white,

borderRadius: '18px',

border: `1px solid ${colors.border}`,

padding: '16px',

maxHeight: '70vh',

overflow: 'hidden',

}



const modalBodyStyle: CSSProperties = {

flex: '1 1 auto',

minHeight: 0,

overflowY: 'auto',

paddingBottom: '80px',

WebkitOverflowScrolling: 'touch',

paddingRight: 2,

}



const modalFooterStyle: CSSProperties = {

position: 'absolute',

bottom: 0,

left: 0,

right: 0,

borderTop: '1px solid #e2e8f0',

background: 'white',

padding: '16px',

zIndex: 100,

}



const modalHeaderStyle: CSSProperties = {

display: 'flex',

alignItems: 'center',

justifyContent: 'space-between',

marginBottom: '10px',

}



const modalTitleStyle: CSSProperties = {

margin: 0,

fontWeight: 900,

fontSize: '17px',

color: colors.primaryDark,

}



const iconCloseBtnStyle: CSSProperties = {

width: '30px',

height: '30px',

borderRadius: '10px',

border: `1px solid ${colors.border}`,

background: colors.white,

color: colors.secondaryText,

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

cursor: 'pointer',

}



const formGridStyle: CSSProperties = {

display: 'grid',

gap: 10,

}



const inputGroupStyle: CSSProperties = {

display: 'flex',

flexDirection: 'column',

gap: 6,

}



const labelStyle: CSSProperties = {

fontSize: '12px',

fontWeight: 800,

color: colors.secondaryText,

}



const typeToggleWrapStyle: CSSProperties = {

border: `1px solid ${colors.border}`,

borderRadius: '12px',

background: colors.bgLight,

padding: '4px',

display: 'grid',

gridTemplateColumns: '1fr 1fr',

gap: 4,

}



const typeBtnStyle: CSSProperties = {

border: 'none',

borderRadius: '9px',

padding: '10px 8px',

fontSize: '12px',

fontWeight: 900,

color: colors.secondaryText,

background: 'transparent',

cursor: 'pointer',

textAlign: 'center',

}



const typeBtnActiveStyleGreen: CSSProperties = {

background: '#ecfdf5',

color: '#065f46',

boxShadow: '0 1px 2px rgba(0,0,0,0.10)',

border: '1px solid #a7f3d0',

}



const typeBtnActiveStyleBlue: CSSProperties = {

background: '#eff6ff',

color: '#1d4ed8',

boxShadow: '0 1px 2px rgba(0,0,0,0.10)',

border: '1px solid #bfdbfe',

}



const inputStyle: CSSProperties = {

width: '100%',

border: `1px solid ${colors.border}`,

borderRadius: '12px',

padding: '12px',

fontSize: '16px',

fontWeight: 700,

outline: 'none',

background: colors.bgLight,

}



const twoColGridStyle: CSSProperties = {

display: 'grid',

gridTemplateColumns: '1fr 1fr',

gap: 10,

}



const saveBtnStyle: CSSProperties = {

width: '100%',

border: 'none',

borderRadius: '12px',

padding: '13px',

background: colors.accentBlue,

color: colors.white,

fontWeight: 900,

cursor: 'pointer',

}



const paymentInfoBoxStyle: CSSProperties = {

border: `1px solid ${colors.border}`,

borderRadius: '12px',

padding: '10px',

background: '#f8fafc',

}



const paymentInfoTitleStyle: CSSProperties = {

margin: 0,

fontWeight: 900,

color: colors.primaryDark,

}



const paymentInfoMetaStyle: CSSProperties = {

margin: '4px 0 0',

fontSize: '12px',

fontWeight: 700,

color: colors.secondaryText,

}



const methodToggleWrapStyle: CSSProperties = {

marginTop: '6px',

border: `1px solid ${colors.border}`,

borderRadius: '12px',

background: colors.bgLight,

padding: '4px',

display: 'grid',

gridTemplateColumns: '1fr 1fr',

gap: 4,

}



const methodBtnStyle: CSSProperties = {

border: 'none',

borderRadius: '9px',

padding: '10px',

fontSize: '13px',

fontWeight: 900,

color: colors.secondaryText,

background: 'transparent',

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

gap: 6,

cursor: 'pointer',

}



const methodBtnActiveStyle: CSSProperties = {

background: colors.white,

color: colors.primaryDark,

boxShadow: '0 1px 2px rgba(0,0,0,0.1)',

}



const loanPlanWrapStyle: CSSProperties = {

border: `1px solid ${colors.border}`,

borderRadius: 12,

background: colors.bgLight,

padding: 4,

display: 'grid',

gridTemplateColumns: '1fr 1fr 1fr',

gap: 4,

}



const loanPlanBtnStyle: CSSProperties = {

border: 'none',

borderRadius: 9,

padding: '10px 8px',

fontSize: 12,

fontWeight: 900,

color: colors.secondaryText,

background: 'transparent',

cursor: 'pointer',

display: 'flex',

alignItems: 'center',

justifyContent: 'center',

gap: 6,

textAlign: 'center',

}



const loanPlanBtnActiveStyle: CSSProperties = {

background: colors.white,

color: colors.primaryDark,

boxShadow: '0 1px 2px rgba(0,0,0,0.10)',

}



export default function SettlementsPage({ onUpdate }: { onUpdate?: () => void }) {

return (

<Suspense fallback={null}>

<SettlementsContent onUpdate={onUpdate} />

</Suspense>

)

}