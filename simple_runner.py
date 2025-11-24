import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))

try:
    # Import using the path we added
    from backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
    from backend.utils.logger import get_logger
    
    logger = get_logger('simple_runner')
    logger.info('✅ Imports successful!')
    
    # Run the analysis
    video_path = './samples/Helsinki_short.mp4'
    if os.path.exists(video_path):
        pipeline = FrameAnalysisPipeline(
            video_path=video_path,
            output_dir='./outputs/frames',
            yolo_model_path='yolov8n.pt',
            languages=['en']
        )
        
        logger.info('Starting analysis...')
        result = pipeline.analyze(save_video=True, display=False)
        yolo_count = len(result.get("yolo_results", []))
        logger.info(f'✅ Analysis complete! Detections: {yolo_count}')
    else:
        logger.error(f'Video not found: {video_path}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
