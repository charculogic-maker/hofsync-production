import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCES = [
  {
    key: 'kochwurst',
    category: 'Kochwurst',
    path: 'C:/Users/rehmp/.gemini/BEFFE-Vorlagen/20 BEFFE-Kochwurst Mai. 2024.xls',
  },
  {
    key: 'bruehwurst',
    category: 'Bruehwurst',
    path: 'C:/Users/rehmp/.gemini/BEFFE-Vorlagen/20 Rehm BEFFE-Brühwurst Mai. 2024.xls',
  },
];

function sectorOffset(sector, sectorSize) {
  return 512 + sector * sectorSize;
}

function readCompoundFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const sectorSize = 1 << buffer.readUInt16LE(30);
  const miniSectorSize = 1 << buffer.readUInt16LE(32);
  const fatSectorCount = buffer.readUInt32LE(44);
  const firstDirectorySector = buffer.readInt32LE(48);
  const miniStreamCutoff = buffer.readUInt32LE(56);
  const firstMiniFatSector = buffer.readInt32LE(60);
  const miniFatSectorCount = buffer.readUInt32LE(64);

  const difat = [];
  for (let index = 0; index < 109; index += 1) {
    const sector = buffer.readInt32LE(76 + index * 4);
    if (sector >= 0) difat.push(sector);
  }

  const fat = [];
  for (const sector of difat.slice(0, fatSectorCount)) {
    const offset = sectorOffset(sector, sectorSize);
    for (let cursor = 0; cursor < sectorSize; cursor += 4) {
      fat.push(buffer.readInt32LE(offset + cursor));
    }
  }

  function chain(start) {
    const sectors = [];
    let sector = start;
    let guard = 0;
    while (sector >= 0 && sector !== 0xfffffffe && guard < 10000) {
      sectors.push(sector);
      sector = fat[sector];
      guard += 1;
    }
    return sectors;
  }

  function readRegularStream(start, size) {
    const parts = chain(start).map((sector) => {
      const offset = sectorOffset(sector, sectorSize);
      return buffer.subarray(offset, offset + sectorSize);
    });
    return Buffer.concat(parts).subarray(0, size);
  }

  const directory = Buffer.concat(
    chain(firstDirectorySector).map((sector) => {
      const offset = sectorOffset(sector, sectorSize);
      return buffer.subarray(offset, offset + sectorSize);
    }),
  );

  const entries = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = directory.readUInt16LE(offset + 64);
    if (nameLength < 2) continue;
    entries.push({
      name: directory.subarray(offset, offset + nameLength - 2).toString('utf16le'),
      type: directory[offset + 66],
      start: directory.readInt32LE(offset + 116),
      size: Number(directory.readBigUInt64LE(offset + 120)),
    });
  }

  const root = entries.find((entry) => entry.type === 5);
  const miniStream = root ? readRegularStream(root.start, root.size) : Buffer.alloc(0);
  const miniFat = [];
  for (const sector of chain(firstMiniFatSector).slice(0, miniFatSectorCount)) {
    const offset = sectorOffset(sector, sectorSize);
    for (let cursor = 0; cursor < sectorSize; cursor += 4) {
      miniFat.push(buffer.readInt32LE(offset + cursor));
    }
  }

  function readMiniStream(start, size) {
    const parts = [];
    let sector = start;
    let guard = 0;
    while (sector >= 0 && sector !== 0xfffffffe && guard < 100000) {
      const offset = sector * miniSectorSize;
      parts.push(miniStream.subarray(offset, offset + miniSectorSize));
      sector = miniFat[sector];
      guard += 1;
    }
    return Buffer.concat(parts).subarray(0, size);
  }

  return {
    getStream(name) {
      const entry = entries.find((item) => item.name === name);
      if (!entry) return null;
      if (entry.type === 2 && entry.size < miniStreamCutoff) {
        return readMiniStream(entry.start, entry.size);
      }
      return readRegularStream(entry.start, entry.size);
    },
  };
}

function parseUnicodeString(buffer, offset) {
  const length = buffer.readUInt16LE(offset);
  let cursor = offset + 2;
  const flags = buffer[cursor];
  cursor += 1;
  const isUtf16 = Boolean(flags & 1);
  const hasRichText = Boolean(flags & 8);
  const hasExtended = Boolean(flags & 4);
  if (hasRichText) cursor += 2;
  if (hasExtended) cursor += 4;
  const byteLength = isUtf16 ? length * 2 : length;
  const value = buffer.subarray(cursor, cursor + byteLength).toString(isUtf16 ? 'utf16le' : 'latin1');
  return { value, next: cursor + byteLength };
}

