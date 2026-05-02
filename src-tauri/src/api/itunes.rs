use reqwest::Client;
use serde_json::Value;

const BASE: &str = "https://itunes.apple.com";
const PAGE_SIZE: u32 = 20;

// iTunes Search API — fully public, keyless, no daily quota documented.
fn http() -> Client {
    Client::new()
}

// ── SEARCH ─────────────────────────────────────────────────
// /search supports media + term + limit + offset. Apple's `genreId` filter
// is silently ignored for `media=ebook`, so the only way to narrow by genre
// is to bake a Portuguese keyword into the `term` itself and let Apple's
// relevance ranking do the filtering. The frontend ships those keywords as
// the `genre` argument (e.g. "romance", "fantasia", "mistério").
#[tauri::command]
pub async fn itunes_search(query: &str, page: u32, genre: Option<String>) -> Result<Value, String> {
    eprintln!(
        "[itunes] search  query={:?} page={} genre={:?}",
        query, page, genre
    );
    let trimmed = query.trim();
    let has_query = !trimmed.is_empty() && trimmed != "popular";
    let genre_kw = genre.as_deref().map(str::trim).filter(|s| !s.is_empty());

    let term = match (has_query, genre_kw) {
        (true, Some(g)) => format!("{trimmed} {g}"),
        (true, None) => trimmed.to_string(),
        (false, Some(g)) => g.to_string(),
        (false, None) => "fiction".to_string(),
    };

    let offset = ((page.saturating_sub(1)) * PAGE_SIZE).to_string();
    let limit = PAGE_SIZE.to_string();

    let res = http()
        .get(format!("{BASE}/search"))
        .query(&[
            ("media", "ebook"),
            ("term", term.as_str()),
            ("limit", limit.as_str()),
            ("offset", offset.as_str()),
        ])
        .send()
        .await
        .map_err(|e| {
            eprintln!("[itunes] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    eprintln!(
        "[itunes] search → {} results (term={:?})",
        res["resultCount"].as_u64().unwrap_or(0),
        term
    );
    Ok(res)
}

// ── DETAILS ────────────────────────────────────────────────
// /lookup?id={trackId} returns a single result. We omit media filter because
// /lookup is brittle when combined with media=ebook.
#[tauri::command]
pub async fn itunes_details(id: &str) -> Result<Value, String> {
    eprintln!("[itunes] details  id={}", id);
    let res = http()
        .get(format!("{BASE}/lookup"))
        .query(&[("id", id)])
        .send()
        .await
        .map_err(|e| {
            eprintln!("[itunes] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;

    let first = res
        .get("results")
        .and_then(|r| r.as_array())
        .and_then(|arr| arr.first())
        .cloned()
        .ok_or_else(|| "Livro não encontrado.".to_string())?;

    eprintln!("[itunes] details → name={:?}", first.get("trackName"));
    Ok(first)
}
