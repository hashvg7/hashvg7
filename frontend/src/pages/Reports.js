import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#064E3B', '#10B981', '#D9F99D', '#64748B', '#0F172A'];

function Reports({ user }) {
  const [analytics, setAnalytics] = useState(null);
  const [revenueChart, setRevenueChart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsRes, chartRes] = await Promise.all([
        fetch(`${API}/analytics/overview`, { credentials: "include" }),
        fetch(`${API}/analytics/revenue-chart`, { credentials: "include" })
      ]);

      const analyticsData = await analyticsRes.json();
      const chartData = await chartRes.json();

      setAnalytics(analyticsData);
      setRevenueChart(chartData);
    } catch (error) {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex">
        <Sidebar user={user} />
        <div className="flex-1 p-8">Loading reports...</div>
      </div>
    );
  }

  const profitMargin = analytics?.total_revenue > 0 
    ? ((analytics.net_profit / analytics.total_revenue) * 100).toFixed(1)
    : 0;

  const financialBreakdown = [
    { name: 'Revenue', value: analytics?.total_revenue || 0, color: '#064E3B' },
    { name: 'Expenses', value: analytics?.total_expenses || 0, color: '#EF4444' },
  ];

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Financial Reports
            </h1>
            <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Comprehensive analytics and insights
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-testid="key-metrics">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Net Profit</p>
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                ₹{analytics?.net_profit?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-green-600 mt-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>+{profitMargin}% margin</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Revenue</p>
                <BarChart3 size={20} className="text-blue-600" />
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                ₹{analytics?.total_revenue?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-slate-600 mt-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>From all sources</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Total Expenses</p>
                <TrendingDown size={20} className="text-red-600" />
              </div>
              <p className="text-3xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#EF4444' }}>
                ₹{analytics?.total_expenses?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-slate-600 mt-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Operating costs</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue Trend */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="revenue-trend-chart">
              <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Revenue Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }} />
                  <YAxis style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#064E3B" strokeWidth={3} dot={{ fill: '#064E3B', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue vs Expenses */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="revenue-vs-expenses">
              <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Revenue vs Expenses
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={financialBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }} />
                  <YAxis style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {financialBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="summary-stats">
            <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Summary Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-600 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Active Customers</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                  {analytics?.total_customers || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Active Subscriptions</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                  {analytics?.total_subscriptions || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#10B981' }}>
                  ₹{analytics?.total_mrr?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Pending Revenue</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#EAB308' }}>
                  ₹{analytics?.pending_revenue?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;