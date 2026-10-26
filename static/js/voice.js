
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusText = document.getElementById("status");
const userMessage = document.getElementById("userMessage");
const assistantMessage = document.getElementById("assistantMessage");
const orb = document.getElementById("orb");
const messageForm = document.getElementById("messageForm");
const textInput = document.getElementById("textInput");
const muteBtn = document.getElementById("muteBtn");

let voiceMuted = false;

let stream = null;
let audioContext = null;
let processor = null;
let source = null;
let silentGain = null;

let sessionActive = false;
let mode = "stopped";

let audioChunks = [];
let preRollChunks = [];
let silenceTime = 0;
let interruptionTime = 0;
let lastFrameTime = 0;

let turnId = 0;
let speechId = 0;

const SPEECH_THRESHOLD = 0.018;
const SILENCE_DURATION = 1500;
const INTERRUPTION_DURATION = 400;
const PRE_ROLL_LIMIT = 10;

// Button events
startBtn.addEventListener("click", startAssistant);
stopBtn.addEventListener("click", stopAssistant);


// MUTE AND UNMUTE
muteBtn.addEventListener("click", function () {
    voiceMuted = !voiceMuted;

    muteBtn.textContent = voiceMuted
        ? "🔇 Unmute Voice"
        : "🔊 Mute Voice";

    muteBtn.setAttribute("aria-pressed", String(voiceMuted));

    if (voiceMuted) {
        speechId++;
        window.speechSynthesis.cancel();

        if (sessionActive && mode === "speaking") {
            mode = "listening";
        }

        statusText.textContent = sessionActive
            ? "Voice muted. NOVA is listening."
            : "Voice muted. You can type your questions.";
    } else {
        statusText.textContent = sessionActive
            ? "Voice enabled. NOVA is listening."
            : "Voice enabled. You can type your questions.";
    }
});


// START VOICE ASSISTANT
async function startAssistant() {
    if (sessionActive) return;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        audioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();

        await audioContext.resume();

        source = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        silentGain = audioContext.createGain();
        silentGain.gain.value = 0;

        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioContext.destination);

        sessionActive = true;
        mode = "listening";

        audioChunks = [];
        preRollChunks = [];
        silenceTime = 0;
        interruptionTime = 0;
        lastFrameTime = 0;

        startBtn.disabled = true;
        orb.classList.add("active");

        statusText.textContent = voiceMuted
            ? "Voice muted. NOVA is listening."
            : "NOVA is listening. Speak anytime.";

        processor.onaudioprocess = handleAudio;

    } catch (error) {
        console.error("Microphone error:", error);

        statusText.textContent =
            "Microphone access failed. Please allow microphone access.";

        cleanupAudio();
    }
}


// PROCESS MICROPHONE AUDIO
function handleAudio(event) {
    if (!sessionActive || !audioContext) return;

    const input = event.inputBuffer.getChannelData(0);
    const samples = new Float32Array(input);
    const rms = calculateRMS(samples);
    const now = performance.now();

    const frameDuration = lastFrameTime
        ? now - lastFrameTime
        : (samples.length / audioContext.sampleRate) * 1000;

    lastFrameTime = now;

    preRollChunks.push(samples);

    if (preRollChunks.length > PRE_ROLL_LIMIT) {
        preRollChunks.shift();
    }

    const voiceDetected = rms > SPEECH_THRESHOLD;

    // Normal listening
    if (mode === "listening") {
        if (voiceDetected) {
            beginRecording();
            audioChunks.push(samples);
        }

        return;
    }

    // Recording a question
    if (mode === "recording") {
        audioChunks.push(samples);

        if (voiceDetected) {
            silenceTime = 0;
        } else {
            silenceTime += frameDuration;
        }

        if (silenceTime >= SILENCE_DURATION) {
            finishRecording();
        }

        return;
    }

    // Detect interruptions while thinking or speaking
    if (mode === "speaking" || mode === "processing") {
        if (voiceDetected) {
            interruptionTime += frameDuration;
        } else {
            interruptionTime = Math.max(
                0,
                interruptionTime - frameDuration
            );
        }

        if (interruptionTime >= INTERRUPTION_DURATION) {
            interruptNOVA();

            audioChunks = preRollChunks.map(
                chunk => new Float32Array(chunk)
            );

            mode = "recording";
            silenceTime = 0;
            interruptionTime = 0;

            statusText.textContent =
                "NOVA interrupted. Listening to your question...";
        }
    }
}


