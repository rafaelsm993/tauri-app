use reqwest::Client;
use serde_json::Value;

const BASE: &str = "https://api.themoviedb.org/3";

// ── API key resolution ─────────────────────────────────────
// Priority (highest → lowest):
//   1. Runtime env var TMDB_API_KEY (set in shell / CI / production)
//   2. Compile-time env var TMDB_API_KEY (embedded from .env by build.rs)
//   3. Panic with a clear message — no silent fallback to a hardcoded key
fn key() -> String {
    // Try runtime first (allows overriding without recompile)
    if let Ok(k) = std::env::var("TMDB_API_KEY") {
        if !k.is_empty() { return k; }
    }
    // Fall back to compile-time value embedded by build.rs
    let compile_time = env!("TMDB_API_KEY",
        "TMDB_API_KEY is not set. Add it to your .env file or set it as an environment variable.");
    if compile_time.is_empty() {
        panic!("TMDB_API_KEY is empty. Check your .env file.");
    }
    compile_time.to_string()
}

fn http() -> Client { Client::new() }

// ── SEARCH ─────────────────────────────────────────────────

#[tauri::command]
pub async fn search_movies(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[tmdb] search_movies  query={:?} page={}", query, page);
    let k = key(); let p = page.to_string();
    let res = http()
        .get(format!("{BASE}/search/movie"))
        .query(&[("api_key",&*k),("query",query),("language","pt-BR"),("page",&*p)])
        .send().await.map_err(|e| { eprintln!("[tmdb] ERROR: {e}"); e.to_string() })?
        .json::<Value>().await.map_err(|e| e.to_string())?;
    eprintln!("[tmdb] search_movies → {} results",
        res["results"].as_array().map(|a| a.len()).unwrap_or(0));
    Ok(res)
}

#[tauri::command]
pub async fn search_series(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[tmdb] search_series  query={:?} page={}", query, page);
    let k = key(); let p = page.to_string();
    let res = http()
        .get(format!("{BASE}/search/tv"))
        .query(&[("api_key",&*k),("query",query),("language","pt-BR"),("page",&*p)])
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())?;
    eprintln!("[tmdb] search_series → {} results",
        res["results"].as_array().map(|a| a.len()).unwrap_or(0));
    Ok(res)
}

// ── DISCOVER ───────────────────────────────────────────────

#[tauri::command]
pub async fn discover_movies(page: u32) -> Result<Value, String> {
    eprintln!("[tmdb] discover_movies  page={}", page);
    let k = key(); let p = page.to_string();
    let res = http()
        .get(format!("{BASE}/discover/movie"))
        .query(&[
            ("api_key",&*k),("language","pt-BR"),
            ("sort_by","popularity.desc"),("page",&*p),
            ("vote_count.gte","50"),
        ])
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())?;
    eprintln!("[tmdb] discover_movies → {} results, total_pages={}",
        res["results"].as_array().map(|a| a.len()).unwrap_or(0),
        res["total_pages"].as_u64().unwrap_or(0));
    Ok(res)
}

#[tauri::command]
pub async fn discover_series(page: u32) -> Result<Value, String> {
    eprintln!("[tmdb] discover_series  page={}", page);
    let k = key(); let p = page.to_string();
    let res = http()
        .get(format!("{BASE}/discover/tv"))
        .query(&[
            ("api_key",&*k),("language","pt-BR"),
            ("sort_by","popularity.desc"),("page",&*p),
            ("vote_count.gte","50"),
            ("without_genres","10767"),
        ])
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())?;
    eprintln!("[tmdb] discover_series → {} results",
        res["results"].as_array().map(|a| a.len()).unwrap_or(0));
    Ok(res)
}

// ── DETAILS ────────────────────────────────────────────────

#[tauri::command]
pub async fn movie_details(id: u32) -> Result<Value, String> {
    eprintln!("[tmdb] movie_details  id={}", id);
    let k = key();
    let res = http()
        .get(format!("{BASE}/movie/{id}"))
        .query(&[("api_key",&*k),("language","pt-BR"),("append_to_response","videos,credits")])
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())?;
    eprintln!("[tmdb] movie_details → title={:?}", res["title"]);
    Ok(res)
}

#[tauri::command]
pub async fn series_details(id: u32) -> Result<Value, String> {
    eprintln!("[tmdb] series_details  id={}", id);
    let k = key();
    let res = http()
        .get(format!("{BASE}/tv/{id}"))
        .query(&[("api_key",&*k),("language","pt-BR"),("append_to_response","videos,credits")])
        .send().await.map_err(|e| e.to_string())?
        .json::<Value>().await.map_err(|e| e.to_string())?;
    eprintln!("[tmdb] series_details → name={:?}", res["name"]);
    Ok(res)
}