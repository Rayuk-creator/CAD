const L=require('./lib.js');const fs=require('fs');
const [,,M,Z,TAG]=process.argv;const m=+M||2,z=+Z||20,tag=TAG||'g';
(async()=>{const H=await L('img',{width:1500,height:940});const {page,w,shot,stat,tool,num,click}=H;
const S=n=>shot(tag+'-'+n);
const a=20*Math.PI/180,r=m*z/2,ra=r+m,rf=r-1.25*m,rb=r*Math.cos(a),rho=r*Math.sin(a),del=Math.PI/(2*z)+a;
const R3=x=>Math.round(x*1000)/1000,R2=x=>Math.round(x*100)/100;
const T=[R3(rb*Math.sin(del)),R3(rb*Math.cos(del))],rl=ra+1,rhoT=R3(rho);
const on=R=>{const D=Math.hypot(...T),x=(D*D-rhoT*rhoT+R*R)/(2*D),h=Math.sqrt(R*R-x*x),u=[T[0]/D,T[1]/D];return [x*u[0]-h*u[1],x*u[1]+h*u[0]];};
const esc=async()=>{await page.keyboard.press('Escape');await w(120);await page.keyboard.press('Escape');await w(150);};
const pts={pr:on(rf),pt:on(rl)};
const aS=Math.atan2(pts.pr[1]-T[1],pts.pr[0]-T[0])*180/Math.PI,aE=Math.atan2(pts.pt[1]-T[1],pts.pt[0]-T[0])*180/Math.PI;
console.log('dati',{r,ra,rf,rb,rho,T,rhoT,rl,aS,aE,pts});
// 1 disco
await H.startSketchPlane('Piano frontale');
await tool('circle');await num({x:0,y:0});await num({d:2*ra});await esc();await S('01-cerchio');console.log('st1',await stat());
await H.exit();await H.tab('features');await tool('extrude');await w(300);const dep=H.row('Profondità').locator('input');await dep.fill('12');await dep.press('Tab');await w(400);await S('02-estrusione');await H.ok();
console.log('disco',await H.props());await H.iso();await page.mouse.move(5,5);await S('03-disco');
// 2 vano
await H.view('front');await H.startSketchPlane('Piano frontale');
await tool('circle');await num({x:0,y:0});await num({d:2*rf});await num({x:0,y:0});await num({d:R2(2*rb)});await num({x:0,y:0});await num({d:2*r});await num({x:0,y:0});await num({d:2*rl});await esc();
const e0=await H.ents();const cc=e0.filter(x=>x.t==='ci');let first=true;for(const c of cc){await click(-c.r*Math.sin(.7),c.r*Math.cos(.7),first?null:'Control');first=false;}
console.log('sel',await page.evaluate(()=>[...Sketcher.session().sel]));await tool('construction');await esc();await tool('centerline');await num({x:0,y:0});await num({L:rl+3,a:90});await esc();await page.mouse.move(5,5);await S('04-costruzione');console.log('mezzeria',await stat());
{const [px,py]=await H.at(0,0);const [zx0,zy0]=await H.at(0,ra);const vb=await page.evaluate(()=>{const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left,c.top,c.width,c.height]});
const cy=vb[1]+vb[3]*0.5,cx=vb[0]+vb[2]*0.5;await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});await page.mouse.move(cx+(cx-zx0),cy+(cy-(zy0+60)),{steps:6});await page.mouse.up({button:'right'});await w(200);
const [zx,zy]=await H.at(1,ra);await page.mouse.move(zx,zy);for(let i=0;i<6;i++){await page.mouse.wheel(0,-240);await w(70);}await w(300);}
await tool('carc');await num({x:T[0],y:T[1]});await num({r:rhoT,a:Math.round(aS)});await S('05-arco-numerico');await num({s:Math.round(aE)-Math.round(aS)});await esc();await S('06-arco');console.log('dopo arco',await stat());
let e=await H.ents();const ar=e.filter(x=>x.t==='ar')[0];const pt=id=>e.find(x=>x.id===id);const top=pt(ar.a),bot=pt(ar.b);console.log(top,bot);
const pick=async(px,py,R,side)=>{for(const an of [.05,.1,.16,.22,.28,.35,.42,.5,.6]){await esc();await click(px,py);const X=side*R*Math.sin(an),Y=R*Math.cos(an);await click(X,Y,'Control');const sel=await page.evaluate(()=>[...Sketcher.session().sel]);const ok=await page.evaluate(sel=>{const m=new Map(Sketcher.session().sk.ents.map(e=>[e.id,e]));return sel.length===2&&sel.some(i=>m.get(i)&&m.get(i).t==='pt')&&sel.some(i=>m.get(i)&&m.get(i).t==='ci');},sel);if(ok){console.log('sel',sel,'an',an);return;}}throw new Error('selezione non riuscita');};
const rel=async()=>{const b=page.locator('#pm button',{hasText:'Coincidente'}).first();await b.click();await w(250);};
await pick(bot.x,bot.y,rf,-1);await S('07-relazione');await rel();await esc();
console.log('rel1',await stat());
e=await H.ents();const top2=e.find(x=>x.id===ar.a);await pick(top2.x,top2.y,rl,-1);await rel();await esc();
console.log('rel2',await stat());await page.mouse.move(5,5);await S('08-nero');
// specchio
e=await H.ents();const P=id=>e.find(x=>x.id===id);const b2=P(ar.b),t2=P(ar.a),c2=P(ar.c);
const mid=(()=>{const a0=Math.atan2(b2.y-c2.y,b2.x-c2.x),a1=Math.atan2(t2.y-c2.y,t2.x-c2.x),am=(a0+a1)/2,rr=Math.hypot(b2.x-c2.x,b2.y-c2.y);return [c2.x+rr*Math.cos(am),c2.y+rr*Math.sin(am)];})();
await esc();await click(mid[0],mid[1]);await click(0,(r+ra)/2,'Control');console.log('sel specchio',await page.evaluate(()=>[...Sketcher.session().sel]));await page.mouse.move(5,5);await S('09a-selezione');await tool('smirror');await w(200);await esc();console.log('specchio',await stat());await page.mouse.move(5,5);await S('09-due-fianchi');
e=await H.ents();const arcs=e.filter(x=>x.t==='ar');
const G=id=>e.find(x=>x.id===id);const a1=arcs[0],a2=arcs[1];
const ends=[G(a1.a),G(a1.b),G(a2.a),G(a2.b)];console.log(ends.map(p=>[p.id,p.x,p.y,Math.hypot(p.x,p.y)]));
const tops=ends.filter(p=>Math.hypot(p.x,p.y)>r).sort((a,b)=>b.x-a.x),bots=ends.filter(p=>Math.hypot(p.x,p.y)<r).sort((a,b)=>b.x-a.x);
// testa: linea
await tool('line');await click(tops[0].x,tops[0].y);await click(tops[1].x,tops[1].y);await esc();console.log('linea',await stat());
// fondo: arco col centro nell'origine
await tool('arc3');await click(bots[0].x,bots[0].y);await click(bots[1].x,bots[1].y);await H.move(0,rf+0.6);await w(150);await page.keyboard.type(String(rf).replace('.',','));await w(100);await page.keyboard.press('Enter');await w(250);await esc();
console.log('fondo',await stat());e=await H.ents();{const q=e.filter(x=>x.t==='ar').at(-1),C=e.find(x=>x.id===q.c);console.log('centro fondo',C.x,C.y,'raggio',Math.hypot(e.find(x=>x.id===q.a).x-C.x,e.find(x=>x.id===q.a).y-C.y));}
console.log('msg',(await page.locator('#pm').innerText()).slice(0,260).replace(/\n/g,' | '));
await page.mouse.move(5,5);console.log('STATO VANO',await stat());await S('10-vano');
await page.evaluate(()=>App.r.fit&&0);
await H.exit();await page.evaluate(()=>App.r.fit());await w(500);
// taglio
await H.tab('features');await tool('cut');await w(400);console.log('pm taglio',(await page.locator('#pm').innerText()).slice(0,420).replace(/\n/g,' | '));await S('11-taglio-pm');
await page.selectOption('#pm_end','through');await w(400);console.log('nota',(await page.locator('#pm .note').allInnerTexts()).join(' / ').slice(0,300));console.log('ok disabled?',await page.evaluate(()=>document.querySelector('.pm-ok').disabled));
console.log('pm2',(await page.locator('#pm').innerText()).slice(280,700).replace(/\n/g,' | '));
await S('11b-taglio-passante');
await page.locator('#pm label.chk',{hasText:'Inverti la direzione'}).locator('input').check();await w(500);await S('12-taglio-inverti');console.log('ok disabled inv?',await page.evaluate(()=>document.querySelector('.pm-ok').disabled));
await H.ok();console.log('taglio',await H.props());await H.iso();await page.mouse.move(5,5);await S('13-primo-vano');
// serie circolare
const name=await page.evaluate(()=>App.doc.features.at(-1).name);console.log('nome',name, await page.evaluate(()=>App.doc.features.map(f=>f.type+':'+f.name)));
await page.locator('.tnode',{hasText:name}).first().click();await w(200);
await tool('cpattern');await w(400);console.log('pm serie',(await page.locator('#pm').innerText()).slice(0,500).replace(/\n/g,' | '));
await page.locator('#pm button',{hasText:'Asse Z'}).click();await w(300);
const nI=H.row('Numero di istanze').locator('input');await nI.fill(String(z));await nI.press('Tab');await w(1500);await S('14-serie-pm');
const t0=Date.now();await H.ok();console.log('serie ms',Date.now()-t0,await H.props());await H.iso();await page.mouse.move(5,5);await S('15-denti');
fs.writeFileSync(tag+'-doc.json',await page.evaluate(()=>JSON.stringify(App.doc)));
// foro
await H.view('front');await H.startSketchPlane('Piano frontale');await tool('circle');await num({x:0,y:0});await num({d:12});await esc();await page.mouse.move(5,5);await S('16-foro-schizzo');await H.exit();
await H.tab('features');await tool('cut');await w(400);await page.selectOption('#pm_end','through');await w(300);await page.locator('#pm label.chk',{hasText:'Inverti la direzione'}).locator('input').check();await w(500);await H.ok();console.log('foro',await H.props());
// cava
await H.view('front');await H.startSketchPlane('Piano frontale');await tool('rect');await num({x:-2,y:0});await num({w:4,h:7.8});await esc();console.log('cava',await stat());await page.mouse.move(5,5);await S('17-cava-schizzo');await H.exit();
await H.tab('features');await tool('cut');await w(400);await page.selectOption('#pm_end','through');await w(300);await page.locator('#pm label.chk',{hasText:'Inverti la direzione'}).locator('input').check();await w(500);await H.ok();console.log('cava',await H.props());
await H.iso();await page.mouse.move(5,5);await S('18-finito');
// massa
await H.tab('evaluate');await page.click('#cmdBar [data-cmd="material"]');await w(250);await page.selectOption('#modal select','c40');await S('19-materiale');await page.click('#modalActions .btn-primary');await w(300);
await page.click('#cmdBar [data-cmd="mass"]');await w(300);await S('20-massa');console.log('massa',await H.props(),(await page.locator('#modal').innerText()).slice(0,400).replace(/\n/g,' | '));await page.click('#modalActions .btn-primary');await w(200);
await H.iso();{const vb=await page.evaluate(()=>{const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+c.width/2,c.top+c.height/2]});await page.mouse.move(vb[0],vb[1]);for(let i=0;i<2;i++){await page.mouse.wheel(0,-240);await w(70);}await w(300);await page.mouse.move(5,5);await S('21-cover');}
fs.writeFileSync(tag+'-finale.json',await page.evaluate(()=>JSON.stringify(App.doc)));
console.log('errori pagina',H.errs);
await H.b.close();})().catch(e=>{console.error(e);process.exit(1)});
