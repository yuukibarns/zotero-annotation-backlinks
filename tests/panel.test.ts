import { afterEach,describe,it,expect,vi } from 'vitest';
import { ResultsPanel,PAGE_SIZE } from '../src/panel';
import { makeHost,sourceWith,annotation,deferred } from './helpers';
import type { NoteRow } from '../src/types';
const panels:ResultsPanel[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.dispose());document.body.replaceChildren();});
function setup(count=1) {
 const host=makeHost(),source=sourceWith(Array.from({length:count},(_,i)=>({id:i+1,html:annotation()})));
 const closed=vi.fn(),report=vi.fn();const panel=new ResultsPanel(host,source,1,['ANNOT001'],closed,report);panels.push(panel);
 return {host,source,closed,report,panel};
}
const ready=async(p:ResultsPanel)=>vi.waitFor(()=>expect(p.root.querySelector('[role=status]')?.textContent).toContain('referencing notes'));
const button=(p:ResultsPanel,label:string)=>[...p.root.querySelectorAll('button')].find(b=>b.textContent===label)!;
describe('in-window results',()=>{
 it('renders matches and selects notes',async()=>{const {panel,host}=setup();await ready(panel);button(panel,'Show note in library').click();expect(host.selectNote).toHaveBeenCalledWith(1);});
 it('bounds rendering to one page',async()=>{
  const {panel}=setup(125);await ready(panel);expect(panel.root.querySelectorAll('article')).toHaveLength(PAGE_SIZE);
  button(panel,'Next').click();expect(panel.root.querySelectorAll('article')).toHaveLength(50);
  button(panel,'Next').click();expect(panel.root.querySelectorAll('article')).toHaveLength(25);expect(button(panel,'Next').disabled).toBe(true);
  button(panel,'Previous').click();expect(panel.root.textContent).toContain('Page 2 of 3');
 });
 it('filters and resets pagination',async()=>{
  const {panel}=setup(120);await ready(panel);button(panel,'Next').click();const filter=panel.root.querySelector('input')!;
  filter.value='Note 120';filter.dispatchEvent(new Event('input'));expect(panel.root.querySelectorAll('article')).toHaveLength(1);expect(panel.root.textContent).toContain('Page 1 of 1');
 });
 it('refresh sees added results',async()=>{
  const {panel,source}=setup();await ready(panel);vi.mocked(source.rows).mockResolvedValue([]);button(panel,'Refresh').click();await vi.waitFor(()=>expect(panel.root.textContent).toContain('No saved notes'));
 });
 it('restores focus on Escape and releases close listeners',async()=>{
  const prior=document.createElement('button');document.body.append(prior);prior.focus();const {panel,host,closed}=setup();await ready(panel);
  panel.root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(document.activeElement).toBe(prior);expect(closed).toHaveBeenCalledTimes(1);expect(host.listeners.size).toBe(0);
 });
 it('closing during a query prevents late rendering',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]),pending=deferred<NoteRow[]>();vi.mocked(source.rows).mockReturnValue(pending.promise);
  const host=makeHost(),closed=vi.fn();const p=new ResultsPanel(host,source,1,['ANNOT001'],closed,vi.fn());panels.push(p);
  await vi.waitFor(()=>expect(source.rows).toHaveBeenCalled());p.dispose();pending.resolve([{id:1,html:annotation()}]);await Promise.resolve();
  expect(p.root.isConnected).toBe(false);expect(source.note).not.toHaveBeenCalled();expect(closed).toHaveBeenCalledTimes(1);
 });
 it('window closure disposes the panel',()=>{const {panel,host}=setup();host.close();expect(panel.root.isConnected).toBe(false);expect(host.listeners.size).toBe(0);});
 it('displays database errors and allows retry',async()=>{
  const {panel,source,report}=setup();await ready(panel);vi.mocked(source.rows).mockRejectedValue(new Error('Database busy'));button(panel,'Refresh').click();
  await vi.waitFor(()=>expect(panel.root.textContent).toContain('Database busy'));expect(report).toHaveBeenCalled();expect(button(panel,'Refresh').disabled).toBe(false);
 });
 it('handles note deletion on navigation',async()=>{
  const {panel,host}=setup();await ready(panel);vi.mocked(host.selectNote).mockRejectedValue(new Error('Note deleted'));button(panel,'Show note in library').click();
  await vi.waitFor(()=>expect(panel.root.textContent).toContain('Note deleted'));
 });
 it('renders malicious titles as text, never HTML',async()=>{
  const source=sourceWith([{id:1,html:annotation()}]);vi.mocked(source.note).mockResolvedValue({id:1,title:'<img src=x onerror=alert(1)>',parent:'<script>bad()</script>',library:'<b>x</b>'});
  const p=new ResultsPanel(makeHost(),source,1,['ANNOT001'],vi.fn(),vi.fn());panels.push(p);await ready(p);
  expect(p.root.querySelector('article img, article script, article b')).toBeNull();expect(p.root.textContent).toContain('<img');
 });
});
