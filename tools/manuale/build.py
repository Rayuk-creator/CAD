import json,re,html,sys,base64,os
HERE=os.path.dirname(os.path.abspath(__file__));M=os.path.abspath(sys.argv[1])  # cartella di lavoro
# lingua del manuale: MANUALE_LINGUA=en per l'inglese (lo imposta fai.sh); ogni testo scritto a mano è L('italiano','inglese')
EN=os.environ.get('MANUALE_LINGUA')=='en'
def L(it,en): return en if EN else it
d=json.load(open(M+'/data.json'))
if EN and not d.get('en'): sys.exit('data.json senza la parte inglese: rifare dump.js con MANUALE_LINGUA=en')
idx=open(HERE+'/../../index.html',encoding='utf-8').read().split('\n')
a=next(i for i,l in enumerate(idx) if 'CARATTERI: inizio' in l); b=next(i for i,l in enumerate(idx) if 'CARATTERI: fine' in l)
fonts='\n'.join(idx[a+1:b])
pages=json.load(open(M+'/pages.json')) if os.path.exists(M+'/pages.json') else {}
TERMS=d['en']['terms'] if EN else {}
def term(k):
    # [[chiave]] senza etichetta: in inglese il nome inglese della voce del Glossario
    if not EN: return k
    if not TERMS.get(k): sys.exit('termine del Glossario senza nome inglese: '+k)
    return TERMS[k]
def fmt(s):
    s=html.escape(s,quote=False)
    s=re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]',r'<em>\2</em>',s)
    s=re.sub(r'\[\[([^\]]+)\]\]',lambda m:'<em>'+html.escape(term(html.unescape(m.group(1))),quote=False)+'</em>',s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)
    return s
toc=[];n=[0,0]
def H1(t,part=None):
    n[0]+=1;n[1]=0;num=str(n[0]);i=f's{n[0]}';toc.append((1,num,t,i))
    return f'<h1 id="{i}"><span class="num">{num}</span> {html.escape(t)}</h1>'
def H2(t):
    n[1]+=1;num=f'{n[0]}.{n[1]}';i=f's{n[0]}_{n[1]}';toc.append((2,num,t,i))
    return f'<h2 id="{i}"><span class="num">{num}</span> {html.escape(t)}</h2>'
def fig(name,cap,cls=''):
    return f'<figure class="{cls}"><img src="img/{name}.png" alt="{html.escape(cap)}"><figcaption>{fmt(cap)}</figcaption></figure>'
