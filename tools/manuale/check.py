import json,re,os,sys
os.chdir(sys.argv[1])
import pdfplumber
pg=json.load(open('pages.json'));toc=json.load(open('toc.json'))
EN=os.environ.get('MANUALE_LINGUA')=='en'
pdf=pdfplumber.open('Manual-Banco-CAD.pdf' if EN else 'Manuale-Banco-CAD.pdf');print('pagine',len(pdf.pages),'formato',pdf.pages[3].width,pdf.pages[3].height)
txt={}
def T(n):
    if n not in txt: txt[n]=' '.join((pdf.pages[n-1].extract_text() or '').split())
    return txt[n]
bad=0
for lv,num,t,i in toc:
    if (num+' '+t)[:40] not in T(pg[i]): bad+=1;print('NON TROVATO',num,t,pg[i])
print('voci',len(toc),'errate',bad)
toc2=T(2)
for lv,num,t,i in toc[:3]+toc[-3:]: print(num,t,pg[i])
# numeri stampati nell'indice = quelli veri
n=0
for lv,num,t,i in toc:
    if not re.search(re.escape(t[:18])+r'.{0,60}?\b'+str(pg[i])+r'\b',toc2): n+=1
print('voci dell indice non confermate',n)
ft=' '.join(T(k) for k in range(1,len(pdf.pages)+1))
for w in ['undefined','**','[[','NaN','Entra prima','Lorem']: print(repr(w),ft.count(w))
if EN:
    # parole italiane rimaste nel manuale inglese (a parte i nomi propri: Banco CAD, Rayuk-creator)
    it=re.findall(r"\b(?:della|delle|degli|nella|nelle|sono|anche|questo|questa|scheda|pezzo|schizzo|funzione|quota|clic|premi|pulsante|ogni|perché|più|già|così|può)\b",ft,flags=re.I)
    print('parole italiane',len(it),sorted(set(x.lower() for x in it))[:30])
print('numeri pagina a piè',[(pdf.pages[k].extract_text() or '').strip().split('\n')[-1][-12:] for k in (2,9,40)])
