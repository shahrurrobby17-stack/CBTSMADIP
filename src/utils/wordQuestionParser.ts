import * as XLSX from 'xlsx';
import {
  Question,
  QuestionType,
  OptionItem,
  StatementItem,
  MatchingPremise,
  MatchingResponse,
  QuestionTableData,
} from '../types/cbt';

interface TextSegment {
  text: string;
  isRed: boolean;
}

interface ParsedParagraph {
  fullText: string;
  hasRed: boolean;
  segments: TextSegment[];
  numId?: string;
  ilvl?: number;
  numFormat?: string;
  autoQuestionNumber?: number;
  autoOptionLetter?: string;
}

interface ParsedTableCell {
  fullText: string;
  hasRed: boolean;
  paragraphs: ParsedParagraph[];
  nestedTables: ParsedTable[];
}

interface ParsedTable {
  rows: ParsedTableCell[][];
}

type DocumentBlock =
  | { kind: 'paragraph'; paragraph: ParsedParagraph }
  | { kind: 'table'; table: ParsedTable };

/**
 * Checks whether a Word color string (hex, named color, or rgb()) represents red.
 */
export function isRedColorValue(rawColor: string | null | undefined): boolean {
  if (!rawColor) return false;
  const val = rawColor.trim().toLowerCase();
  if (
    !val ||
    val === 'auto' ||
    val === 'none' ||
    val === '000000' ||
    val === '#000000' ||
    val === 'ffffff' ||
    val === '#ffffff' ||
    val === 'black' ||
    val === 'white'
  ) {
    return false;
  }

  const namedReds = new Set([
    'red',
    'darkred',
    'crimson',
    'firebrick',
    'indianred',
    'maroon',
    'lightcoral',
    'salmon',
    'tomato',
    'orangered',
  ]);
  if (namedReds.has(val)) return true;

  // Check rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return r >= 120 && g <= 105 && b <= 105 && r >= g * 1.5 && r >= b * 1.5;
  }

  // Check hex (#RRGGBB, RRGGBB, #RGB, RGB)
  const cleanedHex = val.replace(/^#/, '');
  let r = -1;
  let g = -1;
  let b = -1;

  if (/^[0-9a-f]{6}$/i.test(cleanedHex)) {
    r = parseInt(cleanedHex.slice(0, 2), 16);
    g = parseInt(cleanedHex.slice(2, 4), 16);
    b = parseInt(cleanedHex.slice(4, 6), 16);
  } else if (/^[0-9a-f]{3}$/i.test(cleanedHex)) {
    r = parseInt(cleanedHex[0] + cleanedHex[0], 16);
    g = parseInt(cleanedHex[1] + cleanedHex[1], 16);
    b = parseInt(cleanedHex[2] + cleanedHex[2], 16);
  }

  if (r >= 0 && g >= 0 && b >= 0) {
    // Typical Word reds: FF0000, C00000, EE0000, CC0000, 990000, EF4444, DC2626, E53935, etc.
    return r >= 120 && g <= 105 && b <= 105 && r >= g * 1.5 && r >= b * 1.5;
  }

  return false;
}

/**
 * Decompresses raw DEFLATE bytes using browser's native DecompressionStream.
 */
async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressed as unknown as BufferSource).catch(() => {});
  writer.close().catch(() => {});

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLen += value.byteLength;
    }
  }

  const output = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/**
 * Extracts XML files from a ZIP archive (.docx) in browser memory.
 */
async function extractZipFiles(buffer: ArrayBuffer): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');
  const extracted: Record<string, string> = {};

  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let ptr = cdOffset;

    for (let e = 0; e < totalEntries && ptr + 46 <= bytes.length; e++) {
      const sig = view.getUint32(ptr, true);
      if (sig !== 0x02014b50) break;

      const compressionMethod = view.getUint16(ptr + 10, true);
      const compressedSize = view.getUint32(ptr + 20, true);
      const fileNameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);

      const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
      ptr += 46 + fileNameLen + extraLen + commentLen;

      if (
        fileName === 'word/document.xml' ||
        fileName === 'word/numbering.xml' ||
        fileName === 'word/styles.xml'
      ) {
        if (localHeaderOffset + 30 <= bytes.length) {
          const localNameLen = view.getUint16(localHeaderOffset + 26, true);
          const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
          const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
          const compressedData = bytes.subarray(dataStart, dataStart + compressedSize);

          if (compressionMethod === 0) {
            extracted[fileName] = decoder.decode(compressedData);
          } else if (compressionMethod === 8) {
            const decompressed = await inflateRaw(compressedData);
            extracted[fileName] = decoder.decode(decompressed);
          }
        }
      }
    }
  }

  return extracted;
}

/**
 * Checks if an XML element <w:rPr>, <w:pPr>, or <w:tcPr> has red text color, highlight, or fill.
 */
function checkXmlNodeHasRed(node: Element | null | undefined): boolean {
  if (!node) return false;

  const allDescendants = node.getElementsByTagName('*');
  for (let i = 0; i < allDescendants.length; i++) {
    const el = allDescendants[i];
    const local = el.localName || el.tagName.replace(/^.*:/, '');

    if (local === 'color' || local === 'highlight' || local === 'srgbClr') {
      const val =
        el.getAttribute('w:val') ||
        el.getAttribute('val') ||
        el.getAttribute('w:color') ||
        '';
      if (isRedColorValue(val)) {
        return true;
      }
    } else if (local === 'shd') {
      const fillVal = el.getAttribute('w:fill') || el.getAttribute('fill') || '';
      if (isRedColorValue(fillVal)) {
        return true;
      }
    }
  }

  return false;
}

interface DocxStyleAndNumMeta {
  numFormatMap: Record<string, string>; // `${numId}:${ilvl}` -> 'decimal' | 'upperLetter' | 'lowerLetter' | ...
  styleNumMap: Record<string, { numId: string; ilvl: number }>;
  redStyleIds: Set<string>;
}

/**
 * Parses both word/numbering.xml and word/styles.xml so we can resolve numbering formats,
 * style-based numbering, and style-based red colors.
 */
function parseDocxStyleAndNumbering(
  numberingXml?: string,
  stylesXml?: string
): DocxStyleAndNumMeta {
  const numFormatMap: Record<string, string> = {};
  const styleNumMap: Record<string, { numId: string; ilvl: number }> = {};
  const redStyleIds = new Set<string>();
  const styleToNumStyleLink: Record<string, string> = {};
  const styleBasedOnMap: Record<string, string> = {};

  const parser = new DOMParser();

  if (stylesXml) {
    try {
      const sDoc = parser.parseFromString(stylesXml, 'application/xml');
      const allEls = sDoc.getElementsByTagName('*');
      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        const local = el.localName || el.tagName.replace(/^.*:/, '');
        if (local === 'style') {
          const styleId =
            el.getAttribute('w:styleId') || el.getAttribute('styleId') || '';
          if (!styleId) continue;

          if (checkXmlNodeHasRed(el)) {
            redStyleIds.add(styleId);
          }

          let numId: string | undefined;
          let ilvl = 0;
          const children = el.getElementsByTagName('*');
          for (let j = 0; j < children.length; j++) {
            const c = children[j];
            const cLocal = c.localName || c.tagName.replace(/^.*:/, '');
            if (cLocal === 'basedOn') {
              const parentStyle =
                c.getAttribute('w:val') || c.getAttribute('val') || '';
              if (parentStyle) {
                styleBasedOnMap[styleId] = parentStyle;
              }
            } else if (cLocal === 'numId') {
              numId = c.getAttribute('w:val') || c.getAttribute('val') || undefined;
            } else if (cLocal === 'ilvl') {
              const v = c.getAttribute('w:val') || c.getAttribute('val');
              if (v !== null) ilvl = parseInt(v, 10);
            }
          }
          if (numId) {
            styleNumMap[styleId] = { numId, ilvl };
          }
        }
      }

      // Resolve basedOn inheritance up to 5 levels deep
      for (let pass = 0; pass < 5; pass++) {
        Object.entries(styleBasedOnMap).forEach(([childId, parentId]) => {
          if (!styleNumMap[childId] && styleNumMap[parentId]) {
            styleNumMap[childId] = { ...styleNumMap[parentId] };
          }
          if (redStyleIds.has(parentId)) {
            redStyleIds.add(childId);
          }
        });
      }
    } catch {
      // Ignore styles XML error
    }
  }

  if (numberingXml) {
    try {
      const doc = parser.parseFromString(numberingXml, 'application/xml');
      const abstractMap: Record<string, Record<string, string>> = {};

      const allEls = doc.getElementsByTagName('*');
      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        const local = el.localName || el.tagName.replace(/^.*:/, '');
        if (local === 'abstractNum') {
          const absId =
            el.getAttribute('w:abstractNumId') ||
            el.getAttribute('abstractNumId') ||
            '';
          if (!absId) continue;
          abstractMap[absId] = {};
          const children = el.getElementsByTagName('*');
          for (let j = 0; j < children.length; j++) {
            const child = children[j];
            const cLocal = child.localName || child.tagName.replace(/^.*:/, '');
            if (cLocal === 'numStyleLink' || cLocal === 'styleLink') {
              const linkedStyle =
                child.getAttribute('w:val') || child.getAttribute('val') || '';
              if (linkedStyle) {
                styleToNumStyleLink[absId] = linkedStyle;
              }
            } else if (cLocal === 'lvl') {
              const ilvl =
                child.getAttribute('w:ilvl') || child.getAttribute('ilvl') || '0';
              const lvlChildren = child.getElementsByTagName('*');
              for (let k = 0; k < lvlChildren.length; k++) {
                const lc = lvlChildren[k];
                const lcLocal = lc.localName || lc.tagName.replace(/^.*:/, '');
                if (lcLocal === 'numFmt') {
                  const fmtVal =
                    lc.getAttribute('w:val') || lc.getAttribute('val') || '';
                  abstractMap[absId][ilvl] = fmtVal;
                }
              }
            }
          }
        }
      }

      const numToAbsId: Record<string, string> = {};
      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        const local = el.localName || el.tagName.replace(/^.*:/, '');
        if (local === 'num') {
          const numId =
            el.getAttribute('w:numId') || el.getAttribute('numId') || '';
          if (!numId) continue;
          const children = el.getElementsByTagName('*');
          for (let j = 0; j < children.length; j++) {
            const child = children[j];
            const cLocal = child.localName || child.tagName.replace(/^.*:/, '');
            if (cLocal === 'abstractNumId') {
              const absId =
                child.getAttribute('w:val') || child.getAttribute('val') || '';
              if (absId) {
                numToAbsId[numId] = absId;
                if (abstractMap[absId]) {
                  Object.entries(abstractMap[absId]).forEach(([ilvl, fmt]) => {
                    numFormatMap[`${numId}:${ilvl}`] = fmt;
                  });
                }
              }
            } else if (cLocal === 'lvlOverride') {
              const ilvl =
                child.getAttribute('w:ilvl') || child.getAttribute('ilvl') || '0';
              const ovChildren = child.getElementsByTagName('*');
              for (let k = 0; k < ovChildren.length; k++) {
                const oc = ovChildren[k];
                const ocLocal = oc.localName || oc.tagName.replace(/^.*:/, '');
                if (ocLocal === 'numFmt') {
                  const fmtVal =
                    oc.getAttribute('w:val') || oc.getAttribute('val') || '';
                  if (fmtVal) {
                    numFormatMap[`${numId}:${ilvl}`] = fmtVal;
                  }
                }
              }
            }
          }
        }
      }

      // Second pass for numStyleLink / styleLink
      Object.entries(numToAbsId).forEach(([numId, absId]) => {
        const linkedStyleId = styleToNumStyleLink[absId];
        if (linkedStyleId && styleNumMap[linkedStyleId]) {
          const targetNumId = styleNumMap[linkedStyleId].numId;
          const targetAbsId = numToAbsId[targetNumId];
          if (targetAbsId && abstractMap[targetAbsId]) {
            Object.entries(abstractMap[targetAbsId]).forEach(([ilvl, fmt]) => {
              numFormatMap[`${numId}:${ilvl}`] = fmt;
            });
          }
        }
      });
    } catch {
      // Ignore numbering XML parse error
    }
  }

  return { numFormatMap, styleNumMap, redStyleIds };
}

/**
 * Checks if a node is inside a nested <w:tbl> or <w:txbxContent> relative to pEl.
 */
