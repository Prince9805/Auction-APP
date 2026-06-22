import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prisma from './db'; 
import { transporter } from './email';
import { generateOTP } from './utils';
import crypto from 'crypto'; // 🔥 Native Node.js library for FAANG-level security

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });



const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hashed}`;
};

const verifyPassword = (password: string, storedHash: string) => {
  const [salt, key] = storedHash.split(':');
  const hashedBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  return crypto.timingSafeEqual(hashedBuffer, keyBuffer);
};

app.post('/api/rooms/create', async (req, res) => {
  try {
    const { name, isPrivate, password, adminId } = req.body;
    const newRoom = await prisma.room.create({ data: { name, isPrivate, password, adminId, status: 'LIVE' } });
    res.status(201).json(newRoom);
  } catch (error) { res.status(500).json({ error: "Failed to create room" }); }
});

app.get('/api/rooms/public', async (req, res) => {
  try {
    const publicRooms = await prisma.room.findMany({
      where: { isPrivate: false, status: { not: 'CLOSED' } },
      include: { _count: { select: { participants: true } }, items: { where: { status: 'ACTIVE' }, take: 1 } }
    });
    res.status(200).json(publicRooms);
  } catch (error) { res.status(500).json({ error: "Failed to fetch public rooms" }); }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: { items: true } 
    });
    if (!room) return res.status(404).json({ error: "Room not found" });
    const { password, ...safeRoom } = room;
    res.status(200).json(safeRoom);
  } catch (error) { res.status(500).json({ error: "Failed to fetch room" }); }
});

app.post('/api/rooms/:roomId/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    const room = await prisma.room.findUnique({ where: { id: req.params.roomId } });
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (room.isPrivate && room.password !== password) return res.status(401).json({ error: "Incorrect password" });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: "Verification failed" }); }
});

app.get('/api/rooms/search/:roomId', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.roomId },
      select: { id: true, name: true, status: true }
    });
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.status(200).json(room);
  } catch (error) { res.status(500).json({ error: "Search failed" }); }
});

app.get('/api/rooms/:roomId/participant/:userId', async (req, res) => {
  try {
    const participant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: req.params.roomId, userId: req.params.userId } }
    });
    res.status(200).json(participant || { status: 'NONE' });
  } catch (error) { res.status(500).json({ error: "Failed to fetch participant" }); }
});

app.get('/api/users/:id/history', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const userName = user.name || user.email?.split('@')[0] || "Unknown";
    const adminRooms = await prisma.room.findMany({ where: { adminId: userId }, orderBy: { createdAt: 'desc' } });
    const participated = await prisma.roomParticipant.findMany({ where: { userId: userId }, include: { room: true }, orderBy: { joinedAt: 'desc' } });
    const roomIds = [...adminRooms.map(r => r.id), ...participated.map(p => p.roomId)];
    const allItems = await prisma.item.findMany({ where: { roomId: { in: roomIds }, status: { in: ['SOLD', 'UNSOLD'] } } });

    const historyMap = new Map();

    adminRooms.forEach(room => {
      const itemsForRoom = allItems.filter(i => i.roomId === room.id);
      historyMap.set(room.id, { 
        id: room.id, roomName: room.name, role: 'Admin', 
        status: room.status === 'CLOSED' ? 'Ended' : 'Active', isActive: room.status !== 'CLOSED',
        soldItems: itemsForRoom.filter(i => i.status === 'SOLD').map(i => ({ name: i.name, winnerName: i.winnerName, finalPrice: i.finalPrice })),
        unsoldItems: itemsForRoom.filter(i => i.status === 'UNSOLD').map(i => ({ name: i.name, startingPrice: i.startingPrice })),
        purse: null
      });
    });

    participated.forEach(p => {
      if (!historyMap.has(p.roomId)) {
        const itemsForRoom = allItems.filter(i => i.roomId === p.roomId);
        const sold = itemsForRoom.filter(i => i.status === 'SOLD');
        const wonItems = sold.filter(i => i.winnerName === userName);
        
        let displayStatus = p.room.status === 'CLOSED' ? 'Ended' : 'Active';
        if (wonItems.length > 0) displayStatus = `WON ($${wonItems.reduce((sum, item) => sum + (item.finalPrice || 0), 0)})`;

        historyMap.set(p.roomId, {
          id: p.room.id, roomName: p.room.name, 
          role: p.status === 'APPROVED' ? 'Bidder' : (p.status === 'PENDING' ? 'Waiting' : 'Audience'),
          status: displayStatus, isActive: p.room.status !== 'CLOSED',
          soldItems: sold.map(i => ({ name: i.name, winnerName: i.winnerName, finalPrice: i.finalPrice })),
          unsoldItems: itemsForRoom.filter(i => i.status === 'UNSOLD').map(i => ({ name: i.name, startingPrice: i.startingPrice })),
          purse: p.purse 
        });
      }
    });

    res.status(200).json(Array.from(historyMap.values()));
  } catch (error) { res.status(500).json({ error: "Failed to fetch history" }); }
});


app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, context } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });

    // Block Signup if they already have an account!
    if (context === 'signup' && user && user.password) {
      return res.status(400).json({ error: "Email already in use. Please log in." });
    }
    // Block Reset if account doesn't exist or uses Google!
    if (context === 'reset' && (!user || !user.password)) {
      return res.status(404).json({ error: "Account not found or uses Google Login." });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.upsert({
      where: { email },
      update: { otpCode: otp, otpExpiry: expiry },
      create: { email, otpCode: otp, otpExpiry: expiry },
    });

    await transporter.sendMail({
      from: `"Auction Engine" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Auction Security Code",
      html: `<h2>Verification Required</h2><p>Your 6-digit security code is:</p><h1>${otp}</h1>`
    });

    res.status(200).json({ message: "OTP sent successfully!" });
  } catch (error) { console.error("🚨 FATAL OTP CRASH:", error); // <--- ADD THIS LINE!
    return res.status(500).json({ error: "Internal server error" }); }
}); 

