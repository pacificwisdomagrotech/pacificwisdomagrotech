class PurchasesPage extends Page {
  render(){
    const rows = this.store.farmerPurchases.map(p=>`<tr>
      <td>${p.farmerName}${p.phone ? `<div class="muted" style="font-size:12px">${p.phone}</div>` : ''}</td>
      <td>${p.product}</td><td>${p.qty} qtl</td><td>₹${p.rate}/qtl</td><td>₹${p.amount.toLocaleString('en-IN')}</td>
      <td>${p.createdAt ? new Date(p.createdAt.seconds*1000).toLocaleDateString() : '-'}</td>
    </tr>`).join('');
    return `<div class="page-head"><p>Record what you buy from farmers — this adds straight into your warehouse stock.</p>
    <button class="btn btn-primary btn-small" onclick="App.pages.purchases.openModal()">${Icons.svg('plus',15)} Record Purchase</button></div>
    <div class="table-wrap"><table><thead><tr><th>Farmer</th><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Date</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">${this.emptyState('tractor','No purchases recorded yet.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    Modal.open(`<h3>Record Farmer Purchase</h3>
      <div class="field"><label>Farmer</label>
        <select id="pfFarmerSelect" onchange="App.pages.purchases.onFarmerPick(this)">
          <option value="">— Type a new name below —</option>
          ${this.store.farmers.map(f=>`<option value="${f.name}" data-phone="${f.phone||''}">${f.name}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Farmer Name</label><input id="pfName"></div>
      <div class="field"><label>Phone (optional)</label><input id="pfPhone"></div>
      <div class="field"><label>Product</label><select id="pfProduct">${this.store.products.map(p=>`<option>${p.name}</option>`).join('')}</select></div>
      <div class="row">
        <div class="field"><label>Quantity (quintal)</label><input id="pfQty" type="number"></div>
        <div class="field"><label>Rate (₹ per quintal)</label><input id="pfRate" type="number"></div>
      </div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.purchases.save()">Record & Add to Stock</button></div>`);
  }
  onFarmerPick(sel){
    if(!sel.value) return;
    document.getElementById('pfName').value = sel.value;
    document.getElementById('pfPhone').value = sel.selectedOptions[0].dataset.phone || '';
  }
  async save(){
    const farmerName = document.getElementById('pfName').value.trim();
    const phone = document.getElementById('pfPhone').value.trim();
    const product = document.getElementById('pfProduct').value;
    const qty = Number(document.getElementById('pfQty').value);
    const rate = Number(document.getElementById('pfRate').value);
    if(!farmerName || !qty || !rate) return;
    await this.app.stock.recordFarmerPurchase({ farmerName, phone, product, qty, rate, createdBy: this.user.uid });
    await this.app.activity.log('purchase', `${this.user.name} bought ${qty} qtl ${product} from ${farmerName}`);
    Modal.close();
  }
}

