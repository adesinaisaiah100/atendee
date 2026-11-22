import * as XLSX from 'xlsx';
import { DEFAULT_UNIT } from './constants';

export interface ParsedMemberRow {
  full_name: string;
  phone?: string;
  department?: string;
  hostel?: string;
  room_or_block?: string;
}

export interface ParseResult {
  valid: ParsedMemberRow[];
  duplicates: number;
  errors: number;
}

/**
 * Parse an Excel (.xlsx, .xls) or CSV file buffer/array.
 * Intelligently recognizes church, campus, fellowship, and org rosters,
 * separating Hostel/Hall, Room/Block, and Unit/Department cleanly.
 */
export async function parseMembersFile(file: File, existingNames: Set<string>): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { valid: [], duplicates: 0, errors: 0 };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (!rows || rows.length === 0) {
    return { valid: [], duplicates: 0, errors: 0 };
  }

  // Find header indices
  let nameIdx = -1;
  let firstNameIdx = -1;
  let lastNameIdx = -1;
  let phoneIdx = -1;
  let deptIdx = -1;
  let hostelIdx = -1;
  let roomIdx = -1;

  const headerRow = rows[0] || [];
  headerRow.forEach((cell, idx) => {
    const raw = String(cell || '').toLowerCase().trim();
    const clean = raw.replace(/[^a-z0-9]/g, '');

    // 1. Separate First Name / Last Name
    if (clean === 'firstname' || clean === 'first') {
      firstNameIdx = idx;
    } else if (clean === 'lastname' || clean === 'surname' || clean === 'last') {
      lastNameIdx = idx;
    }
    // 2. Full Name
    else if (
      clean === 'name' ||
      clean === 'fullname' ||
      clean === 'member' ||
      clean === 'membername' ||
      clean.includes('studentname') ||
      clean.includes('attendeename')
    ) {
      nameIdx = idx;
    }
    // 3. Phone Number (careful not to match 'hostel' or 'hotel' as 'tel')
    else if (
      clean.includes('phone') ||
      clean.includes('mobile') ||
      clean.includes('whatsapp') ||
      clean === 'contact' ||
      clean === 'contactno' ||
      clean === 'telephone' ||
      clean === 'telno' ||
      /\btel\b/.test(raw)
    ) {
      phoneIdx = idx;
    }
    // 4. Hostel / Hall / Residence
    else if (
      clean.includes('hostel') ||
      clean.includes('hall') ||
      clean.includes('residence') ||
      clean.includes('accommodation') ||
      clean.includes('location')
    ) {
      hostelIdx = idx;
    }
    // 5. Room / Block
    else if (
      clean.includes('room') ||
      clean.includes('block') ||
      clean === 'roomno' ||
      clean === 'roomorblock'
    ) {
      roomIdx = idx;
    }
    // 6. Unit / Department / Ministry
    else if (
      clean.includes('dept') ||
      clean.includes('department') ||
      clean.includes('unit') ||
      clean.includes('ministry') ||
      clean.includes('role') ||
      clean.includes('group') ||
      clean.includes('team')
    ) {
      deptIdx = idx;
    }
  });

  const hasHeaders =
    nameIdx !== -1 ||
    firstNameIdx !== -1 ||
    phoneIdx !== -1 ||
    deptIdx !== -1 ||
    hostelIdx !== -1 ||
    roomIdx !== -1;
  const startIndex = hasHeaders ? 1 : 0;

  if (nameIdx === -1 && firstNameIdx === -1) nameIdx = 0;
  if (phoneIdx === -1) phoneIdx = 1;
  if (!hasHeaders) {
    if (hostelIdx === -1) hostelIdx = 2;
    if (roomIdx === -1) roomIdx = 3;
    if (deptIdx === -1) deptIdx = 4;
  }

  const valid: ParsedMemberRow[] = [];
  let duplicates = 0;
  let errors = 0;
  const seenInFile = new Set<string>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let rawName = '';
    if (firstNameIdx !== -1 && lastNameIdx !== -1) {
      const fName = String(row[firstNameIdx] || '').trim();
      const lName = String(row[lastNameIdx] || '').trim();
      rawName = `${fName} ${lName}`.trim();
    } else if (nameIdx !== -1) {
      rawName = String(row[nameIdx] || '').trim();
    }

    const rawPhone = phoneIdx !== -1 && row[phoneIdx] !== undefined ? String(row[phoneIdx]).trim() : '';
    const rawHostel = hostelIdx !== -1 && row[hostelIdx] !== undefined ? String(row[hostelIdx]).trim() : '';
    const rawRoom = roomIdx !== -1 && row[roomIdx] !== undefined ? String(row[roomIdx]).trim() : '';
    const rawDept = deptIdx !== -1 && row[deptIdx] !== undefined ? String(row[deptIdx]).trim() : '';

    if (!rawName || rawName.length < 2 || /^[0-9]+$/.test(rawName)) {
      errors++;
      continue;
    }

    const normalizedName = rawName.toLowerCase();
    if (existingNames.has(normalizedName) || seenInFile.has(normalizedName)) {
      duplicates++;
      continue;
    }

    seenInFile.add(normalizedName);

    valid.push({
      full_name: rawName,
      phone: rawPhone ? rawPhone.replace(/[^0-9+() -]/g, '').trim() : undefined,
      hostel: rawHostel || undefined,
      room_or_block: rawRoom || undefined,
      department: rawDept || DEFAULT_UNIT,
    });
  }

  return { valid, duplicates, errors };
}

/**
 * Generate and download a sample CSV/Excel template.
 */
export function downloadSampleCSVTemplate() {
  const wsData = [
    ['Full Name', 'Phone Number', 'Hostel / Hall', 'Room / Block', 'Unit / Department'],
    ['Boluwatife Adeleke', '08012345678', 'Tedder Hall', 'Block B, Room 14', 'Ushering'],
    ['Sarah Jenkins', '08029876543', 'Queen Idia Hall', 'Block A, Room 12', 'Follow-up'],
    ['David Emmanuel', '08145550192', 'Mellanby Hall', 'A1', 'Media'],
    ['Prosper Adewale', '07039975804', 'Independence Hall', 'Block C, Room 4', 'Evangelism'],
    ['Grace Okafor', '08091122334', 'Off-Campus', 'Agbowo', 'No Unit'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, 'atendee_members_template.xlsx');
}
