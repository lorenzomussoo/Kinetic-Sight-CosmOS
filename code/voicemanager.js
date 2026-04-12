const VoiceManager = {
    init: function (onCommandReceived, onInterimResult) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("Speech recognition not supported.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => console.log("🎤 Microphone ACTIVE and listening.");
        recognition.onerror = (event) => console.warn("⚠️ Microphone error:", event.error);

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript && onInterimResult) onInterimResult(interimTranscript.toLowerCase().trim());
            if (finalTranscript && onCommandReceived) onCommandReceived(finalTranscript.toLowerCase().trim());
        };

        recognition.onend = () => {
            console.log("⏸️ Microphone paused. Restarting...");
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Error restarting mic:", e);
                }
            }, 500);
        };

        try {
            recognition.start();
        } catch (e) { }
    }
};