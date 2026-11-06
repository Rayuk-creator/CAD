from build import *
from calc import gear
g=gear(2,20);T=g['T'];rho=g['rho'];pr=g['on'](17.5);pt=g['on'](23);P=g['on'](20)
def svg_tooth():
    x0,x1,y0,y1=-8.5,11.5,15.3,24.2;W=880;k=W/(x1-x0);H=(y1-y0)*k
    X=lambda x:(x-x0)*k;Y=lambda y:(y1-y)*k
    def arc(c,r,a,b,sw):return f'M{X(a[0]):.1f} {Y(a[1]):.1f}A{r*k:.1f} {r*k:.1f} 0 0 {sw} {X(b[0]):.1f} {Y(b[1]):.1f}'
    s=f'<svg viewBox="0 0 {W} {H:.0f}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans" font-size="17"><defs><clipPath id="vp"><rect width="{W}" height="{H:.0f}"/></clipPath></defs><rect width="{W}" height="{H:.0f}" fill="#fff"/><g clip-path="url(#vp)">'
    # disco grigio
    s+=f'<circle cx="{X(0):.1f}" cy="{Y(0):.1f}" r="{22*k:.1f}" fill="#dfe4ea" stroke="#7b8590" stroke-width="1.4"/>'
    prl=(-pr[0],pr[1]);ptl=(-pt[0],pt[1])
    d=arc(0,17.5,prl,pr,1)+f'A{rho*k:.1f} {rho*k:.1f} 0 0 1 {X(pt[0]):.1f} {Y(pt[1]):.1f}L{X(ptl[0]):.1f} {Y(ptl[1]):.1f}A{rho*k:.1f} {rho*k:.1f} 0 0 1 {X(prl[0]):.1f} {Y(prl[1]):.1f}Z'
    s+=f'<path d="{d}" fill="#fff" stroke="#14509f" stroke-width="3"/>'
    for r,c,dash in [(17.5,'#14509f','7 5'),(g['rb'],'#55606c','7 5'),(20,'#b0491c','14 5 3 5'),(23,'#14509f','7 5')]:
        s+=f'<circle cx="{X(0):.1f}" cy="{Y(0):.1f}" r="{r*k:.1f}" fill="none" stroke="{c}" stroke-width="1.3" stroke-dasharray="{dash}"/>'
    s+=f'<line x1="{X(T[0]):.1f}" y1="{Y(T[1]):.1f}" x2="{X(P[0]):.1f}" y2="{Y(P[1]):.1f}" stroke="#1a1f26" stroke-width="1.6"/>'
    s+=f'<circle cx="{X(T[0]):.1f}" cy="{Y(T[1]):.1f}" r="5" fill="#1a1f26"/><circle cx="{X(P[0]):.1f}" cy="{Y(P[1]):.1f}" r="5" fill="#b0491c"/>'
    def lab(x,y,t,c='#1a1f26',anc='start',b=0):
        s_=f'<text x="{X(x):.1f}" y="{Y(y):.1f}" fill="{c}" text-anchor="{anc}"'+(' font-weight="600"' if b else '')+f' paint-order="stroke" stroke="#fff" stroke-width="4">{t}</text>';return s_
    s+=lab(T[0]+.25,T[1]-.5,'T, centro del fianco',b=1)
    s+=lab(P[0]-.3,P[1]+.15,'P',c='#b0491c',anc='end',b=1)
    s+=lab(T[0]-1.6,(T[1]+P[1])/2-.6,'raggio 6,84')
    s+=lab(0,20.9,'vano',c='#14509f',anc='middle',b=1)
    s+=lab(-5.5,22.9,'cerchio limite Ø46',c='#14509f')
    s+=lab(-8.2,21.35,'testa Ø44',c='#55606c')
    s+=lab(-8.2,19.85,'primitivo Ø40',c='#b0491c')
    s+=lab(-8.2,18.05,'base Ø37,59',c='#55606c')
    s+=lab(-8.2,16.0,'fondo Ø35',c='#14509f')
    s+='</g></svg>';return s
