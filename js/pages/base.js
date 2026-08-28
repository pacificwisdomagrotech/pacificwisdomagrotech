/* -------------------------- 6. PAGES -------------------------- */

/** Base class every page screen extends. render() returns the HTML string
 *  for #pages; mount() runs after it's inserted (for chart.js etc). */
class Page {
  constructor(app){ this.app = app; }
  render(){ return ''; }
  mount(){ Icons.refresh(); }
  get store(){ return this.app.store; }
  get user(){ return this.app.currentUser; }
  get db(){ return this.app.fb.db; }
  emptyState(icon, text){
    return `<div class="empty">${Icons.svg(icon,38)}<p>${text}</p></div>`;
  }
}

