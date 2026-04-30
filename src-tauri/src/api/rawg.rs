use reqwest::Client;
use serde_json::{json, Value};

const BASE: &str = "https://api.rawg.io/api";

fn api_key() -> String {
    std::env::var("RAWG_API_KEY").unwrap_or_else(|_| env!("RAWG_API_KEY").to_string())
}

fn http() -> Client {
    Client::builder()
        .user_agent("TauriFlix/1.0")
        .build()
        .unwrap_or_else(|_| Client::new())
}

// ── DISCOVER ───────────────────────────────────────────────
// Default ordering is "popularity desc". Page size 20 to match other providers.
#[tauri::command]
pub async fn rawg_discover(page: u32, genre: Option<String>) -> Result<Value, String> {
    eprintln!("[rawg] discover  page={} genre={:?}", page, genre);
    let key = api_key();
    let p = page.to_string();
    let mut params: Vec<(&str, &str)> = vec![
        ("key", key.as_str()),
        ("page", p.as_str()),
        ("page_size", "20"),
        ("ordering", "-added"),
    ];
    if let Some(ref g) = genre {
        params.push(("genres", g.as_str()));
    }
    let res = http()
        .get(format!("{BASE}/games"))
        .query(&params)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[rawg] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    let total = res.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let total_pages = ((total + 19) / 20).min(500); // RAWG caps deep paging
    let results = res.get("results").cloned().unwrap_or(Value::Array(vec![]));

    Ok(json!({
        "results": results,
        "page": page,
        "total_pages": total_pages.max(page),
        "total_results": total,
    }))
}

// ── SEARCH ─────────────────────────────────────────────────
#[tauri::command]
pub async fn rawg_search(query: &str, page: u32, genre: Option<String>) -> Result<Value, String> {
    eprintln!(
        "[rawg] search  query={:?} page={} genre={:?}",
        query, page, genre
    );
    let key = api_key();
    let p = page.to_string();
    let mut params: Vec<(&str, &str)> = vec![
        ("key", key.as_str()),
        ("search", query),
        ("page", p.as_str()),
        ("page_size", "20"),
        ("search_precise", "true"),
    ];
    if let Some(ref g) = genre {
        params.push(("genres", g.as_str()));
    }
    let res = http()
        .get(format!("{BASE}/games"))
        .query(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    let total = res.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let total_pages = ((total + 19) / 20).min(500);
    let results = res.get("results").cloned().unwrap_or(Value::Array(vec![]));

    Ok(json!({
        "results": results,
        "page": page,
        "total_pages": total_pages.max(page),
        "total_results": total,
    }))
}

// ── GENRES ─────────────────────────────────────────────────
#[tauri::command]
pub async fn rawg_genres() -> Result<Value, String> {
    eprintln!("[rawg] genres");
    let key = api_key();
    let res = http()
        .get(format!("{BASE}/genres"))
        .query(&[("key", key.as_str()), ("page_size", "40")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

// ── DETAILS ────────────────────────────────────────────────
// RAWG splits the detail across two endpoints: `/games/{id}` for metadata
// and `/games/{id}/screenshots` for the gallery. We fetch both in parallel
// and merge the screenshots into the detail payload.
#[tauri::command]
pub async fn rawg_details(id: u32) -> Result<Value, String> {
    eprintln!("[rawg] details  id={}", id);
    let key = api_key();
    let client = http();

    let detail_fut = client
        .get(format!("{BASE}/games/{id}"))
        .query(&[("key", key.as_str())])
        .send();
    let shots_fut = client
        .get(format!("{BASE}/games/{id}/screenshots"))
        .query(&[("key", key.as_str())])
        .send();

    let (detail_res, shots_res) = tokio::join!(detail_fut, shots_fut);

    let mut detail = detail_res
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(msg) = detail.get("detail").and_then(|v| v.as_str()) {
        return Err(msg.to_string());
    }

    if let Ok(shots) = shots_res {
        if let Ok(shots_json) = shots.json::<Value>().await {
            if let Some(arr) = shots_json.get("results").cloned() {
                detail["screenshots"] = arr;
            }
        }
    }

    eprintln!("[rawg] details → name={:?}", detail.get("name"));
    Ok(detail)
}
