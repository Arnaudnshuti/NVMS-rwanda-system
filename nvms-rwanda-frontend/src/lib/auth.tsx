import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DemoUser, UserRole } from "./mock-data";
import { apiFetchJson, setAccessToken, getAccessToken } from "./nvms-api";
import { mapApiUserToDemoUser } from "./api-user-map";

export const AUTH_REFRESH_EVENT = "nvms-auth-refresh";

interface RegisterPayload {
  name: string;
  email: string;
  district?: string;
  districtId?: string;
  phone: string;
  password: string;
  contactPreference: "email" | "sms" | "both";
  dateOfBirth?: string;
  profession?: string;
  educationLevel?: string;
}

interface RegisterOptions {
  /** If true, signs the user in immediately. Default false: volunteer waits for coordinator approval, then signs in at /login. */
  signIn?: boolean;
}

export type AuthenticateOk = { ok: true; user: DemoUser };
export type AuthenticateFail = { ok: false; error: string };
export type LoginResult = { ok: boolean; error?: string; user?: DemoUser; mustChangePassword?: boolean };

interface AuthContextValue {
  user: DemoUser | null;
  authenticateWithPassword: (email: string, password: string) => AuthenticateOk | AuthenticateFail;
  commitSession: (user: DemoUser) => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  register: (data: RegisterPayload, options?: RegisterOptions) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
/** Backfill fields for older API sessions. */
export function normalizeDemoUser(raw: DemoUser): DemoUser {
  if (raw.role !== "volunteer") {
    return { ...raw, verificationStatus: raw.verificationStatus ?? "verified" };
  }
  if (raw.verificationStatus) return raw;
  if (String(raw.id).startsWith("new-")) return { ...raw, verificationStatus: "pending" };
  return { ...raw, verificationStatus: "verified" };
}

function administrativeAccountStatus(_userId: string, remoteGov?: DemoUser["govStatus"]): "active" | "suspended" | "revoked" {
  if (remoteGov) return remoteGov;
  return "active";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  const commitSession = useCallback((next: DemoUser) => {
    setUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (getAccessToken()) {
      const me = await apiFetchJson<Record<string, unknown>>("/api/auth/me");
      if (!me.ok) {
        setUser(null);
        setAccessToken(null);
        return;
      }
      const mapped = normalizeDemoUser(mapApiUserToDemoUser(me.data));
      const gov = administrativeAccountStatus(mapped.id, mapped.govStatus);
      if (gov === "revoked" || gov === "suspended") {
        setUser(null);
        setAccessToken(null);
        return;
      }
      commitSession(mapped);
      return;
    }

    setUser(null);
  }, [commitSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onRefresh = () => void refreshUser();
    window.addEventListener(AUTH_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(AUTH_REFRESH_EVENT, onRefresh);
  }, [refreshUser]);

  const authenticateWithPassword: AuthContextValue["authenticateWithPassword"] = (email, password) => {
    void email;
    void password;
    return { ok: false, error: "Use login() so credentials are checked by the backend." };
  };

  const login: AuthContextValue["login"] = async (email, password) => {
    const res = await apiFetchJson<{ token: string; user: Record<string, unknown>; mustChangePassword?: boolean }>(
      "/api/auth/login",
      {
        method: "POST",
        json: { email: email.trim(), password },
      },
    );
    if (!res.ok) return { ok: false, error: res.error };
    setAccessToken(res.data.token);
    const mapped = normalizeDemoUser(mapApiUserToDemoUser(res.data.user));
    commitSession(mapped);
    return { ok: true, user: mapped, mustChangePassword: res.data.mustChangePassword === true };
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
  };

  const register: AuthContextValue["register"] = async (data, options) => {
    const res = await apiFetchJson<{ message?: string }>("/api/auth/register", {
      method: "POST",
      json: {
        name: data.name.trim(),
        email: data.email.trim(),
        district: data.district,
        districtId: data.districtId,
        phone: data.phone.trim(),
        password: data.password,
        contactPreference: data.contactPreference,
        dateOfBirth: data.dateOfBirth?.trim(),
        profession: data.profession?.trim(),
        educationLevel: data.educationLevel?.trim(),
      },
    });
    if (!res.ok) throw new Error(res.error);
    if (options?.signIn === true) {
      await login(data.email, data.password);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authenticateWithPassword,
        commitSession,
        login,
        logout,
        register,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function dashboardPathFor(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "coordinator") return "/coordinator";
  return "/volunteer";
}

export function dispatchAuthRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
}
