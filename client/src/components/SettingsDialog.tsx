import { useState } from "react";
import { MoonIcon, SunIcon } from "../design-system/icons";
import type { Theme } from "../design-system/palette";
import { AUTO_REFRESH_OPTIONS, formatAutoRefreshInterval } from "../settings/autoRefresh";
import { APP_VERSION } from "../version";
import Dialog from "./Dialog";

type Tab = "appearance" | "refresh";

const TABS: { id: Tab; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "refresh", label: "Auto refresh" },
];

interface Props {
  theme: Theme;
  autoRefreshMs: number;
  onThemeChange: (theme: Theme) => void;
  onAutoRefreshMsChange: (ms: number) => void;
  onClose: () => void;
}

export default function SettingsDialog({
  theme,
  autoRefreshMs,
  onThemeChange,
  onAutoRefreshMsChange,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("appearance");

  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="settings-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "settings-tab is-active" : "settings-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "appearance" && (
        <div className="settings-panel" role="tabpanel">
          <div className="field">
            <label id="settings-theme-label">Theme</label>
            <div className="segmented" role="group" aria-labelledby="settings-theme-label">
              <button
                type="button"
                className={theme === "light" ? "btn btn-secondary is-active" : "btn btn-secondary"}
                aria-pressed={theme === "light"}
                onClick={() => onThemeChange("light")}
              >
                <SunIcon />
                Light
              </button>
              <button
                type="button"
                className={theme === "dark" ? "btn btn-secondary is-active" : "btn btn-secondary"}
                aria-pressed={theme === "dark"}
                onClick={() => onThemeChange("dark")}
              >
                <MoonIcon />
                Dark
              </button>
            </div>
          </div>
          <p className="muted settings-hint">Saved in this browser, applied immediately.</p>
        </div>
      )}

      {tab === "refresh" && (
        <div className="settings-panel" role="tabpanel">
          <div className="field">
            <label htmlFor="settings-auto-refresh">Refresh every</label>
            <select
              id="settings-auto-refresh"
              className="input"
              value={autoRefreshMs}
              onChange={(e) => onAutoRefreshMsChange(Number(e.target.value))}
            >
              {AUTO_REFRESH_OPTIONS.map((option) => (
                <option key={option.ms} value={option.ms}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="muted settings-hint">
            How often the app fetches from remotes and reloads the graph and status on its own
            (currently every {formatAutoRefreshInterval(autoRefreshMs)}). Changes made locally still
            show up right away — those are watched, not polled — and Refresh always fetches now.
          </p>
        </div>
      )}

      <div className="dialog-actions">
        <span className="muted settings-version">minigit2 v{APP_VERSION}</span>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
