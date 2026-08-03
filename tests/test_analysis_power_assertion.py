from unittest.mock import Mock

from src.backend.analysis import power_assertion


def test_macos_caffeinate_is_scoped_and_released(monkeypatch):
    process = Mock(pid=42)
    process.poll.return_value = None
    monkeypatch.setattr(power_assertion.subprocess, "Popen", Mock(return_value=process))

    assertion = power_assertion.AnalysisPowerAssertion(system="Darwin")
    with assertion:
        assert assertion.active is True
        assert assertion.provider == "macos.caffeinate"
        assert assertion.record()["pid"] == 42

    power_assertion.subprocess.Popen.assert_called_once_with(
        ["/usr/bin/caffeinate", "-i", "-w", str(power_assertion.os.getpid())],
        stdout=power_assertion.subprocess.DEVNULL,
        stderr=power_assertion.subprocess.DEVNULL,
    )
    process.terminate.assert_called_once()
    assert assertion.active is False
    assert assertion.released_at


def test_unsupported_platform_does_not_block_analysis():
    assertion = power_assertion.AnalysisPowerAssertion(system="Linux").acquire()
    assert assertion.active is False
    assert "No sleep-inhibition provider" in str(assertion.error)
