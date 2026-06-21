import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";
import CreateRoomModal from "./CreateRoomModal";
import Link from "next/link";
import HistoryClient from "./HistoryClient";
import SearchClient from "./SearchClient";

type PublicRoom = {
  id: string; name: string; _count: { participants: number }; items: { name: string; startingPrice: number }[];
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let publicRooms: PublicRoom[] = [];
  try {
    const res = await fetch("http://localhost:3001/api/rooms/public", { cache: "no-store" });
    if (res.ok) publicRooms = await res.json();
  } catch (err) {}

  let userHistory: any[] = [];
  try {
    const historyRes = await fetch(`http://localhost:3001/api/users/${session.user.id}/history`, { cache: "no-store" });
    if (historyRes.ok) userHistory = await historyRes.json();
  } catch (err) {}

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Welcome back, {session.user?.email?.split('@')[0]}
            </h1>
            <div className="flex items-center gap-2 mt-3">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Secure Connection Established
              </span>
            </div>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Actions (Takes up 4 cols on large screens) */}
          <div className="lg:col-span-4 space-y-6">
            <CreateRoomModal adminId={session.user.id} />
            <SearchClient />
          </div>

          {/* RIGHT COLUMN: Live Feeds & History (Takes up 8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Live Public Rooms */}
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100">
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                Live Public Auctions
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {publicRooms.length === 0 ? (
                  <div className="col-span-full bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500 font-medium">
                    The block is currently empty. Host an auction to get started.
                  </div>
                ) : (
                  publicRooms.map((room) => (
                    <div key={room.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-lg truncate pr-2">{room.name}</h3>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded tracking-wider">LIVE</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-5">
                        Current Lot: <span className="font-bold text-slate-800">{room.items[0]?.name || "Queuing items..."}</span>
                      </p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-medium flex items-center gap-1">👁️ {room._count.participants}</span>
                        <Link href={`/arena/${room.id}`} className="text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-lg transition-colors">Enter Arena →</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* REAL USER HISTORY */}
            <div className="bg-white p-8 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100">
               <HistoryClient userHistory={userHistory} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}