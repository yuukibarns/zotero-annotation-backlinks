import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(await readFile('package.json','utf8'));
const version = pkg.version.replace('-beta.', 'b'); // Mozilla-compatible ordering: 0.2.0b1 < 0.2.0
const base = 'https://github.com/yuukibarns/zotero-annotation-backlinks';
const manifest = {
 manifest_version:2,name:'Annotation Backlinks',version,
 description:'Find saved Zotero notes that reference selected annotations.',author:'yuukibarns',
 homepage_url:base,
 applications:{zotero:{id:'annotation-backlinks@local',strict_min_version:'10.0',strict_max_version:'10.0.*',
 update_url:'https://raw.githubusercontent.com/yuukibarns/zotero-annotation-backlinks/main/updates.json'}}
};
await mkdir('dist/package',{recursive:true});
await writeFile('dist/package/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await build({entryPoints:['src/bootstrap.ts'],outfile:'dist/package/bootstrap.js',bundle:true,format:'iife',globalName:'AnnotationBacklinks',target:'firefox140',legalComments:'none',
 footer:{js:'var startup = AnnotationBacklinks.startup; var shutdown = AnnotationBacklinks.shutdown; var install = AnnotationBacklinks.install; var uninstall = AnnotationBacklinks.uninstall;'}});
const filename = `annotation-backlinks-${pkg.version}.xpi`;
execFileSync('python3',['scripts/package.py',filename]);
const hash = createHash('sha256').update(await readFile(`dist/${filename}`)).digest('hex');
await writeFile(`dist/${filename}.sha256`,`${hash}  ${filename}\n`);
const updates={addons:{'annotation-backlinks@local':{updates:[{version,update_link:`${base}/releases/download/v${pkg.version}/${filename}`,update_hash:`sha256:${hash}`,applications:{zotero:{strict_min_version:'10.0',strict_max_version:'10.0.*'}}}]}}};
await writeFile('dist/updates.json',JSON.stringify(updates,null,2)+'\n');
console.log(`Built ${filename} (Zotero version ${version})`);
