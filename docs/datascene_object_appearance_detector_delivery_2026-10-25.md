# Datascene measured object appearance and detector-provider delivery

Date: 25 October 2026

## Outcome

Datascene now has one actually operational, permissive, offline object-analysis
combination:

1. **Meta DETR ResNet-50** creates raw source-linked object boxes and labels.
2. **Datascene Native Object Appearance v1** samples the object tracks and
   measures HSV, Lab, HOG and luminance descriptors.
3. Cosine similarity produces representative, boundary and nearest-competing
   samples for the existing object-cluster workbench.
4. Results remain review candidates. Confirmation through Master Schema—not
   detector confidence or cluster cohesion—creates mature semantic data.

The detector code and selected published checkpoint both declare Apache-2.0.
The local checkpoint is resolved and checksum-pinned by
`scripts/install_detr_object_detector.py`; analysis-time network access is
disabled. Large model files remain deployment artifacts and are intentionally
ignored by Git.

## Analyst licence authority

Datascene may show other providers for research, including YOLOv8, YOLO-NAS,
Torchvision, Detectron2, DINO and EfficientDet. Visibility is not activation.

- The UI defaults only to the permissive local DETR provider.
- A licence-sensitive provider must be selected by the analyst in Analysis
  setup or the working Tools panel.
- The choice and explicit analyst authority are written into the submitted
  model-choice map and analysis traceback.
- The backend rejects YOLOv8 or YOLO-NAS if that explicit authority is missing.
- Missing or unimplemented providers fail closed; Datascene does not silently
  substitute a different model.

This preserves research choice without making Datascene the party that accepts
a third-party licence on the analyst's behalf.

## Runtime proof

The pinned DETR provider was run with Hugging Face and Transformers offline
flags against a real frame at 30.460 seconds of the active No Time To Die
artifact. It returned seven detections, including a person, chairs and a dining
table. A blank-frame run returned zero detections. These are runtime smoke
checks, not a precision/recall calibration claim.

The appearance motor has deterministic synthetic colour-discrimination and
sidecar tests. Its public API withholds raw embedding vectors while persisting
them internally for reproducible comparison.

## Remaining release work

- benchmark DETR speed and precision/recall on representative source classes;
- run rendered UI acceptance for threshold preview and cluster review;
- package the pinned model manifest, licence and weights in clean Mac and
  Windows environments;
- implement and separately validate any second detector adapter before marking
  it operational; and
- calibrate appearance thresholds by object family without turning similarity
  scores into semantic certainty.
