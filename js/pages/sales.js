class SalesPage extends Page {
  static ADMIN_DISPLAY_NAME = "Shri Prafulla ji";
  render(){
    const isAdmin = this.user.role==='admin';
    const list = isAdmin ? this.store.sales : this.store.sales.filter(s=>s.managerId===this.user.uid);
    const myStock = isAdmin ? [] : this.store.managerStock.filter(m=>m.managerId===this.user.uid && m.qty>0);
    const rows = list.map(s=>`
      <tr>
        <td>${s.product}</td><td>${s.qty} qtl</td><td>₹${s.sellRate}</td><td>₹${s.adminRate}</td>
        <td>${s.profit>0?('₹'+s.profit.toLocaleString('en-IN')):'-'}</td>
        <td>${s.profitShare>0?('₹'+s.profitShare.toLocaleString('en-IN')):'-'}</td>
        <td><span class="badge ${s.paymentStatus==='completed'?'b-completed':(s.paymentStatus==='paid_pending_ack'?'b-executed':'b-pending')}">${(s.paymentStatus||'n/a').replace('_',' ')}</span></td>
        <td>
          ${(!isAdmin && s.profitShare>0 && (!s.paymentStatus||s.paymentStatus==='none')) ? `<button class="btn btn-secondary btn-small" onclick="App.pages.sales.markPaid('${s.id}')">I've Paid</button>` : ''}
          ${(isAdmin && s.paymentStatus==='paid_pending_ack') ? `<button class="btn btn-primary btn-small" onclick="App.pages.sales.ack('${s.id}')">Acknowledge</button>` : ''}
        </td>
      </tr>`).join('');
    const stockTable = !isAdmin ? `
    <div class="card" style="margin-bottom:16px">
      <div class="section-title">${Icons.svg('package',18)} My Stock</div>
      ${myStock.length ? `<table><thead><tr><th>Product</th><th>Qty on hand</th></tr></thead><tbody>
        ${myStock.map(m=>`<tr><td>${m.product}</td><td>${m.qty} qtl</td></tr>`).join('')}</tbody></table>`
        : `<p class="muted">No stock yet — order from admin first.</p>`}
    </div>` : '';
    return `
    ${stockTable}
    <div class="page-head"><p>${isAdmin?'Profit-share (20%) is calculated automatically from the gap between wholesale and retail rate.':'Sell at the fixed retail rate — the amount to collect is calculated for you.'}</p>
      ${!isAdmin ? `<button class="btn btn-primary btn-small" onclick="App.pages.sales.openModal()">${Icons.svg('plus',15)} Record Sale</button>` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Retail Rate</th><th>Wholesale Rate</th><th>Profit</th><th>Your 20% Share</th><th>Payment</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8">${this.emptyState('banknote','No sales recorded yet.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    const myStock = this.store.managerStock.filter(m=>m.managerId===this.user.uid && m.qty>0);
    if(!myStock.length){ alert('You have no stock to sell yet — place and get an order approved first.'); return; }
    Modal.open(`<h3>Record Sale</h3>
      <div class="field"><label>Product</label>
        <select id="sProduct" onchange="App.pages.sales.updateAvailable(this)">
          ${myStock.map(m=>{
            const p = this.store.products.find(pr=>pr.name===m.product);
            return `<option value="${m.product}" data-available="${m.qty}" data-retail="${p?p.retailRate:0}" data-wholesale="${p?p.currentRate:0}">${m.product} (${m.qty} qtl available)</option>`;
          }).join('')}
        </select>
      </div>
      <p class="muted" id="sAvailableHint" style="margin:-6px 0 0"></p>
      <div class="field"><label>Quantity Sold (quintal)</label><input id="sQty" type="number"></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.sales.save()">Save Sale</button></div>`);
    this.updateAvailable(document.getElementById('sProduct'));
  }
  updateAvailable(sel){
    const opt = sel.selectedOptions[0];
    document.getElementById('sAvailableHint').textContent =
      `${opt.dataset.available} qtl on hand · retail rate ₹${opt.dataset.retail}/qtl`;
  }
  async save(){
    const sel = document.getElementById('sProduct');
    const opt = sel.selectedOptions[0];
    const product = sel.value;
    const retailRate = Number(opt.dataset.retail);
    const adminRate = Number(opt.dataset.wholesale);
    const qty = Number(document.getElementById('sQty').value);
    if(!qty){ return; }
    try{
      await this.app.stock.deductManagerStock({ managerId: this.user.uid, product, qty });
    }catch(e){
      alert(e.message);
      return;
    }
    const billAmount = qty * retailRate;
    const profit = Math.max(0, (retailRate - adminRate) * qty);
    const profitShare = Math.round(profit * 0.2);
    await this.db.collection('sales').add({
      product, qty, sellRate: retailRate, adminRate, profit, profitShare,
      managerId: this.user.uid, managerName: this.user.name,
      paymentStatus: profitShare>0 ? 'none' : 'completed',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.app.activity.log('sale', `${this.user.name} sold ${product} × ${qty} qtl @ ₹${retailRate}`);
    Modal.close();
    Modal.open(`<h3>${Icons.svg('banknote',18)} Collect Payment</h3>
      <p style="font-size:16px;line-height:1.6">Collect <b>₹${billAmount.toLocaleString('en-IN')}</b> from the customer for <b>${qty} quintal</b> of <b>${product}</b> @ ₹${retailRate}/qtl.</p>
      <button class="btn btn-primary" style="width:100%" onclick="Modal.close()">OK, Got It</button>`);
  }
  async markPaid(id){
    const ref = this.db.collection('sales').doc(id);
    const snap = await ref.get();
    const s = snap.data();
    await ref.update({ paymentStatus: 'paid_pending_ack', paidAt: firebase.firestore.FieldValue.serverTimestamp() });
    const adminUser = this.store.users.find(u=>u.role==='admin') || {};
    const msg = `Namaste,\nMaine ${s.product} (${s.qty} qtl) ke order ke against ₹${s.profitShare.toLocaleString('en-IN')} amount bhej diya hai.\nKripya acknowledge karein.\n— ${this.user.name}`;
    WhatsAppService.open(adminUser.phone, msg);
  }
  async ack(id){
    await this.db.collection('sales').doc(id).update({ paymentStatus: 'completed', ackAt: firebase.firestore.FieldValue.serverTimestamp() });
    await this.app.activity.log('payment', `Payment acknowledged for sale ${id}`);
  }
}

/** One reusable class for both Farmers and Customers — instantiate twice
 *  with different collection names + columns instead of duplicating code. */
