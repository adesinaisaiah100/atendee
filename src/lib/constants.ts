import type { Member, WcfEventCode } from '../types';

export const DEFAULT_UNIT = 'No Unit';

export const UNITS = [
  'No Unit',
  'Choir',
  'Ushering',
  'Evangelism',
  'Follow-up',
  'Media',
  'Publicity',
  'Organizing',
  'Prayer',
  'Transport',
  'Technical',
  'Welfare',
  'Bible Study',
  'Youth',
  'Children',
  'Sanctuary',
  'Other',
] as const;

export const COMMON_HOSTELS = [
  'Tedder Hall',
  'Mellanby Hall',
  'Kuti Hall',
  'Sultan Bello Hall',
  'Independence Hall',
  'Nnamdi Azikiwe Hall',
  'Queen Elizabeth II Hall',
  'Queen Idia Hall',
  'Obafemi Awolowo Hall',
  'Alexander Brown Hall',
  'Abdulsalami Abubakar Hall',
  'Off-Campus',
] as const;

export const WCF_EVENT_OPTIONS: {
  code: WcfEventCode;
  label: string;
  day: string;
}[] = [
  { code: 'sunday_service', label: 'Sunday Service', day: 'Sunday' },
  { code: 'bible_study', label: 'Bible Study', day: 'Thursday' },
  { code: 'prayer_meeting', label: 'Prayer Meeting', day: 'Monday' },
  { code: 'fjc', label: 'Freshers Jewel Committee (FJC)', day: 'Tuesday' },
];

/**
 * Returns 'all' + standard units + any custom legacy unit names found on members
 * (e.g. 'General') so filters never hide existing members.
 */
export function getUnitFilterOptions(members: Member[]): string[] {
  const known = new Set<string>(UNITS);
  const extras: string[] = [];
  for (const m of members) {
    const dept = m.department?.trim();
    if (dept && !known.has(dept)) {
      known.add(dept);
      extras.push(dept);
    }
  }
  return ['all', ...UNITS, ...extras.sort((a, b) => a.localeCompare(b))];
}
