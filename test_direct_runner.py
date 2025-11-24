import sys
import os
import importlib.util

print('Direct file-based import test...')

# Import logger directly from file
logger_spec = importlib.util.spec_from_file_location(
    'logger', 
    'src/backend/utils/logger.py'
)
logger_module = importlib.util.module_from_spec(logger_spec)
logger_spec.loader.exec_module(logger_module)

# Import pipeline directly from file  
pipeline_spec = importlib.util.spec_from_file_location(
    'pipeline',
    'src/backend/analysis/pipeline_video_frames.py'
)
pipeline_module = importlib.util.module_from_spec(pipeline_spec)
pipeline_spec.loader.exec_module(pipeline_module)

# Use the modules
get_logger = logger_module.get_logger
FrameAnalysisPipeline = pipeline_module.FrameAnalysisPipeline

print(' Direct file imports successful!')

# Test the pipeline
logger = get_logger('direct_test')
logger.info('Testing pipeline creation...')

try:
    pipeline = FrameAnalysisPipeline(
        video_path='./samples/Helsinki_main_street.mp4',
        output_dir='./outputs/frames',
        yolo_model_path='yolov8n.pt',
        languages=['en']
    )
    print(' Pipeline created successfully!')
    
    # Run analysis
    logger.info('Starting analysis...')
    result = pipeline.analyze(save_video=True, display=False)
    logger.info(f'Analysis complete: {len(result.get("yolo_results", []))} detections')
    
except Exception as e:
    logger.error(f'Pipeline failed: {e}')
    import traceback
    traceback.print_exc()
