import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Receipt, 
  TrendingUp, 
  Settings, 
  LogOut,
  DollarSign,
  BarChart3,
  Building2,
  Wallet,
  Activity,
  FileCheck
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Sidebar({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "customer", "finance_team", "accountant", "sales", "pm"] },
    { path: "/customers", icon: Users, label: "Customers", roles: ["admin", "finance_team", "sales"] },
    { path: "/subscriptions", icon: TrendingUp, label: "Subscriptions", roles: ["admin", "customer", "finance_team", "sales"] },
    { path: "/invoices", icon: FileText, label: "Invoices", roles: ["admin", "customer", "finance_team", "accountant"] },
    { path: "/receivables", icon: Wallet, label: "Receivables", roles: ["admin", "finance_team", "accountant"] },
    { path: "/expenses", icon: Receipt, label: "Expenses", roles: ["admin", "finance_team", "accountant"] },
    { path: "/rate-management", icon: DollarSign, label: "Rate Management", roles: ["admin", "finance_team"] },
    { path: "/reports", icon: BarChart3, label: "Reports", roles: ["admin", "finance_team", "accountant", "pm"] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="w-64 border-r border-slate-200 bg-slate-50/50 h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#064E3B' }}>
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>Finance Panel</h1>
            <p className="text-xs text-slate-500 capitalize" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredNavItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                isActive 
                  ? 'text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              style={{
                fontFamily: 'IBM Plex Sans, sans-serif',
                backgroundColor: isActive ? '#064E3B' : 'transparent'
              }}
              data-testid={`nav-${item.path.substring(1)}`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="mb-3 p-3 rounded-lg bg-white border border-slate-200">
          <p className="text-sm font-medium" style={{ fontFamily: 'IBM Plex Sans, sans-serif', color: '#064E3B' }}>{user?.name}</p>
          <p className="text-xs text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
          style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
          data-testid="logout-button"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;