// Complete Standard Sign Up
app.post('/api/auth/register-full', async (req, res) => {
  try {
    const { email, name, password, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(401).json({ error: "Invalid or expired OTP code" });
    }

    const hashedPassword = hashPassword(password);
    
    await prisma.user.update({
      where: { email },
      data: { name, password: hashedPassword, emailVerified: new Date(), otpCode: null, otpExpiry: null },
    });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to register" }); }
});


app.post('/api/auth/verify-password-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return res.status(401).json({ error: "Account not found." });
    if (!user.password) return res.status(401).json({ error: "Please log in using Google." });
    
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    res.status(200).json({ user });
  } catch (error) { res.status(500).json({ error: "Login failed" }); }
});


app.post('/api/auth/google-login', async (req, res) => {
  try {
    const { email, name, image } = req.body;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, image },
      create: { email, name, image, emailVerified: new Date(), role: 'BIDDER' }
    });
    res.status(200).json({ user });
  } catch (error) { res.status(500).json({ error: "Google login failed" }); }
});


app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(401).json({ error: "Invalid or expired OTP code" });
    }

    const hashedPassword = hashPassword(newPassword);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, otpCode: null, otpExpiry: null },
    });
    res.status(200).json({ success: true });
  } catch (error) { res.status(500).json({ error: "Password reset failed" }); }
});


const liveAuctions: Record<string, { activeItemId?: string; activeItemName?: string; currentHighestBid: number; highestBidderId: string; highestBidderName: string; timeLeft: number; duration: number; timerId?: NodeJS.Timeout; }> = {};
const adminHeartbeats: Record<string, NodeJS.Timeout> = {};
const socketUserMap: Record<string, string> = {}; 