D=G('Come creare un ingranaggio','Ruota dentata a denti dritti, modulo 2, 20 denti','Ogni passaggio di questa guida è stato eseguito davvero nel Banco CAD con mouse e tastiera, e le immagini sono schermate del programma. Programma: **rayuk-creator.github.io/CAD**','Banco CAD – Come creare un ingranaggio')
D.H('Che cosa costruiamo')
D.P('Una **ruota dentata cilindrica a denti dritti** in acciaio C40, con foro e cava per la linguetta. L\'idea è semplice: si parte da un disco, si toglie **un solo vano** tra due denti e poi lo si ripete tutto intorno con una serie circolare.')
D.TAB(['Dato','Valore'],[['Modulo m','2 mm'],['Numero di denti z','20'],['Angolo di pressione α','20°'],['Spessore della ruota','12 mm'],['Foro','Ø12 mm'],['Cava per linguetta','larghezza 4 mm, fondo a 7,8 mm dal centro (DIN 6885-1, albero Ø12)']])
D.H2('I numeri del dente')
D.P('Tutte le misure dell\'ingranaggio nascono da modulo e numero di denti. Questi sono i calcoli che useremo.')
D.TAB(['Grandezza','Formula','Valore'],[
 ['Diametro primitivo d','m × z','40 mm'],
 ['Diametro di testa da','d + 2m','44 mm'],
 ['Diametro di fondo df','d − 2,5m','35 mm'],
 ['Diametro di base db','d × cos α','37,59 mm'],
 ['Raggio del fianco ρ','(d/2) × sin α','6,84 mm'],
 ['Angolo δ del centro T dall\'asse Y','90°/z + α','24,5°'],
 ['Coordinata X del centro T','(db/2) × sin δ','7,794 mm'],
 ['Coordinata Y del centro T','(db/2) × cos δ','17,102 mm'],
])
D.H2('Perché il fianco è un arco')
D.P('Il fianco vero di un dente è una curva chiamata **evolvente**. Nel Banco CAD non si disegna direttamente, quindi la sostituiamo con l\'arco che le somiglia di più nel punto che conta: il punto **P**, sul cerchio primitivo, dove i denti si spingono. Il centro dell\'arco è il punto **T** sul cerchio di base, e il raggio è la distanza tra T e P.')
D.RAW('<figure>'+svg_tooth()+'<figcaption>Il vano da disegnare, in scala. Il contorno blu è il profilo che taglieremo: sale oltre la testa, così il taglio esce pulito dal disco.</figcaption></figure>')
D.H('Prima di cominciare')
D.UL(['Apri un progetto vuoto con `Progetto › Nuovo progetto`.',
 '**Valori:** quando scegli uno strumento di disegno, a sinistra compare il riquadro **Inserimento numerico**. Scrivi i valori, passa al campo dopo con Tab e conferma con Invio. La virgola e il punto valgono uguale.',
 '**Esc:** dopo aver scritto dei valori, premi **Esc due volte**: la prima toglie il cursore dal campo, la seconda chiude lo strumento e torna alla selezione.',
 '**Più entità insieme:** clic sulla prima, poi **Ctrl + clic** sulle altre.',
 '**Vista:** la rotella ingrandisce verso il puntatore; il tasto destro trascinato sposta; il tasto F adatta il pezzo allo schermo.',
 '**Colori dello schizzo:** blu vuol dire che manca ancora qualche vincolo; nero che è tutto definito; rosso che c\'è un vincolo di troppo. Lo stato si legge anche nella barra in basso.',
 'Se sbagli, `Annulla` (la freccia in alto, oppure Ctrl + Z) torna indietro di un passo.'])
c=lambda n,b=SK:crop(n,b)
D.STEP('Disegna il cerchio di testa','È il diametro esterno della ruota.',[
 'Apri la scheda `Schizzo`, fai clic su `Piano frontale` nell\'albero e premi il pulsante `Schizzo`.',
 'Premi `Cerchio`. Nel riquadro scrivi **X 0** e **Y 0**, poi Invio.',
 'Scrivi **Diametro 44** e Invio. Premi Esc due volte.',
 'Premi `Esci dallo schizzo`.'],[F('g-01-cerchio',(0,.225,.86,.86),'Il cerchio Ø44 centrato nell\'origine: è nero, quindi completamente definito.')])
