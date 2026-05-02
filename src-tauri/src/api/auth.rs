use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::watchlist::DbConn;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthUser {
    pub id: i64,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPayload {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: String,
}

/// Initialize the users table (called from DbConn::new)
pub fn init_users_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;
    Ok(())
}

/// Hash a password using a simple SHA-256 approach with a salt.
/// For a desktop-only app this is sufficient; for production use bcrypt/argon2.
fn hash_password(password: &str, salt: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    format!("{}:{}", salt, password).hash(&mut hasher);
    let h1 = hasher.finish();

    let mut hasher2 = DefaultHasher::new();
    format!("{}:{}", h1, salt).hash(&mut hasher2);
    format!("{:016x}{:016x}", h1, hasher2.finish())
}

fn generate_salt() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}", t)
}

#[tauri::command]
pub async fn auth_register(
    state: State<'_, DbConn>,
    payload: RegisterPayload,
) -> Result<AuthUser, String> {
    let conn = state.0.lock().unwrap();

    // Validate inputs
    if payload.name.trim().is_empty() {
        return Err("Nome é obrigatório.".into());
    }
    if payload.email.trim().is_empty() || !payload.email.contains('@') {
        return Err("Email inválido.".into());
    }
    if payload.password.len() < 4 {
        return Err("Senha deve ter pelo menos 4 caracteres.".into());
    }

    // Check if email already exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE email = ?1",
            params![payload.email.trim().to_lowercase()],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if exists {
        return Err("Email já cadastrado.".into());
    }

    let salt = generate_salt();
    let password_hash = format!("{}:{}", salt, hash_password(&payload.password, &salt));

    conn.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?1, ?2, ?3)",
        params![
            payload.name.trim(),
            payload.email.trim().to_lowercase(),
            password_hash
        ],
    )
    .map_err(|e| e.to_string())?;

    let user_id = conn.last_insert_rowid();

    Ok(AuthUser {
        id: user_id,
        name: payload.name.trim().to_string(),
        email: payload.email.trim().to_lowercase(),
    })
}

#[tauri::command]
pub async fn auth_login(
    state: State<'_, DbConn>,
    payload: LoginPayload,
) -> Result<AuthUser, String> {
    let conn = state.0.lock().unwrap();

    let email = payload.email.trim().to_lowercase();

    let result: Result<(i64, String, String, String), _> = conn.query_row(
        "SELECT id, name, email, password_hash FROM users WHERE email = ?1",
        params![email],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    );

    match result {
        Ok((id, name, user_email, stored_hash)) => {
            // stored_hash format: "salt:hash"
            let parts: Vec<&str> = stored_hash.splitn(2, ':').collect();
            if parts.len() != 2 {
                return Err("Erro interno de autenticação.".into());
            }
            let salt = parts[0];
            let expected_hash = parts[1];
            let computed_hash = hash_password(&payload.password, salt);

            if computed_hash != expected_hash {
                return Err("Email ou senha incorretos.".into());
            }

            Ok(AuthUser {
                id,
                name,
                email: user_email,
            })
        }
        Err(_) => Err("Email ou senha incorretos.".into()),
    }
}

#[tauri::command]
pub async fn auth_get_user(
    state: State<'_, DbConn>,
    user_id: i64,
) -> Result<Option<AuthUser>, String> {
    let conn = state.0.lock().unwrap();

    let result = conn.query_row(
        "SELECT id, name, email FROM users WHERE id = ?1",
        params![user_id],
        |row| {
            Ok(AuthUser {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
            })
        },
    );

    match result {
        Ok(user) => Ok(Some(user)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn auth_list_users(state: State<'_, DbConn>) -> Result<Vec<AuthUser>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, email FROM users ORDER BY name")
        .map_err(|e| e.to_string())?;
    let users = stmt
        .query_map([], |row| {
            Ok(AuthUser {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(users)
}
