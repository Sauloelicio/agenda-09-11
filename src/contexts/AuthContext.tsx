import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  ownedTenantIds: string[];
}

interface RegisterParams {
  email: string;
  password: string;
  name: string;
}

interface LoginParams {
  email: string;
  password: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

/** Traduz os erros mais comuns do Supabase Auth para mensagens acionáveis. */
const friendlyAuthError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira se o navegador não preencheu a senha sozinho e digite novamente.';
  }
  if (m.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Abra o link que enviamos (verifique também a caixa de spam).';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Este e-mail já está cadastrado. Use a opção "Entrar".';
  }
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('for security purposes')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  if (m.includes('weak password') || m.includes('password should be at least')) {
    return 'Senha muito fraca. Use pelo menos 8 caracteres, combinando letras e números.';
  }
  if (m.includes('invalid format') || m.includes('unable to validate email')) {
    return 'E-mail inválido. Confira o endereço e tente novamente.';
  }
  return message;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  membershipsLoading: boolean;
  isAuthenticated: boolean;
  isPasswordRecovery: boolean;
  authError: string | null;
  register: (params: RegisterParams) => Promise<AuthResult>;
  login: (params: LoginParams) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  reloadOwnedTenants: () => Promise<void>;
  isOwnerOf: (tenantId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toAuthUser = (user: SupabaseUser, ownedTenantIds: string[] = []): AuthUser => ({
  id: user.id,
  email: user.email ?? '',
  name: String(user.user_metadata.full_name ?? user.user_metadata.name ?? user.email ?? 'Cliente'),
  createdAt: user.created_at,
  ownedTenantIds,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const activeSessionUserId = useRef<string | null>(null);

  const loadOwnedTenants = useCallback(async (supabaseUser: SupabaseUser) => {
    setMembershipsLoading(true);
    const { data, error } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', supabaseUser.id)
      .eq('role', 'owner');

    if (error) {
      console.error('Unable to load account workspaces:', error.message);
      setAuthError('Não foi possível carregar suas agendas. Atualize a página para tentar novamente.');
      setMembershipsLoading(false);
      return;
    }

    setUser((current) => current?.id === supabaseUser.id
      ? toAuthUser(supabaseUser, data.map((membership) => membership.tenant_id))
      : current);
    setAuthError(null);
    setMembershipsLoading(false);
  }, []);

  const applySession = useCallback((session: Session | null) => {
    if (!session?.user) {
      activeSessionUserId.current = null;
      setUser(null);
      setIsPasswordRecovery(false);
      setAuthError(null);
      setMembershipsLoading(false);
      setIsLoading(false);
      return;
    }

    if (activeSessionUserId.current === session.user.id) {
      setUser((current) => current?.id === session.user.id
        ? toAuthUser(session.user, current.ownedTenantIds)
        : current);
      setIsLoading(false);
      return;
    }

    activeSessionUserId.current = session.user.id;
    setUser(toAuthUser(session.user));
    setAuthError(null);
    setIsLoading(false);
    setMembershipsLoading(true);
    queueMicrotask(() => { void loadOwnedTenants(session.user); });
  }, [loadOwnedTenants]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsPasswordRecovery(event === 'PASSWORD_RECOVERY');
      applySession(session);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('Unable to restore Supabase session:', error.message);
          setAuthError('Não foi possível restaurar sua sessão. Tente entrar novamente.');
          setIsLoading(false);
          return;
        }
        applySession(data.session);
      })
      .catch((error: unknown) => {
        console.error('Unable to restore Supabase session:', error);
        setAuthError('Não foi possível restaurar sua sessão. Tente entrar novamente.');
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const register = useCallback(async ({ email, password, name }: RegisterParams): Promise<AuthResult> => {
    if (!email.trim() || !password || !name.trim()) {
      return { success: false, error: 'Preencha todos os campos.' };
    }
    if (password.length < 8) {
      return { success: false, error: 'A senha precisa ter pelo menos 8 caracteres.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) return { success: false, error: friendlyAuthError(error.message) };
    return { success: true, requiresEmailConfirmation: !data.session };
  }, []);

  const login = useCallback(async ({ email, password }: LoginParams): Promise<AuthResult> => {
    if (!email.trim() || !password) {
      return { success: false, error: 'Informe e-mail e senha.' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true };
  }, []);

  const logout = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut();
    return error ? { success: false, error: error.message } : { success: true };
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!email.trim()) return { success: false, error: 'Informe seu e-mail.' };

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/login?mode=recovery`,
    });
    return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (password.length < 8) {
      return { success: false, error: 'A senha precisa ter pelo menos 8 caracteres.' };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setIsPasswordRecovery(false);
    return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true };
  }, []);

  const reloadOwnedTenants = useCallback(async () => {
    const { data: { user: activeUser }, error } = await supabase.auth.getUser();
    if (error) {
      setAuthError('Não foi possível atualizar suas agendas.');
      console.error('Unable to read current Supabase user:', error.message);
      return;
    }
    if (activeUser) await loadOwnedTenants(activeUser);
  }, [loadOwnedTenants]);

  const isOwnerOf = useCallback(
    (tenantId: string) => user?.ownedTenantIds.includes(tenantId) ?? false,
    [user]
  );

  const value = useMemo<AuthContextType>(() => ({
    user,
    isLoading,
    membershipsLoading,
    isAuthenticated: !!user,
    isPasswordRecovery,
    authError,
    register,
    login,
    logout,
    requestPasswordReset,
    updatePassword,
    reloadOwnedTenants,
    isOwnerOf,
  }), [
    user, isLoading, membershipsLoading, isPasswordRecovery, authError, register, login, logout,
    requestPasswordReset, updatePassword, reloadOwnedTenants, isOwnerOf,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
