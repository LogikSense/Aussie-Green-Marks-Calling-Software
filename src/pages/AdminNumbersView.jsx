import React, { useState, useEffect } from 'react';
import { Phone, Search, Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function AdminNumbersView() {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [myNumbers, setMyNumbers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  
  const [searchParams, setSearchParams] = useState({
    country: 'US',
    areaCode: ''
  });

  const API_BASE = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    fetchMyNumbers();
  }, []);

  const fetchMyNumbers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/twilio/my-numbers`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMyNumbers(data.numbers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const query = new URLSearchParams();
      query.append('country', searchParams.country);
      if (searchParams.areaCode) {
        query.append('area_code', searchParams.areaCode);
      }

      const res = await fetch(`${API_BASE}/api/twilio/numbers?${query.toString()}`, {
        headers: getAuthHeaders()
      });
      
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.numbers || []);
      } else {
        throw new Error(data.detail || 'Failed to search numbers');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePurchase = async (phoneNumber) => {
    setPurchaseLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const res = await fetch(`${API_BASE}/api/twilio/numbers/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ phone_number: phoneNumber })
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully purchased ${phoneNumber}` });
        setSearchResults(searchResults.filter(n => n.phone_number !== phoneNumber));
        fetchMyNumbers();
      } else {
        throw new Error(data.detail || 'Failed to purchase number');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Phone Numbers</h1>
        <p className="text-muted-foreground mt-1">Manage and purchase numbers for staff manual calling.</p>
      </div>

      {message.text && (
        <div className={cn(
          "flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm",
          message.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Search & Purchase Section */}
        <div className="premium-card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Search New Numbers
          </h3>
          
          <form onSubmit={handleSearch} className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Country</label>
                <select 
                  value={searchParams.country}
                  onChange={e => setSearchParams({...searchParams, country: e.target.value})}
                  className="w-full bg-accent/20 border-border rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="US">United States (US)</option>
                  <option value="AU">Australia (AU)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="CA">Canada (CA)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Area Code (Optional)</label>
                <input 
                  type="text" 
                  value={searchParams.areaCode}
                  onChange={e => setSearchParams({...searchParams, areaCode: e.target.value})}
                  placeholder="e.g. 415"
                  className="w-full bg-accent/20 border-border rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={searchLoading}
              className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Find Numbers
            </button>
          </form>

          {/* Search Results */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {searchResults.map(num => (
              <div key={num.phone_number} className="bg-accent/10 border border-border p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold">{num.phone_number}</p>
                  <p className="text-xs text-muted-foreground">{num.locality}, {num.region}</p>
                </div>
                <button
                  onClick={() => handlePurchase(num.phone_number)}
                  disabled={purchaseLoading}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Buy
                </button>
              </div>
            ))}
            {!searchLoading && searchResults.length === 0 && searchParams.country && (
              <p className="text-sm text-muted-foreground text-center py-4">No results. Try searching.</p>
            )}
          </div>
        </div>

        {/* Owned Numbers Section */}
        <div className="premium-card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Your Numbers
          </h3>
          
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : myNumbers.length > 0 ? (
              myNumbers.map(num => (
                <div key={num.id} className="bg-accent/10 border border-border p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">{num.phone_number}</p>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", num.type ? "bg-emerald-500" : "bg-amber-500")} />
                      {num.type ? `Assigned (${num.type})` : 'Unassigned'}
                    </p>
                  </div>
                  <button className="p-2 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-lg transition-colors" title="Release Number">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-accent/5 rounded-xl border border-border border-dashed">
                <Phone className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground font-medium">No numbers purchased yet.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}