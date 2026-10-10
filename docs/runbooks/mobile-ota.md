# Runbook: publishing a mobile OTA update (EAS Update)

An OTA update replaces the JavaScript bundle on every installed build whose runtime
version matches. Publishing one is a production release. It needs the owner's go-ahead,
and no agent publishes one as a side effect of other work.

Sources: PR #233 (which found the defect in the old instructions), the header of
`.github/workflows/mobile-ota.yml`, `apps/mobile/eas.json`, `apps/mobile/app.config.ts`,
`apps/mobile/metro.config.js`, and Expo's documentation ("Environment variables with EAS
Update", "Rollbacks" and the EAS CLI reference, read on 2026-10-10).
Each statement below was re-checked against the repository on 2026-10-10 unless it says
it comes from #233.

## The rule

Publish with `--environment production`, or with the `Mobile OTA Update` workflow, which
does the same. **Never publish with a local env file.**

## How to publish

Both ways below publish to production. **Use either one only on the owner's go-ahead for
that publish, given in the session. Never publish to test a change.**

**From GitHub (preferred).** Only on the owner's go-ahead. Actions → "Mobile OTA Update" →
"Run workflow". Pick the git branch to publish from (`main`, unless the owner names
another), the EAS Update branch (default `production`) and the message. Replace the
message: its default in the workflow file is left over from an earlier fix. The
workflow (`.github/workflows/mobile-ota.yml`) installs with a frozen lockfile and runs
`eas-cli update --branch … --message … --environment production --non-interactive` from
`apps/mobile`. It needs the `EXPO_TOKEN` repository secret.

**From a machine.** Only on the owner's go-ahead, and only from a clean checkout of
`main`:

```bash
git fetch origin
git status --short                               # must print nothing
git rev-parse HEAD origin/main                   # must print the same hash twice
```

Why: Expo's documentation says `eas update` runs `npx expo export` in the project and
uploads the result. Nothing in it says uncommitted or unpushed changes are left out, and
`cli.requireCommit` is not set in `apps/mobile/eas.json`. So treat the working tree as
what ships. This is a precaution drawn from that description, not a behaviour that was
tested here. The scope check below reads `origin/main`, so a publish from any other
commit ships something that check did not look at.

Then, with the go-ahead in hand:

```bash
cd apps/mobile && npx eas update --branch production --environment production --message "description"
```

`--environment production` makes EAS use the variables stored in the EAS `production`
environment and nothing else. Local `.env` files are not read. Expo's documentation
states that the flag is required for `eas update` from SDK 55 on; this app is on SDK 57.
The `env` blocks of the build profiles in `apps/mobile/eas.json` are not available to
`eas update`.

Every `EXPO_PUBLIC_*` variable the app reads must exist in the EAS `production`
environment, or the bundle ships without it. `apps/mobile/.env.example` lists the keys.
Secret-visibility variables are not readable during an update.

## Why not `.env.production`

The root `CLAUDE.md` used to say to publish with
`env $(grep … .env.production | xargs) eas update …`. #233 (written 2026-09-03, never
merged; this runbook replaces it) recorded what that recipe would have done that day:

- `apps/mobile/.env.production` is untracked (it is in the root `.gitignore`), so it
  drifts with nothing to show it. On the owner's machine its `EXPO_PUBLIC_API_URL` was
  `https://motowise.onrender.com`, without `/graphql`.
- `apps/mobile/src/lib/graphql-client.ts` passes `EXPO_PUBLIC_API_URL` straight to
  `new GraphQLClient(apiUrl)`. #233 measured the API: a POST to the origin returned 404,
  a POST to `/graphql` returned data.
- A bundle published with that file would have sent every GraphQL request from every
  rider on that runtime version to a 404, and the publish would have reported success.

The file may still exist on a machine and may still be wrong. Nothing in the repo reads
it for a publish any more. Do not reintroduce a recipe that does.

## Check what was shipped

A successful publish is not evidence that the bundle is right. After a local publish,
the export is in `apps/mobile/dist`:

```bash
strings apps/mobile/dist/_expo/static/js/*/entry-*.hbc \
  | grep -oE 'https://motowise\.onrender\.com[a-z/]*'
```

It must print the `/graphql` form for both platforms. (Command from #233. It was not
re-run for this runbook.)

## Roll back a bad publish

A rollback is itself a publish to production: it needs the owner's go-ahead like any
other. Decide which of the two it is before running anything.

Expo's documentation describes two kinds of rollback and three commands:

