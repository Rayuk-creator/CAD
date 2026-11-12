from build import *
# tre sezioni della pala: angolo β, piano, distanza dall'asse
SEZ=[(45,'Piano superiore',0),(29,'Piano1',50),(15,'Piano2',105)]
def pts(b):
    t=math.radians(b);u=(math.cos(t),math.sin(t));n=(-u[1],u[0])
    P=lambda s,k:(round(s*25*u[0]+k*.5*n[0],2),round(s*25*u[1]+k*.5*n[1],2))
    return P(1,1),P(1,-1),P(-1,1),P(-1,-1)
it=lambda x:f'{x:.2f}'.replace('.',',')
def svg_sec():
    W=430;H=300;k=6.0;cx,cy=W/2+30,H/2+28
    X=lambda x:cx+x*k;Y=lambda y:cy-y*k
    s=f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans" font-size="13"><rect width="{W}" height="{H}" fill="#fff"/>'
    s+=f'<line x1="20" y1="{cy}" x2="{W-20}" y2="{cy}" stroke="#7b8590" stroke-dasharray="9 4 2 4"/>'
    def lab(x,y,t,c='#1a1f26',a='start'): return f'<text x="{x:.1f}" y="{y:.1f}" fill="{c}" text-anchor="{a}" paint-order="stroke" stroke="#fff" stroke-width="3">{t}</text>'
    cols=['#9aa7b5','#4f7fc0','#14509f']
    for (b,pl,r),col in zip(SEZ,cols):
        AU,AL,BU,BL=pts(b)
        s+=f'<path d="M{X(AU[0]):.1f} {Y(AU[1]):.1f}A{60*k} {60*k} 0 0 0 {X(BU[0]):.1f} {Y(BU[1]):.1f}L{X(BL[0]):.1f} {Y(BL[1]):.1f}A{90*k} {90*k} 0 0 1 {X(AL[0]):.1f} {Y(AL[1]):.1f}Z" fill="{col}" fill-opacity=".18" stroke="{col}" stroke-width="2"/>'
        i=[x[0] for x in SEZ].index(b);s+=f'<line x1="16" y1="{22+20*i}" x2="40" y2="{22+20*i}" stroke="{col}" stroke-width="4"/>'+lab(46,27+20*i,f'{b}° a {r} mm dall\'asse',col)
    s+=lab(W-20,cy+16,'piano della rotazione','#55606c','end')
    return s+'</svg>'
def svg_out():
    W=430;H=300;k=2.55;cx,cy=W/2,H-22
    X=lambda x:cx+x*k;Y=lambda y:cy-y*k
    s=f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans" font-size="13"><rect width="{W}" height="{H}" fill="#fff"/>'
    s+=f'<rect x="{X(-30)}" y="{Y(110)}" width="{60*k}" height="{115*k}" fill="#f4dcd2" stroke="#b0491c" stroke-width="1.6"/>'
    Rs,Rt=82,9.375
    d=f'M{X(8)} {Y(10)}A{Rs*k} {Rs*k} 0 0 0 {X(8)} {Y(95.5)}A{Rt*k} {Rt*k} 0 0 0 {X(-8)} {Y(95.5)}A{Rs*k} {Rs*k} 0 0 0 {X(-8)} {Y(10)}Z'
    s+=f'<path d="{d}" fill="#fff" stroke="#14509f" stroke-width="2"/>'
    s+=f'<circle cx="{X(0)}" cy="{Y(0)}" r="{15*k}" fill="none" stroke="#55606c" stroke-dasharray="6 4"/>'
    def lab(x,y,t,c='#1a1f26',a='start'): return f'<text x="{x}" y="{y}" fill="{c}" text-anchor="{a}" paint-order="stroke" stroke="#fff" stroke-width="3">{t}</text>'
    s+=lab(X(0),Y(55),'resta','#14509f','middle')+lab(X(-24),Y(55),'si taglia','#b0491c','middle')+lab(X(33),Y(3),'mozzo Ø30','#55606c')+lab(X(33),Y(100),'punta a 100 mm','#14509f')+f'<line x1="{X(32)}" y1="{Y(100)-4}" x2="{X(2)}" y2="{Y(100)}" stroke="#14509f"/>'
    return s+'</svg>'
