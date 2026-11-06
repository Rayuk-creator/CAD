from build import *
bt=math.radians(25);u=(math.cos(bt),math.sin(bt));n=(-u[1],u[0])
def svg_sec():
    W=430;H=300;k=7.2;cx,cy=W/2,H/2+18
    X=lambda x:cx+x*k;Y=lambda y:cy-y*k
    AU,AL,BU,BL=(22.45,11.02),(22.87,10.11),(-22.87,-10.11),(-22.45,-11.02)
    s=f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans" font-size="13"><rect width="{W}" height="{H}" fill="#fff"/>'
    s+=f'<line x1="20" y1="{cy}" x2="{W-20}" y2="{cy}" stroke="#7b8590" stroke-dasharray="9 4 2 4"/>'
    s+=f'<line x1="{X(-26*u[0]):.1f}" y1="{Y(-26*u[1]):.1f}" x2="{X(26*u[0]):.1f}" y2="{Y(26*u[1]):.1f}" stroke="#b0491c" stroke-dasharray="9 4 2 4"/>'
    s+=f'<path d="M{X(AU[0]):.1f} {Y(AU[1]):.1f}A{60*k} {60*k} 0 0 0 {X(BU[0]):.1f} {Y(BU[1]):.1f}L{X(BL[0]):.1f} {Y(BL[1]):.1f}A{90*k} {90*k} 0 0 1 {X(AL[0]):.1f} {Y(AL[1]):.1f}Z" fill="#cfe0f5" stroke="#14509f" stroke-width="2"/>'
    r=115;s+=f'<path d="M{cx+r:.1f} {cy}A{r} {r} 0 0 0 {cx+r*u[0]:.1f} {cy-r*u[1]:.1f}" fill="none" stroke="#b0491c" stroke-width="1.4"/><text x="{cx+r+6:.0f}" y="{cy-22}" fill="#b0491c" font-weight="600">25°</text>'
    def lab(x,y,t,c='#1a1f26',a='start'): return f'<text x="{x}" y="{y}" fill="{c}" text-anchor="{a}" paint-order="stroke" stroke="#fff" stroke-width="3">{t}</text>'
    s+=lab(20,cy-6,'piano della rotazione','#55606c')
    s+=lab(X(-6),Y(14.5),'dorso R60','#14509f','middle')+lab(X(4),Y(-3),'ventre R90','#14509f','start')
    s+=lab(X(22),Y(17.5),'bordo da 1 mm','#14509f','middle')+lab(W/2+96,Y(-16),'corda 50 mm','#b0491c','start')
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
D=G('Come creare un\'elica','Elica a 3 pale, Ø200 mm, senza svergolamento','Ogni passaggio di questa guida è stato eseguito davvero nel Banco CAD con mouse e tastiera, e le immagini sono schermate del programma. Programma: **rayuk-creator.github.io/CAD**','Banco CAD – Come creare un\'elica')
D.H('Che cosa costruiamo')
D.P('Un\'**elica a 3 pale**, come quella di una ventola semplice. L\'idea: si estrude la sezione di una pala, se ne ritaglia il contorno, la si ripete tre volte attorno all\'asse e infine si aggiunge il mozzo, che unisce tutto.')
D.TAB(['Dato','Valore'],[['Diametro','200 mm (raggio di punta 100 mm)'],['Pale','3'],['Corda della sezione','50 mm'],['Angolo della pala β','25°, uguale per tutta la lunghezza'],['Mozzo','Ø30 × 30 mm'],['Foro','Ø10 mm, passante'],['Materiale','PLA']])
D.H2('Sezione e contorno')
D.P('La pala nasce da due schizzi. La **sezione** è inclinata di 25° rispetto al piano in cui l\'elica gira: è questa inclinazione a spingere l\'aria. Il **contorno** dà la forma vista di fronte. Il taglio toglie tutto quello che sta nella fascia rossa.')
D.RAW('<div class="two"><figure>'+svg_sec()+'<figcaption>La sezione vista dall\'alto. I bordi da 1 mm evitano uno spigolo vivo a spessore zero.</figcaption></figure><figure>'+svg_out()+'<figcaption>Il contorno visto di fronte: la zona da tagliare è tra rettangolo e pala.</figcaption></figure></div>')
D.H2('Come si calcolano i punti della sezione')
D.P('Gli estremi della corda stanno a 25 mm dal centro, inclinati di 25°: **X = ±25 × cos 25° = ±22,658** e **Y = ±25 × sin 25° = ±10,565**. Per avere il bordo da 1 mm ci si sposta di 0,5 mm perpendicolarmente alla corda: il punto sopra si sposta di **(−0,211; +0,453)**, quello sotto di **(+0,211; −0,453)**. Ecco i risultati, arrotondati a due decimali.')
D.TAB(['Punto','X','Y'],[['Destro, sopra','22,45','11,02'],['Destro, sotto','22,87','10,11'],['Sinistro, sopra','-22,87','-10,11'],['Sinistro, sotto','-22,45','-11,02']],'num')
D.H2('Il limite di questa elica')
D.P('In un\'elica vera di barca o di aereo l\'angolo cambia lungo la pala: è grande vicino al mozzo e piccolo in punta (**svergolamento**). Il motivo è che la punta percorre più strada a ogni giro: per avanzare di uno stesso passo p, l\'angolo deve essere β = arctan(p / 2πr).')
rows=[]
p=2*math.pi*50*math.tan(bt)
for r in (25,50,75,100):
    rows.append([f'{r} mm',f'{math.degrees(math.atan(p/(2*math.pi*r))):.1f}°'.replace('.',','),'25°'])
