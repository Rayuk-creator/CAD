import json,sys,os
from pypdf import PdfWriter
M=sys.argv[1];EN=os.environ.get('MANUALE_LINGUA')=='en';OUT='Manual-Banco-CAD.pdf' if EN else 'Manuale-Banco-CAD.pdf'
toc=json.load(open(M+'/toc.json'));pg=json.load(open(M+'/pages.json'))
w=PdfWriter(clone_from=M+'/manuale.pdf')
if '/Outlines' in w._root_object: del w._root_object['/Outlines']
par=None
for lv,num,t,i in toc:
    it=w.add_outline_item(num+' '+t,pg[i]-1,parent=par if lv==2 else None)
    if lv==1: par=it
if EN: w.add_metadata({'/Title':'Banco CAD – User manual','/Author':'Rayuk-creator','/Subject':'User manual of the Banco CAD 3D modeler','/Keywords':'CAD, SolidWorks, school, 3D modeling'})
else: w.add_metadata({'/Title':"Banco CAD – Manuale d'uso",'/Author':'Rayuk-creator','/Subject':'Manuale d\'uso del modellatore 3D Banco CAD','/Keywords':'CAD, SolidWorks, scuola, modellazione 3D'})
w.write(M+'/'+OUT)
