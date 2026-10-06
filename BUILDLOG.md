# BUILDLOG: prommer-booker-kit

Run date: 2026-10-06. Clock started 21:44:10 local shell time. Hard stop 22:09:10.
Each entry: time, what happened, why, evidence (command and output).

## 21:44:10 Tooling check

- node v24.11.0, npm 11.6.1, Python 3.13.14, git 2.52.0, gh 2.101.0.
- `gh auth status`: logged in to github.com as mrayyan6, scopes gist, read:org, repo, workflow. The token is masked by gh and not recorded here.
- Vercel CLI: not on PATH.
- Decision: deploy to GitHub Pages. Why: the user said "Deploy via my github credentials", and Vercel is unavailable anyway, so the brief's fallback and the user's instruction agree.
- Decision: project folder `prommer-booker-kit/`, same name as the future repo. Why: the repo root holds kit files only.
- Decision: browser checks will use playwright-core driving the installed Chrome, installed in `verify/` with its own package.json. Why: the shipped page stays zero dependency; the harness never ships. Install exit code 0.
- skill-creator found at `~/.claude/skills/synced/<id>/skill-creator/` (a byte-identical copy also sits in the official plugin marketplace; `cmp` reported "same" for grader.md, comparator.md, analyzer.md, schemas.md, generate_review.py). Read `references/schemas.md` and `agents/grader.md`. Note for Phase 4: the grader writes `{outputs_dir}/../grading.json`.

## 21:44 Phase 1.1 Redirect retest (the reported "too many redirects")

Commands, run per URL:

- No jar: `curl -sS -L --max-redirs 10 -o /dev/null -D - -w 'RESULT final=%{url_effective} code=%{http_code} redirects=%{num_redirects}\n' URL`
- Cookie jar: `curl -sS -L -c jar.txt -b jar.txt -o /dev/null -D - -w (same format) URL`

Output:

- `https://prommer.net/`: `HTTP/1.1 200 OK`, redirects=0, both modes.
- `https://prommer.net/en/tech/`: `HTTP/1.1 200 OK`, redirects=0, both modes.
- `https://prommer.net/en/tech/press/`: `HTTP/1.1 200 OK`, redirects=0, both modes.
- Redirect chain: zero hops. No Set-Cookie header on any response, so cookies cannot be the trigger.

Fresh browser session (new, empty Chrome profile per URL):
`chrome.exe --headless=new --user-data-dir=<new empty dir> --virtual-time-budget=8000 --dump-dom URL`

- `/en/tech/`: exit 0, DOM 149,288 bytes, title "CTO & AI Leadership Consulting Services", 0 matches for TOO_MANY_REDIRECTS.
- `/en/tech/press/`: exit 0, DOM 117,018 bytes, title "Thomas Prommer | Press & Newsroom", 0 matches.

Verdict: not a bug by the brief's rule, because a fresh browser session loads both pages.

Variant and user agent sweep, to find what the original fetch could have hit:

- `https://prommer.net/en/tech` (no trailing slash): `HTTP/1.1 301 Moved Permanently`, `Location: http://prommer.net/en/tech/`. The redirect downgrades https to http. Same for `https://prommer.net/en/tech/press`. Server: cloudflare. HSTS header present (`max-age=63072000; includeSubDomains; preload`).
- `http://prommer.net/en/tech/`: 301 to `https://prommer.net/en/tech/`, then 200.
- `https://www.prommer.net/en/tech/press/`: `HTTP/1.1 200 OK` with no redirect to the apex host (duplicate host).
- User agents `Claude-User/1.0`, `ClaudeBot/1.0`, `python-requests/2.32` on `/en/tech/press/`: all 200, redirects=0.

Hypothesis, not proven: a client that drops trailing slashes and forces https would loop (`https://.../tech` to `http://.../tech/`, upgraded and normalized back to `https://.../tech`, repeat). That fits "too many redirects" from a fetch tool while curl and browsers succeed. Logged as a redirect hygiene finding, not as an outage.

## 21:46 Phase 1.3 Stop condition: a media kit already exists

Command: `curl -sS -L -c jar.txt -b jar.txt -o press.html https://prommer.net/en/tech/press/` returned 200, 113,611 bytes. Then a keyword grep and a stdlib-only Python section extractor.

Evidence:

- `grep -o -i -E 'media kit|headshot|download|...' press.html | sort | uniq -c`: 2 "Media Kit", 7 "headshot", 5 "download".
- Section heading "Biography & Media Kit" with copy buttons whose payloads sit in `data-text` attributes:
  - One-Liner: 25 words.
  - "Short Bio (150 words)": the payload is 66 words, so the label is wrong.
  - Full Bio: 187 words.
- "Headshots. For editorial and press use. Click a photo to download full resolution." Four `download` links to `/img/thomas-prommer-press-*.jpg`.
- "Press & Media Contact. For interviews, speaking engagements, or press inquiries, reach out directly." Links: `#contact` (form), `/en/tech/profile/`, LinkedIn, X.
- Page meta: `robots = noindex, follow`, and two `<link rel="canonical">` tags.

Decision: STOP, as brief step 3 requires, and ask the user how to proceed. Nothing built, nothing deployed, no repo created. AUDIT.md and facts.json not started.

## Things I got wrong so far

- `pageinfo.py` crashed printing U+2197 to the Windows console (cp1252). Setting `PYTHONIOENCODING` did nothing because `python -I` ignores PYTHON* environment variables. Fix: run with `python -I -X utf8`.