D=G('Come creare un\'elica','Elica a 3 pale, Ø200 mm, con la pala svergolata','Ogni passaggio di questa guida è stato eseguito davvero nel Banco CAD con mouse e tastiera, e le immagini sono schermate del programma. Programma: **rayuk-creator.github.io/CAD**','Banco CAD – Come creare un\'elica')
D.H('Che cosa costruiamo')
D.P('Un\'**elica a 3 pale** con la pala **svergolata**: l\'angolo della pala cambia lungo la pala, grande vicino al mozzo e piccolo in punta, come nelle eliche vere. L\'idea: si disegnano tre sezioni della pala su tre piani paralleli, ognuna girata del suo angolo, e l\'**Estrusione con loft** le unisce in un solido solo. Poi se ne ritaglia il contorno, la si ripete tre volte attorno all\'asse e si aggiunge il mozzo, che unisce tutto.')
D.TAB(['Dato','Valore'],[['Diametro','200 mm (raggio di punta 100 mm)'],['Pale','3'],['Corda della sezione','50 mm, uguale in tutte le sezioni'],['Angolo della pala β','45° alla base, 29° a 50 mm, 15° a 105 mm'],['Mozzo','Ø30 × 30 mm'],['Foro','Ø10 mm, passante'],['Materiale','PLA']])
D.H2('Perché la pala è svergolata')
D.P('A ogni giro la punta della pala percorre più strada della base. Perché tutta la pala avanzi dello stesso **passo** p a ogni giro, l\'angolo deve diminuire allontanandosi dall\'asse: **β = arctan(p / 2πr)**. Per questa elica scegliamo un passo di 175 mm.')
rows=[]
for r in (25,50,75,100,105):
    rows.append([f'{r} mm',f'{math.degrees(math.atan(175/(2*math.pi*r))):.1f}°'.replace('.',',')])
D.TAB(['Distanza dall\'asse r','Angolo ideale con passo 175 mm'],rows,'num')
D.P('Le tre sezioni usano questi angoli arrotondati al grado: **29°** a 50 mm e **15°** a 105 mm. La prima sezione sta sul piano superiore, cioè sull\'asse, dove l\'angolo ideale sarebbe quasi 90°: lì la pala è nascosta dal mozzo, quindi basta un angolo di **45°**, che tiene la pala dentro lo spessore del mozzo. L\'ultima sezione sta a 105 mm, poco oltre la punta: così il taglio del contorno, che arriva a 100 mm, trova sempre materiale.')
D.H2('Sezioni e contorno')
D.P('Le tre **sezioni** hanno la stessa forma (dorso R60, ventre R90, bordi da 1 mm) e cambiano solo l\'angolo. Il **contorno** dà la forma della pala vista di fronte: il taglio toglie tutto quello che sta nella fascia rossa.')
D.RAW('<div class="two"><figure>'+svg_sec()+'<figcaption>Le tre sezioni viste dall\'alto, una sopra l\'altra. I bordi da 1 mm evitano uno spigolo vivo a spessore zero.</figcaption></figure><figure>'+svg_out()+'<figcaption>Il contorno visto di fronte: la zona da tagliare è tra rettangolo e pala.</figcaption></figure></div>')
D.H2('Come si calcolano i punti delle sezioni')
D.P('Gli estremi della corda stanno a 25 mm dal centro, inclinati di β: **X = ±25 × cos β** e **Y = ±25 × sin β**. Per avere il bordo da 1 mm ci si sposta di 0,5 mm perpendicolarmente alla corda: il punto sopra si sposta di **(−0,5 × sin β; +0,5 × cos β)**, quello sotto del contrario. Ecco i risultati, arrotondati a due decimali.')
trs=[]
for b,pl,r in SEZ:
    AU,AL,BU,BL=pts(b)
    trs.append([f'{b}° ({pl})',f'{it(AU[0])} / {it(AU[1])}',f'{it(AL[0])} / {it(AL[1])}',f'{it(BU[0])} / {it(BU[1])}',f'{it(BL[0])} / {it(BL[1])}'])
D.TAB(['Sezione','Destro, sopra','Destro, sotto','Sinistro, sopra','Sinistro, sotto'],trs,'num')
D.H('Prima di cominciare')
D.UL(['Apri un progetto vuoto con `Progetto › Nuovo progetto`.',
 '**Valori:** quando scegli uno strumento di disegno, a sinistra compare il riquadro **Inserimento numerico**. Scrivi i valori, passa al campo dopo con Tab e conferma con Invio. La virgola e il punto valgono uguale.',
 '**Esc:** dopo aver scritto dei valori, premi **Esc due volte**: la prima toglie il cursore dal campo, la seconda chiude lo strumento e torna alla selezione.',
 '**Vista:** la rotella ingrandisce verso il puntatore; il tasto destro trascinato sposta; il tasto F adatta il pezzo allo schermo.',
 '**Colori dello schizzo:** blu vuol dire che manca ancora qualche vincolo; nero che è tutto definito; rosso che c\'è un vincolo di troppo. Lo stato si legge anche nella barra in basso.',
 'Se sbagli, `Annulla` (la freccia in alto, oppure Ctrl + Z) torna indietro di un passo.'])
