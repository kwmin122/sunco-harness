/**
 * Tests for HwpxWriter
 *
 * Verifies that HwpxWriter generates valid HWPX (ZIP + OWPML XML) files
 * with correct ZIP magic bytes, section XML, and file output.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { HwpxWriter } from '../shared/hwpx-writer.js';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpFile(name: string): string {
  return join(tmpdir(), name);
}

async function tryUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HwpxWriter', () => {
  it('generate() returns a Buffer starting with ZIP magic bytes PK\\x03\\x04', async () => {
    const writer = new HwpxWriter();
    const buf = await writer.generate();

    expect(buf).toBeInstanceOf(Buffer);
    // PK\x03\x04 = 0x50 0x4b 0x03 0x04
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('empty document generates valid ZIP structure with non-zero size', async () => {
    const writer = new HwpxWriter();
    const buf = await writer.generate();

    // Should have local file headers + central directory + EOCD
    expect(buf.length).toBeGreaterThan(100);
  });

  it('addParagraph() with body style embeds text in section0.xml XML', async () => {
    const writer = new HwpxWriter();
    writer.addParagraph('Hello, world!');
    const buf = await writer.generate();

    // Locate section0.xml content in the ZIP buffer
    const content = buf.toString('utf-8');
    expect(content).toContain('Hello, world!');
    expect(content).toContain('hs:t');
    expect(content).toContain('hs:p');
  });

  it('addParagraph() with title style sets styleId="title" attribute', async () => {
    const writer = new HwpxWriter();
    writer.addParagraph('My Title', 'title');
    const buf = await writer.generate();

    const content = buf.toString('utf-8');
    expect(content).toContain('styleId="title"');
    expect(content).toContain('My Title');
  });

  it('addParagraph() with heading1 and heading2 styles sets correct styleId attributes', async () => {
    const writer = new HwpxWriter();
    writer.addParagraph('Section 1', 'heading1');
    writer.addParagraph('Subsection 1.1', 'heading2');
    const buf = await writer.generate();

    const content = buf.toString('utf-8');
    expect(content).toContain('styleId="heading1"');
    expect(content).toContain('styleId="heading2"');
    expect(content).toContain('Section 1');
    expect(content).toContain('Subsection 1.1');
  });

  it('addTable() embeds headers and rows in XML with hs:tbl/hs:tr/hs:tc structure', async () => {
    const writer = new HwpxWriter();
    writer.addTable(['Name', 'Value'], [['Alpha', '1'], ['Beta', '2']]);
    const buf = await writer.generate();

    const content = buf.toString('utf-8');
    expect(content).toContain('hs:tbl');
    expect(content).toContain('hs:tr');
    expect(content).toContain('hs:tc');
    expect(content).toContain('Name');
    expect(content).toContain('Value');
    expect(content).toContain('Alpha');
    expect(content).toContain('Beta');
  });

  it('addPageBreak() inserts a ctrl id="pagebreak" element', async () => {
    const writer = new HwpxWriter();
    writer.addParagraph('Before break');
    writer.addPageBreak();
    writer.addParagraph('After break');
    const buf = await writer.generate();

    const content = buf.toString('utf-8');
    expect(content).toContain('pagebreak');
    expect(content).toContain('Before break');
    expect(content).toContain('After break');
  });

  it('writeTo() creates file on disk with correct ZIP magic bytes', async () => {
    const outPath = tmpFile('test-output.hwpx');
    await tryUnlink(outPath);

    const writer = new HwpxWriter();
    writer.addParagraph('Written to disk', 'body');
    await writer.writeTo(outPath);

    const buf = await readFile(outPath);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);

    await tryUnlink(outPath);
  });

  it('multiple paragraphs all appear in the generated buffer', async () => {
    const writer = new HwpxWriter();
    writer.addParagraph('First paragraph', 'title');
    writer.addParagraph('Second paragraph', 'heading1');
    writer.addParagraph('Third paragraph', 'body');
    const buf = await writer.generate();

    const content = buf.toString('utf-8');
    expect(content).toContain('First paragraph');
    expect(content).toContain('Second paragraph');
    expect(content).toContain('Third paragraph');
  });

  it('XML-special characters in text are properly escaped', async () => {
    const writer = new HwpxWriter();
    writer.addParagraph('A & B < C > D "quoted" \'apos\'');
    const buf = await writer.generate();

    const content = buf.toString('utf-8');
    expect(content).toContain('&amp;');
    expect(content).toContain('&lt;');
    expect(content).toContain('&gt;');
    expect(content).toContain('&quot;');
    expect(content).toContain('&apos;');
  });

  it('round-trip: writeTo then readFile returns non-empty buffer with valid ZIP magic', async () => {
    const outPath = tmpFile('test-roundtrip.hwpx');
    await tryUnlink(outPath);

    const writer = new HwpxWriter();
    writer.addParagraph('Round-trip test', 'title');
    writer.addTable(['Col1', 'Col2'], [['A', 'B']]);
    await writer.writeTo(outPath);

    const buf = await readFile(outPath);

    // ZIP magic bytes
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    // File has content beyond headers
    expect(buf.length).toBeGreaterThan(200);

    // Contains section0.xml marker
    const content = buf.toString('utf-8');
    expect(content).toContain('section0.xml');

    await tryUnlink(outPath);
  });
});
