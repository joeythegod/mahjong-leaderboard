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
  return jsonResponse({ error: 'Unknown action' });
}

// POST: { action: 'add', date: 'YYYY-MM-DD', circles: 8, players: [{name, score}] }
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'add') return addSession(data);
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
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

// ── Add session (wide format: one row per game session) ─────────────

function addSession(data) {
  const { date, circles, players } = data;
  if (!date || !players || !players.length) return jsonResponse({ error: 'Missing fields' });

  const sheet = getSheet();
  const lastCol = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
                        .map(h => String(h).trim());

  // Convert YYYY-MM-DD → M/D to match sheet format
  const [, month, day] = date.split('-');
  const dateLabel = `${parseInt(month)}/${parseInt(day)}`;

  // Build row: default all player columns to '-'
  const row = new Array(headerRow.length).fill('-');
  row[0] = dateLabel;
  row[1] = Number(circles) || 1;

  for (const { name, score } of players) {
    const col = headerRow.findIndex(h => h === String(name).trim());
    if (col >= 0) row[col] = Number(score);
  }

  // Zero out the sum column
  const sumCol = headerRow.findIndex(h => h.toLowerCase() === 'sum');
  if (sumCol >= 0) row[sumCol] = 0;

  sheet.appendRow(row);
  return jsonResponse({ ok: true });
}

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
