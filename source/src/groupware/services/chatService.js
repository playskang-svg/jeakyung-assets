import { supabase } from '../lib/supabase';

export const chatService = {
  // 메시지 보내기
  async sendMessage(senderId, receiverId, content) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        { sender_id: senderId, receiver_id: receiverId, content }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 특정 사용자와의 대화 내역 가져오기
  async getChatHistory(currentUserId, otherUserId, limit = 50) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data;
  },

  // 메시지 읽음 처리
  async markAsRead(messageIds) {
    if (!messageIds || messageIds.length === 0) return;
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .in('id', messageIds);
    
    if (error) throw error;
  },

  // 실시간 새 메시지 구독
  subscribeToNewMessages(currentUserId, onMessageReceived) {
    return supabase
      .channel(`chat_messages:receiver_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${currentUserId}`
        },
        (payload) => {
          onMessageReceived(payload.new);
        }
      )
      .subscribe();
  }
};
