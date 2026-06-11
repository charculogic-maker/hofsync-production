/***** STEVES HOF - MASTER-SCRIPT V4.2 (Codex_Ultra-Speed Edition) *****/


const CFG = {
  SHEET_NAME: 'Formularantworten 6',
  STAMM_SHEET: 'Stammdaten',
  VPE_SHEET: 'VPE_Stammdaten',
  ARCHIVE_SHEET: 'Abgelaufen_Archiv',
  TZ: 'Europe/Berlin',
  RECIPIENTS: 'info@steveshof-hofladen.de, bestellung@steveshof-hofladen.de',
  DATE_FMT: 'dd.MM.yyyy',
  LOOKAHEAD_DAYS: 30,
  CACHE_SECONDS: 21600,

  // Feste Live-URL
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzzSzR4isL2meZGxsA5tMJ7ShPko47T6I7n_izcAWQ3FgIdajKaMUE2Nw_H9fu9H3RI/exec',


  LIMITS: {
    frische: 2,
    mopro: 5,
    kühlware: 3,
    standard: 5
  }
};


// ***************************************************************************
// 1. HAUPT-SCHNITTSTELLEN & WEB-OBERFLÄCHE (iPhone & Browser)
// ***************************************************************************


function doGet(e) {
  const html = getMobileHtmlTemplate();
  return HtmlService.createHtmlOutput(html)
    .setTitle("StevesHof - Mobiler Laufzettel")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}


function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CFG.SHEET_NAME);
    const rawData = JSON.parse(e.postData.contents || "{}");
    const action = rawData.action || "save";
    const scanBarcode = cleanBarcode(rawData.barcode);


    if (!scanBarcode || String(rawData.barcode || "").toLowerCase().includes("http") || String(rawData.barcode || "").length > 25) {
      return action === "checkName"
        ? responseJSON({ status: "error", name: "", marke: "" })
        : ContentService.createTextOutput("❌ Kein gültiger Barcode erkannt!").setMimeType(ContentService.MimeType.TEXT);
    }


    if (action === "checkName") {
      const info = lookupProductInfo(ss, scanBarcode);
      return responseJSON({ status: "success", name: info.name || "", marke: info.marke || "" });
    }


    if (action === "save") {
      const idx = getColumnIndexes(sh);
      const colCount = sh.getLastColumn();
      const newRow = new Array(colCount).fill("");
      const providedInfo = getProvidedProductInfo(rawData);
      let info = providedInfo;
      let shouldAddToStamm = Boolean(rawData.manualName);


      if (!info.name) {
        info = lookupProductInfo(ss, scanBarcode);
        shouldAddToStamm = false;
      }


      const name = info.name || "Unbekannt";
      const marke = rawData.marke || info.marke || "";
      const menge = parseFloat(String(rawData.menge).replace(',', '.')) || 1;


      if (name !== "Unbekannt" && shouldAddToStamm) {
        autoUpdateStammData(ss, scanBarcode, name, marke);
      }

      if (rawData.vpeBarcode && rawData.vpeInhalt) {
        autoUpdateVpeData(ss, rawData.vpeBarcode, name, marke, rawData.vpeInhalt, rawData.kategorie);
      }




      if (idx.id > -1) newRow[idx.id] = Utilities.getUuid().substring(0, 8);
      if (idx.zeitstempel > -1) newRow[idx.zeitstempel] = new Date();
      if (idx.barcode > -1) newRow[idx.barcode] = "'" + scanBarcode;
      if (idx.marke > -1) newRow[idx.marke] = marke;
      if (idx.produkt > -1) newRow[idx.produkt] = name;
      if (idx.mhd > -1) newRow[idx.mhd] = formatIsoDateToDe(rawData.mhd);
      if (idx.menge > -1) newRow[idx.menge] = menge;
      if (idx.kategorie > -1) newRow[idx.kategorie] = rawData.kategorie || "📦 Trockenware";


      const targetRow = Math.max(sh.getLastRow() + 1, 2);
      sh.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);


      return ContentService.createTextOutput("✅ Erfasst: " + name).setMimeType(ContentService.MimeType.TEXT);
    }


    return ContentService.createTextOutput("Unbekannte Aktion: " + action).setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Fehler: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}




// ***************************************************************************
// 2. BACKEND FUNCTIONS FÜR DIE MOBILE WEB-APP
// ***************************************************************************


