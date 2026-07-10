import React from 'react';

function StatsRow({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Sales Revenue</h3>
        <div className="text-3xl font-bold text-gray-800">₹{(stats.revenue || 0).toLocaleString('en-IN')}</div>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Active E-com Orders</h3>
        <div className="text-3xl font-bold text-gray-800">{stats.activeOrders || 0}</div>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Opt-in Consent Rate</h3>
        <div className="text-3xl font-bold text-gray-800">{stats.consentRate || 0}%</div>
      </div>
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Open Support Tickets</h3>
        <div className="text-3xl font-bold text-danger">{stats.openTickets || 0}</div>
      </div>
    </div>
  );
}

export default StatsRow;
