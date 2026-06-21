"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface User { id: string; email: string | null; role: string; }
type ArenaRole = "PENDING" | "WAITING_APPROVAL" | "ADMIN" | "BIDDER" | "AUDIENCE";
type PendingBidder = { socketId: string; userId: string; name: string };
type AuctionItem = { id: string; name: string; startingPrice: number; status: string; winnerName?: string | null; finalPrice?: number | null };

export default function LiveArenaClient({ user, roomId, roomName, isRoomAdmin, initialItems = [], initialParticipant, initialIsClosed = false, isPrivate = false }: { user: User, roomId: string, roomName: string, isRoomAdmin: boolean, initialItems?: AuctionItem[], initialParticipant?: any, initialIsClosed?: boolean, isPrivate?: boolean }) {
  const router = useRouter();
  
  const determineInitialRole = (): ArenaRole => {
    if (isRoomAdmin) return "ADMIN";
    if (initialParticipant?.status === "APPROVED") return "BIDDER";
    if (initialParticipant?.status === "PENDING") return "WAITING_APPROVAL";
    return "PENDING";
  };

  const [arenaRole, setArenaRole] = useState<ArenaRole>(determineInitialRole());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRoomClosed, setIsRoomClosed] = useState(initialIsClosed);
  
  const [isLocked, setIsLocked] = useState(isPrivate && !isRoomAdmin && initialParticipant?.status !== 'APPROVED' && initialParticipant?.status !== 'PENDING');
  const [roomPassword, setRoomPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const [userPurse, setUserPurse] = useState<number>(initialParticipant?.purse || 0);

  const [activeItemName, setActiveItemName] = useState<string>("Waiting for Admin...");
  const [activeItemId, setActiveItemId] = useState<string>("");
  const [highestBid, setHighestBid] = useState(0);
  const [highestBidderName, setHighestBidderName] = useState("None");
  const [timeLeft, setTimeLeft] = useState<number | "Waiting..." | "SOLD!">("Waiting...");
  const [bidAmount, setBidAmount] = useState<number | "">("");
  const [isAuctionRunning, setIsAuctionRunning] = useState<boolean>(false);
  
  const [auctionDuration, setAuctionDuration] = useState<number>(15);
  const [pendingRequests, setPendingRequests] = useState<PendingBidder[]>([]);
  
  const [itemPool, setItemPool] = useState<AuctionItem[]>(initialItems.filter(i => i.status === "QUEUED"));
  const [soldItems, setSoldItems] = useState<AuctionItem[]>(initialItems.filter(i => i.status === "SOLD"));
  const [unsoldItems, setUnsoldItems] = useState<AuctionItem[]>(initialItems.filter(i => i.status === "UNSOLD"));
  
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState<number | "">("");
  const [purseInputs, setPurseInputs] = useState<Record<string, number>>({});

  // 🔥 NEW: Refs and State for the Bid Freeze & Copy Room ID
  const prevBidRef = useRef(0);
  const isInitialSync = useRef(true);
  const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [freezeData, setFreezeData] = useState<{name: string, amount: number} | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyRoomId = () => {
    const textArea = document.createElement("textarea");
    textArea.value = roomId;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
    document.body.removeChild(textArea);
  };

  useEffect(() => {
    if (isLocked) return;

    const socketInstance = io("http://localhost:3001");
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      socketInstance.emit("join-room", roomId, user.id); 
    });

    socketInstance.on("disconnect", () => setIsConnected(false));

    socketInstance.on("stage-updated", (roomState) => {
      if (roomState.activeItemName) setActiveItemName(roomState.activeItemName);
      if (roomState.activeItemId) setActiveItemId(roomState.activeItemId);
      setHighestBid(roomState.currentHighestBid);
      setHighestBidderName(roomState.highestBidderName);
      if (roomState.timeLeft !== undefined) setTimeLeft(roomState.timeLeft);
      setIsAuctionRunning(roomState.isAuctionRunning || false);

      // 🔥 NEW: Trigger the 2-second Freeze Screen on new higher bids!
      if (isInitialSync.current) {
        prevBidRef.current = roomState.currentHighestBid;
        isInitialSync.current = false;
      } else {
        if (roomState.currentHighestBid > prevBidRef.current && roomState.highestBidderName !== "None") {
          setFreezeData({ name: roomState.highestBidderName, amount: roomState.currentHighestBid });
          if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);
          freezeTimeoutRef.current = setTimeout(() => setFreezeData(null), 2000);
        }
        prevBidRef.current = roomState.currentHighestBid;
      }
    });

    socketInstance.on("auction-started", () => setIsAuctionRunning(true));
    socketInstance.on("timer-tick", (data) => setTimeLeft(data.timeLeft));

    socketInstance.on("auction-ended", (data) => {
      setTimeLeft("SOLD!");
      setIsAuctionRunning(false);
    });

    socketInstance.on("item-sold", (data: { item: AuctionItem, newPurseForWinner: string }) => {
      setSoldItems(prev => [data.item, ...prev]);
      if (data.newPurseForWinner === user.id) setUserPurse(prev => prev - (data.item.finalPrice || 0));
    });

    socketInstance.on("item-unsold", (data: { item: AuctionItem }) => {
      setUnsoldItems(prev => [data.item, ...prev]);
    });

    socketInstance.on("new-bidder-request", (request: PendingBidder) => {
      if (isRoomAdmin) setPendingRequests((prev) => [...prev, request]);
    });

    socketInstance.on("item-added-to-pool", (item: AuctionItem) => setItemPool((prev) => [...prev, item]));

    socketInstance.on("bidder-approval-result", (data: { approved: boolean, purse: number }) => {
      if (data.approved) {
        setArenaRole("BIDDER");
        setUserPurse(data.purse);
      } else {
        setArenaRole("AUDIENCE");
      }
    });

    socketInstance.on("room-closed", () => setIsRoomClosed(true));
    socketInstance.on("bid-error", (error) => alert("❌ " + error.message));

    return () => { socketInstance.disconnect(); };
  }, [roomId, isRoomAdmin, user.id, isLocked]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true); setPasswordError("");
    try {
      const res = await fetch(`http://localhost:3001/api/rooms/${roomId}/verify-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: roomPassword })
      });
      if (res.ok) setIsLocked(false);
      else setPasswordError("Incorrect password. Please try again.");
    } catch (err) { setPasswordError("Server error verifying password."); }
    setIsVerifying(false);
  };

  const requestBidderAccess = () => {
    setArenaRole("WAITING_APPROVAL");
    if (socket) socket.emit("request-bid-access", { roomId, userId: user.id, name: user.email?.split('@')[0] });
  };

  const executeBid = (amount: number) => {
    if (!socket || arenaRole !== "BIDDER" || !activeItemId) return;
    if (amount <= highestBid) return alert(`Bid must be higher than $${highestBid.toLocaleString()}`);
    if (amount > userPurse) return alert(`Insufficient funds! Your purse is $${userPurse.toLocaleString()}`);
    
    socket.emit("place-bid", { roomId, userId: user.id, userName: user.email?.split('@')[0], amount, itemId: activeItemId });
  };

  const placeBid = () => {
    if (!bidAmount) return;
    executeBid(Number(bidAmount));
    setBidAmount("");
  };

  const resolveRequest = (socketId: string, userId: string, approved: boolean) => {
    if (!socket) return;
    const purse = purseInputs[socketId] || 1000;
    socket.emit("resolve-bidder", { roomId, targetSocketId: socketId, userId, approved, purse });
    setPendingRequests(prev => prev.filter(req => req.socketId !== socketId));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newItemName || !newItemPrice) return;
    socket.emit("add-item-to-pool", { roomId, name: newItemName, startingPrice: Number(newItemPrice) });
    setNewItemName(""); setNewItemPrice("");
  };

  const pushItemToStage = (item: AuctionItem) => {
    if (!socket) return;
    socket.emit("push-to-stage", { roomId, itemId: item.id, name: item.name, startingPrice: item.startingPrice, duration: auctionDuration });
    setItemPool(prev => prev.filter(i => i.id !== item.id));
    setUnsoldItems(prev => prev.filter(i => i.id !== item.id));
  };

  const startClock = () => { if (socket) socket.emit("start-clock", { roomId }); };

  const closeRoom = () => {
    if (window.confirm("Are you sure? This will end the auction and finalize the audit log.")) {
      if (socket) socket.emit("close-room", { roomId });
    }
  };

  // ==========================================
  // UI RENDERING - FAANG GRADE POLISH
  // ==========================================

  if (isRoomClosed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-[2rem] shadow-2xl max-w-lg w-full">
          <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl drop-shadow-lg">🔨</span>
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight text-white">Auction Concluded</h1>
          <p className="text-slate-400 mb-8">This trading floor has been permanently closed. The audit log has been finalized.</p>
          <button onClick={() => router.push('/dashboard')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl p-10 rounded-[2rem] border border-slate-800 shadow-2xl text-center relative z-10">
          <div className="bg-indigo-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">Encrypted Session</h2>
          <h1 className="text-3xl font-black text-white mb-6 tracking-tight truncate">{roomName}</h1>
          <p className="text-slate-400 mb-8 text-sm">Security clearance required to view this trading floor.</p>

          {passwordError && <p className="text-rose-400 text-sm font-bold mb-4 bg-rose-500/10 border border-rose-500/20 py-2 rounded-lg">{passwordError}</p>}

          <form onSubmit={handleUnlock} className="space-y-4">
            <input type="password" placeholder="Enter Encryption Key..." value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-4 text-center text-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-white placeholder-slate-600" required />
            <button type="submit" disabled={isVerifying} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] active:scale-[0.98]">
              {isVerifying ? "Verifying Hash..." : "Unlock Floor"}
            </button>
          </form>
          <button onClick={() => router.push('/dashboard')} className="mt-8 text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors">← Abort Connection</button>
        </div>
      </div>
    );
  }

  if (arenaRole === "PENDING") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 p-10 rounded-[2rem] border border-slate-800 shadow-2xl text-center">
          <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">Connection Established</h2>
          <h1 className="text-3xl font-black text-white mb-8 tracking-tight truncate">{roomName}</h1>
          <div className="space-y-4">
            <button onClick={requestBidderAccess} className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
              Request Trading Privileges
            </button>
            <button onClick={() => setArenaRole("AUDIENCE")} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
              Enter as Spectator
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (arenaRole === "WAITING_APPROVAL") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-8"></div>
        <h2 className="text-2xl font-black mb-3 tracking-tight text-white">Awaiting Clearances...</h2>
        <p className="text-slate-400">The floor administrator is verifying your credentials.</p>
      </div>
    );
  }

  // --- THE MAIN TRADING TERMINAL ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 flex flex-col">
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${isConnected ? 'bg-emerald-400 text-emerald-400' : 'bg-rose-500 text-rose-500 animate-pulse'}`}></div>
            <h1 className="text-xl font-black text-white tracking-widest uppercase">{roomName}</h1>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono text-xs px-2 py-1 bg-slate-800 rounded-md border border-slate-700">{roomId}</span>
              <button onClick={handleCopyRoomId} className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-7 h-7 rounded-md border border-slate-700 transition-colors flex items-center justify-center text-xs" title="Copy Room ID">
                {copied ? "✅" : "📋"}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-xs font-black text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 uppercase tracking-widest">{arenaRole}</span>
            {arenaRole === "BIDDER" && (
              <span className="text-sm font-mono font-bold text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-lg border border-emerald-500/20">
                PURSE: ${userPurse.toLocaleString()}
              </span>
            )}
            {isRoomAdmin && (
              <button onClick={closeRoom} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors">
                END SESSION
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: The Main Stage (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Subtle glow behind the stage */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/10 blur-[80px] pointer-events-none"></div>

            <div className="text-center mb-12 flex-1 flex flex-col justify-center relative z-10">
              <p className="text-slate-500 uppercase tracking-widest text-xs font-black mb-4">Current Asset</p>
              <h2 className="text-4xl md:text-6xl font-black mb-8 text-white tracking-tight drop-shadow-lg">
                {activeItemName}
              </h2>
              <div>
                <div className={`text-4xl font-black py-4 px-10 rounded-2xl inline-block shadow-inner backdrop-blur-md ${timeLeft === "SOLD!" ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-950/80 text-white border border-slate-700 font-mono tracking-tight'}`}>
                  {typeof timeLeft === "number" ? `00:${timeLeft.toString().padStart(2, '0')}` : timeLeft}
                </div>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-3xl p-8 text-center border border-slate-800 mb-8 relative">
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-3">Market Price</p>
              <p className="text-7xl font-black text-emerald-400 mb-4 tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.3)] font-mono">
                ${highestBid.toLocaleString()}
              </p>
              <p className="text-slate-400 text-sm font-medium">
                Held by: <span className="text-white font-bold bg-white/5 px-3 py-1 rounded-lg ml-1 border border-white/10">{highestBidderName}</span>
              </p>
            </div>

            {arenaRole === "BIDDER" && (
              <div className="flex flex-col gap-4 mt-2">
                
                {/* 🔥 NEW: Quick Bid Buttons (+1%, +5%, +10%, +20%, +30%, +100%) */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[1, 5, 10, 20, 30, 100].map(pct => {
                    const quickBidAmount = Math.ceil(highestBid * (1 + pct / 100));
                    const canAfford = quickBidAmount <= userPurse;
                    const isDisabled = timeLeft === "SOLD!" || typeof timeLeft === "string" || !activeItemId || !isAuctionRunning || !canAfford || freezeData !== null;
                    
                    return (
                      <button
                        key={pct}
                        onClick={() => executeBid(quickBidAmount)}
                        disabled={isDisabled}
                        className={`py-2 rounded-xl font-bold text-xs md:text-sm transition-all border ${
                          isDisabled 
                          ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' 
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 hover:border-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.1)] active:scale-95'
                        }`}
                        title={canAfford ? `Bid $${quickBidAmount.toLocaleString()}` : 'Insufficient Purse'}
                      >
                        +{pct}%
                      </button>
                    );
                  })}
                </div>

                {/* Manual Bid Input */}
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-2xl">$</span>
                    <input
                      type="number" value={bidAmount} onChange={(e) => setBidAmount(Number(e.target.value) || "")}
                      placeholder={`Max: ${userPurse.toLocaleString()}`}
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-5 pl-12 pr-4 text-2xl font-black text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder-slate-600 outline-none font-mono"
                    />
                  </div>
                  <button
                    onClick={placeBid}
                    disabled={timeLeft === "SOLD!" || typeof timeLeft === "string" || !activeItemId || !isAuctionRunning || bidAmount > userPurse || !bidAmount || freezeData !== null}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-transparent border-b-4 border-emerald-700 text-slate-950 px-10 py-5 rounded-2xl font-black text-2xl transition-all active:border-b-0 active:translate-y-1 shadow-[0_0_20px_rgba(52,211,153,0.2)] disabled:shadow-none"
                  > BID </button>
                </div>
              </div>
            )}
          </div>

          {/* HISTORY LOG (Visible to everyone) */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl h-64 flex flex-col">
            <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest"><span className="text-emerald-400">●</span> Settled Assets</h3>
            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
              {soldItems.length === 0 ? <p className="text-slate-600 text-sm italic">No trades settled yet.</p> : 
                soldItems.map(item => (
                  <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center group hover:border-slate-600 transition-colors">
                    <div>
                      <p className="font-bold text-sm text-slate-200">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Acquired by <span className="text-slate-300">{item.winnerName}</span></p>
                    </div>
                    <span className="text-emerald-400 font-mono font-bold tracking-tight">${item.finalPrice?.toLocaleString()}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Admin Terminal (4 cols) */}
        {arenaRole === "ADMIN" && (
          <div className="lg:col-span-4 space-y-6 flex flex-col h-full">
            
            {/* Access Requests */}
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-[2rem] p-6 shadow-xl">
              <h3 className="text-indigo-400 font-bold mb-4 flex justify-between items-center text-sm uppercase tracking-widest">
                <span>Clearance Queue</span>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-1 rounded-md border border-indigo-500/30">{pendingRequests.length}</span>
              </h3>
              <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {pendingRequests.length === 0 ? <p className="text-indigo-500/50 text-sm italic">Queue is clear.</p> : 
                  pendingRequests.map(req => (
                    <div key={req.socketId} className="bg-slate-950/80 border border-indigo-500/20 rounded-xl p-3">
                      <span className="text-sm font-bold text-slate-200 block mb-3 truncate">{req.name}</span>
                      <div className="flex gap-2">
                        <input type="number" placeholder="Purse $" onChange={e => setPurseInputs(prev => ({...prev, [req.socketId]: Number(e.target.value)}))} className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg text-xs p-2 text-white focus:border-indigo-500 outline-none font-mono" />
                        <button onClick={() => resolveRequest(req.socketId, req.userId, true)} className="flex-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-colors">GRANT</button>
                        <button onClick={() => resolveRequest(req.socketId, req.userId, false)} className="w-10 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center transition-colors">✕</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Inventory Terminal */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl flex-1 flex flex-col">
              <h3 className="text-slate-300 font-bold mb-4 text-sm uppercase tracking-widest">Asset Manager</h3>
              
              <form onSubmit={handleAddItem} className="mb-6 space-y-3 p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                <input type="text" placeholder="Asset Name" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none text-white placeholder-slate-600" required />
                <div className="flex gap-2">
                  <div className="relative w-1/2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</span>
                    <input type="number" placeholder="Price" value={newItemPrice} onChange={e => setNewItemPrice(Number(e.target.value) || "")} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-7 text-sm focus:border-indigo-500 outline-none text-white placeholder-slate-600 font-mono" required />
                  </div>
                  <button type="submit" className="w-1/2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors">QUEUE +</button>
                </div>
              </form>
              
              <h4 className="text-xs font-black text-slate-500 border-b border-slate-800 pb-2 mb-3 uppercase tracking-widest">Pending Assets</h4>
              <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[100px]">
                {itemPool.length === 0 ? <p className="text-slate-600 text-sm italic">No assets queued.</p> : 
                  itemPool.map(item => (
                    <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 group hover:border-slate-600 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-slate-300 truncate pr-2">{item.name}</span>
                        <span className="text-emerald-400 font-mono text-xs font-bold">${item.startingPrice.toLocaleString()}</span>
                      </div>
                      <button onClick={() => pushItemToStage(item)} className="w-full bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/20 rounded-lg py-1.5 text-xs font-bold transition-colors uppercase tracking-wider">Deploy to Stage</button>
                    </div>
                  ))
                }
              </div>

              {/* Unsold Assets */}
              {unsoldItems.length > 0 && (
                <>
                  <h4 className="text-xs font-black text-rose-400/70 border-b border-slate-800 pb-2 mb-3 mt-4 uppercase tracking-widest">Passed Assets</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {unsoldItems.map(item => (
                      <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium truncate text-slate-500 line-through pr-2">{item.name}</span>
                          <span className="text-slate-600 font-mono text-xs">${item.startingPrice.toLocaleString()}</span>
                        </div>
                        <button onClick={() => pushItemToStage(item)} className="w-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 rounded-lg py-1.5 text-xs font-bold transition-colors uppercase tracking-wider">
                          Recycle Asset ♻️
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trading Clock Control */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl">
              <div className="flex gap-3">
                <div className="relative w-1/3">
                  <input type="number" value={auctionDuration} onChange={(e) => setAuctionDuration(Number(e.target.value) || 15)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-center font-mono focus:outline-none focus:border-indigo-500 text-white" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">SEC</span>
                </div>
                <button onClick={startClock} disabled={!activeItemId || timeLeft === "SOLD!" || isAuctionRunning} className="w-2/3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-transparent border-b-4 border-emerald-700 text-slate-950 rounded-xl font-black transition-all active:border-b-0 active:translate-y-1 text-sm tracking-wider shadow-[0_0_15px_rgba(52,211,153,0.2)] disabled:shadow-none">
                  {isAuctionRunning ? "CLOCK ACTIVE..." : "START TRADING ▶"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 🔥 NEW: The Full-Screen Bid Freeze Overlay */}
      {freezeData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md transition-opacity duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 p-12 md:p-20 rounded-[3rem] shadow-[0_0_100px_rgba(52,211,153,0.2)] text-center transform scale-100 transition-transform duration-300">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <span className="text-5xl animate-pulse">🔥</span>
            </div>
            <p className="text-emerald-400 font-black tracking-widest uppercase mb-4 text-lg md:text-xl">New Highest Bid</p>
            <h2 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tight truncate max-w-[80vw]">{freezeData.name}</h2>
            <div className="text-7xl md:text-9xl font-mono font-black text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]">
              ${freezeData.amount.toLocaleString()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}