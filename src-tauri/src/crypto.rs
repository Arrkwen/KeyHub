use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use anyhow::{anyhow, Context, Result};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::Engine;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KdfConfig {
    pub algorithm: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
    pub salt_b64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub nonce_b64: String,
    pub ciphertext_b64: String,
}

pub fn default_kdf_config() -> KdfConfig {
    let mut salt = [0_u8; 16];
    OsRng.fill_bytes(&mut salt);

    KdfConfig {
        algorithm: "argon2id".to_string(),
        memory_kib: 65_536,
        iterations: 3,
        parallelism: 1,
        salt_b64: base64::engine::general_purpose::STANDARD.encode(salt),
    }
}

pub fn derive_key(password: &str, config: &KdfConfig) -> Result<[u8; 32]> {
    let salt = base64::engine::general_purpose::STANDARD
        .decode(&config.salt_b64)
        .context("invalid salt encoding")?;

    let params = Params::new(
        config.memory_kib,
        config.iterations,
        config.parallelism,
        Some(32),
    )
    .map_err(|err| anyhow!("invalid argon2 params: {err}"))?;

    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0_u8; 32];
    argon
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|err| anyhow!("failed to derive vault key: {err}"))?;

    Ok(key)
}

pub fn encrypt_json<T>(key: &[u8; 32], value: &T) -> Result<EncryptedPayload>
where
    T: Serialize,
{
    let plaintext = serde_json::to_vec(value).context("failed to serialize payload")?;
    encrypt_bytes(key, &plaintext)
}

pub fn decrypt_json<T>(key: &[u8; 32], payload: &EncryptedPayload) -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let plaintext = decrypt_bytes(key, payload)?;
    serde_json::from_slice(&plaintext).context("failed to deserialize payload")
}

pub fn encrypt_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<EncryptedPayload> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| anyhow!("invalid cipher key"))?;
    let mut nonce = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|_| anyhow!("failed to encrypt payload"))?;

    Ok(EncryptedPayload {
        nonce_b64: base64::engine::general_purpose::STANDARD.encode(nonce),
        ciphertext_b64: base64::engine::general_purpose::STANDARD.encode(ciphertext),
    })
}

pub fn decrypt_bytes(key: &[u8; 32], payload: &EncryptedPayload) -> Result<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| anyhow!("invalid cipher key"))?;
    let nonce = base64::engine::general_purpose::STANDARD
        .decode(&payload.nonce_b64)
        .context("invalid nonce encoding")?;
    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(&payload.ciphertext_b64)
        .context("invalid ciphertext encoding")?;

    if nonce.len() != 12 {
        return Err(anyhow!("invalid nonce length"));
    }

    cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| anyhow!("failed to decrypt payload"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_round_trip() {
        let key = derive_key("test-password", &default_kdf_config()).unwrap();
        let payload = encrypt_bytes(&key, br#"{"hello":"world"}"#).unwrap();
        let plaintext = decrypt_bytes(&key, &payload).unwrap();
        assert_eq!(plaintext, br#"{"hello":"world"}"#);
    }
}
