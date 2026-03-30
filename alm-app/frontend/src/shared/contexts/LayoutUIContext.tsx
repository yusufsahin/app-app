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
