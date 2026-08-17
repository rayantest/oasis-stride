import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useT } from "./i18n";

const STORAGE_KEY = "revertv_vacation";

type Ctx = {
  vacation: boolean;
  setVacation: (v: boolean) => void;
  /** Returns true and shows a toast when the action is blocked. */
  blocked: () => boolean;
};

const VacationContext = createContext<Ctx | null>(null);

export function VacationProvider({ children }: { children: ReactNode }) {
  const [vacation, setVacationState] = useState(false);

  useEffect(() => {
    try {
      setVacationState(localStorage.getItem(STORAGE_KEY) === "on");
    } catch {
      /* ignore */
    }
  }, []);

  const setVacation = useCallback((v: boolean) => {
    setVacationState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      vacation,
      setVacation,
      blocked: () => {
        if (!vacation) return false;
        toast("Vacation mode is on — enjoy it.");
        return true;
      },
    }),
    [vacation, setVacation],
  );

  return <VacationContext.Provider value={value}>{children}</VacationContext.Provider>;
}

export function useVacation() {
  const ctx = useContext(VacationContext);
  if (!ctx) return { vacation: false, setVacation: () => {}, blocked: () => false } as Ctx;
  return ctx;
}

/** Bottom-of-page toggle. */
export function VacationSwitch() {
  const t = useT();
  const { vacation, setVacation } = useVacation();

  const onToggle = () => {
    if (vacation) {
      setVacation(false);
      toast.success(t("Welcome back — tracking is on again."));
      return;
    }
    setVacation(true);
    toast.success(t("Vacation mode on. Enjoy — nothing to log."));
  };

  return (
    <div className="vacation-allow flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/50 bg-secondary/40">
      <div className="flex-1">
        <div className="text-sm font-medium flex items-center gap-1.5">
          {t("Vacation mode")}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
          {t("Pause all logging and editing. Your data stays exactly as it is — enjoy your break, unlock whenever you want.")}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={vacation}
        aria-label={t("Vacation mode")}
        onClick={onToggle}
        className="relative w-12 h-7 rounded-full transition-colors shrink-0"
        style={{ background: vacation ? "var(--sand)" : "var(--border)" }}
      >
        <span
          className="absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-all"
          style={{ insetInlineStart: vacation ? "1.5rem" : "0.25rem" }}
        />
      </button>
    </div>
  );
}

/** Sticky banner shown while vacation mode is active. */
export function VacationBanner() {
  const t = useT();
  const { vacation, setVacation } = useVacation();
  if (!vacation) return null;
  return (
    <div className="vacation-allow mx-auto max-w-xl px-5 pt-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-sand/40 bg-sand/10">
        <p className="text-xs flex-1 leading-relaxed">
          {t("Vacation mode — enjoy it. Nothing to log, nothing to catch up on.")}
        </p>
        <button
          type="button"
          onClick={() => {
            setVacation(false);
            toast.success(t("Welcome back — tracking is on again."));
          }}
          className="px-3 py-1.5 rounded-full bg-sand/20 border border-sand/40 text-sand text-xs font-semibold shrink-0"
        >
          {t("Unlock")}
        </button>
      </div>
    </div>
  );
}
