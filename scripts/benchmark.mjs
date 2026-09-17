import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('.test-output',{recursive:true});
await build({entryPoints:['src/search.ts','src/panel.ts'],outdir:'.test-output/bench',bundle:true,format:'esm',platform:'node'});
const {search,Cancellation,Cancelled,BATCH_SIZE}=await import('../.test-output/bench/search.js');
const {ResultsPanel,PAGE_SIZE}=await import('../.test-output/bench/panel.js');
const dom=new JSDOM('<html><body></body></html>');
const parser=new dom.window.DOMParser();
const uri='http://zotero.org/users/123/items/ATTACH01';
const ref=encodeURIComponent(JSON.stringify({annotationKey:'ANNOT001',attachmentURI:uri}));
function sourceFor(size) {
 let batches=0,maxBatch=0,yields=0;
 const source={
  target:async()=>({attachment:{libraryID:1,key:'ATTACH01'},annotationKeys:new Set(['ANNOT001'])}),
  ceiling:async()=>size,
  rows:async(after,ceiling,limit)=>{batches++;const count=Math.min(limit,ceiling-after);maxBatch=Math.max(maxBatch,count);return Array.from({length:count},(_,i)=>({id:after+i+1,html:(after+i+1)%10===0?`<p><span data-annotation="${ref}">Synthetic quote</span></p>`:`<span data-annotation="invalid">${'Synthetic nonmatching note. '.repeat(15)}</span>`}));},
  note:async id=>({id,title:`Note ${id}`,parent:'Synthetic source',library:'Synthetic library'}),
  parse:html=>parser.parseFromString(html,'text/html'),
  resolver:{attachment:u=>u===uri?{libraryID:1,key:'ATTACH01'}:null,personalLibraryID:1,groupLibraryID:()=>null},
  yield:async()=>{yields++;await new Promise(r=>setTimeout(r,0));}
 };
 return {source,stats:()=>({batches,maxBatch,yields})};
}
const results=[];
for(const size of [1000,10000]) {
 const {source,stats}=sourceFor(size);const before=process.memoryUsage().heapUsed,t=performance.now();
 const matches=await search(source,1,['ANNOT001'],new Cancellation());
 const result={notes:size,matches:matches.length,milliseconds:Math.round(performance.now()-t),heapDeltaMiB:Number(((process.memoryUsage().heapUsed-before)/1048576).toFixed(1)),...stats()};
 if(result.maxBatch>BATCH_SIZE||result.matches!==size/10||result.yields!==Math.ceil(size/BATCH_SIZE))throw Error('Batch/search regression');
 results.push(result);console.log(JSON.stringify(result));
}
const {source,stats}=sourceFor(10000),token=new Cancellation();source.yield=async()=>token.cancel();
try {await search(source,1,['ANNOT001'],token);throw Error('Cancellation failed');}catch(e){if(!(e instanceof Cancelled))throw e;}
if(stats().batches!==1)throw Error('Read beyond cancellation');
const {source:uiSource}=sourceFor(1000);const host={document:dom.window.document,focus(){},createPopup(content){return {show(){dom.window.document.body.append(content);},destroy(){content.remove();}};},openNote:async()=>{},defer:fn=>setTimeout(fn,0),cancelDeferred:clearTimeout,onClose:()=>()=>{}};
const panel=new ResultsPanel(host,uiSource,1,['ANNOT001'],()=>{},e=>{throw e;});
const deadline=performance.now()+30000;
while(!panel.root.querySelector('[role=status]').textContent.includes('referencing notes')) {
 if(performance.now()>deadline)throw Error('UI benchmark timed out: '+panel.root.querySelector('[role=status]').textContent);
 await new Promise(r=>setTimeout(r,10));
}
if(panel.root.querySelectorAll('article').length>PAGE_SIZE)throw Error('Unbounded rendering');panel.dispose();
const report={node:process.version,platform:process.platform,results,cancellationBatches:stats().batches,pageSize:PAGE_SIZE,note:'Synthetic jsdom benchmark; heap delta is GC-sensitive, not a peak-memory measurement or a Zotero performance guarantee.'};
await writeFile('.test-output/benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));dom.window.close();
