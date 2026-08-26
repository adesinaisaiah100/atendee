import { db } from './db';

/**
 * Extract code prefix from fellowship name.
 * Uses first word, uppercased, max 8 chars.
 * "Grace Assembly" → "GRACE"
 * "Christ Embassy Abuja" → "CHRIST"
 * "RCCG Youth" → "RCCG"
 */
export function getCodePrefix(fellowshipName: string): string {
  const firstWord = fellowshipName.trim().split(/\s+/)[0] || 'CODE';
  return firstWord.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
}

/**
 * Generate a unique check-in code for a member in a fellowship.
 * Format: PREFIX-XXXX (e.g. GRACE-4827)
 * Guaranteed unique within the fellowship.
 */
export async function generateUniqueCode(fellowshipId: string, fellowshipName: string): Promise<string> {
  const prefix = getCodePrefix(fellowshipName);

  // Fetch all existing codes for this fellowship to avoid duplicates
  const existingMembers = await db.members
    .where('fellowship_id')
    .equals(fellowshipId)
    .toArray();

  const usedCodes = new Set(existingMembers.map(m => m.check_in_code).filter(Boolean));

  let code: string;
  let attempts = 0;
  do {
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    code = `${prefix}-${digits}`;
    attempts++;
    // Safety: if we somehow exhaust 10000 codes (unlikely), extend to 5 digits
    if (attempts > 9500) {
      const digits5 = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
      code = `${prefix}-${digits5}`;
    }
  } while (usedCodes.has(code));

  return code;
}

/**
 * Generate multiple unique codes at once (for batch import).
 */
export async function generateBatchCodes(
  fellowshipId: string,
  fellowshipName: string,
  count: number
): Promise<string[]> {
  const prefix = getCodePrefix(fellowshipName);

  const existingMembers = await db.members
    .where('fellowship_id')
    .equals(fellowshipId)
    .toArray();

  const usedCodes = new Set(existingMembers.map(m => m.check_in_code).filter(Boolean));
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    let code: string;
    do {
      const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      code = `${prefix}-${digits}`;
    } while (usedCodes.has(code));
    usedCodes.add(code);
    codes.push(code);
  }

  return codes;
}

/**
 * Generate a URL-safe slug from a fellowship name.
 * "Grace Assembly" → "grace-assembly"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 48) || 'fellowship';
}

/**
 * Look up a member by their check-in code within a fellowship.
 */
export async function findMemberByCode(
  code: string,
  fellowshipId?: string
): Promise<import('../types').Member | undefined> {
  const normalizedCode = code.toUpperCase().trim();
  let query = db.members.where('check_in_code').equals(normalizedCode);
  if (fellowshipId) {
    return query.and(m => m.fellowship_id === fellowshipId).first();
  }
  return query.first();
}
