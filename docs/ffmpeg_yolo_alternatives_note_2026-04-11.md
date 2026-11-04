# Technical Note: FFmpeg and YOLOv8 Alternatives (2026-04-11)

This note provides a perspective on potential alternative tools for FFmpeg (video/audio processing) and YOLOv8 (object detection) in the context of the VAA1 project.

---

## Replacements for FFmpeg

FFmpeg is the undisputed industry standard for video/audio processing. It's incredibly powerful and fast. The main reason to "replace" it is not for performance, but for better **programmatic control and integration**.

Currently, the VAA1 pipeline calls FFmpeg as a command-line tool using Python's `subprocess`. This can be clunky for error handling and complex data flows. A better approach is to use a library that provides direct bindings to FFmpeg's internal components.

### Top Recommendation: PyAV

*   **What it is:** A Python library that provides direct, pythonic bindings to the underlying FFmpeg libraries (like `libavformat`, `libavcodec`, etc.).
*   **Why it's a good replacement:** Instead of running a separate process, you can work with video streams and frames as native Python objects.
    *   **Direct Frame Access:** You can read video frames one by one and get them as NumPy arrays, which is perfect for passing directly to analysis models like YOLO.
    *   **Better Control:** You have fine-grained control over seeking, stream selection, and decoding.
    *   **Improved Error Handling:** Errors are handled within Python with exceptions, which is much cleaner than parsing `stderr` from a subprocess.

### Assessment
For this project, replacing the `subprocess` calls in the audio/video ingestion pipeline with `PyAV` would be a significant architectural improvement, making the code more robust, efficient, and easier to debug.

---

## Replacements for YOLOv8

YOLOv8 is a fantastic choice for object detection. It represents the state-of-the-art in balancing speed and accuracy. "Replacing" it is less about fixing a problem and more about choosing a different set of trade-offs.

Reasons to consider an alternative:

1.  You need **even higher accuracy** for a non-real-time, scientific application and are willing to sacrifice significant speed.
2.  You have specific **licensing requirements**. YOLOv8 uses an AGPL-3.0 license. While great for open-source, it can be restrictive for commercial, closed-source products.

### Good Alternatives

#### 1. For Higher Accuracy (at the cost of speed):
*   **DINO (DETR with Improved Denoising Anchor Boxes):** A transformer-based model that often achieves higher accuracy than YOLO-family models, especially in complex scenes with many overlapping objects. However, it is much slower and more computationally expensive.

#### 2. For permissive code-and-checkpoint operation:
*   **Meta DETR ResNet-50:** The Meta DETR repository and the published `facebook/detr-resnet-50` checkpoint declare Apache-2.0. Datascene now has an offline, checksum-pinned adapter for this combination.
*   **EfficientDet:** TensorFlow Model Garden publishes EfficientDet code and its official checkpoints under Apache-2.0. It remains a catalogued second provider until its Datascene adapter and clean-environment test are complete.

**Correction concerning YOLO-NAS:** SuperGradients code is Apache-2.0, but the
published YOLO-NAS pretrained weights have separate terms restricting use. The
weights must therefore not be described as a generally commercially permissive
drop-in. Datascene exposes YOLO-NAS only as a licence-sensitive research choice
requiring explicit analyst activation.

### Current Datascene decision — 25 October 2026

The operational default is **Meta DETR ResNet-50**, running locally from a
checksum-pinned Apache-2.0 checkpoint. It has been exercised offline against a
real No Time To Die source frame. Its output is raw, source-linked object
evidence; it is not a user confirmation.

The first measured grouping motor is **Datascene Native Object Appearance v1**:
HSV and Lab histograms, HOG structure and coarse luminance are calculated from
source-linked track crops and compared by cosine similarity. The vectors stay
internal and the resulting clusters remain candidates until analyst review.

YOLOv8 and other licence-sensitive or checkpoint-sensitive alternatives remain
visible in Analysis setup and the working Tools panel for research. Selecting
one is the analyst's decision, is recorded in the analysis traceback, and is
rejected by the backend if explicit analyst licence authority is absent.

This note is a technical inventory, not legal advice. Packaging must retain the
licence texts, checkpoint manifest and reproducibility checks for the exact
versions shipped.
