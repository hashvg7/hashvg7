import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Subscriptions({ user }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    plan_name: "",
    mrr: "",
    status: "active"
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subsRes, custRes] = await Promise.all([
        fetch(`${API}/subscriptions`, { credentials: "include" }),
        fetch(`${API}/customers`, { credentials: "include" }).catch(() => ({ ok: false }))
      ]);

      const subsData = await subsRes.json();
      setSubscriptions(subsData);

      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
      }
    } catch (error) {
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          mrr: parseFloat(formData.mrr)
        })
      });

      if (response.ok) {
        toast.success("Subscription created");
        fetchData();
        resetForm();
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      plan_name: "",
      mrr: "",
      status: "active"
    });
    setShowModal(false);
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.customer_id === customerId);
    return customer?.name || "Unknown";
  };

  const totalMRR = subscriptions
    .filter(s => s.status === "active")
    .reduce((sum, s) => sum + s.mrr, 0);

  const canCreate = ["admin", "finance_team", "sales"].includes(user?.role);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Subscriptions
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Track recurring revenue and subscription plans
              </p>
            </div>
            {canCreate && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                data-testid="add-subscription-button"
              >
                <Plus size={18} />
                Add Subscription
              </button>
            )}
          </div>

          {/* MRR Summary */}
          <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="mrr-summary">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B98115' }}>
                <TrendingUp size={32} style={{ color: '#10B981' }} />
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Monthly Recurring Revenue</p>
                <p className="text-3xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                  ₹{totalMRR.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Subscriptions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="subscriptions-grid">
            {subscriptions.map((sub) => (
              <div
                key={sub.subscription_id}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
                data-testid={`subscription-card-${sub.subscription_id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                    {sub.plan_name}
                  </h3>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      sub.status === 'active' ? 'bg-green-100 text-green-700' :
                      sub.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}
                    style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                  >
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  {getCustomerName(sub.customer_id)}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                    ₹{sub.mrr.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>/month</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="subscription-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Add New Subscription
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Customer</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="customer-select"
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Plan Name</label>
                <input
                  type="text"
                  value={formData.plan_name}
                  onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="e.g., Premium Plan"
                  data-testid="plan-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Monthly Recurring Revenue (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mrr}
                  onChange={(e) => setFormData({ ...formData, mrr: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="0.00"
                  data-testid="mrr-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="status-select"
                >
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="save-subscription-button"
                >
                  Create Subscription
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 h-11 rounded-md font-medium border border-slate-200 hover:bg-slate-50 transition-all"
                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Subscriptions;