function decodeRk(value) {
  const divideBy100 = value & 1;
  const isInteger = value & 2;
  let number;
  if (isInteger) {
    number = value >> 2;
  } else {
    const tmp = Buffer.alloc(8);
    tmp.writeUInt32LE(0, 0);
    tmp.writeUInt32LE(value & 0xfffffffc, 4);
    number = tmp.readDoubleLE(0);
  }
  return divideBy100 ? number / 100 : number;
}

function parseWorkbook(buffer) {
  const sheets = [];
  const sharedStrings = [];
  const cellsBySheet = [];
  let activeSheet = null;

  for (let cursor = 0; cursor + 4 <= buffer.length;) {
    const opcode = buffer.readUInt16LE(cursor);
    const length = buffer.readUInt16LE(cursor + 2);
    const dataStart = cursor + 4;
    const dataEnd = dataStart + length;
    if (dataEnd > buffer.length) break;

    if (opcode === 0x0085) {
      const sheetOffset = buffer.readUInt32LE(dataStart);
      const nameLength = buffer[dataStart + 6];
      const flags = buffer[dataStart + 7];
      const nameStart = dataStart + 8;
      const name = (flags & 1)
        ? buffer.subarray(nameStart, nameStart + nameLength * 2).toString('utf16le')
        : buffer.subarray(nameStart, nameStart + nameLength).toString('latin1');
      sheets.push({ name, offset: sheetOffset });
      cellsBySheet.push([]);
    } else if (opcode === 0x00fc) {
      let stringCursor = dataStart + 8;
      const uniqueCount = buffer.readUInt32LE(dataStart + 4);
      for (let index = 0; index < uniqueCount && stringCursor < dataEnd; index += 1) {
        const parsed = parseUnicodeString(buffer, stringCursor);
        sharedStrings.push(parsed.value);
        stringCursor = parsed.next;
      }
    } else if (opcode === 0x0809) {
      const index = sheets.findIndex((sheet) => sheet.offset === cursor);
      if (index >= 0) activeSheet = index;
    } else if (activeSheet !== null) {
      const target = cellsBySheet[activeSheet];
      if (opcode === 0x00fd) {
        target.push({
          row: buffer.readUInt16LE(dataStart),
          col: buffer.readUInt16LE(dataStart + 2),
          value: sharedStrings[buffer.readUInt32LE(dataStart + 6)] ?? '',
        });
      } else if (opcode === 0x0203) {
        target.push({
          row: buffer.readUInt16LE(dataStart),
          col: buffer.readUInt16LE(dataStart + 2),
          value: buffer.readDoubleLE(dataStart + 6),
        });
      } else if (opcode === 0x027e) {
        target.push({
          row: buffer.readUInt16LE(dataStart),
          col: buffer.readUInt16LE(dataStart + 2),
          value: decodeRk(buffer.readInt32LE(dataStart + 6)),
        });
      } else if (opcode === 0x00bd) {
        const row = buffer.readUInt16LE(dataStart);
        const firstCol = buffer.readUInt16LE(dataStart + 2);
        const lastCol = buffer.readUInt16LE(dataEnd - 2);
        let itemCursor = dataStart + 4;
        for (let col = firstCol; col <= lastCol; col += 1) {
          if (itemCursor + 6 <= dataEnd - 2) {
            target.push({ row, col, value: decodeRk(buffer.readInt32LE(itemCursor + 2)) });
          }
          itemCursor += 6;
        }
      } else if (opcode === 0x0204) {
        const length8 = buffer.readUInt16LE(dataStart + 6);
        target.push({
          row: buffer.readUInt16LE(dataStart),
          col: buffer.readUInt16LE(dataStart + 2),
          value: buffer.subarray(dataStart + 8, dataStart + 8 + length8).toString('latin1'),
        });
      } else if (opcode === 0x0006) {
        const value = buffer.readDoubleLE(dataStart + 6);
        if (Number.isFinite(value)) {
          target.push({
            row: buffer.readUInt16LE(dataStart),
            col: buffer.readUInt16LE(dataStart + 2),
            value,
          });
        }
      }
    }

    cursor = dataEnd;
  }

  return sheets.map((sheet, index) => ({ name: sheet.name, cells: cellsBySheet[index] }));
}

