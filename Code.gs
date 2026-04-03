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

const SHEET_NAME = 'dashboard_src';

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function doGet(e) {
  const action = (e.parameter.action || 'read');
  if (action === 'debug') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets().map(s => s.getName());
    return jsonResponse({ spreadsheetName: ss.getName(), sheets });
  }
  if (action === 'read') return getAllEntries();
  if (action === 'add') {
    try {
      const players = JSON.parse(e.parameter.players || '[]');
      return addSession({ date: e.parameter.date, circles: e.parameter.circles, players });
    } catch (err) {
      return jsonResponse({ error: err.message });
    }
  }
  return jsonResponse({ error: 'Unknown action' });
}

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

  // Add a new column for any player name not yet in the header row
  for (const { name } of players) {
    const trimmedName = String(name).trim();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
    if (!headers.some(h => h === trimmedName)) {
      const sumIdx = headers.findIndex(h => h.toLowerCase() === 'sum');
      if (sumIdx >= 0) {
        // Insert before the Sum column (sumIdx is 0-based → 1-based = sumIdx+1)
        sheet.insertColumnBefore(sumIdx + 1);
        sheet.getRange(1, sumIdx + 1).setValue(trimmedName);
      } else {
        sheet.getRange(1, lastCol + 1).setValue(trimmedName);
      }
    }
  }

  // Re-read headers after any insertions
  const lastCol = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());

  // Convert YYYY-MM-DD → M/D to match sheet format
  const [, month, day] = date.split('-');
  const dateLabel = `${parseInt(month)}/${parseInt(day)}`;

  // Build row: leave missing player cells blank
  const row = new Array(headerRow.length).fill('');
  row[0] = dateLabel;
  row[1] = Number(circles) || 1;

  for (const { name, score } of players) {
    const col = headerRow.findIndex(h => h === String(name).trim());
    if (col >= 0) row[col] = Number(score);
  }

  // Replicate the SUM formula from the existing rows instead of hardcoding 0
  const sumCol = headerRow.findIndex(h => h.toLowerCase() === 'sum');
  if (sumCol >= 0 && sumCol > 2) {
    const sumRowNum = sheet.getLastRow() + 1;
    const lastPlayerLetter = colToLetter(sumCol - 1); // column just before Sum
    row[sumCol] = `=SUM(C${sumRowNum}:${lastPlayerLetter}${sumRowNum})`;
  }

  const newRowNum = sheet.getLastRow() + 1;
  sheet.appendRow(row);
  sheet.getRange(newRowNum, 1, 1, headerRow.length).setHorizontalAlignment('center');
  return jsonResponse({ ok: true });
}

// Convert 0-based column index to spreadsheet letter (0→A, 1→B, 26→AA …)
function colToLetter(idx) {
  let col = idx + 1;
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

// ── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
