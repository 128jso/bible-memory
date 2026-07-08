import { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

type RepeatMode = 'none' | 'one' | 'all';

interface Props {
  reference: string;
  autoPlay?: boolean;
  onTrackEnded?: () => void;
}

function getAudioUrl(reference: string): string {
  return `https://audio.esv.org/hw/mq/${encodeURIComponent(reference)}.mp3`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2.0];

export function AudioPlayer({ reference, autoPlay, onTrackEnded }: Props) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('none');
  const [speedIndex, setSpeedIndex] = useState(2);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const speedIndexRef = useRef(speedIndex);
  speedIndexRef.current = speedIndex;
  const onTrackEndedRef = useRef(onTrackEnded);
  onTrackEndedRef.current = onTrackEnded;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
    }
    if (autoPlay) {
      setTimeout(() => {
        const audio = new Audio(getAudioUrl(reference));
        audio.playbackRate = SPEEDS[speedIndexRef.current];
        audio.onended = () => {
          if (repeatRef.current === 'one') {
            audio.currentTime = 0;
            audio.play();
          } else if (repeatRef.current === 'all') {
            setPlaying(false);
            onTrackEndedRef.current?.();
          } else {
            setPlaying(false);
          }
        };
        audio.onerror = () => setPlaying(false);
        audioRef.current = audio;
        audio.play().then(() => setPlaying(true));
      }, 100);
    }
  }, [reference, autoPlay]);

  function getOrCreateAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const audio = new Audio(getAudioUrl(reference));
      audio.playbackRate = SPEEDS[speedIndexRef.current];
      audio.onended = () => {
        if (repeatRef.current === 'one') {
          audio.currentTime = 0;
          audio.play();
        } else if (repeatRef.current === 'all') {
          setPlaying(false);
          onTrackEndedRef.current?.();
        } else {
          setPlaying(false);
        }
      };
      audio.onerror = () => {
        setLoading(false);
        setPlaying(false);
      };
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  function handlePlay() {
    const audio = getOrCreateAudio();
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setLoading(true);
      audio.play().then(() => {
        setLoading(false);
        setPlaying(true);
      }).catch(() => {
        setLoading(false);
      });
    }
  }

  function handleRepeat() {
    const modes: RepeatMode[] = ['none', 'one', 'all'];
    const next = modes[(modes.indexOf(repeat) + 1) % modes.length];
    setRepeat(next);
  }

  function handleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[next];
    }
  }

  const repeatLabel = repeat === 'none' ? '➡' : repeat === 'one' ? '🔂' : '🔁';

  return (
    <div className="audio-controls">
      <button
        className="audio-control-btn audio-control-btn--speed"
        onClick={handleSpeed}
        aria-label="Playback speed"
      >
        {SPEEDS[speedIndex]}x
      </button>
      <button
        className={`audio-control-btn audio-control-btn--play ${playing ? 'audio-control-btn--active' : ''}`}
        onClick={handlePlay}
        disabled={loading}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading ? '...' : playing ? '⏸' : '▶'}
      </button>
      <button
        className={`audio-control-btn ${repeat !== 'none' ? 'audio-control-btn--active' : ''}`}
        onClick={handleRepeat}
        aria-label={`Repeat: ${repeat}`}
        title={`Repeat: ${repeat}`}
      >
        {repeatLabel}
      </button>
    </div>
  );
}
