import os
import unittest

import requests


class LiveDownloadSmokeTest(unittest.TestCase):
    def test_live_backend_download_links_when_enabled(self):
        if os.environ.get("VAA1_RUN_LIVE_DOWNLOAD_TEST") != "1":
            self.skipTest(
                "live backend download smoke requires VAA1_RUN_LIVE_DOWNLOAD_TEST=1"
            )

        analysis_id = os.environ.get(
            "VAA1_LIVE_DOWNLOAD_ANALYSIS_ID",
            "cf3c6581-ab6e-4d56-91c9-d022c9d78190",
        )
        status_url = f"http://localhost:8000/api/status/{analysis_id}"
        status = requests.get(status_url, timeout=5).json()

        self.assertIn("download_links", status)
        self.assertIsInstance(status["download_links"], dict)

        if "video" in status["download_links"]:
            response = requests.get(
                f"http://localhost:8000/api/download/{analysis_id}/video",
                timeout=10,
            )
            self.assertEqual(response.status_code, 200)
            self.assertGreater(len(response.content), 0)


if __name__ == "__main__":
    unittest.main()
