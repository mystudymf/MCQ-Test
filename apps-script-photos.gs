// ADD THIS to your existing Google Apps Script (results script), then:
// Deploy > Manage deployments > Edit > Version: New version > Deploy.
// 1) At the very top of your existing doPost(e), after you parse the JSON body, add:
//      var d = JSON.parse(e.postData.contents);
//      if (d.type === 'photo') return savePhoto_(d);
//    (if your doPost already has a variable for the parsed body, use that name instead of d)
// 2) Add this function anywhere in the script:

function savePhoto_(d) {
  var rootIt = DriveApp.getFoldersByName('G9 Chapter Photos');
  var root = rootIt.hasNext() ? rootIt.next() : DriveApp.createFolder('G9 Chapter Photos');
  var sub = String(d.subject || d.sid) + ' - Chapter ' + d.ch;
  var sIt = root.getFoldersByName(sub);
  var folder = sIt.hasNext() ? sIt.next() : root.createFolder(sub);
  var bytes = Utilities.base64Decode(String(d.img).split(',')[1]);
  var fname = (d.name || 'student') + '_' + d.id + '_p' + d.pg + 'of' + d.of + '.jpg';
  folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', fname));
  return ContentService.createTextOutput('ok');
}

// 3) In your Google Sheet, open the "Config" tab and add a row:
//      photos_enabled | yes
//    The app only sends photos after this row exists, so nothing breaks before the script is updated.
