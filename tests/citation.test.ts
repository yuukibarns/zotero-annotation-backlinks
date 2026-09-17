import {describe,it,expect,vi} from 'vitest';
import {matchEvidence} from '../src/matcher';
import {search,Cancellation} from '../src/search';
import {ResultsPanel} from '../src/panel';
import {sourceWith,annotation,uri,makeHost} from './helpers';
import type {Target} from '../src/types';
const target:Target={attachment:{libraryID:1,key:'ATTACH01'},annotationKeys:new Set(['ANNOT001']),citationHints:[{annotationKey:'ANNOT001',source:{libraryID:1,key:'ATTACH01'},page:'385',comment:'KV cache'}]};
function citation(page='385',source=uri,comment='KV cache') {return `<p><span data-citation="${encodeURIComponent(JSON.stringify({citationItems:[{uris:[source],locator:page}],properties:{}}))}">Book, p. ${page}</span> ${comment}</p>`;}
function match(html:string,t=target){return matchEvidence(new DOMParser().parseFromString(html,'text/html'),t,sourceWith().resolver);}
describe('citation-only possible matches',()=>{
 it('finds source/page/comment while keeping exact evidence empty',()=>expect(match(citation())).toEqual({annotationKeys:[],possibleAnnotationKeys:['ANNOT001']}));
 it('normalizes whitespace, case and inline formatting',()=>expect(match(citation('385',uri,'<b>kv</b>   CACHE')).possibleAnnotationKeys).toEqual(['ANNOT001']));
 it.each([citation('386'),citation('385',uri.replace('ATTACH01','OTHER001')),citation('385',uri,'KV caches'),citation('385',uri,'unrelated'),'<p>KV cache 385</p>'])('rejects insufficient evidence %s',html=>expect(match(html).possibleAnnotationKeys).toEqual([]));
 it('does not confuse identical source keys in different libraries',()=>expect(match(citation(),{...target,citationHints:[{...target.citationHints![0],source:{libraryID:2,key:'ATTACH01'}}]}).possibleAnnotationKeys).toEqual([]));
 it('does not take comment text from a separate paragraph',()=>expect(match(citation('385',uri,'')+'<p>KV cache</p>').possibleAnnotationKeys).toEqual([]));
 it('stops nearby text at the next citation',()=>expect(match(citation('385',uri,'').replace('</p>','')+citation('386').replace('<p>','')).possibleAnnotationKeys).toEqual([]));
 it('does not use quoted annotation text as a plain comment',()=>expect(match(citation('385',uri,annotation('OTHER001').replace('Quote','KV cache'))).possibleAnnotationKeys).toEqual([]));
 it('requires nonempty comment and selected annotation',()=>{expect(match(citation(),{...target,citationHints:[{...target.citationHints![0],comment:''}]}).possibleAnnotationKeys).toEqual([]);expect(match(citation(),{...target,annotationKeys:new Set()}).possibleAnnotationKeys).toEqual([]);});
 it('does not downgrade exact evidence or duplicate it',()=>expect(match(annotation()+citation()+citation())).toEqual({annotationKeys:['ANNOT001'],possibleAnnotationKeys:[]}));
 it('isolates malformed citations',()=>expect(match('<span data-citation="%broken">x</span>'+citation()).possibleAnnotationKeys).toEqual(['ANNOT001']));
 it('deduplicates possible evidence',()=>expect(match(citation()+citation()).possibleAnnotationKeys).toEqual(['ANNOT001']));
 it('sorts exact results first and revalidates possible notes',async()=>{
  const s=sourceWith([{id:1,html:citation()},{id:2,html:annotation()}]);vi.mocked(s.target).mockResolvedValue(target);
  expect((await search(s,1,['ANNOT001'],new Cancellation())).map(m=>m.id)).toEqual([2,1]);
  vi.mocked(s.note).mockImplementation(async id=>id===1?null:{id,title:'Exact',parent:'',library:''});
  expect((await search(s,1,['ANNOT001'],new Cancellation())).map(m=>m.id)).toEqual([2]);
 });
 it('labels possible matches visibly and opens the note normally',async()=>{
  const s=sourceWith([{id:1,html:citation()}]);vi.mocked(s.target).mockResolvedValue(target);const host=makeHost();
  const p=new ResultsPanel(host,s,1,['ANNOT001'],vi.fn(),vi.fn());
  try {await vi.waitFor(()=>expect(p.root.textContent).toContain('Possible match'));
   (p.root.querySelector('article button') as HTMLButtonElement).click();expect(host.openNote).toHaveBeenCalledWith(1);
  }finally{p.dispose();}
 });
});
