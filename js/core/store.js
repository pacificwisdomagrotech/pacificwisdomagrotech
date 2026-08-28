/* -------------------------- 3. DATA STORE -------------------------- */

/** Single source of truth for all Firestore collections. Pages read from
 *  this; it re-renders the current page automatically when data it cares
 *  about changes. Adding a new collection = one more block in attach(). */
class DataStore {
  constructor(fb, notifications, activity){
    this.fb = fb;
    this.notifications = notifications;
    this.activity = activity;
    this.products = []; this.enquiries = []; this.orders = []; this.sales = [];
    this.farmers = []; this.customers = []; this.inventory = []; this.users = [];
    this.activityLog = []; this.managerStock = []; this.farmerPurchases = [];
    this._onChange = null;   // set by App to trigger a re-render of the active page
    this.onNewOrder = null;  // set by App: fires (order) => ... when a fresh order needs admin's attention
    this.onNewSale = null;   // set by App: fires (sale) => ... when a fresh sale needs admin's attention
  }
  onChange(cb){ this._onChange = cb; }
  _notifyIfRelevant(pages){ if(this._onChange) this._onChange(pages); }

  /** Find (or return null for) a manager's stock row for one product. */
  stockFor(managerId, product){
    return this.managerStock.find(m => m.managerId===managerId && m.product===product);
  }

  attach(currentUser){
    const db = this.fb.db;

    db.collection('products').onSnapshot(s=>{
      this.products = s.docs.map(d=>({id:d.id,...d.data()}));
      this._notifyIfRelevant(['products','dashboard','orders','sales']);
    });

    db.collection('enquiries').orderBy('createdAt','desc').onSnapshot(s=>{
      const prev = this.enquiries.length;
      this.enquiries = s.docs.map(d=>({id:d.id,...d.data()}));
      if(prev && this.enquiries.length > prev && SettingsStore.get('notifEnquiry', true)){
        this.notifications.push('New enquiry received', this.enquiries[0].customerName+' — '+this.enquiries[0].product);
      }
      this._notifyIfRelevant(['enquiries','dashboard']);
    });

    db.collection('orders').orderBy('createdAt','desc').onSnapshot(s=>{
      const prev = this.orders.length;
      this.orders = s.docs.map(d=>({id:d.id,...d.data()}));
      if(prev && this.orders.length > prev && SettingsStore.get('notifOrder', true)){
        this.notifications.push('New order placed', this.orders[0].product+' × '+this.orders[0].qty+' qtl');
        if(currentUser.role==='admin' && this.orders[0].status==='placed' && this.onNewOrder) this.onNewOrder(this.orders[0]);
      }
      this._notifyIfRelevant(['orders','dashboard','sales']);
    });

    db.collection('sales').orderBy('createdAt','desc').onSnapshot(s=>{
      const prev = this.sales.length;
      this.sales = s.docs.map(d=>({id:d.id,...d.data()}));
      if(prev && this.sales.length > prev && currentUser.role==='admin' && this.sales[0].profitShare>0){
        this.notifications.push('New sale recorded', `${this.sales[0].managerName} sold ${this.sales[0].qty} qtl ${this.sales[0].product} — your share ₹${this.sales[0].profitShare.toLocaleString('en-IN')}`);
        if(this.onNewSale) this.onNewSale(this.sales[0]);
      }
      this._notifyIfRelevant(['sales','dashboard','reports']);
    });
    db.collection('farmers').onSnapshot(s=>{ this.farmers = s.docs.map(d=>({id:d.id,...d.data()})); this._notifyIfRelevant(['farmers','purchases']); });
    db.collection('customers').onSnapshot(s=>{ this.customers = s.docs.map(d=>({id:d.id,...d.data()})); this._notifyIfRelevant(['customers']); });
    db.collection('inventory').onSnapshot(s=>{ this.inventory = s.docs.map(d=>({id:d.id,...d.data()})); this._notifyIfRelevant(['inventory','dashboard','purchases']); });
    db.collection('managerStock').onSnapshot(s=>{ this.managerStock = s.docs.map(d=>({id:d.id,...d.data()})); this._notifyIfRelevant(['sales','dashboard']); });
    db.collection('farmerPurchases').orderBy('createdAt','desc').onSnapshot(s=>{ this.farmerPurchases = s.docs.map(d=>({id:d.id,...d.data()})); this._notifyIfRelevant(['purchases']); });
    db.collection('users').onSnapshot(s=>{ this.users = s.docs.map(d=>({id:d.id,...d.data()})); this._notifyIfRelevant(['users']); });

    db.collection('activity').orderBy('at','desc').limit(200).onSnapshot(s=>{
      const prev = this.activityLog.length;
      this.activityLog = s.docs.map(d=>({id:d.id,...d.data()}));
      if(prev && this.activityLog.length > prev && this.activityLog[0].type==='login'
         && currentUser.role==='admin' && SettingsStore.get('notifLogin', true)
         && this.activityLog[0].uid !== currentUser.uid){
        this.notifications.push('Login activity', this.activityLog[0].message);
      }
      this._notifyIfRelevant(['activity']);
    });
  }
}

/** Writes a row to the activity collection; DataStore listens and displays it. */
class ActivityLogger {
  constructor(fb, getUser){ this.fb = fb; this.getUser = getUser; }
  async log(type, message){
    const user = this.getUser();
    await this.fb.db.collection('activity').add({
      type, message, uid: user ? user.uid : null, user: user ? user.name : 'unknown',
      at: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

