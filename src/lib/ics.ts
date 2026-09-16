import type { Debt } from '../types'
import { allPayments, addDays, type ScheduledPayment } from './schedule'

/**
 * Every scheduled payment as a calendar file the phone's own calendar can
 * import, each with an alert the evening before. Reminders without a server:
 * once imported they fire whether or not this app is ever opened again.
 *
 * All-day events, so the alarm is the calendar's usual day-before notice
 * rather than a fixed clock time in a time zone this file does not know.
 */
export function paymentsToICS(
  debts: Debt[],
  todayISO: string,
  horizonDays = 365,
  stamp = new Date(),
): { text: string; count: number } {
  const until = addDays(todayISO, horizonDays)
  const payments = allPayments(debts).filter((p) => p.date >= todayISO && p.date <= until)
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//P-Finance//Payments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Debt payments',
    ...payments.flatMap((p) => event(p, dtstamp)),
    'END:VCALENDAR',
  ]
  // RFC 5545 wants CRLF and lines folded at 75 octets.
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: payments.length }
}

function event(p: ScheduledPayment, dtstamp: string): string[] {
  const day = p.date.replace(/-/g, '')
  const next = addDays(p.date, 1).replace(/-/g, '')
  const amount = p.amount.toFixed(2)
  return [
    'BEGIN:VEVENT',
    `UID:${p.debtId}-${p.date}@p-finance`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${escape(`${p.debtName} — $${amount}${p.isFinal ? ' (final)' : ''}`)}`,
    `DESCRIPTION:${escape(`$${amount} due to ${p.debtName}.${p.isFinal ? ' This is the last payment.' : ''}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(`${p.debtName} $${amount} due tomorrow`)}`,
    'TRIGGER:-PT6H',
    'END:VALARM',
    'END:VEVENT',
  ]
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function fold(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 0) {
    out.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return out.join('\r\n')
}