function getActiveLaufzettelItems() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  let targetSheet = null;

  for (let s of sheets) {
    if (s.getName().startsWith("Frische_") || s.getName().startsWith("Laufzettel_")) {
      targetSheet = s;
      break;
    }
  }

  if (!targetSheet) return [];
  const data = targetSheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const items = [];
  for (let i = 1; i < data.length; i++) {
    items.push({
      rowNum: i + 1,
      sheetName: targetSheet.getName(),
      marke: data[i][0],
      produkt: data[i][1],
      menge: data[i][2],
      mhd: data[i][3] instanceof Date ? Utilities.formatDate(data[i][3], CFG.TZ, "dd.MM.yyyy") : data[i][3],
      tage: data[i][4],
      id: data[i][7]
    });
  }
  return items;
}


function saveMobileUpdates(updates) {
  const ss = SpreadsheetApp.getActive();
  const mainSh = ss.getSheetByName(CFG.SHEET_NAME);
  const mainData = mainSh.getDataRange().getValues();
  const idx = findColumns(mainData[0]);

  const map = {};
  for(let i = 1; i < mainData.length; i++) {
    map[String(mainData[i][idx.id])] = i + 1;
  }

  let count = 0;
  let targetSheetName = "";


  updates.forEach(up => {
    targetSheetName = up.sheetName;
    const mainRow = map[String(up.id)];
    if (mainRow) {
      if (up.verkauft) {
        mainSh.getRange(mainRow, idx.verkauft + 1).setValue(true);
        count++;
      } else if (up.korrektur !== "" && !isNaN(up.korrektur)) {
        mainSh.getRange(mainRow, idx.menge + 1).setValue(parseFloat(up.korrektur));
        count++;
      }
    }
  });

  if (targetSheetName !== "") {
    const tSh = ss.getSheetByName(targetSheetName);
    if (tSh) ss.deleteSheet(tSh);
  }

  return "Erfolgreich " + count + " Änderungen direkt im Sheet gespeichert! Der Laufzettel wurde archiviert.";
}


// ***************************************************************************
// 3. AUTOMATIK (Mail & Laufzettel-Generierung)
// ***************************************************************************


function sendeFrischeMoProMailDaily() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.SHEET_NAME);
  const values = sh.getDataRange().getValues();
  const idx = findColumns(values[0]);
  const today = new Date();
  today.setHours(0,0,0,0);
  const items = [];


  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (isVerkauftOrEmpty(row, idx)) continue;
    const katRaw = String(row[idx.kategorie] || "").toLowerCase();
    const isFrische = katRaw.includes("frische"), isMoPro = katRaw.includes("mopro"), isKuehl = katRaw.includes("kühlware");
    if (!isFrische && !isMoPro && !isKuehl) continue;

    const mhd = parseDate(row[idx.mhd]);
    if (!mhd) continue;
    const diff = Math.round((mhd - today) / (1000 * 60 * 60 * 24));

    let limit = CFG.LIMITS.standard;
    if (isFrische) limit = CFG.LIMITS.frische;
    else if (isKuehl) limit = CFG.LIMITS.kühlware;
    else if (isMoPro) limit = CFG.LIMITS.mopro;


    if (diff <= limit) items.push({ id: row[idx.id], marke: row[idx.marke], produkt: row[idx.produkt], menge: row[idx.menge], mhd: mhd, diff: diff, kat: row[idx.kategorie] });
  }


  if (items.length > 0) {
    items.sort((a, b) => a.diff - b.diff);
    erzeugeLaufzettelBlatt(ss, items, "Frische_");
    sendHtmlEmail(items, "Täglicher Frische-Check: " + items.length + " Artikel fällig");
  } else {
    MailApp.sendEmail({ to: CFG.RECIPIENTS, subject: "Frische-Check: Alles in Ordnung", htmlBody: "Keine fälligen Artikel gefunden." });
  }
}


function sendeMHDEMailWoechentlich() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(CFG.SHEET_NAME);
  const values = sh.getDataRange().getValues(), idx = findColumns(values[0]);
  const today = new Date(); today.setHours(0,0,0,0);
  const items = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (isVerkauftOrEmpty(row, idx)) continue;
    const mhd = parseDate(row[idx.mhd]);
    if (mhd) {
      const diff = Math.round((mhd - today) / (1000 * 60 * 60 * 24));
      if (diff <= CFG.LOOKAHEAD_DAYS) {
        items.push({ id: row[idx.id], marke: row[idx.marke], produkt: row[idx.produkt], menge: row[idx.menge], mhd: mhd, diff: diff });
      }
    }
  }
  if (items.length > 0) {
    items.sort((a, b) => a.diff - b.diff);
    erzeugeLaufzettelBlatt(ss, items, "Laufzettel_");
    sendHtmlEmail(items, "MHD Wochen-Report: " + items.length + " Artikel");
  }
}


