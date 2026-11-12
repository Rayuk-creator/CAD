const { chromium } = require('playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('file://'+require('path').resolve(__dirname,'../../index.html')+(process.env.MANUALE_LINGUA==='en'?'?lang=en':''));await p.waitForFunction(()=>window.App&&App.r);await p.waitForTimeout(500);
const d=await p.evaluate(()=>{
 const tabs=[...document.querySelectorAll('[data-ct]')].map(e=>({id:e.dataset.ct,t:e.textContent.trim()}));
 // i pulsanti si leggono subito dopo il cambio di scheda (aspettando, la scheda Messa in tavola torna a un'altra);
 // in inglese la pagina non li ha ancora tradotti: si traducono con lo stesso dizionario (I18N.t), che dà gli stessi testi
 const tr=s=>window.I18N&&I18N.en?I18N.t(s):s;
 const cmds={};for(const t of tabs){try{App.setCmdTab(t.id);cmds[t.id]=[...document.querySelectorAll('#cmdBar [data-cmd]')].map(c=>({id:c.dataset.cmd,t:tr(c.textContent.trim()),tip:tr((c.title||'').split('\n')[0])}));}catch(e){cmds[t.id]=String(e)}}
 App.setCmdTab('features');
 const menu=[...document.querySelectorAll('#menuFile [data-act], #menuFile button')].map(e=>({act:e.dataset.act||'',t:e.textContent.trim()}));
 // in inglese: Guida e Glossario come li mostra la pagina (le chiavi [[…]] della Guida sono i termini italiani del Glossario)
 const en=(window.I18N&&I18N.en)?(()=>{const G=Glossary,keys=new Set();const scan=x=>String(x).replace(/\[\[([^\]|]+)/g,(m,k)=>{keys.add(k);return m;});
  for(const t of Object.values(Guide.en.argomenti)){scan(t.why);(t.steps||[]).forEach(scan);(t.tips||[]).forEach(scan);}
  const terms={};for(const k of keys){const e=G.find(k);terms[k]=e?G.name(e):null;}
  return {guide:Guide.en,entries:G.entries.map(e=>[G.catName(e[0]),G.name(e),e[2],G.desc(e)]),terms};})():null;
 return {topics:Guide.topics,entries:Glossary.entries,tabs,cmds,menu,en};});
await p.evaluate(()=>{App.setCmdTab('sketch');App.select({kind:'plane',id:'top',label:'Piano superiore'});});
await p.click('#cmdBar [data-cmd="sketch"]');await p.waitForFunction(()=>App.mode==='sketch');await p.waitForTimeout(300);
const sk=await p.evaluate(()=>[...document.querySelectorAll('#cmdBar [data-cmd]')].map(c=>({id:c.dataset.cmd,t:c.textContent.trim(),tip:c.title||''})));
const oldT=d.cmds.sketch;d.cmds.sketch=sk.filter(c=>c.id!=='exitSketch').length?sk:oldT;
fs.writeFileSync(process.argv[2],JSON.stringify(d,null,1));
await b.close();})();
