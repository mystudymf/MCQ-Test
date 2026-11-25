import json,re,sys
SRC='/home/claude/repo2/index.html'
VER=sys.argv[1] if len(sys.argv)>1 else '2.27.0'
NAMES={1:"حمد",2:"نعت",3:"اخلاقِ نبوی ﷺ",4:"سرسیدؒ کا بچپن",5:"مُحسِن محلّہ",6:"کفّارہ",7:"سویرے جو کل آنکھ میری کھلی",8:"دوستی کا پھل",9:"میرا گاؤں",10:"بابل کے کھنڈر",11:"اولڈ ایج ہوم",12:"کچھ ذریعۂ تعلیم کے باب میں",13:"آدمی نامہ",14:"نمودِ صبح",15:"خطاب بہ جوانانِ اسلام",16:"وغیرہ",17:"بازیچۂ اطفال ہے دنیا مرے آگے",18:"اثر اس کو ذرا نہیں ہوتا",19:"ہے مشقِ سخن جاری، چکی کی مشقت بھی",20:"یوں کہنے کو پیرایۂ اظہار بہت ہے"}
PAGES={1:"2–5",2:"7–10",3:"12–17",4:"19–26",5:"28–33",6:"35–46",7:"48–55",8:"57–64",9:"66–73",10:"74–81",11:"83–99",12:"101–106",13:"108–113",14:"114–119",15:"120–125",16:"126–129",17:"131–135",18:"136–140",19:"141–145",20:"146–149"}
DEL=[5,10,11,12,16,20]
draft=json.load(open('/home/claude/g10/draft.json',encoding='utf8'))
h=open(SRC,encoding='utf8').read()
# version
h=re.sub(r'APP_VERSION="[\d.]+"','APP_VERSION="%s"'%VER,h,count=1)
# BUILTIN
i=h.index('BUILTIN=')+8
b,e=json.JSONDecoder().raw_decode(h[i:])
b['subs']=[s for s in b['subs'] if s['id']!='urdu10']
b['subs'].append({"id":"urdu10","name":"اردو · Grade 10","icon":"🎓","dir":"rtl","on":True,"m":1})
b['tops']=[t for t in b['tops'] if t['sid']!='urdu10']
pdq={}
for L in draft:
    n=L['lesson']
    title="سبق %d · %s – کثیر الانتخابی (صفحہ %s)"%(n,NAMES[n],PAGES[n])
    qs=[{"q":q['q'],"o":q['o'],"a":q['a'],"n":q.get('n','')} for q in L['q']]
    b['tops'].append({"sid":"urdu10","t":title,"q":qs,"m":1})
    if n in DEL:
        for q in qs: pdq[re.sub(r'[^a-z0-9\u0600-\u06ff]','',q['q'].lower())[:80]]="Urdu 10 Ch %d · Lesson deleted by PECTA"%n
h=h[:i]+json.dumps(b,ensure_ascii=False,separators=(',',':'))+h[i+e:]
# addKeep: also add missing kept subjects
old='addKeep=d=>{const ks='
if 'const ms=BUILTIN.subs' not in h:
    assert old in h
    h=h.replace(old,'addKeep=d=>{const ms=BUILTIN.subs.filter(s=>s.m&&!d.subs.some(x=>x.id==s.id));if(ms.length)d={...d,subs:d.subs.concat(ms)};const ks=',1)
# urdu-like subjects use سبق label
h=h.replace('sid==\\"urdu\\"','/^urdu/.test(sid)') if 'sid==\\"urdu\\"' in h else h.replace('sid=="urdu"','/^urdu/.test(sid)')
# pecDel: fall back to Grade 10 data
old='const g=(typeof GD!=\"undefined\"?GD:[]).find(x=>x.id==sid);return g?`<details'
if old in h:
    h=h.replace(old,'const g=(typeof GD!=\"undefined\"?GD:[]).find(x=>x.id==sid)||(typeof GD10!=\"undefined\"?GD10:[]).find(x=>x.id==sid);return g?`<details',1)
# PDEL / CHN
h=h.replace('const PDEL={urdu:{','const PDEL={urdu10:'+json.dumps({n:NAMES[n] for n in DEL},ensure_ascii=False).replace('"','')+',urdu:{',1) if False else h
pd_obj='urdu10:{'+','.join('%d:%s'%(n,json.dumps(NAMES[n],ensure_ascii=False)) for n in DEL)+'},'
if 'urdu10:{5:' not in h:
    h=h.replace('const PDEL={','const PDEL={'+pd_obj,1)
