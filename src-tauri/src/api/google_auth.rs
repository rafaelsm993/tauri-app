use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

// ── Shared cancellation state ────────────────────────────────────────────────

/// Held in Tauri app state. The frontend sets it via `cancel_google_login` so
/// the still-running loopback thread can detect it and send the correct HTML.
pub struct GoogleAuthCancel(pub Arc<AtomicBool>);

impl GoogleAuthCancel {
    pub fn new() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }
}

use super::auth::PublicUser;

// ── Types returned to the frontend ──────────────────────────────────────────

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GoogleLoginResult {
    LoggedIn(PublicUser),
    NeedsUsername {
        google_id: String,
        email: String,
        suggested_name: String,
        avatar_url: String,
    },
}

// ── Internal DB row ──────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct GoogleUserRow {
    id: String,
    username: String,
    email: Option<String>,
}

// ── Token exchange response ──────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(serde::Deserialize)]
struct UserInfo {
    sub: String,   // Google's unique user ID
    name: String,
    email: String,
    picture: String,
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

fn random_bytes_base64url(len: usize) -> String {
    let mut bytes = vec![0u8; len];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(&bytes)
}

fn sha256_base64url(input: &str) -> String {
    let hash = Sha256::digest(input.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

// ── Local loopback callback server ───────────────────────────────────────────

/// Starts a TcpListener on a random port and returns (listener, port).
fn bind_loopback() -> Result<(TcpListener, u16), String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    Ok((listener, port))
}

/// Waits for exactly one HTTP GET to `/callback?code=…&state=…` and returns (code, state).
/// `cancelled` is checked after parsing so that if the user cancelled from the app while the
/// browser tab was still open, the browser receives the "cancelada" page instead of "concluída".
fn wait_for_callback(
    listener: TcpListener,
    cancelled: Arc<AtomicBool>,
) -> Result<(String, String), String> {
    let (stream, _) = listener.accept().map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(&stream);

    // Read the request line (first line of HTTP request)
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| e.to_string())?;

    // Parse query params FIRST so we can send the right HTML response.
    // Parse: GET /callback?code=XXX&state=YYY HTTP/1.1
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "Requisição HTTP inválida.".to_string())?;

    let query = path.split('?').nth(1).unwrap_or("");

    let mut code = None;
    let mut state = None;
    let mut error: Option<String> = None;

    for param in query.split('&') {
        if let Some((k, v)) = param.split_once('=') {
            match k {
                "code"  => code  = Some(urlencoding_decode(v)),
                "state" => state = Some(urlencoding_decode(v)),
                "error" => error = Some(urlencoding_decode(v)),
                _ => {}
            }
        }
    }

    // Check if the user cancelled from the app side after the browser tab was opened.
    let app_cancelled = cancelled.load(Ordering::SeqCst);

