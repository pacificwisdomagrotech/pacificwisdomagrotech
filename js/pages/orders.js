class OrdersPage extends Page {
  render(){
    const isAdmin = this.user.role==='admin';
    const list = isAdmin ? this.store.orders : this.store.orders.filter(o=>o.managerId===this.user.uid);
    const rows = list.map(o=>`
      <tr>
        <td>${o.product}</td><td>${o.qty} qtl</td><td>₹${o.adminRate}/qtl</td><td>₹${(o.qty*o.adminRate).toLocaleString('en-IN')}</td>
        <td>${o.managerName}</td>
        <td><span class="badge ${o.status==='executed'?'b-completed':(o.status==='rejected'?'b-closed':'b-pending')}">${o.status==='executed'?'approved':o.status}</span></td>
        <td>
          ${isAdmin && o.status==='placed' ? `<button class="btn btn-primary btn-small" onclick="App.pages.orders.approve('${o.id}')">Approve</button> <button class="btn btn-danger btn-small" onclick="App.pages.orders.reject('${o.id}')">Reject</button>` : ''}
          ${o.status==='executed' && o.pdfDataUrl ? `<button class="btn btn-secondary btn-small" onclick="App.pages.orders.downloadPdf('${o.id}')">${Icons.svg('download',13)} PDF</button>` : ''}
        </td>
      </tr>`).join('');
    return `
    <div class="page-head"><p>${isAdmin?'Approve orders to transfer stock and issue a PDF summary to the manager.':'Order stock from the admin warehouse.'}</p>
      ${!isAdmin ? `<button class="btn btn-primary btn-small" onclick="App.pages.orders.openModal()">${Icons.svg('plus',15)} New Order</button>` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Manager</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7">${this.emptyState('clipboard-list','No orders yet.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    Modal.open(`<h3>Place Order</h3>
      <div class="field"><label>Product</label><select id="oProduct">${this.store.products.map(p=>`<option value="${p.name}" data-rate="${p.currentRate}">${p.name} (₹${p.currentRate}/qtl)</option>`).join('')}</select></div>
      <div class="field"><label>Quantity (quintal)</label><input id="oQty" type="number"></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.orders.review()">Review Order</button></div>`);
  }
  /** Step 2: show a Yes/Cancel confirmation with the computed amount before
   *  anything is actually written to the database. */
  review(){
    const sel = document.getElementById('oProduct');
    const product = sel.value;
    const adminRate = Number(sel.selectedOptions[0].dataset.rate);
    const qty = Number(document.getElementById('oQty').value);
    if(!qty){ return; }
    const amount = qty * adminRate;
    Modal.open(`<h3>Confirm Order</h3>
      <p style="font-size:15px;line-height:1.6">Buy <b>${qty} quintal</b> of <b>${product}</b> @ <b>₹${adminRate}/qtl</b>?<br>Total cost: <b>₹${amount.toLocaleString('en-IN')}</b></p>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="App.pages.orders.save('${product}',${adminRate},${qty})">Yes, Place Order</button></div>`);
  }
  async save(product, adminRate, qty){
    await this.db.collection('orders').add({
      product, qty, adminRate, status: 'placed',
      managerId: this.user.uid, managerName: this.user.name, managerPhone: this.user.phone||'',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.app.activity.log('order', `${this.user.name} placed order for ${product} × ${qty} qtl`);
    Modal.close();
  }
  /** Shown automatically to admin when a new order comes in, and also
   *  reachable from the Orders table itself. */
  showApprovalPrompt(order){
    Modal.open(`<h3>New Order Received</h3>
      <p style="font-size:15px;line-height:1.6"><b>${order.managerName}</b> has placed an order for <b>${order.qty} quintal</b> of <b>${order.product}</b> @ <b>₹${order.adminRate}/qtl</b> (₹${(order.qty*order.adminRate).toLocaleString('en-IN')} total).</p>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Decide Later</button>
      <button class="btn btn-danger btn-small" onclick="App.pages.orders.reject('${order.id}')">Reject</button>
      <button class="btn btn-primary" onclick="App.pages.orders.approve('${order.id}')">Approve</button></div>`);
  }
  async approve(id){
    const ref = this.db.collection('orders').doc(id);
    const snap = await ref.get();
    const o = { id, ...snap.data() };
    const product = this.store.products.find(p=>p.name===o.product);
    try{
      await this.app.stock.transferToManager({ product: o.product, qty: o.qty, managerId: o.managerId, managerName: o.managerName });
    }catch(e){
      alert(e.message);
      Modal.close();
      return;
    }
    const amount = o.qty * o.adminRate;
    const pdfDataUrl = PdfService.generateOrderSummary(o);
    await ref.update({
      status: 'executed', executedAt: firebase.firestore.FieldValue.serverTimestamp(),
      totalAmount: amount, retailRateAtOrder: product ? product.retailRate : null, pdfDataUrl
    });
    await this.app.activity.log('order', `Order approved: ${o.product} × ${o.qty} qtl → ${o.managerName}`);
    const msg = `Namaste ${o.managerName} ji,\nAapka order — ${o.product} ki matra ${o.qty} quintal @ ₹${o.adminRate} prati quintal — approve kar diya gaya hai.\nKripya Rs. ${amount.toLocaleString('en-IN')} UPI par bhejें.\nDhanyavaad — Pacific Wisdom Agrotech`;
    WhatsAppService.open(o.managerPhone, msg);
    Modal.close();
  }
  async reject(id){
    await this.db.collection('orders').doc(id).update({ status: 'rejected' });
    await this.app.activity.log('order', `Order rejected`);
    Modal.close();
  }
  async downloadPdf(id){
    const snap = await this.db.collection('orders').doc(id).get();
    const o = snap.data();
    PdfService.download(o.pdfDataUrl, `Order-${o.product}-${id.slice(0,6)}.pdf`);
  }
}

