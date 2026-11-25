import json,random,os,sys
# each lesson file: lessons/NN.py defines TITLE, DELETED, QS
# QS items: ("book",q,[a,b,c,d],ans_idx,note) keeps order ; ("mk",q,correct,[w1,w2,w3],note) shuffled
def build(n,title,deleted,qs):
    rnd=random.Random(1000+n); out=[]
    for it in qs:
        if it[0]=="book":
            _,q,o,a,note=it; out.append({"q":q,"o":o,"a":a,"n":note})
        else:
            _,q,c,w,note=it; o=[c]+list(w); rnd.shuffle(o); out.append({"q":q,"o":o,"a":o.index(c),"n":note})
    for x in out: assert len(x["o"])==4 and len(set(x["o"]))==4,(n,x["q"])
    return {"lesson":n,"title":title,"deleted":deleted,"q":out}
