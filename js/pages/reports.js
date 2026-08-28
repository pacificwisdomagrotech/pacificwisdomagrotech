class ReportsPage extends Page {
  render(){
    const isAdmin = this.user.role==='admin';
    const mySales = isAdmin ? this.store.sales : this.store.sales.filter(s=>s.managerId===this.user.uid);
    const products = [...new Set(mySales.map(s=>s.product))];
    return `
    <div class="page-head"><p>Export your report product-wise to Excel.</p>
      <button class="btn btn-primary btn-small" onclick="App.pages.reports.exportExcel()">${Icons.svg('download',15)} Export to Excel</button></div>
    <div class="card" style="margin-bottom:16px"><canvas id="reportChart" height="110"></canvas></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Total Qty Sold</th><th>Total Sale Value</th><th>Total Profit</th></tr></thead><tbody>
    ${products.length ? products.map(p=>{
      const rows = mySales.filter(s=>s.product===p);
      const qty = rows.reduce((a,r)=>a+Number(r.qty||0),0);
      const value = rows.reduce((a,r)=>a+Number(r.qty||0)*Number(r.sellRate||0),0);
      const profit = rows.reduce((a,r)=>a+Number(r.profit||0),0);
      return `<tr><td>${p}</td><td>${qty}</td><td>₹${value.toLocaleString('en-IN')}</td><td>₹${profit.toLocaleString('en-IN')}</td></tr>`;
    }).join('') : `<tr><td colspan="4">${this.emptyState('bar-chart-3','No sales to report yet.')}</td></tr>`}
    </tbody></table></div>`;
  }
  mount(){
    super.mount();
    const canvas = document.getElementById('reportChart');
    if(!canvas) return;
    const isAdmin = this.user.role==='admin';
    const mySales = isAdmin ? this.store.sales : this.store.sales.filter(s=>s.managerId===this.user.uid);
    const byMonth = {};
    mySales.forEach(s=>{
      const d = s.createdAt ? new Date(s.createdAt.seconds*1000) : new Date();
      const key = d.toLocaleString('en-IN',{month:'short',year:'2-digit'});
      byMonth[key] = byMonth[key] || {income:0, expense:0};
      byMonth[key].income += Number(s.qty||0)*Number(s.sellRate||0);
      byMonth[key].expense += Number(s.qty||0)*Number(s.adminRate||0);
    });
    const labels = Object.keys(byMonth);
    if(this._chart) this._chart.destroy();
    const styles = getComputedStyle(document.documentElement);
    this._chart = new Chart(canvas, {
      type:'bar',
      data:{ labels, datasets:[
        {label:'Income', data: labels.map(l=>byMonth[l].income), backgroundColor: styles.getPropertyValue('--p').trim() || '#0b6b3a'},
        {label:'Expense (cost)', data: labels.map(l=>byMonth[l].expense), backgroundColor: styles.getPropertyValue('--danger').trim() || '#c23a3a'}
      ]},
      options:{ responsive:true, plugins:{legend:{position:'bottom'}} }
    });
  }
  exportExcel(){
    const isAdmin = this.user.role==='admin';
    const mySales = isAdmin ? this.store.sales : this.store.sales.filter(s=>s.managerId===this.user.uid);
    ExcelReportService.exportSales(mySales);
  }
}

