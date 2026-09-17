"""Run the shipped bundle in a disposable Zotero profile, never the user profile."""
import argparse, json, os, signal, subprocess, tempfile, uuid, zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--desktop',action='store_true');p.add_argument('--zotero',default=os.environ.get('ZOTERO_BIN','/usr/lib/zotero/zotero'));p.add_argument('--timeout',type=int,default=150);args=p.parse_args()
repo=Path(__file__).resolve().parent.parent
root=Path(tempfile.mkdtemp(prefix='annotation-backlinks-test-'))
profile=root/'profile';data=root/'data';(profile/'extensions').mkdir(parents=True);data.mkdir()
nonce=uuid.uuid4().hex;(root/'test-marker').write_text(nonce)
config={'root':str(root),'data':str(data),'nonce':nonce,'desktop':args.desktop}
# A minimal valid PDF, created only within the synthetic fixture directory.
objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
stream=b'BT /F1 12 Tf 50 710 Td (Synthetic annotation test document) Tj ET'
objects.append(b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream')
pdf=b'%PDF-1.4\n';offsets=[0]
for i,obj in enumerate(objects,1):
 offsets.append(len(pdf));pdf+=str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
xref=len(pdf);pdf+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{n:010d} 00000 n \n'.encode() for n in offsets[1:]);pdf+=f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode();(root/'fixture.pdf').write_bytes(pdf)
prefs={'extensions.autoDisableScopes':0,'extensions.enabledScopes':15,'extensions.zotero.firstRun':False,'extensions.zotero.useDataDir':True,'extensions.zotero.dataDir':str(data),'extensions.zotero.sync.autoSync':False,'extensions.zotero.automaticScraperUpdates':False,'extensions.zotero.retractions.enabled':False,'extensions.zotero.debug.log':True,'extensions.update.enabled':False,'extensions.zotero.reader.sidebarOpen':True}
(profile/'user.js').write_text(''.join(f'user_pref({json.dumps(k)}, {json.dumps(v)});\n' for k,v in prefs.items()))
harness=(repo/'tests/zotero-runtime.js').read_text().replace('__TEST_CONFIG__',json.dumps(config))
with zipfile.ZipFile(profile/'extensions/annotation-backlinks@local.xpi','w',zipfile.ZIP_DEFLATED) as z:
 z.write(repo/'dist/package/manifest.json','manifest.json')
 z.writestr('bootstrap.js',(repo/'dist/package/bootstrap.js').read_text()+'\n'+harness)
cmd=[args.zotero,'-no-remote','-profile',str(profile),'-ZoteroDebugText']
if not args.desktop:cmd.insert(1,'-headless')
print('Isolated Zotero test:',root,flush=True)
output=repo/'.test-output';output.mkdir(exist_ok=True)
with (root/'zotero.log').open('w') as log:
 proc=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  code=proc.wait(timeout=args.timeout)
 except subprocess.TimeoutExpired:
  code=-1
 finally:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
result_path=root/'result.json'
if not result_path.exists():raise SystemExit(f'No fresh test result (exit {code}); inspect {root}/zotero.log')
result=json.loads(result_path.read_text())
if result.get('nonce')!=nonce:raise SystemExit('Stale or invalid test result')
result.pop('nonce');result['processExitCode']=code
name='zotero-desktop.json' if args.desktop else 'zotero-headless.json'
(output/name).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if not result.get('passed') or code!=0:raise SystemExit(1)
