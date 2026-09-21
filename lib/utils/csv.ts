/**
 * Lightweight, zero-dependency, RFC 4180-compliant CSV parser and
 * fuzzy header matching engine for intelligent contact import.
 */

export type ContactImportField =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "title"
  | "address"
  | "notes"
  | "tags"
  | "ignore";

export interface ParsedCsvResult {
  headers: string[];
  rows: string[][];
}

/**
 * Detects the most likely delimiter (comma, semicolon, or tab) based on
 * the first line of the CSV text.
 */
function detectDelimiter(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return "\t";
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ";";
  return ",";
}

/**
 * Parses raw CSV text into headers and rows conforming to RFC 4180.
 * Accurately handles quoted strings, escaped quotes (`""`), commas/semicolons,
 * and newlines inside quoted fields.
 */
export function parseCsv(text: string): ParsedCsvResult {
  const cleanText = text.replace(/^\uFEFF/, ""); // Strip BOM if present
  if (!cleanText.trim()) {
    return { headers: [], rows: [] };
  }

  const firstLine = cleanText.split(/\r\n|\n|\r/)[0] || "";
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = cleanText.length;

  while (i < len) {
    const char = cleanText[i];
    const nextChar = i + 1 < len ? cleanText[i + 1] : "";

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double quote ("")
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      }

      if (char === "\r" || char === "\n") {
        currentRow.push(currentField.trim());
        currentField = "";

        // Consume \r\n or single newline
        if (char === "\r" && nextChar === "\n") {
          i += 2;
        } else {
          i++;
        }

        // Only keep row if it has at least one non-empty field
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        continue;
      }

      currentField += char;
      i++;
    }
  }

  // Flush remaining field/row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = rows[0].map((h) => h.replace(/^["']|["']$/g, "").trim());
  const dataRows = rows.slice(1);

  return {
    headers: rawHeaders,
    rows: dataRows,
  };
}

/**
 * Fuzzy header matcher that automatically associates CSV column headers
 * with the corresponding contact entity field.
 */
export function detectFieldMapping(header: string): ContactImportField {
  const norm = header
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ")
    .trim();

  // 1. Full name / Name / First Name
  if (
    /^(full\s*name|name|contact\s*name|client\s*name|customer\s*name|first\s*name|fullname|firstname|الاسم|اسم جهة الاتصال|الاسم الكامل)$/i.test(
      norm
    ) ||
    norm === "contact" ||
    norm === "person"
  ) {
    return "name";
  }

  // 2. Email / E-mail
  if (
    /^(email|e-mail|e_mail|mail|email\s*address|e-mail\s*address|البريد|البريد الإلكتروني|الايميل)$/i.test(
      norm
    )
  ) {
    return "email";
  }

  // 3. Phone / Mobile / Cell
  if (
    /^(phone|telephone|mobile|cell|phone\s*number|mobile\s*number|cell\s*phone|contact\s*number|tel|gsm|هاتف|الجوال|رقم الهاتف|رقم الجوال)$/i.test(
      norm
    )
  ) {
    return "phone";
  }

  // 4. Company / Organization
  if (
    /^(company|organization|organisation|business|corp|corporation|company\s*name|org|org\s*name|الشركة|المؤسسة|جهة العمل)$/i.test(
      norm
    )
  ) {
    return "company";
  }

  // 5. Title / Role / Position
  if (
    /^(title|job\s*title|role|position|job|designation|occupation|المسمى الوظيفي|المنصب|الوظيفة)$/i.test(
      norm
    )
  ) {
    return "title";
  }

  // 6. Address / Location / City
  if (
    /^(address|street|street\s*address|location|city|country|state|postal\s*code|zip|العنوان|الموقع|المدينة)$/i.test(
      norm
    )
  ) {
    return "address";
  }

  // 7. Notes / Description / Comments
  if (
    /^(notes|note|comments|comment|description|memo|remarks|ملاحظات|الوصف|تعليق)$/i.test(
      norm
    )
  ) {
    return "notes";
  }

  // 8. Tags / Labels / Categories
  if (
    /^(tags|tag|labels|label|categories|category|segments|segment|الوسوم|الوسم|العلامات|التصنيف)$/i.test(
      norm
    )
  ) {
    return "tags";
  }

  return "ignore";
}