D.TAB(['Raggio','Angolo ideale con passo di '+f'{p:.0f}'+' mm','Angolo di questa guida'],rows,'num')
D.P('Oggi il Banco CAD non ha un comando per far cambiare forma a un solido lungo il percorso (in SolidWorks si chiama **Loft**), quindi questa pala ha lo stesso angolo ovunque. Va bene per imparare il metodo e per un modello dimostrativo, ma non è progettata per un buon rendimento.')
D.H('Prima di cominciare')
D.UL(['Apri un progetto vuoto con `Progetto › Nuovo progetto`.',
 '**Valori:** quando scegli uno strumento di disegno, a sinistra compare il riquadro **Inserimento numerico**. Scrivi i valori, passa al campo dopo con Tab e conferma con Invio. La virgola e il punto valgono uguale.',
 '**Esc:** dopo aver scritto dei valori, premi **Esc due volte**: la prima toglie il cursore dal campo, la seconda chiude lo strumento e torna alla selezione.',
 '**Vista:** la rotella ingrandisce verso il puntatore; il tasto destro trascinato sposta; il tasto F adatta il pezzo allo schermo.',
 '**Colori dello schizzo:** blu vuol dire che manca ancora qualche vincolo; nero che è tutto definito; rosso che c\'è un vincolo di troppo. Lo stato si legge anche nella barra in basso.',
 'Se sbagli, `Annulla` (la freccia in alto, oppure Ctrl + Z) torna indietro di un passo.'])
c=lambda n,b=SK:crop(n,b)
D.STEP('Metti i punti della sezione','Prima i quattro punti: così gli archi partiranno da posizioni esatte.',[
 'Apri la scheda `Schizzo`, fai clic su `Piano superiore` nell\'albero e premi `Schizzo`. Ingrandisci un po\' con la rotella.',
 'Premi `Punto`. Per ogni riga della tabella scrivi **X** e **Y** e premi Invio: lo strumento resta attivo. **22,45 / 11,02**, poi **22,87 / 10,11**, poi **-22,87 / -10,11**, poi **-22,45 / -11,02**.',
 'Premi Esc due volte.'],[F('e-01-punti',(.28,.30,.85,.85),'I quattro punti, ognuno con le sue due quote.','w80')])
D.STEP('Disegna dorso e ventre','Sono due archi tra i punti, piegati dalla stessa parte: quella in alto a sinistra.',[
 'Premi `Arco 3 punti`. Punto iniziale **22,45 / 11,02**, Invio. Punto finale **-22,87 / -10,11**, Invio.',
 'Porta il mouse nella vista **sopra l\'arco, in alto a sinistra**, e lascialo lì: l\'arco si piega dalla parte del mouse. Scrivi **60** e premi Invio. Premi Esc due volte.',
 'Di nuovo `Arco 3 punti`: **22,87 / 10,11**, Invio; **-22,45 / -11,02**, Invio; mouse dalla stessa parte, scrivi **90**, Invio. Esc due volte.',
 'Premi `Linea` e chiudi i due lati corti: clic su un punto, clic su quello vicino, Esc due volte. Fai lo stesso dall\'altra parte.',
 'Premi `Esci dallo schizzo`.'],[two(crop('e-02-arco-raggio',(.19,.25,.85,1)),'Il primo arco, mentre si sceglie il raggio.' ,crop('e-03-sezione',(.19,.25,.85,1)),'La sezione chiusa. Le quote si sovrappongono un po\': non è un problema.')],
 'prima di uscire il pannello dice **Lo schizzo è completamente definito** e **Contorni chiusi: 1 (area 115,20 mm²)**.')
D.STEP('Estrudi la pala','La sezione diventa una lunga barra curva, alta quanto il raggio dell\'elica.',[
 'Scheda `Funzioni`: premi `Estrusione base`.',
 'Lascia **Cieca** e scrivi **Profondità 100**, poi Tab. Premi ✓.'],[F('e-04-estrusione',FEPM,'L\'anteprima arancione dell\'estrusione: una lunga barra curva.')],
 'il volume è 115,20 mm² × 100 mm = circa **11 520 mm³**.')
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
D.STEP('Ritaglia la pala','La sezione sta sopra e sotto il piano frontale, quindi il taglio deve andare **in tutte e due le direzioni**.',[
 'Scheda `Funzioni`: premi `Taglio estruso`.',
 'In **Direzione 1**, **Condizione finale**: scegli **Passante tutto**.',
 'Spunta **Estrudi anche nella direzione opposta**.',
 'In **Direzione 2**, **Condizione finale**: scegli di nuovo **Passante tutto**. Premi ✓.'],[F('e-08-taglio',FEPM,'L\'anteprima rossa avvolge la barra: resta solo la forma della pala.'),F('e-09-pala-sagomata',PART,'La pala ritagliata.','half')],
 'il volume deve scendere a circa **7940 mm³**.',
 'se la Direzione 2 resta su **Cieca**, a lato della pala rimane una sottile barretta non tagliata.')
