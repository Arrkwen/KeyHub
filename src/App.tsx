import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntryEditor } from "./components/EntryEditor";
import { Modal } from "./components/Modal";
import { copySecret } from "./lib/clipboard";
import {
  changeVaultMasterPassword,
  createVault,
  exportLocalVaultData,
  getVaultStatus,
  importLocalVaultData,
  listEntries,
  lockVault,
  removeEntry,
  resetVault,
  saveEntry,
  saveExportedBackup,
  setVaultPasswordHint,
  unlockVault
} from "./lib/tauri";
import type { EntryInput, VaultEntry, VaultStatus } from "./types";
import { type Locale, useI18n } from "./i18n";
import { messageKeyForSecretKind } from "./i18n/secretKind";

const autoLockStorageKey = "keyhub:auto-lock-minutes";
const clipboardStorageKey = "keyhub:clipboard-clear-seconds";
const rememberedPasswordStorageKey = "keyhub:remembered-master-password";
const rememberedPasswordDurationMs = 3 * 24 * 60 * 60 * 1000;
const themeStorageKey = "keyhub:theme";
const passwordHintMaxLength = 280;
/** 主密码固定长度（按 Unicode 码点计，与 Rust 端一致） */
const masterPasswordCharLength = 10;

type ThemeMode = "dark" | "light";

function masterPasswordCharCount(value: string): number {
  return [...value].length;
}

function isValidMasterPasswordLength(value: string): boolean {
  return masterPasswordCharCount(value) === masterPasswordCharLength;
}