function rowsFromSheet(sheet) {
  const rows = new Map();
  for (const cell of sheet.cells) {
    if (!rows.has(cell.row)) rows.set(cell.row, {});
    rows.get(cell.row)[cell.col] = cell.value;
  }
  return rows;
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asPercent(value) {
  const number = asNumber(value);
  return number ? number * 100 : 0;
}

function formatNumber(value) {
  if (typeof value !== 'number') return value;
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(6)).toString();
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const header = Object.keys(rows[0] ?? {});
  const content = [
    header.join(','),
    ...rows.map((row) => header.map((key) => csvValue(formatNumber(row[key]))).join(',')),
  ].join('\n');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${content}\n`, 'utf8');
}

const materialRows = [];
const recipeRows = [];

for (const source of SOURCES) {
  const compoundFile = readCompoundFile(source.path);
  const workbook = compoundFile.getStream('Workbook') ?? compoundFile.getStream('Book');
  if (!workbook) throw new Error(`Keine Workbook-Daten gefunden: ${source.path}`);

  const sheets = parseWorkbook(workbook);
  const priceRows = rowsFromSheet(sheets.find((sheet) => sheet.name === 'Preisliste'));
  const materialByNumber = new Map();
  const analysisByNumber = new Map();

  for (const sheet of sheets.filter((item) => item.name !== 'Preisliste')) {
    const rows = rowsFromSheet(sheet);
    for (const [rowIndex, row] of [...rows.entries()].sort(([a], [b]) => a - b)) {
      if (rowIndex < 3 || rowIndex > 24) continue;
      const materialNumber = asNumber(row[0]);
      if (!materialNumber || analysisByNumber.has(materialNumber)) continue;
      analysisByNumber.set(materialNumber, {
        wasser: asPercent(row[5]),
        beffe: asPercent(row[7]),
        be: asPercent(row[9]),
        fett: asPercent(row[11]),
      });
    }
  }

  for (const [rowIndex, row] of [...priceRows.entries()].sort(([a], [b]) => a - b)) {
    if (rowIndex === 0) continue;
    const materialNumber = asNumber(row[0]);
    if (!materialNumber) continue;
    const material = clean(row[1]);
    const price = asNumber(row[2]);
    const analysis = analysisByNumber.get(materialNumber) ?? {};
    materialByNumber.set(materialNumber, material);
    materialRows.push({
      Quelle: source.key,
      Kategorie: source.category,
      MaterialNr: materialNumber,
      Material: material,
      Preis_kg: price,
      Wasser_Prozent: analysis.wasser ?? '',
      BEFFE_Prozent: analysis.beffe ?? '',
      BE_Prozent: analysis.be ?? '',
      Fett_Prozent: analysis.fett ?? '',
    });
  }

  for (const sheet of sheets.filter((item) => item.name !== 'Preisliste')) {
    const rows = rowsFromSheet(sheet);
    for (const [rowIndex, row] of [...rows.entries()].sort(([a], [b]) => a - b)) {
      if (rowIndex < 3 || rowIndex > 24) continue;
      const materialNumber = asNumber(row[0]);
      const amountKg = asNumber(row[3]);
      const material = clean(row[1]) || materialByNumber.get(materialNumber) || '';
      if (!materialNumber || !material) continue;

      recipeRows.push({
        Quelle: source.key,
        Kategorie: source.category,
        Rezept: sheet.name,
        Zeile: rowIndex + 1,
        MaterialNr: materialNumber,
        Material: material,
        Menge_kg: amountKg,
        Anteil_Prozent: asPercent(row[4]),
        Wasser_Prozent: asPercent(row[5]),
        Wasser_kg: asNumber(row[6]),
        BEFFE_Prozent: asPercent(row[7]),
        BEFFE_kg: asNumber(row[8]),
        BE_Prozent: asPercent(row[9]),
        BE_kg: asNumber(row[10]),
        Fett_Prozent: asPercent(row[11]),
        Fett_kg: asNumber(row[12]),
        Preis_kg: asNumber(row[14]),
        Kosten: asNumber(row[15]),
        Aktiv: amountKg > 0 ? 'TRUE' : 'FALSE',
      });
    }
  }
}

writeCsv(path.join(ROOT, 'data', 'beffe_rohstoffe.csv'), materialRows);
writeCsv(path.join(ROOT, 'data', 'beffe_rezepte.csv'), recipeRows);

console.log(`BEFFE-Rohstoffe: ${materialRows.length}`);
console.log(`BEFFE-Rezeptpositionen: ${recipeRows.length}`);
