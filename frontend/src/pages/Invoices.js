import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Invoices({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    amount: "",
    status: "pending",
    items: [{description: "", amount: ""}],
    due_date: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, custRes] = await Promise.all([
        fetch(`${API}/invoices`, { credentials: "include" }),
        fetch(`${API}/customers`, { credentials: "include" }).catch(() => ({ ok: false }))
      ]);

      const invData = await invRes.json();
      setInvoices(invData);

      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData);
      }
    } catch (error) {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          items: formData.items.map(item => ({
            description: item.description,
            amount: parseFloat(item.amount)
          })),
          due_date: new Date(formData.due_date).toISOString()
        })
      });

      if (response.ok) {
        toast.success("Invoice created");
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
      amount: "",
      status: "pending",
      items: [{description: "", amount: ""}],
      due_date: ""
    });
    setShowModal(false);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {description: "", amount: ""}]
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    const totalAmount = newItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    setFormData({ ...formData, items: newItems, amount: totalAmount.toString() });
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.customer_id === customerId);
    return customer?.name || "Unknown";
  };

  const canCreate = ["admin", "finance_team"].includes(user?.role);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Invoices
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Manage and track all invoices
              </p>
            </div>
            {canCreate && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                data-testid="add-invoice-button"
              >
                <Plus size={18} />
                Create Invoice
              </button>
            )}
          </div>

          {/* Invoices Table */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="invoices-table">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Invoice ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Customer</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoice_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>
                      {invoice.invoice_id}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {getCustomerName(invoice.customer_id)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      ₹{invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                          invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}
                        style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="invoice-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Create New Invoice
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    data-testid="due-date-input"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-slate-700" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm font-medium hover:underline"
                    style={{ color: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                    data-testid="add-item-button"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        required
                        className="h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                        data-testid={`item-description-${index}`}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', e.target.value)}
                        required
                        className="h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                        data-testid={`item-amount-${index}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748B' }}>Total Amount</span>
                  <span className="text-xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                    ₹{parseFloat(formData.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="status-select"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="save-invoice-button"
                >
                  Create Invoice
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

export default Invoices;