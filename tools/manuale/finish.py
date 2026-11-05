import json,sys
from pypdf import PdfWriter
M=sys.argv[1];toc=json.load(open(M+'/toc.json'));pg=json.load(open(M+'/pages.json'))
w=PdfWriter(clone_from=M+'/manuale.pdf')
if '/Outlines' in w._root_object: del w._root_object['/Outlines']
par=None
for lv,num,t,i in toc:
    it=w.add_outline_item(num+' '+t,pg[i]-1,parent=par if lv==2 else None)
    if lv==1: par=it
w.add_metadata({'/Title':"Banco CAD – Manuale d'uso",'/Author':'Rayuk-creator','/Subject':'Manuale d\'uso del modellatore 3D Banco CAD','/Keywords':'CAD, SolidWorks, scuola, modellazione 3D'})
w.write(M+'/Manuale-Banco-CAD.pdf')
