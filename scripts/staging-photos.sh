#!/usr/bin/env bash
# Copy the website's uploaded pictures (the "site" bucket: gallery, catalogue photos, spec sheets)
# from production's storage into staging's, then check each copy byte for byte. Safe to run again
# (it overwrites). Pictures of people (the "photos" bucket: riders' and staff profile photos) are
# never copied.
#
#   bash scripts/staging-photos.sh
#
# Asks for production's Session pooler string (to list the files; nothing is written there) and
# the STAGING project's service_role key (Settings > API Keys > Legacy API keys > service_role).
set -euo pipefail
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
PROD_REF=qpffkzmsfyilicwcsszz
STG_REF=jkfhiszcnuvoftvkzaye
BUCKET=site
die() { printf '\n\033[31mSTOPPED: %s\033[0m\n' "$*"; exit 1; }

read -rp "PRODUCTION database connection string (Session pooler): " PROD_DB_URL
read -rp "STAGING service_role key: " KEY
[[ "$PROD_DB_URL" == *"$PROD_REF"* ]] || die "the PRODUCTION string does not contain $PROD_REF"
[[ -n "$KEY" ]] || die "no key"
role=$(printf '%s' "${KEY#*.}" | cut -d. -f1 | tr '_-' '/+' | base64 -d 2>/dev/null | sed -nE 's/.*"ref":"([a-z0-9]+)".*/\1/p' || true)
[[ -z "$role" || "$role" == "$STG_REF" ]] || die "that key belongs to $role, not staging ($STG_REF)"
hdr=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
psql "$PROD_DB_URL" -qAt -F $'\t' -c "select name, coalesce(metadata->>'mimetype', '') from storage.objects where bucket_id = '$BUCKET' and name not like '.%' and name not like '%/.%' order by 1" > "$tmp/names.txt"
total=$(wc -l < "$tmp/names.txt" | tr -d ' '); ok=0; bad=0
echo "$total files to copy from $BUCKET"

while IFS=$'\t' read -r name ct; do
  [[ -z "$name" ]] && continue
  [[ -n "$ct" ]] || ct=application/octet-stream
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$name")
  curl -fsS "https://$PROD_REF.supabase.co/storage/v1/object/public/$BUCKET/$enc" -o "$tmp/f" || { echo "  FAIL download $name"; bad=$((bad+1)); continue; }
  code=$(curl -sS -o "$tmp/resp" -w '%{http_code}' -X POST "${hdr[@]}" -H "Content-Type: $ct" -H "x-upsert: true" \
         --data-binary @"$tmp/f" "https://$STG_REF.supabase.co/storage/v1/object/$BUCKET/$enc")
  if [[ "$code" != "200" ]]; then echo "  FAIL upload $name ($code: $(head -c 200 "$tmp/resp"))"; bad=$((bad+1)); continue; fi
  curl -fsS "https://$STG_REF.supabase.co/storage/v1/object/public/$BUCKET/$enc" -o "$tmp/g" \
    && cmp -s "$tmp/f" "$tmp/g" && ok=$((ok+1)) || { echo "  FAIL check $name"; bad=$((bad+1)); }
done < "$tmp/names.txt"

echo; echo "copied and checked: $ok of $total   failed: $bad"
[[ "$bad" == "0" ]] || exit 1
