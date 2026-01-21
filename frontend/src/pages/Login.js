import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, Lock, Building2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("customer");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const body = isLogin ? { email, password } : { email, password, name, role: "customer" };

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      if (isLogin) {
        toast.success("Login successful!");
        navigate("/dashboard", { state: { user: data.user } });
      } else {
        toast.success("Registration successful! Please login.");
        setIsLogin(true);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div 
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{ backgroundImage: "url('https://images.pexels.com/photos/18435276/pexels-photo-18435276.jpeg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#064E3B]/80 to-[#0A0A0A]/60"></div>
        <div className="absolute inset-0 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <Building2 size={48} className="text-[#D9F99D]" />
            <h1 className="text-5xl font-bold" style={{ fontFamily: 'Work Sans, sans-serif' }}>Finance Panel</h1>
          </div>
          <p className="text-xl leading-relaxed opacity-90" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Manage your business finances with precision. Track revenue, expenses, and customer subscriptions all in one place.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold mb-2" style={{ fontFamily: 'Work Sans, sans-serif', color: '#064E3B' }}>
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              {isLogin ? "Enter your credentials to access your account" : "Sign up to get started"}
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="w-full h-11 rounded-md border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:border-transparent transition-all"
                  placeholder="Your name"
                  data-testid="name-input"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:border-transparent transition-all"
                  placeholder="your@email.com"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:border-transparent transition-all"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-md font-medium text-white transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              style={{ backgroundColor: '#064E3B', fontFamily: 'IBM Plex Sans, sans-serif' }}
              data-testid="submit-button"
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-sm text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>OR</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          <button
            onClick={handleGoogleAuth}
            className="w-full h-11 rounded-md border border-slate-200 bg-white hover:bg-slate-50 font-medium transition-all shadow-sm flex items-center justify-center gap-3"
            style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            data-testid="google-auth-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 font-medium hover:underline"
              style={{ color: '#064E3B' }}
              data-testid="toggle-auth-mode"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;