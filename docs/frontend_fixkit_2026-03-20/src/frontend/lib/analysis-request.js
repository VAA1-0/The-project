export function buildAnalysisSearchParams(pipelineType = "full", options = {}) {
  const {
    applyFaceAnonymization = false,
    faceMessageStyle = "plain",
    faceRequiresPersonDetection = false,
  } = options;

  return new URLSearchParams({
    pipeline_type: pipelineType,
    apply_face_anonymization: String(applyFaceAnonymization),
    face_message_style: faceMessageStyle,
    face_requires_person_detection: String(faceRequiresPersonDetection),
  });
}