D.STEP('Crea i due piani per le sezioni','Ogni sezione del loft vuole il suo piano. Il primo è il piano superiore; gli altri due sono paralleli a lui.',[
 'Scheda `Funzioni`: premi `Piano di riferimento`.',
 'In **Riferimento** premi `Superiore`. In **Distanza** scrivi **50**, poi Tab. Premi ✓: nell\'albero compare `Piano1`.',
 'Di nuovo `Piano di riferimento`: `Superiore`, **Distanza 105**, ✓. Nell\'albero compare `Piano2`.'],[F('e-00-piano',FEPM,'Il pannello del piano: in arancione il Piano1, 50 mm sopra il piano superiore.')])
SEC=(.19,.25,.85,1)
AU,AL,BU,BL=pts(45)
D.STEP('Disegna la prima sezione (45°)','Prima i quattro punti, così gli archi partono da posizioni esatte; poi dorso, ventre e i due bordi.',[
 'Apri la scheda `Schizzo`, fai clic su `Piano superiore` nell\'albero e premi `Schizzo`. Ingrandisci un po\' con la rotella.',
 f'Premi `Punto`. Per ogni punto scrivi **X** e **Y** e premi Invio: lo strumento resta attivo. **{it(AU[0])} / {it(AU[1])}**, poi **{it(AL[0])} / {it(AL[1])}**, poi **{it(BU[0])} / {it(BU[1])}**, poi **{it(BL[0])} / {it(BL[1])}**. Premi Esc due volte.',
 f'Premi `Arco 3 punti`. Punto iniziale **{it(AU[0])} / {it(AU[1])}**, Invio. Punto finale **{it(BU[0])} / {it(BU[1])}**, Invio. Porta il mouse nella vista **sopra l\'arco, in alto a sinistra**, e lascialo lì: l\'arco si piega dalla parte del mouse. Scrivi **60** e premi Invio. Esc due volte.',
 f'Di nuovo `Arco 3 punti`: **{it(AL[0])} / {it(AL[1])}**, Invio; **{it(BL[0])} / {it(BL[1])}**, Invio; mouse dalla stessa parte, scrivi **90**, Invio. Esc due volte.',
 'Premi `Linea` e chiudi i due lati corti: clic su un punto, clic su quello vicino, Esc due volte. Fai lo stesso dall\'altra parte.',
 'Premi `Esci dallo schizzo`.'],[two(crop('e-02-arco-raggio',SEC),'Il primo arco, mentre si sceglie il raggio.',crop('e-03-sezione-45',SEC),'La sezione chiusa. Le quote si sovrappongono un po\': non è un problema.')],
 'prima di uscire il pannello dice **Lo schizzo è completamente definito** e **Contorni chiusi: 1 (area 115,23 mm²)**.')
p2,p3=pts(29),pts(15)
D.STEP('Disegna le altre due sezioni (29° e 15°)','Stessi comandi del passo prima, con i punti della tabella. Gli archi si piegano dalla stessa parte: in alto a sinistra.',[
 'Scheda `Schizzo`: fai clic su `Piano1` nell\'albero e premi `Schizzo`. La vista si mette davanti al piano.',
 'Punti: **'+'**, **'.join(f'{it(p[0])} / {it(p[1])}' for p in p2)+'**. Poi dorso R60, ventre R90 e i due bordi, come nel passo prima. `Esci dallo schizzo`.',
 'Fai lo stesso su `Piano2` con i punti **'+'**, **'.join(f'{it(p[0])} / {it(p[1])}' for p in p3)+'**.'],[F('e-03-sezione-29',SEC,'La sezione a 29° sul Piano1. In grigio chiaro si vede la sezione a 45° del piano superiore, sotto.','w80')],
 'il pannello dice **completamente definito** e **Contorni chiusi: 1**, con area **115,42 mm²** per la sezione a 29° e **114,81 mm²** per quella a 15°. Le aree cambiano di poco perché i punti sono arrotondati.',
 'se lo schizzo non parte, fai prima clic sul **nome** del piano nell\'albero: il piano diventa blu nella vista. Poi premi `Schizzo`.')
