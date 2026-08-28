/* -------------------------- 4. NOTIFICATION CENTER -------------------------- */
class NotificationCenter {
  constructor(){ this.items = []; }
  push(title, body){
    this.items.unshift({title, body, time: new Date()});
    document.getElementById('bellDot').style.display = 'block';
    if(window.Notification && Notification.permission === 'granted'){
      try{ new Notification(title, {body}); }catch(e){}
    }
    this._render();
  }
  toggle(){
    const p = document.getElementById('notifPanel');
    p.style.display = p.style.display==='block' ? 'none' : 'block';
    document.getElementById('bellDot').style.display = 'none';
    this._render();
  }
  _render(){
    const p = document.getElementById('notifPanel');
    if(!this.items.length){
      p.innerHTML = `<div class="notif-item muted">You're all caught up — no notifications yet.</div>`;
      return;
    }
    p.innerHTML = this.items.slice(0,20).map(n=>
      `<div class="notif-item"><b>${n.title}</b>${n.body}<div class="muted" style="margin-top:3px;font-size:11px">${n.time.toLocaleTimeString()}</div></div>`
    ).join('');
  }
  requestPermissionOnFirstClick(){
    if(window.Notification && Notification.permission==='default'){
      document.addEventListener('click', function once(){
        Notification.requestPermission(); document.removeEventListener('click', once);
      }, {once:true});
    }
  }
}

/* -------------------------- 5. BIOMETRIC LOCK -------------------------- */
/** Local device convenience lock using WebAuthn (fingerprint/face). This does
 *  NOT replace Firebase Auth — it only gates the already-restored Firebase
 *  session behind a biometric check on this specific device, the same way a
 *  banking app's "unlock with fingerprint" works after you're already
 *  signed in. Each device that enables it stores its own credential id. */
class BiometricLock {
  static isSupported(){ return !!(window.PublicKeyCredential && navigator.credentials); }
  static isEnabled(uid){ return !!localStorage.getItem('pw_biometric_'+uid); }

  static async enroll(uid, name, email){
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge, rp: { name: 'Pacific Wisdom Agrotech' },
        user: { id: userId, name: email, displayName: name },
        pubKeyCredParams: [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
        authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required' },
        timeout: 60000, attestation: 'none'
      }
    });
    localStorage.setItem('pw_biometric_'+uid, JSON.stringify({ credId: BiometricLock._bufToB64(cred.rawId) }));
  }

  static async verify(uid){
    const stored = JSON.parse(localStorage.getItem('pw_biometric_'+uid));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: BiometricLock._b64ToBuf(stored.credId), type:'public-key' }],
        userVerification: 'required', timeout: 60000
      }
    });
    return true; // navigator.credentials.get() throws/rejects on failure or cancel
  }

  static disable(uid){ localStorage.removeItem('pw_biometric_'+uid); }

  static _bufToB64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
  static _b64ToBuf(b64){ return Uint8Array.from(atob(b64), c=>c.charCodeAt(0)).buffer; }
}

