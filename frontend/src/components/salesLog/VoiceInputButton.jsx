import { useRef, useState } from 'react';

// RULE-STT-001/002: 브라우저 내장 Web Speech API만 사용, 기본 언어는 ko-KR.
const SpeechRecognitionImpl =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// RULE-STT-007: 미지원 브라우저에서는 버튼 자체를 숨기고 직접 입력만 가능하게 둔다.
export default function VoiceInputButton({ onResult }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  if (!SpeechRecognitionImpl) return null;

  function handleClick() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;

    // RULE-STT-003/006: 변환 결과는 입력란에 반영만 하고, 저장이나 음성 원본 보관은 하지 않는다.
    recognition.onresult = (event) => {
      onResult(event.results[0][0].transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <button type="button" onClick={handleClick}>
      {listening ? '듣는 중... (클릭하여 중지)' : '마이크 음성 입력'}
    </button>
  );
}