// ***************************************************************************
// 4. HELPER, STAMMDATEN & SYNC
// ***************************************************************************


// Barcode-Lookup mit Cache: wiederholte Scans brauchen keine erneute Stammdaten-Suche
function lookupProductInfo(ss, barcode) {
  const cleanBC = cleanBarcode(barcode);
  const res = { name: "", marke: "" };
  if (cleanBC.length < 3) return res;


  const cache = CacheService.getScriptCache();
  const cacheKey = "product:" + cleanBC;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      cache.remove(cacheKey);
    }
  }


  const s = ss.getSheetByName(CFG.STAMM_SHEET);
  if (!s) return res;


  const lastRow = Math.max(s.getLastRow(), 1);
  const cell = s.getRange(1, 1, lastRow, 1)
    .createTextFinder(cleanBC)
    .matchEntireCell(true)
    .findNext();


  if (!cell) {
    cache.put(cacheKey, JSON.stringify(res), CFG.CACHE_SECONDS || 21600);
    return res;
  }


  const row = cell.getRow();
  const values = s.getRange(row, 1, 1, 3).getValues()[0];
  const found = { name: String(values[2] || ""), marke: String(values[1] || "") };
  cache.put(cacheKey, JSON.stringify(found), CFG.CACHE_SECONDS || 21600);
  return found;
}


function autoUpdateStammData(ss, barcode, name, marke) {
  const cleanBC = cleanBarcode(barcode);
  const s = ss.getSheetByName(CFG.STAMM_SHEET);
  if (!s || cleanBC.length < 3) return;
  s.appendRow(["'" + cleanBC, marke || "", name || ""]);
  CacheService.getScriptCache().put(
    "product:" + cleanBC,
    JSON.stringify({ name: String(name || ""), marke: String(marke || "") }),
    CFG.CACHE_SECONDS || 21600
  );
}

function autoUpdateVpeData(ss, barcode, name, marke, inhalt, kategorie) {
  const cleanBC = cleanBarcode(barcode);
  const packageSize = parseFloat(String(inhalt || '').replace(',', '.'));
  if (!cleanBC || cleanBC.length < 3 || !Number.isFinite(packageSize) || packageSize <= 1) return;

  let sheet = ss.getSheetByName(CFG.VPE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CFG.VPE_SHEET);
    sheet.getRange(1, 1, 1, 6).setValues([[
      'Barcode',
      'Marke',
      'Produkt',
      'VPE_Inhalt',
      'Kategorie',
      'Aktualisiert'
    ]]).setFontWeight('bold').setBackground('#eeeeee');
  }

  const lastRow = sheet.getLastRow();
  let targetRow = lastRow + 1;
  if (lastRow >= 2) {
    const barcodes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const matchIndex = barcodes.findIndex((row) => cleanBarcode(row[0]) === cleanBC);
    if (matchIndex >= 0) targetRow = matchIndex + 2;
  }

  sheet.getRange(targetRow, 1, 1, 6).setValues([[
    "'" + cleanBC,
    marke || '',
    name || '',
    packageSize,
    kategorie || '',
    new Date()
  ]]);
}


function cleanBarcode(barcode) {
  return String(barcode || "").trim().replace(/[^0-9]/g, '');
}


function getProvidedProductInfo(rawData) {
  const name = String(rawData.manualName || rawData.name || rawData.produkt || "").trim();
  const marke = String(rawData.marke || "").trim();
  return { name: name, marke: marke };
}


function getColumnIndexes(sheet) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "cols:" + sheet.getSheetId() + ":" + sheet.getLastColumn();
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);


  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = findColumns(head);
  cache.put(cacheKey, JSON.stringify(idx), CFG.CACHE_SECONDS || 21600);
  return idx;
}




