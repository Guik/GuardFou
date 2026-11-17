# Releasing GuardFou

## Steps

1. Add a section for the new version to `CHANGELOG.md`, in English and French.
2. Bump `version` in `manifest.json` and commit both.
3. Tag and push: `git tag v0.2.0 && git push --tags`.
4. Once the workflow has finished, upload the `chrome-guardfou-<version>.zip` from the GitHub Release to the Chrome Web Store dashboard.

## What the workflow does

On a `v*` tag, after the tests pass, `.github/workflows/xpi.yml`:

- checks that the tag matches the `manifest.json` version (addons.mozilla.org refuses the same version twice);
- takes that version's notes from `CHANGELOG.md`; the tests fail when they're missing;
- submits the version to addons.mozilla.org, where Mozilla reviews it before publishing, which can take a few days;
- creates a GitHub Release with the same notes, the unsigned `.xpi` and the Chrome Web Store zip.

It needs two repository secrets, `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`, created at [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/).

## Store material

- `amo-metadata.json`: the addons.mozilla.org listing (summary, description, categories, licence). It is sent with every release, so edit it here rather than on the Developer Hub.
- `PRIVACY.md`: the privacy policy.
- `store/`: screenshots, with the Chrome Web Store sizes in `store/chrome/`.
