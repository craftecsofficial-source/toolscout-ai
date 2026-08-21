#!/usr/bin/env python3
"""Fetches real AI news from reputable RSS feeds and rewrites the AI_INSIGHTS
block in build.py (between the AI_INSIGHTS_START / AI_INSIGHTS_END markers)
with the 5 most recent, source-diverse items. No API keys, no fabricated
content -- every item comes straight from a real feed entry.

Run from the repo root: python scripts/update_ai_insights.py
"""
import re
import json
import html
import datetime
import urllib.request

FEEDS = [
    ("TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("VentureBeat", "https://venturebeat.com/category/ai/feed/"),
    ("Ars Technica", "https://arstechnica.com/tag/ai/feed/"),
    ("MIT Technology Review", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
]

BUILD_PY = "build.py"


def strip_html(raw):
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def truncate(text, limit=260):
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(".,;: ") + "..."


def parse_rfc822(date_str):
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.datetime.strptime(date_str, fmt)
        except Exception:
            continue
    return None


def fetch_feed_entries(source_name, url):
    entries = []
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ToolScout AI insights bot)"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"WARN: could not fetch {source_name} ({url}): {e}")
        return entries

    items = re.findall(r"<item>(.*?)</item>", raw, re.S) or re.findall(r"<entry>(.*?)</entry>", raw, re.S)
    for item in items[:8]:
        title_m = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", item, re.S)
        link_m = re.search(r"<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</link>", item, re.S)
        if not link_m:
            link_m = re.search(r'<link[^>]*href="([^"]+)"', item)
        desc_m = re.search(r"<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>", item, re.S)
        if not desc_m:
            desc_m = re.search(r"<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</summary>", item, re.S)
        date_m = re.search(r"<pubDate>(.*?)</pubDate>", item, re.S) or re.search(r"<published>(.*?)</published>", item, re.S) or re.search(r"<updated>(.*?)</updated>", item, re.S)

        if not (title_m and link_m):
            continue
        title = strip_html(title_m.group(1))
        link = strip_html(link_m.group(1))
        summary = truncate(strip_html(desc_m.group(1))) if desc_m else ""
        dt = parse_rfc822(date_m.group(1).strip()) if date_m else None
        entries.append({
            "title": title,
            "source_name": source_name,
            "source_url": link,
            "summary": summary,
            "dt": dt,
        })
    return entries


def build_insights():
    all_entries = []
    for name, url in FEEDS:
        all_entries.extend(fetch_feed_entries(name, url))

    now = datetime.datetime.now(datetime.timezone.utc)
    dated = [e for e in all_entries if e["dt"] is not None]
    dated.sort(key=lambda e: e["dt"], reverse=True)
    undated = [e for e in all_entries if e["dt"] is None]

    ordered = dated + undated

    picked = []
    per_source = {}
    seen_titles = set()
    for e in ordered:
        key = e["title"].lower()[:60]
        if key in seen_titles:
            continue
        if per_source.get(e["source_name"], 0) >= 2:
            continue
        if not e["summary"]:
            continue
        picked.append(e)
        seen_titles.add(key)
        per_source[e["source_name"]] = per_source.get(e["source_name"], 0) + 1
        if len(picked) >= 5:
            break

    insights = []
    for e in picked:
        date_str = e["dt"].strftime("%b %d, %Y") if e["dt"] else now.strftime("%b %d, %Y")
        insights.append({
            "title": e["title"],
            "summary": e["summary"],
            "source_name": e["source_name"],
            "source_url": e["source_url"],
            "date": date_str,
        })
    return insights, now


def update_build_py(insights, now):
    with open(BUILD_PY, encoding="utf-8") as f:
        content = f.read()

    updated_str = now.strftime("%B %d, %Y")
    new_updated_line = f'AI_INSIGHTS_UPDATED = "{updated_str}"'
    content = re.sub(r'AI_INSIGHTS_UPDATED = "[^"]*"', new_updated_line, content, count=1)

    insights_json = json.dumps(insights, indent=4, ensure_ascii=False)
    new_block = f"AI_INSIGHTS = {insights_json}"

    # Only replace the AI_INSIGHTS = [...] list literal itself, anchored to the
    # END marker -- this leaves AI_INSIGHTS_UPDATED, the START marker, and its
    # explanatory comment line completely untouched.
    pattern = re.compile(r"AI_INSIGHTS = \[.*?\]\n# AI_INSIGHTS_END", re.S)
    if not pattern.search(content):
        raise SystemExit("Could not find the AI_INSIGHTS list / AI_INSIGHTS_END marker in build.py -- aborting without changes.")

    content = pattern.sub(lambda m: new_block + "\n# AI_INSIGHTS_END", content, count=1)

    with open(BUILD_PY, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Updated AI_INSIGHTS with {len(insights)} items, dated {updated_str}.")
    for i in insights:
        print(f" - {i['title']} ({i['source_name']}, {i['date']})")


if __name__ == "__main__":
    insights, now = build_insights()
    if len(insights) < 3:
        print(f"Only found {len(insights)} usable, source-diverse items -- keeping existing AI_INSIGHTS untouched to avoid a weak update.")
    else:
        update_build_py(insights, now)
