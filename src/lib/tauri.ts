import { invoke } from "@tauri-apps/api/core";
import type { EntryInput, VaultEntry, VaultStatus } from "../types";

export async function getVaultStatus(): Promise<VaultStatus> {
  return invoke("get_vault_status");
}

export async function createVault(
  masterPassword: string,
  passwordHint?: string | null
): Promise<VaultStatus> {
  return invoke("create_vault", {
    masterPassword,
    passwordHint: passwordHint?.trim() ? passwordHint.trim() : null
  });
}

export async function unlockVault(masterPassword: string): Promise<VaultStatus> {
  return invoke("unlock_vault", { masterPassword });
}

export async function lockVault(): Promise<void> {
  return invoke("lock_vault");
}

export async function listEntries(): Promise<VaultEntry[]> {
  return invoke("list_entries");
}

export async function saveEntry(input: EntryInput): Promise<VaultEntry> {
  return invoke("upsert_vault_entry", { input });
}

export async function removeEntry(id: string): Promise<VaultStatus> {
  return invoke("delete_vault_entry", { id });
}

export async function exportLocalVaultData(): Promise<string> {
  return invoke("export_encrypted_snapshot");
}

export async function importLocalVaultData(snapshot: string): Promise<VaultStatus> {
  return invoke("import_encrypted_snapshot", { snapshot });
}

export async function saveExportedBackup(
  contents: string,
  defaultFileName: string
): Promise<string | null> {
  return invoke("save_exported_backup", {
    contents,
    defaultFileName
  });
}

export async function changeVaultMasterPassword(
  currentPassword: string,
  newPassword: string
): Promise<VaultStatus> {
  return invoke("change_vault_master_password", {
    currentPassword,
    newPassword
  });
}

export async function setVaultPasswordHint(passwordHint: string): Promise<VaultStatus> {
  return invoke("set_vault_password_hint", {
    passwordHint: passwordHint.trim() ? passwordHint.trim() : null
  });
}

export async function resetVault(): Promise<VaultStatus> {
  return invoke("reset_vault");
}
