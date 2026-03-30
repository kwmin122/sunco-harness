/**
 * @sunco/skills-workflow - HwpxWriter
 *
 * Generates valid HWPX files (Korean document standard).
 * HWPX is a ZIP file containing OWPML XML documents.
 *
 * Zero external dependencies — uses only node: builtins.
 * ZIP format: store method (compression method 0), uncompressed.
 *
 * Structure:
 *   document.hwpx (ZIP)
 *   ├── META-INF/manifest.xml
 *   ├── Contents/content.hpf
 *   ├── Contents/header.xml
 *   ├── Contents/section0.xml
 *   └── mimetype
 *
 * Requirements: DOC-01
 */

import { writeFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// ZIP helper — uncompressed store method (method 0)
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  data: Buffer;
  crc32: number;
  offset: number;
}

/** CRC-32 lookup table (IEEE 802.3 polynomial) */
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (CRC_TABLE[(crc ^ (buf[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0);
}

/** Write a little-endian 16-bit value into buf at offset */
function writeUInt16LE(buf: Buffer, value: number, offset: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

/** Write a little-endian 32-bit value into buf at offset */
function writeUInt32LE(buf: Buffer, value: number, offset: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

/**
 * Build a minimal ZIP archive from a map of filename → content.
 * All entries are stored uncompressed (compression method 0).
 * PK signatures: local file header 0x50 0x4b 0x03 0x04
 */
function buildZip(files: Map<string, Buffer>): Buffer {
  const entries: ZipEntry[] = [];
  const localHeaders: Buffer[] = [];

  let offset = 0;

  for (const [name, data] of files) {
    const nameBytes = Buffer.from(name, 'utf-8');
    const crc = crc32(data);

    // Local file header: PK\x03\x04 signature
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    writeUInt32LE(localHeader, 0x04034b50, 0);  // PK\x03\x04
    writeUInt16LE(localHeader, 20, 4);           // version needed: 2.0
    writeUInt16LE(localHeader, 0, 6);            // general purpose bit flag
    writeUInt16LE(localHeader, 0, 8);            // compression method: store (0)
    writeUInt16LE(localHeader, 0, 10);           // last mod time
    writeUInt16LE(localHeader, 0, 12);           // last mod date
    writeUInt32LE(localHeader, crc, 14);         // crc-32
    writeUInt32LE(localHeader, data.length, 18); // compressed size
    writeUInt32LE(localHeader, data.length, 22); // uncompressed size
    writeUInt16LE(localHeader, nameBytes.length, 26); // file name length
    writeUInt16LE(localHeader, 0, 28);           // extra field length
    nameBytes.copy(localHeader, 30);

    entries.push({ name, data, crc32: crc, offset });
    localHeaders.push(localHeader);
    offset += localHeader.length + data.length;
  }

  // Central directory
  const centralDirBuffers: Buffer[] = [];
  let centralDirOffset = offset;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const nameBytes = Buffer.from(entry.name, 'utf-8');

    const cdRecord = Buffer.alloc(46 + nameBytes.length);
    writeUInt32LE(cdRecord, 0x02014b50, 0);      // PK\x01\x02
    writeUInt16LE(cdRecord, 20, 4);               // version made by: 2.0
    writeUInt16LE(cdRecord, 20, 6);               // version needed: 2.0
    writeUInt16LE(cdRecord, 0, 8);                // general purpose bit flag
    writeUInt16LE(cdRecord, 0, 10);               // compression method: store
    writeUInt16LE(cdRecord, 0, 12);               // last mod time
    writeUInt16LE(cdRecord, 0, 14);               // last mod date
    writeUInt32LE(cdRecord, entry.crc32, 16);     // crc-32
    writeUInt32LE(cdRecord, entry.data.length, 20); // compressed size
    writeUInt32LE(cdRecord, entry.data.length, 24); // uncompressed size
    writeUInt16LE(cdRecord, nameBytes.length, 28); // file name length
    writeUInt16LE(cdRecord, 0, 30);               // extra field length
    writeUInt16LE(cdRecord, 0, 32);               // file comment length
    writeUInt16LE(cdRecord, 0, 34);               // disk number start
    writeUInt16LE(cdRecord, 0, 36);               // internal attributes
    writeUInt32LE(cdRecord, 0, 38);               // external attributes
    writeUInt32LE(cdRecord, entry.offset, 42);    // relative offset of local header
    nameBytes.copy(cdRecord, 46);

    centralDirBuffers.push(cdRecord);
  }

  const centralDirSize = centralDirBuffers.reduce((s, b) => s + b.length, 0);

  // End of central directory record
  const eocd = Buffer.alloc(22);
  writeUInt32LE(eocd, 0x06054b50, 0);            // PK\x05\x06
  writeUInt16LE(eocd, 0, 4);                     // disk number
  writeUInt16LE(eocd, 0, 6);                     // disk with start of CD
  writeUInt16LE(eocd, entries.length, 8);         // entries on disk
  writeUInt16LE(eocd, entries.length, 10);        // total entries
  writeUInt32LE(eocd, centralDirSize, 12);        // size of central directory
  writeUInt32LE(eocd, centralDirOffset, 16);      // offset of start of CD
  writeUInt16LE(eocd, 0, 20);                    // comment length

  return Buffer.concat([
    ...localHeaders.flatMap((h, i) => [h, entries[i]!.data]),
    ...centralDirBuffers,
    eocd,
  ]);
}

// ---------------------------------------------------------------------------
// OWPML XML generators
// ---------------------------------------------------------------------------

const OWPML_NS = 'http://www.hancom.co.kr/hwpml/2011/paragraph';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildMimetype(): Buffer {
  return Buffer.from('application/hwp+zip', 'utf-8');
}

function buildManifest(): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <file-entry full-path="/" media-type="application/hwp+zip"/>
  <file-entry full-path="Contents/content.hpf" media-type="application/xml"/>
  <file-entry full-path="Contents/header.xml" media-type="application/xml"/>
  <file-entry full-path="Contents/section0.xml" media-type="application/xml"/>
</manifest>`;
  return Buffer.from(xml, 'utf-8');
}

function buildContentHpf(): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hpf:PackageManifest xmlns:hpf="http://www.hancom.co.kr/hwpml/2011/package">
  <hpf:manifest>
    <hpf:item id="header" href="Contents/header.xml" media-type="application/xml"/>
    <hpf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>
  </hpf:manifest>
  <hpf:spine>
    <hpf:itemref idref="section0"/>
  </hpf:spine>
</hpf:PackageManifest>`;
  return Buffer.from(xml, 'utf-8');
}

function buildHeaderXml(): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hh:Head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">
  <hh:DocInfo>
    <hh:Title/>
    <hh:Subject/>
    <hh:Author/>
    <hh:Date/>
    <hh:Keywords/>
  </hh:DocInfo>
  <hh:IdMappings>
    <hh:ParaShape count="1">
      <hh:ParaShapeId id="0"/>
    </hh:ParaShape>
    <hh:CharShape count="1">
      <hh:CharShapeId id="0"/>
    </hh:CharShape>
  </hh:IdMappings>
</hh:Head>`;
  return Buffer.from(xml, 'utf-8');
}

// ---------------------------------------------------------------------------
// Paragraph / Table / PageBreak XML builders
// ---------------------------------------------------------------------------

type ParagraphStyle = 'title' | 'heading1' | 'heading2' | 'body';

function buildParagraphXml(text: string, style: ParagraphStyle = 'body'): string {
  const styleAttr = style !== 'body' ? ` styleId="${style}"` : '';
  return `  <hs:p${styleAttr}>
    <hs:run>
      <hs:t>${escapeXml(text)}</hs:t>
    </hs:run>
  </hs:p>`;
}

function buildTableXml(headers: string[], rows: string[][]): string {
  const headerRow = headers.map((h) => `        <hs:tc><hs:p><hs:run><hs:t>${escapeXml(h)}</hs:t></hs:run></hs:p></hs:tc>`).join('\n');
  const dataRows = rows.map((row) => {
    const cells = row.map((cell) => `        <hs:tc><hs:p><hs:run><hs:t>${escapeXml(cell)}</hs:t></hs:run></hs:p></hs:tc>`).join('\n');
    return `      <hs:tr>\n${cells}\n      </hs:tr>`;
  }).join('\n');

  return `  <hs:tbl>
      <hs:tr>
${headerRow}
      </hs:tr>
${dataRows}
  </hs:tbl>`;
}

function buildPageBreakXml(): string {
  return `  <hs:p>
    <hs:run>
      <hs:ctrl id="pagebreak"/>
    </hs:run>
  </hs:p>`;
}

function buildSection0Xml(paragraphs: string[]): Buffer {
  const body = paragraphs.join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="${OWPML_NS}">
${body}
</hs:sec>`;
  return Buffer.from(xml, 'utf-8');
}

// ---------------------------------------------------------------------------
// HwpxWriter
// ---------------------------------------------------------------------------

/**
 * Generates HWPX documents (Korean standard document format).
 *
 * Usage:
 *   const writer = new HwpxWriter();
 *   writer.addParagraph('Title', 'title');
 *   writer.addParagraph('Body text');
 *   writer.addTable(['Col A', 'Col B'], [['val1', 'val2']]);
 *   const buf = await writer.generate();
 *   await writer.writeTo('output.hwpx');
 */
export class HwpxWriter {
  private sections: string[] = [];

  /**
   * Add a text paragraph to the document.
   * @param text - The paragraph text content
   * @param style - Paragraph style: 'title' | 'heading1' | 'heading2' | 'body' (default)
   */
  addParagraph(text: string, style: ParagraphStyle = 'body'): void {
    this.sections.push(buildParagraphXml(text, style));
  }

  /**
   * Add a table to the document.
   * @param headers - Column header labels
   * @param rows - Array of rows, each row is an array of cell values
   */
  addTable(headers: string[], rows: string[][]): void {
    this.sections.push(buildTableXml(headers, rows));
  }

  /**
   * Insert a page break at the current position.
   */
  addPageBreak(): void {
    this.sections.push(buildPageBreakXml());
  }

  /**
   * Generate the .hwpx ZIP archive as a Buffer.
   * The returned buffer starts with the ZIP magic bytes PK\x03\x04 (0x50, 0x4b, 0x03, 0x04).
   */
  async generate(): Promise<Buffer> {
    const files = new Map<string, Buffer>([
      ['mimetype', buildMimetype()],
      ['META-INF/manifest.xml', buildManifest()],
      ['Contents/content.hpf', buildContentHpf()],
      ['Contents/header.xml', buildHeaderXml()],
      ['Contents/section0.xml', buildSection0Xml(this.sections)],
    ]);

    return buildZip(files);
  }

  /**
   * Write the .hwpx archive to a file path.
   * @param filePath - Destination file path (should end in .hwpx)
   */
  async writeTo(filePath: string): Promise<void> {
    const buf = await this.generate();
    await writeFile(filePath, buf);
  }
}
