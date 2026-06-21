import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans">
      
      {/* Abstract Glowing Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="bg-white/5 border border-white/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-10 backdrop-blur-xl shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
          <span className="text-5xl drop-shadow-lg">⚖️</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-tight">
          Auction <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">Engine</span>
        </h1>
        
        <p className="text-slate-400 text-lg md:text-2xl max-w-2xl mx-auto mb-12 font-light leading-relaxed">
          A high-performance real-time bidding platform. Host secure live auctions, manage participant access, and experience instant WebSocket-based trading.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
          <Link href="/signup" className="flex-1 bg-white text-slate-950 hover:bg-slate-100 font-bold py-4 px-8 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(255,255,255,0.15)]">
            Create Account
          </Link>
          <Link href="/login" className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 px-8 rounded-2xl transition-all border border-white/10 hover:border-white/20 backdrop-blur-md">
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}