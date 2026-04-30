use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use super::auth::init_users_table;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchlistItem {
    pub id: String,
    pub user_id: i64,
    pub media_type: String,
    pub title: String,
    pub poster: Option<String>,
    pub status: String, // want, watching, watched
    pub added_at: String,
}

pub struct DbConn(pub Mutex<Connection>);

impl DbConn {
    pub fn new(path: &str) -> SqlResult<Self> {
        let conn = Connection::open(path)?;
        // Users table
        init_users_table(&conn)?;
        // Watchlist table (per-user)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS watchlist (
                id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                media_type TEXT NOT NULL,
                title TEXT NOT NULL,
                poster TEXT,
                status TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (id, user_id)
            )",
            [],
        )?;
        Ok(DbConn(Mutex::new(conn)))
    }
}

#[tauri::command]
pub async fn add_to_watchlist(state: State<'_, DbConn>, item: WatchlistItem) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO watchlist (id, user_id, media_type, title, poster, status, added_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![item.id, item.user_id, item.media_type, item.title, item.poster, item.status, item.added_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_from_watchlist(
    state: State<'_, DbConn>,
    id: String,
    user_id: i64,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "DELETE FROM watchlist WHERE id = ?1 AND user_id = ?2",
        params![id, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_watchlist_status(
    state: State<'_, DbConn>,
    id: String,
    user_id: i64,
    status: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE watchlist SET status = ?1 WHERE id = ?2 AND user_id = ?3",
        params![status, id, user_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_watchlist(
    state: State<'_, DbConn>,
    user_id: i64,
) -> Result<Vec<WatchlistItem>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, user_id, media_type, title, poster, status, added_at FROM watchlist WHERE user_id = ?1")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![user_id], |row| {
            Ok(WatchlistItem {
                id: row.get(0)?,
                user_id: row.get(1)?,
                media_type: row.get(2)?,
                title: row.get(3)?,
                poster: row.get(4).ok(),
                status: row.get(5)?,
                added_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(items)
}

#[tauri::command]
pub async fn get_watchlist_status(
    state: State<'_, DbConn>,
    id: String,
    user_id: i64,
) -> Result<Option<String>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT status FROM watchlist WHERE id = ?1 AND user_id = ?2")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params![id, user_id])
        .map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let status: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(status))
    } else {
        Ok(None)
    }
}
