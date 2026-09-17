import { execFileSync } from 'node:child_process';
import { describe,it,expect,vi } from 'vitest';
import { BATCH_SQL,LIVE_NOTES,createPlatform,type ZoteroAPI,type ZoteroItem,type ZoteroWindow } from '../src/adapter';
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
 it('opens notes without overriding the native preference or refocusing the main window',async()=>{
  const z=api(),openNote=vi.fn(async()=>{}),focus=vi.fn();
  z.getMainWindow=()=>({closed:false,document,ZoteroPane:{openNote},focus}) as unknown as ZoteroWindow;
  vi.mocked(z.DB.queryAsync).mockResolvedValue([{id:7}]);
  await createPlatform(z,'id').host()!.openNote(7);
  expect(openNote).toHaveBeenCalledWith(7);expect(focus).not.toHaveBeenCalled();
 });
 it('rejects opening a deleted note and propagates native opening failures',async()=>{
  const z=api(),openNote=vi.fn(async()=>{throw new Error('Editor failed');});
  z.getMainWindow=()=>({closed:false,document,ZoteroPane:{openNote}}) as unknown as ZoteroWindow;
  const host=createPlatform(z,'id').host()!;
  await expect(host.openNote(7)).rejects.toThrow('deleted');expect(openNote).not.toHaveBeenCalled();
  vi.mocked(z.DB.queryAsync).mockResolvedValue([{id:7}]);await expect(host.openNote(7)).rejects.toThrow('Editor failed');
 });
 it('native popup handles dismissal and removes document listeners on destroy',()=>{
  const z=api(),hide=vi.fn();
  let popup!: Element;
  const doc=document as Document & {createXULElement?: (tag:string)=>Element};
  doc.createXULElement=()=>{
    popup=document.createElement('div');
    return Object.assign(popup,{
      openPopup:()=>popup.dispatchEvent(new Event('popupshown')),
      hidePopup:()=>{hide();popup.dispatchEvent(new Event('popuphidden'));}
    });
  };
  z.getMainWindow=()=>({document:doc,innerWidth:900,closed:false,KeyboardEvent}) as unknown as ZoteroWindow;
  const content=document.createElement('section'),hidden=vi.fn(),shown=vi.fn(),escape=vi.fn();
  content.addEventListener('keydown',escape);
  const native=createPlatform(z,'id').host()!.createPopup(content,hidden,shown);native.show();
  expect(shown).toHaveBeenCalledOnce();
  content.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));expect(hide).not.toHaveBeenCalled();
  document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(escape).toHaveBeenCalledOnce();
  document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));expect(hidden).toHaveBeenCalledOnce();
  native.destroy();expect(popup.isConnected).toBe(false);expect(hidden).toHaveBeenCalledOnce();
  document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));expect(hide).toHaveBeenCalledTimes(2);
  delete doc.createXULElement;
 });
 it('registers and removes the same reader listener',()=>{const z=api(),p=createPlatform(z,'id'),fn=vi.fn();p.register(fn);p.unregister(fn);expect(z.Reader.registerEventListener).toHaveBeenCalledWith('createAnnotationContextMenu',fn,'id');expect(z.Reader.unregisterEventListener).toHaveBeenCalledWith('createAnnotationContextMenu',fn);});
});
