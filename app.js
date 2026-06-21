// --- State Management ---
const STATE_KEY = 'timePerceptionState';
const RESULTS_KEY = 'timePerceptionResults';

let state = {
    participantId: null,
    condition: 'mental', // 'mental' oder 'physical'
    currentPhase: null, // 'pre' oder 'post'
    calibrationRun: 1,
    isPractice: true,
    trials: [], 
    currentTrialIndex: 0,
    startTime: 0
};

// --- Sicherheits-Locks für den Timer ---
let isTimerRunning = false;
let isTrialFinished = false;

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
        state.condition = document.getElementById('condition-select').value;
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
        if (isTrialFinished) return;

        if (!isTimerRunning) {
            state.startTime = performance.now();
            isTimerRunning = true;
            
            btnAction.classList.remove('start');
            btnAction.classList.add('stop');
            btnAction.textContent = 'Stop';
        } else {
            const endTime = performance.now();
            
            isTimerRunning = false;
            isTrialFinished = true; 
            
            btnAction.classList.remove('stop');
            btnAction.classList.add('success');
            btnAction.innerHTML = '&#10003;'; 
            btnAction.disabled = true;

            const durationSec = (endTime - state.startTime) / 1000;
            const targetSec = state.trials[state.currentTrialIndex];
            
            const result = {
                participantId: state.participantId,
                condition: state.condition,
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
            } else {
                document.getElementById('feedback-time').textContent = '';
                document.getElementById('feedback-area').classList.add('hidden');
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
    
    // Export Buttons
    document.getElementById('btn-download-final').addEventListener('click', exportWideCSV);
    document.getElementById('btn-export-admin').addEventListener('click', exportWideCSV);
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
    
    isTimerRunning = false;
    isTrialFinished = false;
    
    const btnAction = document.getElementById('btn-action');
    btnAction.disabled = false;
    btnAction.classList.remove('hidden', 'stop', 'success');
    btnAction.classList.add('start');
    btnAction.textContent = 'Start';
    
    document.getElementById('feedback-time').textContent = '';
    document.getElementById('feedback-area').classList.add('hidden');
    document.getElementById('btn-next-trial').classList.add('hidden');
}

// --- Datenspeicherung ---
function saveResult(result) {
    let results = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
    results.push(result);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

// --- CSV Formatierung (Wide-Format nach Excel-Vorlage) ---
function exportWideCSV() {
    const results = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
    if (results.length === 0) return alert('Noch keine Daten vorhanden.');

    // Nur Daten aus dem Haupttest verwenden
    const mainResults = results.filter(r => !r.isPractice);
    
    // Daten nach Participant, Condition und Phase gruppieren
    const groups = {};
    mainResults.forEach(r => {
        const key = `${r.participantId}_${r.condition}_${r.testPhase}`;
        if (!groups[key]) {
            groups[key] = {
                participantId: r.participantId,
                condition: r.condition,
                timepoint: r.testPhase,
                errors: { 6: [], 12: [], 18: [], 24: [] }
            };
        }
        groups[key].errors[r.targetDuration].push(r.errorMargin);
    });

    // Header für 6 Durchgänge generieren
    const headers = [
        'participant_id', 'Name', 'height_cm', 'body_mass_kg', 'licensed_experience_years', 'weekly_training_sessions', 
        'condition', 'timepoint', 
        'duration_s', 'trial_1_error', 'trial_2_error', 'trial_3_error', 'trial_4_error', 'trial_5_error', 'trial_6_error',
        'duration_s', 'trial_1_error', 'trial_2_error', 'trial_3_error', 'trial_4_error', 'trial_5_error', 'trial_6_error',
        'duration_s', 'trial_1_error', 'trial_2_error', 'trial_3_error', 'trial_4_error', 'trial_5_error', 'trial_6_error',
        'duration_s', 'trial_1_error', 'trial_2_error', 'trial_3_error', 'trial_4_error', 'trial_5_error', 'trial_6_error',
        'notes'
    ];

    let csvRows = [headers.join(',')];

    Object.values(groups).forEach(g => {
        // Auffüllen auf exakt 6 Werte, falls etwas fehlt
        const pad = (arr) => {
            let res = [...arr];
            while(res.length < 6) res.push('');
            return res.slice(0, 6);
        };

        const e6 = pad(g.errors[6]);
        const e12 = pad(g.errors[12]);
        const e18 = pad(g.errors[18]);
        const e24 = pad(g.errors[24]);

        // Punkt durch Komma ersetzen für deutsches Excel
        const fmt = (val) => val !== '' ? String(val).replace('.', ',') : '';

        const row = [
            g.participantId, '', '', '', '', '', 
            g.condition, g.timepoint,
            6, fmt(e6[0]), fmt(e6[1]), fmt(e6[2]), fmt(e6[3]), fmt(e6[4]), fmt(e6[5]),
            12, fmt(e12[0]), fmt(e12[1]), fmt(e12[2]), fmt(e12[3]), fmt(e12[4]), fmt(e12[5]),
            18, fmt(e18[0]), fmt(e18[1]), fmt(e18[2]), fmt(e18[3]), fmt(e18[4]), fmt(e18[5]),
            24, fmt(e24[0]), fmt(e24[1]), fmt(e24[2]), fmt(e24[3]), fmt(e24[4]), fmt(e24[5]),
            ''
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Benennung der Datei für leichte Zuordnung
    const fileName = state.participantId ? `Ergebnisse_${state.participantId}_${state.condition}_${state.currentPhase}.csv` : 'Ergebnisse_Zeitwahrnehmung.csv';
    link.setAttribute("download", fileName);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}