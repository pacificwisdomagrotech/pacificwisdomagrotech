class UsersPage extends Page {
  render(){
    const rows = this.store.users.filter(u=>u.role!=='admin').map(u=>
      `<tr>
        <td>${u.name}</td><td>${u.email}</td><td>${u.phone||'-'}</td><td>${u.role}</td>
        <td>${u.twoFAEnabled?'<span class="chip">2FA on</span>':'-'}</td>
        <td><button class="btn btn-danger btn-small" onclick="App.pages.users.remove('${u.id}','${u.name}')">${Icons.svg('trash-2',13)} Delete</button></td>
      </tr>`
    ).join('');
    return `<div class="page-head"><p>Add managers and sales staff. Passwords are set at creation and never shown here.</p>
    <button class="btn btn-primary btn-small" onclick="App.pages.users.openModal()">${Icons.svg('user-plus',15)} Add Manager</button></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone (WhatsApp)</th><th>Role</th><th>Security</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">${this.emptyState('users','No managers added yet.')}</td></tr>`}</tbody></table></div>`;
  }
  openModal(){
    Modal.open(`<h3>Add Manager / Sales User</h3>
    <div class="field"><label>Full Name</label><input id="uName"></div>
    <div class="field"><label>Email</label><input id="uEmail" type="email"></div>
    <div class="field"><label>WhatsApp Phone (with country code, e.g. 91XXXXXXXXXX)</label><input id="uPhone"></div>
    <div class="field"><label>Role</label><select id="uRole"><option value="manager">Manager</option><option value="sales">Sales</option></select></div>
    <div class="field"><label>Temporary Password</label><input id="uPass" type="text"></div>
    <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.pages.users.save()">Create Account</button></div>`);
  }
  async save(){
    const name = document.getElementById('uName').value.trim();
    const email = document.getElementById('uEmail').value.trim();
    const phone = document.getElementById('uPhone').value.trim();
    const role = document.getElementById('uRole').value;
    const pass = document.getElementById('uPass').value;
    if(!name || !email || !pass) return;
    try{
      const cred = await this.app.fb.secondaryAuth.createUserWithEmailAndPassword(email, pass);
      await this.db.collection('users').doc(cred.user.uid).set({ name, email, phone, role, twoFAEnabled:false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await this.app.fb.secondaryAuth.signOut();
      await this.app.activity.log('user', `${this.user.name} added ${role} ${name}`);
      Modal.close();
    }catch(e){ alert(e.message); }
  }
  /** Removes their Firestore profile, which is what actually gates access —
   *  the app refuses to complete login without it (see AuthController).
   *  The raw Firebase Auth credential itself can only be fully erased from
   *  Firebase Console → Authentication → Users, since client code can never
   *  delete another person's login credential, only your own. */
  async remove(id, name){
    const ok = confirm(
      `Remove ${name}'s access?\n\n` +
      `This deletes their profile, which blocks them from getting past login.\n\n` +
      `Their past orders and sales stay in your Reports.\n\n` +
      `Note: to fully erase their login credential too, do that once in ` +
      `Firebase Console → Authentication → Users — this button alone won't.`
    );
    if(!ok) return;
    await this.db.collection('users').doc(id).delete();
    await this.app.activity.log('user', `${this.user.name} removed access for ${name}`);
  }
}
