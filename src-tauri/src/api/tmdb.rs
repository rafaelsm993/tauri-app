use reqwest::Client;
use serde_json::Value;

const BASE: &str = "https://api.themoviedb.org/3";
const LANG: &str = "pt-BR";

// TMDB API key is loaded at compile time via build.rs from `.env`.
fn api_key() -> String {
    std::env::var("TMDB_API_KEY").unwrap_or_else(|_| env!("TMDB_API_KEY").to_string())
}

fn http() -> Client {
    Client::new()
}

// ── MOVIES ─────────────────────────────────────────────────
// `genre` is an optional TMDB genre id. When supplied we switch to the
// /discover/movie endpoint with `with_genres`; otherwise we use /movie/popular.
#[tauri::command]
pub async fn tmdb_discover_movies(page: u32, genre: Option<u32>) -> Result<Value, String> {
    eprintln!("[tmdb] discover_movies  page={} genre={:?}", page, genre);
    let key = api_key();
    let p = page.to_string();
    let req = if let Some(gid) = genre {
        let g = gid.to_string();
        http()
            .get(format!("{BASE}/discover/movie"))
            .query(&[
                ("api_key", key.as_str()),
                ("language", LANG),
                ("page", p.as_str()),
                ("sort_by", "popularity.desc"),
                ("include_adult", "false"),
                ("with_genres", g.as_str()),
            ])
            .send()
    } else {
        http()
            .get(format!("{BASE}/movie/popular"))
            .query(&[
                ("api_key", key.as_str()),
                ("language", LANG),
                ("page", p.as_str()),
            ])
            .send()
    };
    let res = req
        .await
        .map_err(|e| {
            eprintln!("[tmdb] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_genres_movies() -> Result<Value, String> {
    eprintln!("[tmdb] genres_movies");
    let key = api_key();
    let res = http()
        .get(format!("{BASE}/genre/movie/list"))
        .query(&[("api_key", key.as_str()), ("language", LANG)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_search_movies(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[tmdb] search_movies  query={:?} page={}", query, page);
    let key = api_key();
    let p = page.to_string();
    let res = http()
        .get(format!("{BASE}/search/movie"))
        .query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("query", query),
            ("page", p.as_str()),
            ("include_adult", "false"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_movie_details(id: u32) -> Result<Value, String> {
    eprintln!("[tmdb] movie_details  id={}", id);
    let key = api_key();
    let res = http()
        .get(format!("{BASE}/movie/{id}"))
        .query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("append_to_response", "credits,videos"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

// ── TV SERIES ──────────────────────────────────────────────
#[tauri::command]
pub async fn tmdb_discover_tv(page: u32, genre: Option<u32>) -> Result<Value, String> {
    eprintln!("[tmdb] discover_tv  page={} genre={:?}", page, genre);
    let key = api_key();
    let p = page.to_string();
    let req = if let Some(gid) = genre {
        let g = gid.to_string();
        http()
            .get(format!("{BASE}/discover/tv"))
            .query(&[
                ("api_key", key.as_str()),
                ("language", LANG),
                ("page", p.as_str()),
                ("sort_by", "popularity.desc"),
                ("include_adult", "false"),
                ("with_genres", g.as_str()),
            ])
            .send()
    } else {
        http()
            .get(format!("{BASE}/tv/popular"))
            .query(&[
                ("api_key", key.as_str()),
                ("language", LANG),
                ("page", p.as_str()),
            ])
            .send()
    };
    let res = req
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_genres_tv() -> Result<Value, String> {
    eprintln!("[tmdb] genres_tv");
    let key = api_key();
    let res = http()
        .get(format!("{BASE}/genre/tv/list"))
        .query(&[("api_key", key.as_str()), ("language", LANG)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_search_tv(query: &str, page: u32) -> Result<Value, String> {
    eprintln!("[tmdb] search_tv  query={:?} page={}", query, page);
    let key = api_key();
    let p = page.to_string();
    let res = http()
        .get(format!("{BASE}/search/tv"))
        .query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("query", query),
            ("page", p.as_str()),
            ("include_adult", "false"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}

#[tauri::command]
pub async fn tmdb_tv_details(id: u32) -> Result<Value, String> {
    eprintln!("[tmdb] tv_details  id={}", id);
    let key = api_key();
    let res = http()
        .get(format!("{BASE}/tv/{id}"))
        .query(&[
            ("api_key", key.as_str()),
            ("language", LANG),
            ("append_to_response", "credits,videos"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    // Surface TMDB error envelopes so the UI sees real messages.
    if let Some(status_msg) = res.get("status_message").and_then(|v| v.as_str()) {
        return Err(status_msg.to_string());
    }
    Ok(res)
}
