/* -------------------------- 7. ROUTER -------------------------- */
class Router {
  static NAV = [
    {section:'Overview', items:[
      {id:'dashboard', label:'Dashboard', icon:'layout-dashboard', roles:['admin','manager','sales']},
    ]},
    {section:'Work', items:[
      {id:'enquiries', label:'Enquiries', icon:'message-square', roles:['admin','manager','sales']},
      {id:'orders', label:'Orders', icon:'clipboard-list', roles:['admin','manager']},
      {id:'sales', label:'Sales & Profit-Share', icon:'banknote', roles:['admin','manager']},
    ]},
    {section:'Admin', items:[
      {id:'products', label:'Products & Rates', icon:'wheat', roles:['admin']},
      {id:'purchases', label:'Purchases (from Farmers)', icon:'sprout', roles:['admin']},
      {id:'farmers', label:'Farmers', icon:'tractor', roles:['admin']},
      {id:'customers', label:'Customers', icon:'users', roles:['admin']},
      {id:'inventory', label:'Warehouse Stock', icon:'package', roles:['admin']},
      {id:'users', label:'Manage Managers', icon:'user-plus', roles:['admin']},
      {id:'activity', label:'Activity Log', icon:'history', roles:['admin']},
    ]},
    {section:'Account', items:[
      {id:'reports', label:'Reports', icon:'bar-chart-3', roles:['admin','manager','sales']},
      {id:'settings', label:'Settings', icon:'settings', roles:['admin','manager','sales']},
    ]},
  ];
  constructor(app){ this.app = app; this.currentPage = 'dashboard'; }

  buildNav(){
    const nav = document.getElementById('navList');
    try{
      nav.innerHTML = '';
      let itemCount = 0;
      Router.NAV.forEach(group=>{
        const visibleItems = group.items.filter(i=>i.roles.includes(this.app.currentUser.role));
        if(!visibleItems.length) return;
        const sect = document.createElement('div');
        sect.className = 'nav-sect';
        sect.textContent = group.section;
        nav.appendChild(sect);
        const wrap = document.createElement('div');
        wrap.className = 'nav';
        visibleItems.forEach(item=>{
          const b = document.createElement('button');
          b.id = 'nav-'+item.id;
          b.innerHTML = `${Icons.svg(item.icon,17)} ${item.label}`;
          b.onclick = () => this.navigate(item.id);
          wrap.appendChild(b);
          itemCount++;
        });
        nav.appendChild(wrap);
      });
      Icons.refresh();
      if(itemCount === 0){
        nav.innerHTML = '<div style="color:#fff;padding:12px;font-size:12px">DEBUG: 0 nav items matched role "'+this.app.currentUser.role+'"</div>';
      }
    }catch(e){
      nav.innerHTML = '<div style="color:#fff;background:#a00;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">DEBUG buildNav error: '+e.message+'</div>';
    }
  }

  navigate(pageId){
    this.currentPage = pageId;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
    const navBtn = document.getElementById('nav-'+pageId);
    if(navBtn) navBtn.classList.add('active');
    const item = Router.NAV.flatMap(g=>g.items).find(i=>i.id===pageId);
    document.getElementById('pageEyebrow').textContent = Router.NAV.find(g=>g.items.includes(item))?.section || '';
    document.getElementById('pageTitle').textContent = item ? item.label : 'Dashboard';
    this.render();
    this.closeSidebar();
  }

  render(){
    const page = this.app.pages[this.currentPage];
    if(!page) return;
    document.getElementById('pages').innerHTML = `<div class="page active">${page.render()}</div>`;
    page.mount();
  }

  toggleSidebar(){
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('scrim').style.display = document.getElementById('sidebar').classList.contains('open') ? 'block':'none';
  }
  closeSidebar(){
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('scrim').style.display = 'none';
  }
}

