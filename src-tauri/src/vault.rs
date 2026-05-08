use crate::crypto::{default_kdf_config, decrypt_bytes, decrypt_json, derive_key, encrypt_bytes, encrypt_json, EncryptedPayload, KdfConfig};
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const VERIFICATION_BYTES: &[u8] = b"keyhub-verification";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryPayload {
    pub id: String,
    pub platform: String,
    pub account: String,
    pub secret: String,
    pub secret_kind: String,
    pub note: String,
    pub tags: Vec<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryInput {
    pub id: Option<String>,
    pub platform: String,
    pub account: String,
    pub secret: String,
    pub secret_kind: String,
    pub note: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedEntry {
    pub id: String,
    pub payload: EncryptedPayload,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultFile {
    pub version: u32,
    pub created_at: String,
    pub updated_at: String,
    /// Plaintext hint shown on the unlock screen; not secret. Omitted in older vault files.
    #[serde(default)]
    pub password_hint: String,
    pub kdf: KdfConfig,
    pub verification: EncryptedPayload,
    pub entries: Vec<EncryptedEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub has_vault: bool,
    pub unlocked: bool,
    pub entry_count: usize,
    /// Shown while locked; plaintext in vault file.
    pub password_hint: String,
    pub app_data_dir: Option<String>,
    pub vault_path: Option<String>,
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

const PASSWORD_HINT_MAX_CHARS: usize = 280;

pub fn sanitize_password_hint(input: &str) -> String {
    input.trim().chars().take(PASSWORD_HINT_MAX_CHARS).collect()
}

pub fn create_vault_file(password: &str, password_hint: &str) -> Result<(VaultFile, [u8; 32])> {
    let kdf = default_kdf_config();
    let key = derive_key(password, &kdf)?;
    let verification = encrypt_bytes(&key, VERIFICATION_BYTES)?;
    let now = now_iso();

    Ok((
        VaultFile {
            version: 1,
            created_at: now.clone(),
            updated_at: now,
            password_hint: sanitize_password_hint(password_hint),
            kdf,
            verification,
            entries: Vec::new(),
        },
        key,
    ))
}

pub fn verify_password(vault: &VaultFile, password: &str) -> Result<[u8; 32]> {
    let key = derive_key(password, &vault.kdf)?;
    let verification = decrypt_bytes(&key, &vault.verification)?;

    if verification == VERIFICATION_BYTES {
        Ok(key)
    } else {
        Err(anyhow!("master password is incorrect"))
    }
}

pub fn write_vault(path: &Path, vault: &VaultFile) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("failed to create app data directory")?;
    }

    let serialized = serde_json::to_string_pretty(vault).context("failed to serialize vault")?;
    fs::write(path, serialized).context("failed to write vault file")?;
    Ok(())
}

pub fn read_vault(path: &Path) -> Result<VaultFile> {
    let raw = fs::read_to_string(path).context("failed to read vault file")?;
    serde_json::from_str(&raw).context("failed to parse vault file")
}

pub fn read_snapshot(path: &Path) -> Result<String> {
    fs::read_to_string(path).context("failed to read encrypted snapshot")
}

pub fn replace_snapshot(path: &Path, snapshot: &str) -> Result<VaultFile> {
    let vault: VaultFile = serde_json::from_str(snapshot).context("invalid snapshot format")?;
    write_vault(path, &vault)?;
    Ok(vault)
}

pub fn decrypt_entries(vault: &VaultFile, key: &[u8; 32]) -> Result<Vec<EntryPayload>> {
    let mut entries = vault
        .entries
        .iter()
        .map(|entry| decrypt_json::<EntryPayload>(key, &entry.payload))
        .collect::<Result<Vec<_>>>()?;

    entries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(entries)
}

pub fn upsert_entry(vault: &mut VaultFile, key: &[u8; 32], input: EntryInput) -> Result<EntryPayload> {
    let now = now_iso();
    let id = input
        .id
        .unwrap_or_else(|| format!("entry-{}", Utc::now().timestamp_nanos_opt().unwrap_or_default()));

    let entry = EntryPayload {
        id: id.clone(),
        platform: input.platform.trim().to_string(),
        account: input.account.trim().to_string(),
        secret: input.secret,
        secret_kind: input.secret_kind.trim().to_string(),
        note: input.note.trim().to_string(),
        tags: input
            .tags
            .into_iter()
            .map(|tag| tag.trim().to_string())
            .filter(|tag| !tag.is_empty())
            .collect(),
        updated_at: now.clone(),
    };

    let encrypted = EncryptedEntry {
        id: id.clone(),
        payload: encrypt_json(key, &entry)?,
        updated_at: now.clone(),
    };

    match vault.entries.iter().position(|item| item.id == id) {
        Some(index) => vault.entries[index] = encrypted,
        None => vault.entries.push(encrypted),
    }

    vault.updated_at = now;
    Ok(entry)
}

pub fn delete_entry(vault: &mut VaultFile, id: &str) -> bool {
    let previous_len = vault.entries.len();
    vault.entries.retain(|entry| entry.id != id);
    let changed = vault.entries.len() != previous_len;

    if changed {
        vault.updated_at = now_iso();
    }

    changed
}

pub fn change_master_password(
    vault: &mut VaultFile,
    current_password: &str,
    new_password: &str,
) -> Result<[u8; 32]> {
    let current_key = verify_password(vault, current_password)?;
    let entries = decrypt_entries(vault, &current_key)?;
    let new_kdf = default_kdf_config();
    let new_key = derive_key(new_password, &new_kdf)?;
    let verification = encrypt_bytes(&new_key, VERIFICATION_BYTES)?;

    vault.kdf = new_kdf;
    vault.verification = verification;
    vault.entries = entries
        .into_iter()
        .map(|entry| {
            Ok(EncryptedEntry {
                id: entry.id.clone(),
                updated_at: entry.updated_at.clone(),
                payload: encrypt_json(&new_key, &entry)?,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    vault.updated_at = now_iso();

    Ok(new_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_and_decrypts_entry() {
        let (mut vault, key) = create_vault_file("vault-password", "my hint").unwrap();
        let created = upsert_entry(
            &mut vault,
            &key,
            EntryInput {
                id: None,
                platform: "OpenAI".to_string(),
                account: "primary".to_string(),
                secret: "sk-live-example".to_string(),
                secret_kind: "api-key".to_string(),
                note: "production usage".to_string(),
                tags: vec!["prod".to_string(), "billing".to_string()],
            },
        )
        .unwrap();

        let decrypted = decrypt_entries(&vault, &key).unwrap();
        assert_eq!(vault.password_hint, "my hint");
        assert_eq!(decrypted.len(), 1);
        assert_eq!(decrypted[0].id, created.id);
        assert_eq!(decrypted[0].platform, "OpenAI");
        assert_eq!(decrypted[0].secret_kind, "api-key");
    }

    #[test]
    fn changes_master_password() {
        let (mut vault, key) = create_vault_file("old-password", "").unwrap();
        upsert_entry(
            &mut vault,
            &key,
            EntryInput {
                id: None,
                platform: "Claude".to_string(),
                account: "primary".to_string(),
                secret: "secret-value".to_string(),
                secret_kind: "password".to_string(),
                note: String::new(),
                tags: vec![],
            },
        )
        .unwrap();

        let new_key = change_master_password(&mut vault, "old-password", "new-password").unwrap();
        assert!(verify_password(&vault, "old-password").is_err());
        assert!(verify_password(&vault, "new-password").is_ok());
        let entries = decrypt_entries(&vault, &new_key).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].platform, "Claude");
    }
}