D.STEP('Estrudi il disco','Dal cerchio nasce il cilindro da cui ricaveremo i denti.',[
 'Apri la scheda `Funzioni` e premi `Estrusione base`. Lo schizzo è già scelto.',
 'Lascia **Condizione finale: Cieca** e scrivi **Profondità 12**, poi Tab.',
 'Controlla l\'anteprima arancione e premi ✓.'],[F('g-02-estrusione',FEPM,'Il pannello dell\'estrusione con l\'anteprima arancione.')],
 'il volume del disco è π × 22² × 12 = **18 246 mm³**. Puoi leggerlo in Valuta › Proprietà di massa.')
D.STEP('Disegna i cerchi di riferimento','Questi cerchi non diventano materiale: servono a costruire il vano con precisione. Si chiamano **geometria di costruzione** e sono tratteggiati.',[
 'Scheda `Schizzo`: fai clic su `Piano frontale` nell\'albero e premi `Schizzo`.',
 'Premi `Cerchio` e disegna quattro cerchi, tutti con **X 0, Y 0**, uno dopo l\'altro: **Diametro 35**, **37,59**, **40**, **46**. Lo strumento resta attivo. Alla fine premi Esc due volte.',
 'Fai clic sul primo cerchio nella parte **in alto a sinistra**, lontano dalle quote. Poi **Ctrl + clic** sugli altri tre, sempre lì.',
 'Premi `Costruzione`, poi Esc due volte. I cerchi diventano tratteggiati.',
 'Premi `Linea di mezzeria`: **X 0, Y 0**, Invio; **Lunghezza 26, Angolo 90**, Invio. Esc due volte. È l\'asse di simmetria del vano.'],[F('g-04-costruzione',(0,.225,.85,1),'I quattro cerchi di costruzione sopra il disco, con la linea di mezzeria verticale.')],
 None,'se fai clic su una quota invece che su un cerchio, nel pannello vedrai «Quota»: premi Esc e riprova.')
D.STEP('Disegna il primo fianco','Ora si lavora vicino al dente: ingrandisci la parte alta del disco con la rotella e sposta la vista con il tasto destro, finché vedi bene dal cerchio Ø35 fino al Ø46.',[
 'Premi `Arco centro-estremi`.',
 'Il primo riquadro chiede il **centro**: **X 7,794**, **Y 17,102**, Invio.',
 'Poi **Raggio 6,84** e **Angolo iniziale 177**, Invio.',
 'Infine **Ampiezza -52**, Invio. Il segno meno vuol dire senso orario. Premi Esc due volte.'],[F('g-05-arco-numerico',(0,.225,.72,.9),'Il centro è fissato: il riquadro Inserimento numerico chiede il prossimo valore.')],
 'la barra in basso dice **Sotto definito (2 gradi di libertà)**: mancano i due vincoli del passo seguente.')
D.STEP('Fissa gli estremi del fianco','L\'arco deve fermarsi esattamente sul cerchio di fondo e sul cerchio limite.',[
 'Fai clic sull\'**estremo basso** dell\'arco, poi **Ctrl + clic** sul cerchio **Ø35**, un po\' più a sinistra. Nel pannello compaiono «Punto» e «Cerchio».',
 'Sotto **Aggiungi relazioni** premi `Coincidente`. Premi Esc due volte.',
 'Fai lo stesso con l\'**estremo alto** dell\'arco e il cerchio **Ø46**.'],[F('g-07-relazione',(0,.225,1,1),'L\'arco è blu perché i suoi estremi sono liberi. Punto e cerchio sono selezionati e il pulsante è «Coincidente».')],
 'la barra in basso dice **Completamente definito**. Il messaggio rosso «contorno aperto» è normale: il vano non è ancora chiuso.')
D.STEP('Specchia il fianco','Il secondo fianco è la copia del primo, ribaltata rispetto alla linea di mezzeria. Se poi cambi il primo, la copia lo segue.',[
 'Fai clic a metà del fianco, non sui suoi estremi.',
 '**Ctrl + clic** sulla linea di mezzeria, un po\' sopra il cerchio Ø40. Nel pannello devono comparire due entità.',
 'Premi `Specchia entità`, poi Esc due volte.'],[F('g-09-due-fianchi',(0,.225,1,1),'I due fianchi simmetrici, tutti neri. La linea di mezzeria arancione è solo ancora selezionata.')],
 'la barra in basso dice ancora **Completamente definito**.')
