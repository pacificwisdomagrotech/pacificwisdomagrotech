class EnquiriesPage extends Page {
  render(){
    const isAdmin = this.user.role==='admin';
    const rows = this.store.enquiries.map(e=>`
      <tr>
        <td>${e.customerName}<div class="muted" style="font-size:12px">${e.phone||''}</div></td>
        <td>${e.product}</td><td>${e.qty||'-'}</td>
        <td><span class="badge ${e.status==='closed'?'b-closed':'b-open'}">${e.status||'open'}</span></td>
        <td style="white-space:nowrap">
          ${isAdmin ? `<button class="btn btn-secondary btn-small" onclick="App.pages.enquiries.toggleStatus('${e.id}','${e.status}')">${e.status==='closed'?'Reopen':'Close'}</button>` : ''}
          <button class="btn btn-secondary btn-small" onclick="App.pages.enquiries.openEditModal('${e.id}')">${Icons.svg('pencil',13)}</button>
          <button class="btn btn-danger btn-small" onclick="App.pages.enquiries.remove('${e.id}')">${Icons.svg('trash-2',13)}</button>
        </td>
      </tr>`).join('');
    return `
    <div class="page-head"><p>${isAdmin ? 'Every enquiry across all managers, in one place.' : 'Log a new customer enquiry.'}</p>
      <button class="btn btn-primary btn-small" onclick="App.pages.enquiries.openModal()">${Icons.svg('plus',15)} New Enquiry</button></div>
    <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Product</th><th>Qty</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5">${this.emptyState('inbox','No enquiries yet — add the first one.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    Modal.open(`
      <h3>New Enquiry</h3>
      <div class="field"><label>Customer Name</label><input id="eqName"></div>
      <div class="field"><label>Phone</label><input id="eqPhone"></div>
      <div class="field"><label>Product</label><select id="eqProduct">${this.store.products.map(p=>`<option>${p.name}</option>`).join('')}</select></div>
      <div class="field"><label>Approx Qty (quintal)</label><input id="eqQty" type="number"></div>
      <div class="field"><label>Notes</label><textarea id="eqNotes" rows="2"></textarea></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.enquiries.save()">Save</button></div>`);
  }
  async save(){
    await this.db.collection('enquiries').add({
      customerName: document.getElementById('eqName').value,
      phone: document.getElementById('eqPhone').value,
      product: document.getElementById('eqProduct').value,
      qty: document.getElementById('eqQty').value,
      notes: document.getElementById('eqNotes').value,
      status: 'open', createdBy: this.user.uid, createdByName: this.user.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.app.activity.log('enquiry', `${this.user.name} logged an enquiry`);
    Modal.close();
  }
  async toggleStatus(id, status){
    await this.db.collection('enquiries').doc(id).update({ status: status==='closed' ? 'open' : 'closed' });
  }
  openEditModal(id){
    const e = this.store.enquiries.find(en=>en.id===id);
    if(!e) return;
    Modal.open(`
      <h3>Edit Enquiry</h3>
      <div class="field"><label>Customer Name</label><input id="eqeName" value="${e.customerName||''}"></div>
      <div class="field"><label>Phone</label><input id="eqePhone" value="${e.phone||''}"></div>
      <div class="field"><label>Product</label><select id="eqeProduct">${this.store.products.map(p=>`<option ${p.name===e.product?'selected':''}>${p.name}</option>`).join('')}</select></div>
      <div class="field"><label>Approx Qty (quintal)</label><input id="eqeQty" type="number" value="${e.qty||''}"></div>
      <div class="field"><label>Notes</label><textarea id="eqeNotes" rows="2">${e.notes||''}</textarea></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.enquiries.saveEdit('${id}')">Save Changes</button></div>`);
  }
  async saveEdit(id){
    await this.db.collection('enquiries').doc(id).update({
      customerName: document.getElementById('eqeName').value,
      phone: document.getElementById('eqePhone').value,
      product: document.getElementById('eqeProduct').value,
      qty: document.getElementById('eqeQty').value,
      notes: document.getElementById('eqeNotes').value,
    });
    Modal.close();
  }
  async remove(id){
    if(!confirm('Delete this enquiry?')) return;
    await this.db.collection('enquiries').doc(id).delete();
  }
}
