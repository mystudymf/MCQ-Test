/* G-9 Solver backend. Paste in a NEW Apps Script project (script.google.com).
   1) Project Settings > Script properties > add  ANTHROPIC_KEY = your key  (never put the key in index.html)
   2) Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone
   3) Copy the Web app URL into the Google Sheet, tab Config, row key = solve_url
   Optional properties: MODEL (default claude-sonnet-5-5), DAILY_LIMIT (default 15 questions per device per day) */
var SUBJ = { math: 'Mathematics', phy: 'Physics', chem: 'Chemistry', bio: 'Biology' };

var SYSTEM = [
  'You are a careful, exam-focused teacher for Punjab (Pakistan) Grade 9 and Grade 10 students (Matric, BISE Lahore and other Punjab boards).',
  'Subjects: Mathematics, Physics, Chemistry, Biology only. Syllabus = Punjab Textbook Board books and the PECTA Smart Syllabus / pairing scheme for Annual Exam 2027.',
  'Method: (1) read the question or photo exactly; (2) identify chapter and topic as named in the Punjab Textbook Board book; (3) check the facts with the web search tool when a fact, definition, constant or textbook statement matters; (4) solve step by step with correct units; (5) verify the final answer by a second method or a back-substitution; (6) write the answer the way a board examiner expects (definition, formula, working, final answer with unit).',
  'Honesty rules: never invent page numbers, exercise numbers or quotations. In "references" list only the textbook chapter/topic and sources you really used (title + site). If the photo is blurry, cut off or has missing diagram parts, say exactly what is unreadable in "note" and set confidence "low". If the textbook key and real science differ, give the correct science and mention the difference in "note".',
  'Write plain text with Unicode maths (x², √, ½, π, °, ×, ÷, ⇒). Do NOT use LaTeX, markdown tables or HTML. Keep each step short and clear for a 14-year-old. Match the language of the question (English or Urdu); numbers and formulas stay as usual.',
  'If the question is not Maths, Physics, Chemistry or Biology of Grade 9/10, set off_topic true and explain politely in "note".',
  'Reply with ONLY one JSON object, no text before or after, with exactly these keys:',
  '{"off_topic":false,"subject":"","chapter":"","topic":"","question_read":"the question as you read it","answer":"final answer in one or two lines","steps":["step 1","step 2"],"formulas":["formula used with meaning"],"board_pattern":"how this usually appears in the board paper: MCQ / short (2 marks) / long (marks) and how to write it","exam_tip":"one useful tip or common mistake","pecta_note":"say if this topic is in the 2027 smart syllabus only if you verified it, otherwise empty","references":["Textbook chapter/topic or website title"],"confidence":"high|medium|low","note":""}'
].join('\n');

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var id = String(d.id || '').slice(0, 40), sub = String(d.sub || ''), gr = String(d.gr) == '10' ? '10' : '9';
    var text = String(d.text || '').slice(0, 2500), img = String(d.img || '');
    if (!id) return out_({ ok: false, error: 'Missing device id.' });
    if (!SUBJ[sub]) return out_({ ok: false, error: 'Choose a subject.' });
    if (!text.trim() && !img) return out_({ ok: false, error: 'Send a question or a photo.' });
    var P = PropertiesService.getScriptProperties(), key = P.getProperty('ANTHROPIC_KEY');
    if (!key) return out_({ ok: false, error: 'Solver is not set up yet (missing key).' });
    var lim = Number(P.getProperty('DAILY_LIMIT')) || 15, day = Utilities.formatDate(new Date(), 'Asia/Karachi', 'yyyyMMdd');
    var cache = CacheService.getScriptCache(), ck = 'u' + day + id, used = Number(cache.get(ck)) || 0;
    if (used >= lim) return out_({ ok: false, error: 'Daily limit of ' + lim + ' questions reached. Try again tomorrow.' });
    var content = [];
    var m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(img);
    if (img && !m) return out_({ ok: false, error: 'Photo format not supported.' });
    if (m) { if (m[2].length > 6500000) return out_({ ok: false, error: 'Photo is too large.' }); content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }); }
    content.push({ type: 'text', text: 'Grade ' + gr + ' · ' + SUBJ[sub] + '\n' + (text.trim() ? 'Student question / note: ' + text : 'Solve the question shown in the photo.') });
    var body = { model: P.getProperty('MODEL') || 'claude-sonnet-5-5', max_tokens: 2500, system: SYSTEM, messages: [{ role: 'user', content: content }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] };
    var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', { method: 'post', contentType: 'application/json', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(body), muteHttpExceptions: true });
    var code = r.getResponseCode(), j = JSON.parse(r.getContentText());
    if (code != 200) return out_({ ok: false, error: 'Solver is busy (' + code + '). Please try again in a minute.' });
    var t = (j.content || []).filter(function (b) { return b.type == 'text'; }).map(function (b) { return b.text; }).join('\n');
    var a = t.indexOf('{'), z = t.lastIndexOf('}');
    if (a < 0 || z < a) return out_({ ok: false, error: 'Could not prepare the answer. Please try again.' });
    var data = JSON.parse(t.slice(a, z + 1));
    cache.put(ck, String(used + 1), 90000);
    return out_({ ok: true, data: data, left: lim - used - 1 });
  } catch (err) { return out_({ ok: false, error: 'Something went wrong. Please try again.' }); }
}
function doGet() { return out_({ ok: true, v: 1 }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
