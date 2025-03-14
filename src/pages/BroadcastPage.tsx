import { useState, useEffect } from 'react';
import NavSidebar from '../components/NavSidebar';
import BroadcastMessage from '../components/BroadcastMessage';

const BroadcastPage = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      <NavSidebar />
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Broadcast Messages</h1>
          <div className="bg-white rounded-lg shadow">
            <BroadcastMessage />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPage; 