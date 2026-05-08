mod crypto;
mod vault;

use rfd::FileDialog;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};
use zeroize::Zeroize;

use vault::{
    change_master_password, create_vault_file, decrypt_entries, delete_entry, read_snapshot, read_vault, replace_snapshot,
    sanitize_password_hint, upsert_entry, verify_password, write_vault, now_iso,
    EntryInput, EntryPayload, VaultStatus,
};

const MASTER_PASSWORD_CHAR_LEN: usize = 10;

fn validate_master_password_len(password: &str) -> Result<(), String> {
    let n = password.chars().count();
    if n != MASTER_PASSWORD_CHAR_LEN {
        return Err(format!(
            "主密码必须为 {} 位字符（当前 {} 位）",
            MASTER_PASSWORD_CHAR_LEN, n
        ));
    }
    Ok(())
}

#[derive(Default)]
struct SessionState {
    key: Option<[u8; 32]>,
}

#[derive(Default)]
struct AppState {
    session: Mutex<SessionState>,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|err| format!("unable to resolve app data directory: {err}"))
}

fn vault_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app_data_dir(app)?;
    dir.push("vault");
    dir.push("keyhub-vault.json");
    Ok(dir)
}

fn build_status(app: &AppHandle, state: &State<AppState>) -> Result<VaultStatus, String> {
    let vault_path = vault_file_path(app)?;
    let app_dir = app_data_dir(app)?;
    let unlocked = state
        .session
        .lock()
        .map_err(|_| "failed to access session state".to_string())?
        .key
        .is_some();

    if !vault_path.exists() {
        return Ok(VaultStatus {
            has_vault: false,
            unlocked: false,
            entry_count: 0,
            password_hint: String::new(),
            app_data_dir: Some(app_dir.display().to_string()),
            vault_path: Some(vault_path.display().to_string()),
        });
    }

    let vault = read_vault(&vault_path).map_err(|err| err.to_string())?;
    Ok(VaultStatus {
        has_vault: true,
        unlocked,
        entry_count: vault.entries.len(),
        password_hint: vault.password_hint.clone(),
        app_data_dir: Some(app_dir.display().to_string()),
        vault_path: Some(vault_path.display().to_string()),
    })
}

fn with_key(state: &State<AppState>) -> Result<[u8; 32], String> {
    state
        .session
        .lock()
        .map_err(|_| "failed to access session state".to_string())?
        .key
        .ok_or_else(|| "vault is locked".to_string())
}

fn set_session_key(state: &State<AppState>, key: [u8; 32]) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "failed to access session state".to_string())?;
    session.key = Some(key);
    Ok(())
}

#[tauri::command]
fn get_vault_status(app: AppHandle, state: State<AppState>) -> Result<VaultStatus, String> {
    build_status(&app, &state)
}

#[tauri::command]
fn create_vault(
    app: AppHandle,
    state: State<AppState>,
    master_password: String,
    password_hint: Option<String>,
) -> Result<VaultStatus, String> {
    let vault_path = vault_file_path(&app)?;

    if vault_path.exists() {
        return Err("vault already exists".to_string());
    }

    let hint = password_hint.unwrap_or_default();
    validate_master_password_len(&master_password)?;
    let (vault, key) = create_vault_file(&master_password, &hint).map_err(|err| err.to_string())?;
    write_vault(&vault_path, &vault).map_err(|err| err.to_string())?;

    set_session_key(&state, key)?;

    build_status(&app, &state)
}

#[tauri::command]
fn unlock_vault(
    app: AppHandle,
    state: State<AppState>,
    master_password: String,
) -> Result<VaultStatus, String> {
    let vault_path = vault_file_path(&app)?;
    let vault = read_vault(&vault_path).map_err(|err| err.to_string())?;
    validate_master_password_len(&master_password)?;
    let key = verify_password(&vault, &master_password).map_err(|_| "主密码不正确".to_string())?;

    set_session_key(&state, key)?;

    build_status(&app, &state)
}

#[tauri::command]
fn lock_vault(state: State<AppState>) -> Result<(), String> {
    lock_vault_inner(&state)
}

fn lock_vault_inner(state: &State<AppState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "failed to access session state".to_string())?;

    if let Some(mut key) = session.key.take() {
        key.zeroize();
    }

    Ok(())
}

