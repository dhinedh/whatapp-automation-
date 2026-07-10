import React from 'react';

function Header({ contactCount, onRefresh, onOpenBroadcast }) {
  return (
    <header className="bg-wa-teal text-white py-4 px-5 flex justify-between items-center shadow-md">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span>🌿</span> Mansara Foods CRM Dashboard
        </h1>
        <p className="text-xs opacity-90 mt-0.5">{contactCount} total customer contacts</p>
      </div>
      <div className="flex gap-2.5">
        <button 
          onClick={onOpenBroadcast}
          className="bg-white/10 hover:bg-white/20 border border-white/20 py-2 px-3.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        >
          📣 Campaign Broadcast
        </button>
        <button 
          onClick={onRefresh}
          className="bg-white hover:bg-gray-100 text-wa-teal border-none py-2 px-3.5 rounded-lg transition-all text-xs font-bold shadow-sm"
        >
          ↻ Refresh
        </button>
      </div>
    </header>
  );
}

export default Header;
