import json,re,html,sys,base64,os
HERE=os.path.dirname(os.path.abspath(__file__));M=os.path.abspath(sys.argv[1])  # cartella di lavoro
d=json.load(open(M+'/data.json'))
idx=open(HERE+'/../../index.html',encoding='utf-8').read().split('\n')
a=next(i for i,l in enumerate(idx) if 'CARATTERI: inizio' in l); b=next(i for i,l in enumerate(idx) if 'CARATTERI: fine' in l)
fonts='\n'.join(idx[a+1:b])
pages=json.load(open(M+'/pages.json')) if os.path.exists(M+'/pages.json') else {}
def fmt(s):
    s=html.escape(s,quote=False)
    s=re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]',r'<em>\2</em>',s)
    s=re.sub(r'\[\[([^\]]+)\]\]',r'<em>\1</em>',s)
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
def TIP(s,t='Da ricordare'): return f'<div class="tip"><b>{t}</b> {fmt(s)}</div>'
def TAB(head,rows,cls=''):
    return f'<table class="{cls}"><thead><tr>'+''.join(f'<th>{fmt(h)}</th>' for h in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{fmt(str(c))}</td>' for c in r)+'</tr>' for r in rows)+'</tbody></table>'
B=[]
# ---------- 1
B.append(H1('Che cos\'è il Banco CAD'))
B.append(P('Il **Banco CAD** è un modellatore 3D parametrico pensato per la scuola, in particolare per gli istituti tecnici di meccanica e meccatronica. Si ispira a SolidWorks in tutto: nomi dei comandi, modo di lavorare, albero delle funzioni, pannelli, colori dello schizzo e messa in tavola secondo le norme ISO. Chi impara qui ritrova le stesse idee nei programmi professionali.'))
B.append(P('«Parametrico» vuol dire che il pezzo è costruito con una storia di passi modificabili: cambi una quota dello schizzo o la profondità di un\'estrusione, e tutto il pezzo si ricalcola.'))
B.append(H2('Cosa si può fare'))
B.append(UL(['**Disegnare schizzi** con linee, rettangoli, cerchi, archi e poligoni, vincolati con quote e relazioni.',
 '**Costruire pezzi** con estrusioni, tagli, rivoluzioni, sweep, nervature, fori unificati, raccordi, smussi, serie e specchi, anche con più corpi solidi.',
 '**Valutare** massa, volume e baricentro con 13 materiali, misurare e sezionare il pezzo.',
 '**Montare assiemi** con accoppiamenti, sottoassiemi, viti e bulloni unificati, distinta base, verifica delle interferenze e vista esplosa.',
 '**Fare le tavole** secondo il metodo europeo (ISO 5456-2, metodo E), con quote, sezioni e cartiglio, e salvarle in PDF, SVG o DXF.',
 '**Scambiare file** con altri programmi: si aprono STEP, IGES, STL, OBJ, DXF e DWG; si scrivono STEP e STL.']))
B.append(H2('Come si apre'))
B.append(P('Il programma è **un solo file**, senza installazione. Ci sono due modi per usarlo.'))
B.append(TAB(['Modo','Cosa fare','Quando conviene'],[
 ['**Dal sito**','Apri **rayuk-creator.github.io/CAD** nel browser.','Si aggiorna da solo; va bene anche su tablet e telefono.'],
 ['**Dal file**','Su github.com/Rayuk-creator/CAD apri il file index.html, premi **Download raw file**, rinominalo per esempio banco-cad.html e aprilo con un doppio clic.','Funziona senza internet: per esempio a scuola, in un laboratorio senza rete.']]))
B.append(TIP('L\'indirizzo giusto è **rayuk-creator.github.io/CAD**. Sulla pagina del repository (github.com/Rayuk-creator/CAD) il programma non gira, e sembra caricato a metà.','Attenzione'))
B.append(P('Serve un browser recente con la grafica 3D (WebGL) attiva. Le prove automatiche del programma si fanno su Chromium, il motore di Chrome ed Edge.'))
B.append(H2('Dove finisce il tuo lavoro'))
B.append(P('Il lavoro si salva **da solo nel browser** che stai usando, su quel computer. Tutto il calcolo avviene lì: il programma non chiede nulla ad altri siti e i tuoi pezzi restano sul tuo computer. Da questo seguono tre regole pratiche.'))
B.append(UL(['Il lavoro fatto sul sito e quello fatto con il file scaricato **restano separati**, anche sullo stesso computer. Lo stesso vale tra un browser e l\'altro.',
 'Per portare un progetto su un altro computer, o per conservarlo al sicuro, usa **Progetto › Esporta il progetto**; per riaprirlo, **Progetto › Importa un progetto**.',
 'Se cancelli i dati di navigazione del browser, puoi perdere il lavoro. Esporta il progetto ogni tanto: è la tua copia di sicurezza.']))
# ---------- 2
B.append(H1('Lo schermo e i comandi'))
B.append('''<figure class="anno"><div class="annobox"><img src="img/schermo.png" alt="Lo schermo del Banco CAD">'''+''.join(f'<span class="dot" style="left:{x}%;top:{y}%">{k}</span>' for k,x,y in [(1,17,3),(2,37,8),(3,97,8.2),(4,17.5,30),(5,62,70),(6,70,21),(7,20,88),(8,13,98.5),(9,69,3)])+'''</div><figcaption>Le parti dello schermo. I numeri corrispondono alla tabella qui sotto.</figcaption></figure>''')
B.append(TAB(['','Parte','A cosa serve'],[
 ['1','**Nome e parte aperta**','Il nome della parte. Con più parti o assiemi compare qui l\'elenco per passare dall\'una all\'altro.'],
 ['2','**Schede**','Funzioni, Schizzo, Valuta, Messa in tavola, Assieme: ognuna mostra i suoi comandi.'],
 ['3','**CommandManager**','I pulsanti dei comandi della scheda scelta.'],
 ['4','**Albero di progettazione**','Piani, origine, corpi e funzioni nell\'ordine in cui li hai fatti. Quando crei o modifichi una funzione, qui compare il **PropertyManager**, cioè il pannello con i parametri.'],
 ['5','**Vista 3D**','Il pezzo. Si seleziona con un clic; a pannello aperto compare anche un piccolo albero sopra la vista, per scegliere per nome.'],
 ['6','**Barretta della vista**','Adatta, orientamenti, stile di visualizzazione, sezione, piani.'],
 ['7','**Assi**','Mostrano come è girato il pezzo: X rosso, Y verde, Z blu.'],
 ['8','**Barra di stato**','Dice cosa è selezionato e, nello schizzo, se è definito.'],
 ['9','**Annulla, Guida, Glossario, Progetto**','Annulla e Ripeti; la Guida «come si fa»; il dizionario dei termini; il menu con salvataggi, importazioni ed esportazioni.']],'tabnum'))
B.append(TIP('✓ conferma e ✕ annulla. La piccola ⓘ accanto a un titolo spiega quella voce.','Nei pannelli'))
B.append(H2('Muovere la vista'))
B.append(TAB(['Mouse','Azione'],[
 ['Rotella avanti / indietro','Ingrandisce / riduce verso il puntatore (anche nella messa in tavola)'],
 ['Ctrl + rotella','Ruota il pezzo'],
 ['Trascina con il tasto sinistro','Ruota il pezzo'],
 ['Trascina con il tasto destro, oppure Maiusc + sinistro','Sposta la vista'],
 ['Clic','Seleziona; Ctrl + clic ne seleziona più di uno']]))
B.append(TAB(['Tablet','Azione'],[
 ['Due dita, sempre','Zoom'],
 ['Tocca prima il pezzo («Pezzo preso», bordo blu), poi un dito','Ruota'],
 ['Tocca prima il pezzo, poi due dita','Sposta'],
 ['Tocco nel vuoto oppure «Lascia»','Rilascia il pezzo']]))
B.append(TAB(['Tastiera','Azione'],[
 ['F','Adatta il pezzo alla finestra'],['Barra spaziatrice','Apre gli orientamenti della vista'],
 ['Ctrl + Z / Ctrl + Y','Annulla / Ripeti (anche Ctrl + Maiusc + Z)'],['Esc','Annulla il comando o chiude il pannello; nello schizzo torna alla selezione'],['Invio','Conferma il pannello aperto; nello schizzo conferma lo schizzo'],['Canc','Elimina ciò che è selezionato']]))
B.append(H2('Guida e Glossario dentro il programma'))
B.append(P('Questo manuale riprende i testi della **Guida** e del **Glossario**, che sono sempre a portata di mano nel programma. La Guida ha il pulsante **Mostrami dove**, che indica il comando sullo schermo. Il Glossario spiega ogni termine; dai titoli dei pannelli si apre con la ⓘ.'))
B.append('<div class="two">'+fig('guida','La Guida resta aperta a destra mentre lavori.')+fig('glossario','Il Glossario, con il collegamento a «come si fa».')+'</div>')
B.append(H2('Tutti i comandi, scheda per scheda'))
names={'features':'Scheda Funzioni','sketch':'Scheda Schizzo','evaluate':'Scheda Valuta','drawing':'Scheda Messa in tavola','assembly':'Scheda Assieme'}
for k in ['sketch','features','evaluate','drawing','assembly']:
    B.append(f'<h3>{names[k]}</h3>')
    B.append(TAB(['Comando','Cosa fa'],[[f"**{c['t']}**",c['tip'].split('\n')[0]] for c in d['cmds'][k]],'cmds'))
B.append('<h3>Menu Progetto</h3>')
MP={'new':'Comincia un progetto vuoto.','addPart':'Aggiunge un\'altra parte allo stesso progetto.','delPart':'Toglie la parte aperta e i suoi componenti negli assiemi. Non si può annullare.','export':'Salva il progetto in un file: è la copia di sicurezza e il modo per spostarlo.','import':'Riapre un progetto salvato.','importCad':'Apre un solido da un file STEP o IGES.','importMesh':'Apre un solido fatto di triangoli da un file STL o OBJ.','importDxf':'Porta un disegno 2D in uno schizzo.','pdf':'Salva in PDF la tavola, lo schizzo o la vista 3D, secondo cosa stai guardando.','step':'Scrive il pezzo per aprirlo in un altro programma CAD.','stl':'Scrive il pezzo per la stampa 3D.','help':'Apre la Guida.','manual':'Apre questo manuale in PDF (serve la connessione a Internet).','about':'Mostra autori e licenze.'}
B.append(TAB(['Voce','Cosa fa'],[[f"**{x['t']}**",MP.get(x['act'],'')] for x in d['menu']],'cmds'))
B.append(fig('menu-progetto','Il menu Progetto si apre con il pulsante in alto a destra. Il nome di «Salva PDF» cambia secondo cosa stai guardando.'))
# ---------- 3
B.append(H1('Esercizio guidato: una piastra con foro'))
B.append(P('Il modo più veloce per imparare è fare un pezzo vero dall\'inizio alla fine. Costruiremo una piastra **80 × 50 × 10 mm** con un foro centrale **Ø 20** e i quattro spigoli verticali raccordati **R 5**. Alla fine controlleremo i numeri con un calcolo a mano. Tutti i passi sono stati eseguiti davvero nel programma, con il mouse.'))
B.append(H2('Disegna il rettangolo'))
B.append(OL(['Apri la scheda **Schizzo**, fai clic su **Piano superiore** nell\'albero, poi premi **Schizzo**. La vista si gira da sola.','Premi **Rettangolo**. Fai clic sull\'origine (il puntatore si aggancia da solo), poi fai clic su un punto in alto a destra. Le misure non contano: le sistemeranno le quote.','Premi **Esc** per tornare alla selezione. Le linee sono **blu**: lo schizzo non è ancora definito.']))
B.append(fig('es-1-rettangolo','Rettangolo appena disegnato: blu vuol dire «si può ancora muovere».'))
B.append(H2('Metti le quote'))
B.append(OL(['Premi **Quota intelligente**. Fai clic sul lato in basso, poi sotto il lato per posizionare la quota. Scrivi **80** e premi **Invio**.','Fai clic sul lato destro, poi alla sua destra. Scrivi **50** e premi **Invio**.','Ora le linee sono **nere** e in basso c\'è scritto **Completamente definito**.']))
B.append(fig('es-2-quote','Schizzo nero: forma e posizione sono decise del tutto.'))
B.append(H2('Estrudi'))
B.append(OL(['Apri la scheda **Funzioni** e premi **Estrusione base**: lo schizzo si conferma da solo.','Nel pannello scrivi **10** in **Profondità**. L\'anteprima arancione mostra il materiale che verrà aggiunto.','Conferma con **✓**. Il pezzo è nato, e nell\'albero c\'è **Estrusione1** con dentro il suo schizzo.']))
B.append(fig('es-3-estrusione','Pannello dell\'estrusione con l\'anteprima.'))
B.append(H2('Disegna il foro su una faccia'))
B.append(OL(['Fai clic sulla faccia alta della piastra. Nella scheda **Schizzo** premi **Schizzo**: il nuovo schizzo nasce su quella faccia.','Premi **Cerchio**. Fai clic su un punto verso il centro, poi su un punto a qualche millimetro: è il raggio. Premi **Esc**.','Premi **Quota intelligente**. Fai clic sulla circonferenza, poi fuori, e scrivi **20**.','Fai clic sull\'origine, poi sul centro del cerchio, poi sotto la piastra per mettere la quota orizzontale: scrivi **40**.','Di nuovo: clic sull\'origine, clic sul centro, poi a sinistra della piastra per la quota verticale: scrivi **25**. Lo schizzo diventa nero.']))
B.append(fig('es-5-cerchio','Cerchio Ø 20 con le due quote che lo mettono al centro (40 e 25). La faccia scelta resta azzurra.'))
B.append(H2('Taglia'))
B.append(OL(['Nella scheda **Funzioni** premi **Taglio estruso**. Parte già con la condizione **Passante**, quindi attraversa tutta la piastra.','Conferma con **✓**.']))
B.append(fig('es-6-taglio','Anteprima del taglio: in rosso il materiale che verrà tolto.'))
B.append(H2('Raccorda gli spigoli'))
B.append(OL(['Premi **Raccordo** e scrivi **5** in **Raggio**.','Fai clic su tre spigoli verticali, quelli che vedi.','Il quarto è dietro: trascina con il tasto sinistro nel vuoto per girare la vista, e fai clic anche su di lui. Nel pannello ora ci sono 4 spigoli.','Conferma con **✓**.']))
B.append(fig('es-7-raccordo','Raccordo con i primi tre spigoli scelti.'))
B.append(H2('Scegli il materiale e controlla i numeri'))
B.append(OL(['Apri la scheda **Valuta**, premi **Materiale**, scegli **Acciaio S235JR** e premi **Applica**.','Premi **Proprietà di massa**. Confronta i numeri con il calcolo a mano qui sotto.']))
B.append(fig('es-10-massa','Proprietà di massa del pezzo finito.'))
B.append(TAB(['Grandezza','Calcolo a mano','Risultato'],[
 ['Piastra piena','80 × 50 × 10','40 000,00 mm³'],
 ['Foro','− π × 10² × 10','− 3 141,59 mm³'],
 ['4 raccordi','− 4 × (1 − π/4) × 5² × 10','− 214,60 mm³'],
 ['**Volume**','','**36 643,81 mm³**'],
 ['**Massa**','36 643,81 mm³ × 0,00785 g/mm³','**287,65 g**']]))
B.append(P('Il programma dà gli stessi valori: volume 36643,81 mm³ e massa 287,65 g. Il baricentro è al centro del pezzo, a X = 40, Y = 5, Z = −25 mm.'))
B.append(H2('Fai la tavola'))
B.append(OL(['Apri la scheda **Messa in tavola**: le viste si preparano da sole, con il metodo europeo.','Premi **Quote di ingombro** per aggiungere le quote di base, poi **Quota** per quelle che mancano, come il foro.','Premi **Salva PDF** per avere la tavola sul foglio vero, pronta da stampare in scala.']))
B.append(fig('es-12-tavola-quote','La tavola con viste, assonometria, quote di ingombro e cartiglio.'))
B.append(H2('Prova a cambiare il pezzo'))
B.append(P('Qui si vede la forza del metodo parametrico. Fai doppio clic su **Estrusione1** nell\'albero, cambia la profondità in 15 e conferma: foro e raccordi si adattano da soli. Con **Annulla** torni indietro. Da qui in poi il manuale spiega ogni comando uno per uno.'))
B.append(fig('es-8-finito','Il pezzo finito, con la sua storia nell\'albero.'))
# ---------- guida
FIG={'sk-colori':None,'sk-dxf':('importa-dxf','La finestra di importazione: anteprima, layer, sfondo.'),'corpi':('corpi-ambito','Ambito funzione e albero sopra la vista, con schizzi e corpi scelti per nome.'),
 'fori':('foro','Creazione guidata fori: in arancione la faccia, poi si mettono le posizioni.'),'serie-lin':('serie','Pannello della serie lineare.'),'misura':('misura','Misura di una faccia: l\'area è nel pannello.'),'sezione':('sezione','Vista in sezione nel modello 3D, con la barra in basso.'),
 'assieme':('assieme-inserito','Assieme con due componenti inseriti: (f) fissa, (-) sotto definita.'),'accoppiamenti':('assieme-accoppiamento','Accoppiamento concentrico tra perno e foro.'),'viti':('viti','La finestra per inserire viti, dadi e rondelle.'),'calcoli-assieme':('distinta','La distinta base, che si può salvare in CSV.'),'esplosa':('assieme-esplosa','Vista esplosa: il perno sollevato di 40 mm dal foro.'),'tavola-assieme':('assieme-tavola','Tavola dell\'assieme con distinta e numeri di posizione.'),'interferenze':('interferenze','Il pannello di Verifica interferenze.')}
cmdname={c['id']:c['t'] for v in d['cmds'].values() for c in v}
tabname={t['id']:t['t'] for t in d['tabs']}
CH=[('Per iniziare','Vista, salvataggi e importazioni'),('Schizzo','Lo schizzo'),('Funzioni','Le funzioni'),('Albero e modifiche','Modificare il modello'),('Valuta','Valutare il pezzo'),('Assieme','L\'assieme'),('Messa in tavola','La messa in tavola')]
INTRO={'Per iniziare':'Le cose di base che servono qualunque cosa tu stia facendo: muovere la vista, salvare il lavoro, aprire i file di altri programmi.',
'Schizzo':'Lo schizzo è il disegno 2D da cui nascono quasi tutte le funzioni. Prima si disegna la forma, poi le quote e le relazioni decidono le misure.',
'Funzioni':'Le funzioni trasformano gli schizzi in solidi e li lavorano. Ognuna si aggiunge all\'albero e si può modificare in qualunque momento.',
'Albero e modifiche':'L\'albero è la storia del pezzo. Da qui si torna su ogni passo per cambiarlo.',
'Valuta':'I controlli sul pezzo: massa, misure, sezioni, e la prova che i calcoli del programma siano giusti.',
'Assieme':'L\'assieme mette insieme più parti dello stesso progetto e ne stabilisce i collegamenti. Le parti stanno tutte dentro il progetto, in un solo file.',
'Messa in tavola':'La tavola è il disegno tecnico del pezzo o dell\'assieme, secondo le norme ISO, pronto da stampare o da consegnare.'}
SKIP={'interfaccia'}
for cap,title in CH:
    B.append(H1(title)); B.append(P(INTRO[cap]))
    for t in [x for x in d['topics'] if x['cap']==cap and x['id'] not in SKIP]:
        B.append('<section class="topic">'+H2(t['t']))
        B.append(f'<p class="why">{fmt(t["why"])}</p>')
        c=t.get('cmd')
        if c and c.get('id') in cmdname: B.append(f'<p class="where"><b>Dove si trova:</b> scheda {html.escape(tabname.get(c.get("tab"),""))} › {html.escape(cmdname[c["id"]])}</p>')
        B.append(OL(t['steps']))
        for tip in t.get('tips',[]): B.append(TIP(tip,'Consiglio'))
        B.append('</section>')
        if t['id']=='sk-colori': B.append('<div class="two">'+fig('es-1-rettangolo','Blu: sotto definito.')+fig('es-2-quote','Nero: completamente definito.')+'</div>')
        if FIG.get(t['id']): B.append(fig(*FIG[t['id']]))
# ---------- formati
B.append(H1('I file: cosa si apre e cosa si scrive'))
B.append(H2('Aprire file di altri programmi'))
B.append(TAB(['Formato','Comando','Cosa diventa','Da sapere'],[
 ['**STEP** (.step, .stp), **IGES** (.igs, .iges)','Progetto › Importa STEP o IGES','Solido «Importato», con le facce vere divise in triangoli fitti','Unità lette dal file, colori del file, scelta dei corpi. Al massimo 100 000 triangoli: oltre, le superfici si dividono più grossolanamente.'],
 ['**STL**, **OBJ**','Progetto › Importa STL o OBJ','Solido «Importato» a faccette','Si scelgono le unità (mm, cm, m, pollici). Al massimo 100 000 triangoli. Avviso se il corpo non è chiuso.'],
 ['**DXF**, **DWG**','Progetto › Importa DXF o DWG (schizzo); oppure Inserisci DXF o DWG nella scheda Schizzo','Linee, archi e cerchi in uno schizzo','Scelta dei layer, anteprima, nessun limite di entità. DWG da R1.4 a 2018. Testi, quote e tratteggi diventano uno sfondo di riferimento.'],
 ['**Progetto** (.json)','Progetto › Importa un progetto','Il progetto com\'era','Il file è quello di Esporta il progetto.']],'wide'))
B.append(TIP('I pezzi importati arrivano **senza la storia delle funzioni**: le quote originali non si modificano, ma si possono aggiungere funzioni nuove sopra. Gli schizzi da DXF arrivano senza quote, quindi blu: si possono quotare.'))
B.append(P('I file proprietari di SolidWorks (.sldprt, .sldasm, .slddrw) e di Inventor (.ipt, .iam, .idw, .ipn) **non si possono aprire**, perché le loro specifiche non sono pubbliche. Dal programma d\'origine esporta in STEP le parti e gli assiemi, in DXF le tavole.'))
B.append(H2('Salvare per altri programmi'))
B.append(TAB(['Formato','Comando','Da sapere'],[
 ['**Progetto** (.json)','Progetto › Esporta il progetto','Tutto il lavoro, da riaprire nel Banco CAD.'],
 ['**PDF**','Salva PDF','La tavola è vettoriale, sul foglio vero, in scala 1:1. Lo schizzo va su A4 orizzontale con la scala unificata più grande che lo fa entrare. La vista 3D è un\'immagine.'],
 ['**STEP** (AP214)','Progetto › Esporta STEP','In mm, con le superfici vere (piani, cilindri, coni, sfere, tori). Un solido per corpo o per componente.'],
 ['**STL**','Progetto › Esporta STL','Per la stampa 3D.'],
 ['**SVG**, **DXF**','Scheda Messa in tavola','La tavola. Nel DXF l\'assonometria resta a linee, anche se a video è ombreggiata.']],'wide'))
B.append(H2('Il Convertitore DWG → DXF'))
B.append(P('Il Banco CAD apre direttamente i DWG. Il **Convertitore DWG → DXF** è un programma separato, per chi vuole salvare i DXF, usarli in altri programmi o convertire molti disegni insieme: **rayuk-creator.github.io/CAD/convertitore-dwg**.'))
# ---------- problemi
B.append(H1('Problemi frequenti e limiti'))
B.append(H2('Se qualcosa non va'))
B.append(TAB(['Cosa succede','Cosa fare'],[
 ['Il programma «non si carica», la pagina sembra a metà','Controlla l\'indirizzo: quello giusto è **rayuk-creator.github.io/CAD**, non la pagina del repository su github.com.'],
 ['Non ritrovo il mio lavoro','Il lavoro sta nel browser dove l\'hai fatto. Sito e file scaricato sono separati, così come due browser o due computer. Per spostarlo usa Esporta e Importa il progetto.'],
 ['Lo schizzo è blu','Mancano quote o relazioni. Si può estrudere lo stesso, ma è meglio finirlo: un pezzo con tutto nero non cambia per sbaglio.'],
 ['Lo schizzo è rosso','Ci sono quote o relazioni di troppo, o in contrasto tra loro. Togli l\'ultima che hai messo, oppure usa Annulla.'],
 ['Il profilo non si estrude','Il contorno deve essere chiuso e non deve incrociarsi. Il messaggio rosso nel pannello dice cosa non va.'],
 ['Un punto esclamativo «!» nell\'albero dell\'assieme','Un elemento dell\'accoppiamento è sparito, per esempio dopo una modifica alla parte, oppure l\'accoppiamento è impossibile. Aprilo e scegli di nuovo gli elementi.'],
 ['Un file .sldprt o .ipt non si apre','Sono formati proprietari: esporta dal programma d\'origine in STEP.'],
 ['Un DWG dentro uno .zip non si apre','Il messaggio lo dice: estrai prima il DWG dallo zip.'],
 ['Voglio sapere se i calcoli sono giusti','Scheda **Valuta › Autoverifica**: il programma rifà le sue prove con valori calcolati a mano.']],'wide'))
B.append(H2('Limiti da conoscere'))
B.append(UL(['**Testi nel PDF:** usano Helvetica; i caratteri fuori dall\'alfabeto occidentale diventano «?» (per esempio ⌀ diventa Ø).',
 '**PDF della vista 3D:** è un\'immagine alla risoluzione dello schermo. Per una stampa nitida usa il PDF della tavola.',
 '**Assonometria ombreggiata:** con pezzi molto intrecciati qualche faccia può coprirne un\'altra nel modo sbagliato.',
 '**Sfondo del disegno:** le tabelle dei DWG dal 2010 in poi non si leggono; la larghezza dei testi può differire un po\' da AutoCAD.',
 '**Viti e filetti:** il filetto è indicato, salvo l\'opzione dell\'elica; nell\'assonometria i filetti non si disegnano; le lunghezze seguono la serie ISO 888, ma i campi disponibili per ogni misura dipendono dal fornitore.',
 '**Interferenze:** una sola coppia di pezzi enormi può tenere ferma la pagina anche per un minuto o più.',
 '**Assiemi:** un sottoassieme dentro un sottoassieme flessibile resta rigido; le superfici libere di uno STEP si accoppiano solo con la Tangente, contro un piano o una sfera.',
 '**Selezione automatica dell\'ambito:** non si ricalcola a pannello chiuso. Per i corpi aggiunti dopo, riapri la funzione.']))
# ---------- glossario
B.append(H1('Glossario'))
B.append(P('Tutti i termini del programma, in ordine alfabetico. Tra parentesi la scheda o l\'argomento a cui appartengono.'))
import unicodedata
key=lambda e:unicodedata.normalize('NFD',e[1]).encode('ascii','ignore').decode().lower()
g=sorted(d['entries'],key=key);cur=None;out=['<div class="gloss">']
for e in g:
    L=key(e)[0].upper()
    if not L.isalpha(): L='#'
    if L!=cur: out.append(f'<div class="gl-l">{L}</div>');cur=L
    out.append(f'<p class="gl"><b>{html.escape(e[1])}</b> <span class="gc">({html.escape(e[0])})</span> {fmt(e[3])}</p>')
out.append('</div>');B.append(''.join(out))
# ---------- norme, licenze
B.append(H1('Autori e licenze'))
B.append(P('**Banco CAD** – Copyright © 2026 Rayuk-creator. Il programma è software libero: si può usare, copiare e modificare secondo la licenza **GNU GPL 3**, con le condizioni aggiuntive del file CONDIZIONI-AGGIUNTIVE.md. È distribuito senza alcuna garanzia. Il nome «Banco CAD» si può usare solo per dire da dove viene il programma, non come nome di una versione modificata.'))
B.append(P('Parti di altri autori incluse nel programma:'))
B.append(TAB(['Parte','A cosa serve','Licenza'],[
 ['OpenCascade, tramite occt-import-js','Leggere STEP e IGES','LGPL 2.1'],['LibreDWG, tramite libredwg-web','Leggere i DWG','GPL 3'],['csg.js','Operazioni booleane','MIT'],['IBM Plex','Caratteri','OFL 1.1']]))
B.append(P('Per l\'elenco completo: **Progetto › Informazioni e licenze** nel programma, oppure la cartella licenze/ del repository github.com/Rayuk-creator/CAD. SolidWorks, AutoCAD e Inventor sono marchi dei rispettivi proprietari; il Banco CAD non è collegato a loro.'))
B.append(P('Questo manuale, come il programma, è scritto con l\'aiuto di Claude. Le misure dell\'esercizio sono state controllate nel programma e con il calcolo a mano.'))
body='\n'.join(B)
tocl=['<div class="toc">']
for lv,num,t,i in toc:
    pg=pages.get(i,'')
    tocl.append(f'<a class="l{lv}" href="#{i}"><span class="tn">{num}</span><span class="tt">{html.escape(t)}</span><span class="tp">{pg}</span></a>')
tocl.append('</div>')
CSS=open(HERE+'/style.css').read()
doc=f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Banco CAD – Manuale d'uso</title>{fonts}<style>{CSS}</style></head><body>
<section class="cover"><div class="cv-top">Modellatore 3D parametrico per la scuola</div><div class="cv-title">Banco CAD</div><div class="cv-sub">Manuale d'uso</div><img src="img/es-8-crop.png" alt=""><div class="cv-foot"><div>Schizzi · Funzioni · Assiemi · Messa in tavola</div><div>Aggiornato al 5 novembre 2026 · © 2026 Rayuk-creator · rayuk-creator.github.io/CAD</div></div></section>
<section class="tocpage"><div class="toc-h">Indice</div>{''.join(tocl)}</section>
<main>{body}</main></body></html>'''
open(M+'/manuale.html','w',encoding='utf-8').write(doc)
json.dump([list(x) for x in toc],open(M+'/toc.json','w'),ensure_ascii=False)
print('html',len(doc),'voci',len(toc))
