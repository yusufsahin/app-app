import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const LAYOUT_UI_STORAGE_KEY = "alm-layout-ui";
/** Legacy key: migrate once so existing sidebar preference is preserved. */
const LEGACY_SIDEBAR_KEY = "alm-sidebar-collapsed";

interface LayoutUIState {
  /** Sidebar collapsed (desktop): persisted so preference survives refresh. */
  sidebarCollapsed: boolean;
}

const defaultState: LayoutUIState = {
  sidebarCollapsed: false,
};

function readFromStorage(): LayoutUIState {
  try {
    const raw = localStorage.getItem(LAYOUT_UI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayoutUIState>;
      return {
        sidebarCollapsed:
          typeof parsed.sidebarCollapsed === "boolean"
            ? parsed.sidebarCollapsed
            : defaultState.sidebarCollapsed,
      };
    }
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_KEY);
    if (legacy === "true") {
      const state = { ...defaultState, sidebarCollapsed: true };
      writeToStorage(state);
      localStorage.removeItem(LEGACY_SIDEBAR_KEY);
      return state;
    }
    return defaultState;
  } catch {
    return defaultState;
  }
}

function writeToStorage(state: LayoutUIState): void {
  try {
    localStorage.setItem(LAYOUT_UI_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

interface LayoutUIContextValue extends LayoutUIState {
  setSidebarCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const LayoutUIContext = createContext<LayoutUIContextValue | null>(null);

interface LayoutUIProviderProps {
  children: ReactNode;
}

export function LayoutUIProvider({ children }: LayoutUIProviderProps) {
  const [state, setState] = useState<LayoutUIState>(readFromStorage);

  useEffect(() => {
    writeToStorage(state);
  }, [state]);

  const setSidebarCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setState((prev) => ({
        ...prev,
        sidebarCollapsed: typeof value === "function" ? value(prev.sidebarCollapsed) : value,
      }));
    },
    [],
  );

  const value = useMemo<LayoutUIContextValue>(
    () => ({
      ...state,
      setSidebarCollapsed,
    }),
    [state, setSidebarCollapsed],
  );

  return (
    <LayoutUIContext.Provider value={value}>
      {children}
    </LayoutUIContext.Provider>
  );
}

export function useLayoutUI(): LayoutUIContextValue {
  const ctx = useContext(LayoutUIContext);
  if (!ctx) {
    throw new Error("useLayoutUI must be used within LayoutUIProvider");
  }
  return ctx;
}