function onOpen() {
  SpreadsheetApp.getUi().createMenu('StevesHof Tools')
      .addItem('Arbeitsliste abarbeiten (Sync)', 'syncLaufzettelToMain')
      .addSeparator()
      .addItem('Verkaufte Ware archivieren', 'archiviereVerkaufte')
      .addItem('Namen aus Stammdaten nachpflegen', 'fillNamesFromStammdaten')
      .addItem('Barcodes reparieren', 'bereinigeStammdaten')
      .addSeparator()
      .addItem('Frische-Check (Mail & Laufzettel) jetzt senden', 'sendeFrischeMoProMailDaily')
      .addItem('Wochen-Report senden', 'sendeMHDEMailWoechentlich')
      .addToUi();
}


function erzeugeLaufzettelBlatt(ss, items, prefix) {
  const name = prefix + Utilities.formatDate(new Date(), CFG.TZ, "yyyy-MM-dd");
  let sheet = ss.getSheetByName(name);
  if (sheet) sheet.clear(); else sheet = ss.insertSheet(name);
  const head = ["Marke", "Produkt", "Menge", "MHD", "Resttage", "KORREKTUR", "VERKAUFT", "ID"];
  sheet.getRange(1,1,1,8).setValues([head]).setFontWeight("bold").setBackground("#eeeeee");
  const rows = items.map(it => [it.marke, it.produkt, it.menge, it.mhd, it.diff, "", false, it.id]);
  sheet.getRange(2,1,rows.length, 8).setValues(rows);
  sheet.getRange(2,4,rows.length, 1).setNumberFormat("dd.MM.yyyy");
  sheet.getRange(2,7,rows.length, 1).insertCheckboxes();
  sheet.hideColumns(8);
}