D.STEP('Unisci le sezioni con il loft','Il loft fa passare il solido per le tre sezioni, nell\'ordine: la pala gira da sola da 45° a 15°.',[
 'Scheda `Funzioni`: premi `Estrusione con loft`.',
 'Nel riquadro **Profili** compaiono da soli `Schizzo1`, `Schizzo2` e `Schizzo3`, in quest\'ordine. Se l\'ordine è diverso, correggilo con le frecce ↑ ↓.',
 'Controlla l\'anteprima arancione e premi ✓.'],[F('e-05-loft',FEPM,'Il pannello del loft con i tre profili in ordine e l\'anteprima della pala.'),F('e-05b-dall-alto',(.25,.2,.95,.95),'La pala vista dall\'alto: si vede bene come gira dalla base alla punta.','half')],
 'il volume è circa **12 129 mm³**: in media 115 mm² × 105 mm.')
D.STEP('Disegna il contorno della pala','Il taglio toglierà la parte tra il rettangolo esterno e il contorno della pala.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Rettangolo`: **X -30, Y -5**, Invio; **Larghezza 60, Altezza 115**, Invio. Esc due volte.',
 '`Punto`: **8 / 10**, **-8 / 10**, **8 / 95,5**, **-8 / 95,5**, con Invio dopo ognuno. Esc due volte.',
 '`Linea`: clic su **(8; 10)**, clic su **(-8; 10)**. Esc due volte. È la base della pala, che finirà dentro il mozzo.',
 '`Arco 3 punti`: **8 / 10**, Invio; **8 / 95,5**, Invio; mouse **a destra** dell\'arco, scrivi **82**, Invio. Esc due volte.',
 '`Arco 3 punti`: **-8 / 95,5**, Invio; **-8 / 10**, Invio; mouse **a sinistra** dell\'arco, scrivi **82**, Invio. Esc due volte.'],[F('e-06-fianchi',(.28,.225,.82,.965),'Rettangolo, base e fianchi. Manca solo la punta.','half')])
D.STEP('Arrotonda la punta','L\'arco tangente continua il fianco senza angolo, e arriva a 100 mm dall\'asse.',[
 'Premi `Arco tangente`. Fai clic sull\'estremo **(8; 95,5)**, poi su **(-8; 95,5)**. Esc due volte.',
 'Premi `Esci dallo schizzo`.'],[F('e-07-contorno',(.28,.225,.82,.965),'Il contorno completo, tutto nero.','half')],
 'prima di uscire il pannello dice **completamente definito** e **Contorni chiusi: 1 (area 4088,89 mm²)**: è l\'area della fascia tra rettangolo e pala.')
D.STEP('Ritaglia la pala','La pala sta davanti e dietro il piano frontale, quindi il taglio deve andare **in tutte e due le direzioni**.',[
 'Scheda `Funzioni`: premi `Taglio estruso`.',
 'In **Direzione 1**, **Condizione finale**: scegli **Passante tutto**.',
 'Spunta **Estrudi anche nella direzione opposta**.',
 'In **Direzione 2**, **Condizione finale**: scegli di nuovo **Passante tutto**. Premi ✓.'],[F('e-08-taglio',FEPM,'L\'anteprima rossa avvolge la pala: resta solo la forma voluta.'),F('e-09-pala-sagomata',PART,'La pala ritagliata, vista di fronte.','half')],
 'il volume deve scendere a circa **8173 mm³**.',
 'se la Direzione 2 resta su **Cieca**, a lato della pala rimane una parte non tagliata.')
D.STEP('Ripeti la pala tre volte','Qui si ripete il **corpo solido** intero, non le funzioni.',[
 'Premi `Serie circolare`.',
 'Fai clic nel riquadro **Corpi da ripetere**, poi su `Corpo1` nell\'**Albero** sopra la vista.',
 'In **Asse** premi `Asse Z`. Scrivi **Numero di istanze 3**, poi Tab. L\'**Angolo totale** resta 360°.',
 'Premi ✓.'],[F('e-10-serie',FEPM,'Il pannello, con il corpo scelto in blu e le copie in giallo.')],
 'nell\'albero compare **Corpi solidi (3)**, e il volume totale è circa **24 519 mm³**, cioè 3 × 8173.')
