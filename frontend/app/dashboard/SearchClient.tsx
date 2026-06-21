"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchClient() {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    
    try {
      const res = await fetch(`https://auction-engine-backend.onrender.com/api/rooms/search/${searchId}`);
      if (res.ok) {
        // Room exists! Teleport the user to the Arena.
        router.push(`/arena/${searchId}`);
      } else {
        alert("Room not found! Please check the Room ID and try again.");
        setLoading(false);
      }
    } catch (err) {
      alert("Failed to connect to the server.");
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 group hover:border-emerald-100 transition-colors">
      <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 text-2xl group-hover:scale-110 transition-transform">
        🎟️
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Join Private Room</h2>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed">Have an exclusive invite? Enter the secure floor ID to gain access.</p>
      
      <div className="space-y-4">
        <input 
          type="text" 
          placeholder="Enter Floor ID..." 
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none bg-slate-50/50 transition-all font-medium text-slate-900 placeholder-slate-400" 
        />
        <button 
          onClick={handleSearch}
          disabled={loading || !searchId.trim()}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
        >
          {loading ? "Locating..." : "Request Access 🔍"}
        </button>
      </div>
    </div>
  );
}