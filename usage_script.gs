/* G-9 usage logger: paste in a NEW Apps Script project (script.google.com), Deploy > New deployment > Web app,
   Execute as: Me, Who has access: Anyone. Copy the Web app URL into Config sheet, key usage_url. */
var SHEET_ID = '1KQ84FbJSDRd6ZQ0QdW-s9WE6qnL-dRmcIfwmq5CahtA';
function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents), id = String(d.id || '').slice(0, 40);
    if (!id) return ok_();
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Users'), now = new Date();
    var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(function (r) { return r[0]; });
    var i = ids.indexOf(id), clean = function (x) { return String(x || '').slice(0, 60); };
    if (i < 0) {
      sh.appendRow([id, now, now, 1, clean(d.ver), clean(d.plat), clean(d.name), clean(d.roll), clean(d.cls)]);
    } else {
      var r = i + 2, opens = Number(sh.getRange(r, 4).getValue()) || 0;
      sh.getRange(r, 3, 1, 3).setValues([[now, opens + 1, clean(d.ver)]]);
      sh.getRange(r, 6).setValue(clean(d.plat));
      if (d.name) sh.getRange(r, 7, 1, 3).setValues([[clean(d.name), clean(d.roll), clean(d.cls)]]);
    }
  } finally { lock.releaseLock(); }
  return ok_();
}
function doGet() { return ok_(); }
function ok_() { return ContentService.createTextOutput('ok'); }
