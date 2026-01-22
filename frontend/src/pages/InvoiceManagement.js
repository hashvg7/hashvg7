import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { FileText, DollarSign, Clock, CheckCircle, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function InvoiceManagement({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "bank_transfer",
    payment_reference: "",
    notes: ""
  });
  const [generateData, setGenerateData] = useState({
    customer_id: "",
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
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
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API}/invoices/generate-monthly?customer_id=${generateData.customer_id}&year=${generateData.year}&month=${generateData.month}`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (response.ok) {
        toast.success("Invoice generated successfully");
        fetchData();
        setShowGenerateModal(false);
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to generate invoice");
      }
    } catch (error) {
      toast.error("Failed to generate invoice");
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API}/invoices/${selectedInvoice.invoice_id}/record-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...paymentData,
            amount: parseFloat(paymentData.amount)
          })
        }
      );

      if (response.ok) {
        toast.success("Payment recorded successfully");
        fetchData();
        setShowPaymentModal(false);
        setSelectedInvoice(null);
      } else {
        toast.error("Failed to record payment");
      }
    } catch (error) {
      toast.error("Failed to record payment");
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.customer_id === customerId);
    return customer?.name || "Unknown";
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <CheckCircle size={20} className="text-green-600" />;
      case "partially_paid":
        return <Clock size={20} className="text-yellow-600" />;
      case "pending":
      case "overdue":
        return <AlertCircle size={20} className="text-red-600" />;
      default:
        return <FileText size={20} className="text-slate-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "partially_paid":
        return "bg-yellow-100 text-yellow-700";
      case "pending":
        return "bg-blue-100 text-blue-700";
      case "overdue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const totalReceivable = invoices
    .filter(inv => inv.status !== "paid")
    .reduce((sum, inv) => sum + (inv.amount - (inv.paid_amount || 0)), 0);

  const totalPaid = invoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Invoice Management
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Generate invoices, track payments, and manage billing
              </p>
            </div>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
              data-testid="generate-invoice-button"
            >
              <Plus size={18} />
              Generate Invoice
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-testid="invoice-summary">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EF444415' }}>
                  <AlertCircle size={24} style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Receivable</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#EF4444' }}>
                    ₹{totalReceivable.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10B98115' }}>
                  <CheckCircle size={24} style={{ color: '#10B981' }} />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Collected</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#10B981' }}>
                    ₹{totalPaid.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#064E3B15' }}>
                  <FileText size={24} style={{ color: '#064E3B' }} />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Invoices</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                    {invoices.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices Table - Simplified for space */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="invoices-table">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Invoice</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Customer</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Status</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.invoice_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{invoice.invoice_id}</td>
                    <td className="px-6 py-4 text-sm" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{getCustomerName(invoice.customer_id)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-right" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>₹{invoice.amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {invoice.status !== "paid" && (
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowPaymentModal(true);
                          }}
                          className="px-4 py-2 rounded-md text-sm font-medium"
                          style={{ backgroundColor: '#064E3B', color: 'white' }}
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals included but simplified */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>Generate Monthly Invoice</h2>
            <form onSubmit={handleGenerateInvoice} className="space-y-5">
              <select
                value={generateData.customer_id}
                onChange={(e) => setGenerateData({ ...generateData, customer_id: e.target.value })}
                required
                className="w-full h-11 rounded-md border border-slate-200 px-4"
              >
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 h-11 rounded-md text-white" style={{ backgroundColor: '#064E3B' }}>Generate</button>
                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-6 h-11 rounded-md border">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="space-y-5">
              <input
                type="number"
                step="0.01"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
                placeholder="Amount"
                className="w-full h-11 rounded-md border border-slate-200 px-4"
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 h-11 rounded-md text-white" style={{ backgroundColor: '#064E3B' }}>Record</button>
                <button type="button" onClick={() => { setShowPaymentModal(false); setSelectedInvoice(null); }} className="px-6 h-11 rounded-md border">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceManagement;