import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      return;
    }

    // presence channel name
    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).map((presenceList) => presenceList[0]);
        
        // Remove duplicates and self (optional, but let's keep self for now and filter in UI if needed)
        const uniqueUsers = Array.from(new Map(users.map(u => [u.user_id, u])).values());
        
        // Sort: current user first, then alphabetically
        uniqueUsers.sort((a, b) => {
          if (a.user_id === user.id) return -1;
          if (b.user_id === user.id) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setOnlineUsers(uniqueUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
            department: user.user_metadata?.department || '',
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  return { onlineUsers };
}
