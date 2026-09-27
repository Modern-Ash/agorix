# Deployment unit — issue #110

The deployment unit is the existing monorepo Web learner slice and shared TypeScript packages. No production infrastructure or schema migration is required: existing saved projects remain loadable because `metadata.locale` is optional.

Changed deployable surfaces:

- `@agorix/web` bundle;
- `@agorix/curriculum`;
- `@agorix/tutor-contract`;
- `@agorix/persistence` metadata type.
