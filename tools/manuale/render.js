const { chromium } = require('playwright');
(async()=>{const M=process.argv[2];const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});const p=await b.newPage();await p.goto('file://'+M+'/manuale.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);
await p.pdf({path:M+'/manuale.pdf',preferCSSPageSize:true,printBackground:true,outline:true,tagged:true});await b.close();})();
