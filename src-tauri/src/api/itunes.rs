use super::http::{client as http, fetch_json};
use serde_json::Value;

const BASE: &str = "https://itunes.apple.com";
const PAGE_SIZE: u32 = 20;
const COUNTRY: &str = "us";

// Folds the genre keyword into the term; Apple ignores `genreId` for ebooks.
fn search_term(query: &str, genre: Option<&str>) -> String {
    let trimmed = query.trim();
    let has_query = !trimmed.is_empty() && trimmed != "popular";
    let genre_kw = genre.map(str::trim).filter(|s| !s.is_empty());
    match (has_query, genre_kw) {
        (true, Some(g)) => format!("{trimmed} {g}"),
        (true, None) => trimmed.to_string(),
        (false, Some(g)) => g.to_string(),
        (false, None) => "fiction".to_string(),
    }
}

#[tauri::command]
pub async fn itunes_search(query: &str, page: u32, genre: Option<String>) -> Result<Value, String> {
    log::debug!(
        "[itunes] search  query={:?} page={} genre={:?}",
        query,
        page,
        genre
    );
    let term = search_term(query, genre.as_deref());

    let offset = ((page.saturating_sub(1)) * PAGE_SIZE).to_string();
    let limit = PAGE_SIZE.to_string();

    let res = fetch_json(
        "itunes",
        "search",
        http().get(format!("{BASE}/search")).query(&[
            ("media", "ebook"),
            ("country", COUNTRY),
            ("term", term.as_str()),
            ("limit", limit.as_str()),
            ("offset", offset.as_str()),
        ]),
    )
    .await?;

    log::debug!(
        "[itunes] search → {} results (term={:?})",
        res["resultCount"].as_u64().unwrap_or(0),
        term
    );
    Ok(res)
}

// Omits the media filter because /lookup is brittle with media=ebook.
#[tauri::command]
pub async fn itunes_details(id: &str) -> Result<Value, String> {
    log::debug!("[itunes] details  id={}", id);
    let res = fetch_json(
        "itunes",
        "details",
        http()
            .get(format!("{BASE}/lookup"))
            .query(&[("id", id), ("country", COUNTRY)]),
    )
    .await?;

    let first = res
        .get("results")
        .and_then(|r| r.as_array())
        .and_then(|arr| arr.first())
        .cloned()
        .ok_or_else(|| "Book not found.".to_string())?;

    log::debug!("[itunes] details → name={:?}", first.get("trackName"));
    Ok(first)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_term_combines_query_and_genre() {
        assert_eq!(
            search_term("dune", Some("science fiction")),
            "dune science fiction"
        );
        assert_eq!(search_term("  dune  ", None), "dune");
        assert_eq!(search_term("popular", Some("mystery")), "mystery");
        assert_eq!(search_term("", Some("  ")), "fiction");
    }

    #[test]
    fn uses_the_us_store() {
        assert_eq!(COUNTRY, "us");
    }
}
