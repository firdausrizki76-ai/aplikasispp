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
 * Returns a sorted list (descending) of academic years:
 * includes past 2 years, current year, next 2 years, plus any extra/existing years from DB.
 */
export function getDynamicAcademicYears(extraYears: (string | null | undefined)[] = []): string[] {
  const defaultYear = getDefaultPPDBAcademicYear();
  const [currStartStr] = defaultYear.split('/');
  const baseYear = parseInt(currStartStr, 10) || new Date().getFullYear();

  const yearsSet = new Set<string>();

  // Rolling window: 2 years back to 2 years ahead of PPDB year
  for (let i = -2; i <= 2; i++) {
    const y = baseYear + i;
    yearsSet.add(`${y}/${y + 1}`);
  }

  // Include any extra years from DB records (e.g. from existing candidates or student bills)
  for (const ey of extraYears) {
    if (ey && typeof ey === 'string' && ey.trim()) {
      yearsSet.add(ey.trim());
    }
  }

  // Sort descending: e.g. "2029/2030", "2028/2029", "2027/2028", ...
  return Array.from(yearsSet).sort().reverse();
}
