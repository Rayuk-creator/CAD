const { chromium } = require('playwright');
const IMG=process.argv[2];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const c=await b.newContext({viewport:{width:1280,height:780},deviceScaleFactor:1.5,colorScheme:'light'});const page=await c.newPage();
page.on('pageerror',e=>console.log('ERR',e.message));
await page.goto('file://'+require('path').resolve(__dirname,'../../index.html'));await page.waitForFunction(()=>window.App&&App.r);await page.waitForTimeout(800);
const shot=async n=>{await page.addStyleTag({content:'.toast,#toast{display:none!important}'});await page.waitForTimeout(300);await page.screenshot({path:IMG+'/'+n+'.png'});console.log('shot',n);};
const helpers=()=>page.evaluate(()=>{window.__scr=(u,v)=>{const F=Sketcher.frame();const p=App.r.project(Geom.to3(F,[u,v]));const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+p[0],c.top+p[1]];};});
const click=async(u,v)=>{const [x,y]=await page.evaluate(([u,v])=>__scr(u,v),[u,v]);await page.mouse.move(x,y);await page.waitForTimeout(40);await page.mouse.click(x,y);await page.waitForTimeout(100);};
const tool=async id=>{if(await page.evaluate(id=>App.mode==='sketch'&&Sketcher.session().tool===id,id))return;await page.click(`#cmdBar [data-cmd="${id}"]`);await page.waitForTimeout(100);};
const val=async v=>{const i=page.locator('.modify input');await i.waitFor({timeout:2000});await i.fill(String(v));await i.press('Enter');await page.waitForTimeout(150);};
const stat=()=>page.evaluate(()=>Sketch.analyze(Sketcher.session().sk).status);
const props=()=>page.evaluate(()=>{const m=Model.massProperties(App.st,App.doc);return {V:m.volume,A:m.area,mass:m.mass,err:[...App.st.errors.values()]};});
const atW=async w=>{const [x,y]=await page.evaluate(q=>{const p=App.r.project(q);const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left+p[0],c.top+p[1]];},w);await page.mouse.move(x,y);await page.waitForTimeout(150);await page.mouse.click(x,y);await page.waitForTimeout(250);};
// schermata iniziale
await shot('schermo-vuoto');
// 1 schizzo
await page.evaluate(()=>App.setCmdTab('sketch'));
await page.locator('.tnode',{hasText:'Piano superiore'}).first().click();await tool('sketch');
await page.waitForFunction(()=>App.mode==='sketch');await page.waitForTimeout(1300);await helpers();
await tool('rect');await click(0,0);await click(70,40);await page.keyboard.press('Escape');await page.waitForTimeout(100);
console.log('stato dopo rettangolo',await stat());await shot('es-1-rettangolo');
await tool('dim');await click(35,0);await click(35,-12);await val(80);
await click(80,20);await click(92,20);await val(50);
console.log('stato dopo quote',await stat());await page.keyboard.press('Escape');await shot('es-2-quote');
// 2 estrusione
await page.evaluate(()=>App.setCmdTab('features'));await tool('extrude');await page.waitForTimeout(300);
const dep=page.locator('.pm-body .row',{hasText:'Profondità'}).first().locator('input');await dep.fill('10');await dep.press('Tab');await page.waitForTimeout(300);
await shot('es-3-estrusione');await page.click('.pm-ok');await page.waitForFunction(()=>!App.pm);await page.waitForTimeout(400);
console.log('V estr',await props());await page.evaluate(()=>App.r.fit());await page.waitForTimeout(500);await shot('es-4-piastra');
// 3 schizzo sulla faccia alta, cerchio
await atW([40,10,-40]);
console.log('sel',await page.evaluate(()=>App.sel.map(s=>s.label)));
await page.evaluate(()=>App.setCmdTab('sketch'));await tool('sketch');
await page.waitForFunction(()=>App.mode==='sketch');await page.waitForTimeout(1300);await helpers();
await tool('circle');await click(40,25);await click(50,25);await page.keyboard.press('Escape');await page.waitForTimeout(100);
await tool('dim');await click(50,25);await click(60,35);await val(20);
console.log('stato con diametro',await stat());
await click(0,0);await click(40,25);await click(20,-14);await val(40);
console.log('stato con 40',await stat());
await click(0,0);await click(40,25);await click(-14,12);await val(25);
console.log('stato con 25',await stat(),await page.evaluate(()=>{const s=Sketcher.session().sk;return s.ents.filter(e=>e.t==='ci').map(e=>{const c=s.ents.find(x=>x.id===e.c);return [c.x,c.y,e.r]})}));
await page.keyboard.press('Escape');await shot('es-5-cerchio');
// 4 taglio
await page.evaluate(()=>App.setCmdTab('features'));await tool('cut');await page.waitForTimeout(400);await shot('es-6-taglio');
await page.click('.pm-ok');await page.waitForFunction(()=>!App.pm);await page.waitForTimeout(400);console.log('V taglio',await props());
// 5 raccordi
await page.evaluate(()=>App.r.setView(GLView.Renderer.viewQ('iso')));await page.waitForTimeout(700);await page.evaluate(()=>App.r.fit());await page.waitForTimeout(600);
await tool('fillet');await page.waitForTimeout(300);
const rr=page.locator('.pm-body .row',{hasText:'Raggio'}).first().locator('input');await rr.fill('5');await rr.press('Tab');
for(const w of [[0,5,0],[80,5,0],[80,5,-50]]){await atW(w);console.log(w,await page.evaluate(()=>App.doc.features[App.doc.features.length-1].edges.length));}
await shot('es-7-raccordo');
{const cv=await page.evaluate(()=>{const c=document.querySelector('.view canvas').getBoundingClientRect();return [c.left,c.top,c.width,c.height]});const y=cv[1]+cv[3]-60,x=cv[0]+cv[2]-120;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-220,y-10,{steps:12});await page.mouse.up();await page.waitForTimeout(500);}
await atW([0,5,-50]);console.log('quarto',await page.evaluate(()=>App.doc.features[App.doc.features.length-1].edges.length));
await page.click('.pm-ok');await page.waitForFunction(()=>!App.pm);await page.waitForTimeout(400);console.log('V racc',await props());
await page.evaluate(()=>App.r.setView(GLView.Renderer.viewQ('iso')));await page.waitForTimeout(800);
await page.evaluate(()=>{App.select(null);App.setCmdTab('evaluate');});await page.mouse.move(5,5);await shot('es-8-finito');
await page.click('#cmdBar [data-cmd="material"]');await page.waitForTimeout(250);
console.log('opzioni mat',await page.evaluate(()=>[...document.querySelectorAll('#modal select')].length));
await page.selectOption('#modal select','s235').catch(e=>console.log('sel',e.message.slice(0,80)));await shot('es-9-materiale');await page.click('#modalActions .btn-primary');await page.waitForTimeout(300);
await page.click('#cmdBar [data-cmd="mass"]');await page.waitForTimeout(300);await shot('es-10-massa');console.log('massa',await props(),await page.evaluate(()=>document.querySelector('#modal').innerText.slice(0,300)));await page.click('#modalActions .btn-primary');await page.waitForTimeout(200);
await page.click('[data-ct="drawing"]');await page.waitForTimeout(800);await shot('es-11-tavola');
await page.click('#cmdBar [data-cmd="dAuto"]').catch(()=>{});await page.waitForTimeout(500);await shot('es-12-tavola-quote');
await page.click('[data-ct="features"]');await page.waitForTimeout(400);
const saved=await page.evaluate(()=>JSON.stringify(App.doc));require('fs').writeFileSync(IMG+'/../piastra.json',saved);
await b.close();})().catch(e=>{console.error(e);process.exit(1)});
