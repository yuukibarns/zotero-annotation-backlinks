import { vi } from 'vitest';
import type { Host, NoteRow, Platform, SearchSource } from '../src/types';
export const uri = 'http://zotero.org/users/123/items/ATTACH01';
export function annotation(key = 'ANNOT001', attachmentURI = uri, tag = 'span'): string {
  return `<${tag} data-annotation="${encodeURIComponent(JSON.stringify({annotationKey:key,attachmentURI}))}">Quote</${tag}>`;
}
export function sourceWith(rows: NoteRow[] = []): SearchSource {
  return {
    target: vi.fn(async () => ({attachment:{libraryID:1,key:'ATTACH01'},annotationKeys:new Set(['ANNOT001'])})),
    ceiling: vi.fn(async () => Math.max(0,...rows.map(r => r.id))),
    rows: vi.fn(async (after, ceiling, limit) => rows.filter(r => r.id > after && r.id <= ceiling).slice(0, limit)),
    note: vi.fn(async id => ({id,title:`Note ${id}`,parent:'Parent',library:'Library'})),
    parse: html => new DOMParser().parseFromString(html,'text/html'),
    resolver:{attachment: u => u === uri ? {libraryID:1,key:'ATTACH01'} : null,personalLibraryID:1,groupLibraryID:id => id === 77 ? 2 : null},
    yield: vi.fn(async () => {})
  };
}
export function makeHost(): Host & {close(): void; listeners: Set<() => void>} {
  const listeners = new Set<() => void>();
  return {document,focus:vi.fn(),openNote:vi.fn(async () => {}),
    createPopup: (content, hidden, shown) => ({show(){document.body.append(content);content.addEventListener('popuphidden', hidden);shown();},destroy(){content.removeEventListener('popuphidden', hidden);content.remove();}}),
    defer: fn => window.setTimeout(fn,0),cancelDeferred:id => window.clearTimeout(id),
    onClose: fn => {listeners.add(fn); return () => {listeners.delete(fn);};},
    listeners,close:() => {for(const fn of [...listeners])fn();}}
}
export function makePlatform(source = sourceWith(), host = makeHost()): Platform {
  return {source,host:() => host,register:vi.fn(),unregister:vi.fn(),report:vi.fn()};
}
export function deferred<T>() {
  let resolve!: (value:T) => void;
  let reject!: (e:unknown) => void;
  const promise = new Promise<T>((a,b) => {resolve=a;reject=b;});
  return {promise,resolve,reject};
}
