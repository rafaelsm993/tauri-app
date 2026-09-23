use super::http::client as http;
use serde_json::{json, Value};

const BASE: &str = "https://api.rawg.io/api";

fn api_key() -> String {
    std::env::var("RAWG_API_KEY").unwrap_or_else(|_| env!("RAWG_API_KEY").to_string())
}

/// RAWG page size used by every list request (matches the other providers).
const PAGE_SIZE: u32 = 20;
/// RAWG refuses deep paging; never advertise more than this.
const MAX_PAGES: u32 = 500;

/// Pages to advertise to the UI. Never less than the page the UI is on.
fn total_pages(total: u32, page: u32) -> u32 {
    total.div_ceil(PAGE_SIZE).min(MAX_PAGES).max(page)
}

// ── DISCOVER ───────────────────────────────────────────────
// Default ordering is "popularity desc". Page size 20 to match other providers.
#[tauri::command]
pub async fn rawg_discover(page: u32, genre: Option<String>) -> Result<Value, String> {
    log::info!("[rawg] discover  page={} genre={:?}", page, genre);
    let key = api_key();
    let p = page.to_string();
    let page_size = PAGE_SIZE.to_string();
    let mut params: Vec<(&str, &str)> = vec![
        ("key", key.as_str()),
        ("page", p.as_str()),
        ("page_size", page_size.as_str()),
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
            log::error!(
                "[rawg] ERROR: {}",
                crate::logging::redact(&e.to_string(), &key)
            );
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    let total = res.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let results = res.get("results").cloned().unwrap_or(Value::Array(vec![]));

    Ok(json!({
        "results": results,
        "page": page,
        "total_pages": total_pages(total, page),
        "total_results": total,
    }))
}

// ── SEARCH ─────────────────────────────────────────────────
#[tauri::command]
pub async fn rawg_search(query: &str, page: u32, genre: Option<String>) -> Result<Value, String> {
    log::info!(
        "[rawg] search  query={:?} page={} genre={:?}",
        query,
        page,
        genre
    );
    let key = api_key();
    let p = page.to_string();
    let page_size = PAGE_SIZE.to_string();
    let mut params: Vec<(&str, &str)> = vec![
        ("key", key.as_str()),
        ("search", query),
        ("page", p.as_str()),
        ("page_size", page_size.as_str()),
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
    let results = res.get("results").cloned().unwrap_or(Value::Array(vec![]));

    Ok(json!({
        "results": results,
        "page": page,
        "total_pages": total_pages(total, page),
        "total_results": total,
    }))
}

// ── GENRES ─────────────────────────────────────────────────
#[tauri::command]
pub async fn rawg_genres() -> Result<Value, String> {
    log::info!("[rawg] genres");
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
    log::info!("[rawg] details  id={}", id);
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

    log::info!("[rawg] details → name={:?}", detail.get("name"));
    Ok(detail)
}

#[cfg(test)]
mod tests {
    use super::total_pages;

    #[test]
    fn empty_result_still_reports_current_page() {
        assert_eq!(total_pages(0, 1), 1);
        assert_eq!(total_pages(0, 7), 7);
    }

    #[test]
    fn rounds_partial_pages_up() {
        assert_eq!(total_pages(20, 1), 1);
        assert_eq!(total_pages(21, 1), 2);
        assert_eq!(total_pages(41, 1), 3);
    }

    #[test]
    fn caps_deep_paging_at_rawg_limit() {
        assert_eq!(total_pages(1_000_000, 1), 500);
    }
}
