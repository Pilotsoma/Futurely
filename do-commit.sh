#!/bin/sh
set -e
git add backend/package.json backend/scripts/ensure-schema.sql
git commit -m "fix: revert to prisma db execute; add name dedup to ensure-schema"
git push
rm -- "$0"
