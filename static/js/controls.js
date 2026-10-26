
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const orb = document.getElementById("orb");
const statusText = document.getElementById("status");
const userMessage = document.getElementById("userMessage");

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition;
let assistantRunning = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = function () {
        statusText.textContent = "NOVA is listening...";
        orb.classList.add("listening");
        console.log("Microphone recognition started");
    };

    recognition.onresult = function (event) {
    console.log("Speech result received:", event);

    const result = event.results[event.results.length - 1];
    const question = result[0].transcript;

    userMessage.textContent = "You: " + question;
    statusText.textContent = "Voice detected!";
};

    recognition.onerror = function (event) {
    console.log("Speech error:", event.error);
    statusText.textContent = "Speech error: " + event.error;
};
    recognition.onend = function () {
        console.log("Speech recognition ended.");

        orb.classList.remove("listening");

        if (assistantRunning) {
            statusText.textContent = "NOVA is ready";
        }
    };
} else {
    statusText.textContent =
        "Speech recognition is not supported in this browser.";
}

startBtn.addEventListener("click", function () {
    if (!recognition) {
        return;
    }

    assistantRunning = true;

    try {
        recognition.start();
    } catch (error) {
        statusText.textContent =
            "Please wait a moment and try again.";
        console.log(error);
    }
});

stopBtn.addEventListener("click", function () {
    assistantRunning = false;

    if (recognition) {
        recognition.stop();
    }

    orb.classList.remove("listening");
    statusText.textContent = "NOVA is stopped";
});