function isInsideNestedContainer(node: Element, pEl: Element): boolean {
  let curr: Element | null = node.parentElement;
  while (curr && curr !== pEl) {
    const local = curr.localName || curr.tagName.replace(/^.*:/, '');
    if (local === 'txbxContent' || local === 'tbl') {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

/**
 * Parses a single <w:p> element into one or more ParsedParagraphs.
 */
function parseSingleDocxParagraphElement(
  pEl: Element,
  meta: DocxStyleAndNumMeta,
  inheritedRed: boolean = false
): ParsedParagraph[] {
  let paragraphLevelRed = inheritedRed;
  let numId: string | undefined;
  let ilvl: number | undefined;
  let pStyleId: string | undefined;

  for (let c = 0; c < pEl.children.length; c++) {
    const child = pEl.children[c];
    const cLocal = child.localName || child.tagName.replace(/^.*:/, '');
    if (cLocal === 'pPr') {
      if (checkXmlNodeHasRed(child)) {
        paragraphLevelRed = true;
      }
      for (let pc = 0; pc < child.children.length; pc++) {
        const pSub = child.children[pc];
        const pSubLocal = pSub.localName || pSub.tagName.replace(/^.*:/, '');
        if (pSubLocal === 'pStyle') {
          pStyleId =
            pSub.getAttribute('w:val') || pSub.getAttribute('val') || undefined;
          if (pStyleId && meta.redStyleIds.has(pStyleId)) {
            paragraphLevelRed = true;
          }
        } else if (pSubLocal === 'rPr' && checkXmlNodeHasRed(pSub)) {
          paragraphLevelRed = true;
        } else if (pSubLocal === 'numPr') {
          const numChildren = pSub.getElementsByTagName('*');
          for (let nc = 0; nc < numChildren.length; nc++) {
            const nEl = numChildren[nc];
            const nLocal = nEl.localName || nEl.tagName.replace(/^.*:/, '');
            if (nLocal === 'numId') {
              numId = nEl.getAttribute('w:val') || nEl.getAttribute('val') || undefined;
            } else if (nLocal === 'ilvl') {
              const rawIlvl = nEl.getAttribute('w:val') || nEl.getAttribute('val');
              if (rawIlvl !== null) ilvl = parseInt(rawIlvl, 10);
            }
          }
        }
      }
    }
  }

  if (!numId && pStyleId && meta.styleNumMap[pStyleId]) {
    numId = meta.styleNumMap[pStyleId].numId;
    ilvl = meta.styleNumMap[pStyleId].ilvl;
  }
  if (numId === '0') {
    numId = undefined;
  }

  const segments: TextSegment[] = [];
  let hasEmbeddedDrawing = false;

  const pDescendants = pEl.getElementsByTagName('*');
  for (let rIdx = 0; rIdx < pDescendants.length; rIdx++) {
    const rEl = pDescendants[rIdx];
    const rLocal = rEl.localName || rEl.tagName.replace(/^.*:/, '');

    if (isInsideNestedContainer(rEl, pEl)) continue;

    if (rLocal === 'drawing' || rLocal === 'pict' || rLocal === 'imagedata') {
      hasEmbeddedDrawing = true;
      continue;
    }

    if (rLocal !== 'r') continue;

    let runIsRed = paragraphLevelRed;
    let runText = '';

    for (let rc = 0; rc < rEl.children.length; rc++) {
      const rChild = rEl.children[rc];
      const rcLocal = rChild.localName || rChild.tagName.replace(/^.*:/, '');
      if (rcLocal === 'rPr') {
        if (checkXmlNodeHasRed(rChild)) {
          runIsRed = true;
        }
        for (let rSubIdx = 0; rSubIdx < rChild.children.length; rSubIdx++) {
          const rSub = rChild.children[rSubIdx];
          const rSubLocal = rSub.localName || rSub.tagName.replace(/^.*:/, '');
          if (rSubLocal === 'rStyle') {
            const rStyleId =
              rSub.getAttribute('w:val') || rSub.getAttribute('val') || '';
            if (rStyleId && meta.redStyleIds.has(rStyleId)) {
              runIsRed = true;
            }
          }
        }
      } else if (rcLocal === 't' || rcLocal === 'delText') {
        runText += rChild.textContent || '';
      } else if (rcLocal === 'tab' || rcLocal === 'ptab') {
        runText += '\t';
      } else if (rcLocal === 'br' || rcLocal === 'cr') {
        runText += '\n';
      }
    }

    if (runText.length > 0) {
      segments.push({
        text: runText,
        isRed: runIsRed && runText.trim().length > 0,
      });
    }
  }

  if (segments.length === 0 && hasEmbeddedDrawing) {
    segments.push({
      text: '[Gambar]',
      isRed: paragraphLevelRed,
    });
  } else if (hasEmbeddedDrawing) {
    const combinedTrimmed = segments.map((s) => s.text).join('').trim();
    if (/^(?:\(?[A-Ea-e][\.\)\]]|[A-Ea-e][\.\)\-:]|\d+[\.\)\-:])$/.test(combinedTrimmed)) {
      segments.push({
        text: ' [Gambar]',
        isRed: paragraphLevelRed,
      });
    }
  }

  const fullText = segments.map((s) => s.text).join('').trim();
  const result: ParsedParagraph[] = [];

  if (fullText) {
    const numFormat =
      numId !== undefined ? meta.numFormatMap[`${numId}:${ilvl ?? 0}`] : undefined;

    if (fullText.includes('\n')) {
      const lines: TextSegment[][] = [[]];
      for (const seg of segments) {
        const parts = seg.text.split('\n');
        for (let pIdx = 0; pIdx < parts.length; pIdx++) {
          if (pIdx > 0) lines.push([]);
          if (parts[pIdx].length > 0) {
            lines[lines.length - 1].push({
              text: parts[pIdx],
              isRed: seg.isRed && parts[pIdx].trim().length > 0,
            });
          }
        }
      }
      let firstLine = true;
      for (const lineSegs of lines) {
        const lineText = lineSegs.map((s) => s.text).join('').trim();
        if (!lineText) continue;
        result.push({
          fullText: lineText,
          hasRed: lineSegs.some((s) => s.isRed),
          segments: lineSegs,
          numId: firstLine ? numId : undefined,
          ilvl: firstLine ? ilvl : undefined,
          numFormat: firstLine ? numFormat : undefined,
        });
        firstLine = false;
      }
    } else {
      result.push({
        fullText,
        hasRed: segments.some((s) => s.isRed),
        segments,
        numId,
        ilvl,
        numFormat,
      });
    }
  }

  // Also extract any paragraphs inside nested <w:txbxContent> (Word Text Boxes)
  for (let i = 0; i < pDescendants.length; i++) {
    const dEl = pDescendants[i];
    const dLocal = dEl.localName || dEl.tagName.replace(/^.*:/, '');
    if (dLocal === 'txbxContent') {
      for (let tcIdx = 0; tcIdx < dEl.children.length; tcIdx++) {
        const tChild = dEl.children[tcIdx];
        const tLocal = tChild.localName || tChild.tagName.replace(/^.*:/, '');
        if (tLocal === 'p') {
          result.push(
            ...parseSingleDocxParagraphElement(tChild, meta, inheritedRed)
          );
        }
      }
    }
  }

  return result;
}

/**
 * Parses a <w:tbl> XML element into a ParsedTable.
 */
function parseDocxTableElement(
  tblEl: Element,
  meta: DocxStyleAndNumMeta
): ParsedTable {
  const rows: ParsedTableCell[][] = [];

  for (let i = 0; i < tblEl.children.length; i++) {
    const trEl = tblEl.children[i];
    const trLocal = trEl.localName || trEl.tagName.replace(/^.*:/, '');
    if (trLocal !== 'tr') continue;

    const rowCells: ParsedTableCell[] = [];
    for (let j = 0; j < trEl.children.length; j++) {
      const tcEl = trEl.children[j];
      const tcLocal = tcEl.localName || tcEl.tagName.replace(/^.*:/, '');
      if (tcLocal !== 'tc') continue;

      let cellHasRedBg = false;
      const cellParagraphs: ParsedParagraph[] = [];
      const nestedTables: ParsedTable[] = [];

      for (let k = 0; k < tcEl.children.length; k++) {
        const cChild = tcEl.children[k];
        const cLocal = cChild.localName || cChild.tagName.replace(/^.*:/, '');
        if (cLocal === 'tcPr') {
          if (checkXmlNodeHasRed(cChild)) {
            cellHasRedBg = true;
          }
        } else if (cLocal === 'p') {
          cellParagraphs.push(
            ...parseSingleDocxParagraphElement(cChild, meta, cellHasRedBg)
          );
        } else if (cLocal === 'tbl') {
          nestedTables.push(parseDocxTableElement(cChild, meta));
        }
      }

      const fullText = cellParagraphs
        .map((p) => p.fullText)
        .filter(Boolean)
        .join('\n')
        .trim();
      const hasRed = cellHasRedBg || cellParagraphs.some((p) => p.hasRed);

      rowCells.push({
        fullText,
        hasRed,
        paragraphs: cellParagraphs,
        nestedTables,
      });
    }

    if (rowCells.length > 0) {
      rows.push(rowCells);
    }
  }

  return { rows };
}

/**
 * Annotates paragraphs that use Word's automatic list numbering (<w:numPr>)
 * with autoQuestionNumber (1, 2, 3...) or autoOptionLetter ('A'..'E').
 */
function annotateAutoNumberedParagraphs(paragraphs: ParsedParagraph[]): void {
  const counters: Record<string, number> = {};
  const consecutiveRunLen: Record<string, number> = {};
  let prevKey: string | null = null;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const ilvl = p.ilvl ?? 0;
    const isOptionNum =
      Boolean(p.numId) &&
      (p.numFormat === 'upperLetter' ||
        p.numFormat === 'lowerLetter' ||
        ilvl > 0);

    // If this paragraph is NOT an auto-numbered option, reset all option counters
    // so the next question's auto-numbered options ALWAYS start at 'A'!
    if (!isOptionNum) {
      Object.keys(counters).forEach((k) => {
        if (k.startsWith('OPT:')) {
          delete counters[k];
        }
      });
    }

    // If the previous paragraph was part of a consecutive decimal list cluster (>= 2 adjacent items, like statements 1, 2, 3, 4)
    // and this paragraph has a different key, reset that cluster counter so the next question's statement list starts at 1!
    const currDecimalKey =
      p.numId && !isOptionNum ? `DEC:${p.numId}:${ilvl}` : null;
    if (prevKey && prevKey !== currDecimalKey && (consecutiveRunLen[prevKey] || 0) >= 2) {
      delete counters[prevKey];
      delete consecutiveRunLen[prevKey];
    }

    if (!p.numId) {
      prevKey = null;
      continue;
    }

    if (isOptionNum) {
      const optKey = `OPT:${p.numId}:${ilvl}`;
      counters[optKey] = (counters[optKey] || 0) + 1;
      const count = counters[optKey];
      const letters = ['A', 'B', 'C', 'D', 'E'];
      p.autoOptionLetter = letters[(count - 1) % 5];
      prevKey = null;
    } else if ((p.numFormat === 'decimal' || p.numFormat === 'decimalZero') && ilvl === 0) {
      const decKey = `DEC:${p.numId}:${ilvl}`;
      counters[decKey] = (counters[decKey] || 0) + 1;
      if (prevKey === decKey) {
        consecutiveRunLen[decKey] = (consecutiveRunLen[decKey] || 1) + 1;
      } else {
        consecutiveRunLen[decKey] = 1;
      }
      p.autoQuestionNumber = counters[decKey];
      prevKey = decKey;
    } else {
      prevKey = null;
    }
  }
}

/**
 * Extracts ordered DocumentBlocks (paragraphs and tables) from word/document.xml
 */
function parseDocxDocumentBlocks(
  documentXml: string,
  numberingXml?: string,
  stylesXml?: string
): DocumentBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'application/xml');
  const meta = parseDocxStyleAndNumbering(numberingXml, stylesXml);
  const blocks: DocumentBlock[] = [];
  const allTopParagraphs: ParsedParagraph[] = [];

  const walkContainer = (container: Element) => {
    for (let i = 0; i < container.children.length; i++) {
      const el = container.children[i];
      const local = el.localName || el.tagName.replace(/^.*:/, '');
      if (local === 'p') {
        const paras = parseSingleDocxParagraphElement(el, meta, false);
        for (const p of paras) {
          allTopParagraphs.push(p);
          blocks.push({ kind: 'paragraph', paragraph: p });
        }
      } else if (local === 'tbl') {
        const table = parseDocxTableElement(el, meta);
        if (table.rows.length > 0) {
          for (const r of table.rows) {
            for (const c of r) {
              annotateAutoNumberedParagraphs(c.paragraphs);
            }
          }
          blocks.push({ kind: 'table', table });
        }
      } else if (
        local === 'body' ||
        local === 'sdt' ||
        local === 'sdtContent' ||
        local === 'customXml'
      ) {
        walkContainer(el);
      }
    }
  };

  if (doc.documentElement) {
    walkContainer(doc.documentElement);
  }

  annotateAutoNumberedParagraphs(allTopParagraphs);
  return blocks;
}

/**
 * Parses HTML or plain-text .doc files into DocumentBlocks (supporting <table> as well as <p>)
 */
function parseHtmlOrTextDocBlocks(rawContent: string): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  if (/<(html|body|p|div|span|font|table)/i.test(rawContent)) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawContent, 'text/html');

    const redClasses = new Set<string>();
    const styles = doc.querySelectorAll('style');
    styles.forEach((styleEl) => {
      const css = styleEl.textContent || '';
      const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = ruleRegex.exec(css)) !== null) {
        const className = match[1];
        const body = match[2];
        const colorMatch = body.match(/(?:^|;|\s)color\s*:\s*([^;]+)/i);
        if (colorMatch && isRedColorValue(colorMatch[1])) {
          redClasses.add(className);
        }
      }
    });

    function cleanStyleVal(s: string): string {
      return s.replace(/!important/i, '').trim();
    }

    const isElementRed = (el: Element | null, stopAt?: Element): boolean => {
      let curr: Element | null = el;
      while (curr && curr !== doc.body && curr !== doc.documentElement) {
        const styleAttr = curr.getAttribute('style') || '';
        const colorStyleMatch = styleAttr.match(/(?:^|;|\s)color\s*:\s*([^;]+)/i);
        if (colorStyleMatch && isRedColorValue(cleanStyleVal(colorStyleMatch[1])))
          return true;

        const bgStyleMatch = styleAttr.match(/background(?:-color)?\s*:\s*([^;]+)/i);
        if (bgStyleMatch && isRedColorValue(cleanStyleVal(bgStyleMatch[1])))
          return true;

        const fontColor = curr.getAttribute('color') || curr.getAttribute('bgcolor');
        if (fontColor && isRedColorValue(fontColor)) return true;

        for (let i = 0; i < curr.classList.length; i++) {
          if (redClasses.has(curr.classList[i])) return true;
        }
        if (stopAt && curr === stopAt) break;
        curr = curr.parentElement;
      }
      return false;
    };

    const extractParagraphFromNode = (node: Element): ParsedParagraph | null => {
      const segments: TextSegment[] = [];
      const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        const txt = textNode.textContent || '';
        if (txt.length > 0) {
          const red = isElementRed(textNode.parentElement, node);
          segments.push({
            text: txt,
            isRed: red && txt.trim().length > 0,
          });
        }
        textNode = walker.nextNode();
      }
      const fullText = segments
        .map((s) => s.text)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!fullText) return null;
      return {
        fullText,
        hasRed: segments.some((s) => s.isRed),
        segments,
      };
    };

    const parseHtmlTable = (tableEl: Element): ParsedTable => {
      const rows: ParsedTableCell[][] = [];
      const trElements = tableEl.querySelectorAll(
        ':scope > tbody > tr, :scope > thead > tr, :scope > tr'
      );
      trElements.forEach((tr) => {
        const cells: ParsedTableCell[] = [];
        const tdElements = tr.querySelectorAll(':scope > td, :scope > th');
        tdElements.forEach((td) => {
          const nestedTables: ParsedTable[] = [];
          td.querySelectorAll(':scope > table').forEach((nt) => {
            nestedTables.push(parseHtmlTable(nt));
          });

          const pNodes = td.querySelectorAll(':scope > p, :scope > div, :scope > li');
          const cellParagraphs: ParsedParagraph[] = [];
          if (pNodes.length > 0) {
            pNodes.forEach((pNode) => {
              const parsed = extractParagraphFromNode(pNode);
              if (parsed) cellParagraphs.push(parsed);
            });
          } else {
            const parsed = extractParagraphFromNode(td);
            if (parsed) cellParagraphs.push(parsed);
          }

          const cellBgRed = isElementRed(td, td);
          const fullText = cellParagraphs.map((p) => p.fullText).join('\n').trim();
          const hasRed = cellBgRed || cellParagraphs.some((p) => p.hasRed);
          cells.push({
            fullText,
            hasRed: hasRed && fullText.length > 0,
            paragraphs: cellParagraphs.map((p) =>
              cellBgRed ? { ...p, hasRed: true } : p
            ),
            nestedTables,
          });
        });
        if (cells.length > 0) rows.push(cells);
      });
      return { rows };
    };

    const walkHtmlNodes = (container: Element) => {
      for (let i = 0; i < container.children.length; i++) {
        const child = container.children[i];
        const tag = child.tagName.toUpperCase();
        if (tag === 'TABLE') {
          const parsedTbl = parseHtmlTable(child);
          if (parsedTbl.rows.length > 0) {
            blocks.push({ kind: 'table', table: parsedTbl });
          }
        } else if (
          tag === 'P' ||
          tag === 'LI' ||
          tag === 'H1' ||
          tag === 'H2' ||
          tag === 'H3' ||
          tag === 'H4'
        ) {
          if (child.querySelector('table')) {
            walkHtmlNodes(child);
          } else {
            const p = extractParagraphFromNode(child);
            if (p) blocks.push({ kind: 'paragraph', paragraph: p });
          }
        } else if (
          tag === 'DIV' ||
          tag === 'SECTION' ||
          tag === 'ARTICLE' ||
          tag === 'BODY' ||
          tag === 'OL' ||
          tag === 'UL'
        ) {
          if (child.querySelector('p, li, table, div, ol, ul')) {
            walkHtmlNodes(child);
          } else {
            const p = extractParagraphFromNode(child);
            if (p) blocks.push({ kind: 'paragraph', paragraph: p });
          }
        }
      }
    };

    if (doc.body) {
      walkHtmlNodes(doc.body);
    }
    if (blocks.length > 0) return blocks;
  }

  const lines = rawContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    blocks.push({
      kind: 'paragraph',
      paragraph: {
        fullText: trimmed,
        hasRed: false,
        segments: [{ text: trimmed, isRed: false }],
      },
    });
  }

  return blocks;
}

