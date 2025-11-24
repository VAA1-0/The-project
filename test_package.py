import sys
import os

print('Testing package installation...')

try:
    # After pip install -e ., this should work
    from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
    from src.backend.utils.logger import get_logger
    print(' Package imports working!')
    
    logger = get_logger('test')
    logger.info('Package installation successful!')
    
except Exception as e:
    print(f' Package import failed: {e}')
    print('Trying alternative import...')
    
    try:
        # Alternative: import directly from src path
        sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
        from backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
        from backend.utils.logger import get_logger
        print(' Alternative imports working!')
    except Exception as e2:
        print(f' Alternative also failed: {e2}')
