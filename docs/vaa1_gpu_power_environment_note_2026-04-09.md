# VAA1 GPU / Power Computing Environment Note

Date: 2026-04-09
Status: planning note
Scope: define a third environment tier for GPU-capable and power-computing deployments

## 1. Why a third environment is needed

VAA1 now effectively has:

1. a core environment
2. a face-recognition environment

That is already a useful division, but it will not be enough for the next phases involving:

- larger action and motion stacks
- model fine-tuning
- multimodal learning
- heavier batch preprocessing
- institutional or partner-side GPU workflows

So VAA1 should also define:

3. a GPU / power-computing environment

## 2. Purpose of the GPU / power environment

This third environment should support:

- compute-heavy inference
- model training and fine-tuning
- large-scale preprocessing
- dataset preparation
- evaluation runs across corpora
- future multimodal fusion experiments

It should not be treated as the default local environment for everyday work on a household Mac.

## 3. High-level environment structure

Recommended environment split:

### Environment 1: VAA1 Core

Use for:

- main backend
- frontend-linked analysis
- metadata workflows
- ordinary local development
- light and medium inference workloads

### Environment 2: Face Recognitions

Use for:

- face analysis
- face verification / matching
- face-heavy experiments
- specialized dependencies that should not burden the main core stack

### Environment 3: GPU / Power Computing

Use for:

- action detection
- motion modeling
- pose pipelines
- MMAction2
- MMPose
- training and fine-tuning
- batch multimodal preprocessing
- sentence-transformer and genre/event classifier experiments

## 4. Why this separation is good

It helps avoid:

- overloading the everyday dev environment
- breaking the stable local runtime
- forcing heavy CUDA or GPU-related dependencies onto machines that do not need them
- unnecessary institutional confusion later

It also helps with:

- reproducibility
- partner onboarding
- hardware-aware deployment
- cleaner dependency audits

## 5. What should likely live in the GPU / power environment

Examples of likely future residents:

- CUDA-capable PyTorch builds
- MediaPipe where appropriate
- MMPose
- MMAction2
- sentence-transformers
- genre/event classifier toolchains
- large embedding workflows
- heavy dataset preprocessing tools
- evaluation and benchmarking stacks

Some packages may overlap with Core, but the GPU environment should be allowed to diverge where performance or compatibility requires it.

## 6. What should not be forced into it

The GPU / power environment should not become a grab bag for everything.

Avoid using it for:

- routine frontend work
- ordinary metadata editing
- standard local project navigation
- tasks that already run comfortably in the core environment

Its purpose is not prestige. Its purpose is heavier computation.

## 7. Suggested naming

Possible names:

- `vaa1_gpu`
- `vaa1_power`
- `vaa1_compute`

Recommended:

- `vaa1_gpu`

because it is short and immediately understandable for both local and institutional users.

## 8. Suggested file naming

Examples:

- `environment-MacOS-gpu.yml`
- `environment-Linux-gpu.yml`
- later, if needed:
  - `environment-Ubuntu-gpu.yml`
  - `environment-HPC-gpu.yml`

For now, the most important thing is to establish the concept and reserve the structure.

## 9. Recommended build order

Do not build the GPU environment blindly all at once.

Recommended order:

1. define the environment purpose
2. define the candidate dependency groups
3. separate:
   - operational now
   - reserved for later
4. create a test GPU environment file
5. validate on the actual target hardware
6. only then promote it to a stable environment file

## 10. Dependency grouping suggestion

The GPU environment should probably be grouped internally into:

- base scientific stack
- GPU torch stack
- pose/action stack
- multimodal learning stack
- evaluation / benchmark stack

That will make future troubleshooting easier than one flat package list.

## 11. Institutional partner relevance

This environment is important even before it is fully operationalized because:

- institutional partners may already ask what the heavy-compute path is
- supercomputing or lab resources require clearer packaging than a household-Mac setup
- future training and calibration work depends on having a credible compute story

So this note is not premature. It is part of scaling preparedness.

## 12. Immediate next recommendation

Do not fill the GPU environment completely yet.

Next sensible step:

1. keep working in the verified core environment
2. continue the action and motion roadmap
3. start a reserved GPU dependency shortlist
4. later create:
   - `environment-MacOS-gpu-TEST.yml`
   or, more likely for real GPU work,
   - `environment-Linux-gpu-TEST.yml`

## 13. Summary principle

VAA1 should maintain:

- a stable core environment
- a specialized face environment
- a dedicated GPU / power-computing environment

This three-tier structure is the cleanest way to support:

- local development
- specialized analysis
- future heavy computation

without turning one environment into an unmaintainable dependency burden.
