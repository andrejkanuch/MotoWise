#!/bin/sh
# Edit-maintenance-task E2E runner.
#
# Usage:
#   pnpm --filter @motovault/mobile test:e2e:edit-task
#
# Thin wrapper over run-onboarding-e2e.sh: it reuses that script's user
# provisioning + teardown (create/delete a confirmed Supabase user) and points
# it at the edit-maintenance-task flow. The flow composes onboarding.yaml as
# setup, so the same TEST_EMAIL/TEST_PASSWORD env is what it needs. Same build
# prereqs as onboarding (standalone/preview build, EXPO_PUBLIC_OB_VARIANT=invested
# — see .maestro/README.md).
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

export E2E_FLOW="edit-maintenance-task.yaml"
export E2E_EMAIL_PREFIX="e2e-edit-task"

exec sh "$SCRIPT_DIR/run-onboarding-e2e.sh"