/**
 * Converts a ParsedTable into QuestionTableData (for rendering stimulus/data tables inside a question).
 */
function convertParsedTableToQuestionTableData(
  table: ParsedTable
): QuestionTableData | undefined {
  const nonEmptyRows = table.rows.filter((r) =>
    r.some((c) => c.fullText.trim().length > 0)
  );
  if (nonEmptyRows.length === 0) return undefined;

  const maxCols = Math.max(...nonEmptyRows.map((r) => r.length));
  if (maxCols === 0) return undefined;

  const normalizeRow = (r: ParsedTableCell[]) => {
    const arr = r.map((c) => c.fullText.replace(/\n+/g, ' ').trim());
    while (arr.length < maxCols) arr.push('');
    return arr;
  };

  const headers = normalizeRow(nonEmptyRows[0]);
  const rows =
    nonEmptyRows.length > 1
      ? nonEmptyRows.slice(1).map(normalizeRow)
      : [headers];

  return {
    headers:
      nonEmptyRows.length > 1
        ? headers
        : headers.map((_, idx) => `Kolom ${idx + 1}`),
    rows,
  };
}

/**
 * Safely splits a paragraph that contains inline options (e.g., "A. Satu   B. Dua   C. Tiga" or 2-col "A. Satu   D. Empat")
 * ONLY when the option letters form a valid option sequence and are not part of a Biologi sentence (e.g. "B. subtilis", "darah B.").
 */
function splitInlineOptionsIfPresent(para: ParsedParagraph): ParsedParagraph[] {
  let rawCombined = '';
  const charRedMap: boolean[] = [];
  for (const seg of para.segments) {
    for (let i = 0; i < seg.text.length; i++) {
      rawCombined += seg.text[i];
      charRedMap.push(seg.isRed);
    }
  }

  // Match option markers like "A. ", "B) ", "(A) " followed by whitespace
  const regex = /(?:^|[\s\t]+)(?:\(([A-Ea-e])\)|([A-Ea-e])[\.\)\]])[\s\t]+/g;
  const allMatches = Array.from(rawCombined.matchAll(regex));
  if (allMatches.length <= 1) {
    return [para];
  }

  // Words that commonly precede a single letter "A.", "B.", "C." inside a normal Biologi sentence
  const sentenceConnectorBeforeLetter =
    /\b(?:dan|atau|dengan|ke|dari|antara|pada|oleh|adalah|yaitu|seperti|darah|vitamin|individu|titik|gambar|larutan|kelompok|poin|huruf|kelas|tipe|gen|alel|gamet|kromosom|tabung|label|bagian|nomor|spesies|bakteri)\s+$/i;

  const validMatches: {
    match: RegExpMatchArray;
    letter: string;
    rawLetter: string;
    isUpper: boolean;
    delimKind: string;
    tokenStart: number;
    markerEnd: number;
    hasTabOrMultiSpaceBefore: boolean;
  }[] = [];

  for (const m of allMatches) {
    const rawLetter = m[1] || m[2] || '';
    const letter = rawLetter.toUpperCase();
    const isUpper = rawLetter === letter;
    const leadingWhitespace = m[0].match(/^[\s\t]*/)?.[0] ?? '';
    const leadingWhitespaceLen = leadingWhitespace.length;
    const tokenStart = (m.index ?? 0) + leadingWhitespaceLen;
    const markerEnd = (m.index ?? 0) + m[0].length;
    const delimKind = m[1] ? 'paren' : m[0].includes(')') ? 'rpar' : 'dot';
    const hasTabOrMultiSpaceBefore =
      tokenStart === 0 ||
      leadingWhitespace.includes('\t') ||
      leadingWhitespace.length >= 2;

    if (validMatches.length === 0) {
      if (['A', 'B', 'C', 'D'].includes(letter)) {
        // If tokenStart > 0 (inside a sentence), ensure it's not preceded by "vitamin A.", "darah A.", etc.
        if (tokenStart > 0) {
          const textBefore = rawCombined.slice(0, tokenStart);
          if (
            !hasTabOrMultiSpaceBefore &&
            sentenceConnectorBeforeLetter.test(textBefore)
          ) {
            continue;
          }
        }
        validMatches.push({
          match: m,
          letter,
          rawLetter,
          isUpper,
          delimKind,
          tokenStart,
          markerEnd,
          hasTabOrMultiSpaceBefore,
        });
      }
    } else {
      const prev = validMatches[validMatches.length - 1];
      const prevLetterCode = prev.letter.charCodeAt(0);
      const currLetterCode = letter.charCodeAt(0);

      // Must match case (uppercase A..E vs lowercase a..e) and delimiter style (., ), (X))
      if (isUpper !== prev.isUpper || delimKind !== prev.delimKind) {
        continue;
      }

      // The previous option must have actual text before this new option marker (prevents splitting "A. B. subtilis")
      const prevOptionBody = rawCombined.slice(prev.markerEnd, tokenStart).trim();
      if (prevOptionBody.length < 1) {
        continue;
      }

      // If only separated by a single space, reject if preceded by a sentence word like "dan B. subtilis" or "darah B."
      const textBefore = rawCombined.slice(prev.markerEnd, tokenStart);
      if (
        !hasTabOrMultiSpaceBefore &&
        sentenceConnectorBeforeLetter.test(textBefore)
      ) {
        continue;
      }

      // Allow step of 1 (A->B), 2 (A->C, B->D), or 3 (A->D, B->E in 2-column layouts!)
      if (
        currLetterCode > prevLetterCode &&
        currLetterCode - prevLetterCode <= 3
      ) {
        validMatches.push({
          match: m,
          letter,
          rawLetter,
          isUpper,
          delimKind,
          tokenStart,
          markerEnd,
          hasTabOrMultiSpaceBefore,
        });
      }
    }
  }

  if (validMatches.length <= 1) {
    return [para];
  }

  // If the first match is inside a sentence (tokenStart > 0), it must start with 'A'
  if (validMatches[0].tokenStart > 0 && validMatches[0].letter !== 'A') {
    return [para];
  }

  // If the paragraph starts with an option at index 0 and only has 2 matches total separated by a single space
  // (no tab or multi-space), be conservative if the first option wasn't A..D pair
  if (
    validMatches.length === 2 &&
    !validMatches[1].hasTabOrMultiSpaceBefore &&
    validMatches[1].letter.charCodeAt(0) - validMatches[0].letter.charCodeAt(0) > 1
  ) {
    return [para];
  }

  const result: ParsedParagraph[] = [];

  // CRITICAL: Preserve any question text BEFORE the first inline option!
  if (validMatches[0].tokenStart > 0) {
    const prefixEnd = validMatches[0].tokenStart;
    const prefixText = rawCombined.slice(0, prefixEnd).trim();
    if (prefixText) {
      let prefixHasRed = false;
      for (let c = 0; c < prefixEnd; c++) {
        if (rawCombined[c].trim() && charRedMap[c]) {
          prefixHasRed = true;
          break;
        }
      }
      result.push({
        fullText: prefixText,
        hasRed: prefixHasRed,
        segments: [{ text: prefixText, isRed: prefixHasRed }],
        numId: para.numId,
        ilvl: para.ilvl,
        numFormat: para.numFormat,
        autoQuestionNumber: para.autoQuestionNumber,
      });
    }
  }

  for (let i = 0; i < validMatches.length; i++) {
    const startIdx = validMatches[i].tokenStart;
    const endIdx =
      i + 1 < validMatches.length
        ? validMatches[i + 1].tokenStart
        : rawCombined.length;

    const sliceText = rawCombined.slice(startIdx, endIdx).trim();
    let sliceHasRed = false;
    for (let c = startIdx; c < endIdx; c++) {
      if (rawCombined[c].trim() && charRedMap[c]) {
        sliceHasRed = true;
        break;
      }
    }

    if (sliceText) {
      result.push({
        fullText: sliceText,
        hasRed: sliceHasRed,
        segments: [{ text: sliceText, isRed: sliceHasRed }],
      });
    }
  }

  return result.length > 0 ? result : [para];
}

interface ParagraphRecord {
  para: ParsedParagraph;
  matchedOption?: { letter: string; text: string; isRed: boolean };
}

interface DraftQuestion {
  explicitNumber?: number;
  detectedType?: QuestionType;
  questionLines: string[];
  unprefixedParagraphs: ParsedParagraph[];
  allParagraphs?: ParagraphRecord[];
  options: { id: string; text: string; isRed: boolean }[];
  explicitKeys: string[];
  explicitTextAnswers?: string[];
  explicitStatements?: StatementItem[];
  explicitMatchingPairs?: { premise: string; response: string }[];
  stimulusTable?: QuestionTableData;
}

/**
 * Detects a QuestionType from a section header, label, or instruction text.
 */
export function detectQuestionTypeFromText(
  rawText: string
): QuestionType | null {
  const t = rawText.trim().toLowerCase();
  if (!t) return null;

  if (
    /\b(pilihan\s+ganda\s+kompleks|pg\s+kompleks|pgk|mcma|multiple\s+response|pilih(?:lah)?\s+lebih\s+dari\s+satu|jawaban\s+benar\s+lebih\s+dari\s+satu|pilih(?:lah)?\s+(?:2|3|dua|tiga)\s+jawaban)\b/i.test(
      t
    )
  ) {
    return 'pilihan_ganda_kompleks';
  }

  if (
    /\b(benar\s*[\/\-]\s*salah|benar\s+atau\s+salah|benar\s+salah|tentukan\s+benar\s+atau\s+salah|sesuai\s*[\/\-]\s*tidak\s+sesuai|sesuai\s+atau\s+tidak\s+sesuai|kategori\s+benar\s+salah|b\s*\/\s*s)\b/i.test(
      t
    )
  ) {
    return 'benar_salah';
  }

  if (
    /\b(menjodohkan|soal\s+jodohkan|pasangkan(?:lah)?|jodohkan(?:lah)?|matching)\b/i.test(
      t
    )
  ) {
    return 'menjodohkan';
  }

  if (
    /\b(isian\s+singkat|soal\s+isian|jawaban\s+singkat|uraian\s+singkat|soal\s+uraian|soal\s+essay|soal\s+esai|uraian|essay|esai|short\s+answer)\b/i.test(
      t
    )
  ) {
    return 'isian_singkat';
  }

  if (
    /\b(pilihan\s+ganda|soal\s+pg|multiple\s+choice)\b/i.test(t) ||
    /^(?:pg|pilihan\s+ganda)$/i.test(t)
  ) {
    return 'pilihan_ganda';
  }

  return null;
}

/**
 * Checks if a paragraph is a standalone section header for a question type
 * (e.g., "I. PILIHAN GANDA", "BAGIAN B: BENAR / SALAH", "II. PILIHAN GANDA KOMPLEKS", "III. ISIAN SINGKAT")
 */
function matchSectionTypeHeader(text: string): QuestionType | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 110) return null;
  // Must not look like a full question sentence ending with '?' or '...'
  if (/\?|\.\.\./.test(trimmed)) return null;

  const cleaned = trimmed
    .replace(
      /^(?:bagian|section|romawi|tipe|jenis|kelompok)?\s*(?:[ivx]+|[a-e]|\d+)?\s*[\.\)\-:]?\s*/i,
      ''
    )
    .trim();

  if (
    /^(?:soal\s+)?(?:pilihan\s+ganda\s+kompleks|pg\s+kompleks|pgk|mcma)(?:\s*\(.*\))?\s*[:\-]?$/i.test(
      cleaned
    )
  ) {
    return 'pilihan_ganda_kompleks';
  }
  if (
    /^(?:soal\s+)?(?:benar\s*[\/\-]?\s*salah|benar\s+atau\s+salah|sesuai\s*[\/\-]\s*tidak\s+sesuai|b\s*\/\s*s)(?:\s*\(.*\))?\s*[:\-]?$/i.test(
      cleaned
    )
  ) {
    return 'benar_salah';
  }
  if (
    /^(?:soal\s+)?(?:menjodohkan|pasangkan|jodohkan)(?:\s*\(.*\))?\s*[:\-]?$/i.test(
      cleaned
    )
  ) {
    return 'menjodohkan';
  }
  if (
    /^(?:soal\s+)?(?:isian\s+singkat|isian|uraian\s+singkat|uraian|essay|esai)(?:\s*\(.*\))?\s*[:\-]?$/i.test(
      cleaned
    )
  ) {
    return 'isian_singkat';
  }
  if (
    /^(?:soal\s+)?(?:pilihan\s+ganda|pg)(?:\s*\(pg\))?\s*[:\-]?$/i.test(cleaned)
  ) {
    return 'pilihan_ganda';
  }

  return null;
}

/**
 * Regex helpers for options and numbered questions
 */
const OPTION_LINE_REGEX =
  /^(?:([\*✓✔☑]|\[[xvXV✓✔]\])\s*)?(?:[•\-\*▪▫◦☐]\s*)?(?:\(\s*([A-Ea-e])\s*\)|\[\s*([A-Ea-e])\s*\]|([A-Ea-e])\s*([\*✓✔☑])?\s*[\.\)\-:])\s*(.*)$/;
const OPTION_TAB_REGEX = /^([\*✓✔☑])?\s*([A-Ea-e])(?:\t+|\s{2,})(.+)$/;
const NUMBERED_QUESTION_REGEX =
  /^(?:soal\s*(?:no\.?|nomor)?\s*|no\.?\s*)?(\d+)\s*[\.\)\-:]\s*(.+)$/i;
const EXPLICIT_KEY_LINE_REGEX =
  /^(?:kunci(?:\s*jawaban)?|jawaban(?:\s*benar)?|answer(?:\s*key)?|kunci)\s*[:=]\s*(.+)$/i;

function extractTrailingCorrectMarker(rawText: string): {
  cleanedText: string;
  isMarkedCorrect: boolean;
} {
  let cleaned = rawText.trim();
  let isMarked = false;

  if (
    /(?:\s*[\(\[](?:benar|kunci|jawaban\s*benar|correct|✓|✔|v|x)[\)\]]|\s+[✓✔☑])$/i.test(
      cleaned
    )
  ) {
    isMarked = true;
    cleaned = cleaned
      .replace(
        /(?:\s*[\(\[](?:benar|kunci|jawaban\s*benar|correct|✓|✔|v|x)[\)\]]|\s+[✓✔☑])+$/i,
        ''
      )
      .trim();
  }

  return { cleanedText: cleaned, isMarkedCorrect: isMarked };
}

