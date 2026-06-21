"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("https://auction-engine-backend.onrender.com/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: "signup" }),
      });
      const data = await res.json();
      if (res.ok) setStep(2);
      else setError(data.error);
    } catch (err) { setError("Server connection failed."); }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError("Passwords do not match!");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    
    setLoading(true); setError("");
    try {
      const res = await fetch("https://auction-engine-backend.onrender.com/api/auth/register-full", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        await signIn("credentials", { redirect: false, email, password });
        router.push("/dashboard");
      } else { setError(data.error); }
    } catch (err) { setError("Failed to register."); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans selection:bg-indigo-500/30">
      <div className="bg-white p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md border border-slate-100 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>

        <div className="text-center mb-8 mt-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Create Account</h2>
          <p className="text-slate-500 text-sm font-medium">Security Step {step} of {step === 1 ? '2' : '3'}</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-rose-100 flex justify-between items-center">
            <span className="flex items-center gap-2"><span>⚠️</span> {error}</span>
            {error.includes("already in use") && <Link href="/login" className="underline hover:text-rose-800">Login →</Link>}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSendEmail} className="space-y-5 animate-in fade-in duration-300">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
              <input type="email" required placeholder="you@company.com" className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98] mt-2">
              {loading ? "Encrypting..." : "Verify Identity"}
            </button>
            <p className="text-center text-sm text-slate-500 mt-8 font-medium">
              Already have an account? <Link href="/login" className="text-indigo-600 font-bold hover:text-indigo-700">Log in</Link>
            </p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); if(otp.length===6) setStep(3); else setError("Enter 6 digits"); }} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
            <p className="text-sm text-slate-500 text-center mb-6">Security code dispatched to <br/><strong className="text-slate-900">{email}</strong></p>
            <input type="text" required maxLength={6} placeholder="••••••" className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-center text-3xl tracking-[1em] font-mono outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <button type="submit" className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] mt-2">Authorize</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleRegister} className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Legal Name</label>
              <input type="text" required placeholder="John Doe" className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Vault Password</label>
              <input type="password" required placeholder="••••••••" className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
              <input type="password" required placeholder="••••••••" className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] mt-6">
              {loading ? "Provisioning Vault..." : "Complete Setup"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}