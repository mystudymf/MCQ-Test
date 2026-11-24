/* G-9 Solver backend v4 (FREE: Google Gemini). Paste in your Apps Script project, replacing all old code.
   1) Get a FREE key (no card): open aistudio.google.com, sign in with Google, click "Get API key" > "Create API key".
   2) Apps Script > Project Settings (gear) > Script properties > add  GEMINI_KEY = the key (starts with AIza)
      Optional: MODEL (exact model id from AI Studio), DAILY_LIMIT (default 200), GROUNDING = 1 (live Google Search, paid accounts only)
   3) Run  testSolver  once (Run button), click Allow, read the Execution log.
   4) Deploy > Manage deployments > pencil > Version: New version > Deploy. The URL stays the same. */
var SUBJ = { math: 'Mathematics', phy: 'Physics', chem: 'Chemistry' }; /* subject and grade are optional hints */

var SYSTEM = [
  'You are an expert teacher AND researcher for Punjab (Pakistan) school students (mainly Grade 9 and 10 Matric; BISE Lahore and other Punjab boards). Main subjects: Mathematics, Physics, Chemistry, but solve ANY school or study question the student sends, whatever the subject. Never refuse and never say a question is out of syllabus.',
  'HOW YOU WORK: (A) First use what you know of the Punjab Textbook Board books and the PECTA Smart Syllabus 2027. (B) If the exact topic is not in those books, solve it anyway using the best of your scientific and mathematical knowledge, as a good teacher would. (C) Solve step by step with correct units. (D) Verify the final answer by a second method or by back-substitution before replying. (E) Explain in simple words for a 14-year-old and write the answer the way a board examiner expects.',
  'HONESTY: never invent page numbers, exercise numbers, quotations or websites. In "references" list only the textbook chapter/topic you used. If the photo is blurry, cut off or a diagram is missing, say exactly what is unreadable in "note" and set confidence "low". If a textbook key and real science differ, give the correct science and mention the difference in "note".',
  'FORMAT: plain text with Unicode maths (x², √, ½, π, °, ×, ÷, ⇒). No LaTeX, no markdown, no HTML. BE FAST AND CONCISE: at most 6 short steps; one short sentence each for board_pattern and exam_tip; leave research and pecta_note empty; spoken is at most 3 short sentences. Answer in English by default. Use Urdu only if the question itself is written in Urdu. Never answer in Arabic.',
  'Reply with ONLY one JSON object, no text before or after, exactly these keys:',
  '{"subject":"","chapter":"","topic":"","question_read":"the question as you read it","answer":"final answer in one or two lines","steps":["step 1","step 2"],"formulas":["formula with meaning"],"source_type":"textbook or knowledge or online","research":"","board_pattern":"how this appears in the board paper (MCQ / short 2 marks / long) and how to write it","exam_tip":"one tip or common mistake","pecta_note":"","spoken":"3 to 5 short sentences to read aloud: the answer and the key idea, no symbols","references":["textbook chapter or topic"],"confidence":"high or medium or low","note":""}'
].join('\n');

function geminiCall_(key, model, body) {
  var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, payload: JSON.stringify(body), muteHttpExceptions: true });
  var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) { }
  return { code: r.getResponseCode(), j: j };
}
function errText_(o) { return o && o.j && o.j.error && o.j.error.message ? String(o.j.error.message).slice(0, 160) : ''; }
function keyBad_(o) { return o && (o.code == 401 || o.code == 403 || (o.code == 400 && /api key/i.test(errText_(o)))); }
function textOf_(j) {
  var c = (j.candidates || [])[0], ps = (c && c.content && c.content.parts) || [];
  return ps.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('\n');
}

function thinkVariants_() { return [{ thinkingLevel: 'minimal' }, { thinkingBudget: 0 }, null]; }
function solveCore_(key, parts) {
  var t0 = Date.now(), P = PropertiesService.getScriptProperties(), pref = P.getProperty('MODEL'), ground = P.getProperty('GROUNDING') == '1', models = [];
  if (pref) models.push(pref);
  ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'].forEach(function (m) { if (models.indexOf(m) < 0) models.push(m); });
  var last = null, vars = thinkVariants_();
  for (var mi = 0; mi < models.length; mi++) {
    if (Date.now() - t0 > 45000) break;
    for (var vi = 0; vi < vars.length; vi++) {
      var body = { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts: parts }], generationConfig: { maxOutputTokens: 1800, temperature: 0.2 } };
      if (vars[vi]) body.generationConfig.thinkingConfig = vars[vi];
      if (ground) body.tools = [{ google_search: {} }]; else body.generationConfig.responseMimeType = 'application/json';
      var o = geminiCall_(key, models[mi], body); last = o;
      if (o.code == 200) { var t = textOf_(o.j); if (t) return { text: t, model: models[mi], ms: Date.now() - t0 }; last = { code: 0, j: { error: { message: 'Empty answer (' + ((o.j.promptFeedback || {}).blockReason || 'no text') + ')' } } }; break; }
      if (keyBad_(o) || o.code == 429) return { fail: o };
      if (ground && o.code == 400 && /tool|ground|search/i.test(errText_(o))) { ground = false; vi--; continue; } /* free plans cannot search: continue without it */
      if (!(o.code == 400 && /think|budget|level/i.test(errText_(o)))) break; /* only a thinking-setting error tries the next thinking variant */
    }
  }
  return { fail: last };
}

