import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "vaa1_queue_backup_launcher.py"
SPEC = importlib.util.spec_from_file_location("vaa1_queue_backup_launcher", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_queue_decision_resumes_resting_and_interrupted_records():
    assert MODULE.queue_decision("uploaded") == "start"
    assert MODULE.queue_decision("interrupted") == "start"
    assert MODULE.queue_decision("processing") == "monitor"


def test_queue_decision_advances_only_after_complete_and_stops_on_failure():
    assert MODULE.queue_decision("completed") == "advance"
    assert MODULE.queue_decision("partial") == "stop"
    assert MODULE.queue_decision("error") == "stop"
