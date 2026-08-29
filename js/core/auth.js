/* -------------------------- 6. AUTH CONTROLLER -------------------------- */
class AuthController {
  constructor(app){ this.app = app; this.pendingUser = null; this._restoring = true; }

  /** Called once at startup. Firebase keeps sessions in IndexedDB by default,
   *  so a page refresh does NOT actually log the person out — the app just
   *  never checked for the existing session before. This fixes that. */
  listenForSessionRestore(){
    this.app.fb.auth.onAuthStateChanged(async (user) => {
      if(!this._restoring) return; // ignore events after explicit login/logout already handled them
      this._restoring = false;
      if(!user){ return; } // no session — normal login screen stays visible
      const udoc = await this.app.fb.db.collection('users').doc(user.uid).get();
      if(!udoc.exists) return;
      const userData = { uid: user.uid, ...udoc.data() };
      if(BiometricLock.isEnabled(user.uid)){
        this._showBiometricTab(userData);
      } else {
        await this._completeLogin(user.uid);
      }
    });
  }

  /** Populates the Biometric tab with a "Welcome back" unlock prompt and
   *  switches straight to it, since we already know who this device
   *  belongs to and that they've opted into biometric unlock. */
  _showBiometricTab(userData){
    this._lockedUser = userData;
    document.getElementById('bioTabContent').innerHTML = `
      <div class="brand-mark" style="background:var(--p-soft);color:var(--p);width:56px;height:56px;border-radius:16px;margin:0 auto 16px;font-size:24px">🔒</div>
      <h3 style="margin-bottom:4px">Welcome back, ${userData.name}</h3>
      <p class="muted">Unlock with your fingerprint or face to continue.</p>
      <button class="btn btn-primary" style="width:100%" onclick="App.auth.unlockWithBiometric()">Unlock</button>
      <button class="btn btn-ghost btn-small" style="width:100%;margin-top:10px" onclick="App.auth.logout()">Use password instead</button>
      <div class="err" id="lockErr"></div>`;
    switchLoginTab('biometric');
  }

  async unlockWithBiometric(){
    const errEl = document.getElementById('lockErr');
    errEl.style.display = 'none';
    try{
      await BiometricLock.verify(this._lockedUser.uid);
      await this._completeLogin(this._lockedUser.uid);
    }catch(e){
      this._showErr(errEl, 'Could not verify — try again, or use your password.');
    }
  }

  async login(){
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginErr');
    errEl.style.display = 'none';
    if(!email || !password){ this._showErr(errEl, 'Enter email and password.'); return; }
    try{
      this._restoring = false; // explicit login path — session-restore listener should stand down
      const cred = await this.app.fb.auth.signInWithEmailAndPassword(email, password);
      this.pendingUser = cred.user;
      const udoc = await this.app.fb.db.collection('users').doc(cred.user.uid).get();
      const udata = udoc.data();
      if(udata && udata.twoFAEnabled){
        document.getElementById('loginStep').style.display = 'none';
        document.getElementById('otpStep').style.display = 'block';
      } else {
        await this._completeLogin(cred.user.uid);
      }
    }catch(e){
      this._showErr(errEl, this._friendlyError(e));
    }
  }

  async verifyOtp(){
    const code = document.getElementById('otpInput').value.trim();
    const errEl = document.getElementById('otpErr');
    const udoc = await this.app.fb.db.collection('users').doc(this.pendingUser.uid).get();
    const secret = udoc.data().twoFASecret;
    if(await TOTP.verify(secret, code)){
      await this._completeLogin(this.pendingUser.uid);
    } else {
      this._showErr(errEl, 'Invalid code, try again.');
    }
  }

  async _completeLogin(uid){
    const udoc = await this.app.fb.db.collection('users').doc(uid).get();
    if(!udoc.exists){
      await this.app.fb.auth.signOut();
      alert('Account not set up in Firestore users collection. See SETUP.md.');
      return;
    }
    this.app.currentUser = { uid, ...udoc.data() };
    await this.app.activity.log('login', `${this.app.currentUser.name} logged in`);

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
    document.getElementById('userNameLbl').textContent = this.app.currentUser.name;
    document.getElementById('userRoleLbl').textContent = this._roleLabel(this.app.currentUser.role);
    document.getElementById('avatarInit').textContent = this.app.currentUser.name.charAt(0).toUpperCase();

    this.app.store.attach(this.app.currentUser);
    this.app.store.onChange((pages) => { if(pages.includes(this.app.router.currentPage)) this.app.router.render(); });
    this.app.router.buildNav();
    this.app.router.navigate('dashboard');
  }

  logout(){
    this.app.fb.auth.signOut();
    this.app.currentUser = null;
    this._restoring = false;
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'grid';
    document.getElementById('loginStep').style.display = 'block';
    document.getElementById('otpStep').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    // Reset the Biometric tab back to its default explanatory state and
    // return focus to the Password tab, since there's no session anymore.
    document.getElementById('bioTabContent').innerHTML = `
      <div class="brand-mark" style="background:var(--p-soft);color:var(--p);width:56px;height:56px;border-radius:16px;margin:0 auto 16px;font-size:24px">🔒</div>
      <p class="muted">Sign in with your password first, then enable biometric unlock from Settings for faster access next time.</p>
      <button class="btn btn-secondary btn-small" onclick="switchLoginTab('password')">Go to Password Tab</button>`;
    switchLoginTab('password');
  }

  /** Accounts here don't use real, checkable email inboxes, so an emailed
   *  reset link would never arrive anywhere useful — it would just look
   *  broken. Route the request to the admin on WhatsApp instead, which is
   *  already how this whole app communicates. The admin can then reset
   *  that person's password directly (Firebase Console → Authentication →
   *  find the user → Reset password, or by deleting and recreating the
   *  account from Settings → Manage Managers if needed). */
  openForgotPassword(){
    Modal.open(`
      <h3>Forgot Password</h3>
      <p class="muted">Enter the email on your account — we'll prepare a WhatsApp message to the admin asking them to reset it for you.</p>
      <div class="field"><label>Your Account Email</label><input id="fpEmail" type="email" placeholder="you@company.com"></div>
      <div class="row"><button class="btn btn-ghost" onclick="Modal.close()">Cancel</button><button class="btn btn-primary" onclick="App.auth.requestPasswordHelp()">${Icons.svg('message-square',15)} Message Admin</button></div>
      <div class="err" id="fpErr"></div>`);
  }
  requestPasswordHelp(){
    const email = document.getElementById('fpEmail').value.trim();
    const errEl = document.getElementById('fpErr');
    if(!email){ this._showErr(errEl, 'Enter your account email first.'); return; }
    const msg = `Namaste,\nI've forgotten my password for the PW Agrotech ERP.\nMy account email: ${email}\nKripya mera password reset kar dijiye.\nDhanyavaad.`;
    WhatsAppService.open(SUPPORT_WHATSAPP, msg);
    Modal.close();
  }

  _roleLabel(role){ return role.charAt(0).toUpperCase()+role.slice(1); }
  _showErr(el, msg){ el.textContent = msg; el.style.display = 'block'; }
  _friendlyError(e){
    if(['auth/wrong-password','auth/user-not-found','auth/invalid-credential'].includes(e.code)) return 'Incorrect email or password.';
    if(e.code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
    return e.message;
  }
}
