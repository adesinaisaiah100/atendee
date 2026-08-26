import { db } from './db';
import type { Fellowship } from '../types';

/**
 * Resolve a fellowship by its URL slug from local Dexie database.
 */
export async function getFellowshipBySlug(slug: string): Promise<Fellowship | undefined> {
  return db.fellowships.where('slug').equals(slug.toLowerCase()).first();
}
