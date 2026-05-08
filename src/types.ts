export interface VaultStatus {
  has_vault: boolean;
  unlocked: boolean;
  entry_count: number;
  /** Plaintext hint from vault metadata; visible before unlock when locked */
  password_hint: string;
  app_data_dir: string | null;
  vault_path: string | null;
}

export interface VaultEntry {
  id: string;
  platform: string;
  account: string;
  secret: string;
  secret_kind: string;
  note: string;
  tags: string[];
  updated_at: string;
}

export interface EntryInput {
  id?: string;
  platform: string;
  account: string;
  secret: string;
  secret_kind: string;
  note: string;
  tags: string[];
}
