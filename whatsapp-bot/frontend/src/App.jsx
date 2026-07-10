import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import StatsRow from './components/StatsRow';
import ContactList from './components/ContactList';
import ContactDetail from './components/ContactDetail';
import { isToday } from './utils/formatters';

function App() {
  const API_URL = import.meta.env.VITE_API_URL || '';
  const [contacts, setContacts] = useState([]);
  const [currentPhone, setCurrentPhone] = useState(null);
  const [activeContactDetail, setActiveContactDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalContacts: 0,
    totalRevenue: 0,
    activeOrders: 0,
    openTickets: 0,
    consentRate: 0,
    botResolutionRate: 100
  });
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSegment, setBroadcastSegment] = useState('opt_in');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Fetch all contacts
  const fetchContacts = async () => {
    try {
      const res = await fetch(`${API_URL}/crm`);
      if (!res.ok) throw new Error('Failed to fetch CRM data');
      const data = await res.json();
      
      const sortedContacts = data.contacts.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
      setContacts(sortedContacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/crm/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  // Fetch detail for a specific contact
  const fetchContactDetail = async (phone) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/crm/${phone}`);
      if (!res.ok) throw new Error('Contact not found');
      const data = await res.json();
      setActiveContactDetail(data);
      setCurrentPhone(phone);
    } catch (error) {
      console.error("Error fetching detail:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Delete contact
  const deleteContact = async (phone) => {
    try {
      await fetch(`${API_URL}/crm/${phone}`, { method: 'DELETE' });
      setCurrentPhone(null);
      setActiveContactDetail(null);
      fetchContacts(); // Refresh list
      fetchAnalytics(); // Refresh analytics
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Failed to delete contact");
    }
  };

  // Toggle pause/resume bot state
  const handleToggleBot = async (phone, currentPausedState) => {
    try {
      const res = await fetch(`${API_URL}/crm/${phone}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paused: !currentPausedState })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveContactDetail(prev => prev ? { ...prev, is_paused: data.is_paused } : null);
        fetchContacts();
        fetchAnalytics();
      }
    } catch (error) {
      console.error("Error toggling bot:", error);
    }
  };

  // Resolve Ticket
  const handleResolveTicket = async (phone, ticketId) => {
    try {
      const res = await fetch(`${API_URL}/crm/${phone}/resolve-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      if (res.ok) {
        // Refresh detail
        fetchContactDetail(phone);
        fetchAnalytics();
      }
    } catch (error) {
      console.error("Error resolving ticket:", error);
    }
  };

  // Update order status (simulated ERP)
  const handleUpdateOrderStatus = async (phone, orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/crm/${phone}/update-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus })
      });
      if (res.ok) {
        fetchContactDetail(phone);
        fetchAnalytics();
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  // Send Broadcast Message
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch(`${API_URL}/crm/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText: broadcastMsg, segment: broadcastSegment })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`✅ Campaign broadcast sent to ${data.sentCount} contacts successfully!`);
        setBroadcastMsg('');
        setShowBroadcast(false);
      } else {
        alert("❌ Failed to send campaign broadcast.");
      }
    } catch (error) {
      console.error(error);
      alert("❌ Error sending broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchContacts();
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchContacts();
      fetchAnalytics();
      // Also refresh active contact if selected
      if (currentPhone) {
        // use silent fetch to avoid loading flash
        fetch(`${API_URL}/crm/${currentPhone}`)
          .then(res => res.json())
          .then(data => setActiveContactDetail(data))
          .catch(err => console.error(err));
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentPhone]);

  // Derived state
  const stats = useMemo(() => {
    return {
      total: contacts.length,
      revenue: analytics.totalRevenue || 0,
      activeOrders: analytics.activeOrders || 0,
      openTickets: analytics.openTickets || 0,
      consentRate: analytics.consentRate || 0,
      botResolutionRate: analytics.botResolutionRate || 100
    };
  }, [contacts, analytics]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return contacts.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) || 
      (c.phone && c.phone.includes(q))
    );
  }, [contacts, searchQuery]);

  return (
    <>
      <Header 
        contactCount={contacts.length} 
        onRefresh={() => { fetchContacts(); fetchAnalytics(); }} 
        onOpenBroadcast={() => setShowBroadcast(true)}
      />
      
      <StatsRow stats={stats} />
      
      <main className="flex-1 overflow-hidden px-5 pb-5 flex flex-col md:flex-row gap-5">
        <ContactList 
          contacts={filteredContacts}
          currentPhone={currentPhone}
          onSelectContact={fetchContactDetail}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <ContactDetail 
          contact={activeContactDetail} 
          loading={detailLoading}
          onDelete={deleteContact}
          onToggleBot={handleToggleBot}
          onResolveTicket={handleResolveTicket}
          onUpdateOrderStatus={handleUpdateOrderStatus}
        />
      </main>

      {/* Broadcast Campaign Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 transform scale-100 transition-transform">
            <div className="bg-wa-teal text-white p-5">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                📣 Create Campaign Broadcast
              </h3>
              <p className="text-xs opacity-80 mt-1">Send marketing messages or restock alerts to user segments on WhatsApp.</p>
            </div>
            
            <form onSubmit={handleSendBroadcast} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Segment</label>
                <select
                  value={broadcastSegment}
                  onChange={(e) => setBroadcastSegment(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm text-gray-700 focus:border-wa-green focus:bg-white"
                >
                  <option value="opt_in">All Marketing Opted-in Contacts</option>
                  <option value="loyalty">Loyalty Club Members (Points &gt; 0)</option>
                  <option value="cart_abandoned">Cart Abandoned Leads</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Message Body</label>
                <textarea
                  required
                  rows="4"
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Type your campaign message here... (e.g. 🌿 Special Deal! Buy cold-pressed coconut oil today and get millet cookies free! Use code milletsave)"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm text-gray-700 focus:border-wa-green focus:bg-white resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcast(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="px-5 py-2 text-sm text-white bg-wa-teal hover:bg-wa-teal/90 rounded-lg transition-all shadow-sm font-semibold flex items-center gap-2"
                >
                  {sendingBroadcast ? 'Sending...' : 'Send Broadcast 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
