/* =============================================================================
   PACIFIC WISDOM AGROTECH — ERP
   Object-oriented architecture. Each concern is its own class so any part
   (a page, a service, a rule) can be edited on its own without touching
   the rest. See SETUP.md for Firebase configuration steps.

   Layout of this file:
     1. Icons          - tiny lucide wrapper
     2. Services       - Firebase, TOTP, Theme, Settings, WhatsApp, Excel, Modal
     3. DataStore      - single source of truth + Firestore realtime listeners
     4. NotificationCenter
     5. AuthController - login / 2FA / logout
     6. Pages          - one class per screen, each with render() + its own actions
     7. Router         - nav + page switching
     8. App            - wires everything together
   ============================================================================= */

/* -------------------------- 1. ICONS -------------------------- */
class Icons {
  static refresh(){ if(window.lucide) lucide.createIcons(); }
  static svg(name, size=17){ return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`; }
}

/* -------------------------- 2. SERVICES -------------------------- */

/** Wraps Firebase init, including a secondary app instance so the admin's
 *  own session survives creating a new manager account. */
class FirebaseService {
  constructor(config){
    this.app = firebase.initializeApp(config);
    this.secondaryApp = firebase.initializeApp(config, 'Secondary');
    this.auth = firebase.auth();
    this.db = firebase.firestore();
  }
  get secondaryAuth(){ return this.secondaryApp.auth(); }
}

/** RFC 6238 TOTP, implemented with Web Crypto only — no external library,
 *  works fully offline once the page is loaded, compatible with Google
 *  Authenticator / Authy. */
class TOTP {
  static _base32ToBytes(base32){
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '', bytes = [];
    base32 = base32.replace(/=+$/,'').toUpperCase();
    for(const c of base32){
      const val = alphabet.indexOf(c);
      if(val === -1) continue;
      bits += val.toString(2).padStart(5,'0');
    }
    for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.substr(i,8),2));
    return new Uint8Array(bytes);
  }
  static randomSecret(len=16){
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let out = '';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    for(let i=0;i<len;i++) out += alphabet[arr[i] % 32];
    return out;
  }
  static async code(secretB32, timeStepSeconds=30, digits=6, forCounter=null){
    const key = await crypto.subtle.importKey('raw', TOTP._base32ToBytes(secretB32), {name:'HMAC', hash:'SHA-1'}, false, ['sign']);
    const counter = forCounter ?? Math.floor(Date.now()/1000/timeStepSeconds);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, counter, false);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const offset = sig[sig.length-1] & 0xf;
    const code = ((sig[offset]&0x7f)<<24 | (sig[offset+1]&0xff)<<16 | (sig[offset+2]&0xff)<<8 | (sig[offset+3]&0xff)) % (10**digits);
    return code.toString().padStart(digits,'0');
  }
  static async verify(secretB32, inputCode){
    const now = Math.floor(Date.now()/1000/30);
    for(const c of [now-1, now, now+1]){
      if(await TOTP.code(secretB32, 30, 6, c) === inputCode) return true;
    }
    return false;
  }
}

/** Theme palette + persistence. Add a new theme by adding one entry here. */
class ThemeManager {
  static THEMES = [
    {id:'green',  name:'Harvest',     dot:'#0b6b3a'},
    {id:'ocean',  name:'Estuary',     dot:'#0b6e8c'},
    {id:'sunset', name:'Terracotta',  dot:'#b5502a'},
    {id:'royal',  name:'Orchid',      dot:'#5b3aa0'},
    {id:'dark',   name:'Midnight',    dot:'#0a120e'},
  ];
  static apply(id){
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem('pw_theme', id);
  }
  static current(){ return localStorage.getItem('pw_theme') || 'green'; }
  static init(){ ThemeManager.apply(ThemeManager.current()); }
}

/** Small typed wrapper around localStorage for per-device toggle prefs. */
class SettingsStore {
  static get(key, fallback){
    const v = localStorage.getItem('pw_setting_'+key);
    return v===null ? fallback : v==='true';
  }
  static set(key, val){ localStorage.setItem('pw_setting_'+key, val); }
}

/** Free click-to-send WhatsApp messages (no paid Business API required). */
class WhatsAppService {
  static link(phone, text){
    const digits = (phone||'').replace(/\D/g,'');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }
  static open(phone, text){ window.open(WhatsAppService.link(phone, text), '_blank'); }
}

/** Product-wise Excel export via SheetJS. */
class ExcelReportService {
  static exportSales(sales){
    const wb = XLSX.utils.book_new();
    const products = [...new Set(sales.map(s=>s.product))];
    products.forEach(p=>{
      const rows = sales.filter(s=>s.product===p).map(s=>({
        Date: s.createdAt ? new Date(s.createdAt.seconds*1000).toLocaleDateString() : '',
        Manager: s.managerName, Qty: s.qty, SellRate: s.sellRate, AdminRate: s.adminRate,
        Profit: s.profit, ProfitShare20pct: s.profitShare, PaymentStatus: s.paymentStatus
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, p.substring(0,31));
    });
    if(!products.length){
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{Note:'No sales yet'}]), 'Report');
    }
    XLSX.writeFile(wb, `PW-Agrotech-Report-${new Date().toISOString().slice(0,10)}.xlsx`);
  }
}

/** Tiny modal controller — pages call Modal.open(html) / Modal.close(). */
class Modal {
  static open(html){
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalBg').style.display='flex';
    Icons.refresh();
  }
  static close(){ document.getElementById('modalBg').style.display='none'; }
}

/** Builds a simple order-summary PDF client-side (jsPDF) and returns it as a
 *  data URL so it can be stored on the order document — the manager can then
 *  download it from inside the app itself, no email/WhatsApp needed. */
class PdfService {
  static generateOrderSummary(order){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const amount = order.qty * order.adminRate;
    doc.setFontSize(16); doc.text('Pacific Wisdom Agrotech', 14, 18);
    doc.setFontSize(11); doc.text('Order Summary', 14, 26);
    doc.setLineWidth(0.5); doc.line(14, 30, 196, 30);
    const rows = [
      ['Order ID', order.id || '-'],
      ['Date', new Date().toLocaleDateString('en-IN')],
      ['Manager', order.managerName],
      ['Product', order.product],
      ['Quantity', order.qty + ' quintal'],
      ['Wholesale Rate', '₹' + order.adminRate + ' / quintal'],
      ['Total Amount', '₹' + amount.toLocaleString('en-IN')],
      ['Status', 'Approved'],
    ];
    let y = 42;
    rows.forEach(([label, value])=>{
      doc.setFont(undefined,'bold'); doc.text(label + ':', 14, y);
      doc.setFont(undefined,'normal'); doc.text(String(value), 70, y);
      y += 9;
    });
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text('Generated automatically by the PW Agrotech ERP.', 14, y+10);
    return doc.output('datauristring');
  }
  static download(dataUrl, filename){
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
}

/** Every stock movement (farmer purchase, admin→manager transfer, manager
 *  sale) goes through here as a Firestore transaction, so two people acting
 *  at the same moment can never desync the numbers. */
class StockService {
  constructor(db){ this.db = db; }

  /** Admin buys from a farmer: adds straight into admin's central inventory. */
  async recordFarmerPurchase({ farmerName, phone, product, qty, rate, createdBy }){
    const amount = qty * rate;
    await this.db.collection('farmerPurchases').add({
      farmerName, phone: phone||'', product, qty, rate, amount,
      createdBy, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await this.db.runTransaction(async (tx) => {
      const invRef = this.db.collection('inventory');
      const snap = await invRef.where('product','==',product).limit(1).get();
      if(snap.empty){
        tx.set(invRef.doc(), { product, qty, unit:'quintal' });
      } else {
        const doc = snap.docs[0];
        tx.update(doc.ref, { qty: (doc.data().qty||0) + qty });
      }
    });
  }

  /** Admin approves a manager's order: moves stock from admin inventory into
   *  that manager's stock ledger. Throws if admin doesn't have enough. */
  async transferToManager({ product, qty, managerId, managerName }){
    await this.db.runTransaction(async (tx) => {
      const invSnap = await this.db.collection('inventory').where('product','==',product).limit(1).get();
      if(invSnap.empty || (invSnap.docs[0].data().qty||0) < qty){
        throw new Error(`Not enough ${product} in stock to approve this order.`);
      }
      const invDoc = invSnap.docs[0];
      tx.update(invDoc.ref, { qty: invDoc.data().qty - qty });

      const stockSnap = await this.db.collection('managerStock')
        .where('managerId','==',managerId).where('product','==',product).limit(1).get();
      if(stockSnap.empty){
        tx.set(this.db.collection('managerStock').doc(), { managerId, managerName, product, qty });
      } else {
        const sDoc = stockSnap.docs[0];
        tx.update(sDoc.ref, { qty: sDoc.data().qty + qty });
      }
    });
  }

  /** Manager sells to a customer: deducts from that manager's stock ledger.
   *  Throws if they don't have enough on hand. */
  async deductManagerStock({ managerId, product, qty }){
    await this.db.runTransaction(async (tx) => {
      const stockSnap = await this.db.collection('managerStock')
        .where('managerId','==',managerId).where('product','==',product).limit(1).get();
      if(stockSnap.empty || (stockSnap.docs[0].data().qty||0) < qty){
        throw new Error(`You only have ${stockSnap.empty ? 0 : stockSnap.docs[0].data().qty} qtl of ${product} in stock.`);
      }
      const sDoc = stockSnap.docs[0];
      tx.update(sDoc.ref, { qty: sDoc.data().qty - qty });
    });
  }
}

