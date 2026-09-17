import type { Host, Identity, NoteInfo, NoteRow, Platform, ReaderMenu, SearchSource } from './types';
export interface ZoteroItem {
 id: number; key: string; libraryID: number; parentID: number | false; deleted: boolean;
 isAttachment(): boolean; isNote(): boolean; isAnnotation(): boolean;
 getField(field: string): string; getNoteTitle(): string;
}
export interface ZoteroWindow extends Window {
 DOMParser: typeof DOMParser;
 ZoteroPane: { selectItem(id: number): Promise<unknown> };
}
export interface ZoteroAPI {
 Reader: {registerEventListener(type: string, fn: (e: ReaderMenu) => void, id: string): void;
 unregisterEventListener(type: string, fn: (e: ReaderMenu) => void): void};
 DB: {queryAsync<T>(sql: string, params?: (number | string)[]): Promise<T[]>};
 Items: { getAsync(id: number): Promise<ZoteroItem | false>; exists(id: number): boolean };
 URI: {getURIItemLibraryKey(uri: string): Identity | false};
 Libraries: {userLibraryID: number; get(id: number): {name: string} | false};
 Groups: {getLibraryIDFromGroupID(id: number): number | false};
 Promise: {delay(ms: number): Promise<void>};
 getMainWindow(): ZoteroWindow | null;
 logError(e: unknown): void;
}
export const LIVE_NOTES = `FROM itemNotes n
 WHERE NOT EXISTS (SELECT 1 FROM deletedItems d WHERE d.itemID=n.itemID)
 AND NOT EXISTS (SELECT 1 FROM deletedItems d WHERE d.itemID=n.parentItemID)`;
export const BATCH_SQL = `SELECT n.itemID AS id, n.note AS html ${LIVE_NOTES}
 AND n.itemID > ? AND n.itemID <= ? AND (n.note LIKE ? OR n.note LIKE ?)
 ORDER BY n.itemID LIMIT ?`;
export function createPlatform(z: ZoteroAPI, pluginID: string): Platform {
  const liveNote = async (id: number): Promise<boolean> => (await z.DB.queryAsync<{id: number}>(
    `SELECT n.itemID AS id ${LIVE_NOTES} AND n.itemID=?`, [id])).length > 0;
  const source: SearchSource = {
    async target(id, keys) {
      if (!z.Items.exists(id)) throw new Error('The source attachment is no longer available.');
      const item = await z.Items.getAsync(id);
      if (!item || item.deleted || !item.isAttachment()) throw new Error('The source attachment is no longer available.');
      if (item.parentID) {
        const parent = await z.Items.getAsync(item.parentID);
        if (!parent || parent.deleted) throw new Error('The source item is in the trash.');
      }
      return {attachment: {libraryID: item.libraryID, key: item.key}, annotationKeys: new Set(keys)};
    },
    async ceiling() {
      const rows = await z.DB.queryAsync<{ceiling: number | null}>('SELECT MAX(itemID) AS ceiling FROM itemNotes');
      return rows[0]?.ceiling || 0;
    },
    rows(after, ceiling, limit) { return z.DB.queryAsync<NoteRow>(BATCH_SQL, [after, ceiling, '%data-annotation%', '%zotero:%', limit]); },
    async note(id): Promise<NoteInfo | null> {
      if (!await liveNote(id) || !z.Items.exists(id)) return null;
      const note = await z.Items.getAsync(id);
      if (!note || note.deleted || !note.isNote()) return null;
      const parent = note.parentID ? await z.Items.getAsync(note.parentID) : false;
      if (parent && parent.deleted) return null;
      const library = z.Libraries.get(note.libraryID);
      return {id, title: note.getNoteTitle() || 'Untitled note',
        parent: parent ? parent.getField('title') : 'Standalone note', library: library ? library.name : 'Unavailable library'};
    },
    parse(html) {
      const win = z.getMainWindow();
      if (!win || win.closed) throw new Error('The Zotero window was closed.');
      return new win.DOMParser().parseFromString(html, 'text/html');
    },
    resolver: {
      attachment: uri => z.URI.getURIItemLibraryKey(uri) || null,
      get personalLibraryID() { return z.Libraries.userLibraryID; },
      groupLibraryID: id => z.Groups.getLibraryIDFromGroupID(id) || null
    },
    yield: () => z.Promise.delay(0)
  };
  return {
    source,
    host(): Host | null {
      const win = z.getMainWindow();
      if (!win || win.closed) return null;
      return {document: win.document, focus: () => win.focus(),
        async selectNote(id) {
          if (win.closed) throw new Error('The Zotero window was closed.');
          if (!await liveNote(id)) throw new Error('This note was deleted or moved to the trash. Refresh the results.');
          await win.ZoteroPane.selectItem(id); win.focus();
        },
        defer: fn => win.setTimeout(fn, 0), cancelDeferred: id => win.clearTimeout(id),
        onClose(fn) { win.addEventListener('unload', fn); return () => win.removeEventListener('unload', fn); }
      };
    },
    register: fn => z.Reader.registerEventListener('createAnnotationContextMenu', fn, pluginID),
    unregister: fn => z.Reader.unregisterEventListener('createAnnotationContextMenu', fn),
    report: error => z.logError(error)
  };
}
