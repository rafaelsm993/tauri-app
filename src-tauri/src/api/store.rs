use serde_json::Value;
use sqlx::{PgPool, Row};
use tauri::State;

#[tauri::command]
pub async fn load_watchlist(
    pool: State<'_, PgPool>,
    user_id: String,
) -> Result<Vec<Value>, String> {
    let rows = sqlx::query(
        "SELECT item_data FROM watchlist_items WHERE user_id = $1",
    )
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|row| row.get::<Value, _>("item_data"))
        .collect())
}

#[tauri::command]
pub async fn save_watchlist(
    pool: State<'_, PgPool>,
    user_id: String,
    items: Vec<Value>,
) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM watchlist_items WHERE user_id = $1")
        .bind(&user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for item in &items {
        let media_id = item.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        sqlx::query(
            "INSERT INTO watchlist_items (user_id, media_id, item_data) VALUES ($1, $2, $3)",
        )
        .bind(&user_id)
        .bind(media_id)
        .bind(item)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

