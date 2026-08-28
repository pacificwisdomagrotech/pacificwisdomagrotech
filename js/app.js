/* -------------------------- 8. APP (composition root) -------------------------- */
class ERPApplication {
  constructor(firebaseConfig){
    this.fb = new FirebaseService(firebaseConfig);
    this.currentUser = null;
    this.notifications = new NotificationCenter();
    this.activity = new ActivityLogger(this.fb, () => this.currentUser);
    this.store = new DataStore(this.fb, this.notifications, this.activity);
    this.stock = new StockService(this.fb.db);
    this.auth = new AuthController(this);
    this.router = new Router(this);

    this.pages = {
      dashboard: new DashboardPage(this),
      enquiries: new EnquiriesPage(this),
      orders: new OrdersPage(this),
      sales: new SalesPage(this),
      products: new ProductsPage(this),
      purchases: new PurchasesPage(this),
      farmers: new CrmPage(this, 'farmers', ['Name','Phone','Village','Product'], 'tractor'),
      customers: new CrmPage(this, 'customers', ['Name','Phone','City','Notes'], 'users'),
      inventory: new InventoryPage(this),
      users: new UsersPage(this),
      activity: new ActivityPage(this),
      reports: new ReportsPage(this),
      settings: new SettingsPage(this),
    };

    // A brand-new order/sale pops an approval/awareness modal for the admin
    // automatically, on top of the normal toast notification.
    this.store.onNewOrder = (order) => this.pages.orders.showApprovalPrompt(order);
    this.store.onNewSale = (sale) => {
      if(sale.profitShare > 0){
        Modal.open(`<h3>${Icons.svg('banknote',18)} New Sale</h3>
          <p style="font-size:15px;line-height:1.6"><b>${sale.managerName}</b> sold <b>${sale.qty} quintal</b> of <b>${sale.product}</b> @ ₹${sale.sellRate}/qtl.<br>Your 20% share: <b>₹${sale.profitShare.toLocaleString('en-IN')}</b></p>
          <button class="btn btn-primary" style="width:100%" onclick="Modal.close()">OK</button>`);
      }
    };
  }
  init(){
    ThemeManager.init();
    this.notifications.requestPermissionOnFirstClick();
    Icons.refresh();
    this.auth.listenForSessionRestore();
  }
}

/* =============================================================================
   FIREBASE CONFIG — REPLACE WITH YOUR OWN PROJECT
   Create a free project at https://console.firebase.google.com
   Enable: Authentication > Email/Password, and Firestore Database.
   See SETUP.md for the full step-by-step + security rules.
   ============================================================================= */

/* -------------------------- BOOTSTRAP -------------------------- */
try{
  if(typeof firebase === 'undefined'){
    throw new Error('Firebase library failed to load — check your internet connection or try switching from mobile data to WiFi.');
  }
  window.App = new ERPApplication(firebaseConfig);
  window.Modal = Modal;
  window.ThemeManager = ThemeManager;
  window.App.init();
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW registration failed:', err));
    });
  }
}catch(e){
  document.getElementById('loginErr').textContent = 'Failed to start: ' + e.message;
  document.getElementById('loginErr').style.display = 'block';
  console.error('App init failed:', e);
}
