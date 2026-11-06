import re,html,os,sys,json,subprocess,math
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__));IMG=HERE+'/img';OUT=HERE+'/out';os.makedirs(OUT+'/i',exist_ok=True)
idx=open(HERE+'/../../index.html',encoding='utf-8').read().split('\n')
a=next(i for i,l in enumerate(idx) if 'CARATTERI: inizio' in l);b=next(i for i,l in enumerate(idx) if 'CARATTERI: fine' in l)
fonts='\n'.join(re.findall(r'@font-face\s*\{.*?\}','\n'.join(idx[a+1:b]),re.S))
sys.path.insert(0,HERE)
CSS=open(HERE+'/guida.css').read()
def fmt(s):
    s=html.escape(s,quote=False)
    s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)
    s=re.sub(r'`(.+?)`',r'<span class="k">\1</span>',s)
    return s
def crop(name,box,out=None,maxw=1800):
    # box in frazioni (sx,su,dx,giù)
    im=Image.open(f'{IMG}/{name}.png').convert('RGB');w,h=im.size
    c=im.crop((int(box[0]*w),int(box[1]*h),int(box[2]*w),int(box[3]*h)))
    if c.size[0]>maxw:c=c.resize((maxw,int(c.size[1]*maxw/c.size[0])),Image.LANCZOS)
    o=out or name+'-c';c.save(f'{OUT}/i/{o}.png',optimize=True);return o
SK=(0,.225,1,1);FE=(0,.145,1,1);VIEW=(.19,.145,1,.97);FEPM=(0,.16,.86,.88);PART=(.30,.17,.90,.97);DLG2=(.30,.28,.70,.72);DLG1=(.30,.39,.70,.61)
class G:
    def __init__(s,title,sub,foot,footer):
        s.title,s.sub,s.foot,s.footer=title,sub,foot,footer;s.B=[];s.n=0;s.toc=[]
    def H(s,t):
        s.B.append(f'<h1>{html.escape(t)}</h1>')
    def H2(s,t): s.B.append(f'<h2>{html.escape(t)}</h2>')
    def P(s,t): s.B.append(f'<p>{fmt(t)}</p>')
    def UL(s,L): s.B.append('<ul>'+''.join(f'<li>{fmt(x)}</li>' for x in L)+'</ul>')
    def TAB(s,head,rows,cls=''):
        s.B.append(f'<table class="{cls}"><thead><tr>'+''.join(f'<th>{fmt(h)}</th>' for h in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{fmt(str(c))}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table>')
    def TIP(s,t,lab='Da ricordare'): s.B.append(f'<div class="tip"><b>{lab}</b> {fmt(t)}</div>')
    def RAW(s,h): s.B.append(h)
    def FIG(s,img,cap): s.B.append(fig(img,cap))
    def STEP(s,title,why,steps,figs=(),check=None,note=None):
        s.n+=1;h=f'<section class="step"><div class="sh"><span class="sn">{s.n}</span><span class="st">{html.escape(title)}</span></div>'
        h+=f'<p class="why">{fmt(why)}</p><ol class="steps">'+''.join(f'<li>{fmt(x)}</li>' for x in steps)+'</ol>'
        if note: h+=f'<div class="tip"><b>Attenzione</b> {fmt(note)}</div>'
        for f in figs:
            h+=(f if f.startswith('<') else '')
        if check: h+=f'<p class="check"><b>Controllo</b> {fmt(check)}</p>'
        s.B.append(h+'</section>')
    def write(s,cover,name,doc_title):
        css=CSS.replace('__FOOT__',s.footer)
        page=f'<!doctype html><html lang="it"><head><meta charset="utf-8"><title>{html.escape(doc_title)}</title><style>{fonts}{css}</style></head><body><div class="cover"><div class="cv-top">Banco CAD · Guida passo per passo</div><div class="cv-title">{html.escape(s.title)}</div><div class="cv-sub">{html.escape(s.sub)}</div><img src="i/{cover}.png" alt=""><div class="cv-foot">{fmt(s.foot)}</div></div>'+'\n'.join(s.B)+'</body></html>'
        open(f'{OUT}/{name}.html','w',encoding='utf-8').write(page)
def fig(img,cap,cls=''):
    return f'<figure class="{cls}"><img src="i/{img}.png" alt="{html.escape(cap)}"><figcaption>{fmt(cap)}</figcaption></figure>'
def two(a,ca,b,cb): return '<div class="two">'+fig(a,ca)+fig(b,cb)+'</div>'

def F(name,box,cap,cls=''): return fig(crop(name,box),cap,cls)
