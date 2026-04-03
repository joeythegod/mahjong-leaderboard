/**
 * Mahjong Leaderboard — Google Apps Script Backend
 *
 * SETUP:
 * 1. Create a Google Sheet with a tab named "Scores"
 * 2. Add these headers in row 1 exactly: id | name | score | circles | date
 * 3. Open Extensions > Apps Script, paste this file as Code.gs
 * 4. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL into index.html as SCRIPT_URL
 * 6. Copy the Sheet URL into index.html as the href on #btn-sheet
 */

const SHEET_NAME = 'Scores';

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function doGet(e) {
  const action = (e.parameter.action || 'read');

  if (action === 'read') return getAllEntries();
  if (action === 'add')  return addEntry(e.parameter);

  return jsonResponse({ error: 'Unknown action' });
}

// ── Read ────────────────────────────────────────────────────────────

function getAllEntries() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse([]);

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const entries = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    obj.score   = Number(obj.score);
    obj.circles = Number(obj.circles);
    obj.id      = Number(obj.id);
    return obj;
  });
  return jsonResponse(entries);
}

// ── Add entry ───────────────────────────────────────────────────────

function addEntry(params) {
  const { name, score, circles, date } = params;
  if (!name || score === undefined || !circles || !date) {
    return jsonResponse({ error: 'Missing fields' });
  }
  const sheet = getSheet();
  const id = sheet.getLastRow(); // row 1 = headers, so first data row gets id=1
  sheet.appendRow([id, name, Number(score), Number(circles), date]);
  return jsonResponse({ ok: true, id, name, score: Number(score), circles: Number(circles), date });
}

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
