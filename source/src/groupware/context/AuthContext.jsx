import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import {
  requestPasswordReset,
  signInWithPassword,
  signOutCurrentSession,
  signUpMembership,
  updatePassword,
} from '../services/authService.js';
import { getIdentity } from '../services/membershipService.js';

const EMPTY_AUTH = Object.freeze({
  configured: false,
  loading: false,
  status: 'unconfigured',
  session: null,
  user: null,
  profile: null,
  roles: [],
  assignedRoles: [],
  activeRole: null,
  permissions: [],
  recoveryMode: false,
  error: null,
});

const AuthContext = createContext(EMPTY_AUTH);

// activeRole은 사용자가 고르는 값이 아니라 서버가 계산한 "보유 역할 중 가장 높은
// 역할"이다. 관리자 역할을 가졌다면 로그인 즉시 관리 기능을 쓸 수 있다.
function toPermissions(activeRole) {
  const permissions = [];
  if (activeRole === 'admin' || activeRole === 'super_admin') permissions.push('admin.access');
  return permissions;
}

export function AuthProvider({ children }) {
  const requestSequence = useRef(0);
  const identityCache = useRef({ key: null, identity: null, promise: null });
  const [authState, setAuthState] = useState(() => ({
    ...EMPTY_AUTH,
    configured: isSupabaseConfigured,
    loading: isSupabaseConfigured,
    status: isSupabaseConfigured ? 'loading' : 'unconfigured',
  }));

  const applySession = useCallback(async (nextSession, { force = false } = {}) => {
    if (!nextSession?.user) {
      requestSequence.current += 1;
      identityCache.current = { key: null, identity: null, promise: null };
      setAuthState((current) => ({
        ...EMPTY_AUTH,
        configured: current.configured,
        recoveryMode: current.recoveryMode,
        status: current.configured ? 'anonymous' : 'unconfigured',
      }));
      return { profile: null, roles: [], activeRole: null };
    }

    const sessionKey = `${nextSession.user.id}:${nextSession.access_token}`;
    if (!force && identityCache.current.key === sessionKey) {
      if (identityCache.current.identity) return identityCache.current.identity;
      if (identityCache.current.promise) return identityCache.current.promise;
    }

    const sequence = ++requestSequence.current;

    setAuthState((current) => ({ ...current, loading: true, session: nextSession, user: nextSession.user, error: null }));

    try {
      const identityPromise = getIdentity();
      identityCache.current = { key: sessionKey, identity: null, promise: identityPromise };
      const identity = await identityPromise;
      identityCache.current = { key: sessionKey, identity, promise: null };
      if (sequence !== requestSequence.current) return identity;
      const status = identity.profile?.employment_status === 'resigned'
        ? 'resigned'
        : identity.profile?.membership_status ?? 'profile-missing';
      setAuthState((current) => ({
        ...current,
        loading: false,
        status,
        session: nextSession,
        user: nextSession.user,
        profile: identity.profile,
        roles: identity.roles.map((role) => role.code),
        assignedRoles: identity.roles,
        activeRole: identity.activeRole,
        permissions: toPermissions(identity.activeRole),
        error: null,
      }));
      return identity;
    } catch (error) {
      if (sequence === requestSequence.current) {
        identityCache.current = { key: null, identity: null, promise: null };
        setAuthState((current) => ({
          ...current,
          loading: false,
          status: 'profile-error',
          session: nextSession,
          user: nextSession.user,
          profile: null,
          roles: [],
          assignedRoles: [],
          activeRole: null,
          permissions: [],
          error,
        }));
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setAuthState((current) => ({ ...current, loading: false, status: 'auth-error', error }));
        return;
      }
      applySession(data.session).catch(() => {});
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthState((current) => ({ ...current, recoveryMode: true }));
      }
      window.setTimeout(() => {
        if (active) applySession(nextSession).catch(() => {});
      }, 0);
    });

    initialize();

    return () => {
      active = false;
      requestSequence.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const actions = useMemo(() => ({
    async signIn(credentials) {
      const result = await signInWithPassword(credentials);
      const identity = await applySession(result.session);
      return { ...result, ...identity };
    },
    signUp: signUpMembership,
    async signOut() {
      await signOutCurrentSession();
      await applySession(null);
    },
    resetPassword: requestPasswordReset,
    async updatePassword(password) {
      const result = await updatePassword(password);
      setAuthState((current) => ({ ...current, recoveryMode: false }));
      return result;
    },
    refresh: () => applySession(authState.session, { force: true }),
  }), [applySession, authState.session]);

  const contextValue = useMemo(() => ({ ...authState, ...actions }), [actions, authState]);
  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