def P(s): return f'<p>{fmt(s)}</p>'
def UL(L): return '<ul>'+''.join(f'<li>{fmt(x)}</li>' for x in L)+'</ul>'
def OL(L): return '<ol class="steps">'+''.join(f'<li>{fmt(x)}</li>' for x in L)+'</ol>'
def TIP(s,t=None): return f'<div class="tip"><b>{t or L("Da ricordare","Remember")}</b> {fmt(s)}</div>'
def TAB(head,rows,cls=''):
    return f'<table class="{cls}"><thead><tr>'+''.join(f'<th>{fmt(h)}</th>' for h in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{fmt(str(c))}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table>'
B=[]
# ---------- 1
B.append(H1(L('Che cos\'è il Banco CAD','What Banco CAD is')))
B.append(P(L('Il **Banco CAD** è un modellatore 3D parametrico pensato per la scuola, in particolare per gli istituti tecnici di meccanica e meccatronica. Si ispira a SolidWorks in tutto: nomi dei comandi, modo di lavorare, albero delle funzioni, pannelli, colori dello schizzo e messa in tavola secondo le norme ISO. Chi impara qui ritrova le stesse idee nei programmi professionali.',
 '**Banco CAD** is a parametric 3D modeler designed for schools, in particular for technical schools of mechanics and mechatronics. It takes after SolidWorks in everything: command names, way of working, feature tree, panels, sketch colors and drawings to ISO standards. What you learn here, you find again in professional programs.')))
B.append(P(L('«Parametrico» vuol dire che il pezzo è costruito con una storia di passi modificabili: cambi una quota dello schizzo o la profondità di un\'estrusione, e tutto il pezzo si ricalcola.',
 '“Parametric” means that the part is built as a history of steps you can edit: change a sketch dimension or the depth of an extrusion, and the whole part is recalculated.')))
B.append(H2(L('Cosa si può fare','What you can do')))
B.append(UL(L(['**Disegnare schizzi** con linee, rettangoli, cerchi, archi e poligoni, vincolati con quote e relazioni.',
 '**Costruire pezzi** con estrusioni, tagli, rivoluzioni, sweep, nervature, fori unificati, raccordi, smussi, serie e specchi, anche con più corpi solidi.',
 '**Valutare** massa, volume e baricentro con 13 materiali, misurare e sezionare il pezzo.',
 '**Montare assiemi** con accoppiamenti, sottoassiemi, viti e bulloni unificati, distinta base, verifica delle interferenze e vista esplosa.',
 '**Fare le tavole** secondo il metodo europeo (ISO 5456-2, metodo E), con quote, sezioni e cartiglio, e salvarle in PDF, SVG o DXF.',
 '**Scambiare file** con altri programmi: si aprono STEP, IGES, STL, OBJ, DXF e DWG; si scrivono STEP e STL.'],
 ['**Draw sketches** with lines, rectangles, circles, arcs and polygons, constrained with dimensions and relations.',
 '**Build parts** with extrusions, cuts, revolves, sweeps, ribs, standard holes, fillets, chamfers, patterns and mirrors, also with several solid bodies.',
 '**Evaluate** mass, volume and center of mass with 13 materials, measure and section the part.',
 '**Build assemblies** with mates, subassemblies, standard screws and bolts, bill of materials, interference detection and exploded view.',
 '**Make drawings** with the European method (ISO 5456-2, first angle projection), with dimensions, sections and title block, and save them as PDF, SVG or DXF.',
 '**Exchange files** with other programs: STEP, IGES, STL, OBJ, DXF and DWG can be opened; STEP and STL can be written.'])))
B.append(H2(L('Come si apre','How to open it')))
B.append(P(L('Il programma è **un solo file**, senza installazione. Ci sono due modi per usarlo.','The program is **a single file**, with nothing to install. There are two ways to use it.')))
B.append(TAB(L(['Modo','Cosa fare','Quando conviene'],['Way','What to do','When it is best']),L([
 ['**Dal sito**','Apri **rayuk-creator.github.io/CAD** nel browser.','Si aggiorna da solo; va bene anche su tablet e telefono.'],
 ['**Dal file**','Su github.com/Rayuk-creator/CAD apri il file index.html, premi **Download raw file**, rinominalo per esempio banco-cad.html e aprilo con un doppio clic.','Funziona senza internet: per esempio a scuola, in un laboratorio senza rete.']],[
 ['**From the website**','Open **rayuk-creator.github.io/CAD** in the browser. For the English version add **?lang=en** at the end of the address, or choose **Project › Language: English**.','It updates by itself; it also works on tablets and phones.'],
 ['**From the file**','On github.com/Rayuk-creator/CAD open the file index.html, press **Download raw file**, rename it for example banco-cad.html and open it with a double click.','It works without the Internet: for example at school, in a lab with no network.']])))
B.append(TIP(L('L\'indirizzo giusto è **rayuk-creator.github.io/CAD**. Sulla pagina del repository (github.com/Rayuk-creator/CAD) il programma non gira, e sembra caricato a metà.',
 'The right address is **rayuk-creator.github.io/CAD**. On the repository page (github.com/Rayuk-creator/CAD) the program does not run, and it looks half loaded.'),L('Attenzione','Watch out')))
B.append(P(L('Serve un browser recente con la grafica 3D (WebGL) attiva. Le prove automatiche del programma si fanno su Chromium, il motore di Chrome ed Edge.',
 'You need a recent browser with 3D graphics (WebGL) enabled. The automatic tests of the program run on Chromium, the engine of Chrome and Edge.')))
B.append(H2(L('Dove finisce il tuo lavoro','Where your work goes')))
B.append(P(L('Il lavoro si salva **da solo nel browser** che stai usando, su quel computer. Tutto il calcolo avviene lì: il programma non chiede nulla ad altri siti e i tuoi pezzi restano sul tuo computer. Da questo seguono tre regole pratiche.',
 'Your work is saved **by itself in the browser** you are using, on that computer. All the computing happens there: the program asks nothing of other websites and your parts stay on your computer. Three practical rules follow from this.')))
B.append(UL(L(['Il lavoro fatto sul sito e quello fatto con il file scaricato **restano separati**, anche sullo stesso computer. Lo stesso vale tra un browser e l\'altro.',
 'Per portare un progetto su un altro computer, o per conservarlo al sicuro, usa **Progetto › Esporta il progetto**; per riaprirlo, **Progetto › Importa un progetto**.',
 'Se cancelli i dati di navigazione del browser, puoi perdere il lavoro. Esporta il progetto ogni tanto: è la tua copia di sicurezza.'],
 ['Work done on the website and work done with the downloaded file **stay separate**, even on the same computer. The same goes from one browser to another.',
 'To take a project to another computer, or to keep it safe, use **Project › Export project**; to open it again, **Project › Import a project**.',
 'If you clear the browser data, you can lose your work. Export the project now and then: it is your backup copy.'])))
# ---------- 2
B.append(H1(L('Lo schermo e i comandi','The screen and the commands')))
B.append('''<figure class="anno"><div class="annobox"><img src="img/schermo.png" alt="'''+L('Lo schermo del Banco CAD','The Banco CAD screen')+'">'+''.join(f'<span class="dot" style="left:{x}%;top:{y}%">{k}</span>' for k,x,y in L([(1,17,3),(2,37,8),(3,97,8.2),(4,17.5,30),(5,62,70),(6,70,21),(7,20,88),(8,13,98.5),(9,69,3)],
 # in inglese la barra dei comandi va su due righe (la vista scende) e i nomi nell'albero sono più lunghi
 [(1,17,3),(2,37,8),(3,97,8.2),(4,17.5,75),(5,62,70),(6,70,28.5),(7,20,88),(8,13,98.5),(9,69,3)]))+'''</div><figcaption>'''+L('Le parti dello schermo. I numeri corrispondono alla tabella qui sotto.','The parts of the screen. The numbers match the table below.')+'''</figcaption></figure>''')
B.append(TAB(L(['','Parte','A cosa serve'],['','Part','What it is for']),L([
 ['1','**Nome e parte aperta**','Il nome della parte. Con più parti o assiemi compare qui l\'elenco per passare dall\'una all\'altro.'],
 ['2','**Schede**','Funzioni, Schizzo, Valuta, Messa in tavola, Assieme: ognuna mostra i suoi comandi.'],
 ['3','**CommandManager**','I pulsanti dei comandi della scheda scelta.'],
 ['4','**Albero di progettazione**','Piani, origine, corpi e funzioni nell\'ordine in cui li hai fatti. Quando crei o modifichi una funzione, qui compare il **PropertyManager**, cioè il pannello con i parametri.'],
 ['5','**Vista 3D**','Il pezzo. Si seleziona con un clic; a pannello aperto compare anche un piccolo albero sopra la vista, per scegliere per nome.'],
 ['6','**Barretta della vista**','Adatta, orientamenti, stile di visualizzazione, sezione, piani.'],
 ['7','**Assi**','Mostrano come è girato il pezzo: X rosso, Y verde, Z blu.'],
 ['8','**Barra di stato**','Dice cosa è selezionato e, nello schizzo, se è definito.'],
 ['9','**Annulla, Guida, Glossario, Progetto**','Annulla e Ripeti; la Guida «come si fa»; il dizionario dei termini; il menu con salvataggi, importazioni ed esportazioni.']],[
 ['1','**Name and open part**','The name of the part. With several parts or assemblies, the list to switch from one to another appears here.'],
 ['2','**Tabs**','Features, Sketch, Evaluate, Drawing, Assembly: each one shows its commands.'],
 ['3','**CommandManager**','The command buttons of the chosen tab.'],
 ['4','**FeatureManager design tree**','Planes, origin, bodies and features in the order you made them. When you create or edit a feature, the **PropertyManager** appears here, that is the panel with the parameters.'],
 ['5','**3D view**','The part. Select with a click; with a panel open, a small tree also appears over the view, to choose by name.'],
 ['6','**View toolbar**','Zoom to fit, orientations, display style, section, planes.'],
 ['7','**Axes**','They show how the part is turned: X red, Y green, Z blue.'],
 ['8','**Status bar**','It says what is selected and, in a sketch, whether it is defined.'],
 ['9','**Undo, Guide, Glossary, Project**','Undo and Redo; the “how to” Guide; the dictionary of terms; the menu with saving, importing and exporting.']]),'tabnum'))
B.append(TIP(L('✓ conferma e ✕ annulla. La piccola ⓘ accanto a un titolo spiega quella voce.','✓ confirms and ✕ cancels. The small ⓘ next to a title explains that item.'),L('Nei pannelli','In the panels')))
B.append(H2(L('Muovere la vista','Moving the view')))
B.append(TAB(L(['Mouse','Azione'],['Mouse','Action']),L([
 ['Rotella avanti / indietro','Ingrandisce / riduce verso il puntatore (anche nella messa in tavola)'],
 ['Ctrl + rotella','Ruota il pezzo'],
 ['Trascina con il tasto sinistro','Ruota il pezzo'],
 ['Trascina con il tasto destro, oppure Maiusc + sinistro','Sposta la vista'],
 ['Clic','Seleziona; Ctrl + clic ne seleziona più di uno']],[
 ['Wheel forward / back','Zooms in / out towards the pointer (also in the drawing)'],
 ['Ctrl + wheel','Rotates the part'],
 ['Drag with the left button','Rotates the part'],
 ['Drag with the right button, or Shift + left','Pans the view'],
 ['Click','Selects; Ctrl + click selects more than one']])))
B.append(TAB(L(['Tablet','Azione'],['Tablet','Action']),L([
 ['Due dita, sempre','Zoom'],
 ['Tocca prima il pezzo («Pezzo preso», bordo blu), poi un dito','Ruota'],
 ['Tocca prima il pezzo, poi due dita','Sposta'],
 ['Tocco nel vuoto oppure «Lascia»','Rilascia il pezzo']],[
 ['Two fingers, always','Zoom'],
 ['Touch the part first (“Part held”, blue border), then one finger','Rotate'],
 ['Touch the part first, then two fingers','Pan'],
 ['Tap on empty space or “Release”','Releases the part']])))
B.append(TAB(L(['Tastiera','Azione'],['Keyboard','Action']),L([
 ['F','Adatta il pezzo alla finestra'],['Barra spaziatrice','Apre gli orientamenti della vista'],
 ['Ctrl + Z / Ctrl + Y','Annulla / Ripeti (anche Ctrl + Maiusc + Z)'],['Esc','Annulla il comando o chiude il pannello; nello schizzo torna alla selezione'],['Invio','Conferma il pannello aperto; nello schizzo conferma lo schizzo'],['Canc','Elimina ciò che è selezionato']],[
 ['F','Fits the part to the window'],['Spacebar','Opens the view orientations'],
 ['Ctrl + Z / Ctrl + Y','Undo / Redo (also Ctrl + Shift + Z)'],['Esc','Cancels the command or closes the panel; in a sketch goes back to selection'],['Enter','Confirms the open panel; in a sketch confirms the sketch'],['Delete','Deletes what is selected']])))
B.append(H2(L('Guida e Glossario dentro il programma','Guide and Glossary inside the program')))
B.append(P(L('Questo manuale riprende i testi della **Guida** e del **Glossario**, che sono sempre a portata di mano nel programma. La Guida ha il pulsante **Mostrami dove**, che indica il comando sullo schermo. Il Glossario spiega ogni termine; dai titoli dei pannelli si apre con la ⓘ.',
 'This manual uses the texts of the **Guide** and of the **Glossary**, which are always at hand in the program. The Guide has the **Show me where** button, which points to the command on the screen. The Glossary explains every term; from the panel titles it opens with the ⓘ.')))
B.append('<div class="two">'+fig('guida',L('La Guida resta aperta a destra mentre lavori.','The Guide stays open on the right while you work.'))+fig('glossario',L('Il Glossario, con il collegamento a «come si fa».','The Glossary, with the link to “how to”.'))+'</div>')
B.append(H2(L('Tutti i comandi, scheda per scheda','All the commands, tab by tab')))
tabname={t['id']:t['t'] for t in d['tabs']}
names={k:L('Scheda '+tabname.get(k,k),tabname.get(k,k)+' tab') for k in ['features','sketch','evaluate','drawing','assembly']}
for k in ['sketch','features','evaluate','drawing','assembly']:
    B.append(f'<h3>{html.escape(names[k])}</h3>')
    B.append(TAB(L(['Comando','Cosa fa'],['Command','What it does']),[[f"**{c['t']}**",c['tip'].split('\n')[0]] for c in d['cmds'][k]],'cmds'))
B.append('<h3>'+L('Menu Progetto','Project menu')+'</h3>')
MP=L({'new':'Comincia un progetto vuoto.','addPart':'Aggiunge un\'altra parte allo stesso progetto.','delPart':'Toglie la parte aperta e i suoi componenti negli assiemi. Non si può annullare.','export':'Salva il progetto in un file: è la copia di sicurezza e il modo per spostarlo.','import':'Riapre un progetto salvato.','importCad':'Apre un solido da un file STEP o IGES.','importMesh':'Apre un solido fatto di triangoli da un file STL o OBJ.','importDxf':'Porta un disegno 2D in uno schizzo.','pdf':'Salva in PDF la tavola, lo schizzo o la vista 3D, secondo cosa stai guardando.','step':'Scrive il pezzo per aprirlo in un altro programma CAD.','stl':'Scrive il pezzo per la stampa 3D.','help':'Apre la Guida.','manual':'Apre questo manuale in PDF (serve la connessione a Internet).','about':'Mostra autori e licenze.','lang':'Passa all\'inglese; la pagina si ricarica.'},
 {'new':'Starts an empty project.','addPart':'Adds another part to the same project.','delPart':'Removes the open part and its components in the assemblies. It cannot be undone.','export':'Saves the project to a file: it is the backup copy and the way to move it.','import':'Opens a saved project again.','importCad':'Opens a solid from a STEP or IGES file.','importMesh':'Opens a solid made of triangles from an STL or OBJ file.','importDxf':'Brings a 2D drawing into a sketch.','pdf':'Saves the drawing, the sketch or the 3D view as PDF, depending on what you are looking at.','step':'Writes the part to open it in another CAD program.','stl':'Writes the part for 3D printing.','help':'Opens the Guide.','manual':'Opens this manual as PDF (an Internet connection is needed).','about':'Shows authors and licenses.','lang':'Switches to Italian; the page reloads.'})
miss=[x for x in d['menu'] if x['act'] and x['act'] not in MP]
if miss: print('voci del menu senza spiegazione:',[x['act'] for x in miss])
B.append(TAB(L(['Voce','Cosa fa'],['Item','What it does']),[[f"**{x['t']}**",MP.get(x['act'],'')] for x in d['menu']],'cmds'))
B.append(fig('menu-progetto',L('Il menu Progetto si apre con il pulsante in alto a destra. Il nome di «Salva PDF» cambia secondo cosa stai guardando.','The Project menu opens with the button at the top right. The name of “Save PDF” changes depending on what you are looking at.')))
# ---------- 3
B.append(H1(L('Esercizio guidato: una piastra con foro','Guided exercise: a plate with a hole')))
B.append(P(L('Il modo più veloce per imparare è fare un pezzo vero dall\'inizio alla fine. Costruiremo una piastra **80 × 50 × 10 mm** con un foro centrale **Ø 20** e i quattro spigoli verticali raccordati **R 5**. Alla fine controlleremo i numeri con un calcolo a mano. Tutti i passi sono stati eseguiti davvero nel programma, con il mouse.',
 'The fastest way to learn is to make a real part from start to finish. We will build a plate **80 × 50 × 10 mm** with a central hole **Ø 20** and the four vertical edges filleted **R 5**. At the end we will check the numbers with a hand calculation. All the steps were really carried out in the program, with the mouse.')))
B.append(H2(L('Disegna il rettangolo','Draw the rectangle')))
B.append(OL(L(['Apri la scheda **Schizzo**, fai clic su **Piano superiore** nell\'albero, poi premi **Schizzo**. La vista si gira da sola.','Premi **Rettangolo**. Fai clic sull\'origine (il puntatore si aggancia da solo), poi fai clic su un punto in alto a destra. Le misure non contano: le sistemeranno le quote.','Premi **Esc** per tornare alla selezione. Le linee sono **blu**: lo schizzo non è ancora definito.'],
 ['Open the **Sketch** tab, click **Top Plane** in the tree, then press **Sketch**. The view turns by itself.','Press **Corner Rectangle**. Click the origin (the pointer snaps to it by itself), then click a point up and to the right. The sizes do not matter: the dimensions will set them.','Press **Esc** to go back to selection. The lines are **blue**: the sketch is not defined yet.'])))
B.append(fig('es-1-rettangolo',L('Rettangolo appena disegnato: blu vuol dire «si può ancora muovere».','Rectangle just drawn: blue means “it can still move”.')))
B.append(H2(L('Metti le quote','Add the dimensions')))
B.append(OL(L(['Premi **Quota intelligente**. Fai clic sul lato in basso, poi sotto il lato per posizionare la quota. Scrivi **80** e premi **Invio**.','Fai clic sul lato destro, poi alla sua destra. Scrivi **50** e premi **Invio**.','Ora le linee sono **nere** e in basso c\'è scritto **Completamente definito**.'],
 ['Press **Smart Dimension**. Click the bottom side, then below the side to place the dimension. Type **80** and press **Enter**.','Click the right side, then to its right. Type **50** and press **Enter**.','Now the lines are **black** and at the bottom it says **Fully Defined**.'])))
B.append(fig('es-2-quote',L('Schizzo nero: forma e posizione sono decise del tutto.','Black sketch: shape and position are completely set.')))
B.append(H2(L('Estrudi','Extrude')))
B.append(OL(L(['Apri la scheda **Funzioni** e premi **Estrusione base**: lo schizzo si conferma da solo.','Nel pannello scrivi **10** in **Profondità**. L\'anteprima arancione mostra il materiale che verrà aggiunto.','Conferma con **✓**. Il pezzo è nato, e nell\'albero c\'è **Estrusione1** con dentro il suo schizzo.'],
 ['Open the **Features** tab and press **Extruded Boss/Base**: the sketch is confirmed by itself.','In the panel type **10** in **Depth**. The orange preview shows the material that will be added.','Confirm with **✓**. The part is born, and in the tree there is **Boss-Extrude1** with its sketch inside.'])))
B.append(fig('es-3-estrusione',L('Pannello dell\'estrusione con l\'anteprima.','The extrusion panel with the preview.')))
B.append(H2(L('Disegna il foro su una faccia','Draw the hole on a face')))
B.append(OL(L(['Fai clic sulla faccia alta della piastra. Nella scheda **Schizzo** premi **Schizzo**: il nuovo schizzo nasce su quella faccia.','Premi **Cerchio**. Fai clic su un punto verso il centro, poi su un punto a qualche millimetro: è il raggio. Premi **Esc**.','Premi **Quota intelligente**. Fai clic sulla circonferenza, poi fuori, e scrivi **20**.','Fai clic sull\'origine, poi sul centro del cerchio, poi sotto la piastra per mettere la quota orizzontale: scrivi **40**.','Di nuovo: clic sull\'origine, clic sul centro, poi a sinistra della piastra per la quota verticale: scrivi **25**. Lo schizzo diventa nero.'],
 ['Click the top face of the plate. In the **Sketch** tab press **Sketch**: the new sketch is made on that face.','Press **Circle**. Click a point near the center, then a point a few millimeters away: that is the radius. Press **Esc**.','Press **Smart Dimension**. Click the circle, then outside it, and type **20**.','Click the origin, then the center of the circle, then below the plate to place the horizontal dimension: type **40**.','Again: click the origin, click the center, then to the left of the plate for the vertical dimension: type **25**. The sketch turns black.'])))
B.append(fig('es-5-cerchio',L('Cerchio Ø 20 con le due quote che lo mettono al centro (40 e 25). La faccia scelta resta azzurra.','Circle Ø 20 with the two dimensions that put it in the center (40 and 25). The chosen face stays light blue.')))
B.append(H2(L('Taglia','Cut')))
B.append(OL(L(['Nella scheda **Funzioni** premi **Taglio estruso**. Parte già con la condizione **Passante**, quindi attraversa tutta la piastra.','Conferma con **✓**.'],
 ['In the **Features** tab press **Extruded Cut**. It already starts with the **Through All** end condition, so it goes through the whole plate.','Confirm with **✓**.'])))
B.append(fig('es-6-taglio',L('Anteprima del taglio: in rosso il materiale che verrà tolto.','Preview of the cut: in red the material that will be removed.')))
B.append(H2(L('Raccorda gli spigoli','Fillet the edges')))
B.append(OL(L(['Premi **Raccordo** e scrivi **5** in **Raggio**.','Fai clic su tre spigoli verticali, quelli che vedi.','Il quarto è dietro: trascina con il tasto sinistro nel vuoto per girare la vista, e fai clic anche su di lui. Nel pannello ora ci sono 4 spigoli.','Conferma con **✓**.'],
 ['Press **Fillet** and type **5** in **Radius**.','Click three vertical edges, the ones you can see.','The fourth one is at the back: drag with the left button on empty space to turn the view, and click it too. The panel now lists 4 edges.','Confirm with **✓**.'])))
B.append(fig('es-7-raccordo',L('Raccordo con i primi tre spigoli scelti.','Fillet with the first three edges chosen.')))
B.append(H2(L('Scegli il materiale e controlla i numeri','Choose the material and check the numbers')))
B.append(OL(L(['Apri la scheda **Valuta**, premi **Materiale**, scegli **Acciaio S235JR** e premi **Applica**.','Premi **Proprietà di massa**. Confronta i numeri con il calcolo a mano qui sotto.'],
 ['Open the **Evaluate** tab, press **Material**, choose **Steel S235JR** and press **Apply**.','Press **Mass Properties**. Compare the numbers with the hand calculation below.'])))
B.append(fig('es-10-massa',L('Proprietà di massa del pezzo finito.','Mass properties of the finished part.')))
B.append(TAB(L(['Grandezza','Calcolo a mano','Risultato'],['Quantity','Hand calculation','Result']),L([
 ['Piastra piena','80 × 50 × 10','40 000,00 mm³'],
 ['Foro','− π × 10² × 10','− 3 141,59 mm³'],
 ['4 raccordi','− 4 × (1 − π/4) × 5² × 10','− 214,60 mm³'],
 ['**Volume**','','**36 643,81 mm³**'],
 ['**Massa**','36 643,81 mm³ × 0,00785 g/mm³','**287,65 g**']],[
 ['Solid plate','80 × 50 × 10','40,000.00 mm³'],
 ['Hole','− π × 10² × 10','− 3,141.59 mm³'],
 ['4 fillets','− 4 × (1 − π/4) × 5² × 10','− 214.60 mm³'],
 ['**Volume**','','**36,643.81 mm³**'],
 ['**Mass**','36,643.81 mm³ × 0.00785 g/mm³','**287.65 g**']])))
B.append(P(L('Il programma dà gli stessi valori: volume 36643,81 mm³ e massa 287,65 g. Il baricentro è al centro del pezzo, a X = 40, Y = 5, Z = −25 mm.',
 'The program gives the same values: volume 36643.81 mm³ and mass 287.65 g. The center of mass is in the middle of the part, at X = 40, Y = 5, Z = −25 mm.')))
B.append(H2(L('Fai la tavola','Make the drawing')))
B.append(OL(L(['Apri la scheda **Messa in tavola**: le viste si preparano da sole, con il metodo europeo.','Premi **Quote di ingombro** per aggiungere le quote di base, poi **Quota** per quelle che mancano, come il foro.','Premi **Salva PDF** per avere la tavola sul foglio vero, pronta da stampare in scala.'],
 ['Open the **Drawing** tab: the views get ready by themselves, with the European method (first angle).','Press **Overall dimensions** to add the basic dimensions, then **Dimension** for the missing ones, like the hole.','Press **Save PDF** to get the drawing on the real sheet, ready to print to scale.'])))
B.append(fig('es-12-tavola-quote',L('La tavola con viste, assonometria, quote di ingombro e cartiglio.','The drawing with views, isometric view, overall dimensions and title block.')))
B.append(H2(L('Prova a cambiare il pezzo','Try changing the part')))
B.append(P(L('Qui si vede la forza del metodo parametrico. Fai doppio clic su **Estrusione1** nell\'albero, cambia la profondità in 15 e conferma: foro e raccordi si adattano da soli. Con **Annulla** torni indietro. Da qui in poi il manuale spiega ogni comando uno per uno.',
 'Here you see the strength of the parametric method. Double-click **Boss-Extrude1** in the tree, change the depth to 15 and confirm: hole and fillets adapt by themselves. With **Undo** you go back. From here on the manual explains every command one by one.')))
B.append(fig('es-8-finito',L('Il pezzo finito, con la sua storia nell\'albero.','The finished part, with its history in the tree.')))
# ---------- guida
FIG={'sk-colori':None,'loft':('loft',L('Estrusione con loft: tre profili girati su tre piani diversi diventano una pala svergolata.','Lofted Boss/Base: three rotated profiles on three different planes become a twisted blade.')),'elica':('elica',L('Una molla: cerchio Ø5 che scorre lungo un\'elica di passo 12 mm e 5 giri.','A spring: a Ø5 circle swept along a helix with 12 mm pitch and 5 revolutions.')),'sk-dxf':('importa-dxf',L('La finestra di importazione: anteprima, layer, sfondo.','The import window: preview, layers, background.')),'corpi':('corpi-ambito',L('Ambito funzione e albero sopra la vista, con schizzi e corpi scelti per nome.','Feature Scope and the tree over the view, with sketches and bodies chosen by name.')),
 'fori':('foro',L('Creazione guidata fori: in arancione la faccia, poi si mettono le posizioni.','Hole Wizard: the face in orange, then you place the positions.')),'serie-lin':('serie',L('Pannello della serie lineare.','The linear pattern panel.')),'misura':('misura',L('Misura di una faccia: l\'area è nel pannello.','Measuring a face: the area is in the panel.')),'sezione':('sezione',L('Vista in sezione nel modello 3D, con la barra in basso.','Section view in the 3D model, with the bar at the bottom.')),
 'assieme':('assieme-inserito',L('Assieme con due componenti inseriti: (f) fissa, (-) sotto definita.','Assembly with two components inserted: (f) fixed, (-) under defined.')),'accoppiamenti':('assieme-accoppiamento',L('Accoppiamento concentrico tra perno e foro.','Concentric mate between pin and hole.')),'viti':('viti',L('La finestra per inserire viti, dadi e rondelle.','The window to insert screws, nuts and washers.')),'calcoli-assieme':('distinta',L('La distinta base, che si può salvare in CSV.','The bill of materials, which can be saved as CSV.')),'esplosa':('assieme-esplosa',L('Vista esplosa: il perno sollevato di 40 mm dal foro.','Exploded view: the pin lifted 40 mm out of the hole.')),'tavola-assieme':('assieme-tavola',L('Tavola dell\'assieme con distinta e numeri di posizione.','Assembly drawing with bill of materials and balloons.')),'interferenze':('interferenze',L('Il pannello di Verifica interferenze.','The Interference Detection panel.'))}
cmdname={c['id']:c['t'] for v in d['cmds'].values() for c in v}
CH=[('Per iniziare',L('Vista, salvataggi e importazioni','View, saving and importing')),('Schizzo',L('Lo schizzo','The sketch')),('Funzioni',L('Le funzioni','The features')),('Albero e modifiche',L('Modificare il modello','Editing the model')),('Valuta',L('Valutare il pezzo','Evaluating the part')),('Assieme',L('L\'assieme','The assembly')),('Messa in tavola',L('La messa in tavola','The drawing'))]
INTRO=L({'Per iniziare':'Le cose di base che servono qualunque cosa tu stia facendo: muovere la vista, salvare il lavoro, aprire i file di altri programmi.',
'Schizzo':'Lo schizzo è il disegno 2D da cui nascono quasi tutte le funzioni. Prima si disegna la forma, poi le quote e le relazioni decidono le misure.',
'Funzioni':'Le funzioni trasformano gli schizzi in solidi e li lavorano. Ognuna si aggiunge all\'albero e si può modificare in qualunque momento.',
'Albero e modifiche':'L\'albero è la storia del pezzo. Da qui si torna su ogni passo per cambiarlo.',
'Valuta':'I controlli sul pezzo: massa, misure, sezioni, e la prova che i calcoli del programma siano giusti.',
'Assieme':'L\'assieme mette insieme più parti dello stesso progetto e ne stabilisce i collegamenti. Le parti stanno tutte dentro il progetto, in un solo file.',
'Messa in tavola':'La tavola è il disegno tecnico del pezzo o dell\'assieme, secondo le norme ISO, pronto da stampare o da consegnare.'},
{'Per iniziare':'The basic things you need whatever you are doing: moving the view, saving your work, opening files from other programs.',
'Schizzo':'The sketch is the 2D drawing from which almost all features are made. First you draw the shape, then dimensions and relations set the sizes.',
'Funzioni':'Features turn sketches into solids and work on them. Each one is added to the tree and can be edited at any time.',
'Albero e modifiche':'The tree is the history of the part. From here you go back to any step to change it.',
'Valuta':'The checks on the part: mass, measurements, sections, and the proof that the program\'s calculations are right.',
'Assieme':'The assembly puts together several parts of the same project and sets how they are connected. The parts all live inside the project, in a single file.',
'Messa in tavola':'The drawing is the technical drawing of the part or of the assembly, to ISO standards, ready to print or hand in.'})
SKIP={'interfaccia'}
GEN=d['en']['guide']['argomenti'] if EN else {}
def loc(t):
    # testi dell'argomento nella lingua del manuale (in inglese da Guide.en, come nella pagina)
    if not EN: return t
    if t['id'] not in GEN: sys.exit('argomento senza traduzione: '+t['id'])
    return GEN[t['id']]
for cap,title in CH:
    B.append(H1(title)); B.append(P(INTRO[cap]))
    for t in [x for x in d['topics'] if x['cap']==cap and x['id'] not in SKIP]:
        l=loc(t)
        B.append('<section class="topic">'+H2(l['t']))
        B.append(f'<p class="why">{fmt(l["why"])}</p>')
        c=t.get('cmd')
        if c and c.get('id') in cmdname:
            tn=html.escape(tabname.get(c.get("tab"),"")); cn=html.escape(cmdname[c["id"]])
            B.append(L(f'<p class="where"><b>Dove si trova:</b> scheda {tn} › {cn}</p>',f'<p class="where"><b>Where to find it:</b> {tn} tab › {cn}</p>'))
        B.append(OL(l['steps']))
        for tip in l.get('tips',[]): B.append(TIP(tip,L('Consiglio','Tip')))
        B.append('</section>')
        if t['id']=='sk-colori': B.append('<div class="two">'+fig('es-1-rettangolo',L('Blu: sotto definito.','Blue: under defined.'))+fig('es-2-quote',L('Nero: completamente definito.','Black: fully defined.'))+'</div>')
        if FIG.get(t['id']): B.append(fig(*FIG[t['id']]))
# ---------- formati
B.append(H1(L('I file: cosa si apre e cosa si scrive','Files: what opens and what is written')))
B.append(H2(L('Aprire file di altri programmi','Opening files from other programs')))
B.append(TAB(L(['Formato','Comando','Cosa diventa','Da sapere'],['Format','Command','What it becomes','Good to know']),L([
 ['**STEP** (.step, .stp), **IGES** (.igs, .iges)','Progetto › Importa STEP o IGES','Solido «Importato», con le facce vere divise in triangoli fitti','Unità lette dal file, colori del file, scelta dei corpi. Al massimo 100 000 triangoli: oltre, le superfici si dividono più grossolanamente.'],
 ['**STL**, **OBJ**','Progetto › Importa STL o OBJ','Solido «Importato» a faccette','Si scelgono le unità (mm, cm, m, pollici). Al massimo 100 000 triangoli. Avviso se il corpo non è chiuso.'],
 ['**DXF**, **DWG**','Progetto › Importa DXF o DWG (schizzo); oppure Inserisci DXF o DWG nella scheda Schizzo','Linee, archi e cerchi in uno schizzo','Scelta dei layer, anteprima, nessun limite di entità. DWG da R1.4 a 2018. Testi, quote e tratteggi diventano uno sfondo di riferimento.'],
 ['**Progetto** (.json)','Progetto › Importa un progetto','Il progetto com\'era','Il file è quello di Esporta il progetto.']],[
 ['**STEP** (.step, .stp), **IGES** (.igs, .iges)','Project › Import STEP or IGES','“Imported” solid, with the true faces divided into fine triangles','Units read from the file, colors of the file, choice of bodies. At most 100,000 triangles: beyond that, the surfaces are divided more coarsely.'],
 ['**STL**, **OBJ**','Project › Import STL or OBJ','Faceted “Imported” solid','You choose the units (mm, cm, m, inches). At most 100,000 triangles. Warning if the body is not closed.'],
 ['**DXF**, **DWG**','Project › Import DXF or DWG (sketch); or Insert DXF or DWG in the Sketch tab','Lines, arcs and circles in a sketch','Choice of layers, preview, no limit on entities. DWG from R1.4 to 2018. Texts, dimensions and hatches become a reference background.'],
 ['**Project** (.json)','Project › Import a project','The project as it was','The file is the one from Export project.']]),'wide'))
B.append(TIP(L('I pezzi importati arrivano **senza la storia delle funzioni**: le quote originali non si modificano, ma si possono aggiungere funzioni nuove sopra. Gli schizzi da DXF arrivano senza quote, quindi blu: si possono quotare.',
 'Imported parts arrive **without the feature history**: the original dimensions cannot be edited, but new features can be added on top. Sketches from DXF arrive without dimensions, so blue: you can dimension them.')))
B.append(P(L('I file proprietari di SolidWorks (.sldprt, .sldasm, .slddrw) e di Inventor (.ipt, .iam, .idw, .ipn) **non si possono aprire**, perché le loro specifiche non sono pubbliche. Dal programma d\'origine esporta in STEP le parti e gli assiemi, in DXF le tavole.',
 'The proprietary files of SolidWorks (.sldprt, .sldasm, .slddrw) and of Inventor (.ipt, .iam, .idw, .ipn) **cannot be opened**, because their specifications are not public. From the original program, export parts and assemblies to STEP, drawings to DXF.')))
B.append(H2(L('Salvare per altri programmi','Saving for other programs')))
B.append(TAB(L(['Formato','Comando','Da sapere'],['Format','Command','Good to know']),L([
 ['**Progetto** (.json)','Progetto › Esporta il progetto','Tutto il lavoro, da riaprire nel Banco CAD.'],
 ['**PDF**','Salva PDF','La tavola è vettoriale, sul foglio vero, in scala 1:1. Lo schizzo va su A4 orizzontale con la scala unificata più grande che lo fa entrare. La vista 3D è un\'immagine.'],
 ['**STEP** (AP214)','Progetto › Esporta STEP','In mm, con le superfici vere (piani, cilindri, coni, sfere, tori). Un solido per corpo o per componente.'],
 ['**STL**','Progetto › Esporta STL','Per la stampa 3D.'],
 ['**SVG**, **DXF**','Scheda Messa in tavola','La tavola. Nel DXF l\'assonometria resta a linee, anche se a video è ombreggiata.']],[
 ['**Project** (.json)','Project › Export project','All the work, to open again in Banco CAD.'],
 ['**PDF**','Save PDF','The drawing is vector, on the real sheet, at 1:1 scale. The sketch goes on a landscape A4 with the largest standard scale that fits it. The 3D view is an image.'],
 ['**STEP** (AP214)','Project › Export STEP','In mm, with the true surfaces (planes, cylinders, cones, spheres, tori). One solid per body or per component.'],
 ['**STL**','Project › Export STL','For 3D printing.'],
 ['**SVG**, **DXF**','Drawing tab','The drawing. In the DXF the isometric view stays as lines, even if it is shaded on screen.']]),'wide'))
B.append(H2(L('Il Convertitore DWG → DXF','The DWG → DXF Converter')))
B.append(P(L('Il Banco CAD apre direttamente i DWG. Il **Convertitore DWG → DXF** è un programma separato, per chi vuole salvare i DXF, usarli in altri programmi o convertire molti disegni insieme: **rayuk-creator.github.io/CAD/convertitore-dwg**.',
 'Banco CAD opens DWG files directly. The **DWG → DXF Converter** is a separate program, for those who want to save the DXF files, use them in other programs or convert many drawings at once: **rayuk-creator.github.io/CAD/convertitore-dwg**.')))
# ---------- problemi
B.append(H1(L('Problemi frequenti e limiti','Common problems and limits')))
B.append(H2(L('Se qualcosa non va','If something goes wrong')))
B.append(TAB(L(['Cosa succede','Cosa fare'],['What happens','What to do']),L([
 ['Il programma «non si carica», la pagina sembra a metà','Controlla l\'indirizzo: quello giusto è **rayuk-creator.github.io/CAD**, non la pagina del repository su github.com.'],
 ['Non ritrovo il mio lavoro','Il lavoro sta nel browser dove l\'hai fatto. Sito e file scaricato sono separati, così come due browser o due computer. Per spostarlo usa Esporta e Importa il progetto.'],
 ['Lo schizzo è blu','Mancano quote o relazioni. Si può estrudere lo stesso, ma è meglio finirlo: un pezzo con tutto nero non cambia per sbaglio.'],
 ['Lo schizzo è rosso','Ci sono quote o relazioni di troppo, o in contrasto tra loro. Togli l\'ultima che hai messo, oppure usa Annulla.'],
 ['Il profilo non si estrude','Il contorno deve essere chiuso e non deve incrociarsi. Il messaggio rosso nel pannello dice cosa non va.'],
 ['Un punto esclamativo «!» nell\'albero dell\'assieme','Un elemento dell\'accoppiamento è sparito, per esempio dopo una modifica alla parte, oppure l\'accoppiamento è impossibile. Aprilo e scegli di nuovo gli elementi.'],
 ['Un file .sldprt o .ipt non si apre','Sono formati proprietari: esporta dal programma d\'origine in STEP.'],
 ['Un DWG dentro uno .zip non si apre','Il messaggio lo dice: estrai prima il DWG dallo zip.'],
 ['Voglio sapere se i calcoli sono giusti','Scheda **Valuta › Autoverifica**: il programma rifà le sue prove con valori calcolati a mano.']],[
 ['The program “does not load”, the page looks half done','Check the address: the right one is **rayuk-creator.github.io/CAD**, not the repository page on github.com.'],
 ['I cannot find my work','Your work is in the browser where you made it. Website and downloaded file are separate, and so are two browsers or two computers. To move it use Export and Import project.'],
 ['The sketch is blue','Dimensions or relations are missing. You can extrude it anyway, but it is better to finish it: a part that is all black does not change by mistake.'],
 ['The sketch is red','There are too many dimensions or relations, or they conflict. Remove the last one you added, or use Undo.'],
 ['The profile does not extrude','The outline must be closed and must not cross itself. The red message in the panel says what is wrong.'],
 ['An exclamation mark “!” in the assembly tree','An element of the mate has disappeared, for example after a change to the part, or the mate is impossible. Open it and choose the elements again.'],
 ['A .sldprt or .ipt file does not open','They are proprietary formats: export to STEP from the original program.'],
 ['A DWG inside a .zip does not open','The message says so: extract the DWG from the zip first.'],
 ['I want to know if the calculations are right','**Evaluate › Self-check** tab: the program runs its tests again with values calculated by hand.']]),'wide'))
B.append(H2(L('Limiti da conoscere','Limits to know')))
B.append(UL(L(['**Testi nel PDF:** usano Helvetica; i caratteri fuori dall\'alfabeto occidentale diventano «?» (per esempio ⌀ diventa Ø).',
 '**PDF della vista 3D:** è un\'immagine alla risoluzione dello schermo. Per una stampa nitida usa il PDF della tavola.',
 '**Assonometria ombreggiata:** con pezzi molto intrecciati qualche faccia può coprirne un\'altra nel modo sbagliato.',
 '**Sfondo del disegno:** le tabelle dei DWG dal 2010 in poi non si leggono; la larghezza dei testi può differire un po\' da AutoCAD.',
 '**Viti e filetti:** il filetto è indicato, salvo l\'opzione dell\'elica; nell\'assonometria i filetti non si disegnano; le lunghezze seguono la serie ISO 888, ma i campi disponibili per ogni misura dipendono dal fornitore.',
 '**Interferenze:** una sola coppia di pezzi enormi può tenere ferma la pagina anche per un minuto o più.',
 '**Assiemi:** un sottoassieme dentro un sottoassieme flessibile resta rigido; le superfici libere di uno STEP si accoppiano solo con la Tangente, contro un piano o una sfera.',
 '**Selezione automatica dell\'ambito:** non si ricalcola a pannello chiuso. Per i corpi aggiunti dopo, riapri la funzione.',
 '**Loft:** senza curve guida e senza tangenze imposte agli estremi; ogni profilo è un solo contorno chiuso, su un piano suo.',
 '**Elica e spirale:** il profilo gira sempre con la curva («Segui percorso») e va disegnato su un piano che passa per l\'inizio della curva. Le facce curve di molle e loft sono faccette: nello STEP restano piane.'],
 ['**Texts in the PDF:** they use Helvetica; characters outside the Western alphabet become “?” (for example ⌀ becomes Ø).',
 '**PDF of the 3D view:** it is an image at screen resolution. For a sharp print use the PDF of the drawing.',
 '**Shaded isometric view:** with very intertwined parts some face may cover another one the wrong way.',
 '**Drawing background:** tables in DWG files from 2010 on cannot be read; the width of texts may differ a little from AutoCAD.',
 '**Screws and threads:** the thread is cosmetic, except with the helix option; threads are not drawn in the isometric view; lengths follow the ISO 888 series, but the ranges available for each size depend on the supplier.',
 '**Interferences:** a single pair of huge parts can freeze the page for a minute or more.',
 '**Assemblies:** a subassembly inside a flexible subassembly stays rigid; the free-form surfaces of a STEP file can only be mated with Tangent, against a plane or a sphere.',
 '**Auto-select of the scope:** it is not recalculated with the panel closed. For bodies added later, open the feature again.',
 '**Loft:** no guide curves and no tangency imposed at the ends; each profile is a single closed outline, on a plane of its own.',
 '**Helix and spiral:** the profile always turns with the curve (“Follow path”) and must be drawn on a plane that goes through the start of the curve. The curved faces of springs and lofts are facets: in the STEP file they stay flat.'])))
# ---------- glossario
B.append(H1(L('Glossario','Glossary')))
B.append(P(L('Tutti i termini del programma, in ordine alfabetico. Tra parentesi la scheda o l\'argomento a cui appartengono.',
 'All the terms of the program, in alphabetical order. In brackets the tab or the subject they belong to.')))
import unicodedata
key=lambda e:unicodedata.normalize('NFD',e[1]).encode('ascii','ignore').decode().lower()
g=sorted(d['en']['entries'] if EN else d['entries'],key=key);cur=None;out=['<div class="gloss">']
for e in g:
    LL=key(e)[0].upper()
    if not LL.isalpha(): LL='#'
    if LL!=cur: out.append(f'<div class="gl-l">{LL}</div>');cur=LL
    out.append(f'<p class="gl"><b>{html.escape(e[1])}</b> <span class="gc">({html.escape(e[0])})</span> {fmt(e[3])}</p>')
out.append('</div>');B.append(''.join(out))
# ---------- norme, licenze
B.append(H1(L('Autori e licenze','Authors and licenses')))
B.append(P(L('**Banco CAD** – Copyright © 2026 Rayuk-creator. Il programma è software libero: si può usare, copiare e modificare secondo la licenza **GNU GPL 3**, con le condizioni aggiuntive del file CONDIZIONI-AGGIUNTIVE.md. È distribuito senza alcuna garanzia. Il nome «Banco CAD» si può usare solo per dire da dove viene il programma, non come nome di una versione modificata.',
 '**Banco CAD** – Copyright © 2026 Rayuk-creator. The program is free software: you can use, copy and modify it under the **GNU GPL 3** license, with the additional terms of the file CONDIZIONI-AGGIUNTIVE.md. It comes with no warranty. The name “Banco CAD” may only be used to say where the program comes from, not as the name of a modified version.')))
B.append(P(L('Parti di altri autori incluse nel programma:','Parts by other authors included in the program:')))
B.append(TAB(L(['Parte','A cosa serve','Licenza'],['Part','What it is for','License']),L([
 ['OpenCascade, tramite occt-import-js','Leggere STEP e IGES','LGPL 2.1'],['LibreDWG, tramite libredwg-web','Leggere i DWG','GPL 3'],['csg.js','Operazioni booleane','MIT'],['IBM Plex','Caratteri','OFL 1.1']],[
 ['OpenCascade, through occt-import-js','Reading STEP and IGES','LGPL 2.1'],['LibreDWG, through libredwg-web','Reading DWG files','GPL 3'],['csg.js','Boolean operations','MIT'],['IBM Plex','Fonts','OFL 1.1']])))
B.append(P(L('Per l\'elenco completo: **Progetto › Informazioni e licenze** nel programma, oppure la cartella licenze/ del repository github.com/Rayuk-creator/CAD. SolidWorks, AutoCAD e Inventor sono marchi dei rispettivi proprietari; il Banco CAD non è collegato a loro.',
 'For the full list: **Project › About and licenses** in the program, or the licenze/ folder of the repository github.com/Rayuk-creator/CAD. SolidWorks, AutoCAD and Inventor are trademarks of their respective owners; Banco CAD is not affiliated with them.')))
B.append(P(L('Questo manuale, come il programma, è scritto con l\'aiuto di Claude. Le misure dell\'esercizio sono state controllate nel programma e con il calcolo a mano.',
 'This manual, like the program, is written with the help of Claude. The measurements of the exercise were checked in the program and with hand calculations.')))
body='\n'.join(B)
tocl=['<div class="toc">']
for lv,num,t,i in toc:
    pg=pages.get(i,'')
    tocl.append(f'<a class="l{lv}" href="#{i}"><span class="tn">{num}</span><span class="tt">{html.escape(t)}</span><span class="tp">{pg}</span></a>')
tocl.append('</div>')
CSS=open(HERE+'/style.css').read()
if EN: CSS=CSS.replace("Banco CAD – Manuale d'uso","Banco CAD – User manual")
TITLE=L("Banco CAD – Manuale d'uso","Banco CAD – User manual")
COVER=L('''<div class="cv-top">Modellatore 3D parametrico per la scuola</div><div class="cv-title">Banco CAD</div><div class="cv-sub">Manuale d'uso</div><img src="img/es-8-crop.png" alt=""><div class="cv-foot"><div>Schizzi · Funzioni · Assiemi · Messa in tavola</div><div>Aggiornato al 12 novembre 2026 · © 2026 Rayuk-creator · rayuk-creator.github.io/CAD</div></div>''',
 '''<div class="cv-top">Parametric 3D modeler for schools</div><div class="cv-title">Banco CAD</div><div class="cv-sub">User manual</div><img src="img/es-8-crop.png" alt=""><div class="cv-foot"><div>Sketches · Features · Assemblies · Drawings</div><div>Updated on 12 November 2026 · © 2026 Rayuk-creator · rayuk-creator.github.io/CAD</div></div>''')
doc=f'''<!doctype html><html lang="{L('it','en')}"><head><meta charset="utf-8"><title>{TITLE}</title>{fonts}<style>{CSS}</style></head><body>
<section class="cover">{COVER}</section>
<section class="tocpage"><div class="toc-h">{L('Indice','Contents')}</div>{''.join(tocl)}</section>
<main>{body}</main></body></html>'''
open(M+'/manuale.html','w',encoding='utf-8').write(doc)
json.dump([list(x) for x in toc],open(M+'/toc.json','w'),ensure_ascii=False)
print('html',len(doc),'voci',len(toc))
