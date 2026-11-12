// Guida dell'elica a 3 pale con la pala svergolata (Estrusione con loft). Esegue i passaggi nel Banco CAD e fa le schermate in img/.
const L=require('./lib.js');const fs=require('fs');const tag='e';
(async()=>{const H=await L('img',{width:1500,height:940});const {page,w,shot,stat,tool,num,click}=H;
const S=n=>shot(tag+'-'+n);const esc=async()=>{await page.keyboard.press('Escape');await w(120);await page.keyboard.press('Escape');await w(150);};
// tre sezioni uguali (corda 50, dorso R60, ventre R90, bordi da 1 mm), ruotate di beta
const RR=x=>+x.toFixed(2);
const pts=b=>{const t=b*Math.PI/180,ux=Math.cos(t),uy=Math.sin(t),nx=-uy,ny=ux;const P=(s,k)=>[RR(s*25*ux+k*.5*nx),RR(s*25*uy+k*.5*ny)];return {AU:P(1,1),AL:P(1,-1),BU:P(-1,1),BL:P(-1,-1)};};
const zoomIn=async n=>{const [zx,zy]=await H.at(0,0);await page.mouse.move(zx,zy);for(let i=0;i<n;i++){await page.mouse.wheel(0,-240);await w(70);}await w(300);};
const section=async(plane,b,shots)=>{
  const {AU,AL,BU,BL}=pts(b);console.log('sezione',plane,b,{AU,AL,BU,BL});
  await H.startSketchPlane(plane);await page.evaluate(()=>{App.r.cam.scale=80;App.r.cam.target=Geom.to3(Sketcher.frame(),[0,0]);App.redraw&&App.redraw();});await w(300);console.log('cam',await page.evaluate(()=>JSON.stringify({s:App.r.cam.scale,t:App.r.cam.target})));
  await tool('point');for(const p of [AU,AL,BU,BL])await num({x:p[0],y:p[1]});await esc();await page.mouse.move(5,5);if(shots)await S('01-punti');
  await tool('arc3');await num({x:AU[0],y:AU[1]});await num({x:BU[0],y:BU[1]});await H.move(-8,18);if(shots)await S('02-arco-raggio');await page.keyboard.type('60');await page.keyboard.press('Enter');await w(200);await esc();
  await tool('arc3');await num({x:AL[0],y:AL[1]});await num({x:BL[0],y:BL[1]});await H.move(-8,18);await page.keyboard.type('90');await page.keyboard.press('Enter');await w(200);await esc();
  await tool('line');await click(AU[0],AU[1]);await click(AL[0],AL[1]);await esc();await tool('line');await click(BU[0],BU[1]);await click(BL[0],BL[1]);await esc();
  console.log(JSON.stringify(await H.ents()));const st=await stat();const msg=(await page.locator('#pm').innerText()).replace(/\n/g,' | ');console.log('chiuso',plane,st,msg.slice(0,400));
  await page.mouse.move(5,5);await S('03-sezione-'+b);await H.exit();return st;};
// piani di riferimento
const plane=async(d,shot)=>{await H.tab('features');await tool('plane');await w(300);await page.locator('#pm button',{hasText:'Superiore'}).first().click();await w(200);
  const i=H.row('Distanza').locator('input');await i.fill(String(d));await i.press('Tab');await w(400);await H.iso();if(shot)await S(shot);await H.ok();console.log('piano',d,await page.evaluate(()=>{const f=App.doc.features.at(-1);return f.name+' '+JSON.stringify(f.base)+' '+f.offset}));};
await plane(50,'00-piano');await plane(105);await H.iso();await page.mouse.move(5,5);await S('00-piani');
await section('Piano superiore',45,true);
await section('Piano1',29);
await section('Piano2',15);
await H.iso();await page.mouse.move(5,5);await S('04-tre-sezioni');
// loft
await H.tab('features');await tool('loft');await w(600);
console.log('loft pm',(await page.locator('#pm').innerText()).slice(0,700).replace(/\n/g,' | '));
console.log('profili',await page.evaluate(()=>App.doc.features.at(-1).profiles.map(id=>App.doc.features.find(f=>f.id===id).name)));
await H.iso();await page.mouse.move(5,5);await S('05-loft');await H.ok();console.log('loft',await H.props());await H.iso();await page.mouse.move(5,5);await S('05-pala');
await H.view('top');await page.mouse.move(5,5);await S('05b-dall-alto');
// contorno
await H.view('front');await H.startSketchPlane('Piano frontale');
await tool('rect');await num({x:-30,y:-5});await num({w:60,h:115});await esc();
await tool('point');for(const p of [[8,10],[-8,10],[8,95.5],[-8,95.5]])await num({x:p[0],y:p[1]});await esc();
await tool('line');await click(8,10);await click(-8,10);await esc();
await tool('arc3');await num({x:8,y:10});await num({x:8,y:95.5});await H.move(25,50);await page.keyboard.type('82');await page.keyboard.press('Enter');await w(200);await esc();
await tool('arc3');await num({x:-8,y:95.5});await num({x:-8,y:10});await H.move(-25,50);await page.keyboard.type('82');await page.keyboard.press('Enter');await w(200);await esc();
await page.mouse.move(5,5);await S('06-fianchi');
await tool('tarc');await click(8,95.5);await click(-8,95.5);await esc();
console.log('contorno',await stat(),(await page.locator('#pm').innerText()).slice(0,330).replace(/\n/g,' | '));await page.mouse.move(5,5);await S('07-contorno');await H.exit();await page.evaluate(()=>App.r.fit());await w(400);
await H.tab('features');await tool('cut');await w(400);await page.selectOption('#pm_end','through');await w(300);await page.locator('#pm label.chk',{hasText:'Estrudi anche'}).locator('input').check();await w(300);await page.locator('#pm select').filter({has:page.locator('option[value=through]')}).nth(1).selectOption('through');await w(500);
await H.iso();{const vb=await page.evaluate(()=>{const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+c.width/2,c.top+c.height/2]});await page.mouse.move(vb[0],vb[1]);for(let i=0;i<3;i++){await page.mouse.wheel(0,240);await w(70);}await w(300);await page.mouse.move(5,5);}await S('08-taglio');await H.ok();console.log('taglio',await H.props());await H.iso();await page.mouse.move(5,5);await S('09-pala-sagomata');
fs.writeFileSync(tag+'-1.json',await page.evaluate(()=>JSON.stringify(App.doc)));
// serie di corpi
await tool('cpattern');await w(400);
await page.locator('#pm').getByText('Fai clic qui e poi su un corpo').click().catch(e=>console.log('box',e.message.slice(0,80)));await w(300);
const nm=await page.evaluate(()=>App.st.bodies.map(b=>b.name));console.log('corpi',nm);
await page.locator('#partFly button',{hasText:nm[0]}).first().click();await w(400);
await page.locator('#pm button',{hasText:'Asse Z'}).click();await w(300);const nI=H.row('Numero di istanze').locator('input');await nI.fill('3');await nI.press('Tab');await w(800);await H.iso();{const vb=await page.evaluate(()=>{const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+c.width/2,c.top+c.height/2]});await page.mouse.move(vb[0],vb[1]);for(let i=0;i<2;i++){await page.mouse.wheel(0,240);await w(70);}await w(300);await page.mouse.move(5,5);}await S('10-serie');await H.ok();console.log('serie',await H.props());await H.iso();await page.mouse.move(5,5);await S('11-tre-pale');
// mozzo
await H.view('front');await H.startSketchPlane('Piano frontale');await tool('circle');await num({x:0,y:0});await num({d:30});await esc();await H.exit();
await H.tab('features');await tool('extrude');await w(400);await page.selectOption('#pm_end','mid');await w(300);const dep2=H.row('Profondità').locator('input');await dep2.fill('30');await dep2.press('Tab');await w(700);console.log('pm mozzo',(await page.locator('#pm').innerText()).slice(0,900).replace(/\n/g,' | '));await H.iso();await S('12-mozzo');await H.ok();console.log('mozzo',await H.props());await H.iso();await page.mouse.move(5,5);await S('13-con-mozzo');
// foro
await H.view('front');await H.startSketchPlane('Piano frontale');await tool('circle');await num({x:0,y:0});await num({d:10});await esc();await H.exit();
await H.tab('features');await tool('cut');await w(400);await page.selectOption('#pm_end','through');await w(300);await page.locator('#pm label.chk',{hasText:'Estrudi anche'}).locator('input').check();await w(300);await page.locator('#pm select').filter({has:page.locator('option[value=through]')}).nth(1).selectOption('through');await w(500);await H.ok();console.log('foro',await H.props());
// smusso
await H.iso();await tool('chamfer');await w(300);const dd=page.locator('.pm-body .row',{hasText:'Distanza'}).locator('input');await dd.first().fill('1.5');await dd.first().press('Tab');await w(300);
{const q=await page.evaluate(()=>{const p=App.r.project([0,0,15]);const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+p[0],c.top+p[1]];});await page.mouse.move(q[0],q[1]);for(let i=0;i<3;i++){await page.mouse.wheel(0,-240);await w(70);}await w(300);}await H.world([15*Math.cos(-.5),15*Math.sin(-.5),15]);await page.mouse.move(5,5);console.log('spigoli',await page.evaluate(()=>JSON.stringify(App.doc.features.at(-1).edges||[]).slice(0,200)));await S('14-smusso');
await H.ok();console.log('smusso',await H.props());await H.iso();await page.mouse.move(5,5);await S('15-finita');await H.view('front');await page.mouse.move(5,5);await S('16-davanti');await H.view('top');await page.mouse.move(5,5);await S('16b-dall-alto');
await H.tab('evaluate');await page.click('#cmdBar [data-cmd="material"]');await w(250);await page.selectOption('#modal select','pla');await S('17-materiale');await page.click('#modalActions .btn-primary');await w(300);
await page.click('#cmdBar [data-cmd="mass"]');await w(300);await S('18-massa');console.log('massa',await H.props(),(await page.locator('#modal').innerText()).slice(0,300).replace(/\n/g,' | '));await page.click('#modalActions .btn-primary');await w(200);
await H.tab('features');await H.iso();{const vb=await page.evaluate(()=>{const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+c.width/2,c.top+c.height/2]});await page.mouse.move(vb[0],vb[1]);await w(300);await page.mouse.move(5,5);await S('19-cover');}
fs.writeFileSync(tag+'-finale.json',await page.evaluate(()=>JSON.stringify(App.doc)));
console.log('err',H.errs);await H.b.close();})().catch(e=>{console.error(e);process.exit(1)});