io.on('connection', (socket) => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    if (userId) socketUserMap[socket.id] = userId;
    if (liveAuctions[roomId]) {
      const { timerId, ...safeRoomState } = liveAuctions[roomId];
      socket.emit('stage-updated', { ...safeRoomState, isAuctionRunning: !!liveAuctions[roomId].timerId });
    }
    if (adminHeartbeats[roomId]) { clearTimeout(adminHeartbeats[roomId]); delete adminHeartbeats[roomId]; }
  });

  socket.on('disconnecting', () => {
    const userId = socketUserMap[socket.id];
    socket.rooms.forEach(async (roomId) => {
      if (roomId === socket.id) return;
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (room && userId && room.adminId === userId) {
          adminHeartbeats[roomId] = setTimeout(async () => {
            await prisma.room.update({ where: { id: roomId }, data: { status: 'CLOSED' } });
            io.to(roomId).emit('room-closed'); delete liveAuctions[roomId]; delete adminHeartbeats[roomId];
          }, 15 * 60 * 1000); 
        }
      } catch (e) {}
    });
  });

  socket.on('disconnect', () => { delete socketUserMap[socket.id]; });

  socket.on('request-bid-access', async (data: { roomId: string, userId: string, name: string }) => {
    try {
      await prisma.roomParticipant.upsert({
        where: { roomId_userId: { roomId: data.roomId, userId: data.userId } },
        update: { status: 'PENDING' }, create: { roomId: data.roomId, userId: data.userId, status: 'PENDING' }
      });
      io.to(data.roomId).emit('new-bidder-request', { socketId: socket.id, userId: data.userId, name: data.name });
    } catch(e) {}
  });

  socket.on('resolve-bidder', async (data: { roomId: string, targetSocketId: string, userId: string, approved: boolean, purse: number }) => {
    try {
      await prisma.roomParticipant.update({
        where: { roomId_userId: { roomId: data.roomId, userId: data.userId } },
        data: { status: data.approved ? 'APPROVED' : 'REJECTED', purse: data.purse }
      });
      io.to(data.targetSocketId).emit('bidder-approval-result', { approved: data.approved, purse: data.purse });
    } catch(e) {}
  });

  socket.on('add-item-to-pool', async (data: { roomId: string, name: string, startingPrice: number }) => {
    try {
      const item = await prisma.item.create({ data: { name: data.name, startingPrice: data.startingPrice, roomId: data.roomId, status: 'QUEUED' }});
      io.to(data.roomId).emit('item-added-to-pool', item);
    } catch(e) {}
  });

  socket.on('push-to-stage', async (data: { roomId: string, itemId: string, name: string, startingPrice: number, duration: number }) => {
    const oldActiveItems = await prisma.item.findMany({ where: { roomId: data.roomId, status: 'ACTIVE' } });
    await prisma.item.updateMany({ where: { roomId: data.roomId, status: 'ACTIVE' }, data: { status: 'UNSOLD' }});
    for (const oldItem of oldActiveItems) io.to(data.roomId).emit('item-unsold', { item: { ...oldItem, status: 'UNSOLD' } });
    await prisma.item.update({ where: { id: data.itemId }, data: { status: 'ACTIVE' }});
    if (liveAuctions[data.roomId]?.timerId) clearInterval(liveAuctions[data.roomId].timerId);

    liveAuctions[data.roomId] = { activeItemId: data.itemId, activeItemName: data.name, currentHighestBid: data.startingPrice, highestBidderId: "None", highestBidderName: "None", timeLeft: data.duration, duration: data.duration, timerId: undefined };
    const { timerId, ...safeRoomState } = liveAuctions[data.roomId];
    io.to(data.roomId).emit('stage-updated', { ...safeRoomState, isAuctionRunning: false });
  });

  socket.on('start-clock', (data: { roomId: string }) => {
    const roomState = liveAuctions[data.roomId];
    if (!roomState || roomState.timerId) return;
    io.to(data.roomId).emit('auction-started');

    roomState.timerId = setInterval(async () => {
      roomState.timeLeft -= 1;
      io.to(data.roomId).emit('timer-tick', { timeLeft: roomState.timeLeft });

      if (roomState.timeLeft <= 0) {
        clearInterval(roomState.timerId); roomState.timerId = undefined;
        if (roomState.highestBidderId !== "None" && roomState.activeItemId) {
          try {
            await prisma.roomParticipant.update({ where: { roomId_userId: { roomId: data.roomId, userId: roomState.highestBidderId } }, data: { purse: { decrement: roomState.currentHighestBid } }});
            const soldItem = await prisma.item.update({ where: { id: roomState.activeItemId }, data: { status: 'SOLD', winnerName: roomState.highestBidderName, finalPrice: roomState.currentHighestBid }});
            io.to(data.roomId).emit('item-sold', { item: soldItem, newPurseForWinner: roomState.highestBidderId });
          } catch(e) {}
        } else if (roomState.activeItemId) {
          try {
            const unsoldItem = await prisma.item.update({ where: { id: roomState.activeItemId }, data: { status: 'UNSOLD' }});
            io.to(data.roomId).emit('item-unsold', { item: unsoldItem });
          } catch(e) {}
        }
        io.to(data.roomId).emit('auction-ended', { winner: roomState.highestBidderName, finalPrice: roomState.currentHighestBid });
      }
    }, 1000); 
  });

  socket.on('place-bid', async (data: { roomId: string, userId: string, userName: string, amount: number, itemId: string }) => {
    const roomState = liveAuctions[data.roomId];
    if (!roomState || roomState.timeLeft <= 0) return socket.emit('bid-error', { message: "Auction is closed!" });
    if (!roomState.timerId) return socket.emit('bid-error', { message: "Clock hasn't started yet!" });
    if (data.amount <= roomState.currentHighestBid) return socket.emit('bid-error', { message: "Bid too low!" });

    const participant = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: data.roomId, userId: data.userId } }});
    if (!participant || participant.purse < data.amount) return socket.emit('bid-error', { message: `Insufficient purse! You only have $${participant?.purse || 0} left.` });

    roomState.currentHighestBid = data.amount; roomState.highestBidderId = data.userId; roomState.highestBidderName = data.userName; roomState.timeLeft = roomState.duration; 
    const { timerId, ...safeRoomState } = roomState;
    io.to(data.roomId).emit('stage-updated', { ...safeRoomState, isAuctionRunning: true });
    try { await prisma.bid.create({ data: { amount: data.amount, itemId: data.itemId, userId: data.userId } }); } catch (error) {}
  });

  socket.on('close-room', async (data: { roomId: string }) => {
    await prisma.room.update({ where: { id: data.roomId }, data: { status: 'CLOSED' } });
    if (liveAuctions[data.roomId]?.timerId) clearInterval(liveAuctions[data.roomId].timerId);
    delete liveAuctions[data.roomId];
    io.to(data.roomId).emit('room-closed');
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => { console.log(`🚀 Auction Engine running on http://localhost:${PORT}`); });