// CALCULATE SOUND LEVEL
function calculateRMS(samples) {
    let total = 0;

    for (let i = 0; i < samples.length; i++) {
        total += samples[i] * samples[i];
    }

    return Math.sqrt(total / samples.length);
}


// START RECORDING A QUESTION
function beginRecording() {
    if (!sessionActive) return;

    mode = "recording";
    audioChunks = [];
    silenceTime = 0;

    statusText.textContent = "Listening to your question...";
}


// FINISH RECORDING AND CONVERT SPEECH TO TEXT
async function finishRecording() {
    if (!sessionActive || mode !== "recording") return;

    mode = "processing";

    const currentTurn = ++turnId;
    const chunks = audioChunks.slice();

    audioChunks = [];
    silenceTime = 0;
    interruptionTime = 0;

    statusText.textContent = "Understanding your question...";

    try {
        const blob = createWav(chunks);
        const formData = new FormData();

        formData.append("audio", blob, "question.wav");

        const response = await fetch("/transcribe", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!sessionActive || currentTurn !== turnId) return;

        if (!response.ok || !data.text) {
            statusText.textContent =
                data.error || "I could not understand. Please try again.";

            mode = "listening";
            return;
        }

        userMessage.textContent = "You: " + data.text;

        await askNOVA(data.text, currentTurn);

    } catch (error) {
        console.error("Transcription error:", error);

        if (sessionActive && currentTurn === turnId) {
            statusText.textContent =
                "Speech recognition failed. Please try again.";

            mode = "listening";
        }
    }
}


// SEND A QUESTION TO NOVA
// Supports typed and spoken questions.
async function askNOVA(question, currentTurn = ++turnId) {
    if (!question || !question.trim()) return;

    if (sessionActive) {
        mode = "processing";
        statusText.textContent = "NOVA is thinking...";
    } else {
        statusText.textContent = "Getting your text answer...";
    }

    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: question.trim()
            })
        });

        const data = await response.json();

        // Ignore an outdated answer.
        if (currentTurn !== turnId) return;

        if (!response.ok || !data.answer) {
            assistantMessage.textContent =
                data.error || "Sorry, I could not answer that.";

            statusText.textContent = sessionActive
                ? "NOVA is listening. Try again."
                : "Please try again.";

            if (sessionActive) {
                mode = "listening";
            }

            return;
        }

        // Always display the answer.
        assistantMessage.textContent = "NOVA: " + data.answer;

        // IMPORTANT: Typed answers also speak without Start.
        if (!voiceMuted) {
            speakAnswer(data.answer, currentTurn);
        } else {
            statusText.textContent = sessionActive
                ? "Voice muted. NOVA is listening."
                : "Voice muted. Answer displayed as text.";

            if (sessionActive) {
                mode = "listening";
            }
        }

    } catch (error) {
        console.error("Assistant error:", error);

        if (currentTurn === turnId) {
            assistantMessage.textContent =
                "NOVA: Sorry, something went wrong.";

            statusText.textContent = "Please try again.";

            if (sessionActive) {
                mode = "listening";
            }
        }
    }
}


// SELECT A FEMALE-SOUNDING ENGLISH VOICE IF AVAILABLE
function getFemaleEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();

    const englishVoices = voices.filter(voice =>
        voice.lang.toLowerCase().startsWith("en")
    );

    const preferredNames = [
        "aria",
        "jenny",
        "zira",
        "samantha",
        "ava",
        "susan",
        "hazel",
        "google uk english female",
        "female"
    ];

    for (const name of preferredNames) {
        const match = englishVoices.find(voice =>
            voice.name.toLowerCase().includes(name)
        );

        if (match) return match;
    }

    return englishVoices[0] || null;
}


