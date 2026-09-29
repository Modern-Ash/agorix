# Issue 95 Intent

Migrate the existing real-LLM tutor work from the legacy tutor adapter scope into optional commercial provider adapters that sit behind the provider-neutral Learning Companion and provider-runtime architecture.

The feature must preserve reusable server-side security and configuration work from #27 while removing tutor-only and vendor-specific assumptions from the current architecture. Commercial providers are optional remote implementations, not a build-time, test-time, or core learning-flow dependency.

Success means Agorix can run with fake/local providers by default, can opt into a commercial remote adapter through server-side configuration, and can switch between remote/local implementations without changing canonical curriculum or runtime semantics.
