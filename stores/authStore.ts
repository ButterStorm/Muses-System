import { create } from 'zustand';
import { supabase, User } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false
    });
  },

  signIn: async (email, password) => {
    try {
      console.log('Attempting signin with:', { email, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Signin error:', error);
        return { error: error.message };
      }

      if (data.user) {
        set({
          user: data.user as User,
          isAuthenticated: true,
          isLoading: false
        });
      }
      return { error: null };
    } catch (err: any) {
      console.error('Signin exception:', err);
      return { error: err?.message || '登录失败，请检查网络连接' };
    }
  },

  signUp: async (email, password) => {
    try {
      console.log('Attempting signup with:', { email, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        }
      });

      if (error) {
        console.error('Signup error:', error);
        if (error.message?.includes('rate limit')) {
          return { error: '注册太频繁，请稍后再试。或者请联系管理员在后台手动确认您的账户。' };
        }
        return { error: error.message };
      }

      // 检查是否需要邮箱验证
      if (data.user && !data.session) {
        // 需要邮箱验证
        return { error: null, needsConfirmation: true };
      }

      if (data.user && data.session) {
        // 不需要验证或已验证，直接登录
        set({
          user: data.user as User,
          isAuthenticated: true,
          isLoading: false
        });
      }
      return { error: null };
    } catch (err: any) {
      console.error('Signup exception:', err);
      if (err.message?.includes('fetch')) {
        return { error: '无法连接到服务器，请检查：1. 是否开启 VPN/代理 2. 是否被广告拦截插件阻止 3. 网络连接是否正常' };
      }
      return { error: err?.message || '注册失败，请检查网络连接' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false
    });
  },

  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({
          user: session.user as User,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
      }

      // 监听登录状态变化
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          set({
            user: session.user as User,
            isAuthenticated: true,
            isLoading: false
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      });
    } catch (err) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },
}));