function sendHtmlEmail(items, subject) {
  const webAppUrl = CFG.WEB_APP_URL;
  let html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2e7d32;">${subject}</h2>

    <div style="margin: 20px 0; text-align: center;">
      <a href="${webAppUrl}" target="_blank" style="background-color: #2e7d32; color: white; padding: 15px 25px; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        📱 Laufzettel direkt am Handy abarbeiten
      </a>
    </div>
    <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;">

    <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
    <tr style="background: #f2f2f2;"><th>Marke</th><th>Produkt</th><th>Menge</th><th>MHD</th><th>Tage</th></tr>`;
  items.forEach(it => {
    let color = it.diff < 0 ? "#ff9999" : (it.diff < 3 ? "#ffcccc" : "#fff4cc");
    html += `<tr style="background: ${color};"><td>${it.marke}</td><td>${it.produkt}</td><td>${it.menge}</td><td>${Utilities.formatDate(it.mhd, CFG.TZ, "dd.MM.yyyy")}</td><td>${it.diff}</td></tr>`;
  });
  html += `</table><p><a href="${SpreadsheetApp.getActive().getUrl()}">Zum Google Sheet am PC</a></p></div>`;
  MailApp.sendEmail({ to: CFG.RECIPIENTS, subject: subject, htmlBody: html });
}


function findColumns(headers) {
  if (!headers) return null;
  const h = headers.map(v => String(v).toLowerCase().trim());
  const find = (keys) => {
    for (let k of keys) {
      let i = h.indexOf(k); if (i > -1) return i;
      i = h.findIndex(val => val.includes(k)); if (i > -1) return i;
    }
    return -1;
  };
  return {
    id: find(['id']),
    zeitstempel: find(['zeitstempel', 'timestamp']),
    barcode: find(['barcode', 'ean']),
    marke: find(['marke']),
    produkt: find(['produktname', 'produkt', 'artikel']),
    mhd: find(['mhd', 'datum', 'haltbar']),
    menge: find(['menge', 'anzahl']),
    verkauft: find(['verkauft', 'abverkauft', 'status']),
    kategorie: find(['kategorie', 'gruppe', 'warengruppe'])
  };
}


function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  const parts = s.split('.');
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  const iso = s.split('-');
  if (iso.length === 3) return new Date(iso[0], iso[1] - 1, iso[2]);
  return null;
}


function formatIsoDateToDe(isoStr) {
  if (!isoStr || String(isoStr).includes('.')) return isoStr;
  const p = String(isoStr).split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : isoStr;
}


function isVerkauftOrEmpty(row, idx) {
  const sold = String(row[idx.verkauft] || "").toLowerCase();
  const menge = parseFloat(row[idx.menge]);
  return (sold === 'true' || sold === 'wahr' || menge <= 0 || isNaN(menge));
}


function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


function syncLaufzettelToMain() {
  const ss = SpreadsheetApp.getActive(), src = ss.getActiveSheet(), tgt = ss.getSheetByName(CFG.SHEET_NAME);
  if (!src.getName().startsWith("Frische_") && !src.getName().startsWith("Laufzettel_")) {
    SpreadsheetApp.getUi().alert("Bitte Laufzettel-Blatt öffnen."); return;
  }
  const dat = src.getDataRange().getValues(), mainD = tgt.getDataRange().getValues(), idx = findColumns(mainD[0]);
  const map = {};
  for(let i=1; i<mainD.length; i++) { map[String(mainD[i][idx.id])] = i + 1; }
  let count = 0;
  for(let i=1; i<dat.length; i++) {
    const id = dat[i][7], sold = dat[i][6], korr = dat[i][5], targetRow = map[String(id)];
    if (!targetRow) continue;
    if (sold === true) { tgt.getRange(targetRow, idx.verkauft + 1).setValue(true); count++; }
    else if (korr !== "" && !isNaN(korr)) { tgt.getRange(targetRow, idx.menge + 1).setValue(korr); count++; }
  }
  SpreadsheetApp.getUi().alert(count + " Änderungen übernommen.");
}


function archiviereVerkaufte() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(CFG.SHEET_NAME);
  const archive = ss.getSheetByName(CFG.ARCHIVE_SHEET) || ss.insertSheet(CFG.ARCHIVE_SHEET);
  const data = sh.getDataRange().getValues(), idx = findColumns(data[0]), rowsToKeep = [data[0]];
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (isVerkauftOrEmpty(data[i], idx)) { archive.appendRow(data[i]); count++; }
    else rowsToKeep.push(data[i]);
  }
  sh.clear().getRange(1, 1, rowsToKeep.length, rowsToKeep[0].length).setValues(rowsToKeep);
  SpreadsheetApp.getUi().alert(count + " Zeilen archiviert.");
}


function fillNamesFromStammdaten() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(CFG.SHEET_NAME);
  const data = sh.getDataRange().getValues(), idx = findColumns(data[0]);
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][idx.produkt] || data[i][idx.produkt] === "Unbekannt") {
      const info = lookupProductInfo(ss, String(data[i][idx.barcode]));
      if (info.name) { sh.getRange(i + 1, idx.produkt + 1).setValue(info.name); sh.getRange(i + 1, idx.marke + 1).setValue(info.marke); count++; }
    }
  }
  SpreadsheetApp.getUi().alert(count + " Namen korrigiert.");
}


function bereinigeStammdaten() {
  const ss = SpreadsheetApp.getActive();
  let count = 0;
  const s = ss.getSheetByName(CFG.STAMM_SHEET); if (!s) return;
  const d = s.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    const orig = String(d[i][0]), clean = orig.replace(/[^0-9]/g, '');
    if (orig !== clean && orig !== "'" + clean) { s.getRange(i+1, 1).setValue("'" + clean); count++; }
  }
  SpreadsheetApp.getUi().alert(count + " Barcodes bereinigt.");
}


function getMobileHtmlTemplate() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f7; margin: 0; padding: 15px; color: #333; }
      .header { text-align: center; margin-bottom: 20px; padding: 10px; background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
      h1 { color: #2e7d32; margin: 5px 0; font-size: 22px; }
      .card { background: white; border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: 0 3px 6px rgba(0,0,0,0.05); border-left: 6px solid #4caf50; position: relative; }
      .card.critical { border-left-color: #f44336; background-color: #fff8f8; }
      .card.warning { border-left-color: #ff9800; background-color: #fffdf5; }
      .card.sold-out { opacity: 0.4; border-left-color: #9e9e9e; background-color: #eaeaea; }
      .title { font-weight: bold; font-size: 16px; margin-bottom: 4px; color: #111; }
      .subtitle { font-size: 13px; color: #666; margin-bottom: 12px; }
      .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; color: white; background: #9e9e9e; }
      .badge.red { background: #f44336; }
      .badge.orange { background: #ff9800; }
      .controls { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
      .btn-sold { padding: 10px 16px; border-radius: 8px; border: 2px solid #f44336; background: white; color: #f44336; font-weight: bold; font-size: 13px; cursor: pointer; transition: all 0.2s; }
      .btn-sold.active { background: #f44336; color: white; }
      .qty-picker { display: flex; align-items: center; background: #f1f3f4; border-radius: 8px; padding: 2px; }
      .qty-btn { width: 36px; height: 36px; border: none; background: white; border-radius: 6px; font-size: 18px; font-weight: bold; color: #2e7d32; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .qty-val { width: 40px; text-align: center; font-weight: bold; font-size: 15px; border: none; background: transparent; }
      .save-bar { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.95); padding: 15px; box-shadow: 0 -4px 10px rgba(0,0,0,0.08); text-align: center; backdrop-filter: blur(10px); }
      .btn-save { background: #2e7d32; color: white; border: none; padding: 14px 40px; font-size: 16px; font-weight: bold; border-radius: 10px; width: 85%; box-shadow: 0 4px 6px rgba(46,125,50,0.2); }
      .empty-state { text-align: center; padding: 40px 20px; color: #777; font-size: 16px; }
      .loading { text-align: center; padding: 5px; font-weight: bold; color: #2e7d32; }
    </style>
    <script>
      let itemsData = [];

      function loadItems() {
        document.getElementById('list').innerHTML = '<div class="loading">⏳ Lade aktuellen Laufzettel...</div>';
        google.script.run.withSuccessHandler(renderItems).getActiveLaufzettelItems();
      }

      function renderItems(items) {
        itemsData = items;
        const container = document.getElementById('list');
        if (items.length === 0) {
          container.innerHTML = '<div class="empty-state">🎉 Kein aktiver Laufzettel vorhanden!<br><small>Alle Artikel wurden bereits bearbeitet oder es stehen keine Mails aus.</small></div>';
          document.getElementById('save-container').style.display = 'none';
          return;
        }

        let html = '';
        items.forEach((it, index) => {
          let cssClass = '';
          let badgeColor = 'gray';
          let txtTage = it.tage + ' Tage';

          if (it.tage < 0) { cssClass = 'critical'; badgeColor = 'red'; txtTage = 'Abgelaufen!'; }
          else if (it.tage <= 2) { cssClass = 'warning'; badgeColor = 'orange'; }

          html += \`
            <div class="card \${cssClass}" id="card-\${index}">
              <div class="title">\${it.produkt}</div>
              <div class="subtitle">\${it.marke || 'StevesHof'} &middot; MHD: \${it.mhd}</div>
              <div><span class="badge \${badgeColor}">\${txtTage}</span></div>

              <div class="controls">
                <button class="btn-sold" id="sold-\${index}" onclick="toggleSold(\${index})">🗑️ Ausverkauft</button>
                <div class="qty-picker" id="qty-container-\${index}">
                  <button class="qty-btn" onclick="adjustQty(\${index}, -1)">-</button>
                  <input type="number" class="qty-val" id="qty-\${index}" value="\${it.menge}" readonly />
                  <button class="qty-btn" onclick="adjustQty(\${index}, 1)">+</button>
                </div>
              </div>
            </div>
          \`;
        });
        container.innerHTML = html;
        document.getElementById('save-container').style.display = 'block';
      }

      function toggleSold(index) {
        const item = itemsData[index];
        item.verkauft = !item.verkauft;

        const card = document.getElementById('card-' + index);
        const btn = document.getElementById('sold-' + index);

        if (item.verkauft) {
          card.classList.add('sold-out');
          btn.classList.add('active');
          btn.innerText = '✓ Ausverkauft';
        } else {
          card.classList.remove('sold-out');
          btn.classList.remove('active');
          btn.innerText = '🗑️ Ausverkauft';
        }
      }

      function adjustQty(index, change) {
        const input = document.getElementById('qty-' + index);
        let val = parseFloat(input.value) + change;
        if (val < 0) val = 0;
        input.value = val;
        itemsData[index].korrektur = val;
      }

      function sendData() {
        const btn = document.getElementById('save-btn');
        btn.disabled = true;
        btn.innerText = '⌛ Speichere im Sheet...';

        google.script.run.withSuccessHandler(function(res) {
          alert(res);
          loadItems();
        }).saveMobileUpdates(itemsData);
      }

      window.onload = loadItems;
    </script>
  </head>
  <body>
    <div class="header">
      <h1>StevesHof Laden-Laufzettel</h1>
      <div style="font-size:12px; color:#666;">Direkte Regal-Synchronisierung v4.1</div>
    </div>

    <div id="list" style="margin-bottom: 90px;"></div>

    <div class="save-bar" id="save-container" style="display:none;">
      <button class="btn-save" id="save-btn" onclick="sendData()">💾 Änderungen speichern</button>
    </div>
  </body>
  </html>
  `;
}


