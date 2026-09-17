// Injected ONLY into a temporary test XPI. Never packaged in the release.
var testConfig = __TEST_CONFIG__;
var realStartup = startup;
startup = function(data, reason) {
  realStartup(data, reason);
  setTimeout(async () => {
    const checks = [];
    const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
    const wait = async (fn, label) => {
      for (let i=0;i<200;i++) { const value=fn(); if(value)return value; await Zotero.Promise.delay(50); }
      throw new Error('Timed out: '+label);
    };
    try {
      if (PathUtils.normalize(Zotero.DataDirectory.dir)!==PathUtils.normalize(testConfig.data)
        || !PathUtils.filename(testConfig.root).startsWith('annotation-backlinks-test-')
        || await IOUtils.readUTF8(PathUtils.join(testConfig.root,'test-marker'))!==testConfig.nonce) throw new Error('Unsafe test profile');
      await Zotero.uiReadyPromise;
      await Zotero.Libraries.get(Zotero.Libraries.userLibraryID).waitForDataLoad('item');
      const parent=new Zotero.Item('journalArticle');parent.setField('title','Synthetic source');await parent.saveTx();
      const attachment=await Zotero.Attachments.importFromFile({file:PathUtils.join(testConfig.root,'fixture.pdf'),parentItemID:parent.id});
      const annotation=new Zotero.Item('annotation');annotation.libraryID=attachment.libraryID;annotation.parentID=attachment.id;
      annotation.annotationType='highlight';annotation.annotationText='Synthetic annotation test document';
      annotation.annotationColor='#ffd400';annotation.annotationPageLabel='1';annotation.annotationSortIndex='00000|000000|00000';
      annotation.annotationPosition=JSON.stringify({pageIndex:0,rects:[[50,700,260,720]]});await annotation.saveTx();
      const meta=encodeURIComponent(JSON.stringify({annotationKey:annotation.key,attachmentURI:Zotero.URI.getItemURI(attachment)}));
      async function note(html, parentID) {const n=new Zotero.Item('note');if(parentID)n.parentID=parentID;n.setNote(html);await n.saveTx();return n;}
      const expected=await note(`<p>Matching note</p><span data-annotation="${meta}">Changed quote</span>`,parent.id);
      await note(`<p><a href="zotero://open-pdf/library/items/${attachment.key}?page=1&amp;annotation=${annotation.key}">Explicit link</a></p>`);
      await note(`<p>${annotation.key} plain text only</p>`);
      const deleted=await note(`<span data-annotation="${meta}">Deleted note</span>`);deleted.deleted=true;await deleted.saveTx();
      const deletedParent=new Zotero.Item('journalArticle');deletedParent.setField('title','Trashed parent');await deletedParent.saveTx();
      await note(`<span data-annotation="${meta}">Child of trashed parent</span>`,deletedParent.id);deletedParent.deleted=true;await deletedParent.saveTx();
      const win=Zotero.getMainWindow();
      const reader=await Zotero.Reader.open(attachment.id);
      await reader._initPromise;
      await Zotero.Promise.delay(1000);
      reader._onToggleSidebarCallback(true);
      reader.toggleSidebar(true);
      const iframe=reader._iframeWindow;
      const preview=await wait(()=>iframe.document.querySelector(`[data-sidebar-annotation-id="${annotation.key}"] .preview`),'annotation sidebar');
      async function invoke() {
        // Exercise React's actual contextmenu handler and Zotero's cross-compartment
        // customEvent bridge, then click the real HTML reader-menu button.
        preview.dispatchEvent(new iframe.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:80,clientY:160}));
        const item=await wait(()=>[...iframe.document.querySelectorAll('.context-menu button')].find(b=>b.textContent==='Find Referencing Notes'),'reader annotation menu');
        item.click();
        return wait(()=>{
          const p=win.document.getElementById('annotation-backlinks-results');
          return p && p.querySelectorAll('article').length===2 ? p : null;
        },'matching results');
      }
      let panel=await invoke();
      assert(panel.querySelectorAll('article').length===2,'real reader menu; embedded/link matches; plain text and trash exclusions');
      const filter=panel.querySelector('input');filter.value='Matching note';filter.dispatchEvent(new win.Event('input'));
      assert(panel.querySelectorAll('article').length===1,'filtering');
      panel.querySelector('article button').click();
      await wait(()=>win.ZoteroPane.getSelectedItems().some(i=>i.id===expected.id),'note selection');
      assert(true,'select matched note in library');
      panel.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      assert(!panel.isConnected,'keyboard close');
      await Zotero.Reader.open(attachment.id);
      panel=await invoke();
      assert(panel.isConnected,'reopen results');
      shutdown();shutdown();
      assert(!win.document.getElementById('annotation-backlinks-results'),'idempotent shutdown removes panel');
      realStartup(data,reason);realStartup(data,reason);
      const listeners=Zotero.Reader._registeredListeners.filter(l=>l.pluginID===data.id && l.type==='createAnnotationContextMenu');
      assert(listeners.length===1,'repeated startup registers one listener');
      panel=await invoke();
      assert(panel.querySelectorAll('article').length===2,'menu works after disable and reenable');
      shutdown();
      await IOUtils.writeUTF8(PathUtils.join(testConfig.root,'result.json'),JSON.stringify({nonce:testConfig.nonce,passed:true,zoteroVersion:Zotero.version,desktop:testConfig.desktop,checks}));
    } catch(e) {
      await IOUtils.writeUTF8(PathUtils.join(testConfig.root,'result.json'),JSON.stringify({nonce:testConfig.nonce,passed:false,error:String(e),stack:e.stack,checks}));
    } finally {
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
    }
  },0);
};
