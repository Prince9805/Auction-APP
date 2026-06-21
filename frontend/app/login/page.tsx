"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");

    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      router.push("/dashboard"); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans selection:bg-indigo-500/30">
      <div className="bg-white p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md border border-slate-100 relative overflow-hidden">
        
        {/* Subtle top gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>

        <div className="text-center mb-10 mt-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Welcome Back</h2>
          <p className="text-slate-500 text-sm">Sign in to access your trading dashboard</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-rose-100 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
            <input type="email" required className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-slate-700">Password</label>
              <Link href="/forgot-password" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Forgot Password?</Link>
            </div>
            <input type="password" required className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] mt-2">
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between">
          <hr className="w-full border-slate-100" /><span className="px-4 text-xs text-slate-400 font-bold uppercase tracking-widest">Or</span><hr className="w-full border-slate-100" />
        </div>

        <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="mt-8 w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 p-4 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <p className="text-center text-sm text-slate-500 mt-10 font-medium">
          Don't have an account? <Link href="/signup" className="text-indigo-600 font-bold hover:text-indigo-700">Create one now</Link>
        </p>
      </div>
    </div>
  );
}