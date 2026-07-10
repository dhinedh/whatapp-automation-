import React from 'react';
import { formatLastSeen } from '../utils/formatters';

function ContactList({ contacts, currentPhone, onSelectContact, searchQuery, onSearchChange }) {
  const getFunnelBadgeClass = (state) => {
    switch (state) {
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'checkout': return 'bg-amber-100 text-amber-800';
      case 'cart': return 'bg-sky-100 text-sky-800';
      case 'browsing': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full md:w-[350px] bg-white rounded-lg flex flex-col shadow-sm border border-gray-100 h-[500px] md:h-auto flex-shrink-0">
      <div className="p-4 border-b border-gray-100">
        <input 
          type="text" 
          placeholder="Search name or phone number..." 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full py-2 px-4 border border-gray-200 rounded-full outline-none bg-gray-50 text-sm focus:bg-white focus:border-wa-green transition-colors"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="p-5 text-center text-gray-400 text-sm">No contacts found</div>
        ) : (
          contacts.map(contact => {
            const isActive = currentPhone === contact.phone;
            const avatarLetter = contact.name ? contact.name.charAt(0).toUpperCase() : 'W';
            
            // Calculate cart total
            const cartTotal = contact.cart ? contact.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
            const funnelState = contact.funnelState || 'onboarding';

            return (
              <div 
                key={contact.phone}
                onClick={() => onSelectContact(contact.phone)}
                className={`flex p-3 cursor-pointer border-b border-gray-50 transition-colors ${isActive ? 'bg-gray-50' : 'hover:bg-gray-50/50'}`}
              >
                <div className="w-11 h-11 rounded-full bg-wa-green text-white flex items-center justify-center font-bold text-lg mr-4 shrink-0 shadow-sm">
                  {avatarLetter}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold truncate text-gray-800">{contact.name || contact.phone}</span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                      {formatLastSeen(contact.lastSeen)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500 truncate">+{contact.phone}</span>
                    <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold uppercase ${getFunnelBadgeClass(funnelState)}`}>
                      {funnelState}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-1 items-center">
                      {contact.is_paused && (
                        <span className="bg-red-100 text-red-700 text-[8px] py-0.5 px-1.5 rounded font-bold uppercase">
                          Handoff
                        </span>
                      )}
                      {cartTotal > 0 && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] py-0.5 px-1.5 rounded font-bold">
                          🛒 ₹{cartTotal}
                        </span>
                      )}
                    </div>
                    <span className="bg-wa-green/10 text-wa-green text-[10px] py-0.5 px-2 rounded-full font-bold">
                      {contact.messageCount} msgs
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ContactList;
