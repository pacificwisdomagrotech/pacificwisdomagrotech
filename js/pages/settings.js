class SettingsPage extends Page {
  render(){
    return `
    <div class="card" style="margin-bottom:16px">
      <div class="section-title">${Icons.svg('palette',18)} Theme</div>
      <div class="row" style="gap:12px">${ThemeManager.THEMES.map(t=>
        `<div class="theme-swatch ${ThemeManager.current()===t.id?'active':''}" onclick="ThemeManager.apply('${t.id}'); App.router.render();">
          <div class="swatch-dot" style="background:${t.dot}"></div>${t.name}
        </div>`).join('')}</div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="section-title">${Icons.svg('bell',18)} Notifications</div>
      <div class="settings-row"><div class="txt"><b>Login activity alerts</b><span class="muted">Admin sees a toast when any user logs in</span></div><div class="toggle ${SettingsStore.get('notifLogin',true)?'on':''}" onclick="App.pages.settings.toggle(this,'notifLogin')"></div></div>
      <div class="settings-row"><div class="txt"><b>New order notifications</b></div><div class="toggle ${SettingsStore.get('notifOrder',true)?'on':''}" onclick="App.pages.settings.toggle(this,'notifOrder')"></div></div>
      <div class="settings-row"><div class="txt"><b>Enquiry notifications</b></div><div class="toggle ${SettingsStore.get('notifEnquiry',true)?'on':''}" onclick="App.pages.settings.toggle(this,'notifEnquiry')"></div></div>
      <div class="settings-row"><div class="txt"><b>Daily sales summary email</b><span class="muted">Needs a small backend (Firebase Functions) to send on a schedule — not yet wired up</span></div><div class="toggle" style="opacity:.4;pointer-events:none"></div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="section-title">${Icons.svg('fingerprint',18)} Biometric Unlock</div>
      <p class="muted">${BiometricLock.isSupported()
        ? (BiometricLock.isEnabled(this.user.uid)
            ? 'Enabled on this device — reopening the app will ask for your fingerprint or face instead of your password.'
            : 'Skip typing your password on this device — unlock with your fingerprint or face instead.')
        : 'Not supported on this browser/device.'}</p>
      ${BiometricLock.isSupported() ? (
        BiometricLock.isEnabled(this.user.uid)
          ? `<button class="btn btn-danger btn-small" onclick="App.pages.settings.disableBiometric()">Disable on this device</button>`
          : `<button class="btn btn-primary btn-small" onclick="App.pages.settings.enableBiometric()">Enable on this device</button>`
      ) : ''}
      <div id="bio-err" class="err" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <div class="section-title">${Icons.svg('shield-check',18)} Two-Factor Authentication</div>
      <p class="muted">${this.user.twoFAEnabled ? 'Enabled on your account.' : 'Add an authenticator-app code at login for extra security.'}</p>
      ${this.user.twoFAEnabled
        ? `<button class="btn btn-danger btn-small" onclick="App.pages.settings.disable2FA()">Disable 2FA</button>`
        : `<button class="btn btn-primary btn-small" onclick="App.pages.settings.start2FA()">Enable 2FA</button>`}
      <div id="twofa-setup"></div>
    </div>`;
  }
  async enableBiometric(){
    const errEl = document.getElementById('bio-err');
    errEl.style.display = 'none';
    try{
      await BiometricLock.enroll(this.user.uid, this.user.name, this.user.email);
      this.app.router.render();
    }catch(e){
      errEl.textContent = 'Could not set up biometric unlock: ' + e.message;
      errEl.style.display = 'block';
    }
  }
  disableBiometric(){
    BiometricLock.disable(this.user.uid);
    this.app.router.render();
  }
  toggle(el, key){
    const on = !el.classList.contains('on');
    el.classList.toggle('on', on);
    SettingsStore.set(key, on);
  }
  start2FA(){
    const secret = TOTP.randomSecret();
    document.getElementById('twofa-setup').innerHTML = `
      <div style="margin-top:14px">
        <p>Add this secret key to Google Authenticator / Authy (choose "enter code manually"):</p>
        <div class="qr-secret">${secret}</div>
        <div class="field" style="margin-top:12px"><label>Enter the 6-digit code it shows to confirm</label><input id="confirm2fa" maxlength="6"></div>
        <button class="btn btn-primary btn-small" onclick="App.pages.settings.confirm2FA('${secret}')">Confirm & Enable</button>
      </div>`;
  }
  async confirm2FA(secret){
    const code = document.getElementById('confirm2fa').value.trim();
    if(await TOTP.verify(secret, code)){
      await this.db.collection('users').doc(this.user.uid).update({ twoFAEnabled:true, twoFASecret: secret });
      this.user.twoFAEnabled = true;
      alert('2FA enabled.');
      this.app.router.render();
    } else {
      alert('Code did not match, please try again.');
    }
  }
  async disable2FA(){
    await this.db.collection('users').doc(this.user.uid).update({ twoFAEnabled:false, twoFASecret: firebase.firestore.FieldValue.delete() });
    this.user.twoFAEnabled = false;
    this.app.router.render();
  }
}