chn='urdu10:{'+','.join('%d:%s'%(n,json.dumps(NAMES[n],ensure_ascii=False)) for n in NAMES)+'},'
if 'urdu10:{1:' not in h:
    h=h.replace('const CHN={','const CHN={'+chn,1)
# PDQ
h=re.sub(r'"[^"]*":"Urdu 10 Ch \d+ · Lesson deleted by PECTA",?','',h)
add=','.join('%s:%s'%(json.dumps(k,ensure_ascii=False),json.dumps(v,ensure_ascii=False)) for k,v in pdq.items())
if add: h=h.replace('const PDQ={','const PDQ={'+add+',',1)
# changelog
tot=sum(len(L['q']) for L in draft)
lessons=sorted(L['lesson'] for L in draft)
log='["%s","25/11/2026",["New: Grade 10 Urdu MCQs (%d questions, lessons %s) with PECTA-deleted lessons marked ❌","Grade 10 MCQs now have their own MCQ Practice under Grade 10 and no longer appear in Grade 9"]],'%(VER,tot,", ".join(map(str,lessons)))
h=re.sub(r'\["2\.27\.0","25/11/2026",\[[^\]]*\]\],','',h)
h=h.replace('const CHANGES=[[','const CHANGES=['+log+'[',1)

# ---- separate Grade 10 MCQ section ----
def rep(old,new,cnt=1):
    global h
    if new in h: return
    assert old in h,old[:60]
    h=h.replace(old,new,cnt)
rep('const m=DB.subs.filter(s=>s.on&&cnt(s)),q=m.reduce','const m=DB.subs.filter(s=>!/10$/.test(s.id)&&s.on&&cnt(s)),q=m.reduce')
rep('nh("📝 MCQ Practice","Choose a subject")+`<div class="grid">${DB.subs.map(s=>{','nh("📝 MCQ Practice","Choose a subject")+`<div class="grid">${DB.subs.filter(s=>!/10$/.test(s.id)).map(s=>{')
rep('id=="mixed"?DB.subs.filter(s=>s.on&&cnt(s))','id=="mixed"?DB.subs.filter(s=>!/10$/.test(s.id)&&s.on&&cnt(s))')
rep('function osdraw(){const subs=DB.subs.filter(s=>s.on&&cnt(s))','function osdraw(){const subs=DB.subs.filter(s=>!/10$/.test(s.id)&&s.on&&cnt(s))')
new10='''function mcq10Hub(){setGr(10);document.body.className="";const L=[["eng10","📚","English","ltr"],["urdu10","✍️","اردو","rtl"],["math10","➗","Mathematics","ltr"],["phy10","🧲","Physics","ltr"],["chem10","⚗️","Chemistry","ltr"],["bio10","🧬","Biology","ltr"],["cs10","💻","Computer Science","ltr"],["gs10","🔬","General Science","ltr"],["pak10","🇵🇰","Pakistan Studies","ltr"]];$("#app").innerHTML=nh("📝 Grade 10 MCQ Practice","Choose a subject")+`<div class="grid">${L.map(([id,ic,nm,dr])=>{const s=DB.subs.find(x=>x.id==id),n=s?cnt(s):0,on=s&&s.on&&n;return`<button class="sub ${on?"":"off"}" ${on?`onclick="nav('chaps','${id}')"`:""}><i>${ic}</i><b class="${dr=="rtl"?"rtl":""}">${esc(nm)}</b><br><small>${on?n+" MCQs":"Coming soon"}</small></button>`}).join("")}</div>`;scrollTo(0,0)}
'''
rep('function boardHub(){setGr(9);',new10+'function boardHub(){setGr(9);')
old_t='<div class="dtl sq"><button class="dt" style="--c:#7c3aed" onclick="nav(\'gr10Hub\')">'
new_t='<div class="dtl sq"><button class="dt" style="--c:#1d4ed8" onclick="nav(\'mcq10Hub\')"><i>📝</i><b>MCQ Practice</b><small>Grade 10 · Urdu ready</small></button><button class="dt" style="--c:#7c3aed" onclick="nav(\'gr10Hub\')">'
rep(old_t,new_t)
rep('<p class="gx-m">MCQ practice is for Grade 9 only.</p>','<p class="gx-m">Grade 10 MCQs are added subject by subject. Urdu is ready.</p>')
rep('g10Hub:"Grade 10",','g10Hub:"Grade 10",mcq10Hub:"Grade 10 MCQ",')
rep('${it("g10Hub","🎓 Grade 10")}','${it("g10Hub","🎓 Grade 10")}${it("mcq10Hub","📝 Grade 10 MCQ Practice")}')

open(SRC,'w',encoding='utf8').write(h)
print('ok',tot,len(pdq),'urdu10 test' ,'/^urdu/.test(sid)' in h)