function matchOptionLine(
  para: ParsedParagraph
): { letter: string; text: string; isRed: boolean } | null {
  const trimmed = para.fullText.trim();
  const m = trimmed.match(OPTION_LINE_REGEX);
  if (m) {
    const leadingMark = Boolean(m[1]);
    const letter = (m[2] || m[3] || m[4] || 'A').toUpperCase();
    const afterLetterMark = Boolean(m[5]);
    const rawBody = (m[6] || '').trim();
    const { cleanedText, isMarkedCorrect } =
      extractTrailingCorrectMarker(rawBody);
    const optText = cleanedText || `Pilihan ${letter}`;
    return {
      letter,
      text: optText,
      isRed: para.hasRed || leadingMark || afterLetterMark || isMarkedCorrect,
    };
  }
  const tabM = trimmed.match(OPTION_TAB_REGEX);
  if (tabM) {
    const leadingMark = Boolean(tabM[1]);
    const letter = tabM[2].toUpperCase();
    const { cleanedText, isMarkedCorrect } = extractTrailingCorrectMarker(
      tabM[3]
    );
    const optText = cleanedText || `Pilihan ${letter}`;
    return {
      letter,
      text: optText,
      isRed: para.hasRed || leadingMark || isMarkedCorrect,
    };
  }
  if (para.autoOptionLetter) {
    const { cleanedText, isMarkedCorrect } =
      extractTrailingCorrectMarker(trimmed);
    return {
      letter: para.autoOptionLetter,
      text: cleanedText || trimmed,
      isRed: para.hasRed || isMarkedCorrect,
    };
  }
  return null;
}

function matchNumberedQuestionLine(
  para: ParsedParagraph
): { qNum: number; qText: string } | null {
  const trimmed = para.fullText.trim();
  const m = trimmed.match(NUMBERED_QUESTION_REGEX);
  if (m) {
    return {
      qNum: parseInt(m[1], 10),
      qText: m[2].trim(),
    };
  }
  if (para.autoQuestionNumber !== undefined && !para.autoOptionLetter) {
    return {
      qNum: para.autoQuestionNumber,
      qText: trimmed,
    };
  }
  return null;
}

/**
 * Finalizes a DraftQuestion:
 * - Reconciles partially prefixed options (e.g. when 1-4 options had A..E and 1-4 options lost their prefix/numId).
 * - Recovers options from allParagraphs / unprefixedParagraphs when options had no A..E prefixes.
 * - Sorts 2-column options (e.g. A, D, B, E, C) into A, B, C, D, E order.
 */
function finalizeDraftQuestion(draft: DraftQuestion | null): DraftQuestion | null {
  if (!draft) return null;

  const allRecords = draft.allParagraphs || [];

  // 1. If some options were matched (1..4 options) AND there are unprefixed paragraphs after/between options
  //    (e.g. when 1 or more options in Questions 31-35 lost their A..E prefix or auto-numbering!)
  if (draft.options.length >= 1 && draft.options.length < 5 && allRecords.length >= 5) {
    const firstOptIdx = allRecords.findIndex((r) => Boolean(r.matchedOption));
    if (firstOptIdx !== -1) {
      const trailingCount = allRecords.length - firstOptIdx;
      // Case 1A: From firstOptIdx to the end there are 4 or 5 paragraphs (some matched, some unprefixed)
      if (trailingCount === 5 || trailingCount === 4) {
        const stemRecords = allRecords.slice(0, firstOptIdx);
        const optRecords = allRecords.slice(firstOptIdx);
        if (stemRecords.length >= 1 || draft.stimulusTable) {
          const letters = ['A', 'B', 'C', 'D', 'E'];
          draft.questionLines = stemRecords
            .map((r) => r.para.fullText.trim())
            .filter(Boolean);
          draft.options = optRecords.map((r, idx) => ({
            id: letters[idx] || 'E',
            text: r.matchedOption
              ? r.matchedOption.text
              : r.para.fullText.replace(/^[•\-\*▪▫◦☐☑✓✔\d]+[\.\)\-:]?\s*/, '').trim(),
            isRed: r.matchedOption ? r.matchedOption.isRed : r.para.hasRed,
          }));
        }
      } else if (allRecords.length >= 6) {
        // Case 1B: First option was NOT at index firstOptIdx (e.g., Option A lost its prefix, and B..E or only C was matched!)
        const stemRecords = allRecords.slice(0, allRecords.length - 5);
        const optRecords = allRecords.slice(allRecords.length - 5);
        const letters = ['A', 'B', 'C', 'D', 'E'];
        draft.questionLines = stemRecords
          .map((r) => r.para.fullText.trim())
          .filter(Boolean);
        draft.options = optRecords.map((r, idx) => ({
          id: letters[idx] || 'E',
          text: r.matchedOption
            ? r.matchedOption.text
            : r.para.fullText.replace(/^[•\-\*▪▫◦☐☑✓✔\d]+[\.\)\-:]?\s*/, '').trim(),
          isRed: r.matchedOption ? r.matchedOption.isRed : r.para.hasRed,
        }));
      }
    }
  }

  // 2. If only 4 options (B, C, D, E) were matched and Option A was glued at the end of the last question stem line!
  if (
    draft.options.length === 4 &&
    !draft.options.some((o) => o.id === 'A') &&
    draft.questionLines.length > 0
  ) {
    const lastStemIdx = draft.questionLines.length - 1;
    const lastStem = draft.questionLines[lastStemIdx];
    const inlineAMatch = lastStem.match(/^(.*?)[\s\t]+(?:[Aa][\.\)\-:]|\([Aa]\))\s+(.+)$/);
    if (inlineAMatch && inlineAMatch[1].trim() && inlineAMatch[2].trim()) {
      draft.questionLines[lastStemIdx] = inlineAMatch[1].trim();
      draft.options.unshift({
        id: 'A',
        text: inlineAMatch[2].trim(),
        isRed: false,
      });
    }
  }

  // 3. If < 2 options were found, recover options from allRecords or unprefixedParagraphs!
  if (draft.options.length < 2) {
    const sourceParas =
      allRecords.length >= 2
        ? allRecords.map((r) => r.para)
        : draft.unprefixedParagraphs;
    const totalParas = sourceParas.length;

    if (totalParas >= 2) {
      let optCount = 0;
      if (totalParas >= 6) {
        optCount = 5;
      } else if (totalParas === 5) {
        // If there is already a stimulusTable and para 0 doesn't look like a question stem, all 5 are options
        optCount =
          draft.stimulusTable && !/[?:]|(?:\.\.\.)/.test(sourceParas[0].fullText)
            ? 5
            : 4;
      } else if (totalParas >= 3) {
        optCount = totalParas - 1;
      } else if (totalParas === 2) {
        // Check if the 2nd paragraph contains multiple options separated by tabs, 2+ spaces, or semicolons
        const secondPara = sourceParas[1];
        const parts = secondPara.fullText
          .split(/\t+|\s{2,}|\s*;\s*/)
          .map((s) => s.replace(/^[A-Ea-e][\.\)\-:]\s*/, '').trim())
          .filter(Boolean);
        if (parts.length >= 3 && parts.length <= 5) {
          const letters = ['A', 'B', 'C', 'D', 'E'];
          draft.questionLines = [sourceParas[0].fullText.trim()];
          draft.options = parts.map((pt, idx) => ({
            id: letters[idx] || 'E',
            text: pt,
            isRed: secondPara.hasRed && idx === 0,
          }));
        }
      }

      if (draft.options.length < 2 && optCount >= 2) {
        const stemParas = sourceParas.slice(0, totalParas - optCount);
        const optParas = sourceParas.slice(totalParas - optCount);
        const letters = ['A', 'B', 'C', 'D', 'E'];

        draft.questionLines = stemParas.map((p) => p.fullText.trim()).filter(Boolean);
        draft.options = optParas.map((p, idx) => ({
          id: letters[idx] || 'E',
          text: p.fullText.replace(/^[•\-\*▪▫◦☐☑✓✔\d]+[\.\)\-:]?\s*/, '').trim(),
          isRed: p.hasRed,
        }));
      }
    }
  }

  // 4. Sort options by letter (A, B, C, D, E) if all option IDs are distinct A..E (fixes 2-column A, D, B, E, C order!)
  if (draft.options.length >= 2) {
    const uniqueIds = new Set(draft.options.map((o) => o.id));
    if (uniqueIds.size === draft.options.length) {
      draft.options.sort((a, b) => a.id.localeCompare(b.id));
    }

    if (draft.questionLines.length === 0) {
      draft.questionLines = [
        draft.stimulusTable
          ? 'Perhatikan tabel berikut untuk menjawab pertanyaan!'
          : 'Pilihlah jawaban yang paling tepat!',
      ];
    }
    return draft;
  }

  // Case B: Explicitly numbered question (e.g. 1..35) or question with explicit statements/pairs/short-answers
  if (
    (draft.explicitStatements && draft.explicitStatements.length > 0) ||
    (draft.explicitMatchingPairs && draft.explicitMatchingPairs.length > 0) ||
    (draft.explicitTextAnswers && draft.explicitTextAnswers.length > 0) ||
    (draft.explicitNumber !== undefined && draft.questionLines.length > 0) ||
    (draft.detectedType === 'isian_singkat' && draft.questionLines.length > 0)
  ) {
    const redParas = draft.unprefixedParagraphs.filter((p) => p.hasRed);
    if (
      redParas.length > 0 &&
      (!draft.explicitTextAnswers || draft.explicitTextAnswers.length === 0)
    ) {
      // If a subsequent line in the unprefixed paragraphs was colored red, treat it as the short answer key
      const nonStemRed = redParas.filter(
        (rp) => rp.fullText.trim() !== draft.questionLines[0]?.trim()
      );
      if (nonStemRed.length > 0) {
        draft.explicitTextAnswers = nonStemRed.map((rp) => rp.fullText.trim());
        const redSet = new Set(draft.explicitTextAnswers);
        draft.questionLines = draft.questionLines.filter(
          (l) => !redSet.has(l.trim())
        );
      }
    }
    if (!draft.detectedType && draft.options.length === 0) {
      draft.detectedType = 'isian_singkat';
    }
    return draft;
  }

  return null;
}

/**
 * Checks if a table is a Benar/Salah (or Sesuai/Tidak Sesuai) statement table for a question.
 */
function tryExtractBenarSalahFromTable(
  table: ParsedTable
): StatementItem[] | null {
  const rows = table.rows.filter((r) =>
    r.some((c) => c.fullText.trim().length > 0)
  );
  if (rows.length < 2) return null;

  const headers = rows[0].map((c) => c.fullText.trim().toLowerCase());
  const stmtCol = headers.findIndex(
    (h) =>
      h.includes('pernyataan') ||
      h.includes('statement') ||
      h.includes('kalimat') ||
      h.includes('uraian')
  );
  const benarCol = headers.findIndex(
    (h) => h === 'benar' || h === 'b' || h === 'sesuai' || h === 'true'
  );
  const salahCol = headers.findIndex(
    (h) =>
      h === 'salah' || h === 's' || h === 'tidak sesuai' || h === 'false'
  );
  const keyCol = headers.findIndex(
    (h) =>
      h.includes('kunci') ||
      h.includes('jawaban') ||
      h === 'b/s' ||
      h === 'benar/salah' ||
      h === 'status'
  );

  if (stmtCol === -1 && benarCol === -1 && keyCol === -1) {
    return null;
  }

  const effectiveStmtCol =
    stmtCol !== -1
      ? stmtCol
      : headers[0] === 'no' || headers[0] === 'no.'
      ? 1
      : 0;

  if (benarCol === -1 && keyCol === -1) return null;

  const statements: StatementItem[] = [];
  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    const stmtCell = r[effectiveStmtCol];
    if (!stmtCell || !stmtCell.fullText.trim()) continue;

    let isBenar = stmtCell.hasRed;

    if (benarCol !== -1 && r[benarCol]) {
      const bTxt = r[benarCol].fullText.trim().toLowerCase();
      if (
        r[benarCol].hasRed ||
        /^(✓|✔|☑|v|x|1|ya|benar|b|sesuai|true)$/i.test(bTxt)
      ) {
        isBenar = true;
      }
    }
    if (salahCol !== -1 && r[salahCol]) {
      const sTxt = r[salahCol].fullText.trim().toLowerCase();
      if (
        r[salahCol].hasRed ||
        /^(✓|✔|☑|v|x|1|ya|salah|s|tidak\s*sesuai|false)$/i.test(sTxt)
      ) {
        isBenar = false;
      }
    }
    if (keyCol !== -1 && r[keyCol]) {
      const kTxt = r[keyCol].fullText.trim().toLowerCase();
      if (/^(benar|b|sesuai|true|ya|1)$/i.test(kTxt)) {
        isBenar = true;
      } else if (/^(salah|s|tidak\s*sesuai|false|tidak|0)$/i.test(kTxt)) {
        isBenar = false;
      }
    }

    statements.push({
      id: `st${statements.length + 1}`,
      statement: stmtCell.fullText.replace(/^\d+[\.\)\-:]\s*/, '').trim(),
      correctValue: isBenar ? 'Benar' : 'Salah',
    });
  }

  return statements.length >= 2 ? statements : null;
}

/**
 * Checks if a table is a Menjodohkan (Premis -> Respon) table for a question.
 */
function tryExtractMenjodohkanFromTable(
  table: ParsedTable
): { premise: string; response: string }[] | null {
  const rows = table.rows.filter((r) =>
    r.some((c) => c.fullText.trim().length > 0)
  );
  if (rows.length < 2) return null;

  const headers = rows[0].map((c) => c.fullText.trim().toLowerCase());
  const premCol = headers.findIndex(
    (h) =>
      h.includes('premis') ||
      h.includes('pernyataan') ||
      h.includes('kolom a') ||
      h.includes('bagian a') ||
      h.includes('kiri')
  );
  const respCol = headers.findIndex(
    (h) =>
      h.includes('respon') ||
      h.includes('pasangan') ||
      h.includes('jawaban') ||
      h.includes('kolom b') ||
      h.includes('bagian b') ||
      h.includes('kanan')
  );

  if (premCol === -1 || respCol === -1 || premCol === respCol) return null;

  const pairs: { premise: string; response: string }[] = [];
  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    const pText = r[premCol]?.fullText.replace(/^\d+[\.\)\-:]\s*/, '').trim();
    const rText = r[respCol]?.fullText
      .replace(/^[A-Za-z0-9]+[\.\)\-:]\s*/, '')
      .trim();
    if (pText && rText) {
      pairs.push({ premise: pText, response: rText });
    }
  }

  return pairs.length >= 2 ? pairs : null;
}

/**
 * Checks if a table is an Options Table (A, B, C, D, E) belonging to the preceding question paragraph.
 * Supports borderless 2-column option tables AND multi-column comparison option tables (with or without a header row).
 */
