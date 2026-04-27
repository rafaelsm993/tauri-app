use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::OsRng;
use serde::Serialize;
use sqlx::PgPool;
use tauri::State;
use uuid::Uuid;

#[derive(Serialize, Clone)]
pub struct PublicUser {
    pub id: String,
    pub username: String,
}

// Internal row type used only for DB reads
#[derive(sqlx::FromRow)]
struct UserRow {
    id: String,
    username: String,
    password_hash: String,
}

#[tauri::command]
pub async fn register_user(
    pool: State<'_, PgPool>,
    username: String,
    password: String,
) -> Result<PublicUser, String> {
    let username = username.trim().to_string();

    if username.is_empty() {
        return Err("Nome de usuário não pode ser vazio.".to_string());
    }
    if password.len() < 6 {
        return Err("A senha deve ter pelo menos 6 caracteres.".to_string());
    }

    // Check for duplicate username (case-insensitive)
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE lower(username) = lower($1))",
    )
    .bind(&username)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if exists {
        return Err("Nome de usuário já existe.".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)")
        .bind(&id)
        .bind(&username)
        .bind(&password_hash)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(PublicUser { id, username })
}

#[tauri::command]
pub async fn login_user(
    pool: State<'_, PgPool>,
    username: String,
    password: String,
) -> Result<PublicUser, String> {
    let row = sqlx::query_as::<_, UserRow>(
        "SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1)",
    )
    .bind(username.trim())
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Credenciais inválidas.".to_string())?;

    let parsed_hash = PasswordHash::new(&row.password_hash).map_err(|e| e.to_string())?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Credenciais inválidas.".to_string())?;

    Ok(PublicUser {
        id: row.id,
        username: row.username,
    })
}

#[derive(sqlx::FromRow)]
struct UserListRow {
    id: String,
    username: String,
}

#[tauri::command]
pub async fn list_users(pool: State<'_, PgPool>) -> Result<Vec<PublicUser>, String> {
    let rows = sqlx::query_as::<_, UserListRow>(
        "SELECT id, username FROM users ORDER BY created_at",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| PublicUser {
            id: r.id,
            username: r.username,
        })
        .collect())
}

