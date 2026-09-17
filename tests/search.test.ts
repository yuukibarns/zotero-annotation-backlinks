import { describe,it,expect,vi } from 'vitest';
import { search, Cancellation, Cancelled, SearchCoordinator, BATCH_SIZE } from '../src/search';
import { sourceWith, annotation, deferred } from './helpers';
import type { NoteRow } from '../src/types';
describe('batched read-only search', () => {
 it('handles an empty library',async()=>expect(await search(sourceWith(),1,['ANNOT001'],new Cancellation())).toEqual([]));
 it('uses bounded keyset batches and yields on nonmatches',async()=>{
  const source=sourceWith(Array.from({length:205},(_,i)=>({id:i+1,html:'<p>no reference</p>'})));
  const progress=vi.fn();expect(await search(source,1,['ANNOT001'],new Cancellation(),progress)).toEqual([]);
  expect(source.rows).toHaveBeenCalledTimes(3);expect(source.rows).toHaveBeenNthCalledWith(2,100,205,BATCH_SIZE);
  expect(source.yield).toHaveBeenCalledTimes(3);expect(progress).toHaveBeenLastCalledWith({scanned:205,matched:0});
 });
 it('skips notes deleted while searching',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]);vi.mocked(source.note).mockResolvedValue(null);
  expect(await search(source,1,['ANNOT001'],new Cancellation())).toEqual([]);
 });
 it('deduplicates selected keys and sorts results',async()=>{
  const source=sourceWith([{id:1,html:annotation()},{id:2,html:annotation()}]);
  vi.mocked(source.note).mockImplementation(async id=>({id,title:id===1?'Z':'A',parent:'',library:''}));
  expect((await search(source,1,['ANNOT001','ANNOT001'],new Cancellation())).map(m=>m.id)).toEqual([2,1]);
  expect(source.target).toHaveBeenCalledWith(1,['ANNOT001']);
 });
 it('cancels before any database read',async()=>{
  const source=sourceWith();const c=new Cancellation();c.cancel();
  await expect(search(source,1,[],c)).rejects.toBeInstanceOf(Cancelled);expect(source.target).not.toHaveBeenCalled();
 });
 it('cancels between batches without reading the next',async()=>{
  const source=sourceWith(Array.from({length:200},(_,i)=>({id:i+1,html:'x'})));const c=new Cancellation();
  vi.mocked(source.yield).mockImplementation(async()=>c.cancel());
  await expect(search(source,1,['ANNOT001'],c)).rejects.toBeInstanceOf(Cancelled);expect(source.rows).toHaveBeenCalledTimes(1);
 });
 it('cancels an in-flight database response before parsing',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]);const pending=deferred<NoteRow[]>();
  vi.mocked(source.rows).mockReturnValue(pending.promise);const parse=vi.spyOn(source,'parse');const c=new Cancellation();
  const result=search(source,1,['ANNOT001'],c);await vi.waitFor(()=>expect(source.rows).toHaveBeenCalled());
  c.cancel();pending.resolve([{id:1,html:annotation()}]);await expect(result).rejects.toBeInstanceOf(Cancelled);expect(parse).not.toHaveBeenCalled();
 });
 it('surfaces database failures',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]);vi.mocked(source.rows).mockRejectedValue(new Error('DB unavailable'));
  await expect(search(source,1,['ANNOT001'],new Cancellation())).rejects.toThrow('DB unavailable');
 });
 it('surfaces unavailable attachment failures',async()=>{
  const source=sourceWith();vi.mocked(source.target).mockRejectedValue(new Error('Attachment deleted'));
  await expect(search(source,1,['ANNOT001'],new Cancellation())).rejects.toThrow('Attachment deleted');
 });
 it('rejects invalid batches instead of looping forever',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]);vi.mocked(source.rows).mockResolvedValue([{id:0,html:''}]);
  await expect(search(source,1,['ANNOT001'],new Cancellation())).rejects.toThrow('Invalid note batch');
 });
 it('an empty selection avoids note reads',async()=>{
  const source=sourceWith();vi.mocked(source.target).mockResolvedValue({attachment:{libraryID:1,key:'ATTACH01'},annotationKeys:new Set()});
  expect(await search(source,1,[],new Cancellation())).toEqual([]);expect(source.ceiling).not.toHaveBeenCalled();
 });
 it('does not let an old search overwrite a newer search',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]);const pending=deferred<NoteRow[]>();
  vi.mocked(source.rows).mockReturnValueOnce(pending.promise);
  const coordinator=new SearchCoordinator(),old=vi.fn(),fresh=vi.fn(),error=vi.fn();
  const first=coordinator.run(source,1,['ANNOT001'],vi.fn(),old,error);
  await vi.waitFor(()=>expect(source.rows).toHaveBeenCalled());
  await coordinator.run(source,1,['ANNOT001'],vi.fn(),fresh,error);
  pending.resolve([{id:1,html:annotation()}]);await first;
  expect(old).not.toHaveBeenCalled();expect(fresh).toHaveBeenCalledTimes(1);expect(error).not.toHaveBeenCalled();
 });
});
