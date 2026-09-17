import type { Host, Match, SearchSource } from './types';
import { SearchCoordinator } from './search';
export const PAGE_SIZE = 50;
export class ResultsPanel {
  readonly root: HTMLElement;
  private coordinator = new SearchCoordinator();
  private disposed = false;
  private detachClose: () => void = () => {};
  private cleanup: (() => void)[] = [];
  private priorFocus: Element | null;
  private matches: Match[] = [];
  private page = 0;
  private filter: HTMLInputElement;
  private status: HTMLElement;
  private list: HTMLElement;
  private pagination: HTMLElement;
  private previous: HTMLButtonElement;
  private next: HTMLButtonElement;
  private refresh: HTMLButtonElement;
  private refreshing = false;
  constructor(private host: Host, private source: SearchSource, private attachmentID: number,
    private keys: string[], private closed: () => void, private report: (e: unknown) => void) {
    this.priorFocus = host.document.activeElement;
    this.root = this.el('section');
    this.root.id = 'annotation-backlinks-results';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Referencing notes');
    this.root.style.cssText = 'position:fixed;top:70px;right:24px;width:min(650px,calc(100vw - 48px));max-height:75vh;overflow:auto;z-index:2147483647;box-sizing:border-box;padding:20px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:10px;box-shadow:0 8px 28px #0004;font:14px system-ui;';
    const title = this.el('h2', 'Referencing notes'); title.style.cssText = 'font-size:20px;margin:0 0 12px';
    this.status = this.el('p', 'Searching saved notes…'); this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.filter = this.el('input') as HTMLInputElement;
    this.filter.type = 'search'; this.filter.placeholder = 'Filter by note, source, or library';
    this.filter.setAttribute('aria-label', 'Filter referencing notes');
    this.filter.style.cssText = 'box-sizing:border-box;width:100%;padding:8px;margin:12px 0';
    this.list = this.el('div'); this.list.id = 'annotation-backlinks-list';
    this.pagination = this.el('span');
    this.previous = this.button('Previous', () => { this.page--; this.render(); });
    this.next = this.button('Next', () => { this.page++; this.render(); });
    this.refresh = this.button('Refresh', () => this.start());
    this.root.append(title, this.button('Close', () => this.dispose()), this.refresh, this.status, this.filter,
      this.list, this.previous, this.pagination, this.next,
      this.el('p', 'Saved notes only. Plain-text copies, unlinked quotations, and external files cannot be traced.'));
    this.listen(this.filter, 'input', () => { this.page = 0; this.render(); });
    this.listen(this.root, 'keydown', event => {
      if ((event as KeyboardEvent).key === 'Escape') { event.stopPropagation(); this.dispose(); }
    });
    host.document.documentElement.append(this.root);
    this.detachClose = host.onClose(() => this.dispose(false));
    host.focus(); this.filter.focus();
    this.start();
  }
  private el(tag: string, text = ''): HTMLElement {
    const node = this.host.document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    node.textContent = text; return node;
  }
  private listen(node: HTMLElement, type: string, listener: (e: Event) => void): void {
    node.addEventListener(type, listener); this.cleanup.push(() => node.removeEventListener(type, listener));
  }
  private button(text: string, action: () => void | Promise<void>): HTMLButtonElement {
    const b = this.el('button', text) as HTMLButtonElement;
    b.type = 'button'; b.style.cssText = 'padding:6px 10px;margin:0 8px 4px 0';
    // Buttons in result pages are discarded with their DOM nodes, not retained in cleanup.
    b.addEventListener('click', () => {
      if (this.disposed) return;
      try { Promise.resolve(action()).catch(e => this.fail(e)); } catch (e) { this.fail(e); }
    }); return b;
  }
  private fail(error: unknown): void {
    if (this.disposed) return;
    this.status.textContent = `Unable to complete action: ${error instanceof Error ? error.message : String(error)}`;
    this.report(error);
  }
  start(): void {
    if (this.disposed) return;
    this.refreshing = true; this.refresh.disabled = true;
    this.status.textContent = 'Searching saved notes…';
    void this.coordinator.run(this.source, this.attachmentID, this.keys,
      p => { this.status.textContent = `Searched ${p.scanned} notes · ${p.matched} matches`; },
      matches => { this.refreshing = false; this.refresh.disabled = false; this.matches = matches; this.page = 0; this.render(); },
      error => { this.refreshing = false; this.refresh.disabled = false; this.fail(error); });
  }
  private render(): void {
    if (this.disposed) return;
    const query = this.filter.value.toLocaleLowerCase();
    const visible = this.matches.filter(m => `${m.title} ${m.parent} ${m.library}`.toLocaleLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    this.page = Math.max(0, Math.min(pages - 1, this.page));
    if (!this.refreshing) this.status.textContent = `${visible.length} of ${this.matches.length} referencing notes · ${this.keys.length} selected annotation(s)`;
    this.previous.disabled = this.page === 0; this.next.disabled = this.page >= pages - 1;
    this.pagination.textContent = ` Page ${this.page + 1} of ${pages} `;
    this.list.replaceChildren();
    if (!visible.length) this.list.append(this.el('p', this.matches.length ? 'No notes match this filter.' : 'No saved notes reference the selected annotation(s).'));
    for (const match of visible.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE)) {
      const card = this.el('article'); card.style.cssText = 'padding:12px 0;border-top:1px solid GrayText';
      const heading = this.el('h3', match.title); heading.style.cssText = 'font-size:15px;margin:0 0 6px;overflow-wrap:anywhere';
      card.append(heading, this.el('p', `${match.library} · ${match.parent}`));
      if (this.keys.length > 1) card.append(this.el('p', `References ${match.annotationKeys.length} selected annotation(s)`));
      card.append(this.button('Show note in library', () => this.host.selectNote(match.id)));
      this.list.append(card);
    }
  }
  dispose(restoreFocus = true): void {
    if (this.disposed) return;
    this.disposed = true; this.coordinator.cancel(); this.detachClose();
    this.cleanup.forEach(fn => fn()); this.cleanup = [];
    this.root.remove(); this.matches = [];
    if (restoreFocus && this.priorFocus?.isConnected && 'focus' in this.priorFocus) (this.priorFocus as HTMLElement).focus();
    this.priorFocus = null; this.closed();
  }
}
