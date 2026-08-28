class ActivityPage extends Page {
  render(){
    const rows = this.store.activityLog.map(a=>`<tr><td>${a.at? new Date(a.at.seconds*1000).toLocaleString() : '—'}</td><td>${a.user}</td><td>${a.type}</td><td>${a.message}</td></tr>`).join('');
    return `<div class="table-wrap"><table><thead><tr><th>When</th><th>User</th><th>Type</th><th>Details</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4">${this.emptyState('history','No activity yet.')}</td></tr>`}</tbody></table></div>`;
  }
}

