import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DemoUser, UserRole } from "./mock-data";
import { upsertRegistryUser, listAccountsForLogin } from "./account-registry";
import { getUserOverride } from "./admin-user-overrides";
import { apiFetchJson, nvmsApiEnabled, setAccessToken, getAccessToken } from "./nvms-api";
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
const STORAGE_KEY = "nvms.auth.user";

/** Backfill fields for older localStorage sessions and self-registered volunteers. */
export function normalizeDemoUser(raw: DemoUser): DemoUser {
  if (raw.role !== "volunteer") {
    return { ...raw, verificationStatus: raw.verificationStatus ?? "verified" };
  }
  if (raw.verificationStatus) return raw;
  if (String(raw.id).startsWith("new-")) return { ...raw, verificationStatus: "pending" };
  return { ...raw, verificationStatus: "verified" };
}

function administrativeAccountStatus(userId: string, remoteGov?: DemoUser["govStatus"]): "active" | "suspended" | "revoked" {
  if (remoteGov) return remoteGov;
  return getUserOverride(userId).status ?? "active";
}

function validateAccountAccess(found: DemoUser): AuthenticateOk | AuthenticateFail {
  if (found.isActive === false) {
    return { ok: false, error: "Your account is deactivated. Contact MINALOC ICT support." };
  }
  const gov = administrativeAccountStatus(found.id, found.govStatus);
  if (gov === "revoked") {
    return { ok: false, error: "Your access has been revoked. Contact MINALOC ICT support." };
  }
  if (gov === "suspended") {
    return { ok: false, error: "Your account is suspended. Contact MINALOC ICT support." };
  }

  if (found.role === "volunteer" && (found.verificationStatus ?? "pending") === "pending") {
    return {
      ok: false,
      error: "Your account is pending district approval. Sign in after your coordinator approves your registration.",
    };
  }
  if (found.role === "volunteer" && found.verificationStatus === "rejected") {
    return {
      ok: false,
      error: "Your registration was not approved. Contact your district coordinator or MINALOC.",
    };
  }
  const normalized = normalizeDemoUser(found);
  return { ok: true, user: normalized };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  const commitSession = useCallback((next: DemoUser) => {
    setUser(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const hydrateOrClear = useCallback(
    (rawUser: DemoUser) => {
      const latest = listAccountsForLogin().find(
        (u) => u.email.toLowerCase() === rawUser.email.toLowerCase(),
      );
      if (!latest) {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const gov = administrativeAccountStatus(latest.id, latest.govStatus);
      if (gov === "revoked" || gov === "suspended") {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      commitSession(normalizeDemoUser(latest));
    },
    [commitSession],
  );

  const refreshUser = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (nvmsApiEnabled() && getAccessToken()) {
      const me = await apiFetchJson<Record<string, unknown>>("/api/auth/me");
      if (!me.ok) {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        setAccessToken(null);
        return;
      }
      const mapped = normalizeDemoUser(mapApiUserToDemoUser(me.data));
      const gov = administrativeAccountStatus(mapped.id, mapped.govStatus);
      if (gov === "revoked" || gov === "suspended") {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        setAccessToken(null);
        return;
      }
      commitSession(mapped);
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const cur = JSON.parse(raw) as DemoUser;
      const latest = listAccountsForLogin().find(
        (u) => u.email.toLowerCase() === cur.email.toLowerCase(),
      );
      if (latest) {
        const gov = administrativeAccountStatus(latest.id, latest.govStatus);
        if (gov === "revoked" || gov === "suspended") {
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        commitSession(normalizeDemoUser(latest));
      }
    } catch {
      /* ignore */
    }
  }, [commitSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (nvmsApiEnabled() && getAccessToken()) {
      void refreshUser();
      return;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoUser;
        hydrateOrClear(parsed);
      } catch {
        /* ignore */
      }
    }
  }, [hydrateOrClear, refreshUser]);

  useEffect(() => {
    const onRefresh = () => void refreshUser();
    window.addEventListener(AUTH_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(AUTH_REFRESH_EVENT, onRefresh);
  }, [refreshUser]);

  const authenticateWithPassword: AuthContextValue["authenticateWithPassword"] = (email, password) => {
    const found = listAccountsForLogin().find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!found) return { ok: false, error: "Invalid email or password" };
    return validateAccountAccess(found);
  };

  const login: AuthContextValue["login"] = async (email, password) => {
    if (nvmsApiEnabled()) {
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
    }

    const found = listAccountsForLogin().find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!found) return { ok: false, error: "Invalid email or password" };
    const access = validateAccountAccess(found);
    if (!access.ok) return { ok: false, error: access.error };
    commitSession(access.user);
    return { ok: true, user: access.user };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
  };

  const register: AuthContextValue["register"] = async (data, options) => {
    if (nvmsApiEnabled()) {
      const res = await apiFetchJson<{ message?: string }>("/api/auth/register", {
        method: "POST",
        json: {
          name: data.name.trim(),
          email: data.email.trim(),
          district: data.district,
          districtId: (data as { districtId?: string }).districtId,
          phone: data.phone.trim(),
          password: data.password,
          contactPreference: data.contactPreference,
          dateOfBirth: data.dateOfBirth?.trim(),
        },
      });
      if (!res.ok) throw new Error(res.error);
      if (options?.signIn === true) {
        await login(data.email, data.password);
      }
      return;
    }

    const newUser: DemoUser = {
      id: "new-" + Date.now(),
      email: data.email.trim(),
      password: data.password,
      name: data.name.trim(),
      role: "volunteer",
      district: data.district ?? "",
      phone: data.phone.trim(),
      verificationStatus: "pending",
      contactPreference: data.contactPreference,
      dateOfBirth: data.dateOfBirth?.trim() || undefined,
    };
    upsertRegistryUser(newUser);
    if (options?.signIn === true) {
      commitSession(normalizeDemoUser(newUser));
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