function readNumberSetting(key: string, fallback: number) {
  const value = window.localStorage.getItem(key);
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getErrorMessage(reason: unknown, fallback: string) {
  if (typeof reason === "string" && reason.trim()) {
    return reason;
  }

  if (
    typeof reason === "object" &&
    reason !== null &&
    "message" in reason &&
    typeof (reason as { message?: unknown }).message === "string"
  ) {
    return (reason as { message: string }).message;
  }

  return fallback;
}

function readThemeSetting(): ThemeMode {
  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

interface RememberedPasswordRecord {
  password: string;
  expiresAt: string;
}

interface RememberedPasswordState {
  password: string | null;
  expired: boolean;
}

function loadRememberedPassword(): RememberedPasswordState {
  const raw = window.localStorage.getItem(rememberedPasswordStorageKey);
  if (!raw) {
    return { password: null, expired: false };
  }

  try {
    const parsed = JSON.parse(raw) as RememberedPasswordRecord;
    if (!parsed.password || !parsed.expiresAt) {
      window.localStorage.removeItem(rememberedPasswordStorageKey);
      return { password: null, expired: false };
    }

    const expired = Date.now() > new Date(parsed.expiresAt).getTime();
    if (expired) {
      window.localStorage.removeItem(rememberedPasswordStorageKey);
      return { password: null, expired: true };
    }

    if (!isValidMasterPasswordLength(parsed.password)) {
      window.localStorage.removeItem(rememberedPasswordStorageKey);
      return { password: null, expired: false };
    }

    return { password: parsed.password, expired: false };
  } catch {
    window.localStorage.removeItem(rememberedPasswordStorageKey);
    return { password: null, expired: false };
  }
}

function saveRememberedPassword(password: string) {
  if (!isValidMasterPasswordLength(password)) {
    clearRememberedPassword();
    return;
  }

  window.localStorage.setItem(
    rememberedPasswordStorageKey,
    JSON.stringify({
      password,
      expiresAt: new Date(Date.now() + rememberedPasswordDurationMs).toISOString()
    })
  );
}

function clearRememberedPassword() {
  window.localStorage.removeItem(rememberedPasswordStorageKey);
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  visible: boolean;
  onToggle: () => void;
  hideLabel?: boolean;
  maxLength?: number;
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  hideLabel = false,
  maxLength
}: PasswordFieldProps) {
  const { t } = useI18n();

  return (
    <label className={hideLabel ? "password-field compact-password-field" : "password-field"}>
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <div className="password-input-group">
        <input
          aria-label={label}
          type={visible ? "text" : "password"}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          aria-label={visible ? t("passwordToggle.hide", { label }) : t("passwordToggle.show", { label })}
          className="password-toggle icon-password-toggle"
          type="button"
          onClick={onToggle}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 4.5 19.5 21"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <path
                d="M10.6 6.6A10.8 10.8 0 0 1 12 6.5c5.2 0 9.1 3.5 10 5.5-.4.9-1.4 2.3-2.9 3.5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <path
                d="M14.1 14.1a3 3 0 0 1-4.2-4.2"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <path
                d="M9 18c-3.4-.9-5.8-3.3-7-6 0 0 1.7-3.9 6.1-5.4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M2 12s3.5-5.5 10-5.5S22 12 22 12s-3.5 5.5-10 5.5S2 12 2 12Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const translateRef = useRef(t);
  translateRef.current = t;

  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => readThemeSetting());

  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [masterPasswordHint, setMasterPasswordHint] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [confirmResetStep, setConfirmResetStep] = useState(false);

  const [passwordHintDraft, setPasswordHintDraft] = useState("");

  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeConfirmPassword, setChangeConfirmPassword] = useState("");

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataSyncOpen, setDataSyncOpen] = useState(false);

  const [autoLockMinutes, setAutoLockMinutes] = useState(() =>
    readNumberSetting(autoLockStorageKey, 10)
  );
  const [clipboardClearSeconds, setClipboardClearSeconds] = useState(() =>
    readNumberSetting(clipboardStorageKey, 20)
  );

  const importInputRef = useRef<HTMLInputElement | null>(null);

  function togglePasswordVisibility(key: string) {
    setShowPasswords((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  const refreshStatus = useCallback(async () => {
    const nextStatus = await getVaultStatus();
    setStatus(nextStatus);
    return nextStatus;
  }, []);

  const refreshEntries = useCallback(async () => {
    const nextEntries = await listEntries();
    setEntries(nextEntries);
    return nextEntries;
  }, []);

  const filteredEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return entries;
    }

    return entries.filter((entry) => {
      const haystack = [
        entry.platform,
        entry.account,
        entry.secret_kind,
        entry.note,
        entry.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [entries, search]);

  const editingEntry = useMemo(
    () => entries.find((entry) => entry.id === editingEntryId) ?? null,
    [entries, editingEntryId]
  );

  const secretKindLabel = useCallback(
    (kind: string) => {
      const key = messageKeyForSecretKind(kind);
      return key ? t(key) : kind;
    },
    [t]
  );

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextStatus = await getVaultStatus();
      setStatus(nextStatus);

      const remembered = loadRememberedPassword();
      setRememberPassword(Boolean(remembered.password));

      if (remembered.expired) {
        setBanner(translateRef.current("banner.autoLoginExpired"));
      }

      if (nextStatus.has_vault && remembered.password) {
        try {
          const unlockedStatus = await unlockVault(remembered.password);
          setStatus(unlockedStatus);
          setSessionPassword(remembered.password);
          await refreshEntries();
          setBanner(translateRef.current("banner.autoLoggedIn"));
        } catch (reason) {
          console.error("auto unlock failed", reason);
          clearRememberedPassword();
          setRememberPassword(false);
          setError(translateRef.current("errors.autoLoginFailed"));
          await refreshStatus();
        }
      }
    } catch (reason) {
      setError(getErrorMessage(reason, translateRef.current("errors.bootstrap")));
    } finally {
      setLoading(false);
    }
  }, [refreshEntries, refreshStatus]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    window.localStorage.setItem(autoLockStorageKey, String(autoLockMinutes));
  }, [autoLockMinutes]);

  useEffect(() => {
    window.localStorage.setItem(clipboardStorageKey, String(clipboardClearSeconds));
  }, [clipboardClearSeconds]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!banner) {
      return;
    }

    const timeoutId = window.setTimeout(() => setBanner(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [banner]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeoutId = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    if (!status?.unlocked) {
      return;
    }

    let timeoutId = 0;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void handleLock(true);
      }, autoLockMinutes * 60 * 1000);
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [autoLockMinutes, status?.unlocked]);

  useEffect(() => {
    if (settingsOpen && status?.unlocked) {
      setPasswordHintDraft(status.password_hint ?? "");
    }
  }, [settingsOpen, status?.password_hint, status?.unlocked]);

  async function handleCreateVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBanner(null);

    if (!isValidMasterPasswordLength(masterPassword)) {
      setError(
        t("errors.masterLength", {
          required: masterPasswordCharLength,
          current: masterPasswordCharCount(masterPassword)
        })
      );
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError(t("errors.masterMismatch"));
      return;
    }

    setBusy(true);
    try {
      const hint = masterPasswordHint.trim();
      const nextStatus = await createVault(masterPassword, hint || null);
      setStatus(nextStatus);
      setSessionPassword(masterPassword);
      setEntries([]);
      setEditingEntryId(null);
      setEditorOpen(false);
      setSettingsOpen(false);
      setUnlockPassword("");
      setConfirmResetStep(false);

      if (rememberPassword) {
        saveRememberedPassword(masterPassword);
      } else {
        clearRememberedPassword();
      }

      setMasterPassword("");
      setConfirmPassword("");
      setMasterPasswordHint("");
      setBanner(t("banner.vaultReady"));
    } catch (reason) {
      console.error("create vault failed", reason);
      setError(getErrorMessage(reason, t("errors.createVault")));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBanner(null);

    if (!unlockPassword.trim()) {
      setError(t("errors.enterMasterPassword"));
      return;
    }

    if (!isValidMasterPasswordLength(unlockPassword)) {
      setError(
        t("errors.masterLength", {
          required: masterPasswordCharLength,
          current: masterPasswordCharCount(unlockPassword)
        })
      );
      return;
    }

    setBusy(true);
    try {
      const nextStatus = await unlockVault(unlockPassword);
      setStatus(nextStatus);
      setSessionPassword(unlockPassword);
      await refreshEntries();

      if (rememberPassword) {
        saveRememberedPassword(unlockPassword);
      } else {
        clearRememberedPassword();
      }

      setUnlockPassword("");
      setBanner(t("banner.unlocked"));
    } catch (reason) {
      console.error("unlock vault failed", reason);
      setError(getErrorMessage(reason, t("errors.unlockFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleLock(autoLocked = false) {
    try {
      await lockVault();
      const nextStatus = await refreshStatus();
      setEntries([]);
      setSessionPassword(null);
      setEditingEntryId(null);
      setEditorOpen(false);
      setSettingsOpen(false);
      if (!nextStatus.unlocked) {
        setBanner(autoLocked ? translateRef.current("banner.lockedIdle") : translateRef.current("banner.locked"));
      }
    } catch (reason) {
      console.error("lock vault failed", reason);
      setError(getErrorMessage(reason, translateRef.current("errors.lockVault")));
    }
  }

  async function handleSaveEntry(input: EntryInput) {
    setError(null);
    try {
      const saved = await saveEntry(input);
      await refreshStatus();
      await refreshEntries();
      setEditingEntryId(saved.id);
      setEditorOpen(false);
      setBanner(t("banner.entrySaved", { name: saved.platform }));
    } catch (reason) {
      console.error("save entry failed", reason);
      setError(getErrorMessage(reason, t("errors.saveEntry")));
    }
  }

  async function handleDeleteEntry(id: string) {
    setError(null);
    try {
      await removeEntry(id);
      await refreshStatus();
      await refreshEntries();
      setEditingEntryId(null);
      setEditorOpen(false);
      setBanner(t("banner.entryRemoved"));
    } catch (reason) {
      console.error("delete entry failed", reason);
      setError(getErrorMessage(reason, t("errors.removeEntry")));
    }
  }

  async function handleCopyValue(label: string, value: string, clearAfterCopy = false) {
    try {
      await copySecret(value, clearAfterCopy ? clipboardClearSeconds : 0);
      setBanner(
        clearAfterCopy
          ? t("banner.copiedClears", { label, seconds: clipboardClearSeconds })
          : t("banner.copiedPlain", { label })
      );
    } catch (reason) {
      setError(getErrorMessage(reason, t("errors.copy")));
    }
  }

  async function handleSavePasswordHint() {
    setError(null);
    setBanner(null);
    setBusy(true);
    try {
      const nextStatus = await setVaultPasswordHint(passwordHintDraft);
      setStatus(nextStatus);
      setBanner(t("banner.hintSaved"));
    } catch (reason) {
      console.error("save password hint failed", reason);
      setError(getErrorMessage(reason, t("errors.saveHint")));
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeMasterPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBanner(null);

    if (!isValidMasterPasswordLength(changeNewPassword)) {
      setError(
        t("errors.newMasterLength", {
          required: masterPasswordCharLength,
          current: masterPasswordCharCount(changeNewPassword)
        })
      );
      return;
    }

    if (changeNewPassword !== changeConfirmPassword) {
      setError(t("errors.newMasterMismatch"));
      return;
    }

    setBusy(true);
    try {
      const nextStatus = await changeVaultMasterPassword(changeCurrentPassword, changeNewPassword);
      setStatus(nextStatus);
      setSessionPassword(changeNewPassword);
      setChangeCurrentPassword("");
      setChangeNewPassword("");
      setChangeConfirmPassword("");

      if (rememberPassword) {
        saveRememberedPassword(changeNewPassword);
      } else {
        clearRememberedPassword();
      }

      setBanner(t("banner.masterUpdated"));
    } catch (reason) {
      console.error("change master password failed", reason);
      setError(getErrorMessage(reason, t("errors.changeMaster")));
    } finally {
      setBusy(false);
    }
  }

  async function handleExportLocalData() {
    setBusy(true);
    setError(null);
    try {
      const snapshot = await exportLocalVaultData();
      const date = new Date().toISOString().slice(0, 10);
      const savedPath = await saveExportedBackup(snapshot, `keyhub-local-backup-${date}.json`);
      if (!savedPath) {
        setBanner(t("banner.exportCancelled"));
        return;
      }

      setBanner(t("banner.exportedTo", { path: savedPath }));
    } catch (reason) {
      console.error("export local data failed", reason);
      setError(getErrorMessage(reason, t("errors.export")));
    } finally {
      setBusy(false);
    }
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const snapshot = await file.text();
      await importLocalVaultData(snapshot);
      clearRememberedPassword();
      setRememberPassword(false);
      setSessionPassword(null);
      setUnlockPassword("");
      setEntries([]);
      setSessionPassword(null);
      setEditingEntryId(null);
      setEditorOpen(false);
      setSettingsOpen(false);
      setDataSyncOpen(false);
      await refreshStatus();
      setBanner(t("banner.importLoaded"));
    } catch (reason) {
      console.error("import local data failed", reason);
      setError(getErrorMessage(reason, t("errors.import")));
    } finally {
      setBusy(false);
    }
  }

  function startVaultResetFlow() {
    setConfirmResetStep(true);
    setError(null);
    setBanner(null);
  }

  function cancelVaultResetFlow() {
    setConfirmResetStep(false);
    setBanner(null);
    setError(null);
  }

  async function handleConfirmResetVault() {
    if (!confirmResetStep) {
      return;
    }

    setBusy(true);
    setError(null);
    setBanner(null);

    try {
      await resetVault();
      const nextStatus = await refreshStatus();
      setStatus(nextStatus);
      setEntries([]);
      setEditingEntryId(null);
      setEditorOpen(false);
      setSettingsOpen(false);
      setDataSyncOpen(false);
      setMasterPassword("");
      setConfirmPassword("");
      setUnlockPassword("");
      setChangeCurrentPassword("");
      setChangeNewPassword("");
      setChangeConfirmPassword("");
      setConfirmResetStep(false);
      clearRememberedPassword();
      setRememberPassword(false);
      setBanner(t("banner.vaultReset"));
    } catch (reason) {
      console.error("reset vault failed", reason);
      setError(getErrorMessage(reason, t("errors.resetVault")));
    } finally {
      setBusy(false);
    }
  }

  function openNewEntryModal() {
    setEditingEntryId(null);
    setEditorOpen(true);
  }

  function openEditEntryModal(entryId: string) {
    setEditingEntryId(entryId);
    setEditorOpen(true);
  }

  if (loading) {
    return (
      <main className="app-shell centered">
        <div className="loading-boot" aria-busy="true" aria-live="polite">
          <div className="loading-spinner-small" aria-hidden />
          <p>{t("loading.loadingVault")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={status?.unlocked ? "app-shell" : "app-shell auth-shell"}>
      <header className="app-header">
        <div className="header-spacer" />
        <div className="header-brand">
          <div className="header-title-row">
            <h1>KeyHub</h1>
            <button
              aria-label={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
              className="theme-toggle"
              title={theme === "dark" ? t("theme.light") : t("theme.dark")}
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M12 2.5v2.2M12 19.3v2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M2.5 12h2.2M19.3 12h2.2M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
            <label className="sr-only" htmlFor="keyhub-locale-select">
              {t("language.switch")}
            </label>
            <select
              id="keyhub-locale-select"
              aria-label={t("language.switch")}
              className="locale-select"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <p>{t("header.tagline")}</p>
        </div>
        <div className="header-actions">
          {status?.unlocked ? (
            <>
              <button className="secondary" type="button" onClick={() => setDataSyncOpen(true)}>
                {t("nav.dataSync")}
              </button>
              <button className="secondary" type="button" onClick={() => setSettingsOpen(true)}>
                {t("nav.securitySettings")}
              </button>
              <button className="secondary" type="button" onClick={() => void handleLock()}>
                {t("nav.lockNow")}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {banner || error ? (
        <div className="toast-stack">
          {banner ? (
            <div className="message-banner success">
              <span>{banner}</span>
              <button className="toast-close" type="button" onClick={() => setBanner(null)}>
                {t("common.close")}
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="message-banner error">
              <span>{error}</span>
              <button className="toast-close" type="button" onClick={() => setError(null)}>
                {t("common.close")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!status?.has_vault ? (
        <section className="welcome-layout auth-only-layout">
          <section className="panel-card">
            <h2>{t("createVault.title")}</h2>
            <form className="stack-form" onSubmit={handleCreateVault}>
              <PasswordField
                label={t("createVault.masterPassword")}
                value={masterPassword}
                onChange={setMasterPassword}
                placeholder={t("createVault.placeholderPassword", { n: masterPasswordCharLength })}
                visible={Boolean(showPasswords.createMaster)}
                onToggle={() => togglePasswordVisibility("createMaster")}
                maxLength={masterPasswordCharLength}
              />
              <PasswordField
                label={t("createVault.confirmMasterPassword")}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={t("createVault.placeholderPassword", { n: masterPasswordCharLength })}
                visible={Boolean(showPasswords.createConfirm)}
                onToggle={() => togglePasswordVisibility("createConfirm")}
                maxLength={masterPasswordCharLength}
              />
              <label>
                {t("createVault.hintLabel")}
                <p className="hint-field-note">{t("createVault.hintNote")}</p>
                <textarea
                  maxLength={passwordHintMaxLength}
                  placeholder={t("createVault.hintPlaceholder")}
                  rows={2}
                  value={masterPasswordHint}
                  onChange={(event) => setMasterPasswordHint(event.target.value)}
                />
              </label>
              <label className="remember-row">
                <input
                  checked={rememberPassword}
                  onChange={(event) => setRememberPassword(event.target.checked)}
                  type="checkbox"
                />
                <span>{t("createVault.remember3Days")}</span>
              </label>
              <button className="primary" disabled={busy} type="submit">
                {busy ? t("common.processing") : t("createVault.submit")}
              </button>
            </form>
          </section>
        </section>
      ) : null}

      {status?.has_vault && !status.unlocked ? (
        <section className="welcome-layout auth-only-layout">
          <section className="panel-card">
            {confirmResetStep ? (
              <div className="stack-form vault-reset-flow">
                <div>
                  <h2>{t("resetVault.title")}</h2>
                  <p>{t("resetVault.warning")}</p>
                </div>
                <div className="vault-reset-actions">
                  <button className="secondary" disabled={busy} type="button" onClick={() => cancelVaultResetFlow()}>
                    {t("resetVault.backUnlock")}
                  </button>
                  <button className="danger" disabled={busy} type="button" onClick={() => void handleConfirmResetVault()}>
                    {busy ? t("common.processing") : t("resetVault.confirm")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2>{t("unlock.title")}</h2>
                <form className="stack-form" onSubmit={handleUnlock}>
                  {status.password_hint.trim() ? (
                    <div className="password-hint-display" role="note">
                      <strong>{t("unlock.masterPasswordHint")}</strong>
                      <span>{status.password_hint.trim()}</span>
                    </div>
                  ) : null}
                  <div className="unlock-form-row">
                    <PasswordField
                      hideLabel
                      label={t("createVault.masterPassword")}
                      value={unlockPassword}
                      onChange={setUnlockPassword}
                      placeholder={t("unlock.placeholderPassword", { n: masterPasswordCharLength })}
                      visible={Boolean(showPasswords.unlock)}
                      onToggle={() => togglePasswordVisibility("unlock")}
                      maxLength={masterPasswordCharLength}
                    />
                    <button className="primary unlock-submit" disabled={busy} type="submit">
                      {busy ? t("common.processing") : t("unlock.submit")}
                    </button>
                  </div>
                  <div className="unlock-options-row">
                    <label className="remember-row">
                      <input
                        checked={rememberPassword}
                        onChange={(event) => setRememberPassword(event.target.checked)}
                        type="checkbox"
                      />
                      <span>{t("unlock.remember3Days")}</span>
                    </label>
                    <div className="unlock-secondary-actions">
                      <button className="text-danger-button" type="button" onClick={() => startVaultResetFlow()}>
                        {t("unlock.forgotReset")}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </section>
        </section>
      ) : null}

      {status?.unlocked ? (
        <>
          <section className="vault-board">
            <div className="vault-toolbar">
              <div className="vault-toolbar-main">
                <label className="vault-search">
                  {t("search.label")}
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("search.placeholder")}
                  />
                </label>
              </div>
              <div className="vault-toolbar-actions">
                <span className="badge">{t("entries.summary", { shown: filteredEntries.length, total: entries.length })}</span>
                <button className="primary" type="button" onClick={openNewEntryModal}>
                  {t("entries.new")}
                </button>
              </div>
            </div>

            <section className="vault-table-card">
              <div className="vault-table-header">
                <div className="vault-header-cell">{t("table.platform")}</div>
                <div className="vault-header-cell">{t("table.kind")}</div>
                <div className="vault-header-cell">{t("table.account")}</div>
                <div className="vault-header-cell">{t("table.secret")}</div>
                <div className="vault-header-cell vault-header-actions">{t("table.actions")}</div>
              </div>
              <div className="vault-table-body">
                {filteredEntries.map((entry) => (
                  <div className="vault-row" key={entry.id}>
                    <div className="vault-cell">
                      <strong>{entry.platform}</strong>
                      {entry.tags.length > 0 ? <small>{entry.tags.join(" / ")}</small> : null}
                    </div>
                    <div className="vault-cell">
                      <span className="type-badge">{secretKindLabel(entry.secret_kind)}</span>
                    </div>
                    <div className="vault-cell vault-value-cell">
                      <code>{entry.account}</code>
                    </div>
                    <div className="vault-cell vault-value-cell">
                      <code>{entry.secret}</code>
                    </div>
                    <div className="vault-actions-cell">
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void handleCopyValue(t("copy.account"), entry.account)}
                      >
                        {t("row.copyAccount")}
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void handleCopyValue(t("copy.secret"), entry.secret, true)}
                      >
                        {t("row.copySecret")}
                      </button>
                      <button className="primary" type="button" onClick={() => openEditEntryModal(entry.id)}>
                        {t("row.edit")}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredEntries.length === 0 ? (
                  <div className="empty-table-state">
                    <h3>{t("empty.entriesTitle")}</h3>
                    <p>{t("empty.entriesHint")}</p>
                  </div>
                ) : null}
              </div>
            </section>
          </section>

          {editorOpen ? (
            <Modal
              title={editingEntry ? t("editor.modalTitleEdit", { name: editingEntry.platform }) : t("editor.modalTitleNew")}
              description={t("editor.modalDescription")}
              onClose={() => setEditorOpen(false)}
            >
              <EntryEditor
                entry={editingEntry}
                onSave={handleSaveEntry}
                onDelete={handleDeleteEntry}
                onClose={() => setEditorOpen(false)}
              />
            </Modal>
          ) : null}

          {settingsOpen ? (
            <Modal
              title={t("settings.title")}
              description={t("settings.description")}
              onClose={() => setSettingsOpen(false)}
            >
              <div className="settings-modal-content">
                <section className="panel-section">
                  <h3>{t("settings.desktop")}</h3>
                  <label>
                    {t("settings.autoLockMinutes")}
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={autoLockMinutes}
                      onChange={(event) => setAutoLockMinutes(Number(event.target.value) || 10)}
                    />
                  </label>
                  <label>
                    {t("settings.clipboardClear")}
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={clipboardClearSeconds}
                      onChange={(event) => setClipboardClearSeconds(Number(event.target.value) || 20)}
                    />
                  </label>
                  <label className="remember-row">
                    <input
                      checked={rememberPassword}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRememberPassword(checked);
                        if (checked && sessionPassword) {
                          saveRememberedPassword(sessionPassword);
                        }
                        if (!checked) {
                          clearRememberedPassword();
                        }
                      }}
                      type="checkbox"
                    />
                    <span>{t("createVault.remember3Days")}</span>
                  </label>
                </section>

                <section className="panel-section">
                  <h3>{t("settings.masterHintSection")}</h3>
                  <p className="hint-field-note">{t("settings.masterHintNote")}</p>
                  <textarea
                    maxLength={passwordHintMaxLength}
                    placeholder={t("settings.masterHintPlaceholder")}
                    rows={2}
                    value={passwordHintDraft}
                    onChange={(event) => setPasswordHintDraft(event.target.value)}
                  />
                  <button
                    className="secondary"
                    disabled={busy}
                    type="button"
                    onClick={() => void handleSavePasswordHint()}
                  >
                    {busy ? t("common.processing") : t("settings.saveHint")}
                  </button>
                </section>

                <section className="panel-section">
                  <h3>{t("settings.masterSection")}</h3>
                  <form className="stack-form" onSubmit={handleChangeMasterPassword}>
                    <PasswordField
                      label={t("settings.currentMasterPassword")}
                      value={changeCurrentPassword}
                      onChange={setChangeCurrentPassword}
                      placeholder={t("settings.placeholderNChars", { n: masterPasswordCharLength })}
                      visible={Boolean(showPasswords.changeCurrent)}
                      onToggle={() => togglePasswordVisibility("changeCurrent")}
                      maxLength={masterPasswordCharLength}
                    />
                    <PasswordField
                      label={t("settings.newMasterPassword")}
                      value={changeNewPassword}
                      onChange={setChangeNewPassword}
                      placeholder={t("createVault.placeholderPassword", { n: masterPasswordCharLength })}
                      visible={Boolean(showPasswords.changeNew)}
                      onToggle={() => togglePasswordVisibility("changeNew")}
                      maxLength={masterPasswordCharLength}
                    />
                    <PasswordField
                      label={t("settings.confirmNewMasterPassword")}
                      value={changeConfirmPassword}
                      onChange={setChangeConfirmPassword}
                      placeholder={t("createVault.placeholderPassword", { n: masterPasswordCharLength })}
                      visible={Boolean(showPasswords.changeConfirm)}
                      onToggle={() => togglePasswordVisibility("changeConfirm")}
                      maxLength={masterPasswordCharLength}
                    />
                    <button className="primary" disabled={busy} type="submit">
                      {busy ? t("common.processing") : t("settings.updateMasterPassword")}
                    </button>
                  </form>
                </section>

              </div>
            </Modal>
          ) : null}

          {dataSyncOpen ? (
            <Modal
              title={t("dataSync.title")}
              description={t("dataSync.description")}
              onClose={() => setDataSyncOpen(false)}
            >
              <div className="settings-modal-content">
                <section className="panel-section">
                  <h3>{t("dataSync.localData")}</h3>
                  <div className="meta-list">
                    <span>{t("dataSync.bulletExportDialog")}</span>
                    <span>{t("dataSync.bulletExportFormat")}</span>
                    <span>{t("dataSync.bulletReplace")}</span>
                    <span>{t("dataSync.bulletReunlock")}</span>
                  </div>
                  <div className="inline-actions">
                    <button className="primary" disabled={busy} type="button" onClick={() => void handleExportLocalData()}>
                      {t("dataSync.export")}
                    </button>
                    <button className="secondary" disabled={busy} type="button" onClick={handleImportClick}>
                      {t("dataSync.import")}
                    </button>
                  </div>
                </section>
              </div>
            </Modal>
          ) : null}
        </>
      ) : null}

      <input
        accept=".json,application/json,text/plain"
        hidden
        onChange={(event) => void handleImportFile(event)}
        ref={importInputRef}
        type="file"
      />
    </main>
  );
}
