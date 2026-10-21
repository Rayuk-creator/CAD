// estrae i moduli del nucleo (CSG, Geom, Sketch, Model) dalla pagina in file Node
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(process.argv[2],'utf8'), out=process.argv[3];
fs.mkdirSync(out,{recursive:true});
const m=[...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const names={'root.CSG = api':'csg.js','root.Geom = api':'geom.js','root.Sketch = api':'sketch.js','root.Model = api':'model.js','root.Import = api':'import.js'};
let found=0;
for(const s of m){ // un blocco script può contenerne più d'uno: spezza per "(function (root) {"
  const parts=s.split(/\n(?=(?:\/\*[\s\S]*?\*\/\s*)?\(function \(root\) \{)/);
  for(const p of parts) for(const k in names) if(p.includes(k)){fs.writeFileSync(path.join(out,names[k]),p);found++;}
}
console.log('moduli estratti:',found);