D.STEP('Ripeti la pala tre volte','Qui si ripete il **corpo solido** intero, non le funzioni.',[
 'Premi `Serie circolare`.',
 'Fai clic nel riquadro **Corpi da ripetere**, poi su `Corpo1` nell\'**Albero** sopra la vista.',
 'In **Asse** premi `Asse Z`. Scrivi **Numero di istanze 3**, poi Tab. L\'**Angolo totale** resta 360°.',
 'Premi ✓.'],[F('e-10-serie',FEPM,'Il pannello, con il corpo scelto in blu e le copie in giallo.')],
 'nell\'albero compare **Corpi solidi (3)**, e il volume totale è circa **23 819 mm³**, cioè 3 × 7940.')
D.STEP('Aggiungi il mozzo','Il mozzo tocca tutte le pale e le unisce in un solo corpo.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Cerchio`: **X 0, Y 0**, Invio; **Diametro 30**, Invio. Esc due volte, poi `Esci dallo schizzo`.',
 'Scheda `Funzioni`: premi `Estrusione base`. In **Condizione finale** scegli **Piano medio**: il mozzo cresce in parti uguali davanti e dietro.',
 'Scrivi **Profondità 30**, poi Tab. Lascia spuntata **Unisci risultato**. In **Ambito funzione** la **Selezione automatica** spunta da sola, in grigio, `Corpo1`, `Corpo2` e `Corpo3`: controlla che ci siano tutti e tre. Premi ✓.'],[F('e-12-mozzo',(0,.16,.80,1),'Il pannello con il mozzo in anteprima.')],
 'nell\'albero ora c\'è **Corpi solidi (1)**, e il volume è circa **44 364 mm³**.')
D.STEP('Fai il foro','Il foro attraversa tutto il mozzo, quindi anche qui servono due direzioni.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Cerchio`: **X 0, Y 0**, Invio; **Diametro 10**, Invio. Esc due volte, poi `Esci dallo schizzo`.',
 'Scheda `Funzioni`: premi `Taglio estruso`. **Passante tutto**, spunta **Estrudi anche nella direzione opposta**, nella Direzione 2 di nuovo **Passante tutto**. Premi ✓.'],[],
 'il foro toglie π × 5² × 30 = 2356 mm³: il volume scende a circa **42 008 mm³**.')
D.STEP('Smussa il mozzo','Un piccolo smusso toglie lo spigolo vivo sul davanti.',[
 'Premi `Smusso`. In **Distanza** scrivi **1,5**, poi Tab.',
 'Fai clic sullo spigolo circolare del mozzo, sul lato davanti. Compare «Spigolo 1». Premi ✓.'],[F('e-14-smusso',FEPM,'Lo spigolo scelto è evidenziato sul mozzo.')],
 'il volume scende di circa 102 mm³, a circa **41 906 mm³**.')
D.STEP('Scegli il materiale e controlla','L\'ultimo passaggio conferma che il pezzo è giusto.',[
 'Scheda `Valuta`: premi `Materiale`, scegli **PLA** e conferma.',
 'Premi `Proprietà di massa`.'],[two(crop('e-17-materiale',DLG1),'La scelta del materiale.',crop('e-18-massa',DLG2),'Le proprietà di massa del pezzo finito.')],
 'il volume deve essere circa **41 906 mm³** e la massa circa **52 g**. Un calcolo separato dal programma, con l\'integrale di sezione e contorno, dà 41 905 mm³: la differenza è meno dello 0,01 %.')
D.RAW(F('e-16-davanti',PART,'L\'elica finita vista di fronte: tre pale a 120°, mozzo e foro.','w80'))
D.H('Se qualcosa non torna')
D.TAB(['Cosa vedi','Cosa fare'],[
 ['Un arco si piega dalla parte sbagliata','Annulla e rifallo, con il mouse dalla parte giusta **prima** di scrivere il raggio.'],
 ['Accanto a ogni pala c\'è una sottile barretta','Il taglio del passo 6 ha la Direzione 2 su **Cieca**. Fai doppio clic sul taglio nell\'albero e scegli **Passante tutto**.'],
 ['Il foro non attraversa tutto il mozzo','Stesso motivo: controlla la Direzione 2 del foro.'],
 ['Dopo il mozzo restano 3 corpi','In **Ambito funzione** mancava un corpo, oppure **Unisci risultato** era tolta. Riapri l\'estrusione con un doppio clic e correggi.'],
 ['Il volume della pala è molto diverso','Controlla il raggio dei due archi e i quattro punti della sezione. Se la massa è strana, controlla anche il materiale.'],
])
D.write(crop('e-19-cover',(.38,.22,.82,.92),'e-cover'),'elica','Come creare un\'elica – Banco CAD')
