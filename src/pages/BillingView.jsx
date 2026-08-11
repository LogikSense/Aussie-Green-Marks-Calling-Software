import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  History, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  ShieldCheck, 
  AlertCircle,
  Loader2,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BillingView() {
  const { getAuthHeaders } = useAuth();
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('AUD');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      const [balRes, transRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/billing/balance`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/v1/billing/transactions`, { headers: getAuthHeaders() })
      ]);

      if (balRes.ok) {
        const data = await balRes.json();
        setBalance(data.balance);
        setCurrency(data.currency);
      }

      if (transRes.ok) {
        const data = await transRes.json();
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleTopUp = async (e) => {
    e.preventDefault();
    if (!topUpAmount || isNaN(topUpAmount) || topUpAmount <= 0) return;

    try {
      setProcessing(true);
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/v1/billing/topup`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: parseFloat(topUpAmount) })
      });

      if (res.ok) {
        setTopUpAmount('');
        setIsTopUpModalOpen(false);
        await fetchBillingData();
      }
    } catch (err) {
      console.error('Top up failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your wallet and usage credits.</p>
        </div>
        <button 
          onClick={() => setIsTopUpModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          Top Up Balance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-primary to-primary/80 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Wallet className="w-64 h-64 -mr-16 -mt-16" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between gap-8">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/80 font-medium uppercase tracking-[0.2em] text-xs">Current Balance</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-5xl font-black tabular-nums">${balance.toFixed(2)}</span>
                  <span className="text-xl font-bold opacity-70">{currency}</span>
                </div>
              </div>
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
                <CreditCard className="w-8 h-8" />
              </div>
            </div>
            
            <div className="flex items-center gap-6 mt-4">
              <div className="flex flex-col">
                <span className="text-primary-foreground/60 text-xs font-semibold uppercase tracking-widest">Active Plan</span>
                <span className="text-lg font-bold mt-1">Pay As You Go</span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="flex flex-col">
                <span className="text-primary-foreground/60 text-xs font-semibold uppercase tracking-widest">Pricing</span>
                <span className="text-lg font-bold mt-1">$0.50 / call</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Info Card */}
        <div className="bg-card border border-border rounded-[2rem] p-8 flex flex-col justify-center items-center text-center space-y-4 hover:border-primary/50 transition-colors">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold">Secure Payments</h3>
          <p className="text-muted-foreground text-sm">
            Payments are processed securely via Stripe. Your financial data never touches our servers.
          </p>
          <div className="flex gap-2">
             <div className="bg-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter">PCI Compliant</div>
             <div className="bg-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter">AES-256 SSL</div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Recent Activity</h2>
        </div>

        <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-accent/30 text-xs font-black uppercase tracking-widest opacity-50">
                  <th className="px-8 py-4">Transaction Details</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Date & Time</th>
                  <th className="px-8 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-8 py-20 text-center text-muted-foreground italic">
                      No transaction history yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="group hover:bg-accent/20 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            t.type === 'topup' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                          }`}>
                            {t.type === 'topup' ? 
                              <ArrowUpRight className="w-5 h-5 text-emerald-500" /> : 
                              <ArrowDownRight className="w-5 h-5 text-rose-500" />
                            }
                          </div>
                          <div>
                            <div className="font-bold text-base">{t.type === 'topup' ? 'Balance Top Up' : 'AI Usage Fee'}</div>
                            <div className="text-xs text-muted-foreground">{t.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm text-muted-foreground">
                        {new Date(t.created_at).toLocaleString('en-AU', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className={`px-8 py-5 text-right font-black text-base ${
                        t.type === 'topup' ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {t.type === 'topup' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Basic Tip Card */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex gap-4 items-start">
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
        <div>
          <h4 className="font-bold text-amber-900 dark:text-amber-400">Low Balance Warning</h4>
          <p className="text-sm text-amber-800/70 dark:text-amber-400/70 mt-1">
            Ensure your balance stays above $10.00 to avoid interruptions to your AI calling agents.
          </p>
        </div>
      </div>

      {/* Top Up Modal */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-md bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-black/5">
            <div className="p-8 space-y-8">
              <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-black tracking-tight">Top Up Wallet</h2>
                <p className="text-muted-foreground">Add funds to your account to continue calling.</p>
              </div>

              <form onSubmit={handleTopUp} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                    Select Amount (AUD)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[20, 50, 100].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopUpAmount(amt.toString())}
                        className={`py-3 rounded-xl border-2 font-bold transition-all ${
                          topUpAmount === amt.toString() 
                            ? 'border-primary bg-primary/5 text-primary' 
                            : 'border-border bg-accent/20 hover:border-primary/50'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <input
                      type="number"
                      placeholder="Custom amount"
                      className="w-full bg-accent/30 border border-border rounded-xl py-4 pl-8 pr-4 font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processing || !topUpAmount}
                  className="w-full py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                  {processing ? 'Processing...' : `Pay $${topUpAmount || '0.00'} Now`}
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="w-full py-4 bg-accent hover:bg-accent/80 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
