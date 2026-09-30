/**
 * Utility functions for Indonesian School Academic Years (Tahun Ajaran)
 * In Indonesia, the academic year runs from July to June.
 * - Current running academic year:
 *   If month >= 6 (July-December): `${year}/${year + 1}`
 *   If month < 6 (January-June): `${year - 1}/${year}`
 *
 * - PPDB (Penerimaan Siswa Baru) is typically opened for the NEXT academic year:
 *   If month >= 6 (July-December): `${year + 1}/${year + 2}`
 *   If month < 6 (January-June): `${year}/${year + 1}`
 */

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 6 = Jul
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

export function getDefaultPPDBAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 6 = Jul
  const startYear = month >= 6 ? year + 1 : year;
  return `${startYear}/${startYear + 1}`;
}

/**
 * Returns a list of academic years up to 100 years into the future (reaching 2100/2101+):
 * includes past 3 years, current PPDB year, and all subsequent years up to 100 years ahead.
 */
export function getDynamicAcademicYears(extraYears: (string | null | undefined)[] = []): string[] {
  const defaultYear = getDefaultPPDBAcademicYear();
  const [currStartStr] = defaultYear.split('/');
  const baseYear = parseInt(currStartStr, 10) || new Date().getFullYear();

  const yearsSet = new Set<string>();

  // Start from 3 years in the past (e.g. 2024) up to 100 years ahead (at least 2100/2101)
  const startFrom = Math.min(baseYear - 3, 2024);
  const endAt = Math.max(baseYear + 100, 2100);

  for (let y = startFrom; y <= endAt; y++) {
    yearsSet.add(`${y}/${y + 1}`);
  }

  // Include any extra years from DB records (e.g. from existing candidates or student bills)
  for (const ey of extraYears) {
    if (ey && typeof ey === 'string' && ey.trim()) {
      yearsSet.add(ey.trim());
    }
  }

  // Sort ascending: e.g. "2024/2025", "2025/2026", "2026/2027", "2027/2028", ... "2100/2101"
  return Array.from(yearsSet).sort((a, b) => a.localeCompare(b));
}
