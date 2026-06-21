"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateRoomModal({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("https://auction-engine-backend.onrender.com/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          isPrivate,
          password: isPrivate ? password : null,
          adminId,
        }),
      });

      if (res.ok) {
        const newRoom = await res.json();
        setIsOpen(false);
        router.push(`/arena/${newRoom.id}`); 
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create room");
      }
    } catch (err) {
      setError("Server error. Is the backend running?");
    }
    setLoading(false);
  };

  return (
    <>
      {/* Premium Dashboard Trigger Card (FIXED LAYOUT) */}
      <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 group hover:border-indigo-100 transition-colors">
        <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 text-2xl group-hover:scale-110 transition-transform">
          👑
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Host an Auction</h2>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">Establish a secure trading floor, set access protocols, and invite VIP bidders.</p>
        <button 
          onClick={() => setIsOpen(true)}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20"
        >
          Initialize Room
        </button>
      </div>

      {/* Premium Pop-up Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 font-bold transition-colors"
            >
              ✕
            </button>
            
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">New Floor</h2>
              <p className="text-sm text-slate-500">Configure your auction environment.</p>
            </div>
            
            {error && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-rose-100 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}
            
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Room Designation</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Modern Art Collection"
                  className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setIsPrivate(!isPrivate)}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isPrivate ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                  {isPrivate && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <label className="text-sm font-bold text-slate-700 cursor-pointer flex-1">
                  Private Room (Requires Key)
                </label>
              </div>

              {isPrivate && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Encryption Key</label>
                  <input 
                    type="password" 
                    required={isPrivate}
                    placeholder="Set an entry password..."
                    className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] active:scale-[0.98] mt-6"
              >
                {loading ? "Initializing..." : "Launch Floor 🚀"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}