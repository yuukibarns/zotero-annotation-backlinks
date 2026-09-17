import { afterEach,it,expect,vi } from 'vitest';
import { App } from '../src/app';
import { annotation,makeHost,makePlatform,sourceWith } from './helpers';
import type { ReaderMenu } from '../src/types';
const apps:App[]=[];afterEach(()=>apps.splice(0).forEach(a=>a.stop()));
function setup(){const host=makeHost(),platform=makePlatform(sourceWith([{id:1,html:annotation()}]),host),app=new App(platform);apps.push(app);return {host,platform,app};}
function menu(app:App){let item:Parameters<ReaderMenu['append']>[0]|undefined;app.listener({reader:{itemID:1},params:{ids:['ANNOT001']},append:m=>{item=m;}});return item!;}
it('start/stop are idempotent and re-enabling works',()=>{const {app,platform}=setup();app.start();app.start();expect(platform.register).toHaveBeenCalledTimes(1);app.stop();app.stop();expect(platform.unregister).toHaveBeenCalledTimes(1);app.start();expect(platform.register).toHaveBeenCalledTimes(2);});
it('ignores empty selections',()=>{const {app}=setup();app.start();const append=vi.fn();app.listener({reader:{itemID:1},params:{ids:[]},append});expect(append).not.toHaveBeenCalled();});
it('defers menu work and cancels it on disable',async()=>{const {app,host}=setup();app.start();menu(app).onCommand();app.stop();await new Promise(r=>setTimeout(r,10));expect(document.getElementById('annotation-backlinks-results')).toBeNull();expect(host.listeners.size).toBe(0);});
it('cancels queued callbacks on window closure',async()=>{const {app,host}=setup();app.start();menu(app).onCommand();host.close();await new Promise(r=>setTimeout(r,10));expect(document.getElementById('annotation-backlinks-results')).toBeNull();});
it('handles unavailable windows',()=>{const {app,platform}=setup();platform.host=()=>null;app.start();menu(app).onCommand();expect(platform.report).toHaveBeenCalled();});
it('repeated searches replace the previous panel',async()=>{const {app}=setup();app.start();menu(app).onCommand();await vi.waitFor(()=>expect(document.querySelectorAll('#annotation-backlinks-results')).toHaveLength(1));const old=document.getElementById('annotation-backlinks-results');menu(app).onCommand();await vi.waitFor(()=>expect(old?.isConnected).toBe(false));expect(document.querySelectorAll('#annotation-backlinks-results')).toHaveLength(1);});
it('stale menu callbacks cannot reenable a stopped plugin',()=>{const {app}=setup();app.start();const m=menu(app);app.stop();m.onCommand();expect(document.getElementById('annotation-backlinks-results')).toBeNull();});
