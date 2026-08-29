class DashboardPage extends Page {
  render(){
    const isAdmin = this.user.role==='admin';
    const myOrders = isAdmin ? this.store.orders : this.store.orders.filter(o=>o.managerId===this.user.uid);
    const pendingOrders = myOrders.filter(o=>o.status==='placed').length;
    const openEnq = this.store.enquiries.filter(e=>e.status!=='closed').length;
    const pendingPay = this.store.sales.filter(s=>s.paymentStatus==='paid_pending_ack').length;
    const recent = this.store.enquiries.slice(0,6);
    const stockPage = isAdmin ? 'inventory' : 'sales';
    const stockCard = isAdmin
      ? this._stat('package', this.store.inventory.reduce((a,i)=>a+Number(i.qty||0),0), 'Warehouse Stock (qtl)', stockPage)
      : this._stat('package', this.store.managerStock.filter(m=>m.managerId===this.user.uid).reduce((a,m)=>a+Number(m.qty||0),0), 'My Stock (qtl)', stockPage);
    return `
    <div class="grid cards">
      ${this._stat('message-square', openEnq, 'Open Enquiries', 'enquiries')}
      ${this._stat('clipboard-list', pendingOrders, isAdmin?'Pending Orders':'My Pending Orders', 'orders')}
      ${stockCard}
      ${this._stat('banknote', pendingPay, 'Payments Awaiting Ack', 'sales')}
    </div>
    <div style="margin-top:20px" class="table-wrap">
      <table><thead><tr><th>Recent Enquiry</th><th>Product</th><th>Status</th></tr></thead>
      <tbody>${recent.length ? recent.map(e=>`<tr style="cursor:pointer" onclick="App.router.navigate('enquiries')"><td>${e.customerName}</td><td>${e.product}</td><td><span class="badge ${e.status==='closed'?'b-closed':'b-open'}">${e.status||'open'}</span></td></tr>`).join('')
        : `<tr><td colspan="3">${this.emptyState('inbox','No enquiries logged yet.')}</td></tr>`}</tbody></table>
    </div>`;
  }
  _stat(icon, num, label, targetPage){
    const clickable = targetPage ? `onclick="App.router.navigate('${targetPage}')" style="cursor:pointer"` : '';
    return `<div class="stat-card" ${clickable}><div class="stat-top"><div class="stat-icon">${Icons.svg(icon,19)}</div>${targetPage?Icons.svg('chevron-right',16):''}</div><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`;
  }
}
