import { execFileSync } from 'node:child_process';
import { describe,it,expect,vi } from 'vitest';
import { BATCH_SQL,LIVE_NOTES,createPlatform,type ZoteroAPI,type ZoteroItem } from '../src/adapter';
function item(id=1):ZoteroItem {return {id,key:'ATTACH01',libraryID:1,parentID:false,deleted:false,isAttachment:()=>true,isNote:()=>true,isAnnotation:()=>false,getField:()=>'',getNoteTitle:()=>''};}
function api():ZoteroAPI {return {
 Reader:{registerEventListener:vi.fn(),unregisterEventListener:vi.fn()},
 DB:{queryAsync:vi.fn(async()=>[])},Items:{exists:()=>true,getAsync:vi.fn(async()=>item())},
 URI:{getURIItemLibraryKey:()=>false},Libraries:{userLibraryID:1,get:()=>({name:'Library'})},Groups:{getLibraryIDFromGroupID:()=>false},
 Promise:{delay:async()=>{}},getMainWindow:()=>null,logError:vi.fn()
};}
describe('Zotero adapter',()=>{
 it('SQL excludes trashed notes and parents and observes keyset limits in real SQLite',()=>{
  const script=`import sqlite3,json,sys
c=sqlite3.connect(':memory:')
c.row_factory=sqlite3.Row
c.executescript('CREATE TABLE itemNotes(itemID INTEGER PRIMARY KEY,parentItemID INTEGER,note TEXT); CREATE TABLE deletedItems(itemID INTEGER);')
c.executemany('INSERT INTO itemNotes VALUES(?,?,?)',[(1,None,'data-annotation'),(2,None,'data-annotation'),(3,99,'zotero:'),(4,None,'plain text'),(5,None,'zotero:'),(6,None,'data-annotation')])
c.executemany('INSERT INTO deletedItems VALUES(?)',[(2,),(99,)])
q=json.loads(sys.argv[1]);print(json.dumps([dict(r) for r in c.execute(q,[0,5,'%data-annotation%','%zotero:%',100])]))`;
  const results=JSON.parse(execFileSync('python3',['-c',script,JSON.stringify(BATCH_SQL)],{encoding:'utf8'}));
  expect(results.map((r:{id:number})=>r.id)).toEqual([1,5]);
 });
 it('uses bound query parameters',async()=>{const z=api();await createPlatform(z,'id').source.rows(5,99,100);expect(z.DB.queryAsync).toHaveBeenCalledWith(BATCH_SQL,[5,99,'%data-annotation%','%zotero:%',100]);});
 it('handles an empty database ceiling',async()=>{expect(await createPlatform(api(),'id').source.ceiling()).toBe(0);});
 it('rejects missing and trashed attachments',async()=>{const z=api();z.Items.exists=()=>false;await expect(createPlatform(z,'id').source.target(1,[])).rejects.toThrow('no longer');z.Items.exists=()=>true;vi.mocked(z.Items.getAsync).mockResolvedValue({...item(),deleted:true});await expect(createPlatform(z,'id').source.target(1,[])).rejects.toThrow('no longer');});
 it('rejects attachments under trashed parent items',async()=>{const z=api();vi.mocked(z.Items.getAsync).mockResolvedValueOnce({...item(),parentID:2}).mockResolvedValueOnce({...item(2),deleted:true});await expect(createPlatform(z,'id').source.target(1,[])).rejects.toThrow('trash');});
 it('returns null for a note deleted since the batch query',async()=>{const z=api();expect(await createPlatform(z,'id').source.note(1)).toBeNull();expect(z.Items.getAsync).not.toHaveBeenCalled();expect(z.DB.queryAsync).toHaveBeenCalledWith(`SELECT n.itemID AS id ${LIVE_NOTES} AND n.itemID=?`,[1]);});
 it('handles an unavailable main window',()=>{const p=createPlatform(api(),'id');expect(p.host()).toBeNull();expect(()=>p.source.parse('<p>x</p>')).toThrow('closed');});
 it('registers and removes the same reader listener',()=>{const z=api(),p=createPlatform(z,'id'),fn=vi.fn();p.register(fn);p.unregister(fn);expect(z.Reader.registerEventListener).toHaveBeenCalledWith('createAnnotationContextMenu',fn,'id');expect(z.Reader.unregisterEventListener).toHaveBeenCalledWith('createAnnotationContextMenu',fn);});
});
