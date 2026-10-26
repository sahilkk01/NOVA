
const profileGreeting = document.getElementById("greeting");
const profileStatus= document.getElementById("status");
const profileBox = document.getElementById("profileBox");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveNameBtn");

const hour = new Date().getHours();

let timeGreeting;

if (hour < 12) {
    timeGreeting = "Good morning";
} else if (hour < 17) {
    timeGreeting = "Good afternoon";
} else {
    timeGreeting = "Good evening";
}

function showGreeting(name) {
    profileGreeting.textContent = timeGreeting + ", " + name + "!";
    profileStatus.textContent = "I'm NOVA, your personal voice assistant.";
}

const savedName = localStorage.getItem("novaUserName");

if (savedName) {
    showGreeting(savedName);
    profileBox.style.display = "none";
} else {
    profileGreeting.textContent = timeGreeting + "! I'm NOVA.";
    profileStatus.textContent = "What should I call you?";
}

saveNameBtn.addEventListener("click", function () {
    const name = nameInput.value.trim();

    if (name === "") {
        statusText.textContent = "Please enter your name first.";
        return;
    }

    localStorage.setItem("novaUserName", name);
    showGreeting(name);
    profileBox.style.display = "none";
});