D.STEP('Aggiungi il mozzo','Il mozzo tocca tutte le pale e le unisce in un solo corpo.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Cerchio`: **X 0, Y 0**, Invio; **Diametro 30**, Invio. Esc due volte, poi `Esci dallo schizzo`.',
 'Scheda `Funzioni`: premi `Estrusione base`. In **Condizione finale** scegli **Piano medio**: il mozzo cresce in parti uguali davanti e dietro.',
 'Scrivi **Profondità 30**, poi Tab. Lascia spuntata **Unisci risultato**. In **Ambito funzione** la **Selezione automatica** spunta da sola, in grigio, `Corpo1`, `Corpo2` e `Corpo3`: controlla che ci siano tutti e tre. Premi ✓. Il calcolo richiede qualche secondo.'],[F('e-12-mozzo',(0,.16,.80,1),'Il pannello con il mozzo in anteprima.')],
 'nell\'albero ora c\'è **Corpi solidi (1)**, e il volume è circa **44 967 mm³**.')
D.STEP('Fai il foro','Il foro attraversa tutto il mozzo, quindi anche qui servono due direzioni.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Cerchio`: **X 0, Y 0**, Invio; **Diametro 10**, Invio. Esc due volte, poi `Esci dallo schizzo`.',
 'Scheda `Funzioni`: premi `Taglio estruso`. **Passante tutto**, spunta **Estrudi anche nella direzione opposta**, nella Direzione 2 di nuovo **Passante tutto**. Premi ✓.'],[],
 'il foro toglie π × 5² × 30 = 2356 mm³: il volume scende a circa **42 611 mm³**.')
D.STEP('Smussa il mozzo','Un piccolo smusso toglie lo spigolo vivo sul davanti.',[
 'Premi `Smusso`. In **Distanza** scrivi **1,5**, poi Tab.',
 'Fai clic sullo spigolo circolare del mozzo, sul lato davanti. Compare «Spigolo 1». Premi ✓.'],[F('e-14-smusso',FEPM,'Lo spigolo scelto è evidenziato sul mozzo.')],
 'il volume scende di circa 102 mm³, a circa **42 508 mm³**.')
D.STEP('Scegli il materiale e controlla','L\'ultimo passaggio conferma che il pezzo è giusto.',[
 'Scheda `Valuta`: premi `Materiale`, scegli **PLA** e conferma.',
 'Premi `Proprietà di massa`.'],[two(crop('e-17-materiale',DLG1),'La scelta del materiale.',crop('e-18-massa',DLG2),'Le proprietà di massa del pezzo finito.')],
 'il volume deve essere circa **42 508 mm³** e la massa circa **52,7 g**. Un calcolo separato dal programma, che integra le sezioni del loft tagliate dal contorno, dà 42 462 mm³: la differenza è circa lo 0,1 %, dovuta alle faccette con cui il programma disegna gli archi.')
D.RAW(two(crop('e-16-davanti',PART),'L\'elica finita vista di fronte: tre pale a 120°, mozzo e foro.',crop('e-16b-dall-alto',(.19,.3,1,.85)),'Vista dall\'alto: ogni pala è più inclinata vicino al mozzo e quasi piatta in punta.'))
D.H('Se qualcosa non torna')
D.TAB(['Cosa vedi','Cosa fare'],[
 ['Un arco si piega dalla parte sbagliata','Annulla e rifallo, con il mouse dalla parte giusta **prima** di scrivere il raggio.'],
 ['Premendo `Schizzo` su Piano1 non succede niente','Fai clic sul nome `Piano1` nell\'albero (diventa blu) e poi premi `Schizzo`.'],
 ['Il loft dà un errore sui profili','Ogni sezione deve essere **un solo contorno chiuso** sul suo piano: controlla nel pannello dello schizzo che dica «Contorni chiusi: 1».'],
 ['La pala si attorciglia in modo strano','I profili sono in un ordine sbagliato: fai doppio clic sul loft e rimettili in ordine 1, 2, 3 con le frecce.'],
 ['Accanto a ogni pala c\'è una parte non tagliata','Il taglio del contorno ha la Direzione 2 su **Cieca**. Fai doppio clic sul taglio nell\'albero e scegli **Passante tutto**.'],
 ['Il foro non attraversa tutto il mozzo','Stesso motivo: controlla la Direzione 2 del foro.'],
 ['Dopo il mozzo restano 3 corpi','In **Ambito funzione** mancava un corpo, oppure **Unisci risultato** era tolta. Riapri l\'estrusione con un doppio clic e correggi.'],
 ['Il volume della pala è molto diverso','Controlla i punti e i raggi delle tre sezioni. Se la massa è strana, controlla anche il materiale.'],
])
D.write(crop('e-19-cover',(.38,.22,.82,.92),'e-cover'),'elica','Come creare un\'elica – Banco CAD')
