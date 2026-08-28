class CrmPage extends Page {
  constructor(app, collection, columns, icon){
    super(app);
    this.collection = collection;
    this.columns = columns;
    this.icon = icon;
  }
  render(){
    const rows = this.store[this.collection].map(r=>
      `<tr>${this.columns.map(c=>`<td>${r[c.toLowerCase()]||'-'}</td>`).join('')}<td><button class="btn btn-danger btn-small" onclick="App.pages.${this.collection}.remove('${r.id}')">Delete</button></td></tr>`
    ).join('');
    return `<div class="page-head"><p>Manage ${this.collection}.</p>
      <button class="btn btn-primary btn-small" onclick="App.pages.${this.collection}.openModal()">${Icons.svg('plus',15)} Add</button></div>
    <div class="table-wrap"><table><thead><tr>${this.columns.map(c=>`<th>${c}</th>`).join('')}<th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${this.columns.length+1}">${this.emptyState(this.icon,'No records yet.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    Modal.open(`<h3>Add Record</h3>${this.columns.map(c=>`<div class="field"><label>${c}</label><input id="crm_${c}"></div>`).join('')}
    <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.${this.collection}.save()">Save</button></div>`);
  }
  async save(){
    const data = {};
    this.columns.forEach(c => data[c.toLowerCase()] = document.getElementById('crm_'+c).value);
    await this.db.collection(this.collection).add(data);
    Modal.close();
  }
  async remove(id){ if(confirm('Delete this record?')) await this.db.collection(this.collection).doc(id).delete(); }
}