// SPEAK NOVA'S ANSWER
function speakAnswer(text, currentTurn) {
    // Do not require Start for typed answers.
    if (voiceMuted || currentTurn !== turnId) return;

    window.speechSynthesis.cancel();

    const currentSpeech = ++speechId;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;   // Slightly slower, calmer speech
    utterance.pitch = 1.0;   // Natural pitch
    utterance.volume = 1.0;  // Full volume
    utterance.voice = getFemaleEnglishVoice();
    utterance.lang = "en-US";
    const selectedVoice = getFemaleEnglishVoice();

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    }

    if (sessionActive) {
        mode = "speaking";
        interruptionTime = 0;

        statusText.textContent =
            "NOVA is speaking. You can interrupt by talking.";
    } else {
        statusText.textContent = "NOVA is speaking...";
    }

    utterance.onend = function () {
        if (
            currentSpeech !== speechId ||
            currentTurn !== turnId
        ) {
            return;
        }

        if (sessionActive) {
            mode = "listening";

            statusText.textContent = voiceMuted
                ? "Voice muted. NOVA is listening."
                : "NOVA is listening. Speak anytime.";
        } else {
            statusText.textContent = "Answer complete.";
        }
    };

    utterance.onerror = function (event) {
        if (
            currentSpeech !== speechId ||
            currentTurn !== turnId
        ) {
            return;
        }

        console.error("Speech error:", event.error);

        if (sessionActive) {
            mode = "listening";
            statusText.textContent =
                "NOVA is listening. Speak anytime.";
        } else {
            statusText.textContent =
                "Could not play speech. Check your browser's sound settings.";
        }
    };

    window.speechSynthesis.speak(utterance);
}


// INTERRUPT NOVA
function interruptNOVA() {
    turnId++;
    speechId++;

    window.speechSynthesis.cancel();

    mode = "recording";
    statusText.textContent = "NOVA interrupted.";
}


// CONVERT RECORDED AUDIO TO WAV
function createWav(chunks) {
    const totalLength = chunks.reduce(
        (total, chunk) => total + chunk.length,
        0
    );

    const samples = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
    }

    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(position, value) {
        for (let i = 0; i < value.length; i++) {
            view.setUint8(position + i, value.charCodeAt(i));
        }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, audioContext.sampleRate, true);
    view.setUint32(28, audioContext.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let position = 44;

    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));

        view.setInt16(
            position,
            sample < 0 ? sample * 0x8000 : sample * 0x7FFF,
            true
        );

        position += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
}


// CLOSE THE MICROPHONE
function cleanupAudio() {
    if (processor) {
        processor.onaudioprocess = null;
        processor.disconnect();
        processor = null;
    }

    if (source) {
        source.disconnect();
        source = null;
    }

    if (silentGain) {
        silentGain.disconnect();
        silentGain = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    if (audioContext) {
        audioContext.close().catch(console.error);
        audioContext = null;
    }
}


// STOP VOICE MODE
function stopAssistant() {
    sessionActive = false;
    mode = "stopped";

    turnId++;
    speechId++;

    window.speechSynthesis.cancel();

    audioChunks = [];
    preRollChunks = [];

    cleanupAudio();

    startBtn.disabled = false;
    statusText.textContent = "NOVA is stopped.";
    orb.classList.remove("active");
}


// HANDLE TYPED QUESTIONS
messageForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const question = textInput.value.trim();
    if (!question) return;

    textInput.value = "";
    userMessage.textContent = "You: " + question;

    // Cancel older answers and speech.
    turnId++;
    speechId++;

    window.speechSynthesis.cancel();

    const currentTurn = turnId;

    if (sessionActive) {
        mode = "processing";
    }

    // Start is not required for typed questions.
    await askNOVA(question, currentTurn);
});


// Load available browser voices.
window.speechSynthesis.onvoiceschanged = function () {
    window.speechSynthesis.getVoices();
};
