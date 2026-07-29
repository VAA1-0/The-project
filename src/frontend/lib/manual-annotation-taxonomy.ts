import type { ManualVisualAnnotation } from "./api-service";
import {
  MEDIA_GENRE_OPTIONS,
  MEDIA_SUBGENRE_OPTIONS,
  SITUATIONAL_GENRE_OPTIONS,
  SITUATIONAL_SUBGENRE_OPTIONS,
} from "./metadata-taxonomy";

const unique = (values: readonly string[]) => [...new Set(values)];

export const NATIVE_ANNOTATION_CATEGORIES: ManualVisualAnnotation["category"][] = [
  "Action", "Audio", "Cinematic Cues", "Expressions", "Genre", "Identification",
  "Interaction", "Metadata", "Movement", "Notes", "OBJ", "OCR", "Role", "Scene",
  "Transcription",
];

export const NATIVE_ANNOTATION_SUBCATEGORIES: Record<ManualVisualAnnotation["category"], string[]> = {
  Action: ["Action"],
  Audio: ["Ambience", "Foley", "Music", "Prosody", "Sound event", "Speaker-state"],
  "Cinematic Cues": ["Composition", "Lighting", "Shot size", "Transition"],
  Expressions: ["Emotion", "Expression"],
  Genre: ["Media genre", "Media subgenre", "Situational genre", "Situational subgenre", "Situational taxonomy"],
  Identification: ["Character", "Identity"],
  Interaction: ["Exchange", "Interaction"],
  Metadata: ["Context", "Correlation"],
  Movement: ["Camera movement", "Subject movement"],
  Notes: ["Timestamped note"],
  OBJ: ["Object label"],
  OCR: ["Visible text"],
  Role: ["Role affirmation"],
  Scene: ["Location", "Scene type"],
  Transcription: ["Speech content", "Transcript note"],
};

export const NATIVE_ANNOTATION_LABELS: Record<string, string[]> = {
  "Action::Action": ["Driving", "Entering", "Exiting", "Holding", "Running", "Sitting", "Standing", "Walking"],
  "Audio::Ambience": ["Crowd noise", "Indoor hum", "Street noise", "Wind"],
  "Audio::Foley": ["Door close", "Footsteps", "Glass impact", "Walking on snow"],
  "Audio::Music": ["Background score", "Dissonant cue", "Suspense cue", "Theme cue"],
  "Audio::Prosody": ["Emphasis", "Flat delivery", "Raised voice", "Whisper"],
  "Audio::Sound event": ["Door slam", "Explosion", "Gun shot", "Phone ring"],
  "Audio::Speaker-state": ["Agitated", "Calm", "Fearful", "Urgent"],
  "Cinematic Cues::Composition": ["Center-weighted", "Foreground obstruction", "Symmetry", "Wide isolation"],
  "Cinematic Cues::Lighting": ["Backlit", "Cold lighting", "High contrast", "Low-key lighting"],
  "Cinematic Cues::Shot size": ["Close-up", "Extreme close-up", "Long shot", "Medium shot"],
  "Cinematic Cues::Transition": ["Cut", "Dissolve", "Fade", "Match cut"],
  "Expressions::Emotion": ["Anger", "Fear", "Joy", "Sadness", "Surprise"],
  "Expressions::Expression": ["Concern", "Determination", "Neutral", "Tension"],
  "Genre::Media genre": [...MEDIA_GENRE_OPTIONS],
  "Genre::Media subgenre": unique(Object.values(MEDIA_SUBGENRE_OPTIONS).flat()),
  "Genre::Situational genre": [...SITUATIONAL_GENRE_OPTIONS],
  "Genre::Situational subgenre": unique(Object.values(SITUATIONAL_SUBGENRE_OPTIONS).flat()),
  "Genre::Situational taxonomy": unique([
    ...SITUATIONAL_GENRE_OPTIONS,
    ...Object.values(SITUATIONAL_SUBGENRE_OPTIONS).flat(),
  ]),
  "Identification::Character": ["Character present", "Unidentified person"],
  "Identification::Identity": ["Narrative Agent affirmed", "Narrative Agent uncertain"],
  "Interaction::Exchange": ["Confrontation", "Conversation", "Observation", "Pursuit"],
  "Interaction::Interaction": ["Assistance", "Conflict", "Contact", "Threat"],
  "Metadata::Context": ["Metadata supports annotation", "Metadata updated from annotation"],
  "Metadata::Correlation": ["Contradicts metadata", "Extends metadata", "Matches metadata", "Supports metadata"],
  "Movement::Camera movement": ["Pan", "Static camera", "Tilt", "Zoom"],
  "Movement::Subject movement": ["Approach", "Retreat", "Turn", "Walk"],
  "Notes::Timestamped note": ["Analyst note", "Correction note", "Open note"],
  "OBJ::Object label": ["Bag", "Car", "Door", "Person", "Phone", "Weapon"],
  "OCR::Visible text": ["Name card", "On-screen caption", "Signage", "Subtitle"],
  "Role::Role affirmation": ["Authority", "Customer service", "Driver", "Guard", "Police officer"],
  "Scene::Location": ["Indoor", "Outdoor", "Street", "Waiting area"],
  "Scene::Scene type": ["Arrival", "Checkpoint", "Conversation scene", "Transition scene"],
  "Transcription::Speech content": ["Correct transcript", "Missing utterance", "Speaker overlap"],
  "Transcription::Transcript note": ["Ambiguous phrase", "Manual clarification", "Timestamp note"],
};
