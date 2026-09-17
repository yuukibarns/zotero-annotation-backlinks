import type { Identity, ReferenceResolver, Target } from './types';
function same(a: Identity | null, b: Identity): boolean {
  return !!a && a.libraryID === b.libraryID && a.key === b.key;
}
export function matchReferences(doc: Document, target: Target, resolver: ReferenceResolver): string[] {
  const found = new Set<string>();
  for (const node of doc.querySelectorAll('[data-annotation]')) {
    try {
      const raw = node.getAttribute('data-annotation') || '';
      let ref: { annotationKey?: unknown; attachmentURI?: unknown };
      try { ref = JSON.parse(decodeURIComponent(raw)); }
      catch { ref = JSON.parse(raw); }
      if (!ref || typeof ref.annotationKey !== 'string' || typeof ref.attachmentURI !== 'string') continue;
      if (target.annotationKeys.has(ref.annotationKey) && same(resolver.attachment(ref.attachmentURI), target.attachment)) {
        found.add(ref.annotationKey);
      }
    } catch { /* A broken reference must not hide valid references in the same note. */ }
  }
  for (const node of doc.querySelectorAll('a[href]')) {
    try {
      const url = new URL(node.getAttribute('href') || '');
      if (url.protocol !== 'zotero:' || !['open-pdf', 'open-epub', 'open-snapshot'].includes(url.hostname)) continue;
      const p = url.pathname.split('/').filter(Boolean);
      let identity: Identity | null = null;
      if (p.length === 3 && p[0] === 'library' && p[1] === 'items') identity = {libraryID: resolver.personalLibraryID, key: p[2]};
      else if (p.length === 4 && p[0] === 'groups' && p[2] === 'items' && /^\d+$/.test(p[1])) {
        const libraryID = resolver.groupLibraryID(Number(p[1]));
        if (libraryID !== null) identity = {libraryID, key: p[3]};
      }
      const key = url.searchParams.get('annotation');
      if (key && target.annotationKeys.has(key) && same(identity, target.attachment)) found.add(key);
    } catch { /* Invalid URLs and unavailable groups are unrelated references. */ }
  }
  return [...found];
}
