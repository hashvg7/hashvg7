import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EXPENSE_CATEGORIES = [
  "Salaries",
  "Marketing",
  "Operations",
  "Technology",
  "Office Rent",
  "Utilities",
  "Travel",
  "Professional Services",
  "Other"
];

function Expenses({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    description: "",
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await fetch(`${API}/expenses`, { credentials: "include" });
      const data = await response.json();
      setExpenses(data);
    } catch (error) {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          date: new Date(formData.date).toISOString()
        })
      });

      if (response.ok) {
        toast.success("Expense created");
        fetchExpenses();
        resetForm();
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      category: "",
      amount: "",
      description: "",
      date: format(new Date(), 'yyyy-MM-dd')
    });
    setShowModal(false);
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
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
                Expenses
              </h1>
              <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Track and manage business expenses
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
              data-testid="add-expense-button"
            >
              <Plus size={18} />
              Add Expense
            </button>
          </div>

          {/* Total Expenses Summary */}
          <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="expense-summary">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EF444415' }}>
                <Receipt size={32} style={{ color: '#EF4444' }} />
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Expenses</p>
                <p className="text-3xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#EF4444' }}>
                  ₹{totalExpenses.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>By Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="category-breakdown">
              {Object.entries(expensesByCategory).map(([category, amount]) => (
                <div key={category} className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <p className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{category}</p>
                  <p className="text-lg font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                    ₹{amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses Table */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden" data-testid="expenses-table">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Category</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Description</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.expense_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {format(new Date(expense.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-right" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#EF4444' }}>
                      ₹{expense.amount.toLocaleString()}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="expense-modal">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Add New Expense
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="category-select"
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="0.00"
                  data-testid="amount-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  placeholder="Enter expense description"
                  data-testid="description-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 px-4 focus:outline-none focus:ring-2 focus:ring-[#064E3B]"
                  data-testid="date-input"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  data-testid="save-expense-button"
                >
                  Create Expense
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

export default Expenses;