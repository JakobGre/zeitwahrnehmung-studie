// ==========================================
// KONFIGURATION: HIER DEINE GOOGLE URL REIN!
// ==========================================
const GOOGLE_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxkRc12r7jcM2F2Zc8BVo6DPO1PnMMV7PLkyCuRwGTrVwxW8-bCZkiLhUn4XtCJqrrd-A/exec';

// --- State Management ---
const STATE_KEY = 'timePerceptionState';
const RESULTS_KEY = 'timePerceptionResults';

let state = {
    participantId: null,
    currentPhase: null, // 'pre' or 'post'
    calibrationRun: 1,
    isPractice: true,
    trials: [], 
    currentTrialIndex: 0,
    startTime: 0
};

// --- Helper Functions ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
function loadState() {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) state = JSON.parse(saved);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    document.getElementById(screenId).classList.add('active');
}

// --- App Initialization & Theme ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupThemeToggle();
    
    if (state.participantId) {
        document.getElementById('display-id').textContent = state.participantId;
        showScreen('screen-menu');
    }

    attachEventListeners();
});

function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    const moon = document.getElementById('moon-icon');
    const sun = document.getElementById('sun-icon');
    
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode');
        moon.classList.add('hidden');
        sun.classList.remove('hidden');
    }

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        moon.classList.toggle('hidden');
        sun.classList.toggle('hidden');
    });
}

// --- Event Listeners & Logic ---
function attachEventListeners() {
    document.getElementById('btn-login').addEventListener('click', () => {
        const input = document.getElementById('participant-id').value.trim();
        if (!input) return alert('Bitte eine ID eingeben.');
        state.participantId = input;
        saveState();
        document.getElementById('display-id').textContent = state.participantId;
        showScreen('screen-menu');
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        if(confirm('Wirklich abmelden? Der Fortschritt wird zurückgesetzt.')) {
            localStorage.removeItem(STATE_KEY);
            state.participantId = null;
            document.getElementById('participant-id').value = '';
            showScreen('screen-login');
        }
    });

    const startPhase = (phase) => {
        state.currentPhase = phase;
        state.isPractice = true;
        state.calibrationRun = 1;
        saveState();
        showScreen('screen-instructions');
    };
    document.getElementById('btn-pre-test').addEventListener('click', () => startPhase('pre'));
    document.getElementById('btn-post-test').addEventListener('click', () => startPhase('post'));

    document.getElementById('btn-start-calibration').addEventListener('click', () => {
        prepareCalibrationScreen();
        showScreen('screen-calibration');
    });

    const btnRunCalib = document.getElementById('btn-run-calibration');
    const btnNextCalib = document.getElementById('btn-next-calibration');
    const progressBar = document.getElementById('calib-progress');

    btnRunCalib.addEventListener('click', () => {
        btnRunCalib.disabled = true;
        progressBar.style.transition = 'width 24s linear';
        progressBar.style.width = '100%';

        setTimeout(() => {
            if (state.calibrationRun === 1) {
                state.calibrationRun = 2;
                btnRunCalib.textContent = 'Durchgang 2 starten';
                btnRunCalib.disabled = false;
                progressBar.style.transition = 'none';
                progressBar.style.width = '0%';
                document.getElementById('calib-subtitle').textContent = 'Präge dir die Zeitdauer erneut ein (Durchgang 2/2).';
            } else {
                btnRunCalib.classList.add('hidden');
                btnNextCalib.classList.remove('hidden');
            }
        }, 24000); 
    });

    btnNextCalib.addEventListener('click', () => startPracticePhase());

    const btnAction = document.getElementById('btn-action');
    const btnNextTrial = document.getElementById('btn-next-trial');
    
    btnAction.addEventListener('click', () => {
        if (btnAction.classList.contains('start')) {
            state.startTime = performance.now();
            btnAction.classList.remove('start');
            btnAction.classList.add('stop');
            btnAction.textContent = 'Stop';
        } else {
            const endTime = performance.now();
            const durationSec = (endTime - state.startTime) / 1000;
            const targetSec = state.trials[state.currentTrialIndex];
            btnAction.classList.add('hidden');
            
            const result = {
                participantId: state.participantId,
                testPhase: state.currentPhase,
                isPractice: state.isPractice,
                targetDuration: targetSec,
                estimatedDuration: Number(durationSec.toFixed(3)),
                errorMargin: Number((durationSec - targetSec).toFixed(3))
            };

            saveResult(result);

            if (state.isPractice) {
                document.getElementById('feedback-time').textContent = durationSec.toFixed(2) + ' s';
                document.getElementById('feedback-area').classList.remove('hidden');
            }
            btnNextTrial.classList.remove('hidden');
        }
    });

    btnNextTrial.addEventListener('click', () => {
        state.currentTrialIndex++;
        saveState();
        if (state.currentTrialIndex < state.trials.length) {
            setupNextTrial();
        } else {
            state.isPractice ? showScreen('screen-transition') : showScreen('screen-done');
        }
    });

    document.getElementById('btn-start-main').addEventListener('click', () => startMainPhase());
    document.getElementById('btn-back-menu').addEventListener('click', () => showScreen('screen-menu'));
    document.getElementById('btn-export').addEventListener('click', exportCSV);
}

