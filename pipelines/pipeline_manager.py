# pipeline_manager.py
from .pipeline_audio_text import transcribe_audio
from .pipeline_video_frames import analyze_frames
from .pipeline_summary import generate_summary

def run_full_analysis(video_path):
    transcript = transcribe_audio(video_path)
    visual_tags = analyze_frames(video_path)
    summary = generate_summary(transcript, visual_tags)
    return {"transcript": transcript, "summary": summary, "tags": visual_tags}
