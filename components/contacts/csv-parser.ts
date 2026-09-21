export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
  totalRows: number;
}

export type ContactFieldKey =
  | "__ignore__"
  | "name"
  | "email"
  | "company"
  | "phone"
  | "title"
  | "address"
  | "notes"
  | "tags";

export function detectDelimiter(sample: string): string {
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  if (semicolonCount > commaCount) return ";";
  return ",";
}

export function parseCsvContent(text: string): ParsedCsv {
  const cleanText = text.replace(/^\uFEFF/, "").trim(); // Remove UTF-8 BOM
  if (!cleanText) {
    return { headers: [], rows: [], delimiter: ",", totalRows: 0 };
  }

  const sampleLine = cleanText.split("\n")[0] || "";
  const delimiter = detectDelimiter(sampleLine);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;
  let i = 0;

  while (i < cleanText.length) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    if (!insideQuotes && (char === "\r" || char === "\n")) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentField.trim());
      if (currentRow.some((val) => val.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((val) => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], delimiter, totalRows: 0 };
  }

  const headers = rows[0].map((h) => h.replace(/^["']|["']$/g, "").trim());
  const dataRows = rows.slice(1);

  return {
    headers,
    rows: dataRows,
    delimiter,
    totalRows: dataRows.length,
  };
}

export function autoDetectFieldMapping(
  headers: string[]
): Record<string, ContactFieldKey> {
  const mapping: Record<string, ContactFieldKey> = {};

  const fieldPatterns: Record<Exclude<ContactFieldKey, "__ignore__">, RegExp> =
    {
      name: /(full[_\s-]?name|contact[_\s-]?name|first[_\s-]?name|^name$|الاسم|اسم)/i,
      email: /(e[_\s-]?mail|email[_\s-]?address|^mail$|البريد|الايميل)/i,
      phone: /(phone|mobile|tel|telephone|cell|هاتف|جوال|رقم)/i,
      company: /(company|organization|org|business|employer|الشركة|المؤسسة)/i,
      title: /(job[_\s-]?title|title|position|role|المسمى|الوظيفة)/i,
      address: /(address|location|street|city|العنوان|الموقع)/i,
      notes: /(notes?|comments?|description|remarks?|ملاحظات)/i,
      tags: /(tags?|labels?|categories?|وسوم|الوسوم)/i,
    };

  const usedFields = new Set<ContactFieldKey>();

  headers.forEach((header) => {
    const clean = header.trim();
    let matchedField: ContactFieldKey = "__ignore__";

    for (const [fieldKey, regex] of Object.entries(fieldPatterns) as [
      Exclude<ContactFieldKey, "__ignore__">,
      RegExp,
    ][]) {
      if (!usedFields.has(fieldKey) && regex.test(clean)) {
        matchedField = fieldKey;
        usedFields.add(fieldKey);
        break;
      }
    }

    mapping[header] = matchedField;
  });

  return mapping;
}

export function generateCsvTemplate(): string {
  const headers = [
    "Full Name",
    "Email Address",
    "Company",
    "Phone Number",
    "Job Title",
    "Address",
    "Notes",
    "Tags",
  ];
  const sampleRows = [
    [
      "Sarah Jenkins",
      "sarah.j@acmecorp.com",
      "Acme Innovations",
      "+1 (555) 234-5678",
      "VP of Procurement",
      "742 Evergreen Terrace, Springfield",
      "Key enterprise account sponsor",
      "enterprise, q1-priority",
    ],
    [
      "Omar Al-Mansoor",
      "omar@gulftech.ae",
      "Gulf Tech Solutions",
      "+971 50 123 4567",
      "Chief Technology Officer",
      "Dubai Internet City, Bldg 3",
      "Interested in custom API integrations",
      "partner, tech-lead",
    ],
  ];

  const escapeField = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escapeField).join(","),
    ...sampleRows.map((r) => r.map(escapeField).join(",")),
  ];

  return lines.join("\r\n");
}
