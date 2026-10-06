const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

/** Normalise Arabic for loose matching: strip harakat/tatweel, unify alif/ya/ta marbuta forms. */
export function normAr(s: string): string {
  return s
    .replace(DIACRITICS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalise Latin transliteration for search: lowercase, drop apostrophes/diacritics/articles. */
export function normLat(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['`ʿʾ’‘-]/g, '')
    .replace(/\b(al|ar|as|ash|at|az|an|ad|adh)\s?/g, '')
    .replace(/\bibn\b/g, 'bin')
    .replace(/\s+/g, ' ')
    .trim()
}

export const isArabic = (s: string) => /[؀-ۿ]/.test(s)
