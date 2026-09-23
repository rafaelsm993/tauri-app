// Guard: app source, Rust and e2e stay English-only (GOALS §4.5); CSS is out of scope, opt out per line with `english-only: allow`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const DIRS = ["src", "src-tauri/src", "e2e"];
const EXT = /\.(svelte|ts|rs|html)$/;
const ACCENTS = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;
const WORDS =
  /\b(Buscar|Busque|Voltar|Filmes?|Livros?|Jogos?|Séries?|Sinopse|Elenco|Temporadas?|Carregar|Pesquisa|Explorar|Todos|Nenhum|Detalhes|Duração|Lançamento|Próximo|Anterior|Descobrir|Nenhum|Nenhuma|Carregando|Tentar|Limpar|Sem título|Ver todos|Erro|Categorias|avaliações|páginas)\b/;
const ALLOW = "english-only: allow";

function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (EXT.test(entry)) out.push(rel);
  }
  return out;
}

test("no Portuguese text in source, Rust or e2e", () => {
  const hits = [];
  for (const file of DIRS.flatMap((d) => walk(d))) {
    readFileSync(join(root, file), "utf8")
      .replace(/<style[\s\S]*?<\/style>/g, (css) => css.replace(/[^\n]/g, ""))
      .split("\n")
      .forEach((line, i) => {
        if (line.includes(ALLOW)) return;
        if (ACCENTS.test(line) || WORDS.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  assert.equal(hits.length, 0, `${hits.length} Portuguese line(s):\n${hits.join("\n")}`);
});