    // Send a friendly HTML response — different for cancel vs success.
    // Both responses include window.close() to try to auto-close the browser tab.
    let body = if error.is_some() || app_cancelled {
        "<html><body style='font-family:sans-serif;text-align:center;padding:4rem'>\
        <h2>Autenticação cancelada.</h2>\
        <p>Pode fechar esta aba e voltar ao TauriFlix.</p>\
        <script>window.close();</script></body></html>"
    } else {
        "<html><body style='font-family:sans-serif;text-align:center;padding:4rem'>\
        <h2>&#10003; Autenticação concluída!</h2>\
        <p>Pode fechar esta aba e voltar ao TauriFlix.</p>\
        <script>window.close();</script></body></html>"
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let mut writer = &stream;
    writer.write_all(response.as_bytes()).ok();

    if app_cancelled {
        return Err("Autenticação cancelada pelo utilizador.".to_string());
    }

    if let Some(err) = error {
        return Err(format!("Google cancelou o login: {}", err));
    }

    Ok((
        code.ok_or_else(|| "Código de autorização ausente.".to_string())?,
        state.ok_or_else(|| "State ausente no callback.".to_string())?,
    ))
}

fn urlencoding_decode(s: &str) -> String {
    let with_spaces = s.replace('+', " ");
    let mut result = String::new();
    let mut chars = with_spaces.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(byte) = u8::from_str_radix(&format!("{h1}{h2}"), 16) {
                result.push(byte as char);
            }
        } else {
            result.push(c);
        }
    }
    result
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Initiates the Google OAuth PKCE flow. Opens the browser, waits for the
/// loopback callback, exchanges the code for tokens, fetches the user profile
/// from Google, and performs an upsert in the DB.
///
/// Returns `GoogleLoginResult::LoggedIn` for known users or
/// `GoogleLoginResult::NeedsUsername` for brand-new users so the frontend
/// can prompt for a username before completing registration.
/// Sets the cancellation flag so that `wait_for_callback` returns an error
/// and sends the "cancelada" page to the browser tab.
#[tauri::command]
pub async fn cancel_google_login(
    cancel: State<'_, GoogleAuthCancel>,
) -> Result<(), String> {
    cancel.0.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn google_login(
    pool: State<'_, PgPool>,
    cancel: State<'_, GoogleAuthCancel>,
) -> Result<GoogleLoginResult, String> {
    // Reset the flag at the start of every new attempt.
    cancel.0.store(false, Ordering::SeqCst);
    let client_id = std::env::var("GOOGLE_CLIENT_ID")
        .map_err(|_| "GOOGLE_CLIENT_ID não encontrado no .env".to_string())?;
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET")
        .map_err(|_| "GOOGLE_CLIENT_SECRET não encontrado no .env".to_string())?;

    // PKCE
    let code_verifier = random_bytes_base64url(32);
    let code_challenge = sha256_base64url(&code_verifier);
    let state = random_bytes_base64url(16);

    // Bind loopback server before opening browser
    let (listener, port) = bind_loopback()?;
    let redirect_uri = format!("http://127.0.0.1:{}/callback", port);

    // Build Google auth URL
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
        ?client_id={client_id}\
        &redirect_uri={redirect_uri}\
        &response_type=code\
        &scope=openid%20email%20profile\
        &state={state}\
        &code_challenge={code_challenge}\
        &code_challenge_method=S256\
        &access_type=offline\
        &prompt=select_account",
        client_id = client_id,
        redirect_uri = urlencoding_encode(&redirect_uri),
        state = state,
        code_challenge = code_challenge,
    );

    // Open browser
    tauri_plugin_opener::open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Não foi possível abrir o navegador: {e}"))?;

    // Wait for callback — runs in a dedicated blocking thread so the async runtime isn't stalled.
    let cancelled = Arc::clone(&cancel.0);
    let (code, returned_state): (String, String) =
        tokio::task::spawn_blocking(move || wait_for_callback(listener, cancelled))
            .await
            .map_err(|e| e.to_string())??;

    // Validate state to prevent CSRF
    if returned_state != state {
        return Err("State inválido. Possível ataque CSRF.".to_string());
    }

    // Exchange code for tokens
    let http = reqwest::Client::new();

    let token_res: TokenResponse = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", code_verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Erro na troca de código: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Erro do servidor Google: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Erro ao parsear token: {e}"))?;

    // Fetch user profile
    let user_info: UserInfo = http
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&token_res.access_token)
        .send()
        .await
        .map_err(|e| format!("Erro ao buscar perfil: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Erro do servidor Google (perfil): {e}"))?
        .json()
        .await
        .map_err(|e| format!("Erro ao parsear perfil: {e}"))?;

    // ── Upsert logic ─────────────────────────────────────────────────────────

    // 1. Already linked via google_id?
    let existing_by_google: Option<GoogleUserRow> = sqlx::query_as(
        "SELECT id, username, email FROM users WHERE google_id = $1",
    )
    .bind(&user_info.sub)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(row) = existing_by_google {
        // Update avatar in case it changed
        sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
            .bind(&user_info.picture)
            .bind(&row.id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

        return Ok(GoogleLoginResult::LoggedIn(PublicUser {
            id: row.id,
            username: row.username,
            email: row.email,
            avatar_url: Some(user_info.picture),
        }));
    }

    // 2. Account with same email exists → link it
    let existing_by_email: Option<GoogleUserRow> = sqlx::query_as(
        "SELECT id, username, email FROM users WHERE email = $1",
    )
    .bind(&user_info.email)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some(row) = existing_by_email {
        sqlx::query(
            "UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3",
        )
        .bind(&user_info.sub)
        .bind(&user_info.picture)
        .bind(&row.id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        return Ok(GoogleLoginResult::LoggedIn(PublicUser {
            id: row.id,
            username: row.username,
            email: Some(user_info.email),
            avatar_url: Some(user_info.picture),
        }));
    }

    // 3. Brand new user — ask frontend for a username
    Ok(GoogleLoginResult::NeedsUsername {
        google_id: user_info.sub,
        email: user_info.email,
        suggested_name: user_info.name,
        avatar_url: user_info.picture,
    })
}

/// Completes registration for a new Google user after the frontend collects a username.
#[tauri::command]
pub async fn complete_google_registration(
    pool: State<'_, PgPool>,
    username: String,
    google_id: String,
    email: String,
    avatar_url: String,
) -> Result<PublicUser, String> {
    let username = username.trim().to_string();

    if username.is_empty() {
        return Err("Nome de usuário não pode ser vazio.".to_string());
    }

    // No username uniqueness check: Google users are identified by google_id/email,
    // so display names can be shared between different Google accounts.

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO users (id, username, google_id, email, avatar_url) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(&id)
    .bind(&username)
    .bind(&google_id)
    .bind(&email)
    .bind(&avatar_url)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(PublicUser {
        id,
        username,
        email: Some(email),
        avatar_url: Some(avatar_url),
    })
}

fn urlencoding_encode(s: &str) -> String {
    let mut encoded = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}
