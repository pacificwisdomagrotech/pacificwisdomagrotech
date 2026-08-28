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
        this._showLockScreen(userData);
      } else {
        await this._completeLogin(user.uid);
      }
    });
  }

  _showLockScreen(userData){
    this._lockedUser = userData;
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('lockCard').style.display = 'block';
    document.getElementById('lockName').textContent = `Welcome back, ${userData.name}`;
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
    document.getElementById('loginCard').style.display = 'block';
    document.getElementById('lockCard').style.display = 'none';
    document.getElementById('loginStep').style.display = 'block';
    document.getElementById('otpStep').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
  }

  _roleLabel(role){ return role.charAt(0).toUpperCase()+role.slice(1); }
  _showErr(el, msg){ el.textContent = msg; el.style.display = 'block'; }
  _friendlyError(e){
    if(['auth/wrong-password','auth/user-not-found','auth/invalid-credential'].includes(e.code)) return 'Incorrect email or password.';
    if(e.code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
    return e.message;
  }
}

