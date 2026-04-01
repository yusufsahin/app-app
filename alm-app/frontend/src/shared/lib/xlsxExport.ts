import JSZip from "jszip";

type CellValue = string | number | boolean | null | undefined;

export type XlsxSheet = {
  name: string;
  rows: CellValue[][];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let current = index + 1;
  let label = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

function worksheetXml(rows: CellValue[][]): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, cellIndex) => {
          if (value === null || value === undefined || value === "") return "";
          const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }
          if (typeof value === "boolean") {
            return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
        })
        .filter(Boolean)
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function workbookXml(sheets: XlsxSheet[]): string {
  const body = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name.slice(0, 31) || `Sheet${index + 1}`)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${body}</sheets>
</workbook>`;
}

function workbookRelsXml(sheets: XlsxSheet[]): string {
  const body = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${body}
</Relationships>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml(sheets: XlsxSheet[]): string {
  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetOverrides}
</Types>`;
}

export async function buildWorkbookBlob(sheets: XlsxSheet[]): Promise<Blob> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(sheets));
  zip.folder("_rels")?.file(".rels", rootRelsXml());
  zip.folder("xl")?.file("workbook.xml", workbookXml(sheets));
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", workbookRelsXml(sheets));

  const worksheets = zip.folder("xl")?.folder("worksheets");
  sheets.forEach((sheet, index) => {
    worksheets?.file(`sheet${index + 1}.xml`, worksheetXml(sheet.rows));
  });

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