## 21:56:19 Restart: option 1, cut down. Hard stop 22:08:19

- Scope per user: a complement page only (five angles, proof numbers, download as .md) that links to the press page for bios, headshots and contact. Skipped per user: bios, comparator, analyzer, eval viewer, screenshots.
- Wrong input caught: the three interview questions arrived as literal placeholders (`<question 1>`, `<question 2>`, `<question 3>`). Decision: do not ship them and do not write my own. Asked the user with AskUserQuestion. Answer: "Ship without questions". facts.json records `questions_omitted: true`. build.mjs still treats `{{HUMAN ...}}` and `<question N>` as unfilled markers and exits 1 on either.
- Angles: 8 candidates from the press page coverage list, fetched in parallel by 8 subagents, one `curl -sS -L -m 60` each, no retries. Excluded before fetching: Sportschau and the GLP-1 piece (health). Result: 7 readable (HTTP 200); Spiceworks dropped (HTTP 504 from Cloudflare). Workflow duration 29.6 s.
- Picked 5 of 7 for relevance to AI in operations: CTO Craft (guest essay by Prommer), CIO.com twice, CIO.inc, Business Insider (quoted in each). Dropped Okoone (same angle as the CIO.com incremental gains piece) and VC Magazine (identity verification, off topic).
- Sentences are subagent paraphrases that I edited to 30 words or fewer with no quotation marks; the CTO Craft one was 31 words, so I cut "this quarter". Dates come from JSON-LD datePublished, article:published_time, or the visible byline (CIO.inc has no date metadata).
- Proof numbers: 4 values from the press page bio text, as of 2026-10-06 (the fetch date). Each has a verbatim evidence snippet under 15 words in facts.json. Labels are restated; no bio text is copied onto the page.
- Decision: no CSS custom properties and no HTML comments, literal colors only. Why: house style forbids double hyphens, so build.mjs fails on any double hyphen, em dash or en dash in the page text.
- Decision: the .md is generated at build time from facts.json and embedded in a `<script type="text/markdown">`. Why: one file, and the download can never drift from the page.
- Decision: commits use the GitHub noreply address for mrayyan6 (id 157478061), set repo-local. Why: no personal email in public commit metadata.

## 22:01 Build and 390px check (v1)

- Wrong: the first build failed with "external resource reference found". Cause: my own guard matched `url(` inside `URL.createObjectURL(` in the JS. Fix: run the `url(` and `@import` check on the CSS only. Rebuild: `OK index.html 9927 bytes: 5 angles, 4 numbers, 0 questions`.
- `node verify/check.mjs` (fresh Chrome context, 390x844): scrollWidth 390, clientWidth 390, so no horizontal scroll. Tab reached the download button; Enter saved `prommer-booker-kit.md` (2,516 bytes, 5 angle lines, 4 number lines, footer present). 1 request in total, 0 third party. Saved as `verify/results-local.json`.
- Marker guard: `node build.mjs <copy of facts.json with "{{HUMAN: question 1}}">` printed `unfilled question markers: {{HUMAN: question 1}}` and exited 1; `cmp` showed index.html unchanged.

## 22:02 Deploy (v1)

- git init on main, repo-local noreply identity, commit, tag v1, `gh repo create prommer-booker-kit --public --source . --push`, then GitHub Pages enabled from main at `/`. `.nojekyll` makes Pages serve files as they are.
- Result: repo https://github.com/mrayyan6/prommer-booker-kit, Pages https://mrayyan6.github.io/prommer-booker-kit/. Pages build status went from `building` to `built` in about 60 s; polls returned 404 from 22:02:13 to 22:02:59, then `http=200` at 22:03:10. `curl -sS URL | cmp - index.html` printed no difference, so the served page is the repo's index.html.

## 22:03 Verify (v1)

- 6 expectations in the skill-creator evals.json format in `evals/evals.json`. The grader subagent follows `agents/grader.md` with BUILDLOG.md as the transcript and the repo as outputs_dir. It runs the marker guard, `verify/check.mjs` against the live URL, and curl.

## 22:04 Grading result (v1)

- grader.md verdict: 6 of 6 expectations passed (pass_rate 1.0). Saved as `evals/grading-v1.json`, with local user paths replaced by `~`.
- Fix step: nothing failed, so there is no v2. Tag v1 is the shipped version.
- The grader's critique of my evals, kept as open items:
  - All four proof numbers cite his own press page. None is independently corroborated.
  - No expectation checks the angle sentences against the articles. They rest on the fetch subagents' reading plus the evidence snippets in facts.json.
  - The questions section is absent by the applicant's decision (recorded in facts.json and above), and no expectation covers that.
  - The grader's marker test also tripped the question count check ("expected 3 questions, found 1"). My 22:01 test kept `questions_omitted: true` and failed on the marker alone.
- Not done, per the cut-down brief: bios, comparator, analyzer, eval viewer, screenshots, a separate AUDIT.md (the audit evidence that exists is in this log).

## 22:04 Privacy check

- Wrong: my check for local user paths (`grep -i rayya`) matched the public login `mrayyan6` in BUILDLOG.md and verify/results-grader.json, a false positive. Worse, my command chain pushed before acting on the count. Fix: a narrower check (`grep -E '[Cc]:[\/]+Users|/c/Users|AppData'`) found 0 files with local paths. From now on, the push runs only after the check passes.
