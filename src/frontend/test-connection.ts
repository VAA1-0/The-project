// test-connection.ts - Run this to verify everything works
import { apiService } from '@/lib/api-service';

async function testConnection() {
  console.log('Testing Docker API connection...');
  
  try {
    // Test health check
    const health = await apiService.healthCheck();
    console.log('✅ Health check:', health);
    
    // List recent analyses
    const analyses = await apiService.listAnalyses(5);
    console.log('✅ Recent analyses:', analyses);
    
    // If you have an analysis ID, test download
    const testId = '34fa61e9-8c15-4172-88cd-041c0d6f7447'; // Use your actual ID
    try {
      const status = await apiService.getStatus(testId);
      console.log('✅ Analysis status:', status);
      
      if (status.status === 'completed') {
        console.log('✅ Download links:', status.download_links);
      }
    } catch (statusError) {
      console.log('ℹ️ No existing analysis to test download');
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();