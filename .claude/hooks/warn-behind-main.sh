#!/usr/bin/env bash
# SessionStart hook: one line when this checkout is behind origin/main.
#
# Audits and plans made on a stale checkout describe code that has already
# changed. This warns; it never blocks and never fails the session.
#
# It makes no network call: HEAD is compared with the origin/main ref as last
# fetched, which is why the message says so. Silent when the checkout is not
# behind, when there is no origin/main, and outside a git repository. Works
# from a worktree, where HEAD is the worktree's own.

REMOTE_MAIN="refs/remotes/origin/main"

git rev-parse --verify --quiet "$REMOTE_MAIN" >/dev/null 2>&1 || exit 0

behind=$(git rev-list --count "HEAD..$REMOTE_MAIN" 2>/dev/null) || exit 0
case "$behind" in
  '' | 0 | *[!0-9]*) exit 0 ;;
esac

branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) ||
  branch="detached HEAD at $(git rev-parse --short HEAD 2>/dev/null)"

echo "Warning: this checkout ($branch) is $behind commit(s) behind origin/main as of the last fetch. Run 'git fetch' and update before auditing or planning."
exit 0