function tryExtractOptionsOnlyFromTable(
  table: ParsedTable
): { id: string; text: string; isRed: boolean }[] | null {
  const rows = table.rows.filter((r) =>
    r.some((c) => c.fullText.trim().length > 0)
  );
  if (rows.length === 0 || rows.length > 7) return null;

  const optionLabelOnlyRegex = /^(?:opsi\s*|pilihan\s*)?([A-Ea-e])[\.\)\-:]?$/i;

  // Check if Row 0 is a header row and Rows 1..N are options A, B, C, D(, E)
  let startRow = 0;
  let headers: string[] = [];
  if (
    rows.length >= 4 &&
    rows[0].length >= 2 &&
    !optionLabelOnlyRegex.test(rows[0][0].fullText.trim()) &&
    !OPTION_LINE_REGEX.test(rows[0][0].fullText.trim()) &&
    optionLabelOnlyRegex.test(rows[1][0].fullText.trim())
  ) {
    startRow = 1;
    headers = rows[0].map((c) => c.fullText.replace(/\n+/g, ' ').trim());
  }

  const extractedOptions: { id: string; text: string; isRed: boolean }[] = [];

  for (let rIdx = startRow; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    // Check if 2+ col label + text row: [A. | Col1 | Col2...]
    if (r.length >= 2 && optionLabelOnlyRegex.test(r[0].fullText.trim())) {
      const letter = r[0].fullText.trim().match(optionLabelOnlyRegex)![1].toUpperCase();
      const colTexts: string[] = [];
      for (let cIdx = 1; cIdx < r.length; cIdx++) {
        const val = r[cIdx].fullText.replace(/\n+/g, ' ').trim();
        if (!val) continue;
        if (headers[cIdx] && r.length >= 3) {
          colTexts.push(`${headers[cIdx]}: ${val}`);
        } else {
          colTexts.push(val);
        }
      }
      const text = colTexts.join(' — ') || `Pilihan ${letter}`;
      extractedOptions.push({
        id: letter,
        text,
        isRed: r.some((cell) => cell.hasRed),
      });
      continue;
    }

    if (
      r.length >= 3 &&
      !r[0].fullText.trim() &&
      optionLabelOnlyRegex.test(r[1].fullText.trim())
    ) {
      const letter = r[1].fullText.trim().match(optionLabelOnlyRegex)![1].toUpperCase();
      const colTexts = r
        .slice(2)
        .map((c) => c.fullText.replace(/\n+/g, ' ').trim())
        .filter(Boolean);
      const text = colTexts.join(' — ') || `Pilihan ${letter}`;
      extractedOptions.push({
        id: letter,
        text,
        isRed: r.some((cell) => cell.hasRed),
      });
      continue;
    }

    // Check if cells in the row are inline options like [A. Satu | D. Empat]
    let allCellsAreOptions = true;
    const rowOpts: { id: string; text: string; isRed: boolean }[] = [];
    for (const cell of r) {
      if (!cell.fullText.trim()) continue;
      const m = cell.fullText.trim().match(OPTION_LINE_REGEX);
      if (m) {
        const letter = (m[1] || m[2] || m[3] || 'A').toUpperCase();
        rowOpts.push({
          id: letter,
          text: (m[4] || '').trim() || `Pilihan ${letter}`,
          isRed: cell.hasRed,
        });
      } else {
        allCellsAreOptions = false;
        break;
      }
    }
    if (allCellsAreOptions && rowOpts.length > 0) {
      extractedOptions.push(...rowOpts);
    } else {
      return null;
    }
  }

  if (extractedOptions.length >= 2 && extractedOptions.length <= 6) {
    extractedOptions.sort((a, b) => a.id.localeCompare(b.id));
    return extractedOptions;
  }
  return null;
}

/**
 * Checks if a table is a "Bank Soal Table" (questions formatted inside table rows/columns).
 */
function tryExtractQuestionsFromBankSoalTable(
  table: ParsedTable
): DraftQuestion[] | null {
  const rows = table.rows.filter((r) =>
    r.some((c) => c.fullText.trim().length > 0)
  );
  if (rows.length === 0) return null;

  const firstRowTexts = rows[0].map((c) => c.fullText.trim().toLowerCase());

  // CASE 1: Horizontal Table (e.g. No | Tipe Soal | Pertanyaan/Soal | Opsi A..E | Kunci)
  const hasSoalHeader = firstRowTexts.some(
    (t) =>
      t.includes('soal') ||
      t.includes('pertanyaan') ||
      t.includes('butir') ||
      t.includes('pokok') ||
      t === 'question' ||
      t === 'stem'
  );
  const hasExplicitOptionHeaders =
    firstRowTexts.filter((t) =>
      /^(?:opsi\s+|pilihan\s+|jawaban\s+)[a-e]$/i.test(t)
    ).length >= 2;

  if ((hasSoalHeader && rows[0].length >= 2) || hasExplicitOptionHeaders) {
    const drafts: DraftQuestion[] = [];
    let typeCol = firstRowTexts.findIndex(
      (t) =>
        t.includes('tipe') ||
        t.includes('jenis') ||
        t === 'type' ||
        t === 'bentuk soal'
    );
    let qCol = firstRowTexts.findIndex(
      (t, idx) =>
        idx !== typeCol &&
        (t.includes('soal') ||
          t.includes('pertanyaan') ||
          t.includes('butir') ||
          t.includes('pokok') ||
          t === 'question' ||
          t === 'stem')
    );
    const optCols: { letter: string; idx: number }[] = [];
    const stmtCols: number[] = [];
    let keyCol = -1;

    firstRowTexts.forEach((t, idx) => {
      if (idx === qCol || idx === typeCol) return;
      const m = t.match(/^(?:opsi\s*|pilihan\s*|jawaban\s*)?([a-e])$/i);
      if (m) {
        optCols.push({ letter: m[1].toUpperCase(), idx });
      } else if (/^(?:pernyataan|statement)\s*\d*$/i.test(t)) {
        stmtCols.push(idx);
      } else if (
        t.includes('kunci') ||
        t === 'jawaban benar' ||
        t === 'jawaban' ||
        t === 'key' ||
        t === 'answer'
      ) {
        keyCol = idx;
      }
    });

    if (qCol === -1) {
      qCol =
        firstRowTexts[0] === 'no' ||
        firstRowTexts[0] === 'no.' ||
        firstRowTexts[0] === 'nomor'
          ? 1
          : 0;
    }
    if (
      optCols.length < 2 &&
      stmtCols.length === 0 &&
      rows[0].length >= qCol + 4
    ) {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      for (let c = qCol + 1; c < rows[0].length && optCols.length < 5; c++) {
        if (c === keyCol || c === typeCol) continue;
        optCols.push({ letter: letters[optCols.length], idx: c });
      }
    }

    for (let rIdx = 1; rIdx < rows.length; rIdx++) {
      const r = rows[rIdx];
      const qCell = r[qCol];
      if (!qCell || !qCell.fullText.trim()) continue;

      const rawTypeStr =
        typeCol !== -1 && r[typeCol] ? r[typeCol].fullText.trim() : '';
      const rowDetectedType =
        detectQuestionTypeFromText(rawTypeStr) ||
        detectQuestionTypeFromText(qCell.fullText) ||
        undefined;

      const options: { id: string; text: string; isRed: boolean }[] = [];
      optCols.forEach(({ letter, idx }) => {
        const cell = r[idx];
        if (cell && cell.fullText.trim()) {
          const { cleanedText, isMarkedCorrect } = extractTrailingCorrectMarker(
            cell.fullText.replace(/^[A-Ea-e][\.\)\-:]\s*/, '').trim()
          );
          options.push({
            id: letter,
            text: cleanedText,
            isRed: cell.hasRed || isMarkedCorrect,
          });
        }
      });

      const explicitStatements: StatementItem[] = [];
      if (stmtCols.length > 0) {
        stmtCols.forEach((sIdx, i) => {
          const cell = r[sIdx];
          if (cell && cell.fullText.trim()) {
            const rawSt = cell.fullText.trim();
            const isBenar =
              cell.hasRed ||
              /\((?:benar|b|sesuai)\)\s*$/i.test(rawSt) ||
              !/\((?:salah|s|tidak\s*sesuai)\)\s*$/i.test(rawSt);
            explicitStatements.push({
              id: `st${i + 1}`,
              statement: rawSt
                .replace(/\s*\((?:benar|salah|b|s|sesuai|tidak\s*sesuai)\)\s*$/i, '')
                .trim(),
              correctValue: isBenar ? 'Benar' : 'Salah',
            });
          }
        });
      }

      const explicitKeys: string[] = [];
      const explicitTextAnswers: string[] = [];
      if (keyCol !== -1 && r[keyCol]?.fullText.trim()) {
        const rawKey = r[keyCol].fullText.trim();
        const isSingleOrMultiOptionKey =
          /^[A-Ea-e](?:\s*[,\/&\s]\s*[A-Ea-e])*$/i.test(rawKey) ||
          /^(?:opsi\s*)?[A-Ea-e]$/i.test(rawKey);
        if (isSingleOrMultiOptionKey && options.length >= 2) {
          const kMatches = rawKey.toUpperCase().match(/[A-E]/g);
          if (kMatches) explicitKeys.push(...kMatches);
        } else if (
          /^(?:benar|salah|b|s)(?:\s*[,\/]\s*(?:benar|salah|b|s))+$/i.test(
            rawKey
          )
        ) {
          const bsTokens = rawKey
            .split(/[,\/]/)
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean);
          if (explicitStatements.length > 0) {
            bsTokens.forEach((tok, idx) => {
              if (explicitStatements[idx]) {
                explicitStatements[idx].correctValue =
                  tok === 'benar' || tok === 'b' ? 'Benar' : 'Salah';
              }
            });
          } else if (options.length > 0) {
            options.forEach((opt, idx) => {
              const tok = bsTokens[idx];
              if (tok) {
                opt.isRed = tok === 'benar' || tok === 'b';
              }
            });
          }
        } else {
          explicitTextAnswers.push(
            ...rawKey
              .split(/\s*[\/|;]\s*/)
              .map((s) => s.trim())
              .filter(Boolean)
          );
          const kMatches = rawKey.toUpperCase().match(/^[A-E]$/);
          if (kMatches) explicitKeys.push(kMatches[0]);
        }
      }

      const stimulusTable =
        qCell.nestedTables.length > 0
          ? convertParsedTableToQuestionTableData(qCell.nestedTables[0])
          : undefined;

      if (
        options.length >= 2 ||
        explicitStatements.length > 0 ||
        explicitTextAnswers.length > 0 ||
        rowDetectedType === 'isian_singkat' ||
        qCell.fullText.trim().length > 5
      ) {
        drafts.push({
          explicitNumber: rIdx,
          detectedType:
            rowDetectedType ||
            (explicitStatements.length > 0
              ? 'benar_salah'
              : options.length === 0
              ? 'isian_singkat'
              : undefined),
          questionLines: [qCell.fullText.replace(/^\d+[\.\)\-:]\s*/, '').trim()],
          unprefixedParagraphs: [],
          options,
          explicitKeys,
          explicitTextAnswers:
            explicitTextAnswers.length > 0 ? explicitTextAnswers : undefined,
          explicitStatements:
            explicitStatements.length > 0 ? explicitStatements : undefined,
          stimulusTable,
        });
      }
    }

    if (drafts.length > 0) return drafts;
  }

  // CASE 2: Vertical Table or Multi-Row Question Table
  const optionLabelRegex = /^(?:opsi\s*|pilihan\s*)?([A-Ea-e])[\.\)\-:]?$/i;
  const questionLabelRegex = /^(?:no\.?\s*|soal\s*(?:no\.?)?\s*)?(\d+)[\.\)\-:]?$/i;

  let optionRowCount = 0;
  for (const r of rows) {
    if (r.length === 2 || r.length === 3) {
      const c0 = r[0].fullText.trim();
      const c1 = r[1].fullText.trim();
      if (
        (optionLabelRegex.test(c0) && r.length === 2) ||
        (r.length === 3 && !c0 && optionLabelRegex.test(c1)) ||
        (r.length === 3 && questionLabelRegex.test(c0) && optionLabelRegex.test(c1))
      ) {
        optionRowCount++;
      }
    }
  }

  if (optionRowCount >= 2) {
    const drafts: DraftQuestion[] = [];
    let currentDraft: DraftQuestion | null = null;

    const flush = () => {
      const finalized = finalizeDraftQuestion(currentDraft);
      if (finalized) {
        drafts.push(finalized);
      }
      currentDraft = null;
    };

    for (const r of rows) {
      // Handle 1-cell merged row (e.g. stimulus or question continuation)
      if (r.length === 1) {
        const txt = r[0].fullText.trim();
        if (!txt) continue;
        const optM = txt.match(OPTION_LINE_REGEX);
        if (optM && currentDraft) {
          const letter = (optM[1] || optM[2] || optM[3] || 'A').toUpperCase();
          if (
            letter === 'A' &&
            currentDraft.options.some((o) => o.id === 'A') &&
            currentDraft.options.length >= 2
          ) {
            flush();
            currentDraft = {
              questionLines: [],
              unprefixedParagraphs: [],
              options: [],
              explicitKeys: [],
            };
          }
          currentDraft.options.push({
            id: letter,
            text: (optM[4] || '').trim() || `Pilihan ${letter}`,
            isRed: r[0].hasRed,
          });
        } else {
          if (currentDraft && currentDraft.options.length >= 2) {
            flush();
          }
          if (!currentDraft) {
            currentDraft = {
              questionLines: [],
              unprefixedParagraphs: [],
              options: [],
              explicitKeys: [],
            };
          }
          currentDraft.questionLines.push(txt.replace(/^\d+[\.\)\-:]\s*/, '').trim());
          if (r[0].nestedTables.length > 0 && !currentDraft.stimulusTable) {
            currentDraft.stimulusTable = convertParsedTableToQuestionTableData(
              r[0].nestedTables[0]
            );
          }
        }
        continue;
      }

      const c0 = r[0].fullText.trim();
      const c1 = r[1].fullText.trim();
      const c2 = r.length >= 3 ? r[2].fullText.trim() : '';

      if (
        /^(no|no\.|nomor)$/i.test(c0) &&
        /^(soal|pertanyaan|butir|uraian)/i.test(c1)
      ) {
        continue;
      }

      const optMatchCol0 = c0.match(optionLabelRegex);
      const optMatchCol1 = r.length >= 3 ? c1.match(optionLabelRegex) : null;

      if (optMatchCol0) {
        const letter = optMatchCol0[1].toUpperCase();
        const optCell = r[1];
        const optText = optCell.fullText.trim() || `Pilihan ${letter}`;
        const isRed = r[0].hasRed || optCell.hasRed;
        if (!currentDraft) {
          currentDraft = {
            questionLines: [],
            unprefixedParagraphs: [],
            options: [],
            explicitKeys: [],
          };
        }
        if (
          letter === 'A' &&
          currentDraft.options.some((o) => o.id === 'A') &&
          currentDraft.options.length >= 2
        ) {
          flush();
          currentDraft = {
            questionLines: [],
            unprefixedParagraphs: [],
            options: [],
            explicitKeys: [],
          };
        }
        currentDraft.options.push({ id: letter, text: optText, isRed });
        continue;
      }

      if (optMatchCol1 && r.length >= 3) {
        const letter = optMatchCol1[1].toUpperCase();
        const optCell = r[2];
        const optText = optCell.fullText.trim() || `Pilihan ${letter}`;
        const isRed = r[1].hasRed || optCell.hasRed;
        if (!currentDraft) {
          currentDraft = {
            questionLines: [],
            unprefixedParagraphs: [],
            options: [],
            explicitKeys: [],
          };
        }
        if (
          letter === 'A' &&
          currentDraft.options.some((o) => o.id === 'A') &&
          currentDraft.options.length >= 2
        ) {
          flush();
          currentDraft = {
            questionLines: [],
            unprefixedParagraphs: [],
            options: [],
            explicitKeys: [],
          };
        }
        currentDraft.options.push({ id: letter, text: optText, isRed });
        continue;
      }

      // What if c1 in a 2-col row has "A. Pilihan A" directly?
      const inlineOptCol1 = !c0 ? c1.match(OPTION_LINE_REGEX) : null;
      if (inlineOptCol1 && currentDraft) {
        const letter = (
          inlineOptCol1[1] ||
          inlineOptCol1[2] ||
          inlineOptCol1[3] ||
          'A'
        ).toUpperCase();
        currentDraft.options.push({
          id: letter,
          text: (inlineOptCol1[4] || '').trim() || `Pilihan ${letter}`,
          isRed: r[1].hasRed,
        });
        continue;
      }

      if (/^(kunci|jawaban)/i.test(c0) && c1 && currentDraft) {
        const kMatches = c1.toUpperCase().match(/[A-E]/g);
        if (kMatches) currentDraft.explicitKeys.push(...kMatches);
        continue;
      }

      const numLabelMatch = c0.match(questionLabelRegex);
      const qLabelMatch = numLabelMatch || /^(soal|pertanyaan)/i.test(c0);
      const targetCell = qLabelMatch ? (c1 ? r[1] : r[2] || r[1]) : r[0];
      const questionCandidateText = qLabelMatch
        ? c1 || c2
        : `${c0} ${c1}`.trim();

      if (questionCandidateText) {
        if (currentDraft && (currentDraft.options.length >= 2 || numLabelMatch)) {
          flush();
        }
        if (!currentDraft) {
          currentDraft = {
            explicitNumber: numLabelMatch ? parseInt(numLabelMatch[1], 10) : undefined,
            questionLines: [],
            unprefixedParagraphs: [],
            options: [],
            explicitKeys: [],
          };
        }
        // Check if targetCell contains both the question AND options paragraphs!
        if (targetCell && targetCell.paragraphs.length >= 3) {
          const cellBlocks: DocumentBlock[] = [];
          for (const p of targetCell.paragraphs) {
            cellBlocks.push({ kind: 'paragraph', paragraph: p });
          }
          for (const nt of targetCell.nestedTables) {
            cellBlocks.push({ kind: 'table', table: nt });
          }
          const innerDrafts = buildDraftsFromBlockSequence(cellBlocks);
          if (innerDrafts.length > 0) {
            currentDraft = null;
            drafts.push(...innerDrafts);
            continue;
          }
        }

        currentDraft.questionLines.push(
          questionCandidateText.replace(/^\d+[\.\)\-:]\s*/, '').trim()
        );
        if (
          targetCell &&
          targetCell.nestedTables.length > 0 &&
          !currentDraft.stimulusTable
        ) {
          currentDraft.stimulusTable = convertParsedTableToQuestionTableData(
            targetCell.nestedTables[0]
          );
        }
      }
    }

    flush();
    if (drafts.length > 0) return drafts;
  }

  // CASE 3: Table where rows/cells contain full questions with options (e.g. [1 | Pertanyaan + A..E])
  const cellBlocks: DocumentBlock[] = [];
  let inlineOptionLinesCount = 0;
  for (const r of rows) {
    for (const c of r) {
      for (const p of c.paragraphs) {
        const expanded = splitInlineOptionsIfPresent(p);
        for (const ep of expanded) {
          cellBlocks.push({ kind: 'paragraph', paragraph: ep });
          if (matchOptionLine(ep)) {
            inlineOptionLinesCount++;
          }
        }
      }
      for (const nt of c.nestedTables) {
        cellBlocks.push({ kind: 'table', table: nt });
      }
    }
  }

  if (inlineOptionLinesCount >= 2) {
    const drafts = buildDraftsFromBlockSequence(cellBlocks);
    if (drafts.length > 0) return drafts;
  }

  return null;
}

