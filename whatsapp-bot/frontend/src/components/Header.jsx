import React from 'react';
import logoImg from '../assets/logo.png';

function Header({ contactCount, onRefresh, onOpenBroadcast, onUpdateDp, dpSyncing }) {
  return (
    <header className="bg-wa-teal text-white py-3.5 px-5 flex justify-between items-center shadow-md">
      <div className="flex items-center gap-3">
        <img 
          src={logoImg} 
          alt="Mansara Foods Logo" 
          className="w-10 h-10 rounded-full bg-white object-contain p-0.5 border-2 border-white/30 shadow-md"
        />
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            Mansara Foods CRM Dashboard
          </h1>
          <p className="text-xs opacity-90 mt-0.5">{contactCount} total customer contacts</p>
        </div>
      </div>
      <div className="flex gap-2.5 items-center">
        <button 
          onClick={onUpdateDp}
          disabled={dpSyncing}
          className="bg-white/10 hover:bg-white/20 border border-white/20 py-2 px-3.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
          title="Sync official WhatsApp Business Profile picture (DP) with Mansara Foods Logo"
        >
          <img src={logoImg} alt="Logo" className="w-4 h-4 rounded-full bg-white object-contain p-0.5" />
          {dpSyncing ? 'Syncing DP...' : 'Sync WhatsApp DP'}
        </button>
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
