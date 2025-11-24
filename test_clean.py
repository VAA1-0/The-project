import sys
import os

print('=== Testing Basic Imports ===')
print(f'Current directory: {os.getcwd()}')

# Test if we can import the modules directly
try:
    # Add src to path
    src_path = os.path.join(os.getcwd(), 'src')
    sys.path.insert(0, src_path)
    
    # Try importing without 'src.' prefix
    from backend.analysis.pipeline_video_frames import FrameAnalysisPipeline
    print(' FrameAnalysisPipeline imported successfully')
    
    from backend.utils.logger import get_logger
    print(' get_logger imported successfully')
    
    # Test the logger
    logger = get_logger('test')
    logger.info('Logger is working!')
    
    print(' All imports working correctly!')
    
except Exception as e:
    print(f' Import failed: {e}')
    import traceback
    traceback.print_exc()
