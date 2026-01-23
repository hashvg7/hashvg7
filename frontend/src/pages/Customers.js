import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Plus, Edit2, Trash2, Search, Check, X } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Customers({ user }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    permissions: {
      view_invoices: true,
      view_reports: false,
      make_payments: false,
      view_subscriptions: true,
      view_dashboard: true,
      view_analytics: false
    }
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingCustomer ? `${API}/customers/${editingCustomer.customer_id}` : `${API}/customers`;
      const method = editingCustomer ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingCustomer ? "Customer updated" : "Customer created");
        fetchCustomers();
        resetForm();
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm("Are you sure?")) return;

    try {
      const response = await fetch(`${API}/customers/${customerId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (response.ok) {
        toast.success("Customer deleted");
        fetchCustomers();
      }
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      company: "",
      permissions: {
        view_invoices: true,
        view_reports: false,
        make_payments: false,
        view_subscriptions: true,
        view_dashboard: true,
        view_analytics: false
      }
    });
    setEditingCustomer(null);
    setShowModal(false);
  };

  const handleEdit = (customer) => {
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      company: customer.company || "",
      permissions: customer.permissions
    });
    setEditingCustomer(customer);
    setShowModal(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const permissionLabels = {
    view_invoices: "View Invoices",
    view_reports: "View Reports",
    make_payments: "Make Payments",
    view_subscriptions: "View Subscriptions",
    view_dashboard: "View Dashboard",
    view_analytics: "View Analytics"
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Customers
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Manage customer accounts and permissions
              </p>
            </div>
            {(user?.role === "admin" || user?.role === "sales") && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                data-testid="add-customer-button"
              >
                <Plus size={18} />
                Add Customer
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B] transition-all"
                data-testid="search-input"
              />
            </div>
          </div>

          {/* Customers Table */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="customers-table">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Company</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Permissions</th>
                  {(user?.role === "admin" || user?.role === "sales") && (
                    <th className="px-6 py-4 text-right text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.customer_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{customer.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{customer.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{customer.company || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowDetailsModal(true);
                        }}
                        className="flex flex-wrap gap-1 hover:opacity-80 transition-opacity cursor-pointer text-left"
                        data-testid={`view-permissions-${customer.customer_id}`}
                      >
                        {Object.entries(customer.permissions).filter(([k, v]) => v).slice(0, 3).map(([key]) => (
                          <span
                            key={key}
                            className="px-2 py-1 text-xs rounded-md"
                            style={{ backgroundColor: '#D9F99D', color: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                          >
                            {permissionLabels[key]}
                          </span>
                        ))}
                        {Object.entries(customer.permissions).filter(([k, v]) => v).length > 3 && (
                          <span className="px-2 py-1 text-xs rounded-md bg-slate-100 text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                            +{Object.entries(customer.permissions).filter(([k, v]) => v).length - 3} more
                          </span>
                        )}
                      </button>
                    </td>
                    {(user?.role === "admin" || user?.role === "sales") && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors mr-2"
                          data-testid={`edit-customer-${customer.customer_id}`}
                        >
                          <Edit2 size={16} className="text-slate-600" />
                        </button>
                        {user?.role === "admin" && (
                          <button
                            onClick={() => handleDelete(customer.customer_id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-red-50 transition-colors"
                            data-testid={`delete-customer-${customer.customer_id}`}
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="customer-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    data-testid="customer-name-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    data-testid="customer-email-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    data-testid="customer-phone-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                    data-testid="customer-company-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Permissions</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 p-3 rounded-md border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.permissions[key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, [key]: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-slate-300"
                        style={{ accentColor: '#064E3B' }}
                        data-testid={`permission-${key}`}
                      />
                      <span className="text-sm" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="save-customer-button"
                >
                  {editingCustomer ? "Update Customer" : "Create Customer"}
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

export default Customers;