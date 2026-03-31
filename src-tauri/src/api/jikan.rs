use reqwest::Client;
use serde_json::Value;

const BASE_URL: &str = "https://api.jikan.moe/v4";

// ── ANIME ─────────────────────────────────────────────────

#[tauri::command]
pub async fn search_anime(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[jikan] search_anime  query={:?} page={}", query, page);
    let page_str = page.to_string();
    let limit_str = "20";
    let params = [
        ("q", query),
        ("page", page_str.as_str()),
        ("limit", limit_str),
    ];

    let res = Client::new()
        .get(format!("{BASE_URL}/anime"))
        .query(&params)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[jikan] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!(
        "[jikan] search_anime → {} results, last_page={}",
        res["data"].as_array().map(|a| a.len()).unwrap_or(0),
        res["pagination"]["last_visible_page"].as_u64().unwrap_or(0)
    );
    Ok(res)
}

#[tauri::command]
pub async fn anime_details(id: u32) -> Result<Value, String> {
    eprintln!("[jikan] anime_details  id={}", id);
    let res = Client::new()
        .get(format!("{BASE_URL}/anime/{id}/full"))
        .send()
        .await
        .map_err(|e| {
            eprintln!("[jikan] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[jikan] anime_details → title={:?}", res["data"]["title"]);
    Ok(res)
}

// ── MANGA ─────────────────────────────────────────────────

#[tauri::command]
pub async fn search_manga(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[jikan] search_manga  query={:?} page={}", query, page);
    let page_str = page.to_string();
    let limit_str = "20";
    let params = [
        ("q", query),
        ("page", page_str.as_str()),
        ("limit", limit_str),
    ];

    let res = Client::new()
        .get(format!("{BASE_URL}/manga"))
        .query(&params)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[jikan] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!(
        "[jikan] search_manga → {} results, last_page={}",
        res["data"].as_array().map(|a| a.len()).unwrap_or(0),
        res["pagination"]["last_visible_page"].as_u64().unwrap_or(0)
    );
    Ok(res)
}

#[tauri::command]
pub async fn manga_details(id: u32) -> Result<Value, String> {
    eprintln!("[jikan] manga_details  id={}", id);
    let res = Client::new()
        .get(format!("{BASE_URL}/manga/{id}/full"))
        .send()
        .await
        .map_err(|e| {
            eprintln!("[jikan] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[jikan] manga_details → title={:?}", res["data"]["title"]);
    Ok(res)
}
