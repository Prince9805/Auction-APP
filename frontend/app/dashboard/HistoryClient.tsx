"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type SoldItem = { name: string; winnerName: string; finalPrice: number };
type UnsoldItem = { name: string; startingPrice: number };

type HistoryItem = {
  id: string;
  roomName: string;
  role: string;
  status: string;
  isActive: boolean;
  soldItems: SoldItem[];
  unsoldItems: UnsoldItem[];
  purse: number | null;
};

export default function HistoryClient({ userHistory }: { userHistory: HistoryItem[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleRowClick = (hist: HistoryItem) => {
    if (hist.isActive) {
      router.push(`/arena/${hist.id}`);
    } else {
      setExpanded(expanded === hist.id ? null : hist.id);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900 mb-4">Your History & Receipts</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-500">
          <thead className="bg-gray-50 text-gray-700 uppercase">
            <tr>
              <th className="px-6 py-4">Auction Room</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {userHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                  No history found. Create a room or join one to get started!
                </td>
              </tr>
            ) : (
              userHistory.map((hist) => (
                <React.Fragment key={hist.id}>
                  <tr 
                    onClick={() => handleRowClick(hist)}
                    className="border-b hover:bg-indigo-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">{hist.roomName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        hist.role === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 
                        hist.role === 'Bidder' ? 'bg-green-100 text-green-700' : 
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {hist.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${
                        hist.status.startsWith('WON') ? 'text-green-600' : 
                        hist.status === 'Ended' ? 'text-gray-400' : 
                        'text-indigo-500'
                      }`}>
                        {hist.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {hist.isActive ? (
                         <span className="text-indigo-600 font-bold group-hover:underline">Rejoin ⚡</span>
                       ) : (
                         <span className="text-gray-500 font-bold">{expanded === hist.id ? 'Close ▴' : 'View Receipt ▾'}</span>
                       )}
                    </td>
                  </tr>

                  {/* EXPANDED RECEIPT VIEW */}
                  {expanded === hist.id && !hist.isActive && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={4} className="px-8 py-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-inner">
                          <h4 className="font-black text-gray-900 mb-4 border-b pb-2 flex justify-between items-center">
                            <span>📜 Final Audit Log</span>
                            {hist.role === "Bidder" && hist.purse !== null && (
                              <span className="text-green-600 bg-green-100 px-3 py-1 rounded-full text-xs">
                                Remaining Purse: ${hist.purse.toLocaleString()}
                              </span>
                            )}
                          </h4>
                          
                          {/* Sold Items Section */}
                          <div className="mb-4">
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sold Items</h5>
                            {!hist.soldItems || hist.soldItems.length === 0 ? (
                              <p className="text-gray-400 text-sm italic">No items were successfully sold.</p>
                            ) : (
                              <ul className="space-y-3">
                                {hist.soldItems.map((item, idx) => (
                                  <li key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                    <span className="font-medium text-gray-700">{item.name}</span>
                                    <div className="text-right">
                                      <span className="text-gray-500 text-xs mr-3 bg-gray-100 px-2 py-1 rounded">Won by {item.winnerName || "Unknown"}</span>
                                      <span className="font-bold text-green-600">${item.finalPrice?.toLocaleString()}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Unsold Items Section */}
                          {hist.unsoldItems && hist.unsoldItems.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Unsold (Passed)</h5>
                              <ul className="space-y-3">
                                {hist.unsoldItems.map((item, idx) => (
                                  <li key={idx} className="flex justify-between items-center text-sm border-b border-red-50 pb-2 last:border-0 last:pb-0">
                                    <span className="text-gray-500 line-through">{item.name}</span>
                                    <span className="text-gray-400 text-xs bg-red-50 px-2 py-1 rounded border border-red-100">No bids at ${item.startingPrice}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}