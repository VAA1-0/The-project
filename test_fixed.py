import sys
import os

print('Testing imports after fixing encoding...')

try:
    from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
    from src.backend.utils.logger import get_logger
    print('✅ SUCCESS: Package imports working!')
    
    logger = get_logger('test')
    logger.info('Package installation successful!')
    
except Exception as e:
    print(f'❌ Package import failed: {e}')
    import traceback
    traceback.print_exc()
