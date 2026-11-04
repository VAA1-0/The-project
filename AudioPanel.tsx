import React, { useState, useEffect, useMemo } from "react";
import { useEventBus } from "../../../../hooks/useEventBus";
import { apiService } from "../../../../lib/api-service";
import { Analysis } from "../../../../lib/models";
import { secondsToTime } from "../../../../lib/utils";

interface AudioPanelProps {
  analysis: Analysis;
}

interface AudioEvent {
  segment_id: string;
  event_label: string;
  start: number;
  end: number;
  duration: number;
  confidence?: number;
  measurements?: Record<string, number>;
}

const AudioEventRow: React.FC<{ event: AudioEvent; onJump: (time: number) => void }> = ({ event, onJump }) => {
  const { event_label, start, end, duration, confidence, measurements } = event;

  const formatValue = (value: number | undefined) => (value !== undefined ? value.toFixed(2) : "N/A");

  return (
    <tr
      className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
      onClick={() => onJump(start)}
      title={`Jump to ${secondsToTime(start)}`}
    >
      <td className="px-4 py-2">{event_label}</td>
      <td className="px-4 py-2 text-cyan-400">{secondsToTime(start)}</td>
      <td className="px-4 py-2 text-cyan-400">{secondsToTime(end)}</td>
      <td className="px-4 py-2">{duration.toFixed(2)}s</td>
      <td className="px-4 py-2">{formatValue(confidence)}</td>
      <td className="px-4 py-2">{formatValue(measurements?.energy_dbfs)}</td>
      <td className="px-4 py-2">{formatValue(measurements?.pitch_hz)}</td>
    </tr>
  );
};

const AudioPanel: React.FC<AudioPanelProps> = ({ analysis }) => {
  const eventBus = useEventBus();
  const [audioEvents, setAudioEvents] = useState<AudioEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAudioEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const status = await apiService.getAnalysisStatus(analysis.analysis_id);
        const intervals = status?.audio_event_intervals?.intervals || [];
        if (Array.isArray(intervals)) {
          setAudioEvents(intervals);
        } else {
          setError("Audio event data is not in the expected format.");
          setAudioEvents([]);
        }
      } catch (err) {
        setError("Failed to load audio event intervals.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudioEvents();
  }, [analysis.analysis_id]);

  const handleJumpToTime = (timeInSeconds: number) => {
    eventBus.emit("video:seek", timeInSeconds);
  };

  const categorizedEvents = useMemo(() => {
    const categories: Record<string, AudioEvent[]> = {
      speech: [],
      music: [],
      noise: [],
      silence: [],
      other: [],
    };

    audioEvents.forEach((event) => {
      const label = event.event_label.toLowerCase();
      if (label.includes("speech")) {
        categories.speech.push(event);
      } else if (label.includes("music")) {
        categories.music.push(event);
      } else if (label.includes("noise")) {
        categories.noise.push(event);
      } else if (label.includes("silence")) {
        categories.silence.push(event);
      } else {
        categories.other.push(event);
      }
    });

    return categories;
  }, [audioEvents]);

  const renderCategorySection = (title: string, events: AudioEvent[]) => {
    if (events.length === 0) {
      return null;
    }

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-600 pb-1">{title} ({events.length})</h3>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Start</th>
                <th className="px-4 py-2">End</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Confidence</th>
                <th className="px-4 py-2">Energy (dBFS)</th>
                <th className="px-4 py-2">Pitch (Hz)</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <AudioEventRow key={event.segment_id} event={event} onJump={handleJumpToTime} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="p-4 text-gray-400">Loading audio events...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-400">{error}</div>;
  }

  if (audioEvents.length === 0) {
    return <div className="p-4 text-gray-500">No audio event intervals found for this analysis.</div>;
  }

  return (
    <div className="p-4 bg-gray-900 text-white h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Audio Event Analysis</h2>
      {renderCategorySection("Speech Events", categorizedEvents.speech)}
      {renderCategorySection("Music Events", categorizedEvents.music)}
      {renderCategorySection("Noise Events", categorizedEvents.noise)}
      {renderCategory_section("Silence Intervals", categorizedEvents.silence)}
      {renderCategorySection("Other Events", categorizedEvents.other)}
    </div>
  );
};

export default AudioPanel;

const renderCategory_section = (title: string, events: AudioEvent[]) => {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-300 mb-2 border-b border-gray-600 pb-1">{title} ({events.length})</h3>
      <div className="overflow-auto max-h-60">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700 sticky top-0">
            <tr>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Start</th>
              <th className="px-4 py-2">End</th>
              <th className="px-4 py-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.segment_id}
                className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
                onClick={() => {
                  // Placeholder for jump functionality
                  console.log(`Jumping to ${event.start}`);
                }}
                title={`Jump to ${secondsToTime(event.start)}`}
              >
                <td className="px-4 py-2">{event.event_label}</td>
                <td className="px-4 py-2 text-cyan-400">{secondsToTime(event.start)}</td>
                <td className="px-4 py-2 text-cyan-400">{secondsToTime(event.end)}</td>
                <td className="px-4 py-2">{event.duration.toFixed(2)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};