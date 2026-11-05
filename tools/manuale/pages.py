import json,sys
from pypdf import PdfReader
M=sys.argv[1];r=PdfReader(M+'/manuale.pdf');toc=json.load(open(M+'/toc.json'))
fl=[]
def walk(o,d=0):
    for x in o:
        if isinstance(x,list): walk(x,d+1)
        elif d<2: fl.append(r.get_destination_page_number(x)+1)
walk(r.outline)
if len(fl)!=len(toc): sys.exit('voci diverse %d %d'%(len(fl),len(toc)))
json.dump({t[3]:p for t,p in zip(toc,fl)},open(M+'/pages.json','w'))
print(len(r.pages),'pagine')
