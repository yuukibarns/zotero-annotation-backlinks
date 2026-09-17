import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { matchReferences } from '../src/matcher';
import { annotation, sourceWith, uri } from './helpers';
import type { Target } from '../src/types';
const target:Target = {attachment:{libraryID:1,key:'ATTACH01'},annotationKeys:new Set(['ANNOT001','ANNOT002'])};
const resolver = sourceWith().resolver;
function match(html:string, t=target) {return matchReferences(new DOMParser().parseFromString(html,'text/html'),t,resolver);}
describe('real HTML reference parsing', () => {
 it('loads encoded highlights, images and escaped links from a fixture', () => {
  expect(match(readFileSync('tests/fixtures/embedded.html','utf8'))).toEqual(['ANNOT001','ANNOT002']);
 });
 it('deduplicates repeated references', () => expect(match(annotation()+annotation())).toEqual(['ANNOT001']));
 it('matches multi-selection and ignores unrelated annotations', () => expect(match(annotation()+annotation('ANNOT002')+annotation('OTHER001'))).toEqual(['ANNOT001','ANNOT002']));
 it('does not confuse attachments with identical annotation keys', () => expect(match(annotation('ANNOT001',uri.replace('ATTACH01','OTHER001')))).toEqual([]));
 it('does not confuse libraries with identical keys', () => expect(match(annotation(),{...target,attachment:{libraryID:2,key:'ATTACH01'}})).toEqual([]));
 it.each(['%broken','null','[]','42','{"annotationKey":7}','{"annotationKey":"ANNOT001","attachmentURI":2}'])('isolates malformed metadata: %s', raw => {
  const doc = new DOMParser().parseFromString(annotation(),'text/html');
  const bad=doc.createElement('span');bad.setAttribute('data-annotation',raw);doc.body.prepend(bad);
  expect(matchReferences(doc,target,resolver)).toEqual(['ANNOT001']);
 });
 it('supports raw JSON with HTML entities and unicode', () => expect(match(`<span title="中文" data-annotation="{&quot;annotationKey&quot;:&quot;ANNOT001&quot;,&quot;attachmentURI&quot;:&quot;${uri}&quot;}">修改</span>`)).toEqual(['ANNOT001']));
 it.each(['open-pdf','open-epub','open-snapshot'])('supports %s links', route => expect(match(`<a href="zotero://${route}/library/items/ATTACH01?annotation=ANNOT001&amp;page=2">link</a>`)).toEqual(['ANNOT001']));
 it('resolves group links', () => expect(match('<a href="zotero://open-pdf/groups/77/items/ATTACH01?annotation=ANNOT001">x</a>',{...target,attachment:{libraryID:2,key:'ATTACH01'}})).toEqual(['ANNOT001']));
 it('resolves group metadata URIs', () => {
  const doc=new DOMParser().parseFromString(annotation('ANNOT001','groupURI'),'text/html');
  expect(matchReferences(doc,{...target,attachment:{libraryID:2,key:'ATTACH01'}},{...resolver,attachment:()=>({libraryID:2,key:'ATTACH01'})})).toEqual(['ANNOT001']);
 });
 it.each(['zotero://open-pdf/groups/78/items/ATTACH01?annotation=ANNOT001','zotero://open-pdf/groups/77x/items/ATTACH01?annotation=ANNOT001','zotero://open-pdf/library/items/OTHER001?annotation=ANNOT001','zotero://open-pdf/library/items/ATTACH01?page=1','https://open-pdf/library/items/ATTACH01?annotation=ANNOT001','javascript:alert(1)','not a URL'])('rejects unrelated link %s', href => expect(match(`<a href="${href}">x</a>`)).toEqual([]));
 it('never matches plain text or removed metadata', () => expect(match('<p>ANNOT001 Quote</p>')).toEqual([]));
 it('isolates resolver failures', () => {
  const doc=new DOMParser().parseFromString(annotation()+'<a href="zotero://open-pdf/library/items/ATTACH01?annotation=ANNOT001">x</a>','text/html');
  expect(matchReferences(doc,target,{...resolver,attachment:()=>{throw Error('Unknown URI');}})).toEqual(['ANNOT001']);
 });
});