D.STEP('Chiudi il vano','Mancano la linea in alto e l\'arco di fondo.',[
 'Premi `Linea`. Fai clic sull\'estremo alto del primo fianco, poi su quello del secondo. Premi Esc due volte.',
 'Premi `Arco 3 punti`. Fai clic sull\'**estremo basso destro**, poi sull\'**estremo basso sinistro**.',
 'Porta il mouse **poco sopra** quei due punti e lascialo lì: l\'arco si piega dalla parte del mouse. Scrivi **17,5** e premi Invio. Premi Esc due volte.',
 'Premi `Esci dallo schizzo`.'],[F('g-10-vano',(0,.225,1,1),'Il vano chiuso e tutto nero.')],
 'prima di uscire il pannello dice **Lo schizzo è completamente definito** e **Contorni chiusi: 1 (area 19,50 mm²)**.',
 'usa `Arco 3 punti`, non `Arco centro-estremi` con il centro nell\'origine: i due estremi simmetrici sono già alla stessa distanza dal centro, quindi quell\'arco aggiungerebbe un vincolo di troppo e lo schizzo andrebbe in rosso.')
D.STEP('Taglia il primo vano','Con il profilo chiuso togliamo materiale da tutto lo spessore.',[
 'Scheda `Funzioni`: premi `Taglio estruso`. Lo schizzo appena fatto è già scelto.',
 'In **Condizione finale** scegli **Passante tutto**.',
 'Spunta **Inverti la direzione**: lo schizzo sta sul piano dietro al disco, e il taglio deve andare verso il disco. L\'anteprima rossa deve attraversarlo.',
 'Premi ✓.'],[F('g-12-taglio-inverti',FEPM,'L\'anteprima rossa attraversa il disco.')])
D.STEP('Ripeti il vano 20 volte','La serie circolare copia il taglio attorno all\'asse della ruota.',[
 'Nell\'albero fai clic su `Taglio-Estrusione1`, poi premi `Serie circolare`. Il taglio compare già tra le funzioni da ripetere.',
 'In **Asse** premi `Asse Z`.',
 'Scrivi **Numero di istanze 20**, poi Tab. L\'**Angolo totale** resta 360°.',
 'Premi ✓.'],[F('g-14-serie-pm',FEPM,'Il pannello della serie circolare.'),F('g-15-denti',PART,'I 20 denti.','half')],
 'in Valuta › Proprietà di massa, senza materiale scelto, il volume ora è circa **14 767 mm³**.')
D.STEP('Fai il foro','Il foro accoglie l\'albero.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Cerchio`: **X 0, Y 0**, Invio; **Diametro 12**, Invio. Esc due volte, poi `Esci dallo schizzo`.',
 'Scheda `Funzioni`: `Taglio estruso`, **Passante tutto**, spunta **Inverti la direzione**, ✓.'],[F('g-16-foro-schizzo',(.19,.225,.9,1),'Lo schizzo del foro: il cerchio Ø12 davanti alla ruota.','half')])
D.STEP('Fai la cava per la linguetta','La linguetta trasmette la rotazione tra albero e ruota. Per un albero Ø12 la norma DIN 6885-1 dà larghezza 4 mm e fondo cava a 13,8 mm dal lato opposto del foro: 13,8 − 6 = **7,8 mm dal centro**.',[
 'Scheda `Schizzo`: clic su `Piano frontale`, poi `Schizzo`.',
 '`Rettangolo`: **X -2, Y 0**, Invio; **Larghezza 4**, **Altezza 7,8**, Invio. Esc due volte, poi `Esci dallo schizzo`.',
 'Scheda `Funzioni`: `Taglio estruso`, **Passante tutto**, spunta **Inverti la direzione**, ✓.'],[F('g-17-cava-schizzo',(.19,.225,.9,1),'Il rettangolo parte dal centro e arriva a 7,8 mm: dentro il foro non toglie altro materiale.','half')])
D.STEP('Scegli il materiale e controlla','L\'ultimo passaggio conferma che il pezzo è giusto.',[
 'Scheda `Valuta`: premi `Materiale`, scegli **Acciaio C40** e conferma.',
 'Premi `Proprietà di massa`.'],[two(crop('g-19-materiale',DLG1),'La scelta del materiale.',crop('g-20-massa',DLG2),'Le proprietà di massa del pezzo finito.')],
 'il volume deve essere circa **13 318 mm³** e la massa circa **104,5 g**. Un calcolo separato dal programma, sull\'area esatta del profilo, dà 13 319 mm³: la differenza è meno dello 0,01 %.')
