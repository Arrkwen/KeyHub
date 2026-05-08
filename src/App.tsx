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
          aria-label={visible ? `隐藏${label}` : `显示${label}`}
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

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextStatus = await getVaultStatus();
      setStatus(nextStatus);

      const remembered = loadRememberedPassword();
      setRememberPassword(Boolean(remembered.password));

      if (remembered.expired) {
        setBanner("自动登录已过期，请重新输入主密码。");
      }

      if (nextStatus.has_vault && remembered.password) {
        try {
          const unlockedStatus = await unlockVault(remembered.password);
          setStatus(unlockedStatus);
          setSessionPassword(remembered.password);
          await refreshEntries();
          setBanner("已自动登录 KeyHub。");
        } catch (reason) {
          console.error("auto unlock failed", reason);
          clearRememberedPassword();
          setRememberPassword(false);
          setError("自动登录失败，请重新输入主密码。");
          await refreshStatus();
        }
      }
    } catch (reason) {
      setError(getErrorMessage(reason, "初始化应用失败。"));
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
      setError(`主密码必须为 ${masterPasswordCharLength} 位字符（当前 ${masterPasswordCharCount(masterPassword)} 位）。`);
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError("两次输入的主密码不一致。");
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
      setBanner("本地保险库已创建并解锁。");
    } catch (reason) {
      console.error("create vault failed", reason);
      setError(getErrorMessage(reason, "创建本地保险库失败。"));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBanner(null);

    if (!unlockPassword.trim()) {
      setError("请输入主密码。");
      return;
    }

    if (!isValidMasterPasswordLength(unlockPassword)) {
      setError(`主密码必须为 ${masterPasswordCharLength} 位字符（当前 ${masterPasswordCharCount(unlockPassword)} 位）。`);
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
      setBanner("已解锁本地保险库。");
    } catch (reason) {
      console.error("unlock vault failed", reason);
      setError(getErrorMessage(reason, "解锁失败。"));
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
        setBanner(autoLocked ? "长时间无操作，本地保险库已锁定。" : "本地保险库已锁定。");
      }
    } catch (reason) {
      console.error("lock vault failed", reason);
      setError(getErrorMessage(reason, "锁定失败。"));
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
      setBanner(`已保存 ${saved.platform} 条目。`);
    } catch (reason) {
      console.error("save entry failed", reason);
      setError(getErrorMessage(reason, "保存条目失败。"));
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
      setBanner("条目已删除。");
    } catch (reason) {
      console.error("delete entry failed", reason);
      setError(getErrorMessage(reason, "删除条目失败。"));
    }
  }

  async function handleCopyValue(label: string, value: string, clearAfterCopy = false) {
    try {
      await copySecret(value, clearAfterCopy ? clipboardClearSeconds : 0);
      setBanner(
        clearAfterCopy
          ? `${label}已复制，将在 ${clipboardClearSeconds} 秒后尝试清空剪贴板。`
          : `${label}已复制到剪贴板。`
      );
    } catch (reason) {
      setError(getErrorMessage(reason, "复制失败。"));
    }
  }

  async function handleSavePasswordHint() {
    setError(null);
    setBanner(null);
    setBusy(true);
    try {
      const nextStatus = await setVaultPasswordHint(passwordHintDraft);
      setStatus(nextStatus);
      setBanner("主密码提示已保存。");
    } catch (reason) {
      console.error("save password hint failed", reason);
      setError(getErrorMessage(reason, "保存主密码提示失败。"));
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
        `新主密码必须为 ${masterPasswordCharLength} 位字符（当前 ${masterPasswordCharCount(changeNewPassword)} 位）。`
      );
      return;
    }

    if (changeNewPassword !== changeConfirmPassword) {
      setError("两次输入的新主密码不一致。");
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

      setBanner("主密码已更新。");
    } catch (reason) {
      console.error("change master password failed", reason);
      setError(getErrorMessage(reason, "修改主密码失败。"));
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
        setBanner("已取消导出。");
        return;
      }

      setBanner(`本地数据已导出到：${savedPath}`);
    } catch (reason) {
      console.error("export local data failed", reason);
      setError(getErrorMessage(reason, "导出本地数据失败。"));
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
      setBanner("本地数据已加载，请使用对应主密码解锁。");
    } catch (reason) {
      console.error("import local data failed", reason);
      setError(getErrorMessage(reason, "加载本地数据失败。"));
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
      setBanner("本地保险库已重置。");
    } catch (reason) {
      console.error("reset vault failed", reason);
      setError(getErrorMessage(reason, "重置本地保险库失败。"));
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
        <div className="splash-card">
          <h1>KeyHub</h1>
          <p>正在加载本地保险库...</p>
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
              aria-label={theme === "dark" ? "切换到白天模式" : "切换到黑夜模式"}
              className="theme-toggle"
              title={theme === "dark" ? "白天模式" : "黑夜模式"}
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
          </div>
          <p>适合保存各类大模型平台账号、密码、API Key、Secret 和备注信息。</p>
        </div>
        <div className="header-actions">
          {status?.unlocked ? (
            <>
              <button className="secondary" type="button" onClick={() => setDataSyncOpen(true)}>
                数据同步
              </button>
              <button className="secondary" type="button" onClick={() => setSettingsOpen(true)}>
                安全设置
              </button>
              <button className="secondary" type="button" onClick={() => void handleLock()}>
                立即锁定
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
                关闭
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="message-banner error">
              <span>{error}</span>
              <button className="toast-close" type="button" onClick={() => setError(null)}>
                关闭
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!status?.has_vault ? (
        <section className="welcome-layout auth-only-layout">
          <section className="panel-card">
            <h2>创建本地保险库</h2>
            <form className="stack-form" onSubmit={handleCreateVault}>
              <PasswordField
                label="主密码"
                value={masterPassword}
                onChange={setMasterPassword}
                placeholder={`${masterPasswordCharLength} 位任意字符组成的密码`}
                visible={Boolean(showPasswords.createMaster)}
                onToggle={() => togglePasswordVisibility("createMaster")}
                maxLength={masterPasswordCharLength}
              />
              <PasswordField
                label="确认主密码"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={`${masterPasswordCharLength} 位任意字符组成的密码`}
                visible={Boolean(showPasswords.createConfirm)}
                onToggle={() => togglePasswordVisibility("createConfirm")}
                maxLength={masterPasswordCharLength}
              />
              <label>
                主密码提示（可选）
                <p className="hint-field-note">当你忘记主密码时，能够通过提示找回。</p>
                <textarea
                  maxLength={passwordHintMaxLength}
                  placeholder="例如：生日年月日，纪念日或其他有意义的提示"
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
                <span>记住主密码 3 天</span>
              </label>
              <button className="primary" disabled={busy} type="submit">
                {busy ? "处理中..." : "创建并进入"}
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
                  <h2>重置本地保险库</h2>
                  <p>
                    将删除本机上的加密保险库文件与所有已保存条目。若未提前导出备份，数据无法恢复。确认后需要重新创建主密码。
                  </p>
                </div>
                <div className="vault-reset-actions">
                  <button className="secondary" disabled={busy} type="button" onClick={() => cancelVaultResetFlow()}>
                    返回解锁
                  </button>
                  <button className="danger" disabled={busy} type="button" onClick={() => void handleConfirmResetVault()}>
                    {busy ? "处理中..." : "确认重置本地保险库"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2>解锁本地保险库</h2>
                <form className="stack-form" onSubmit={handleUnlock}>
                  {status.password_hint.trim() ? (
                    <div className="password-hint-display" role="note">
                      <strong>主密码提示</strong>
                      <span>{status.password_hint.trim()}</span>
                    </div>
                  ) : null}
                  <div className="unlock-form-row">
                    <PasswordField
                      hideLabel
                      label="主密码"
                      value={unlockPassword}
                      onChange={setUnlockPassword}
                      placeholder={`${masterPasswordCharLength} 位主密码`}
                      visible={Boolean(showPasswords.unlock)}
                      onToggle={() => togglePasswordVisibility("unlock")}
                      maxLength={masterPasswordCharLength}
                    />
                    <button className="primary unlock-submit" disabled={busy} type="submit">
                      {busy ? "处理中..." : "解锁"}
                    </button>
                  </div>
                  <div className="unlock-options-row">
                    <label className="remember-row">
                      <input
                        checked={rememberPassword}
                        onChange={(event) => setRememberPassword(event.target.checked)}
                        type="checkbox"
                      />
                      <span>记住主密码 3 天</span>
                    </label>
                    <div className="unlock-secondary-actions">
                      <button className="text-danger-button" type="button" onClick={() => startVaultResetFlow()}>
                        忘记主密码，重置本地保险库
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
                  搜索
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="平台、类型、账号、标签"
                  />
                </label>
              </div>
              <div className="vault-toolbar-actions">
                <span className="badge">{filteredEntries.length} / {entries.length} 条</span>
                <button className="primary" type="button" onClick={openNewEntryModal}>
                  新建条目
                </button>
              </div>
            </div>

            <section className="vault-table-card">
              <div className="vault-table-header">
                <div className="vault-header-cell">平台名</div>
                <div className="vault-header-cell">类型</div>
                <div className="vault-header-cell">账号名</div>
                <div className="vault-header-cell">密码 / Key</div>
                <div className="vault-header-cell vault-header-actions">操作</div>
              </div>
              <div className="vault-table-body">
                {filteredEntries.map((entry) => (
                  <div className="vault-row" key={entry.id}>
                    <div className="vault-cell">
                      <strong>{entry.platform}</strong>
                      {entry.tags.length > 0 ? <small>{entry.tags.join(" / ")}</small> : null}
                    </div>
                    <div className="vault-cell">
                      <span className="type-badge">{entry.secret_kind}</span>
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
                        onClick={() => void handleCopyValue("账号", entry.account)}
                      >
                        复制账号
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => void handleCopyValue("密码/密钥", entry.secret, true)}
                      >
                        复制密码
                      </button>
                      <button className="primary" type="button" onClick={() => openEditEntryModal(entry.id)}>
                        编辑
                      </button>
                    </div>
                  </div>
                ))}
                {filteredEntries.length === 0 ? (
                  <div className="empty-table-state">
                    <h3>还没有条目</h3>
                    <p>点击右上角“新建条目”开始保存平台账号和 API 凭据。</p>
                  </div>
                ) : null}
              </div>
            </section>
          </section>

          {editorOpen ? (
            <Modal
              title={editingEntry ? `编辑 ${editingEntry.platform}` : "新建条目"}
              description="只有点击编辑的条目才会展开详情，新建和编辑都以弹窗形式完成。"
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
              title="安全设置"
              description="统一管理本地安全体验和主密码。"
              onClose={() => setSettingsOpen(false)}
            >
              <div className="settings-modal-content">
                <section className="panel-section">
                  <h3>桌面体验</h3>
                  <label>
                    自动锁定（分钟）
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={autoLockMinutes}
                      onChange={(event) => setAutoLockMinutes(Number(event.target.value) || 10)}
                    />
                  </label>
                  <label>
                    复制密码后清空剪贴板（秒）
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
                    <span>记住主密码 3 天</span>
                  </label>
                </section>

                <section className="panel-section">
                  <h3>主密码提示</h3>
                  <p className="hint-field-note">解锁页会在主密码输入框上方显示以下内容。留空表示不显示。</p>
                  <textarea
                    maxLength={passwordHintMaxLength}
                    placeholder="仅自己可辨别的提示……"
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
                    {busy ? "处理中..." : "保存提示"}
                  </button>
                </section>

                <section className="panel-section">
                  <h3>主密码</h3>
                  <form className="stack-form" onSubmit={handleChangeMasterPassword}>
                    <PasswordField
                      label="当前主密码"
                      value={changeCurrentPassword}
                      onChange={setChangeCurrentPassword}
                      placeholder={`${masterPasswordCharLength} 位`}
                      visible={Boolean(showPasswords.changeCurrent)}
                      onToggle={() => togglePasswordVisibility("changeCurrent")}
                      maxLength={masterPasswordCharLength}
                    />
                    <PasswordField
                      label="新主密码"
                      value={changeNewPassword}
                      onChange={setChangeNewPassword}
                      placeholder={`${masterPasswordCharLength} 位任意字符组成的密码`}
                      visible={Boolean(showPasswords.changeNew)}
                      onToggle={() => togglePasswordVisibility("changeNew")}
                      maxLength={masterPasswordCharLength}
                    />
                    <PasswordField
                      label="确认新主密码"
                      value={changeConfirmPassword}
                      onChange={setChangeConfirmPassword}
                      placeholder={`${masterPasswordCharLength} 位任意字符组成的密码`}
                      visible={Boolean(showPasswords.changeConfirm)}
                      onToggle={() => togglePasswordVisibility("changeConfirm")}
                      maxLength={masterPasswordCharLength}
                    />
                    <button className="primary" disabled={busy} type="submit">
                      {busy ? "处理中..." : "更新主密码"}
                    </button>
                  </form>
                </section>

              </div>
            </Modal>
          ) : null}

          {dataSyncOpen ? (
            <Modal
              title="数据同步"
              description="在本地设备之间通过导出和加载加密备份文件进行手动同步。"
              onClose={() => setDataSyncOpen(false)}
            >
              <div className="settings-modal-content">
                <section className="panel-section">
                  <h3>本地数据</h3>
                  <div className="meta-list">
                    <span>导出时会打开系统保存对话框，可自定义保存目录和文件名。</span>
                    <span>导出格式为 `.json` 本地加密备份文件，可用于手动备份。</span>
                    <span>加载本地数据会直接替换当前保险库内容。</span>
                    <span>加载后需要使用该数据对应的主密码重新解锁。</span>
                  </div>
                  <div className="inline-actions">
                    <button className="primary" disabled={busy} type="button" onClick={() => void handleExportLocalData()}>
                      导出本地数据
                    </button>
                    <button className="secondary" disabled={busy} type="button" onClick={handleImportClick}>
                      加载本地数据
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
