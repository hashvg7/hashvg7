import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Send, Link2, CheckCircle, AlertCircle, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Receivables({ user }) {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingInvoices, setProcessingInvoices] = useState({});

  useEffect(() => {
    fetchReceivables();
  }, []);

  const fetchReceivables = async () => {
    try {
      const response = await fetch(`${API}/receivables`, { credentials: "include" });
      const data = await response.json();
      setReceivables(data);
    } catch (error) {
      toast.error("Failed to load receivables");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentLink = async (invoiceId) => {
    setProcessingInvoices(prev => ({ ...prev, [invoiceId]: 'creating_link' }));
    
    try {
      const response = await fetch(`${API}/receivables/create-payment-link?invoice_id=${invoiceId}`, {
        method: "POST",
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Payment link created successfully!");
        fetchReceivables(); // Refresh data
      } else {
        throw new Error("Failed to create payment link");
      }
    } catch (error) {
      toast.error("Failed to create payment link");
    } finally {
      setProcessingInvoices(prev => ({ ...prev, [invoiceId]: null }));
    }
  };

  const handleSendPaymentEmail = async (invoiceId) => {
    setProcessingInvoices(prev => ({ ...prev, [invoiceId]: 'sending_email' }));
    
    try {
      const response = await fetch(`${API}/receivables/send-payment-email?invoice_id=${invoiceId}`, {
        method: "POST",
        credentials: "include"
      });

      if (response.ok) {
        toast.success("Payment email sent successfully!");
        fetchReceivables();
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Failed to send email");
      }
    } catch (error) {
      toast.error(error.message || "Failed to send payment email");
    } finally {
      setProcessingInvoices(prev => ({ ...prev, [invoiceId]: null }));
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    if (!window.confirm("Mark this invoice as paid?")) return;

    setProcessingInvoices(prev => ({ ...prev, [invoiceId]: 'marking_paid' }));
    
    try {
      const response = await fetch(`${API}/receivables/mark-paid?invoice_id=${invoiceId}`, {
        method: "POST",
        credentials: "include"
      });

      if (response.ok) {
        toast.success("Invoice marked as paid!");
        fetchReceivables();
      } else {
        throw new Error("Failed to mark as paid");
      }
    } catch (error) {
      toast.error("Failed to mark invoice as paid");
    } finally {
      setProcessingInvoices(prev => ({ ...prev, [invoiceId]: null }));
    }
  };

  const getTotalReceivables = () => {
    return receivables.reduce((sum, r) => sum + r.total_amount, 0);
  };

  const getOverdueAmount = () => {
    return receivables.reduce((sum, r) => {
      const overdueInvoices = r.invoices.filter(inv => {
        const dueDate = new Date(inv.due_date);
        return dueDate < new Date() && inv.status !== 'paid';
      });
      return sum + overdueInvoices.reduce((invSum, inv) => invSum + inv.amount, 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex">
        <Sidebar user={user} />
        <div className="flex-1 p-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Receivables
            </h1>
            <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Manage pending payments and send payment links to customers
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-testid="receivables-summary">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#064E3B15' }}>
                  <IndianRupee size={24} style={{ color: '#064E3B' }} />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Receivables</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                    ₹{getTotalReceivables().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EF444415' }}>
                  <AlertCircle size={24} style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Overdue Amount</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#EF4444' }}>
                    ₹{getOverdueAmount().toLocaleString()}
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
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Customers</p>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                    {receivables.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Receivables by Customer */}
          <div className="space-y-6" data-testid="receivables-list">
            {receivables.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-slate-200 bg-white">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-600" />
                <p className="text-lg font-medium" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                  All caught up!
                </p>
                <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  No pending receivables at the moment
                </p>
              </div>
            ) : (
              receivables.map((receivable) => (
                <div
                  key={receivable.customer.customer_id}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
                  data-testid={`receivable-${receivable.customer.customer_id}`}
                >
                  {/* Customer Header */}
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-semibold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                          {receivable.customer.name}
                        </h3>
                        <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                          {receivable.customer.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Outstanding</p>
                        <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                          ₹{receivable.total_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Invoices */}
                  <div className="p-6">
                    <div className="space-y-4">
                      {receivable.invoices.map((invoice) => {
                        const isOverdue = new Date(invoice.due_date) < new Date();
                        const isProcessing = processingInvoices[invoice.invoice_id];
                        
                        return (
                          <div
                            key={invoice.invoice_id}
                            className="p-4 rounded-lg border border-slate-200 hover:shadow-md transition-all"
                            data-testid={`invoice-${invoice.invoice_id}`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-semibold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                                  {invoice.invoice_id}
                                </p>
                                <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                                  Due: {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                                  ₹{invoice.amount.toLocaleString()}
                                </p>
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                  style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                                >
                                  {isOverdue ? 'Overdue' : 'Pending'}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-3">
                              {!invoice.payment_link_url ? (
                                <button
                                  onClick={() => handleCreatePaymentLink(invoice.invoice_id)}
                                  disabled={isProcessing}
                                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                                  style={{ backgroundColor: '#064E3B', color: 'white', fontFamily: 'IBM Plex Sans, sans-serif' }}
                                  data-testid={`create-link-${invoice.invoice_id}`}
                                >
                                  <Link2 size={16} />
                                  {isProcessing === 'creating_link' ? 'Creating...' : 'Create Payment Link'}
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleSendPaymentEmail(invoice.invoice_id)}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm disabled:opacity-50"
                                    style={{ backgroundColor: '#064E3B', color: 'white', fontFamily: 'IBM Plex Sans, sans-serif' }}
                                    data-testid={`send-email-${invoice.invoice_id}`}
                                  >
                                    <Send size={16} />
                                    {isProcessing === 'sending_email' ? 'Sending...' : 'Send Payment Email'}
                                  </button>
                                  
                                  <button
                                    onClick={() => handleMarkPaid(invoice.invoice_id)}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-all disabled:opacity-50"
                                    style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
                                    data-testid={`mark-paid-${invoice.invoice_id}`}
                                  >
                                    <CheckCircle size={16} />
                                    {isProcessing === 'marking_paid' ? 'Marking...' : 'Mark as Paid'}
                                  </button>
                                  
                                  {invoice.payment_email_sent && (
                                    <span className="flex items-center gap-1 px-3 py-2 text-xs rounded-md bg-green-50 text-green-700" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                                      <CheckCircle size={14} />
                                      Email Sent
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            {invoice.payment_link_url && (
                              <div className="mt-3 p-3 rounded-md bg-slate-50">
                                <p className="text-xs text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Payment Link:</p>
                                <a
                                  href={invoice.payment_link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm hover:underline"
                                  style={{ color: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                                >
                                  {invoice.payment_link_url}
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Receivables;
