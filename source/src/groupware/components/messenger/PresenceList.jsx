import React, { useState, useRef, useEffect } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { useAuth } from '../../context/AuthContext';

export default function PresenceList({ onUserClick }) {
  const { onlineUsers } = usePresence();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 transition-colors"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
        <span className="text-sm font-medium text-gray-700">
          현재접속자 {onlineUsers.length}명
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              접속자 명단
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {onlineUsers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                접속자가 없습니다.
              </div>
            ) : (
              onlineUsers.map((ou) => {
                const isMe = ou.user_id === user?.id;
                return (
                  <button
                    key={ou.user_id}
                    onClick={() => {
                      if (!isMe) {
                        onUserClick(ou);
                        setIsOpen(false);
                      }
                    }}
                    disabled={isMe}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between
                      ${isMe ? 'bg-blue-50/50 cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className={`font-medium ${isMe ? 'text-blue-700' : 'text-gray-700'}`}>
                        {ou.name} {isMe && '(나)'}
                      </span>
                    </div>
                    {ou.department && (
                      <span className="text-xs text-gray-400">{ou.department}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
