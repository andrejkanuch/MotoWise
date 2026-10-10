# Runbook: publishing a mobile OTA update (EAS Update)

An OTA update replaces the JavaScript bundle on every installed build whose runtime
version matches. Publishing one is a production release. It needs the owner's go-ahead,
and no agent publishes one as a side effect of other work.

Sources: PR #233 (which found the defect in the old instructions), the header of
`.github/workflows/mobile-ota.yml`, `apps/mobile/eas.json`, `apps/mobile/app.config.ts`,
`apps/mobile/metro.config.js`, and Expo's "Environment variables with EAS Update" page.
Each statement below was re-checked against the repository on 2026-10-10 unless it says
it comes from #233.

## The rule

Publish with `--environment production`, or with the `Mobile OTA Update` workflow, which
does the same. **Never publish with a local env file.**

## How to publish

**From GitHub (preferred).** Actions → "Mobile OTA Update" → "Run workflow". Pick the git
branch to publish from, the EAS Update branch (default `production`) and the message. The
workflow (`.github/workflows/mobile-ota.yml`) installs with a frozen lockfile and runs
`eas-cli update --branch … --message … --environment production --non-interactive` from
`apps/mobile`. It needs the `EXPO_TOKEN` repository secret.

**From a machine.**

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

## Open: one-time check (Owner Decision 9)

Compare `eas env:list --environment production` with the local
`apps/mobile/.env.production` once, now that EAS is what ships, so that a value which
exists only in the local file is found before it is needed. **Not run.** Nothing in the
repository records the result of such a comparison.
