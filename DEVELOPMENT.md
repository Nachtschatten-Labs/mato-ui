# Development setup

This replacement UI uses Node through nvm and pnpm. Application implementation is pending.

## Start a terminal session

```sh
cd /Users/thomas/dev/mato/ui
nvm use
pnpm --version
pnpm install --frozen-lockfile
```

`.nvmrc` pins Node 26.8.1 and `package.json` pins pnpm 12.3.4. pnpm is installed under this nvm Node version. If you switch to another Node installation, ensure its pnpm executable matches the project's pin.

## Dependency policy

- New direct dependencies are saved with exact versions.
- Dependency releases must be at least 24 hours old; missing publication dates fail the check.
- Install lifecycle scripts are disabled. Review any required build scripts before changing this policy.
- A mismatched pnpm version produces an error rather than automatically downloading another version.
- Commit `pnpm-lock.yaml` with dependency changes and use frozen installs for reproducible setup.

These controls reduce installation risk. They do not sandbox explicitly run application scripts, formatter/linter configuration, or package-manager hook files. Review executable configuration before using it.

Reference: https://pnpm.io/settings
