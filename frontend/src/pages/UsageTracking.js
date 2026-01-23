import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Plus, Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SERVICES = {
  variable: [
    { key: "orders", name: "Orders", unit: "orders" },
    { key: "users", name: "Users", unit: "users" },
    { key: "warehouse", name: "Warehouse", unit: "warehouses" },
    { key: "darkstore", name: "Darkstore", unit: "darkstores" },
    { key: "store", name: "Store", unit: "stores" },
    { key: "seller_panel", name: "Seller Panel", unit: "panels" },
    { key: "fba", name: "FBA", unit: "transactions" },
    { key: "sku", name: "SKU Management", unit: "SKUs" },
    { key: "reco", name: "Reconciliation", unit: "recos" },
    { key: "dispute_mgmt", name: "Dispute Management", unit: "disputes" },
    { key: "listings", name: "Listings", unit: "listings" },
    { key: "client_portal", name: "Client Portal", unit: "accesses" },
  ]
};

function UsageTracking({ user }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [usageLogs, setUsageLogs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [excessUsageData, setExcessUsageData] = useState(null);
  const [loadingExcess, setLoadingExcess] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    service: "",
    count: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchUsageLogs();
    }
  }, [selectedCustomer, formData.year, formData.month]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API}/customers`, { credentials: "include" });
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageLogs = async () => {
    try {
      const response = await fetch(
        `${API}/usage-logs/${selectedCustomer}?year=${formData.year}&month=${formData.month}`,
        { credentials: "include" }
      );
      const data = await response.json();
      setUsageLogs(data);
    } catch (error) {
      toast.error("Failed to load usage logs");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/usage-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          count: parseInt(formData.count)
        })
      });

      if (response.ok) {
        toast.success("Usage logged successfully");
        fetchUsageLogs();
        resetForm();
      }
    } catch (error) {
      toast.error("Failed to log usage");
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      service: "",
      count: "",
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1
    });
    setShowModal(false);
  };

  const aggregateUsage = () => {
    const aggregated = {};
    usageLogs.forEach(log => {
      aggregated[log.service] = (aggregated[log.service] || 0) + log.count;
    });
    return aggregated;
  };

  const usageData = aggregateUsage();

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Usage Tracking
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Monitor and log customer service usage
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
              data-testid="log-usage-button"
            >
              <Plus size={18} />
              Log Usage
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                data-testid="customer-filter"
              >
                <option value="">Select customer</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Month</label>
              <select
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Usage Summary */}
          {selectedCustomer && (
            <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="usage-summary">
              <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Usage Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {SERVICES.variable.map(service => (
                  <div key={service.key} className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={16} style={{ color: '#064E3B' }} />
                      <p className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748B' }}>
                        {service.name}
                      </p>
                    </div>
                    <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                      {usageData[service.key]?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{service.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Usage Logs Table */}
          {selectedCustomer && usageLogs.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="usage-logs-table">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Service</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Count</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Date Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {usageLogs.map((log, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        {SERVICES.variable.find(s => s.key === log.service)?.name || log.service}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>
                        {log.count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        {format(new Date(log.logged_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedCustomer && usageLogs.length === 0 && (
            <div className="text-center py-12 rounded-lg border border-slate-200 bg-white">
              <Activity size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                No usage data
              </p>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Start logging usage for this customer
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Log Usage Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="usage-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Log Usage
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Customer</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="modal-customer-select"
                >
                  <option value="">Select customer</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Service</label>
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="modal-service-select"
                >
                  <option value="">Select service</option>
                  {SERVICES.variable.map(s => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Count</label>
                <input
                  type="number"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: e.target.value })}
                  required
                  min="1"
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="Enter usage count"
                  data-testid="modal-count-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Year</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    required
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Month</label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="save-usage-button"
                >
                  Log Usage
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

export default UsageTracking;