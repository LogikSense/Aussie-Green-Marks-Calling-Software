import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Paperclip, Bot, User, Phone, CheckCheck, RefreshCw, Camera, Share2, Mail, Globe, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UnifiedInboxView() {
  const { getAuthHeaders } = useAuth();
  const [channelFilter, setChannelFilter] = useState('all'); // all, whatsapp, messenger, instagram, webchat, email
  const [selectedConversation, setSelectedConversation] = useState(1);
  const [messageInput, setMessageInput] = useState('');
  const [chatwootConfig, setChatwootConfig] = useState({ configured: false, chatwoot_url: '' });

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // Simulated Chatwoot conversation list
  const conversations = [
    {
      id: 1,
      contact: "Marcus Vance",
      channel: "whatsapp",
      lastMessage: "Hi, I received the solar installation audit proposal. Can we discuss pricing?",
      time: "10:42 AM",
      unread: true,
      phone: "+61 412 345 678",
      email: "marcus.v@example.com",
      status: "Open",
      messages: [
        { sender: "customer", text: "Hi, I received the solar installation audit proposal. Can we discuss pricing?", time: "10:42 AM" },
        { sender: "ai", text: "Hello Marcus! I can certainly assist with solar pricing packages. Would you prefer a quick call or message breakdown?", time: "10:43 AM" }
      ]
    },
    {
      id: 2,
      contact: "Elena Rostova",
      channel: "instagram",
      lastMessage: "Do you offer commercial energy auditing services in Melbourne?",
      time: "09:15 AM",
      unread: false,
      phone: "+61 498 765 432",
      email: "elena@designstudio.au",
      status: "Open",
      messages: [
        { sender: "customer", text: "Do you offer commercial energy auditing services in Melbourne?", time: "09:15 AM" }
      ]
    },
    {
      id: 3,
      contact: "David Chen",
      channel: "messenger",
      lastMessage: "Thanks for the call earlier. Please send over the contract link.",
      time: "Yesterday",
      unread: false,
      phone: "+61 433 111 222",
      email: "david.chen@techcorp.io",
      status: "Resolved",
      messages: [
        { sender: "customer", text: "Thanks for the call earlier. Please send over the contract link.", time: "Yesterday" }
      ]
    }
  ];

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chatwoot/config`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setChatwootConfig(data);
        }
      } catch (err) {
        console.error('Error fetching Chatwoot config:', err);
      }
    };
    fetchConfig();
  }, [API_BASE, getAuthHeaders]);

  const activeConv = conversations.find(c => c.id === selectedConversation) || conversations[0];

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    try {
      await fetch(`${API_BASE}/api/chatwoot/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          conversation_id: String(activeConv.id),
          content: messageInput
        })
      });
    } catch (err) {
      console.error('Send message error:', err);
    }

    activeConv.messages.push({
      sender: "agent",
      text: messageInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    setMessageInput('');
  };

  const filteredConversations = conversations.filter(c => channelFilter === 'all' || c.channel === channelFilter);

  const getChannelBadge = (channel) => {
    switch (channel) {
      case 'whatsapp':
        return <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp</span>;
      case 'instagram':
        return <span className="bg-pink-500/10 text-pink-600 border border-pink-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><Camera className="w-3 h-3" /> Instagram</span>;
      case 'messenger':
        return <span className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><Share2 className="w-3 h-3" /> Messenger</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><Globe className="w-3 h-3" /> Web</span>;
    }
  };


  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-background text-foreground">
      {/* Header Bar */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Unified Omnichannel Inbox</h1>
          <p className="text-xs text-muted-foreground">Powered by Chatwoot • WhatsApp, FB Messenger, Instagram DM & Web Chat</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Sync Chatwoot
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Conversations List */}
        <div className="w-80 border-r border-border bg-card flex flex-col">
          {/* Filter Bar */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              <button 
                onClick={() => setChannelFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${channelFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-accent/50 text-muted-foreground hover:bg-accent'}`}
              >
                All
              </button>
              <button 
                onClick={() => setChannelFilter('whatsapp')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${channelFilter === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-accent/50 text-muted-foreground hover:bg-accent'}`}
              >
                WhatsApp
              </button>
              <button 
                onClick={() => setChannelFilter('instagram')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${channelFilter === 'instagram' ? 'bg-pink-600 text-white' : 'bg-accent/50 text-muted-foreground hover:bg-accent'}`}
              >
                Instagram
              </button>
              <button 
                onClick={() => setChannelFilter('messenger')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${channelFilter === 'messenger' ? 'bg-blue-600 text-white' : 'bg-accent/50 text-muted-foreground hover:bg-accent'}`}
              >
                FB
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredConversations.map((conv) => (
              <div 
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`p-3.5 cursor-pointer transition-colors hover:bg-accent/40 ${selectedConversation === conv.id ? 'bg-accent/70 border-l-4 border-primary' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{conv.contact}</span>
                  <span className="text-[10px] text-muted-foreground">{conv.time}</span>
                </div>
                <div className="mb-2">{getChannelBadge(conv.channel)}</div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{conv.lastMessage}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Active Chat Feed */}
        <div className="flex-1 flex flex-col bg-background">
          {/* Active Chat Header */}
          <div className="p-4 border-b border-border bg-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {activeConv.contact.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">{activeConv.contact}</h3>
                  {getChannelBadge(activeConv.channel)}
                </div>
                <p className="text-xs text-muted-foreground">{activeConv.phone} • {activeConv.email}</p>
              </div>
            </div>
            <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors">
              <Phone className="w-3.5 h-3.5" /> Call Customer
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {activeConv.messages.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex flex-col ${msg.sender === 'agent' ? 'items-end' : 'items-start'}`}
              >
                <div 
                  className={`max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.sender === 'agent' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : msg.sender === 'ai'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-card border border-border rounded-tl-none'
                  }`}
                >
                  {msg.sender === 'ai' && (
                    <div className="flex items-center gap-1 font-bold text-[10px] text-emerald-600 mb-1">
                      <Bot className="w-3 h-3" /> Auto AI Agent Response
                    </div>
                  )}
                  {msg.text}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Outbound Input */}
          <div className="p-3 border-t border-border bg-card space-y-2">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={`Reply to ${activeConv.contact} on ${activeConv.channel}...`}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary transition-colors"
              />
              <button 
                onClick={handleSendMessage}
                className="p-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-md transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Contact CRM Profile Sidebar */}
        <div className="w-72 border-l border-border bg-card p-4 overflow-y-auto space-y-6">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Customer Profile</h4>
            <div className="bg-accent/40 p-3 rounded-xl border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-semibold">{activeConv.contact}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-semibold">{activeConv.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-semibold">{activeConv.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold text-emerald-600">Active Audit Lead</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Interaction Timeline</h4>
            <div className="space-y-3 text-xs border-l-2 border-border pl-3">
              <div>
                <p className="font-semibold">WhatsApp Message Received</p>
                <p className="text-[10px] text-muted-foreground">Today at 10:42 AM</p>
              </div>
              <div>
                <p className="font-semibold">Outbound AI Call Completed</p>
                <p className="text-[10px] text-muted-foreground">Yesterday at 3:15 PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
