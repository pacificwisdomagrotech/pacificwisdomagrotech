class ProductsPage extends Page {
  render(){
    const rows = this.store.products.map(p=>{
      const wHist = (p.rateHistory||[]).slice(-2).reverse().map(r=>`${r.date}: ₹${r.rate}`).join(' · ');
      const rHist = (p.retailRateHistory||[]).slice(-2).reverse().map(r=>`${r.date}: ₹${r.rate}`).join(' · ');
      return `<tr>
        <td>${p.name}</td>
        <td>₹${p.currentRate||'-'} /qtl<div class="muted" style="font-size:11px">${wHist||'-'}</div></td>
        <td>₹${p.retailRate||'-'} /qtl<div class="muted" style="font-size:11px">${rHist||'-'}</div></td>
        <td>
          <button class="btn btn-secondary btn-small" onclick="App.pages.products.openRateModal('${p.id}','${p.name}')">Wholesale</button>
          <button class="btn btn-secondary btn-small" onclick="App.pages.products.openRetailRateModal('${p.id}','${p.name}')">Retail</button>
        </td></tr>`;
    }).join('');
    return `
    <div class="page-head"><p>Wholesale rate is what managers pay to draw stock; retail rate is the fixed price they must sell to customers at. Both are tracked date-wise.</p>
      <button class="btn btn-primary btn-small" onclick="App.pages.products.openAddModal()">${Icons.svg('plus',15)} Add Product</button></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Wholesale Rate (→ Manager)</th><th>Retail Rate (→ Customer)</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4">${this.emptyState('wheat','No products yet — add your first one.')}</td></tr>`}</tbody></table></div>`;
  }
  openAddModal(){
    Modal.open(`<h3>Add Product</h3>
      <div class="field"><label>Product Name</label><input id="pName"></div>
      <div class="field"><label>Wholesale Rate — to Manager (₹ per quintal)</label><input id="pRate" type="number"></div>
      <div class="field"><label>Retail Rate — to Customer (₹ per quintal)</label><input id="pRetailRate" type="number"></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.products.save()">Save</button></div>`);
  }
  async save(){
    const name = document.getElementById('pName').value.trim();
    const rate = Number(document.getElementById('pRate').value);
    const retailRate = Number(document.getElementById('pRetailRate').value);
    if(!name || !rate || !retailRate) return;
    const today = new Date().toISOString().slice(0,10);
    await this.db.collection('products').add({
      name, currentRate: rate, rateHistory: [{date:today, rate}],
      retailRate, retailRateHistory: [{date:today, rate:retailRate}]
    });
    Modal.close();
  }
  openRateModal(id, name){
    Modal.open(`<h3>Update Wholesale Rate — ${name}</h3>
      <p class="muted">This is what managers pay when they draw stock from you.</p>
      <div class="field"><label>New Rate (₹ per quintal)</label><input id="newRate" type="number"></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.products.saveRate('${id}')">Update</button></div>`);
  }
  async saveRate(id){
    const rate = Number(document.getElementById('newRate').value);
    if(!rate) return;
    const today = new Date().toISOString().slice(0,10);
    const ref = this.db.collection('products').doc(id);
    const snap = await ref.get();
    const hist = snap.data().rateHistory || [];
    hist.push({date: today, rate});
    await ref.update({ currentRate: rate, rateHistory: hist });
    await this.app.activity.log('rate', `Wholesale rate updated for product to ₹${rate}/qtl`);
    Modal.close();
  }
  openRetailRateModal(id, name){
    Modal.open(`<h3>Update Retail Rate — ${name}</h3>
      <p class="muted">This is the fixed price managers must sell to customers at.</p>
      <div class="field"><label>New Retail Rate (₹ per quintal)</label><input id="newRetailRate" type="number"></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.products.saveRetailRate('${id}')">Update</button></div>`);
  }
  async saveRetailRate(id){
    const rate = Number(document.getElementById('newRetailRate').value);
    if(!rate) return;
    const today = new Date().toISOString().slice(0,10);
    const ref = this.db.collection('products').doc(id);
    const snap = await ref.get();
    const hist = snap.data().retailRateHistory || [];
    hist.push({date: today, rate});
    await ref.update({ retailRate: rate, retailRateHistory: hist });
    await this.app.activity.log('rate', `Retail rate updated for product to ₹${rate}/qtl`);
    Modal.close();
  }
}