// ***************************************************************************
// 5. NIGHTLY FIRESTORE MIRROR-SYNC (Google Sheet -> Firebase)
// ***************************************************************************

const FIRESTORE_SYNC_CFG = {
  PROJECT_ID: 'hofsync-production',
  TENANT_ID: 'StevesHof_Hauptbetrieb',
  COLLECTION_PATH: 'tenants/StevesHof_Hauptbetrieb/mhd_liste',
  PAGE_SIZE: 300,
  WRITE_CHUNK_SIZE: 80,
  DELETE_CHUNK_SIZE: 80
};


/**
 * Zeitgesteuerter Nacht-Sync:
 * Spiegelt den aktuellen MHD-Sheetbestand vollständig nach Firestore.
 *
 * Zielpfad:
 * tenants/StevesHof_Hauptbetrieb/mhd_liste/{ean}
 *
 * Wichtig: Vor dem Upload wird die Zielkollektion vollständig geleert.
 * Dadurch verschwinden im Sheet gelöschte Artikel beim nächsten Sync auch aus der App.
 */
function syncToFirestore() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CFG.SHEET_NAME) || ss.getActiveSheet() || ss.getSheets()[0];
  if (!sh) throw new Error('Kein Tabellenblatt für den Firestore-Sync gefunden.');

  const data = sh.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('syncToFirestore(): Keine Datenzeilen gefunden. Firestore wird trotzdem bereinigt.');
    clearFirestoreMhdCollection_();
    return;
  }

  const headers = data[0];
  const idx = buildMhdSyncIndexes_(headers);
  if (idx.barcode < 0) throw new Error('syncToFirestore(): Keine Barcode/EAN-Spalte gefunden.');

  clearFirestoreMhdCollection_();

  const docs = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ean = cleanBarcode(row[idx.barcode]);
    if (!ean || ean.length < 3) continue;

    const produkt = readCell_(row, idx.produkt) || readCell_(row, idx.oldProdukt) || 'Unbekannt';
    if (!produkt || produkt === 'Unbekannt') continue;

    const mhdDate = parseDate(readCell_(row, idx.mhd));
    const menge = parseFloat(String(readCell_(row, idx.menge)).replace(',', '.')) || 0;
    const soldRaw = String(readCell_(row, idx.verkauft)).toLowerCase();
    const soldOut = soldRaw === 'true' || soldRaw === 'wahr' || soldRaw === 'ja' || soldRaw === 'x';
    const resttage = mhdDate ? Math.round((mhdDate - today) / (1000 * 60 * 60 * 24)) : null;

    docs.push({
      docId: ean,
      fields: {
        id: ean,
        ean: ean,
        barcode: ean,
        marke: readCell_(row, idx.marke) || readCell_(row, idx.oldMarke) || '',
        produkt: produkt,
        name: produkt,
        mhd: mhdDate ? Utilities.formatDate(mhdDate, CFG.TZ, 'yyyy-MM-dd') : '',
        mhdText: mhdDate ? Utilities.formatDate(mhdDate, CFG.TZ, CFG.DATE_FMT) : '',
        mhdTimestamp: mhdDate || null,
        menge: menge,
        qty: menge,
        charge: readCell_(row, idx.charge),
        kategorie: normalizeMhdSyncCategory_(readCell_(row, idx.kategorie)),
        sonderflaeche: readCell_(row, idx.sonderflaeche),
        soldOut: soldOut,
        status: soldOut ? 'sold' : 'aktiv',
        tage: resttage,
        resttage: resttage,
        source: 'google-sheet-nightly-sync',
        sheetName: sh.getName(),
        rowNumber: i + 1,
        syncedAt: new Date()
      }
    });
  }

  writeFirestoreMhdDocuments_(docs);
  Logger.log('syncToFirestore(): ' + docs.length + ' MHD-Dokumente nach Firestore gespiegelt.');
}


