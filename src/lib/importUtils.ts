import * as XLSX from 'xlsx';

export interface ParsedMemberRow {
  full_name: string;
  phone?: string;
  department?: string;
}

export interface ParseResult {
  valid: ParsedMemberRow[];
  duplicates: number;
  errors: number;
}

/**
 * Parse an Excel (.xlsx, .xls) or CSV file buffer/array.
 */
export async function parseMembersFile(file: File, existingNames: Set<string>): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { valid: [], duplicates: 0, errors: 0 };
  }

  const sheet = workbook.Sheets[firstSheetName];
  // Convert sheet to JSON rows as array of arrays
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (!rows || rows.length === 0) {
    return { valid: [], duplicates: 0, errors: 0 };
  }

  // Find header indices
  let nameIdx = -1;
  let phoneIdx = -1;
  let deptIdx = -1;

  const headerRow = rows[0] || [];
  headerRow.forEach((cell, idx) => {
    const val = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (val.includes('name') || val === 'fullname' || val === 'member' || val === 'membername') {
      nameIdx = idx;
    } else if (val.includes('phone') || val.includes('mobile') || val.includes('tel') || val.includes('whatsapp') || val === 'contact') {
      phoneIdx = idx;
    } else if (val.includes('dept') || val.includes('department') || val.includes('unit') || val.includes('role') || val.includes('group')) {
      deptIdx = idx;
    }
  });

  const startIndex = (nameIdx !== -1) ? 1 : 0;
  if (nameIdx === -1) nameIdx = 0;
  if (phoneIdx === -1) phoneIdx = 1;
  if (deptIdx === -1) deptIdx = 2;

  const valid: ParsedMemberRow[] = [];
  let duplicates = 0;
  let errors = 0;
  const seenInFile = new Set<string>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawName = String(row[nameIdx] || '').trim();
    const rawPhone = row[phoneIdx] !== undefined ? String(row[phoneIdx]).trim() : '';
    const rawDept = row[deptIdx] !== undefined ? String(row[deptIdx]).trim() : '';

    if (!rawName || rawName.length < 2) {
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
      department: rawDept ? rawDept : 'General',
    });
  }

  return { valid, duplicates, errors };
}

/**
 * Generate and download a sample CSV/Excel template.
 */
export function downloadSampleCSVTemplate() {
  const wsData = [
    ['Full Name', 'Phone Number', 'Unit'],
    ['John Doe', '+234 803 123 4567', 'Choir'],
    ['Sarah Jenkins', '+234 802 987 6543', 'Ushering'],
    ['David Emmanuel', '+234 814 555 0192', 'Media'],
    ['Grace Adeleke', '', 'General'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  XLSX.writeFile(wb, 'atendee_members_template.xlsx');
}
