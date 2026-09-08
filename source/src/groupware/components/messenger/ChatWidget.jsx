import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';

export default function ChatWidget({ selectedUser, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 기존 메시지 로드 및 구독
  useEffect(() => {
    if (!selectedUser || !user) return;

    let subscription;

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const history = await chatService.getChatHistory(user.id, selectedUser.user_id);
        setMessages(history || []);
        scrollToBottom();

        // 읽음 처리
        const unreadIds = history
          ?.filter(m => m.receiver_id === user.id && !m.is_read)
          .map(m => m.id);
        if (unreadIds && unreadIds.length > 0) {
          await chatService.markAsRead(unreadIds);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

    // 새 메시지 구독
    subscription = chatService.subscribeToNewMessages(user.id, (newMsg) => {
      if (newMsg.sender_id === selectedUser.user_id) {
        setMessages(prev => [...prev, newMsg]);
        chatService.markAsRead([newMsg.id]); // 바로 읽음 처리
        scrollToBottom();
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [selectedUser, user]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !selectedUser) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      // Optimistic update (optional, but helps UX)
      const optimisticMsg = {
        id: 'temp-' + Date.now(),
        sender_id: user.id,
        receiver_id: selectedUser.user_id,
        content: textToSend,
        created_at: new Date().toISOString(),
        is_read: false
      };
      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();

      const savedMsg = await chatService.sendMessage(user.id, selectedUser.user_id, textToSend);
      // Replace optimistic message with actual one
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? savedMsg : m));
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
      alert('메시지 전송에 실패했습니다.');
    }
  };

  if (!selectedUser) return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-[100] overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="font-semibold text-sm">{selectedUser.name}</span>
          {selectedUser.department && (
            <span className="text-xs text-blue-200">({selectedUser.department})</span>
          )}
        </div>
        <button onClick={onClose} className="text-blue-100 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 h-80 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
        {isLoading && messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 mt-4">대화 내역을 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 mt-4">새로운 대화를 시작해보세요!</div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm
                    ${isMe 
                      ? 'bg-blue-500 text-white rounded-tr-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                    }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="flex-1 px-3 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