function prepareCalibrationScreen() {
    document.getElementById('btn-run-calibration').classList.remove('hidden');
    document.getElementById('btn-run-calibration').disabled = false;
    document.getElementById('btn-run-calibration').textContent = '24s starten';
    document.getElementById('btn-next-calibration').classList.add('hidden');
    document.getElementById('calib-progress').style.transition = 'none';
    document.getElementById('calib-progress').style.width = '0%';
    document.getElementById('calib-subtitle').textContent = 'Präge dir die Zeitdauer von exakt 24 Sekunden ein (Durchgang 1/2).';
}

function startPracticePhase() {
    state.isPractice = true;
    state.currentTrialIndex = 0;
    state.trials = shuffleArray([6, 12, 18, 24]);
    saveState();
    setupNextTrial();
    showScreen('screen-test');
}

function startMainPhase() {
    state.isPractice = false;
    state.currentTrialIndex = 0;
    let rawTrials = [];
    [6, 12, 18, 24].forEach(time => { for(let i=0; i<6; i++) rawTrials.push(time); });
    state.trials = shuffleArray(rawTrials);
    saveState();
    setupNextTrial();
    showScreen('screen-test');
}

function setupNextTrial() {
    const isPractice = state.isPractice;
    document.getElementById('test-title').textContent = isPractice ? 'Übungsphase' : 'Haupttest';
    document.getElementById('test-subtitle').textContent = `Durchgang ${state.currentTrialIndex + 1} von ${state.trials.length}`;
    document.getElementById('target-duration').textContent = state.trials[state.currentTrialIndex];
    
    const btnAction = document.getElementById('btn-action');
    btnAction.classList.remove('hidden', 'stop');
    btnAction.classList.add('start');
    btnAction.textContent = 'Start';
    
    document.getElementById('feedback-area').classList.add('hidden');
    document.getElementById('btn-next-trial').classList.add('hidden');
}

// --- Cloud-Export (Google Sheets) & Lokales Backup ---
async function saveResult(result) {
    // 1. Offline Backup
    let results = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
    results.push(result);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results));

    // 2. An Google senden
    if(GOOGLE_WEBHOOK_URL !== 'DEINE_WEB_APP_URL_HIER_EINFUEGEN') {
        try {
            await fetch(GOOGLE_WEBHOOK_URL, {
                method: 'POST',
                body: JSON.stringify(result)
            });
            console.log('Daten an Google Sheets gesendet.');
        } catch (error) {
            console.error('Fehler beim Senden an Google:', error);
        }
    }
}

function exportCSV() {
    const results = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
    if (results.length === 0) return alert('Noch keine Daten vorhanden.');
    const headers = ['Participant_ID', 'Test_Phase', 'Is_Practice', 'Target_Duration', 'Estimated_Duration', 'Error_Margin'];
    const rows = results.map(r => [r.participantId, r.testPhase, r.isPractice, r.targetDuration, r.estimatedDuration, r.errorMargin].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `time_perception_backup_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}