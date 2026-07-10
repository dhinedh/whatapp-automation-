import React, { useState, useRef, useEffect } from 'react';
import { formatDate, formatTime, formatLastSeen } from '../utils/formatters';

function ContactDetail({ contact, onDelete, onToggleBot, onResolveTicket, onUpdateOrderStatus, loading }) {
  const [activeTab, setActiveTab] = useState('chat');
  const chatEndRef = useRef(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current && activeTab === 'chat') {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [contact?.messages, activeTab]);

  if (loading) {
    return (
      <div className="flex-1 bg-white rounded-xl flex items-center justify-center border border-gray-100 h-[600px] md:h-auto z-10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-wa-green border-t-transparent rounded-full animate-spin"></div>
          <div className="font-bold text-wa-teal text-base">Retrieving Contact details...</div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex-1 bg-gray-50 rounded-xl flex flex-col items-center justify-center border border-gray-100 h-[600px] md:h-auto text-gray-400 text-center p-6 z-10">
        <div className="text-6xl mb-4 animate-bounce">🌿</div>
        <h2 className="text-xl font-bold mb-2 text-gray-700">No Customer Selected</h2>
        <p className="text-sm max-w-xs text-gray-400">Click on a contact from the list to manage their chat, cart, orders, and support tickets.</p>
      </div>
    );
  }

  // Helper to calculate cart grand total
  const cartSubtotal = contact.cart ? contact.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
  
  return (
    <div className="flex-1 bg-white rounded-xl flex flex-col relative shadow-sm border border-gray-100 h-[600px] md:h-auto overflow-hidden">
      
      {/* Customer Summary Header */}
      <div className="bg-white px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4 z-10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-gray-800">{contact.name || contact.phone}</h2>
            {contact.is_paused && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">+{contact.phone}</p>
        </div>
        
        <div className="flex gap-2 items-center">
          {contact.is_paused ? (
            <button
              onClick={() => onToggleBot(contact.phone, true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all"
            >
              ▶ Resume Chatbot
            </button>
          ) : (
            <button
              onClick={() => onToggleBot(contact.phone, false)}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all animate-pulse"
            >
              ⏸ Pause Bot (Takeover)
            </button>
          )}
        </div>
      </div>

      {/* Tabs Selection Bar */}
      <div className="bg-gray-50 px-4 border-b border-gray-100 flex gap-1 scrollbar-none overflow-x-auto z-10">
        {[
          { id: 'chat', label: '💬 Chat' },
          { id: 'cart', label: `🛒 Cart (${contact.cart?.length || 0})` },
          { id: 'orders', label: `📦 Orders (${contact.orders?.length || 0})` },
          { id: 'tickets', label: `🎫 Tickets (${contact.tickets?.filter(t => t.status === 'Open').length || 0})` },
          { id: 'profile', label: '👤 CRM Profile' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-wa-teal border-wa-teal bg-white/50' 
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-gray-50">
        
        {/* TAB 1: CHAT HISTORY */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col relative bg-[#efeae2] h-full overflow-hidden">
            {/* Background Pattern */}
            <div 
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{ backgroundImage: 'url(\'data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z" fill="%23075E54" fill-rule="evenodd"/%3E%3C/svg%3E\')' }}
            ></div>
            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-2.5 z-10">
              {contact.messages && contact.messages.map((msg, idx) => {
                const isSystemAction = msg.text && (msg.text.startsWith('btn_') || msg.text.startsWith('cat_') || msg.text.startsWith('add_') || msg.text.startsWith('wish_') || msg.text.startsWith('pay_'));
                
                if (isSystemAction) {
                  return (
                    <div key={idx} className="max-w-[70%] px-3.5 py-1.5 rounded-2xl text-[11px] shadow-sm self-end bg-wa-teal/10 border border-wa-teal/20 text-wa-teal font-semibold relative text-center mb-1">
                      ⚡ Action: {msg.text}
                      <span className="block text-[8px] opacity-60 text-right mt-0.5">
                        {formatTime(msg.time)}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="max-w-[75%] px-3 py-2 rounded-lg text-sm shadow-[0_1px_1px_rgba(0,0,0,0.08)] self-end bg-bubble-sent relative">
                    <span className="break-words" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br>') }} />
                    <span className="block text-[9px] text-gray-400 text-right mt-1">
                      {formatTime(msg.time)}
                    </span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* TAB 2: SHOPPING CART */}
        {activeTab === 'cart' && (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <span>🛒</span> Active Shopping Cart
            </h3>
            
            {!contact.cart || contact.cart.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-400 text-sm">
                This customer's shopping cart is currently empty.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-600">
                    {contact.cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-3 font-semibold text-gray-800">{item.name}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">₹{item.price}</td>
                        <td className="p-3 text-right font-bold">₹{item.price * item.quantity}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50/50 font-bold">
                      <td colSpan="3" className="p-3 text-right text-gray-500 uppercase tracking-wider">Subtotal:</td>
                      <td className="p-3 text-right text-wa-teal text-sm">₹{cartSubtotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Wishlist Section */}
            <h3 className="text-sm font-bold text-gray-700 pt-4 flex items-center gap-1.5">
              <span>❤️</span> Wishlist Items
            </h3>
            {!contact.wishlist || contact.wishlist.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-gray-100 text-center text-gray-400 text-sm">
                No items added to wishlist.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {contact.wishlist.map((item, idx) => (
                  <span key={idx} className="bg-pink-50 text-pink-700 border border-pink-100 text-xs py-1.5 px-3 rounded-full font-semibold shadow-sm flex items-center gap-1">
                    ❤️ {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ORDER HISTORY */}
        {activeTab === 'orders' && (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <span>📦</span> Order History & Simulation
            </h3>
            
            {!contact.orders || contact.orders.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-400 text-sm">
                No orders placed by this customer yet.
              </div>
            ) : (
              <div className="space-y-4">
                {contact.orders.map((order) => (
                  <div key={order.orderId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-50 pb-3">
                      <div>
                        <span className="font-bold text-sm text-gray-800">{order.orderId}</span>
                        <span className="text-[10px] text-gray-400 ml-2">({new Date(order.createdAt).toLocaleDateString('en-GB')})</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold uppercase ${
                          order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.paymentStatus}
                        </span>
                        <span className={`text-[10px] py-0.5 px-2 rounded-full font-bold uppercase ${
                          order.status === 'Delivered' ? 'bg-green-100 text-green-800' : 
                          order.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Order items */}
                    <div className="space-y-1.5">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                          <span>{item.name} <strong className="text-gray-400">x{item.quantity}</strong></span>
                          <span>₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-50 pt-2 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-gray-500 uppercase">Grand Total:</span>
                      <span className="text-sm font-extrabold text-wa-teal">₹{order.total}</span>
                    </div>

                    {/* Simulated Order Actions */}
                    {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                      <div className="flex flex-wrap gap-2 pt-2 justify-end border-t border-gray-50">
                        {order.status === 'Placed' && (
                          <button
                            onClick={() => onUpdateOrderStatus(contact.phone, order.orderId, 'Packed')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                          >
                            ⚙️ Mark Packed
                          </button>
                        )}
                        {(order.status === 'Placed' || order.status === 'Packed') && (
                          <button
                            onClick={() => onUpdateOrderStatus(contact.phone, order.orderId, 'Shipped')}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                          >
                            🚚 Mark Shipped
                          </button>
                        )}
                        {order.status === 'Shipped' && (
                          <button
                            onClick={() => onUpdateOrderStatus(contact.phone, order.orderId, 'Delivered')}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                          >
                            ✅ Mark Delivered
                          </button>
                        )}
                        <button
                          onClick={() => onUpdateOrderStatus(contact.phone, order.orderId, 'Cancelled')}
                          className="bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold py-1 px-2.5 rounded transition-all"
                        >
                          ❌ Cancel Order
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUPPORT TICKETS */}
        {activeTab === 'tickets' && (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <span>🎫</span> Support Tickets
            </h3>
            
            {!contact.tickets || contact.tickets.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-gray-400 text-sm">
                No support tickets raised by this customer.
              </div>
            ) : (
              <div className="space-y-3">
                {contact.tickets.map((t) => (
                  <div key={t.ticketId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs bg-gray-100 text-gray-600 py-0.5 px-2 rounded">{t.ticketId}</span>
                        <span className={`text-[9px] font-bold uppercase py-0.5 px-1.5 rounded ${
                          t.status === 'Open' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-700 pt-1">{t.subject}</p>
                      <p className="text-[10px] text-gray-400">Created: {new Date(t.createdAt).toLocaleString('en-IN')}</p>
                    </div>

                    {t.status === 'Open' && (
                      <button
                        onClick={() => onResolveTicket(contact.phone, t.ticketId)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-1 px-3 rounded-lg border border-emerald-100 transition-colors shrink-0"
                      >
                        ✔ Resolve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CRM PROFILE */}
        {activeTab === 'profile' && (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              <span>👤</span> Customer CRM Metadata
            </h3>
            
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider">Marketing Consent</span>
                  <span className={`inline-block font-bold text-xs py-1 px-2.5 rounded-full ${
                    contact.consent === true ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    contact.consent === false ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-gray-50 text-gray-500 border border-gray-100'
                  }`}>
                    {contact.consent === true ? '✅ Subscribed' : contact.consent === false ? '🚫 Guest Mode' : '❓ Unknown'}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider">Language Preference</span>
                  <span className="font-bold text-gray-700 text-sm">
                    {contact.language === 'ta' ? '🇮🇳 Tamil / தமிழ்' : '🇬🇧 English'}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider">Loyalty Rewards Club</span>
                  <span className="font-extrabold text-amber-600 text-sm flex items-center gap-1">
                    🎁 {contact.loyaltyPoints || 0} pts <span className="text-[10px] text-gray-400 font-normal">(Value: ₹{contact.loyaltyPoints || 0})</span>
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider">Lead Status Tag</span>
                  <span className="font-bold text-gray-700 text-sm">
                    {contact.lead_status || 'New'}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider">First Contacted</span>
                  <span className="text-gray-600">{formatDate(contact.firstSeen)}</span>
                </div>
                <div>
                  <span className="block text-gray-400 font-semibold mb-1 uppercase tracking-wider">Last Interaction</span>
                  <span className="text-gray-600">{formatLastSeen(contact.lastSeen)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Delete Contact Footer bar */}
      <div className="p-4 bg-white border-t border-gray-100 text-right z-10">
        <button 
          onClick={() => {
            if (window.confirm("Are you sure you want to delete this contact? This will delete all order history and support tickets!")) {
              onDelete(contact.phone);
            }
          }}
          className="bg-white text-danger border border-danger hover:bg-danger hover:text-white px-4 py-2 rounded-lg transition-colors text-xs font-semibold"
        >
          Delete Customer Contact
        </button>
      </div>
    </div>
  );
}

export default ContactDetail;
