import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Plus, DollarSign } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SERVICE_TYPES = [
  "Orders",
  "Users",
  "Warehouses",
  "SKUs",
  "Seller Panel",
  "Stores",
  "Dark Stores",
  "Client Portal",
  "PIM",
  "Reconciliation"
];

function RateManagement({ user }) {
  const [rateTiers, setRateTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    service_type: "",
    tier_name: "",
    range_min: "",
    range_max: "",
    rate: ""
  });

  useEffect(() => {
    fetchRateTiers();
  }, []);

  const fetchRateTiers = async () => {
    try {
      const response = await fetch(`${API}/rate-tiers`, { credentials: "include" });
      const data = await response.json();
      setRateTiers(data);
    } catch (error) {
      toast.error("Failed to load rate tiers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/rate-tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          range_min: parseInt(formData.range_min),
          range_max: formData.range_max ? parseInt(formData.range_max) : null,
          rate: parseFloat(formData.rate)
        })
      });

      if (response.ok) {
        toast.success("Rate tier created");
        fetchRateTiers();
        resetForm();
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      service_type: "",
      tier_name: "",
      range_min: "",
      range_max: "",
      rate: ""
    });
    setShowModal(false);
  };

  const tiersByService = rateTiers.reduce((acc, tier) => {
    if (!acc[tier.service_type]) {
      acc[tier.service_type] = [];
    }
    acc[tier.service_type].push(tier);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Rate Management
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Configure tiered pricing for various services
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
              data-testid="add-rate-tier-button"
            >
              <Plus size={18} />
              Add Rate Tier
            </button>
          </div>

          {/* Rate Tiers by Service */}
          <div className="space-y-8" data-testid="rate-tiers-list">
            {Object.entries(tiersByService).map(([serviceType, tiers]) => (
              <div key={serviceType}>
                <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                  {serviceType}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tiers.map((tier) => (
                    <div
                      key={tier.tier_id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all"
                      data-testid={`rate-tier-${tier.tier_id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-semibold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                          {tier.tier_name}
                        </h4>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#064E3B15' }}>
                          <DollarSign size={20} style={{ color: '#064E3B' }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Range:</span>
                          <span className="font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                            {tier.range_min} - {tier.range_max || '∞'}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Rate:</span>
                          <span className="font-bold text-lg" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                            ₹{tier.rate.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {Object.keys(tiersByService).length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>No rate tiers configured yet. Add your first rate tier to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="rate-tier-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Add New Rate Tier
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Service Type</label>
                <select
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="service-type-select"
                >
                  <option value="">Select service type</option>
                  {SERVICE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Tier Name</label>
                <input
                  type="text"
                  value={formData.tier_name}
                  onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="e.g., Tier 1"
                  data-testid="tier-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Range Min</label>
                  <input
                    type="number"
                    value={formData.range_min}
                    onChange={(e) => setFormData({ ...formData, range_min: e.target.value })}
                    required
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    placeholder="0"
                    data-testid="range-min-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Range Max</label>
                  <input
                    type="number"
                    value={formData.range_max}
                    onChange={(e) => setFormData({ ...formData, range_max: e.target.value })}
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    placeholder="Leave blank for ∞"
                    data-testid="range-max-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="0.00"
                  data-testid="rate-input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="save-rate-tier-button"
                >
                  Create Rate Tier
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

export default RateManagement;