import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import LiveArenaClient from "./LiveArenaClient";

export default async function ArenaPage({ params }: { params: any }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  } 

  const resolvedParams = await Promise.resolve(params);
  const roomId = resolvedParams.id;

  let room = null;
  let participant = null;

  try {
    const res = await fetch(`http://localhost:3001/api/rooms/${roomId}`, { cache: "no-store" });
    if (res.ok) room = await res.json();

    const partRes = await fetch(`http://localhost:3001/api/rooms/${roomId}/participant/${session.user.id}`, { cache: "no-store" });
    if (partRes.ok) participant = await partRes.json();
  } catch (err) {
    console.error("Fetch request failed entirely.");
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center flex-col gap-4">
        <h2 className="text-3xl font-bold text-red-500">Room Not Found</h2>
        <p className="text-gray-400">ID we searched for: <span className="font-mono text-white">{roomId}</span></p>
      </div>
    );
  }

  const isRoomAdmin = session.user.id === room.adminId;
  const isClosed = room.status === 'CLOSED';

  return (
    <LiveArenaClient 
      user={session.user as any} 
      roomId={roomId} 
      roomName={room.name} 
      isRoomAdmin={isRoomAdmin} 
      initialItems={room.items || []} 
      initialParticipant={participant}
      initialIsClosed={isClosed}
      isPrivate={room.isPrivate} // 🔥 NEW: Pass privacy status to the Client
    />
  );
}