function buildMhdSyncIndexes_(headers) {
  const base = findColumns(headers);
  return {
    id: base.id,
    barcode: base.barcode,
    marke: base.marke,
    produkt: base.produkt,
    mhd: base.mhd,
    menge: base.menge,
    verkauft: base.verkauft,
    kategorie: base.kategorie,
    oldMarke: findHeaderIndex_(headers, ['old_marke', 'alte marke']),
    oldProdukt: findHeaderIndex_(headers, ['old_produktname', 'old produktname', 'alter produktname']),
    charge: findHeaderIndex_(headers, ['charge', 'chargenummer', 'chargen-nummer', 'chargen nr', 'batch']),
    sonderflaeche: findHeaderIndex_(headers, ['sonderfläche', 'sonderflaeche', 'aktionsfläche', 'aktionsflaeche', 'platzierung'])
  };
}


function findHeaderIndex_(headers, keys) {
  const normalizedHeaders = headers.map(v => normalizeHeader_(v));
  for (let key of keys) {
    const normalizedKey = normalizeHeader_(key);
    let idx = normalizedHeaders.indexOf(normalizedKey);
    if (idx > -1) return idx;
    idx = normalizedHeaders.findIndex(h => h.includes(normalizedKey));
    if (idx > -1) return idx;
  }
  return -1;
}


function normalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ');
}


function readCell_(row, index) {
  if (index == null || index < 0) return '';
  const value = row[index];
  if (value instanceof Date) return value;
  return String(value || '').trim();
}


function normalizeMhdSyncCategory_(value) {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (lower.includes('trocken')) return '📦 Trockenware';
  if (lower.includes('kühl') || lower.includes('kuehl')) return '🥗 Kühlware';
  if (lower.includes('mopro') || lower.includes('milch') || lower.includes('frische')) return '🥛MoPro';
  return raw || '🥛MoPro';
}


function firestoreBaseUrl_() {
  return 'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(FIRESTORE_SYNC_CFG.PROJECT_ID) +
    '/databases/(default)/documents/' +
    FIRESTORE_SYNC_CFG.COLLECTION_PATH;
}


function firestoreAuthHeaders_() {
  return {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
  };
}


function clearFirestoreMhdCollection_() {
  let pageToken = '';
  let deleteCount = 0;

  do {
    const url = firestoreBaseUrl_() +
      '?pageSize=' + FIRESTORE_SYNC_CFG.PAGE_SIZE +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: firestoreAuthHeaders_(),
      muteHttpExceptions: true
    });

    assertFirestoreResponse_(response, 'Firestore-Liste konnte nicht gelesen werden');
    const payload = JSON.parse(response.getContentText() || '{}');
    const documents = payload.documents || [];
    const requests = documents.map(doc => ({
      url: 'https://firestore.googleapis.com/v1/' + doc.name,
      method: 'delete',
      headers: firestoreAuthHeaders_(),
      muteHttpExceptions: true
    }));

    runFirestoreFetchAll_(requests, FIRESTORE_SYNC_CFG.DELETE_CHUNK_SIZE, 'Firestore-Dokument konnte nicht gelöscht werden');
    deleteCount += requests.length;
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  Logger.log('clearFirestoreMhdCollection_(): ' + deleteCount + ' alte Dokumente gelöscht.');
}


function writeFirestoreMhdDocuments_(docs) {
  const requests = docs.map(doc => ({
    url: firestoreBaseUrl_() + '/' + encodeURIComponent(doc.docId),
    method: 'patch',
    contentType: 'application/json',
    headers: firestoreAuthHeaders_(),
    payload: JSON.stringify({ fields: toFirestoreFields_(doc.fields) }),
    muteHttpExceptions: true
  }));

  runFirestoreFetchAll_(requests, FIRESTORE_SYNC_CFG.WRITE_CHUNK_SIZE, 'Firestore-Dokument konnte nicht geschrieben werden');
}


function runFirestoreFetchAll_(requests, chunkSize, errorPrefix) {
  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const responses = UrlFetchApp.fetchAll(chunk);
    responses.forEach(response => assertFirestoreResponse_(response, errorPrefix));
  }
}


function assertFirestoreResponse_(response, message) {
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) return;
  throw new Error(message + ': HTTP ' + code + ' - ' + response.getContentText());
}


function toFirestoreFields_(obj) {
  const fields = {};
  Object.keys(obj).forEach(key => {
    fields[key] = toFirestoreValue_(obj[key]);
  });
  return fields;
}


function toFirestoreValue_(value) {
  if (value === null || value === undefined || value === '') return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue_) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields_(value) } };
  }
  return { stringValue: String(value) };
}