/**
 * Builds DraftQuestions from a sequence of DocumentBlocks (paragraphs and tables).
 */
function buildDraftsFromBlockSequence(blocks: DocumentBlock[]): DraftQuestion[] {
  const expandedBlocks: DocumentBlock[] = [];
  for (const b of blocks) {
    if (b.kind === 'paragraph') {
      const splitParas = splitInlineOptionsIfPresent(b.paragraph);
      for (const sp of splitParas) {
        const t = sp.fullText.trim();
        if (!t) continue;
        if (
          /^(soal\s+ujian|bank\s+soal|daftar\s+soal|template\s+soal|petunjuk\s+pengerjaan)/i.test(
            t
          ) &&
          t.length < 80
        ) {
          continue;
        }
        expandedBlocks.push({ kind: 'paragraph', paragraph: sp });
      }
    } else {
      expandedBlocks.push(b);
    }
  }

  let currentDraft: DraftQuestion | null = null;
  let currentSectionType: QuestionType | undefined = undefined;
  let inInternalNumberedList = false;
  let internalListCounter = 0;
  let inAnswerKeySection = false;
  const answerKeyByNumber: Record<number, string> = {};
  const drafts: DraftQuestion[] = [];

  const createEmptyDraft = (explicitNumber?: number): DraftQuestion => ({
    explicitNumber,
    detectedType: currentSectionType,
    questionLines: [],
    unprefixedParagraphs: [],
    allParagraphs: [],
    options: [],
    explicitKeys: [],
  });

  const flushDraft = () => {
    const finalized = finalizeDraftQuestion(currentDraft);
    if (finalized) {
      drafts.push(finalized);
    }
    currentDraft = null;
    inInternalNumberedList = false;
    internalListCounter = 0;
  };

  // Helper to inspect upcoming blocks before the next top-level numbered question
  const inspectBeforeNextQuestion = (
    startIdx: number,
    expectedNextNum?: number
  ): { optionCount: number; firstOptionLetter: string | null } => {
    let optionCount = 0;
    let firstOptionLetter: string | null = null;
    for (let k = startIdx; k < expandedBlocks.length; k++) {
      const blk = expandedBlocks[k];
      if (blk.kind === 'paragraph') {
        const p = blk.paragraph;
        const optM = matchOptionLine(p);
        if (optM) {
          optionCount++;
          if (!firstOptionLetter) {
            firstOptionLetter = optM.letter;
          }
          continue;
        }
        const qM = matchNumberedQuestionLine(p);
        if (qM) {
          if (
            expectedNextNum === undefined ||
            qM.qNum === expectedNextNum ||
            optionCount >= 2
          ) {
            break;
          }
        }
      }
    }
    return { optionCount, firstOptionLetter };
  };

  for (let i = 0; i < expandedBlocks.length; i++) {
    const block = expandedBlocks[i];

    if (block.kind === 'table') {
      const expectedNextNum =
        currentDraft?.explicitNumber !== undefined
          ? currentDraft.explicitNumber + 1
          : undefined;
      const upcoming = inspectBeforeNextQuestion(i + 1, expectedNextNum);

      // 0A. Check if this table is a Benar/Salah Statement Table for the current question!
      const bsStatements = tryExtractBenarSalahFromTable(block.table);
      if (bsStatements && bsStatements.length >= 2) {
        if (!currentDraft) {
          currentDraft = createEmptyDraft();
        }
        currentDraft.detectedType = 'benar_salah';
        currentDraft.explicitStatements = bsStatements;
        flushDraft();
        continue;
      }

      // 0B. Check if this table is a Menjodohkan Table for the current question!
      const matchPairs = tryExtractMenjodohkanFromTable(block.table);
      if (matchPairs && matchPairs.length >= 2) {
        if (!currentDraft) {
          currentDraft = createEmptyDraft();
        }
        currentDraft.detectedType = 'menjodohkan';
        currentDraft.explicitMatchingPairs = matchPairs;
        flushDraft();
        continue;
      }

      // If option paragraphs (A..E) already follow this table for the current question,
      // then this table is 100% a Stimulus/Data Table for the current question!
      if (
        currentDraft &&
        currentDraft.options.length === 0 &&
        upcoming.optionCount >= 2
      ) {
        const tableData = convertParsedTableToQuestionTableData(block.table);
        if (tableData) {
          currentDraft.stimulusTable = tableData;
        }
        continue;
      }

      // 1. Check if this table is an Options Table (A..E) for the current question!
      if (
        currentDraft &&
        currentDraft.questionLines.length > 0 &&
        currentDraft.options.length === 0
      ) {
        const tableOpts = tryExtractOptionsOnlyFromTable(block.table);
        if (tableOpts && tableOpts.length >= 2) {
          currentDraft.options.push(...tableOpts);
          if (block.table.rows.length > tableOpts.length) {
            currentDraft.stimulusTable = convertParsedTableToQuestionTableData(
              block.table
            );
          }
          continue;
        }
      }

      // 2. Check if this table is a Bank Soal Table containing full questions + options
      const tableQuestionDrafts = tryExtractQuestionsFromBankSoalTable(
        block.table
      );
      if (tableQuestionDrafts && tableQuestionDrafts.length > 0) {
        flushDraft();
        drafts.push(...tableQuestionDrafts);
        continue;
      }

      // 3. Otherwise, this table is a Data / Stimulus Table belonging to a question
      const tableData = convertParsedTableToQuestionTableData(block.table);
      if (tableData) {
        if (currentDraft && currentDraft.options.length >= 2) {
          flushDraft();
        }
        if (!currentDraft) {
          currentDraft = createEmptyDraft();
        }
        currentDraft.stimulusTable = tableData;
      }
      continue;
    }

    const para = block.paragraph;
    const text = para.fullText.trim();

    // Check if we entered a document-end "KUNCI JAWABAN" section
    if (
      /^(?:daftar\s+)?kunci\s+jawaban(?:\s+ujian|\s+soal)?\s*[:\-]?$/i.test(
        text
      )
    ) {
      flushDraft();
      inAnswerKeySection = true;
      continue;
    }

    if (inAnswerKeySection) {
      // Parse lines like "1. B", "2. A, C", "3. Benar, Salah, Benar", or inline "1. A   2. C   3. D"
      const inlineKeyPairs = Array.from(
        text.matchAll(
          /(\d+)\s*[\.\)\-:]\s*([A-Ea-e](?:\s*,\s*[A-Ea-e])*|Benar|Salah)/gi
        )
      );
      if (inlineKeyPairs.length >= 2) {
        inlineKeyPairs.forEach((m) => {
          answerKeyByNumber[parseInt(m[1], 10)] = m[2].trim();
        });
        continue;
      }
      const singleKeyLine = text.match(/^(\d+)\s*[\.\)\-:]\s*(.+)$/);
      if (singleKeyLine) {
        answerKeyByNumber[parseInt(singleKeyLine[1], 10)] =
          singleKeyLine[2].trim();
        continue;
      }
    }

    // Check if paragraph is a section header for a specific QuestionType
    const sectionHeaderType = matchSectionTypeHeader(text);
    if (sectionHeaderType) {
      flushDraft();
      currentSectionType = sectionHeaderType;
      inAnswerKeySection = false;
      continue;
    }

    // Ignore standalone table number headers like "1" or "1." if followed immediately by a numbered question
    if (/^\d+[\.\)]?$/.test(text)) {
      const numVal = parseInt(text, 10);
      if (
        currentDraft &&
        (currentDraft.options.length >= 2 ||
          (currentDraft.allParagraphs && currentDraft.allParagraphs.length >= 3))
      ) {
        flushDraft();
      }
      if (!currentDraft) {
        currentDraft = createEmptyDraft(numVal);
      }
      continue;
    }

    // 1. Check if line is an explicit "Kunci Jawaban: ..." line
    const keyMatch = text.match(EXPLICIT_KEY_LINE_REGEX);
    if (keyMatch && currentDraft) {
      const rawKeyVal = keyMatch[1].trim();
      const isOptionLettersOnly =
        /^[A-Ea-e](?:\s*(?:[,\/&]|dan)\s*[A-Ea-e])*$/i.test(rawKeyVal) ||
        /^(?:opsi\s*)?[A-Ea-e]$/i.test(rawKeyVal);
      if (isOptionLettersOnly) {
        const keys = rawKeyVal.toUpperCase().match(/[A-E]/g) || [];
        currentDraft.explicitKeys.push(...keys);
        if (keys.length > 1) {
          currentDraft.detectedType = 'pilihan_ganda_kompleks';
        }
      } else if (
        /^(?:benar|salah|b|s|sesuai|tidak\s*sesuai)(?:\s*[,\/\-]\s*(?:benar|salah|b|s|sesuai|tidak\s*sesuai))+$/i.test(
          rawKeyVal
        )
      ) {
        currentDraft.detectedType = 'benar_salah';
        const bsVals = rawKeyVal
          .split(/[,\/\-]/)
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean);
        currentDraft.explicitKeys.push(
          ...bsVals.map((v) =>
            v === 'benar' || v === 'b' || v === 'sesuai' ? 'BENAR' : 'SALAH'
          )
        );
      } else {
        if (!currentDraft.explicitTextAnswers) {
          currentDraft.explicitTextAnswers = [];
        }
        currentDraft.explicitTextAnswers.push(
          ...rawKeyVal
            .split(/\s*[\/|;]\s*/)
            .map((s) => s.trim())
            .filter(Boolean)
        );
        const singleLetter = rawKeyVal.toUpperCase().match(/^[A-E]$/);
        if (singleLetter) {
          currentDraft.explicitKeys.push(singleLetter[0]);
        }
      }
      continue;
    }

    // 2. Check if line is an Option (A. / B. / C. / D. / E. or auto-lettered option)
    const optMatch = matchOptionLine(para);
    if (optMatch) {
      const { letter: optLetter, text: optText, isRed } = optMatch;

      if (!currentDraft) {
        currentDraft = createEmptyDraft();
      }

      // If we see 'A' again and we already collected >= 2 options for the current question:
      if (
        optLetter === 'A' &&
        currentDraft.options.some((o) => o.id === 'A') &&
        currentDraft.options.length >= 2
      ) {
        const expectedNext =
          currentDraft.explicitNumber !== undefined
            ? currentDraft.explicitNumber + 1
            : undefined;
        const upcomingAfterThis = inspectBeforeNextQuestion(i + 1, expectedNext);
        if (
          currentDraft.explicitNumber !== undefined &&
          upcomingAfterThis.optionCount >= 2 &&
          currentDraft.options.length <= 4
        ) {
          for (const prevOpt of currentDraft.options) {
            currentDraft.questionLines.push(`${prevOpt.id}. ${prevOpt.text}`);
          }
          currentDraft.options = [];
          if (currentDraft.allParagraphs) {
            currentDraft.allParagraphs.forEach((r) => {
              r.matchedOption = undefined;
            });
          }
        } else {
          flushDraft();
          currentDraft = createEmptyDraft();
        }
      }

      inInternalNumberedList = false;
      currentDraft.options.push({
        id: optLetter,
        text: optText,
        isRed,
      });
      currentDraft.allParagraphs?.push({
        para,
        matchedOption: optMatch,
      });
      continue;
    }

    // 3. Check if line is a Numbered Question (e.g., "1. Apa yang dimaksud..." or auto-numbered decimal)
    const qMatch = matchNumberedQuestionLine(para);
    if (qMatch) {
      const { qNum, qText } = qMatch;

      if (!currentDraft) {
        currentDraft = createEmptyDraft(qNum);
        const inlineType = detectQuestionTypeFromText(qText);
        if (inlineType) currentDraft.detectedType = inlineType;
        currentDraft.questionLines.push(qText);
        const cleanPara = { ...para, fullText: qText };
        currentDraft.unprefixedParagraphs.push(cleanPara);
        currentDraft.allParagraphs?.push({ para: cleanPara });
        continue;
      }

      // Determine if qNum is an internal numbered list item (1, 2, 3, 4) inside the current question stem
      // vs the start of the NEXT question!
      const expectedNextQNum: number =
        currentDraft.explicitNumber !== undefined
          ? currentDraft.explicitNumber + 1
          : drafts.length + 2;

      const isInternalListStart =
        currentDraft.options.length === 0 &&
        qNum === 1 &&
        qNum !== expectedNextQNum &&
        (currentDraft.explicitNumber !== undefined || drafts.length > 0);

      const isInternalListContinuation =
        inInternalNumberedList &&
        currentDraft.options.length === 0 &&
        qNum === internalListCounter + 1 &&
        qNum !== expectedNextQNum;

      const isSmallNumberInsideHigherQuestion =
        currentDraft.options.length === 0 &&
        currentDraft.explicitNumber !== undefined &&
        currentDraft.explicitNumber >= 7 &&
        qNum <= 6 &&
        (currentDraft.allParagraphs?.length ?? 0) <= 6;

      if (
        isInternalListStart ||
        (isSmallNumberInsideHigherQuestion && !inInternalNumberedList)
      ) {
        inInternalNumberedList = true;
        internalListCounter = qNum;
        const lineWithNum = /^\d+/.test(text) ? text : `${qNum}. ${qText}`;
        currentDraft.questionLines.push(lineWithNum);
        currentDraft.unprefixedParagraphs.push(para);
        currentDraft.allParagraphs?.push({ para });
        continue;
      }

      if (isInternalListContinuation || isSmallNumberInsideHigherQuestion) {
        internalListCounter = qNum;
        const lineWithNum = /^\d+/.test(text) ? text : `${qNum}. ${qText}`;
        currentDraft.questionLines.push(lineWithNum);
        currentDraft.unprefixedParagraphs.push(para);
        currentDraft.allParagraphs?.push({ para });
        continue;
      }

      // Otherwise, this is a NEW question! Flush the previous question first!
      flushDraft();
      currentDraft = createEmptyDraft(qNum);
      const inlineType = detectQuestionTypeFromText(qText);
      if (inlineType) currentDraft.detectedType = inlineType;
      currentDraft.questionLines.push(qText);
      const cleanPara = { ...para, fullText: qText };
      currentDraft.unprefixedParagraphs.push(cleanPara);
      currentDraft.allParagraphs?.push({ para: cleanPara });
      continue;
    }

    // 4. Non-option, non-numbered paragraph:
    const inlineTypeInPara = detectQuestionTypeFromText(text);
    if (inlineTypeInPara && currentDraft && !currentDraft.detectedType) {
      currentDraft.detectedType = inlineTypeInPara;
    }

    if (currentDraft && currentDraft.options.length >= 1) {
      const expectedNext =
        currentDraft.explicitNumber !== undefined
          ? currentDraft.explicitNumber + 1
          : undefined;
      const upcoming = inspectBeforeNextQuestion(i + 1, expectedNext);

      if (
        upcoming.firstOptionLetter &&
        upcoming.firstOptionLetter !== 'A'
      ) {
        currentDraft.unprefixedParagraphs.push(para);
        currentDraft.allParagraphs?.push({ para });
        continue;
      }

      if (
        upcoming.firstOptionLetter === 'A' &&
        upcoming.optionCount >= 2 &&
        currentDraft.explicitNumber !== undefined
      ) {
        for (const prevOpt of currentDraft.options) {
          currentDraft.questionLines.push(`${prevOpt.id}. ${prevOpt.text}`);
        }
        currentDraft.options = [];
        if (currentDraft.allParagraphs) {
          currentDraft.allParagraphs.forEach((r) => {
            r.matchedOption = undefined;
          });
        }
        currentDraft.questionLines.push(text);
        currentDraft.unprefixedParagraphs.push(para);
        currentDraft.allParagraphs?.push({ para });
        continue;
      }

      if (
        upcoming.optionCount === 0 &&
        currentDraft.options.length < 5 &&
        currentDraft.explicitNumber !== undefined
      ) {
        currentDraft.unprefixedParagraphs.push(para);
        currentDraft.allParagraphs?.push({ para });
        continue;
      }

      if (currentDraft.options.length >= 2) {
        flushDraft();
      }
    }

    if (!currentDraft) {
      currentDraft = createEmptyDraft();
      if (inlineTypeInPara) currentDraft.detectedType = inlineTypeInPara;
      currentDraft.questionLines.push(text);
      currentDraft.unprefixedParagraphs.push(para);
      currentDraft.allParagraphs?.push({ para });
    } else {
      currentDraft.questionLines.push(text);
      currentDraft.unprefixedParagraphs.push(para);
      currentDraft.allParagraphs?.push({ para });
    }
  }

  flushDraft();

  // Apply any keys found in a document-end KUNCI JAWABAN section
  if (Object.keys(answerKeyByNumber).length > 0) {
    drafts.forEach((d, idx) => {
      const num = d.explicitNumber ?? idx + 1;
      const rawKey = answerKeyByNumber[num];
      if (!rawKey) return;
      if (/^[A-Ea-e](?:\s*,\s*[A-Ea-e])*$/i.test(rawKey)) {
        const letters = rawKey.toUpperCase().match(/[A-E]/g) || [];
        d.explicitKeys = letters;
        if (letters.length > 1) {
          d.detectedType = 'pilihan_ganda_kompleks';
        }
      } else if (/^(?:benar|salah)/i.test(rawKey)) {
        d.detectedType = 'benar_salah';
        const bs = rawKey
          .split(/[,\/]/)
          .map((x) =>
            /benar|^b$/i.test(x.trim()) ? 'BENAR' : 'SALAH'
          );
        d.explicitKeys = bs;
      } else {
        d.explicitTextAnswers = [rawKey];
      }
    });
  }

  return drafts;
}

