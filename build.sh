#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/jackgreenberg/Desktop/rank-and-rent"
S="$ROOT/David/clones/scripts"
PROJ="$ROOT/commercial-roofing/commercialroofingcontractorslaredo-com"
REFHOST="pepperconstruction-com"
VOICE="$S/voice/commercial-roofing.json"
CFG="$PROJ/home.config.json"
MAP="$S/relabel-map-$REFHOST.json"
CAP="$ROOT/David/clones/_captures/$REFHOST-v1"

rm -rf "$PROJ/public/assets-f" "$PROJ/public/qa-out"
mkdir -p "$PROJ/public" "$PROJ/public/ours"
cp "$CAP/public/home.html.ref" "$PROJ/public/home.html.ref"
cp "$CAP/public/about.html.ref" "$PROJ/public/about.html.ref"
cp "$CAP/public/contact.html.ref" "$PROJ/public/contact.html.ref"
cp "$CAP/public/index.html.ref" "$PROJ/public/index.html.ref"
cp "$CAP/public/slug.html.ref" "$PROJ/public/slug.html.ref"
cp -R "$CAP/public/assets-f" "$PROJ/public/assets-f"
cp -R "$CAP/qa-out" "$PROJ/public/qa-out"

rm -rf "$PROJ/public/ours"
cp -R "$PROJ/public/images" "$PROJ/public/ours"

python3 "$S/normalize_content.py" "$PROJ" --voice "$VOICE"
python3 "$S/relabel_engine.py" --config "$CFG" --map "$MAP" --voice "$VOICE"
mkdir -p "$PROJ/qa-out"
python3 "$S/verify_site.py" "$PROJ" --map "$MAP" --json "$PROJ/qa-out/verify.json"
node "$S/qa_shots.mjs" "$PROJ"