#[tauri::command]
fn list_entries(app: AppHandle, state: State<AppState>) -> Result<Vec<EntryPayload>, String> {
    let key = with_key(&state)?;
    let vault_path = vault_file_path(&app)?;
    let vault = read_vault(&vault_path).map_err(|err| err.to_string())?;
    decrypt_entries(&vault, &key).map_err(|err| err.to_string())
}

#[tauri::command]
fn upsert_vault_entry(
    app: AppHandle,
    state: State<AppState>,
    input: EntryInput,
) -> Result<EntryPayload, String> {
    let key = with_key(&state)?;
    let vault_path = vault_file_path(&app)?;
    let mut vault = read_vault(&vault_path).map_err(|err| err.to_string())?;
    let entry = upsert_entry(&mut vault, &key, input).map_err(|err| err.to_string())?;
    write_vault(&vault_path, &vault).map_err(|err| err.to_string())?;
    Ok(entry)
}

#[tauri::command]
fn delete_vault_entry(
    app: AppHandle,
    state: State<AppState>,
    id: String,
) -> Result<VaultStatus, String> {
    let _key = with_key(&state)?;
    let vault_path = vault_file_path(&app)?;
    let mut vault = read_vault(&vault_path).map_err(|err| err.to_string())?;

    if !delete_entry(&mut vault, &id) {
        return Err("entry not found".to_string());
    }

    write_vault(&vault_path, &vault).map_err(|err| err.to_string())?;
    build_status(&app, &state)
}

#[tauri::command]
fn export_encrypted_snapshot(app: AppHandle, state: State<AppState>) -> Result<String, String> {
    let _key = with_key(&state)?;
    let vault_path = vault_file_path(&app)?;
    read_snapshot(&vault_path).map_err(|err| err.to_string())
}

#[tauri::command]
fn import_encrypted_snapshot(
    app: AppHandle,
    state: State<AppState>,
    snapshot: String,
) -> Result<VaultStatus, String> {
    let vault_path = vault_file_path(&app)?;
    replace_snapshot(&vault_path, &snapshot).map_err(|err| err.to_string())?;
    lock_vault_inner(&state)?;
    build_status(&app, &state)
}

#[tauri::command]
fn change_vault_master_password(
    app: AppHandle,
    state: State<AppState>,
    current_password: String,
    new_password: String,
) -> Result<VaultStatus, String> {
    validate_master_password_len(&new_password)?;
    let vault_path = vault_file_path(&app)?;
    let mut vault = read_vault(&vault_path).map_err(|err| err.to_string())?;
    let new_key = change_master_password(&mut vault, &current_password, &new_password)
        .map_err(|_| "当前主密码不正确".to_string())?;
    write_vault(&vault_path, &vault).map_err(|err| err.to_string())?;
    set_session_key(&state, new_key)?;
    build_status(&app, &state)
}

#[tauri::command]
fn set_vault_password_hint(
    app: AppHandle,
    state: State<AppState>,
    password_hint: Option<String>,
) -> Result<VaultStatus, String> {
    let _key = with_key(&state)?;
    let vault_path = vault_file_path(&app)?;
    let mut vault = read_vault(&vault_path).map_err(|err| err.to_string())?;
    vault.password_hint = sanitize_password_hint(password_hint.as_deref().unwrap_or(""));
    vault.updated_at = now_iso();
    write_vault(&vault_path, &vault).map_err(|err| err.to_string())?;
    build_status(&app, &state)
}

#[tauri::command]
fn reset_vault(app: AppHandle, state: State<AppState>) -> Result<VaultStatus, String> {
    let vault_path = vault_file_path(&app)?;
    lock_vault_inner(&state)?;

    if vault_path.exists() {
        std::fs::remove_file(&vault_path).map_err(|err| err.to_string())?;
    }

    build_status(&app, &state)
}

#[tauri::command]
fn save_exported_backup(contents: String, default_file_name: String) -> Result<Option<String>, String> {
    let file_path = FileDialog::new()
        .add_filter("KeyHub Backup", &["json"])
        .set_file_name(&default_file_name)
        .save_file();

    let Some(path) = file_path else {
        return Ok(None);
    };

    std::fs::write(&path, contents).map_err(|err| err.to_string())?;
    Ok(Some(path.display().to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(dir)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_vault_status,
            create_vault,
            unlock_vault,
            lock_vault,
            list_entries,
            upsert_vault_entry,
            delete_vault_entry,
            export_encrypted_snapshot,
            import_encrypted_snapshot,
            change_vault_master_password,
            set_vault_password_hint,
            reset_vault,
            save_exported_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running KeyHub");
}
