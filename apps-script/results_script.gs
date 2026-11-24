/* G-9 RESULTS script (rebuilt). Saves student results and reviews into your Google Sheet and sends them back to the app.
   Where: open your Google Sheet > Extensions > Apps Script (or the project whose Web app ID starts with AKfycbwWsalhYRy6AjQ).
   Paste this whole file (replace everything), Save, then Deploy > Manage deployments > pencil > Version: New version > Deploy.
   The Web app URL stays the same, so the Config sheet (results_url) needs no change. Execute as: Me, Who has access: Anyone. */
var SHEET_ID = '1KQ84FbJSDRd6ZQ0QdW-s9WE6qnL-dRmcIfwmq5CahtA';
var REVIEW = '⭐ Review';

function clean_(x) { return String(x == null ? '' : x).slice(0, 200); }
function ok_() { return ContentService.createTextOutput('ok'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v); }

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.type === 'photo') return savePhoto_(d);
    var id = clean_(d.id); if (!id) return ok_();
    var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('Results');
    var last = sh.getLastRow();
    if (last > 1) { var ids = sh.getRange(2, 1, last - 1, 1).getValues(); for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return ok_(); } /* same result is never saved twice */
    var sc = Number(d.sc) || 0, n = Number(d.n) || 0, pct = n ? Math.round(sc / n * 100) : 0, when = clean_(d.t) || new Date().toISOString();
    var row = last + 1;
    sh.getRange(row, 1, 1, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, 13).setValues([[id, when, clean_(d.name), clean_(d.roll), clean_(d.cls), clean_(d.s), clean_(d.c), sc, n, pct, clean_(d.device), Number(d.w) || 0, Number(d.sk) || 0]]);
    if (d.s === REVIEW) addReview_(ss, when, sc, clean_(d.c));
  } finally { lock.releaseLock(); }
  return ok_();
}

function addReview_(ss, when, stars, comment) {
  var rv = ss.getSheetByName('Reviews'); if (!rv) return;
  rv.insertRowAfter(1);
  rv.getRange(2, 1, 1, 1).setNumberFormat('@');
  rv.getRange(2, 1, 1, 3).setValues([[when, stars, comment]]);
  var last = rv.getLastRow(); if (last < 2) return;
  var v = rv.getRange(2, 2, last - 1, 1).getValues(), sum = 0, cnt = 0;
  for (var i = 0; i < v.length; i++) { var s = Number(v[i][0]); if (s >= 1 && s <= 5) { sum += s; cnt++; } }
  var cf = ss.getSheetByName('Config'); if (!cf || !cnt) return;
  var keys = cf.getRange(1, 1, Math.max(cf.getLastRow(), 1), 1).getValues();
  for (var r = 0; r < keys.length; r++) {
    var k = String(keys[r][0]);
    if (k === 'rating_avg' || k === 'rating_count') { var cell = cf.getRange(r + 1, 2); if (!cell.getFormula()) cell.setValue(k === 'rating_avg' ? Math.round(sum / cnt * 10) / 10 : cnt); }
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {}, name = String(p.name || '').trim().toLowerCase();
  if (!name) return json_({ ok: true });
  var roll = String(p.roll || '').trim().toLowerCase();
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Results'), last = sh.getLastRow(), out = [];
  if (last > 1) {
    var v = sh.getRange(2, 1, last - 1, 13).getValues();
    for (var i = 0; i < v.length; i++) {
      var r = v[i];
      if (String(r[2]).trim().toLowerCase() !== name || String(r[3]).trim().toLowerCase() !== roll) continue;
      out.push({ id: String(r[0]), t: iso_(r[1]), s: String(r[5]), c: String(r[6]), sc: Number(r[7]) || 0, n: Number(r[8]) || 0, w: r[11] === '' ? null : Number(r[11]), sk: r[12] === '' ? null : Number(r[12]) });
    }
  }
  return json_(out.slice(-600));
}

/* Photos from the app (switched off in the app for now; kept so nothing breaks if it is switched on later). */
function savePhoto_(d) {
  var rootIt = DriveApp.getFoldersByName('G9 Chapter Photos');
  var root = rootIt.hasNext() ? rootIt.next() : DriveApp.createFolder('G9 Chapter Photos');
  var sub = String(d.subject || d.sid) + ' - Chapter ' + d.ch, sIt = root.getFoldersByName(sub);
  var folder = sIt.hasNext() ? sIt.next() : root.createFolder(sub);
  var bytes = Utilities.base64Decode(String(d.img).split(',')[1]);
  folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', (d.name || 'student') + '_' + d.id + '_p' + d.pg + 'of' + d.of + '.jpg'));
  return ContentService.createTextOutput('ok');
}

/* Optional: run once from the editor to confirm the script can reach your Sheet (Execution log shows the row counts). */
function checkSheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log('Results rows: ' + (ss.getSheetByName('Results').getLastRow() - 1) + ' | Reviews rows: ' + (ss.getSheetByName('Reviews').getLastRow() - 1));
}
