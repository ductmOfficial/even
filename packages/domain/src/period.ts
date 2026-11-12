/** Dates are ISO "YYYY-MM-DD" strings in Asia/Ho_Chi_Minh; months are "YYYY-MM". */
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonth(now: Date = new Date()): string {
  return todayIso(now).slice(0, 7);
}

const MONTH = /^(\d{4})-(\d{2})$/;

function parseMonth(month: string): [number, number] {
  const m = MONTH.exec(month);
  if (!m) throw new RangeError(`Invalid month "${month}"`);
  return [Number(m[1]), Number(m[2])];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = parseMonth(month);
  return { from: `${month}-01`, to: `${String(y)}-${pad(m)}-${pad(daysInMonth(y, m))}` };
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = parseMonth(month);
  const index = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12))}-${pad((index % 12) + 1)}`;
}

/** Inclusive list of months from `from` to `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function formatMonth(month: string): string {
  const [y, m] = parseMonth(month);
  return `Tháng ${String(m)}/${String(y)}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d ?? ""}/${m ?? ""}/${y ?? ""}`;
}

/** Converts an Excel serial date (1900 system) to ISO, without timezone drift. */
export function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
