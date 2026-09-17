"""Deterministic, allowlisted package: fixtures and test code cannot enter the XPI."""
import json, sys, zipfile
from pathlib import Path
root = Path(__file__).resolve().parent.parent
out = root / 'dist' / sys.argv[1]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ('manifest.json', 'bootstrap.js'):
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, (root / 'dist/package' / name).read_bytes())
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert sorted(z.namelist()) == ['bootstrap.js', 'manifest.json']
    bootstrap = z.read('bootstrap.js')
    assert b'openDialog' not in bootstrap and b'nsIAppStartup' not in bootstrap
    assert b'/tmp/' not in bootstrap and b'pluginStartup' not in bootstrap
    assert json.loads(z.read('manifest.json'))['applications']['zotero']['id'] == 'annotation-backlinks@local'
