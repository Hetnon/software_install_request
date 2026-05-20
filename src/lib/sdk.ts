import { useEffect, useState } from "react";
import { setConfig, getContext } from "@microsoft/power-apps/app";
import type { IContext, IConfig } from "@microsoft/power-apps/app";

export type SdkUser = IContext["user"];

export type SdkState =
  | { status: "initializing" }
  | { status: "ready"; context: IContext }
  | { status: "error"; error: Error };

let contextPromise: Promise<IContext> | null = null;

function getContextOnce(): Promise<IContext> {
  if (!contextPromise) {
    contextPromise = getContext();
  }
  return contextPromise;
}

export function initSdk(config: IConfig = {}): void {
  setConfig(config);
}

export function usePowerAppsContext(): SdkState {
  const [state, setState] = useState<SdkState>({ status: "initializing" });

  useEffect(() => {
    let cancelled = false;
    getContextOnce().then(
      (ctx) => {
        if (!cancelled) setState({ status: "ready", context: ctx });
      },
      (err) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          setState({ status: "error", error });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