- **Back to an update published earlier.**
  `npx eas update:republish --group <update-group-id>` republishes that update to the
  branch, which makes it the current one again. `npx eas update:republish --branch
  production` offers the branch's recent updates to choose from. `npx eas update:view
  <update-group-id>` shows what a group is before it is republished.
- **Back to the JavaScript embedded in the store binary.**
  `npx eas update:roll-back-to-embedded --branch production --runtime-version <version>`
  publishes a rollback that tells devices on that runtime version to use the bundle their
  binary shipped with. `<version>` is the `version` string in `apps/mobile/app.config.ts`.
- `npx eas update:rollback` is an interactive prompt that leads to one of the two. It
  cannot be used where there is no terminal to answer it.

Run them from `apps/mobile`. `update:republish` also accepts `-m <message>`,
`-p android|ios|all` and `--non-interactive`.

Precautions. These are not confirmed from Expo's documentation or by a test here:

- A rollback has never been run on this project as far as the repository records, so the
  first one is also the first test of these commands. Read the command's own `--help`
  before running it.
- A rollback does not reach a device before that device next checks for an update, so
  riders can stay on the bad bundle for a while. Assume the same delay as for a normal
  publish.
- Republishing brings back the earlier bundle as it was built, including the variables
  compiled into it. If the fault is a wrong variable in the EAS `production` environment,
  correct the variable and publish again from `main` instead.
- Neither command undoes anything outside the bundle: an API deploy or a migration that
  shipped alongside is rolled back separately.
- Run "Check what was shipped" again afterwards if the rollback was a new local publish.

## Before you publish: scope

**An OTA ships everything mobile on the publishing branch since the store binary was
cut, not only the change you have in mind.**

1. Find when the live binary was uploaded: `asc builds list --app 6760291360` (the App
   Store Connect app id in `apps/mobile/eas.json`). #233 recorded that local builds do
   not appear in `eas build:list`, so that list cannot answer this.
2. List what has landed since:
   `git log --since="<upload time>" origin/main -- apps/mobile packages/types packages/design-system packages/graphql`.
   Those three packages are the workspace dependencies of the mobile app.
3. Read the list. Everything in it goes out.

## Before you publish: the native-mismatch trap

**The runtime version does not protect against a native mismatch.**
`runtimeVersion.policy` in `apps/mobile/app.config.ts` is `appVersion`, so the runtime
version is the `version` string in that file and nothing more. An update reaches every
build with that version string, even when the branch has since gained a native module
the build does not contain.

In the same range as above, look for changes to `apps/mobile/package.json`,
`apps/mobile/app.config.ts`, `apps/mobile/plugins/` and `apps/mobile/modules/`. If one
added a native dependency, the OTA is safe only when no JavaScript imports it. #233's
example: `@posthog/react-native-plugin`, added in `c653ced6` after the binary of that
time was uploaded, has no import in `apps/mobile/src` and is inert over OTA. That is a
property to check each time, not to assume.

The reverse case is in
`docs/solutions/build-errors/eas-ota-runtime-version-mismatch-and-easignore.md`: an
update published under a version no installed build has reaches nobody.

## Facts that are easy to get wrong

- **Metro bundles `@motovault/*` from source.** `resolveRequest` in
  `apps/mobile/metro.config.js` maps each workspace package to
  `packages/<pkg>/src/index.ts`, so a workspace change needs no `tsup` build before a
  publish and a stale `dist/` cannot leak into the bundle.
- **`EXPO_PUBLIC_API_URL` is the full GraphQL endpoint, ending in `/graphql`.** #233
  recorded a second reader, `src/hooks/use-gpx-export.ts`, that treated the same
  variable as an origin and appended a path, so the two readers could not both be right.
  That file no longer exists; on 2026-10-10 `src/lib/graphql-client.ts` is the only
  reader under `apps/mobile/src`. If a second reader is added, it must expect the
  `/graphql` form.
- **EAS project.** ID `359ae282-329d-455d-b9f3-64919afad0b4`, owner `andykeny`. Both are
  in `apps/mobile/app.config.ts`.

## EAS `production` environment against the local `.env.production` (2026-10-10)

The one-time comparison this runbook used to list as open (Owner Decision 9) was run on
2026-10-10: `eas env:list --environment production` against the owner's local
`apps/mobile/.env.production`. Names only are recorded here, never a value.

- All 18 names in the local file exist in the EAS `production` environment, and every
  value that can be read on both sides is equal. No value exists only in the local file.
- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_WEB_URL` are public
  production hosts on both sides.
- Store builds and the CI OTA both read the EAS environment: the `production` build
  profile in `apps/mobile/eas.json` sets `"environment": "production"`, and
  `.github/workflows/mobile-ota.yml` passes `--environment production`.

**Open item for the owner.** `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` and `MAPBOX_DOWNLOAD_TOKEN`
each have two entries in the EAS `production` environment: one readable, and one of
secret visibility that cannot be compared. Which of the two a build resolves was not
verified. Delete the redundant entry of each, so that there is one value to reason about.
