export function buildAnalysisSearchParams(pipelineType = "full", options = {}) {
  const {
    analysisTier = "science_scan",
    modalityFocus = "multimodal",
    morphologyPackPolicy = "core_only",
    morphologyLanguages = [],
    specialUseMorphologyLanguage = "",
    allowRoughInterpretation = true,
    applyFaceAnonymization = false,
    faceMessageStyle = "plain",
    faceRequiresPersonDetection = false,
  } = options;

  return new URLSearchParams({
    pipeline_type: pipelineType,
    analysis_tier: analysisTier,
    modality_focus: modalityFocus,
    morphology_pack_policy: morphologyPackPolicy,
    morphology_languages: Array.isArray(morphologyLanguages)
      ? morphologyLanguages.filter(Boolean).join(",")
      : "",
    special_use_morphology_language: specialUseMorphologyLanguage,
    allow_rough_interpretation: String(allowRoughInterpretation),
    apply_face_anonymization: String(applyFaceAnonymization),
    face_message_style: faceMessageStyle,
    face_requires_person_detection: String(faceRequiresPersonDetection),
  });
}
