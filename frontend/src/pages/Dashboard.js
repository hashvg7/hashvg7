import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { TrendingUp, Users, FileText, DollarSign, ArrowUp, ArrowDown } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Dashboard({ user }) {
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
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex">
        <Sidebar user={user} />
        <div className="flex-1 p-8">Loading...</div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Revenue",
      value: `₹${analytics?.total_revenue?.toLocaleString() || 0}`,
      change: "+12.5%",
      icon: DollarSign,
      color: "#064E3B"
    },
    {
      title: "Monthly Recurring Revenue",
      value: `₹${analytics?.total_mrr?.toLocaleString() || 0}`,
      change: "+8.2%",
      icon: TrendingUp,
      color: "#10B981"
    },
    {
      title: "Active Customers",
      value: analytics?.total_customers || 0,
      change: "+15.3%",
      icon: Users,
      color: "#64748B"
    },
    {
      title: "Pending Invoices",
      value: `₹${analytics?.pending_revenue?.toLocaleString() || 0}`,
      change: "-5.1%",
      icon: FileText,
      color: "#EF4444"
    }
  ];

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar user={user} />
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              Dashboard
            </h1>
            <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Welcome back, {user?.name}! Here's your business overview.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-testid="stats-grid">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
                  data-testid={`stat-card-${index}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                      <Icon size={24} style={{ color: stat.color }} />
                    </div>
                    <span className={`text-sm font-medium ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change}
                    </span>
                  </div>
                  <h3 className="text-sm text-slate-600 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    {stat.title}
                  </h3>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#0A0A0A' }}>
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="revenue-chart">
              <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Revenue Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }} />
                  <YAxis style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#064E3B" strokeWidth={2} dot={{ fill: '#064E3B', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Financial Summary */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" data-testid="financial-summary">
              <h3 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
                Financial Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                  <span className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748B' }}>Total Revenue</span>
                  <span className="text-lg font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>₹{analytics?.total_revenue?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                  <span className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748B' }}>Total Expenses</span>
                  <span className="text-lg font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#EF4444' }}>₹{analytics?.total_expenses?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: '#D9F99D20' }}>
                  <span className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>Net Profit</span>
                  <span className="text-xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>₹{analytics?.net_profit?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;