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
      async function invoke(count=2) {
        win.focus(); await Zotero.Promise.delay(300);
        // Exercise React's actual contextmenu handler and Zotero's cross-compartment
        // customEvent bridge, then click the real HTML reader-menu button.
        preview.dispatchEvent(new iframe.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:80,clientY:160}));
        const item=await wait(()=>[...iframe.document.querySelectorAll('.context-menu button')].find(b=>b.textContent==='Find Referencing Notes'),'reader annotation menu');
        item.click();
        return wait(()=>{
          const p=win.document.getElementById('annotation-backlinks-results');
          return p && p.parentElement.state==='open' && p.querySelectorAll('article').length===count ? p : null;
        },'matching results');
      }
      let panel=await invoke();
      assert(panel.querySelectorAll('article').length===2,'real reader menu; embedded/link matches; plain text and trash exclusions');
      const filter=panel.querySelector('input');filter.value='Matching note';filter.dispatchEvent(new win.Event('input'));
      assert(panel.querySelectorAll('article').length===1,'filtering');
      const bounds=panel.getBoundingClientRect();
      assert(bounds.width<=401 && bounds.height<=361 && bounds.width>0,'compact popup bounds');
      assert(panel.parentElement.localName==='panel','native XUL popup container');
      const outer=panel.parentElement.getBoundingClientRect();
      assert(outer.width<=401 && outer.height<=361,'native outer bounds');
      for (const openInWindow of [false,true]) {
        Zotero.Prefs.set('openNoteInNewWindow',openInWindow);
        if(openInWindow) {await Zotero.Reader.open(attachment.id);panel=await invoke();const f=panel.querySelector('input');f.value='Matching note';f.dispatchEvent(new win.Event('input'));}
        panel.querySelector('article button').click();
        const mode=openInWindow?'window':'tab';
        await wait(()=>Zotero.Notes._editorInstances.find(e=>e.itemID===expected.id && e.viewMode===mode),'native note editor '+mode);
        await wait(()=>!panel.isConnected,'dismiss after opening '+mode);
        assert(true,'direct note opening respects '+mode+' preference');
        if(openInWindow) {
          const windows=Services.wm.getEnumerator(null);
          while(windows.hasMoreElements()) {const w=windows.getNext();if(w.name==='zotero-note-'+expected.id)w.close();}
        }
      }
      await Zotero.Reader.open(attachment.id);
      panel=await invoke();
      panel.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      assert(!panel.isConnected,'keyboard close');
      panel=await invoke();
      panel.parentElement.hidePopup();
      await wait(()=>!panel.isConnected,'native popup dismissal');
      assert(true,'native popuphidden cleanup');
      panel=await invoke();
      assert(panel.isConnected,'reopen results');
      shutdown();shutdown();
      assert(!win.document.getElementById('annotation-backlinks-results'),'idempotent shutdown removes panel');
      realStartup(data,reason);realStartup(data,reason);
      const listeners=Zotero.Reader._registeredListeners.filter(l=>l.pluginID===data.id && l.type==='createAnnotationContextMenu');
      assert(listeners.length===1,'repeated startup registers one listener');
      panel=await invoke();
      assert(panel.querySelectorAll('article').length===2,'menu works after disable and reenable');
      panel.parentElement.hidePopup();
      for(let i=0;i<55;i++)await note(`<p>Extra synthetic note ${i}</p><span data-annotation="${meta}">Quote</span>`);
      for(const theme of ['light','dark']) {
        win.browsingContext.prefersColorSchemeOverride=theme;
        await Zotero.Promise.delay(200);
        panel=await invoke(50);
        const list=panel.querySelector('#annotation-backlinks-list');
        assert(list.scrollHeight>list.clientHeight,'scrollable bounded results '+theme);
        assert(panel.parentElement.getBoundingClientRect().height<=361,'height bound '+theme);
        assert(win.matchMedia('(prefers-color-scheme: dark)').matches===(theme==='dark'),'native theme '+theme);
        list.scrollTop=list.scrollHeight;assert(list.scrollTop>0,'scroll navigation '+theme);
        list.scrollTop=0;
        if(testConfig.desktop) {
          await IOUtils.writeUTF8(PathUtils.join(testConfig.root,'visual-phase'),theme);
          await Zotero.Promise.delay(100);
        }
        const next=[...panel.querySelectorAll('button')].find(b=>b.textContent==='Next');next.click();
        assert(panel.querySelectorAll('article').length===7,'second results page '+theme+' (rows='+panel.querySelectorAll('article').length+',connected='+panel.isConnected+')');
        // Exercise an outside document click; native rollup also handles clicks in other windows.
        win.document.documentElement.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true}));
        await wait(()=>!panel.isConnected,'outside click dismissal '+theme);
        assert(true,'outside click dismissal '+theme);
      }
      win.browsingContext.prefersColorSchemeOverride='none';
      const textAnnotation=new Zotero.Item('annotation');textAnnotation.libraryID=attachment.libraryID;textAnnotation.parentID=attachment.id;
      textAnnotation.annotationType='text';textAnnotation.annotationComment='KV cache';textAnnotation.annotationColor='#ffd400';
      textAnnotation.annotationPageLabel='385';textAnnotation.annotationSortIndex='00000|000000|00001';
      textAnnotation.annotationPosition=JSON.stringify({pageIndex:0,rects:[[50,600,150,630]],rotation:0,fontSize:12});await textAnnotation.saveTx();
      const citationNote=await Zotero.EditorInstance.createNoteFromAnnotations([textAnnotation],{parentID:parent.id,noHeader:true});
      assert(!citationNote.getNote().includes('data-annotation='),'native text annotation insertion omits annotation identifier');
      const textPreview=await wait(()=>iframe.document.querySelector(`[data-sidebar-annotation-id="${textAnnotation.key}"] .preview`),'text annotation sidebar');
      win.focus();await Zotero.Promise.delay(300);
      textPreview.dispatchEvent(new iframe.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:80,clientY:160}));
      const textMenu=await wait(()=>[...iframe.document.querySelectorAll('.context-menu button')].find(b=>b.textContent==='Find Referencing Notes'),'text annotation menu');textMenu.click();
      panel=await wait(()=>{const p=win.document.getElementById('annotation-backlinks-results');return p?.textContent.includes('Possible match')?p:null;},'citation fallback');
      assert(panel.querySelectorAll('article').length===1,'native citation-only note found as possible match');
      Zotero.Prefs.set('openNoteInNewWindow',false);panel.querySelector('article button').click();
      await wait(()=>Zotero.Notes._editorInstances.find(e=>e.itemID===citationNote.id && e.viewMode==='tab'),'open citation-only note');
      assert(true,'possible match opens correct note');

      shutdown();
      await IOUtils.writeUTF8(PathUtils.join(testConfig.root,'result.json'),JSON.stringify({nonce:testConfig.nonce,passed:true,zoteroVersion:Zotero.version,desktop:testConfig.desktop,checks}));
    } catch(e) {
      await IOUtils.writeUTF8(PathUtils.join(testConfig.root,'result.json'),JSON.stringify({nonce:testConfig.nonce,passed:false,error:String(e),stack:e.stack,checks}));
    } finally {
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit);
    }
  },0);
};
