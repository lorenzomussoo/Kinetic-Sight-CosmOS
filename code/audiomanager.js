const AudioManager = {
    audioCtx: new (window.AudioContext || window.webkitAudioContext)(),

    playTone: function (freq, type, duration) {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + duration);
        osc.stop(this.audioCtx.currentTime + duration);
    },

    speak: function (testo) {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(testo);
            utterance.pitch = 1.0;
            utterance.rate = 1.0;
            utterance.lang = 'en-US';

            const voices = window.speechSynthesis.getVoices();

            const bestVoice =
                voices.find(v => v.name === 'Google US English') ||
                voices.find(v => v.name === 'Google UK English Female') ||
                voices.find(v => v.name.includes('Samantha')) ||
                voices.find(v => v.name.includes('Zira')) ||
                voices.find(v => v.name.includes('Daniel')) ||
                voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
                voices.find(v => v.lang === 'en-US');

            if (bestVoice) {
                utterance.voice = bestVoice;
            }

            window.speechSynthesis.speak(utterance);
        }, 50);
    }
};

window.speechSynthesis.onvoiceschanged = function () {
    window.speechSynthesis.getVoices();
};