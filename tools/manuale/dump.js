const { chromium } = require('playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('file://'+require('path').resolve(__dirname,'../../index.html'));await p.waitForFunction(()=>window.App&&App.r);await p.waitForTimeout(500);
const d=await p.evaluate(()=>{
 const tabs=[...document.querySelectorAll('[data-ct]')].map(e=>({id:e.dataset.ct,t:e.textContent.trim()}));
 const cmds={};for(const t of tabs){try{App.setCmdTab(t.id);cmds[t.id]=[...document.querySelectorAll('#cmdBar [data-cmd]')].map(c=>({id:c.dataset.cmd,t:c.textContent.trim(),tip:c.title||''}));}catch(e){cmds[t.id]=String(e)}}
 App.setCmdTab('features');
 const menu=[...document.querySelectorAll('#menuFile [data-act], #menuFile button')].map(e=>({act:e.dataset.act||'',t:e.textContent.trim()}));
 return {topics:Guide.topics,entries:Glossary.entries,tabs,cmds,menu};});
await p.evaluate(()=>{App.setCmdTab('sketch');App.select({kind:'plane',id:'top',label:'Piano superiore'});});
await p.click('#cmdBar [data-cmd="sketch"]');await p.waitForFunction(()=>App.mode==='sketch');await p.waitForTimeout(300);
const sk=await p.evaluate(()=>[...document.querySelectorAll('#cmdBar [data-cmd]')].map(c=>({id:c.dataset.cmd,t:c.textContent.trim(),tip:c.title||''})));
const oldT=d.cmds.sketch;d.cmds.sketch=sk.filter(c=>c.id!=='exitSketch').length?sk:oldT;
fs.writeFileSync(process.argv[2],JSON.stringify(d,null,1));
await b.close();})();
