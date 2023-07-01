var txtInput = document.querySelector('#txtInput');
var voiceList = document.querySelector('#voiceList');
var btnSpeak = document.querySelector('#btnSpeak');
var btnPause = document.querySelector('#btnPause');
var btnStop = document.querySelector('#btnStop');

var synth = window.speechSynthesis;
var voices = [];

PopulateVoices();
if (speechSynthesis !== undefined) {
    speechSynthesis.onvoiceschanged = PopulateVoices;
}

btnSpeak.addEventListener('click', () => {
    var inputtext = txtInput.value;
    var textToRead = inputtext.replace(/['"]+/g, '');
    console.log(textToRead)
    var toSpeak = new SpeechSynthesisUtterance(textToRead);
    var selectedVoiceName = voiceList.selectedOptions[0].getAttribute('data-name');
    voices.forEach((voice) => {
        if (voice.name === selectedVoiceName) {
            toSpeak.voice = voice;
        }
    });

    synth.speak(toSpeak);
    if (synth.paused) { /* unpause/resume narration */
        synth.resume();
    }
});
function pause() {
    synth.pause();
}

function stop() {
    synth.cancel();
}

btnPause.addEventListener('click', pause);
btnStop.addEventListener('click', stop);

function PopulateVoices() {
    voices = synth.getVoices();
    var selectedIndex = voiceList.selectedIndex < 0 ? 0 : voiceList.selectedIndex;
    voiceList.innerHTML = '';
    voices.forEach((voice) => {
        var listItem = document.createElement('option');
        listItem.textContent = voice.name;
        listItem.setAttribute('data-lang', voice.lang);
        listItem.setAttribute('data-name', voice.name);
        voiceList.appendChild(listItem);
    });

    voiceList.selectedIndex = selectedIndex;
}