/**
 * Helper to check if a draft's options or lines represent matching pairs (Menjodohkan),
 * e.g., "A. Kaktus -> Daun berbentuk duri" or "1. Mitokondria = Respirasi sel"
 */
function tryExtractMatchingPairsFromDraft(
  draft: DraftQuestion
): { premise: string; response: string }[] | null {
  if (draft.explicitMatchingPairs && draft.explicitMatchingPairs.length >= 2) {
    return draft.explicitMatchingPairs;
  }

  const pairRegex = /^(.+?)\s*(?:->|=>|<->|↔|—|--|=)\s*(.+)$/;
  const candidateStrings =
    draft.options.length >= 2
      ? draft.options.map((o) => o.text)
      : draft.questionLines.slice(1);

  const pairs: { premise: string; response: string }[] = [];
  for (const line of candidateStrings) {
    const cleaned = line.replace(/^[A-Za-z0-9]+[\.\)\-:]\s*/, '').trim();
    const m = cleaned.match(pairRegex);
    if (m && m[1].trim() && m[2].trim()) {
      pairs.push({ premise: m[1].trim(), response: m[2].trim() });
    }
  }

  if (
    pairs.length >= 2 &&
    (draft.detectedType === 'menjodohkan' ||
      pairs.length === candidateStrings.length)
  ) {
    return pairs;
  }

  return null;
}

/**
 * Helper to check if a draft's options or statements have explicit Benar/Salah suffixes
 * e.g. "Pernyataan 1 (Benar)" / "Pernyataan 2 (Salah)" or options are literally ["Benar", "Salah"].
 */
function tryExtractBenarSalahFromDraft(
  draft: DraftQuestion
): StatementItem[] | null {
  if (draft.explicitStatements && draft.explicitStatements.length > 0) {
    return draft.explicitStatements;
  }

  const bsSuffixRegex =
    /^(.*?)[\s\-:]+[\(\[]?(benar|salah|sesuai|tidak\s+sesuai)[\)\]]?\s*$/i;

  if (draft.options.length >= 2) {
    const matchedSuffixCount = draft.options.filter((o) =>
      bsSuffixRegex.test(o.text.trim())
    ).length;

    if (matchedSuffixCount >= 2) {
      return draft.options.map((o, idx) => {
        const m = o.text.trim().match(bsSuffixRegex);
        const stText = m ? m[1].trim() : o.text.trim();
        const valRaw = m ? m[2].toLowerCase() : '';
        const isBenar =
          valRaw === 'benar' ||
          valRaw === 'sesuai' ||
          (!valRaw && o.isRed);
        return {
          id: `st${idx + 1}`,
          statement: stText,
          correctValue: isBenar ? 'Benar' : 'Salah',
        };
      });
    }

    // Check if the 2 options are literally "Benar" and "Salah" (True/False single statement question)
    if (
      draft.options.length === 2 &&
      /^(benar|true|sesuai)$/i.test(draft.options[0].text.trim()) &&
      /^(salah|false|tidak\s+sesuai)$/i.test(draft.options[1].text.trim())
    ) {
      const isFirstCorrect =
        draft.options[0].isRed ||
        draft.explicitKeys.includes('A') ||
        draft.explicitKeys.includes('BENAR');
      const stemText =
        draft.questionLines.join(' ').trim() || 'Pernyataan soal';
      return [
        {
          id: 'st1',
          statement: stemText,
          correctValue: isFirstCorrect ? 'Benar' : 'Salah',
        },
      ];
    }
  }

  if (
    draft.detectedType === 'benar_salah' &&
    draft.options.length >= 2
  ) {
    return draft.options.slice(0, 6).map((o, idx) => {
      const explicitVal = draft.explicitKeys[idx];
      const isBenar =
        explicitVal === 'BENAR'
          ? true
          : explicitVal === 'SALAH'
          ? false
          : o.isRed;
      return {
        id: `st${idx + 1}`,
        statement: o.text,
        correctValue: isBenar ? 'Benar' : 'Salah',
      };
    });
  }

  return null;
}

/**
 * Converts extracted DocumentBlocks (paragraphs and tables with red text metadata) into CBT Question objects.
 * Automatically recognizes the question type (Pilihan Ganda, PG Kompleks, Benar/Salah, Menjodohkan, Isian Singkat)
 * directly from the uploaded file's structure and content!
 */
function buildQuestionsFromBlocks(
  blocks: DocumentBlock[],
  _defaultQuestionType: QuestionType,
  startingNumber: number,
  defaultCategory: string
): Question[] {
  const drafts = buildDraftsFromBlockSequence(blocks);
  const questions: Question[] = [];
  const nowTs = Date.now();

  drafts.forEach((draft, idx) => {
    const qNum = startingNumber + idx;
    const rawQuestionText =
      draft.questionLines.join(' ').trim() || `Pertanyaan Soal No. ${qNum}`;
    const stemDetectedType =
      draft.detectedType || detectQuestionTypeFromText(rawQuestionText);

    // 1. Check Menjodohkan (Matching)
    const matchingPairs = tryExtractMatchingPairsFromDraft(draft);
    if (matchingPairs && matchingPairs.length >= 2) {
      const premises: MatchingPremise[] = [];
      const responses: MatchingResponse[] = [];
      const correctPairs: Record<string, string> = {};

      matchingPairs.forEach((pair, pIdx) => {
        const pId = `p${pIdx + 1}`;
        const rId = `r${pIdx + 1}`;
        premises.push({ id: pId, text: pair.premise });
        responses.push({ id: rId, text: pair.response });
        correctPairs[pId] = rId;
      });

      const stemOnly =
        draft.options.length >= 2
          ? rawQuestionText
          : draft.questionLines[0] ||
            'Pasangkan pernyataan pada kolom Premis dengan jawaban yang sesuai pada kolom Respon!';

      questions.push({
        id: `word_q_${nowTs}_${idx}`,
        number: qNum,
        type: 'menjodohkan',
        category: defaultCategory,
        questionText: stemOnly,
        stimulusTable: draft.stimulusTable,
        instructionText:
          'Pasangkan setiap pernyataan di sebelah kiri dengan pasangan yang tepat di sebelah kanan!',
        premises,
        responses,
        correctPairs,
        points: 10,
        explanation: `Pasangan jawaban yang benar telah diatur sesuai dokumen soal.`,
      });
      return;
    }

    // 2. Check Benar / Salah
    const bsStatements = tryExtractBenarSalahFromDraft(draft);
    if (bsStatements && bsStatements.length >= 1) {
      questions.push({
        id: `word_q_${nowTs}_${idx}`,
        number: qNum,
        type: 'benar_salah',
        category: defaultCategory,
        questionText: rawQuestionText,
        stimulusTable: draft.stimulusTable,
        instructionText: 'Tentukan Benar atau Salah untuk setiap pernyataan!',
        statements: bsStatements,
        trueLabel: 'Benar',
        falseLabel: 'Salah',
        points: 10,
        explanation: `Kunci Benar/Salah: ${bsStatements
          .map((s, sIdx) => `(${sIdx + 1}) ${s.correctValue}`)
          .join(', ')}.`,
      });
      return;
    }

    // 3. Check Isian Singkat / Uraian (when no options A..E exist or explicitly tagged as isian/uraian without options)
    if (
      draft.options.length < 2 ||
      (stemDetectedType === 'isian_singkat' && draft.options.length === 0)
    ) {
      const shortAnswers =
        draft.explicitTextAnswers && draft.explicitTextAnswers.length > 0
          ? draft.explicitTextAnswers
          : draft.explicitKeys.length > 0
          ? draft.explicitKeys
          : ['Sesuai Kunci Guru'];

      questions.push({
        id: `word_q_${nowTs}_${idx}`,
        number: qNum,
        type: 'isian_singkat',
        category: defaultCategory,
        questionText: rawQuestionText,
        stimulusTable: draft.stimulusTable,
        instructionText:
          'Ketiklah jawaban singkat atau uraian dengan tepat pada kolom yang tersedia!',
        correctShortAnswers: shortAnswers,
        placeholder: 'Ketik jawaban Anda di sini...',
        points: 10,
        explanation: `Kunci jawaban: ${shortAnswers.join(' / ')}.`,
      });
      return;
    }

    // 4. Pilihan Ganda or Pilihan Ganda Kompleks
    const normalizedOptions: OptionItem[] = draft.options
      .slice(0, 5)
      .map((o, oIdx) => ({
        id: ['A', 'B', 'C', 'D', 'E'][oIdx] || o.id,
        text: o.text,
      }));

    const redOptionIds = draft.options
      .slice(0, 5)
      .map((o, oIdx) =>
        o.isRed ? ['A', 'B', 'C', 'D', 'E'][oIdx] || o.id : null
      )
      .filter((id): id is string => Boolean(id));

    const validExplicitOptionKeys = draft.explicitKeys.filter((k) =>
      ['A', 'B', 'C', 'D', 'E'].includes(k)
    );

    const effectiveCorrectIds =
      redOptionIds.length > 0
        ? redOptionIds
        : validExplicitOptionKeys.length > 0
        ? validExplicitOptionKeys
        : ['A'];

    const isComplex =
      stemDetectedType === 'pilihan_ganda_kompleks' ||
      effectiveCorrectIds.length > 1;

    if (isComplex) {
      questions.push({
        id: `word_q_${nowTs}_${idx}`,
        number: qNum,
        type: 'pilihan_ganda_kompleks',
        category: defaultCategory,
        questionText: rawQuestionText,
        stimulusTable: draft.stimulusTable,
        instructionText: 'Pilihlah lebih dari satu jawaban yang benar!',
        options: normalizedOptions,
        correctOptionIds: effectiveCorrectIds,
        points: 10,
        explanation: `Kunci jawaban yang benar (teks warna merah): ${effectiveCorrectIds.join(', ')}.`,
      });
    } else {
      const singleKey = effectiveCorrectIds[0] || 'A';
      questions.push({
        id: `word_q_${nowTs}_${idx}`,
        number: qNum,
        type: 'pilihan_ganda',
        category: defaultCategory,
        questionText: rawQuestionText,
        stimulusTable: draft.stimulusTable,
        instructionText: 'Pilih satu jawaban yang paling tepat!',
        options: normalizedOptions,
        correctOptionId: singleKey,
        points: 10,
        explanation: `Kunci jawaban yang benar (teks warna merah) adalah opsi ${singleKey}.`,
      });
    }
  });

  return questions;
}

