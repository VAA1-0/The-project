# Supply-chain security release contract — 6 November 2026

## Outcome

Datascene now has a machine-readable, fail-closed supply-chain assessment at
`GET /api/release/supply-chain`. It inventories the locked Python, npm and
locally installed model inputs and reports `qualified` only when every required
integrity control passes.

The Python artifact-identity blocker was mitigated on 6 November. The core pip
manifest now contains 109 exact distributions with published, non-yanked PyPI
SHA-256 artifacts in `requirements-pip.lock`. Python and system packages were
separated into `config/python_runtime_contract.json`; the unavailable
`dejavu-audio==0.1.5` pin was removed from the core and recorded as deferred,
not silently replaced.

The current repository remains **blocked**, not qualified, because clean Mac
and Windows installation/startup receipts bound to this lock and verified
installer hashes do not yet exist.

## Current evidence

| Input family | Inventory | Result |
| --- | ---: | --- |
| Python | 109 core PyPI distributions | Exact versions and artifact hashes complete |
| Root npm lock | 19 packages | Resolved URL and integrity complete |
| Frontend npm lock | 725 packages | Resolved URL and integrity complete |
| Local model inventory | 1 model / 3 files | Commit, licence, size and SHA-256 verified |

The installed `facebook/detr-resnet-50` model is bound to immutable revision
`1d5f47bd3bdd2c4bbfa585418ffe6da5028b4c0b`; its three local files match the
recorded sizes and SHA-256 values. The manifest also declares Apache-2.0 and
local-only execution after installation.

## Fail-closed rules

- A Python dependency must have an exact version and one or more SHA-256
  distribution hashes.
- npm lockfiles must use lock format 2 or 3; every non-local package must carry
  version, resolved source and integrity metadata.
- Every installed model must have the supported manifest schema, immutable
  resolved revision, licence, non-empty file inventory, local-only policy, and
  matching file size and SHA-256 evidence.
- Missing inventory or failed verification is a release blocker.
- Runtime installation of unverified dependencies or model assets is outside
  the release contract.
- Credentials remain external to dependency manifests and exported assessment
  evidence.

## Explicit limitation and next acceptance step

This is a deterministic offline integrity assessment. It does not claim that
the locked components are free of newly disclosed vulnerabilities and does not
replace a current advisory-database scan.

To close the remaining blocker, install with `--require-hashes` in clean Mac and
Windows release environments, verify startup and installer identity, and retain
`vaa1.clean_install_receipt.v1` evidence bound to the lock checksum and frozen
system revision. A current vulnerability scan and its dated evidence are
separately required at release freeze.
