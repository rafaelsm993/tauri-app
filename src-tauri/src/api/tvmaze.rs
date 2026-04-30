use reqwest::Client;
use serde_json::{json, Value};

const BASE: &str = "https://api.tvmaze.com";

// TVmaze is fully public — no API key required.
fn http() -> Client {
    Client::new()
}

// ── SEARCH ─────────────────────────────────────────────────
// TVmaze /search/shows returns ALL matches in one response (no pagination).
// We unwrap the [{ score, show }, ...] envelope into a flat list of shows.
#[tauri::command]
pub async fn tvmaze_search_shows(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[tvmaze] search_shows  query={:?} page={}", query, page);
    let res = http()
        .get(format!("{BASE}/search/shows"))
        .query(&[("q", query)])
        .send()
        .await
        .map_err(|e| {
            eprintln!("[tvmaze] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    let shows: Vec<Value> = res
        .as_array()
        .map(|arr| arr.iter().filter_map(|x| x.get("show").cloned()).collect())
        .unwrap_or_default();

    eprintln!("[tvmaze] search_shows → {} results", shows.len());

    // Wrap into the same paginated envelope the frontend expects.
    Ok(json!({
        "results": shows,
        "page": page,
        "total_pages": 1,
        "total_results": res.as_array().map(|a| a.len()).unwrap_or(0),
    }))
}

// ── DISCOVER ───────────────────────────────────────────────
// TVmaze has no "popular" endpoint. We use the show index (/shows?page=N)
// and sort each page client-side by `weight` to surface popular titles first.
// Each page contains up to 250 shows (paginated by ID).
#[tauri::command]
pub async fn tvmaze_discover_shows(page: u32) -> Result<Value, String> {
    eprintln!("[tvmaze] discover_shows  page={}", page);
    // TVmaze pages are 0-indexed; our app uses 1-indexed.
    let api_page = page.saturating_sub(1);
    let p = api_page.to_string();
    let res = http()
        .get(format!("{BASE}/shows"))
        .query(&[("page", &*p)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(json!({ "results": [], "page": page, "total_pages": page, "total_results": 0 }));
    }

    let mut shows: Vec<Value> = res
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?
        .as_array()
        .cloned()
        .unwrap_or_default();

    // Sort by weight desc so popular shows appear first.
    shows.sort_by(|a, b| {
        let wa = a.get("weight").and_then(|v| v.as_i64()).unwrap_or(0);
        let wb = b.get("weight").and_then(|v| v.as_i64()).unwrap_or(0);
        wb.cmp(&wa)
    });

    eprintln!("[tvmaze] discover_shows → {} results", shows.len());

    // We don't know the true total — advertise a generous cap so infinite
    // scroll keeps requesting pages until the API returns 404 (handled above).
    Ok(json!({
        "results": shows,
        "page": page,
        "total_pages": 100,
        "total_results": shows.len(),
    }))
}

// ── DETAILS ────────────────────────────────────────────────
// Embed cast (and episodes for runtime/episode count fallbacks).
#[tauri::command]
pub async fn tvmaze_show_details(id: u32) -> Result<Value, String> {
    eprintln!("[tvmaze] show_details  id={}", id);
    let res = http()
        .get(format!("{BASE}/shows/{id}"))
        .query(&[("embed[]", "cast"), ("embed[]", "episodes")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    eprintln!("[tvmaze] show_details → name={:?}", res["name"]);
    Ok(res)
}
