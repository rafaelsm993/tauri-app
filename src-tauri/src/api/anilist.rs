use reqwest::Client;
use serde_json::{json, Value};

const ENDPOINT: &str = "https://graphql.anilist.co";

// AniList caps Page.perPage at 50; we use 20 to match the other providers.
const PAGE_SIZE: u32 = 20;

// Shared media fields used by both list and search queries.
const MEDIA_LIST_FIELDS: &str = r#"
    id
    type
    format
    status
    episodes
    chapters
    volumes
    averageScore
    popularity
    genres
    bannerImage
    coverImage { extraLarge large medium }
    title { romaji english native userPreferred }
    startDate { year month day }
    description(asHtml: false)
"#;

const MEDIA_DETAIL_FIELDS: &str = r#"
    id
    type
    format
    status
    episodes
    chapters
    volumes
    duration
    averageScore
    meanScore
    popularity
    favourites
    genres
    bannerImage
    coverImage { extraLarge large medium }
    title { romaji english native userPreferred }
    startDate { year month day }
    endDate { year month day }
    season
    seasonYear
    description(asHtml: false)
    siteUrl
    studios(isMain: true) { nodes { id name } }
    staff(perPage: 6) { edges { role node { id name { full } } } }
    characters(perPage: 20, sort: ROLE) {
      edges {
        role
        node { id name { full } image { large medium } }
      }
    }
    trailer { id site thumbnail }
"#;

fn http() -> Client {
    Client::builder()
        .user_agent("TauriFlix/1.0")
        .build()
        .unwrap_or_else(|_| Client::new())
}

// AniList returns errors in `{ errors: [{ message }] }`. Surface them as Err.
fn check_graphql(v: &Value) -> Result<(), String> {
    if let Some(arr) = v.get("errors").and_then(|e| e.as_array()) {
        if !arr.is_empty() {
            let msg = arr
                .iter()
                .filter_map(|e| e.get("message").and_then(|m| m.as_str()))
                .collect::<Vec<_>>()
                .join("; ");
            return Err(format!("AniList: {}", msg));
        }
    }
    Ok(())
}

async fn graphql(query: &str, variables: Value) -> Result<Value, String> {
    let body = json!({ "query": query, "variables": variables });
    let res = http()
        .post(ENDPOINT)
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            eprintln!("[anilist] ERROR: {e}");
            e.to_string()
        })?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    check_graphql(&res)?;
    Ok(res)
}

// Build the list/search query. When no search term is provided we sort by
// popularity so the discover view is meaningful (mirrors the other providers).
fn list_query(media_type: &str) -> String {
    format!(
        r#"
        query ($page: Int, $perPage: Int, $search: String, $genre: String, $sort: [MediaSort]) {{
          Page(page: $page, perPage: $perPage) {{
            pageInfo {{ total currentPage lastPage hasNextPage perPage }}
            media(type: {media_type}, search: $search, genre: $genre, sort: $sort, isAdult: false) {{
              {fields}
            }}
          }}
        }}
        "#,
        media_type = media_type,
        fields = MEDIA_LIST_FIELDS
    )
}

fn detail_query() -> String {
    format!(
        r#"
        query ($id: Int) {{
          Media(id: $id) {{
            {fields}
          }}
        }}
        "#,
        fields = MEDIA_DETAIL_FIELDS
    )
}

async fn run_list(
    media_type: &str,
    query: &str,
    page: u32,
    genre: Option<String>,
) -> Result<Value, String> {
    let has_query = !query.trim().is_empty();
    // Search relevance handles ordering when the user typed something;
    // otherwise we explicitly request popularity-desc.
    let sort: Vec<&str> = if has_query {
        vec!["SEARCH_MATCH"]
    } else {
        vec!["POPULARITY_DESC"]
    };

    let mut vars = json!({
        "page": page,
        "perPage": PAGE_SIZE,
        "sort": sort,
    });
    if has_query {
        vars["search"] = json!(query);
    }
    if let Some(g) = genre.as_ref().filter(|s| !s.is_empty()) {
        vars["genre"] = json!(g);
    }

    graphql(&list_query(media_type), vars).await
}

// ── ANIME ─────────────────────────────────────────────────
#[tauri::command]
pub async fn anilist_search_anime(
    query: &str,
    page: u32,
    genre: Option<String>,
) -> Result<Value, String> {
    eprintln!(
        "[anilist] search_anime  query={:?} page={} genre={:?}",
        query, page, genre
    );
    run_list("ANIME", query, page, genre).await
}

#[tauri::command]
pub async fn anilist_anime_details(id: u32) -> Result<Value, String> {
    eprintln!("[anilist] anime_details  id={}", id);
    let res = graphql(&detail_query(), json!({ "id": id })).await?;
    res.get("data")
        .and_then(|d| d.get("Media"))
        .cloned()
        .ok_or_else(|| "Anime não encontrado.".to_string())
}

// ── MANGA ─────────────────────────────────────────────────
#[tauri::command]
pub async fn anilist_search_manga(
    query: &str,
    page: u32,
    genre: Option<String>,
) -> Result<Value, String> {
    eprintln!(
        "[anilist] search_manga  query={:?} page={} genre={:?}",
        query, page, genre
    );
    run_list("MANGA", query, page, genre).await
}

#[tauri::command]
pub async fn anilist_manga_details(id: u32) -> Result<Value, String> {
    eprintln!("[anilist] manga_details  id={}", id);
    let res = graphql(&detail_query(), json!({ "id": id })).await?;
    res.get("data")
        .and_then(|d| d.get("Media"))
        .cloned()
        .ok_or_else(|| "Mangá não encontrado.".to_string())
}

// ── GENRES ────────────────────────────────────────────────
// AniList exposes a single `GenreCollection` shared by anime and manga.
#[tauri::command]
pub async fn anilist_genres() -> Result<Value, String> {
    eprintln!("[anilist] genres");
    let res = graphql("query { GenreCollection }", json!({})).await?;
    Ok(res
        .get("data")
        .and_then(|d| d.get("GenreCollection"))
        .cloned()
        .unwrap_or(Value::Array(vec![])))
}
