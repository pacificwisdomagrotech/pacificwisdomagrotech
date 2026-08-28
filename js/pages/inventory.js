class InventoryPage extends Page {
  render(){
    const rows = this.store.inventory.map(i=>`<tr><td>${i.product}</td><td>${i.qty}</td><td>${i.unit||'quintal'}</td><td><button class="btn btn-danger btn-small" onclick="App.pages.inventory.remove('${i.id}')">Delete</button></td></tr>`).join('');
    return `<div class="page-head"><p>Your central warehouse stock — increases automatically when you record a farmer purchase, decreases when you approve a manager's order.</p><button class="btn btn-primary btn-small" onclick="App.pages.inventory.openModal()">${Icons.svg('plus',15)} Manual Adjustment</button></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4">${this.emptyState('package','No stock recorded — record a farmer purchase to get started.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    Modal.open(`<h3>Manual Stock Adjustment</h3><p class="muted">For corrections only — normal stock flows through Purchases and Order approvals.</p>
    <div class="field"><label>Product</label><select id="invProduct">${this.store.products.map(p=>`<option>${p.name}</option>`).join('')}</select></div>
    <div class="field"><label>Quantity to add (use a negative number to subtract)</label><input id="invQty" type="number"></div>
    <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.inventory.save()">Save</button></div>`);
  }
  async save(){
    const product = document.getElementById('invProduct').value;
    const qty = Number(document.getElementById('invQty').value);
    if(!qty) return;
    const snap = await this.db.collection('inventory').where('product','==',product).limit(1).get();
    if(snap.empty){
      await this.db.collection('inventory').add({ product, qty, unit:'quintal' });
    } else {
      const doc = snap.docs[0];
      await doc.ref.update({ qty: (doc.data().qty||0) + qty });
    }
    Modal.close();
  }
  async remove(id){ if(confirm('Delete this record?')) await this.db.collection('inventory').doc(id).delete(); }
}