/**
 * Converts an Excel/CSV workbook into DocumentBlocks so any spreadsheet layout
 * (table bank soal, vertical list, or multi-sheet) is seamlessly parsed into CBT questions.
 */
function parseSpreadsheetBlocks(buffer: ArrayBuffer): DocumentBlock[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const blocks: DocumentBlock[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const sheetType = detectQuestionTypeFromText(sheetName);
    if (sheetType) {
      blocks.push({
        kind: 'paragraph',
        paragraph: {
          fullText: sheetName,
          hasRed: false,
          segments: [{ text: sheetName, isRed: false }],
        },
      });
    }

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
    });

    const nonEmptyRows = rawRows.filter(
      (r) =>
        Array.isArray(r) &&
        r.some((cell) => String(cell ?? '').trim().length > 0)
    );
    if (nonEmptyRows.length === 0) continue;

    // Check if the sheet is a 1-column list of paragraphs or a multi-column table
    const maxNonEmptyCols = Math.max(
      ...nonEmptyRows.map(
        (r) => r.filter((c) => String(c ?? '').trim().length > 0).length
      )
    );

    if (maxNonEmptyCols <= 1) {
      nonEmptyRows.forEach((r) => {
        const txt = r
          .map((c) => String(c ?? '').trim())
          .find((s) => s.length > 0);
        if (txt) {
          blocks.push({
            kind: 'paragraph',
            paragraph: {
              fullText: txt,
              hasRed: false,
              segments: [{ text: txt, isRed: false }],
            },
          });
        }
      });
    } else {
      const parsedRows: ParsedTableCell[][] = nonEmptyRows.map((r) =>
        r.map((c) => {
          const txt = String(c ?? '').trim();
          const para: ParsedParagraph = {
            fullText: txt,
            hasRed: false,
            segments: txt ? [{ text: txt, isRed: false }] : [],
          };
          return {
            fullText: txt,
            hasRed: false,
            paragraphs: txt ? [para] : [],
            nestedTables: [],
          };
        })
      );
      blocks.push({ kind: 'table', table: { rows: parsedRows } });
    }
  }

  return blocks;
}

/**
 * Strips RTF control sequences while preserving line breaks and detecting red color entries in \colortbl.
 */
function parseRtfBlocks(rawRtf: string): DocumentBlock[] {
  const redCfIndices = new Set<number>();
  const colorTblMatch = rawRtf.match(/\{\\colortbl;([^}]*)\}/i);
  if (colorTblMatch) {
    const entries = colorTblMatch[1].split(';');
    entries.forEach((entry, idx) => {
      const rM = entry.match(/\\red(\d+)/i);
      const gM = entry.match(/\\green(\d+)/i);
      const bM = entry.match(/\\blue(\d+)/i);
      if (rM && gM && bM) {
        const r = parseInt(rM[1], 10);
        const g = parseInt(gM[1], 10);
        const b = parseInt(bM[1], 10);
        if (r >= 130 && g <= 100 && b <= 100) {
          redCfIndices.add(idx + 1);
        }
      }
    });
  }

  const normalized = rawRtf
    .replace(/\\par\b|\\line\b/gi, '\n')
    .replace(/\\tab\b/gi, '\t');

  const lines = normalized.split(/\r?\n/);
  const blocks: DocumentBlock[] = [];

  for (const rawLine of lines) {
    let hasRed = false;
    redCfIndices.forEach((cfIdx) => {
      if (new RegExp(`\\\\cf${cfIdx}\\b`).test(rawLine)) {
        hasRed = true;
      }
    });

    const cleaned = rawLine
      .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info)[^}]*\}/gi, '')
      .replace(/\\'[0-9a-fA-F]{2}/g, (m) =>
        String.fromCharCode(parseInt(m.slice(2), 16))
      )
      .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
      .replace(/[{}]/g, '')
      .trim();

    if (cleaned) {
      blocks.push({
        kind: 'paragraph',
        paragraph: {
          fullText: cleaned,
          hasRed,
          segments: [{ text: cleaned, isRed: hasRed }],
        },
      });
    }
  }

  return blocks;
}

/**
 * Main entry point to parse any uploaded question file (.docx, .doc, .xlsx, .xls, .csv, .txt, .rtf, .json, .html)
 * into CBT Question items, automatically recognizing each question's type according to the file content.
 */
export async function parseWordQuestions(
  file: File,
  defaultQuestionType: QuestionType,
  startingNumber: number,
  defaultCategory: string = 'Sumatif Akhir Semester'
): Promise<{
  questions: Question[];
  redDetectedCount: number;
  tableCount: number;
  typeBreakdown: Record<string, number>;
}> {
  const fileNameLower = file.name.trim().toLowerCase();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // 1. Handle JSON file directly if uploaded
  if (fileNameLower.endsWith('.json')) {
    const rawJson = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(rawJson);
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
      ? parsed.questions
      : [];
    if (arr.length > 0) {
      const nowTs = Date.now();
      const questions: Question[] = arr.map((item: Partial<Question>, idx: number) => ({
        id: `word_q_${nowTs}_${idx}`,
        number: startingNumber + idx,
        type: item.type || 'pilihan_ganda',
        category: item.category || defaultCategory,
        questionText: item.questionText || `Pertanyaan No. ${startingNumber + idx}`,
        instructionText: item.instructionText || 'Pilih jawaban yang tepat!',
        options: item.options,
        correctOptionId: item.correctOptionId,
        correctOptionIds: item.correctOptionIds,
        statements: item.statements,
        trueLabel: item.trueLabel || 'Benar',
        falseLabel: item.falseLabel || 'Salah',
        premises: item.premises,
        responses: item.responses,
        correctPairs: item.correctPairs,
        correctShortAnswers: item.correctShortAnswers,
        stimulusTable: item.stimulusTable,
        points: item.points || 10,
        explanation: item.explanation || 'Sesuai kunci jawaban pada file.',
      }));
      const typeBreakdown: Record<string, number> = {};
      questions.forEach((q) => {
        typeBreakdown[q.type] = (typeBreakdown[q.type] || 0) + 1;
      });
      return {
        questions,
        redDetectedCount: questions.length,
        tableCount: questions.filter((q) => Boolean(q.stimulusTable)).length,
        typeBreakdown,
      };
    }
  }

  const isZipContainer =
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  const isSpreadsheetExt =
    fileNameLower.endsWith('.xlsx') ||
    fileNameLower.endsWith('.xls') ||
    fileNameLower.endsWith('.csv');

  let blocks: DocumentBlock[] = [];

  if (isZipContainer && !isSpreadsheetExt) {
    const zipFiles = await extractZipFiles(buffer);
    const documentXml = zipFiles['word/document.xml'];
    if (documentXml) {
      blocks = parseDocxDocumentBlocks(
        documentXml,
        zipFiles['word/numbering.xml'],
        zipFiles['word/styles.xml']
      );
    } else {
      // ZIP container without word/document.xml (e.g. .xlsx renamed or spreadsheet)
      blocks = parseSpreadsheetBlocks(buffer);
    }
  } else if (isSpreadsheetExt) {
    blocks = parseSpreadsheetBlocks(buffer);
  } else {
    const textDecoder = new TextDecoder('utf-8');
    const rawText = textDecoder.decode(bytes);
    if (fileNameLower.endsWith('.rtf') || rawText.trimStart().startsWith('{\\rtf')) {
      blocks = parseRtfBlocks(rawText);
    } else {
      blocks = parseHtmlOrTextDocBlocks(rawText);
    }
  }

  // Also check if the filename itself hints at a specific question type (e.g. "Soal_Benar_Salah.docx")
  const fileNameTypeHint = detectQuestionTypeFromText(file.name);
  if (fileNameTypeHint && blocks.length > 0) {
    blocks.unshift({
      kind: 'paragraph',
      paragraph: {
        fullText: file.name.replace(/\.[^.]+$/, ''),
        hasRed: false,
        segments: [{ text: file.name, isRed: false }],
      },
    });
  }

  const questions = buildQuestionsFromBlocks(
    blocks,
    defaultQuestionType,
    startingNumber,
    defaultCategory
  );

  const redDetectedCount = questions.filter(
    (q) =>
      q.explanation.includes('teks warna merah') ||
      q.explanation.includes('Kunci') ||
      q.explanation.includes('Pasangan')
  ).length;

  const tableCount = questions.filter((q) => Boolean(q.stimulusTable)).length;

  const typeBreakdown: Record<string, number> = {};
  questions.forEach((q) => {
    typeBreakdown[q.type] = (typeBreakdown[q.type] || 0) + 1;
  });

  return { questions, redDetectedCount, tableCount, typeBreakdown };
}

/**
 * Computes CRC-32 for building a valid .docx ZIP archive in memory.
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds an uncompressed ZIP archive (Uint8Array) from a map of filenames -> UTF-8 string content.
 */
function createUncompressedZip(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(content);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const { nameBytes, dataBytes, crc } = entry;
    const localHeader = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const lv = new DataView(localHeader.buffer);

    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localHeader.set(dataBytes, 30 + nameBytes.length);
    localHeaders.push(localHeader);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  const cdSize = centralHeaders.reduce((acc, c) => acc + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + cdSize + eocd.length;
  const output = new Uint8Array(totalSize);
  let pos = 0;
  for (const lh of localHeaders) {
    output.set(lh, pos);
    pos += lh.length;
  }
  for (const ch of centralHeaders) {
    output.set(ch, pos);
    pos += ch.length;
  }
  output.set(eocd, pos);
  return output;
}

/**
 * Generates and downloads a ready-to-use .docx template file where correct answers are colored red (#FF0000)
 * and includes an example of a question with a Word Table.
 */
export function downloadWordQuestionTemplate(subjectTitle: string = 'Mata Pelajaran'): void {
  const cleanSubject = subjectTitle
    .replace(/^Simulasi TKA\s*-\s*/i, '')
    .replace(/\s*\(SMA\/MA\/SMK\)/i, '')
    .trim();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const makePara = (text: string, isRed: boolean = false, isBold: boolean = false) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const rPrParts: string[] = [];
    if (isBold) rPrParts.push('<w:b/>');
    if (isRed) rPrParts.push('<w:color w:val="FF0000"/>');
    const rPrXml = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';
    return `<w:p><w:r>${rPrXml}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  };

  const makeTableXml = (headers: string[], rows: string[][]) => {
    const makeRow = (cells: string[], isHeader: boolean) =>
      `<w:tr>${cells
        .map((c) => `<w:tc>${makePara(c, false, isHeader)}</w:tc>`)
        .join('')}</w:tr>`;
    return `<w:tbl>${makeRow(headers, true)}${rows.map((r) => makeRow(r, false)).join('')}</w:tbl>`;
  };

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${makePara(`1. Organel sel yang berfungsi sebagai tempat berlangsungnya respirasi seluler untuk menghasilkan energi (ATP) pada mata pelajaran ${cleanSubject} adalah...`, false, true)}
    ${makePara('A. Ribosom')}
    ${makePara('B. Mitokondria', true)}
    ${makePara('C. Lisosom')}
    ${makePara('D. Badan Golgi')}
    ${makePara('E. Retikulum Endoplasma')}
    ${makePara('2. Perhatikan tabel hasil pengamatan kerja enzim katalase berikut!', false, true)}
    ${makeTableXml(
      ['No', 'Perlakuan Suhu / pH', 'Gelembung Gas', 'Nyala Bara Api'],
      [
        ['1', 'Ekstrak Hati + H2O2 (Suhu 37°C, pH 7)', '+++ (Banyak)', 'Menyala Terang'],
        ['2', 'Ekstrak Hati + H2O2 (Suhu 60°C, pH 7)', '- (Tidak Ada)', 'Padam'],
        ['3', 'Ekstrak Hati + H2O2 (Suhu 37°C, pH 2)', '+ (Sedikit)', 'Redup']
      ]
    )}
    ${makePara('Berdasarkan tabel di atas, enzim katalase bekerja secara optimal pada kondisi...', false, false)}
    ${makePara('A. Suhu 37°C dan pH netral (7)', true)}
    ${makePara('B. Suhu tinggi 60°C dan pH netral (7)')}
    ${makePara('C. Suhu 37°C dan suasana asam (pH 2)')}
    ${makePara('D. Semua kondisi suhu dan derajat keasaman')}
    ${makePara('E. Suhu di atas 60°C tanpa H2O2')}
    ${makePara('3. Enzim yang dihasilkan oleh lambung dan berfungsi mengubah protein menjadi pepton adalah...', false, true)}
    ${makePara('A. Amilase')}
    ${makePara('B. Lipase')}
    ${makePara('C. Pepsin', true)}
    ${makePara('D. Tripsin')}
    ${makePara('E. Ptialin')}
  </w:body>
</w:document>`;

  const zipBytes = createUncompressedZip({
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': relsXml,
    'word/document.xml': documentXml,
  });

  const blob = new Blob([zipBytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = cleanSubject.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Mapel';
  link.href = url;
  link.download = `Template_Soal_Word_${safeName}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