D.RAW(F('g-18-finito',PART,'L\'ingranaggio finito, con 20 denti, foro e cava.','half'))
D.H('Se qualcosa non torna')
D.TAB(['Cosa vedi','Cosa fare'],[
 ['Lo schizzo è **rosso** («Sovradefinito»)','C\'è un vincolo di troppo. Di solito è l\'arco di fondo fatto con il centro nell\'origine (passo 7): annullalo e rifallo con `Arco 3 punti`.'],
 ['Il taglio non toglie nulla, o ✓ è spento','Manca **Inverti la direzione**, oppure è scelto lo schizzo sbagliato.'],
 ['«Contorno aperto» dopo il passo 7','Un clic non è arrivato sul punto. Ingrandisci di più e rifai la linea o l\'arco: il puntatore deve agganciarsi all\'estremo.'],
 ['`Specchia entità` non fa nulla','Devono essere selezionati **il fianco e la linea di mezzeria**. Premi Esc due volte e riprova.'],
 ['L\'arco di fondo passa dalla parte sbagliata','Annulla e rifallo, con il mouse **sopra** i due punti prima di scrivere il raggio.'],
 ['Il clic seleziona una quota','Le scritte delle quote stanno davanti alle linee. Fai clic un po\' più in là sulla stessa linea.'],
])
D.H('Altri ingranaggi')
D.P('Il metodo è lo stesso con altri valori. Nella tabella ci sono le misure per tre ruote, tutte costruite davvero nel Banco CAD con questi numeri. Il raggio dell\'arco di fondo è **df / 2**, il raggio del cerchio di fondo.')
def row(m,z):
    g=gear(m,z);T=g['T'];rl=g['ra']+1;fm=lambda x,n=2:(f'{x:.{n}f}'.rstrip('0').rstrip('.') if n else str(round(x))).replace('.',',')
    a=lambda p:math.degrees(math.atan2(p[1]-T[1],p[0]-T[0]));aS=round(a(g['on'](g['rf'])));aE=round(a(g['on'](rl)))
    return [fm(m,1),z,fm(2*g['ra']),fm(2*g['rf'],2),fm(2*g['rb'],2),fm(2*g['r'],2),fm(2*rl),fm(T[0],3),fm(T[1],3),fm(g['rho'],3),aS,aE-aS]
D.TAB(['m','z','da','df','db','d','limite','X di T','Y di T','Raggio','Angolo iniziale','Ampiezza'],[row(2,20),row(1.5,30),row(1,40)],'num')
D.P('Per altri valori usa le formule della prima pagina. Angolo iniziale e ampiezza possono essere approssimati a pochi gradi: gli estremi li fissano poi le relazioni. Il cerchio limite è **da + 2 mm**.')
D.H('I limiti di questo modello')
D.UL(['**Fianco ad arco.** Sulla ruota di questa guida l\'arco si scosta dall\'evolvente vera al massimo di **0,07 mm** (in testa al dente) e **0,04 mm** (sul cerchio di base). Va bene per studiare, disegnare, fare una tavola o una stampa 3D, non per ricavare i denti di un ingranaggio di precisione.',
 '**Controllo dell\'ingranamento.** In un calcolo separato dal programma, due ruote uguali a interasse 40 mm, provate in 19 posizioni lungo un passo, non si sovrappongono (griglia di 0,02 mm). Avvicinandole a 39,8 mm lo stesso calcolo trova la sovrapposizione.',
 '**Nessun gioco tra i denti** e **nessun raccordo sul fondo del dente**: una ruota vera ha entrambi.',
 '**Pochi denti.** Con α = 20°, sotto i 17 denti una ruota vera richiede accorgimenti particolari (il taglio dei denti ne scava la base). Questo metodo non ne tiene conto: conviene stare da 17 denti in su.'])
D.write(crop('g-21-cover',(.20,.21,1,.97),'g-cover'),'ingranaggio','Come creare un ingranaggio – Banco CAD')