function parse_(t) {
  var s = String(t).replace(/```json|```/g, ''), a = s.indexOf('{'), z = s.lastIndexOf('}');
  if (a >= 0 && z > a) { try { return JSON.parse(s.slice(a, z + 1)); } catch (e) { } }
  return { subject: '', answer: String(t).slice(0, 1500), steps: [], confidence: 'low', source_type: 'knowledge', note: 'The answer came in a plain format. Please double-check it.' };
}
function cleanKey_(P) { return String(P.getProperty('GEMINI_KEY') || '').replace(/[\s"']/g, ''); }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var id = String(d.id || '').slice(0, 40), sub = String(d.sub || ''), gr = String(d.gr || '');
    var text = String(d.text || '').slice(0, 6000), img = String(d.img || '');
    if (!id) return out_({ ok: false, error: 'Missing device id.' });
    if (!text.trim() && !img) return out_({ ok: false, error: 'Send a question or a photo.' });
    var P = PropertiesService.getScriptProperties(), key = cleanKey_(P);
    if (!key) return out_({ ok: false, error: 'Solver is not set up yet (the key is missing).' });
    var cache = CacheService.getScriptCache(), ak = img ? '' : 'a' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sub + '|' + gr + '|' + text.trim().toLowerCase())).slice(0, 40);
    if (ak) { var hit = cache.get(ak); if (hit) { try { return out_({ ok: true, data: JSON.parse(hit), left: null, cached: true }); } catch (e) { } } }
    var lim = Number(P.getProperty('DAILY_LIMIT')) || 200, day = Utilities.formatDate(new Date(), 'Asia/Karachi', 'yyyyMMdd');
    var ck = 'u' + day + id, used = Number(cache.get(ck)) || 0;
    if (used >= lim) return out_({ ok: false, error: 'Daily limit of ' + lim + ' questions reached. Try again tomorrow.' });
    var parts = [], m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(img);
    if (img && !m) return out_({ ok: false, error: 'Photo format not supported.' });
    if (m) { if (m[2].length > 6500000) return out_({ ok: false, error: 'Photo is too large.' }); parts.push({ inlineData: { mimeType: m[1], data: m[2] } }); }
    parts.push({ text: (gr ? 'Grade ' + gr + ' ' : '') + (SUBJ[sub] || '') + (gr || SUBJ[sub] ? '\n' : '') + (text.trim() ? 'Student question / note: ' + text : 'Solve the question shown in the photo.') });
    var res = solveCore_(key, parts);
    if (res.fail) {
      var c = res.fail ? res.fail.code : 0;
      var msg = keyBad_(res.fail) ? 'The solver key is not accepted. Developer: check GEMINI_KEY.' : c == 429 ? 'Too many questions at the same time (free limit). Please try again in a minute.' : 'The solver could not answer right now. Please try again.';
      return out_({ ok: false, error: msg, detail: 'API ' + c + ' ' + errText_(res.fail) });
    }
    cache.put(ck, String(used + 1), 90000);
    var data = parse_(res.text);
    if (ak && data.confidence != 'low') { var js = JSON.stringify(data); if (js.length < 90000) cache.put(ak, js, 21600); }
    return out_({ ok: true, data: data, left: lim - used - 1, ms: res.ms, model: res.model });
  } catch (err) { return out_({ ok: false, error: 'Something went wrong. Please try again.', detail: String(err).slice(0, 160) }); }
}
function doGet() { return out_({ ok: true, v: 6 }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Run from the editor to see which model is fastest for you (times are in the Execution log). */
function speedTest() {
  var P = PropertiesService.getScriptProperties(), key = cleanKey_(P);
  ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'].forEach(function (m) {
    var t0 = Date.now(), o = geminiCall_(key, m, { contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }], generationConfig: { maxOutputTokens: 20, thinkingConfig: { thinkingLevel: 'minimal' } } });
    Logger.log(m + ' -> HTTP ' + o.code + ' in ' + (Date.now() - t0) + ' ms ' + (o.code == 200 ? '' : errText_(o)));
  });
}

/* Run once from the editor: asks Google for permission and proves the key and model work. */
function testSolver() {
  var P = PropertiesService.getScriptProperties(), key = cleanKey_(P);
  if (!key) { Logger.log('FAIL: add script property GEMINI_KEY first.'); return; }
  var r = solveCore_(key, [{ text: 'Grade 9 Physics\nStudent question / note: A bullet of mass 0.05 kg moves at 300 m/s. Find its kinetic energy.' }]);
  if (r.fail) { Logger.log('FAIL: API ' + r.fail.code + ' ' + errText_(r.fail)); return; }
  Logger.log('OK (model ' + r.model + ', ' + r.ms + ' ms). Answer: ' + parse_(r.text).answer);
}
