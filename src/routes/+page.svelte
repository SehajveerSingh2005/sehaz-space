<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import initialHotspots from '$lib/hotspots.json';
	import bedroomDay from '$lib/images/bedroom.png?enhanced&quality=95';
	import bedroomNight from '$lib/images/bedroom-night.png?enhanced&quality=95';
	import livingRoomDay from '$lib/images/living-room.png?enhanced&quality=95';
	import livingRoomNight from '$lib/images/living-room-night.png?enhanced&quality=95';

	// Hotspot Interface
	interface Hotspot {
		id: string;
		label: string;
		description: string;
		x: number; // percentage
		y: number; // percentage
		color: 'purple' | 'blue' | 'pink';
		type: 'computer_desk' | 'vinyl_player' | 'bed_chill' | 'wardrobe' | 'general' | 'light_switch' | 'room_switch';
		room?: string;
	}

	// State Runes
	let devMode = $state(false);
	let activeHotspot = $state<Hotspot | null>(null);
	let selectedHotspotId = $state<string | null>(null);
	let isNightMode = $state(false);
	let currentRoom = $state(
		(typeof window !== 'undefined' && localStorage.getItem('currentRoom')) || 'bedroom'
	);

	// Hotspots list
	let hotspots = $state<Hotspot[]>(initialHotspots);

	// New hotspot editor state
	let newHotspot = $state<Partial<Hotspot> | null>(null);

	// Audio State (YouTube Music API via YouTube IFrame API)
	let ytPlayer = $state<any>(null);
	let isPlayerReady = $state(false);
	let isAudioPlaying = $state(false);
	let currentTrackIndex = $state(0);
	let audioVolume = $state(0.5);
	let currentRPM = $state(33);
	let autoplayEnabled = $state(
		typeof window !== 'undefined'
			? localStorage.getItem('autoplayEnabled') !== 'false'
			: true
	);

	function setRPM(rpm: number) {
		currentRPM = rpm;
		let rate = 1.0;
		if (rpm === 45) rate = 1.25;
		if (rpm === 78) rate = 1.5;
		if (ytPlayer && isPlayerReady && typeof ytPlayer.setPlaybackRate === 'function') {
			try {
				ytPlayer.setPlaybackRate(rate);
				console.log('Playback rate changed to:', rate);
			} catch(e) {
				console.error(e);
			}
		}
	}

	const tracks = [
		{ name: 'Drake - Passionfruit', ytId: 'COz9lDCFHjw', duration: '4:59' },
		{ name: 'Tyler, The Creator - Earfquake', ytId: 'Aztdmq1tYY8', duration: '3:10' },
		{ name: 'Frank Ocean - White Ferrari', ytId: 'Dlz_XHeUUis', duration: '4:08' },
		{ name: 'Daniel Caesar - Take Me Away', ytId: '4FMWXCpBwTI', duration: '3:43' },
		{ name: 'Kanye West - Ghost Town', ytId: '5S6az6odzPI', duration: '4:31' }
	];


	// ==================== WEB AUDIO SYNTHESIZER ENGINE ====================
	let synthOscType = $state<'sawtooth' | 'sine' | 'square' | 'triangle'>('sawtooth');
	let synthAttack = $state(0.04);  // Attack fader value
	let synthRelease = $state(0.35); // Release fader value
	let synthCutoff = $state(2000);  // Lowpass filter cutoff frequency
	let synthRes = $state(4);         // Filter resonance (Q)
	let activeNoteKeys = $state<Record<string, boolean>>({}); // Visual active keys tracking

	let synthAudioCtx: AudioContext | null = null;
	let synthMasterGain: GainNode | null = null;
	let synthAnalyser: AnalyserNode | null = null;
	let canvasElem: HTMLCanvasElement | null = null;
	let canvasCtx: CanvasRenderingContext2D | null = null;
	let animationFrameId: number | null = null;

	const synthKeys = [
		{ note: 'C4', freq: 261.63, isBlack: false, chars: ['Z'] },
		{ note: 'C#4', freq: 277.18, isBlack: true, chars: ['S'] },
		{ note: 'D4', freq: 293.66, isBlack: false, chars: ['X'] },
		{ note: 'D#4', freq: 311.13, isBlack: true, chars: ['D'] },
		{ note: 'E4', freq: 329.63, isBlack: false, chars: ['C'] },
		{ note: 'F4', freq: 349.23, isBlack: false, chars: ['V'] },
		{ note: 'F#4', freq: 369.99, isBlack: true, chars: ['G'] },
		{ note: 'G4', freq: 392.00, isBlack: false, chars: ['B'] },
		{ note: 'G#4', freq: 415.30, isBlack: true, chars: ['H'] },
		{ note: 'A4', freq: 440.00, isBlack: false, chars: ['N'] },
		{ note: 'A#4', freq: 466.16, isBlack: true, chars: ['J'] },
		{ note: 'B4', freq: 493.88, isBlack: false, chars: ['M'] },
		{ note: 'C5', freq: 523.25, isBlack: false, chars: [',', 'Q'] },
		{ note: 'C#5', freq: 554.37, isBlack: true, chars: ['L', '2'] },
		{ note: 'D5', freq: 587.33, isBlack: false, chars: ['.', 'W'] },
		{ note: 'D#5', freq: 622.25, isBlack: true, chars: [';', '3'] },
		{ note: 'E5', freq: 659.25, isBlack: false, chars: ['/', 'E'] },
		{ note: 'F5', freq: 698.46, isBlack: false, chars: ['R'] },
		{ note: 'F#5', freq: 739.99, isBlack: true, chars: ['5'] },
		{ note: 'G5', freq: 783.99, isBlack: false, chars: ['T'] },
		{ note: 'G#5', freq: 830.61, isBlack: true, chars: ['6'] },
		{ note: 'A5', freq: 880.00, isBlack: false, chars: ['Y'] },
		{ note: 'A#5', freq: 932.33, isBlack: true, chars: ['7'] },
		{ note: 'B5', freq: 987.77, isBlack: false, chars: ['U'] },
		{ note: 'C6', freq: 1046.50, isBlack: false, chars: ['I'] }
	];

	const blackKeyOffsets: Record<string, number> = {
		'C#4': 4.5,
		'D#4': 11.1,
		'F#4': 24.5,
		'G#4': 31.1,
		'A#4': 37.8,
		'C#5': 51.1,
		'D#5': 57.8,
		'F#5': 71.1,
		'G#5': 77.8,
		'A#5': 84.5
	};

	const activeNodes = new Map<string, { osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode }>();

	function initSynthAudio() {
		if (synthAudioCtx) return;
		try {
			const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
			synthAudioCtx = new AudioContextClass();
			
			// Analyser for oscilloscope drawing
			synthAnalyser = synthAudioCtx.createAnalyser();
			synthAnalyser.fftSize = 512;
			
			// Master gain control
			synthMasterGain = synthAudioCtx.createGain();
			synthMasterGain.gain.setValueAtTime(0.35, synthAudioCtx.currentTime); // Safe master gain
			
			synthAnalyser.connect(synthMasterGain);
			synthMasterGain.connect(synthAudioCtx.destination);
		} catch (err) {
			console.error('Failed to initialize AudioContext:', err);
		}
	}

	function startNote(note: string, freq: number) {
		initSynthAudio();
		if (!synthAudioCtx || !synthAnalyser) return;

		if (synthAudioCtx.state === 'suspended') {
			synthAudioCtx.resume();
		}

		// Stop if currently playing
		if (activeNodes.has(note)) {
			stopNote(note);
		}

		const osc = synthAudioCtx.createOscillator();
		const gain = synthAudioCtx.createGain();
		const filter = synthAudioCtx.createBiquadFilter();

		osc.type = synthOscType;
		osc.frequency.setValueAtTime(freq, synthAudioCtx.currentTime);

		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(synthCutoff, synthAudioCtx.currentTime);
		filter.Q.setValueAtTime(synthRes, synthAudioCtx.currentTime);

		// Trigger ADSR Attack
		gain.gain.setValueAtTime(0, synthAudioCtx.currentTime);
		gain.gain.linearRampToValueAtTime(0.4, synthAudioCtx.currentTime + Math.max(0.01, synthAttack));

		osc.connect(filter);
		filter.connect(gain);
		gain.connect(synthAnalyser);

		osc.start();

		activeNodes.set(note, { osc, gain, filter });
		activeNoteKeys[note] = true;
	}

	function stopNote(note: string) {
		const nodeGroup = activeNodes.get(note);
		if (!nodeGroup || !synthAudioCtx) return;

		const { osc, gain } = nodeGroup;
		const now = synthAudioCtx.currentTime;

		// Trigger ADSR Release
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, synthRelease));

		setTimeout(() => {
			try {
				osc.stop();
				osc.disconnect();
				gain.disconnect();
			} catch (e) {}
		}, synthRelease * 1000 + 50);

		activeNodes.delete(note);
		activeNoteKeys[note] = false;
	}

	// Dynamic updates to active filters when sliders are adjusted
	$effect(() => {
		if (synthAudioCtx) {
			const now = synthAudioCtx.currentTime;
			for (const nodeGroup of activeNodes.values()) {
				nodeGroup.filter.frequency.setTargetAtTime(synthCutoff, now, 0.02);
				nodeGroup.filter.Q.setTargetAtTime(synthRes, now, 0.02);
			}
		}
	});

	function drawOscilloscope() {
		if (!canvasElem || !canvasCtx || !synthAnalyser) {
			return; // Stop the animation loop immediately if elements are missing
		}

		const width = canvasElem.width;
		const height = canvasElem.height;
		const bufferLength = synthAnalyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);
		
		synthAnalyser.getByteTimeDomainData(dataArray);

		// Grid background trails
		canvasCtx.fillStyle = 'rgba(10, 10, 15, 0.35)';
		canvasCtx.fillRect(0, 0, width, height);

		// Green Grid lines
		canvasCtx.strokeStyle = 'rgba(0, 255, 128, 0.06)';
		canvasCtx.lineWidth = 1;
		canvasCtx.beginPath();
		canvasCtx.moveTo(0, height / 2);
		canvasCtx.lineTo(width, height / 2);
		canvasCtx.moveTo(width / 2, 0);
		canvasCtx.lineTo(width / 2, height);
		canvasCtx.stroke();

		// Waveform line
		canvasCtx.lineWidth = 2.5;
		canvasCtx.strokeStyle = '#00ff80'; // Neon vector green
		canvasCtx.shadowBlur = 8;
		canvasCtx.shadowColor = '#00ff80';
		
		canvasCtx.beginPath();
		const sliceWidth = width / bufferLength;
		let x = 0;

		for (let i = 0; i < bufferLength; i++) {
			const v = dataArray[i] / 128.0;
			const y = (v * height) / 2;

			if (i === 0) {
				canvasCtx.moveTo(x, y);
			} else {
				canvasCtx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		canvasCtx.lineTo(width, height / 2);
		canvasCtx.stroke();
		canvasCtx.shadowBlur = 0; // reset glow

		animationFrameId = requestAnimationFrame(drawOscilloscope);
	}

	function startOscilloscope() {
		if (canvasElem) {
			canvasCtx = canvasElem.getContext('2d');
			drawOscilloscope();
		}
	}

	function stopOscilloscope() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
	}

	// Hotspot open/close watcher
	$effect(() => {
		if (activeHotspot && activeHotspot.label === 'synth') {
			initSynthAudio(); // Initialize audio context and analyser immediately on user click gesture
			setTimeout(() => {
				const canvas = document.getElementById('oscilloscope-canvas') as HTMLCanvasElement;
				if (canvas) {
					canvasElem = canvas;
					startOscilloscope();
				}
			}, 50);
		} else {
			// Only run cleanup if the synth was actually active/playing notes
			if (activeNodes.size > 0 || Object.keys(activeNoteKeys).length > 0) {
				stopOscilloscope();
				for (const note of activeNodes.keys()) {
					stopNote(note);
				}
				activeNodes.clear();
				activeNoteKeys = {};
			}
		}
	});

	// Keyboard mapping listeners
	function handleSynthKeyDown(e: KeyboardEvent) {
		const activeElem = document.activeElement;
		if (activeElem && (
			activeElem.tagName === 'INPUT' || 
			activeElem.tagName === 'TEXTAREA' || 
			activeElem.tagName === 'SELECT'
		)) return;

		if (e.repeat) return;
		
		const char = e.key.toUpperCase();
		const matchedKey = synthKeys.find(k => k.chars.includes(char));
		if (matchedKey) {
			e.preventDefault();
			startNote(matchedKey.note, matchedKey.freq);
		}
	}

	function handleSynthKeyUp(e: KeyboardEvent) {
		const char = e.key.toUpperCase();
		const matchedKey = synthKeys.find(k => k.chars.includes(char));
		if (matchedKey) {
			e.preventDefault();
			stopNote(matchedKey.note);
		}
	}

	$effect(() => {
		if (activeHotspot && activeHotspot.label === 'synth') {
			window.addEventListener('keydown', handleSynthKeyDown);
			window.addEventListener('keyup', handleSynthKeyUp);
			return () => {
				window.removeEventListener('keydown', handleSynthKeyDown);
				window.removeEventListener('keyup', handleSynthKeyUp);
			};
		}
	});

	// ==================== INTERACTIVE CHESS BOARD & PROFILE ENGINE ====================
	let chessProfile = $state<any>(null);
	let chessStats = $state<any>(null);
	let chessLoading = $state(true);
	let chessError = $state(false);

	async function fetchChessData() {
		chessLoading = true;
		chessError = false;
		try {
			const profileRes = await fetch('https://api.chess.com/pub/player/Sehazzzzz');
			if (!profileRes.ok) throw new Error();
			chessProfile = await profileRes.json();

			const statsRes = await fetch('https://api.chess.com/pub/player/Sehazzzzz/stats');
			if (statsRes.ok) {
				chessStats = await statsRes.json();
			}
		} catch (err) {
			console.error('Error fetching Chess.com stats:', err);
			chessError = true;
		} finally {
			chessLoading = false;
		}
	}

	let chessBoard = $state<(string | null)[][]>(Array(8).fill(null).map(() => Array(8).fill(null)));
	let selectedCell = $state<{ row: number, col: number } | null>(null);
	let puzzleStatus = $state<'idle' | 'solved' | 'wrong'>('idle');
	let puzzleMoveCount = $state(0);

	const pieceSymbols: Record<string, string> = {
		'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
		'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
	};

	function resetChessPuzzle() {
		selectedCell = null;
		puzzleStatus = 'idle';
		puzzleMoveCount = 0;

		const board = Array(8).fill(null).map(() => Array(8).fill(null));
		
		// Setup Smothered Mate Puzzle
		board[0][7] = 'bK'; // Black King on h8
		board[0][6] = 'bR'; // Black Rook on g8
		board[1][7] = 'bP'; // Black Pawn on h7
		board[1][6] = 'bP'; // Black Pawn on g7
		board[2][7] = 'wN'; // White Knight on h6 (starts on h6)
		board[7][7] = 'wK'; // White King on h1

		chessBoard = board;
	}

	function handleCellClick(row: number, col: number) {
		if (puzzleStatus === 'solved' || puzzleStatus === 'wrong') return;

		const clickedPiece = chessBoard[row][col];

		if (selectedCell) {
			const fromRow = selectedCell.row;
			const fromCol = selectedCell.col;
			const piece = chessBoard[fromRow][fromCol];

			if (fromRow === row && fromCol === col) {
				selectedCell = null;
				return;
			}

			// Change selection if clicking another white piece
			if (clickedPiece && clickedPiece.startsWith('w')) {
				selectedCell = { row, col };
				return;
			}

			// Validate puzzle move: wN from h6 (2,7) to f7 (1,5) [f7]
			if (piece === 'wN' && fromRow === 2 && fromCol === 7 && row === 1 && col === 5) {
				chessBoard[fromRow][fromCol] = null;
				chessBoard[row][col] = 'wN';
				selectedCell = null;
				puzzleStatus = 'solved';
				puzzleMoveCount++;
			} else {
				// Temporary move animation
				const originalTarget = chessBoard[row][col];
				chessBoard[fromRow][fromCol] = null;
				chessBoard[row][col] = piece;
				selectedCell = null;
				puzzleStatus = 'wrong';

				setTimeout(() => {
					chessBoard[fromRow][fromCol] = piece;
					chessBoard[row][col] = originalTarget;
					puzzleStatus = 'idle';
				}, 800);
			}
		} else {
			if (clickedPiece && clickedPiece.startsWith('w')) {
				selectedCell = { row, col };
			}
		}
	}

	$effect(() => {
		if (activeHotspot && (activeHotspot.type === 'chess' || activeHotspot.label === 'chess')) {
			fetchChessData();
			resetChessPuzzle();
		}
	});

	// ==================== CAT INTERACTIVE AUDIO & DIALOGUES ====================
	const catDialogues = [
		"Meow!? (Translation: Please feed me.)",
		"Purrrrr...",
		"Mrrrpp?",
		"*stares judgingly*",
		"Meow! (Translation: Rub my chin!)",
		"Prrrt? *cat leaps onto the desk*",
		"*yawns stretching its tiny paws*",
		"Mew! (Translation: Play with me!)",
		"Meow... (Translation: I need a nap.)",
		"*flicks its tail and ignores you*"
	];

	let lastDialogueIndex = -1;

	// Preload all meow sounds upfront so first-play is instant
	const meowSounds: HTMLAudioElement[] = (typeof window !== 'undefined') ? (() => {
		const srcs = ['/meow.mp3', '/meow2.wav', '/meow3.wav'];
		return srcs.map(src => {
			const a = new Audio(src);
			a.preload = 'auto';
			a.volume = 0.5;
			a.load();
			return a;
		});
	})() : [];

	function playMeowSound() {
		try {
			if (meowSounds.length === 0) return;
			const pick = meowSounds[Math.floor(Math.random() * meowSounds.length)];
			// Rewind in case it was played recently
			pick.currentTime = 0;
			pick.play().catch(() => {
				// Fallback to the first (mp3) if wav isn't available
				const fallback = meowSounds[0];
				fallback.currentTime = 0;
				fallback.play().catch(() => {});
			});
		} catch (err) {
			console.error('Failed to play meow audio:', err);
		}
	}


	function handleHotspotClick(spot: Hotspot) {
		if (devMode) {
			selectedHotspotId = spot.id;
			return;
		}

		if (spot.type === 'light_switch') {
			isNightMode = !isNightMode;
			return;
		}

		// Cat custom interactive dialogue and audio meow!
		if (spot.label === 'cat' || spot.id === 'spot_1783946003455') {
			playMeowSound();
			
			// Select next random dialogue avoiding direct repetition
			let nextIndex = lastDialogueIndex;
			while (nextIndex === lastDialogueIndex) {
				nextIndex = Math.floor(Math.random() * catDialogues.length);
			}
			lastDialogueIndex = nextIndex;
			spot.description = catDialogues[nextIndex];
		}

		if (spot.type === 'bookshelf' || spot.label === 'bookshelf' || spot.label === 'books 1') {
			selectedBookshelfItem = null;
		}

		if (spot.type === 'rack' || spot.label === 'rack') {
			selectedRackItem = null;
		}

		activeHotspot = spot;
	}

	// ==================== BOOKSHELF LIBRARY DATA ====================
	let bookshelfActiveTab = $state<'books' | 'albums'>('books');
	let selectedBookshelfItem = $state<any>(null);

	const favoriteBooks = [
		{
			title: "A Thousand Splendid Suns",
			author: "Khaled Hosseini",
			category: "Fiction / Drama",
			rating: 5,
			review: "A heartbreakingly beautiful story of resilience and maternal love in war-torn Afghanistan. The relationship between Mariam and Laila is one of the most moving portrayals of human connection in literature.",
			coverColor: "#7c2d12",
			designType: "suns",
			coverUrl: "https://en.wikipedia.org/wiki/Special:FilePath/A_Thousand_Splendid_Suns.gif"
		},
		{
			title: "The Metamorphosis",
			author: "Franz Kafka",
			category: "Classic Fiction / Existentialism",
			rating: 4.8,
			review: "Kafka's masterpiece on isolation, guilt, and the absurdity of modern existence. The tragedy of Gregor Samsa is how quickly his family moves on once he ceases to be economically productive.",
			coverColor: "#1e1e24",
			designType: "bug",
			coverUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Franz_Kafka_Die_Verwandlung_1916_Orig.-Pappband.jpg"
		},
		{
			title: "The Book of Disquiet",
			author: "Fernando Pessoa",
			category: "Philosophy / Poetry",
			rating: 5,
			review: "A dense, melancholic journal of thoughts on dreams, solitude, and the monotony of daily life in Lisbon. The absolute peak of literary introspection—feels like reading a waking dream.",
			coverColor: "#1e293b",
			designType: "disquiet",
			coverUrl: "https://en.wikipedia.org/wiki/Special:FilePath/LdoD_1ed.jpg"
		},
		{
			title: "Train to Pakistan",
			author: "Khushwant Singh",
			category: "Historical Fiction / Drama",
			rating: 4.9,
			review: "A raw, devastating look at the human cost of the Partition of India. It captures the sudden, tragic descent of a peaceful border village into communal madness with immense empathy.",
			coverColor: "#78350f",
			designType: "train",
			coverUrl: "https://en.wikipedia.org/wiki/Special:FilePath/Train_to_Pakistan.jpg"
		},
		{
			title: "Notes from Underground",
			author: "Fyodor Dostoevsky",
			category: "Philosophical Fiction / Classic",
			rating: 4.8,
			review: "The ultimate critique of rational egoism and progress. The underground man's spiteful, contradictory monologue remains one of the most raw and honest character studies ever written.",
			coverColor: "#0f172a",
			designType: "underground",
			coverUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/%D0%97%D0%B0%D0%BF%D0%B8%D1%81%D0%BA%D0%B8_%D0%B8%D0%B7_%D0%BF%D0%BE%D0%B4%D0%BF%D0%BE%D0%BB%D1%8C%D1%8F._%D0%9F%D0%BE%D0%B2%D0%B5%D1%81%D1%82%D1%8C_%D0%A4.%D0%9C._%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%281866%29_%D0%BE%D0%B1%D0%BB%D0%BE%D0%B6%D0%BA%D0%B0.jpg/500px-%D0%97%D0%B0%D0%BF%D0%B8%D1%81%D0%BA%D0%B8_%D0%B8%D0%B7_%D0%BF%D0%BE%D0%B4%D0%BF%D0%BE%D0%BB%D1%8C%D1%8F._%D0%9F%D0%BE%D0%B2%D0%B5%D1%81%D1%82%D1%8C_%D0%A4.%D0%9C._%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%281866%29_%D0%BE%D0%B1%D0%BB%D0%BE%D0%B6%D0%BA%D0%B0.jpg"
		}
	];

	const favoriteAlbums = [
		{
			title: "Honestly, Nevermind",
			artist: "Drake",
			genre: "House / Dance",
			rating: 4.5,
			favTrack: "Falling Back",
			review: "A surprising house and club-influenced departure for Drake. Muted synth pads, fast syncopated beats, and late-night driving vibes. The production feels very atmospheric.",
			coverColor: "#09090b",
			designType: "nevermind",
			coverUrl: "https://coverartarchive.org/release-group/26d2e1f2-a76e-46ff-a2b5-b4200ac883d5/front-500"
		},
		{
			title: "Freudian",
			artist: "Daniel Caesar",
			genre: "R&B / Soul",
			rating: 5,
			favTrack: "Blessed",
			review: "A modern R&B masterpiece with rich gospel harmonies, warm organ sounds, and smooth vocals. Deeply intimate, warm, and comforting.",
			coverColor: "#e0f2fe",
			designType: "freudian",
			coverUrl: "https://coverartarchive.org/release-group/ba660007-8e88-4301-ba89-5574d06d29cc/front-500"
		},
		{
			title: "Hate That I Love You",
			artist: "Fateh",
			genre: "Punjabi Hip-Hop",
			rating: 4.7,
			favTrack: "Hate That I Love You",
			review: "Fateh's smooth flow meets punchy production. Great fusion of classic Punjabi lyrics with modern trap beats.",
			coverColor: "#ea580c",
			designType: "fateh",
			coverUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/93/06/d7/9306d701-7f13-1f8e-ee61-7b751998d2d3/artwork.jpg/500x500bb.jpg"
		},
		{
			title: "Keychain Lalu",
			artist: "Arpit Bala",
			genre: "Desi Hip-Hop",
			rating: 4.8,
			favTrack: "Champakali",
			review: "Grungy, raw, and full of character. A unique voice in Desi Hip-hop, blending internet humor, raw street poetry, and heavy industrial beats.",
			coverColor: "#7f1d1d",
			designType: "bala",
			coverUrl: "https://c.saavncdn.com/237/Keychain-Laalu-Hindi-2025-20251211032753-500x500.jpg"
		},
		{
			title: "IGOR",
			artist: "Tyler, The Creator",
			genre: "Alternative Hip-Hop",
			rating: 5,
			favTrack: "Earfquake",
			review: "Tyler's creative peak. A brilliant conceptual album about heartbreak and infatuation, built on pitch-shifted vocals, distorted synths, and heavy drums.",
			coverColor: "#f472b6",
			designType: "igor",
			coverUrl: "https://coverartarchive.org/release-group/0f1b9e07-b38b-4bba-9794-55e0924d7177/front-500"
		},
		{
			title: "Moonchild Era",
			artist: "Diljit Dosanjh",
			genre: "Punjabi Pop",
			rating: 4.9,
			favTrack: "Lover",
			review: "Diljit's futuristic pop era. A high-energy pop album driven by retro-synthwave basslines and Diljit's iconic warm vocals. A true repeat-play album.",
			coverColor: "#111827",
			designType: "diljit",
			coverUrl: "https://coverartarchive.org/release-group/9e8d8b83-aedd-460f-bfd7-9837e9f677f0/front-500"
		}
	];

	const favoriteMovies = [
		{
			title: "Zodiac",
			year: 2007,
			director: "David Fincher",
			genre: "Mystery / Thriller",
			rating: 5,
			review: "Fincher's obsessive deep-dive into the Zodiac killer case. Methodical, patient, and deeply unsettling. The basement scene is pure dread.",
			posterColor: "#0c1a2a",
			designType: "zodiac",
			posterUrl: "https://upload.wikimedia.org/wikipedia/en/3/3a/Zodiac2007Poster.jpg"
		},
		{
			title: "The Pianist",
			year: 2002,
			director: "Roman Polanski",
			genre: "Biography / Drama",
			rating: 5,
			review: "Adrien Brody delivers a devastating performance as Wladyslaw Szpilman. The raw survival story stripped of Hollywood sentiment — just a man, a piano, and ruins.",
			posterColor: "#1a1a1a",
			designType: "pianist",
			posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/a6/The_Pianist_movie.jpg"
		},
		{
			title: "Frankenstein",
			year: 1931,
			director: "James Whale",
			genre: "Horror / Sci-Fi",
			rating: 4.5,
			review: "The one that started it all. Boris Karloff's Monster is iconic for a reason — the makeup, the silence, the tragedy. Nearly a century old and still haunting.",
			posterColor: "#1a1a0a",
			designType: "frankenstein",
			posterUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyOKyuVEocQQInpZdbengfqULg4blqDfe3MJpOPz8krWldGwe6aWG9U-FZ&s=10"
		},
		{
			title: "La La Land",
			year: 2016,
			director: "Damien Chazelle",
			genre: "Musical / Romance",
			rating: 4.8,
			review: "A love letter to dreamers and the cost of chasing them. The final montage is a masterpiece — five minutes that say more than most films say in two hours.",
			posterColor: "#1a1040",
			designType: "lalaland",
			posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/ab/La_La_Land_%28film%29.png"
		}
	];

	const favoriteShows = [
		{
			title: "How I Met Your Mother",
			year: "2005–2014",
			director: "Carter Bays & Craig Thomas",
			genre: "Comedy / Sitcom",
			rating: 4.7,
			review: "Rewatched countless times. The yellow umbrella arc is genuinely emotional despite the comedy packaging. Barney's playbook is legendary.",
			posterColor: "#1a2a1a",
			designType: "himym",
			posterUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCES_2N2KLZ3_Z3VYf9iBqB9dS7roWhraftLb4KOrZAg&s=10"
		},
		{
			title: "Chernobyl",
			year: "2019",
			director: "Craig Mazin",
			genre: "Drama / History",
			rating: 5,
			review: "Terrifying and meticulously crafted. The cost of lies has never been visualized this powerfully. Episode 3's 'Open Thine O Lord' sequence is unforgettable.",
			posterColor: "#2a1a0a",
			designType: "chernobyl",
			posterUrl: "https://upload.wikimedia.org/wikipedia/en/a/a7/Chernobyl_2019_Miniseries.jpg"
		},
		{
			title: "13 Reasons Why",
			year: "2017–2020",
			director: "Brian Yorkey",
			genre: "Drama / Mystery",
			rating: 4.3,
			review: "Uncomfortable and necessary. The cassette tape format is genius, and the show doesn't shy away from the ugliness of high school cruelty and mental health.",
			posterColor: "#3a0a0a",
			designType: "13reasons",
			posterUrl: "https://m.media-amazon.com/images/M/MV5BNThjYzQ3ZjYtM2I0ZC00OGNjLTlmNGItYjE3ZWI5MWIyMWYyXkEyXkFqcGc@._V1_QL75_UX190_CR0,0,190,281_.jpg"
		},
		{
			title: "Better Call Saul",
			year: "2015–2022",
			director: "Vince Gilligan & Peter Gould",
			genre: "Drama / Crime",
			rating: 5,
			review: "Bob Odenkirk's transformation from comedic talent to dramatic powerhouse is staggering. In many ways, surpasses Breaking Bad in pure character study.",
			posterColor: "#2a2a0a",
			designType: "bcs",
			posterUrl: "https://m.media-amazon.com/images/M/MV5BMTAxOTQ0MjUzMzJeQTJeQWpwZ15BbWU4MDY0NTAxNzMx._V1_.jpg"
		},
		{
			title: "Sherlock",
			year: "2010–2017",
			director: "Mark Gatiss & Steven Moffat",
			genre: "Crime / Drama",
			rating: 4.6,
			review: "Benedict Cumberbatch IS Holmes. The visual deduction sequences are brilliantly filmed. S2E3 'The Reichenbach Fall' broke me.",
			posterColor: "#0a1a2a",
			designType: "sherlock",
			posterUrl: "https://upload.wikimedia.org/wikipedia/en/4/4d/Sherlock_titlecard.jpg"
		}
	];

	let selectedRackItem = $state<any>(null);

	// Projects Slider
	let activeProjectIndex = $state(0);
	const projects = [
		{ name: 'ShelfLine', desc: 'A sophisticated library shelving management and reading log web ecosystem designed to organize literature databases and community reviews.', tech: 'HTML/CSS • JavaScript • SQL', link: '#', docName: 'ShelfLine_group2_finalreport.pdf' },
		{ name: 'Internship Portal', desc: 'A secure recruitment portal linking students directly with tech mentors, tracking application states and resume iterations.', tech: 'SvelteKit • Node.js • MongoDB', link: '#' },
		{ name: 'Big Boss Voting Zone', desc: 'High-concurrency voting web portal engineered to process live user polls and television contestant nominations securely.', tech: 'React • TailwindCSS • Firebase', link: '#' },
		{ name: 'Bday Wrapped Game', desc: 'An interactive canvas arcade and greeting game designed for mobile browsers, compiling personalized birthday highlights.', tech: 'HTML Canvas • GSAP • Audio Synthesis', link: '#' }
	];

	// Hobbies & Games Tabs
	let activeTab = $state('games');

	// Page load fade-in state
	let isPageLoaded = $state(false);
	let isInitializing = $state(true);

	// Persist currentRoom to localStorage
	$effect(() => {
		localStorage.setItem('currentRoom', currentRoom);
	});

	onMount(() => {
		function initPlayer() {
			// Prevent duplicate instantiation if already present
			if (ytPlayer && typeof ytPlayer.destroy === 'function') {
				try { ytPlayer.destroy(); } catch(e) {}
			}
			isPlayerReady = false;
			ytPlayer = new (window as any).YT.Player('yt-player', {
				height: '200',
				width: '200',
				videoId: tracks[currentTrackIndex].ytId,
				playerVars: {
					playsinline: 1,
					controls: 0,
					disablekb: 1,
					fs: 0,
					rel: 0,
					origin: window.location.origin
				},
				events: {
					onReady: (event: any) => {
						console.log('✅ YT Player initialized and ready!');
						isPlayerReady = true;
						try {
							event.target.setVolume(audioVolume * 100);
							if (autoplayEnabled) {
								console.log('Autoplay request on ready...');
								event.target.playVideo();
							}
						} catch(e) {}
					},
					onStateChange: (event: any) => {
						console.log('🎵 YT Player state changed. Event Code:', event.data);
						// 0 = ended, play next track
						if (event.data === 0) {
							changeTrack('next');
						}
						// 1 = playing, 2 = paused
						if (event.data === 1) {
							isAudioPlaying = true;
							// Re-apply playback rate matching current RPM speed
							let rate = 1.0;
							if (currentRPM === 45) rate = 1.25;
							if (currentRPM === 78) rate = 1.5;
							try {
								event.target.setPlaybackRate(rate);
							} catch(e) {}
						} else if (event.data === 2 || event.data === -1) {
							isAudioPlaying = false;
						}
					}
				}
			});
		}

		// Prevent re-injecting script on hot reload
		if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
			const tag = document.createElement('script');
			tag.src = 'https://www.youtube.com/iframe_api';
			const firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
		}

		// Check if YT script is already loaded (common in HMR hot reloads)
		if ((window as any).YT && (window as any).YT.Player) {
			initPlayer();
		} else {
			(window as any).onYouTubeIframeAPIReady = initPlayer;
		}

		// Keyboard shortcut 'd' to toggle dev mode
		const handleKeyDown = (event: KeyboardEvent) => {
			const activeElem = document.activeElement;
			if (activeElem && (
				activeElem.tagName === 'INPUT' || 
				activeElem.tagName === 'TEXTAREA' || 
				activeElem.tagName === 'SELECT'
			)) {
				return;
			}

			// Don't toggle dev mode if virtual synth is open (since 'd' is mapped to D#4)
			if (activeHotspot && (activeHotspot.label === 'synth' || activeHotspot.type === 'synth')) {
				return;
			}

			if (event.key.toLowerCase() === 'd') {
				devMode = !devMode;
				newHotspot = null;
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		// Fallback timeout to ensure the black screen fades out even if Svelte's image onload doesn't trigger (e.g. from memory cache)
		const fallbackTimeout = setTimeout(() => {
			isPageLoaded = true;
		}, 800);

		// Re-enable sliding transitions after initial page placement is complete
		const initTimeout = setTimeout(() => {
			isInitializing = false;
		}, 100);

		return () => {
			clearTimeout(fallbackTimeout);
			clearTimeout(initTimeout);
			window.removeEventListener('keydown', handleKeyDown);
			if (ytPlayer && typeof ytPlayer.destroy === 'function') {
				ytPlayer.destroy();
			}
		};
	});

	// Save hotspots database to server
	async function persistHotspots(updatedList: Hotspot[]) {
		try {
			const res = await fetch('/api/hotspots', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedList)
			});
			if (!res.ok) throw new Error('Failed to save to server');
		} catch (err) {
			console.error('Error saving hotspots:', err);
		}
	}

	// Audio volume effect
	$effect(() => {
		if (ytPlayer && isPlayerReady && typeof ytPlayer.setVolume === 'function') {
			try { ytPlayer.setVolume(audioVolume * 100); } catch(e) {}
		}
	});

	// Play audio helper
	function togglePlay() {
		console.log('Play triggered. Player ready:', isPlayerReady, 'Playing status:', isAudioPlaying);
		if (!ytPlayer || !isPlayerReady || typeof ytPlayer.playVideo !== 'function') {
			console.warn('Cannot play yet: YT Player is not initialized or ready.');
			return;
		}
		try {
			if (isAudioPlaying) {
				console.log('Pausing song...');
				ytPlayer.pauseVideo();
				isAudioPlaying = false;
			} else {
				console.log('Playing song: ' + tracks[currentTrackIndex].name);
				ytPlayer.playVideo();
				isAudioPlaying = true;
			}
		} catch(e) {
			console.error('Error in togglePlay:', e);
		}
	}

	function changeTrack(direction: 'next' | 'prev') {
		if (direction === 'next') {
			currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
		} else {
			currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
		}
		isAudioPlaying = false;
		console.log('Changing track to: ' + tracks[currentTrackIndex].name);
		if (ytPlayer && isPlayerReady && typeof ytPlayer.loadVideoById === 'function') {
			try {
				ytPlayer.loadVideoById(tracks[currentTrackIndex].ytId);
				ytPlayer.playVideo();
				isAudioPlaying = true;
			} catch(e) {
				console.error('Error in changeTrack:', e);
			}
		} else {
			console.warn('Cannot load track: YT Player is not ready.');
		}
	}



	// Dev Mode click for new hotspot coordinates
	function handleRoomClick(event: MouseEvent) {
		if (!devMode) return;
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const x = parseFloat((((event.clientX - rect.left) / rect.width) * 100).toFixed(1));
		const y = parseFloat((((event.clientY - rect.top) / rect.height) * 100).toFixed(1));

		newHotspot = {
			id: `spot_${Date.now()}`,
			label: 'New Hotspot',
			description: 'Describe what clicking this item displays.',
			x,
			y,
			color: 'purple',
			type: 'general',
			room: currentRoom
		};
	}

	async function saveNewHotspot() {
		if (newHotspot && newHotspot.label && newHotspot.x && newHotspot.y) {
			const updated = [...hotspots, newHotspot as Hotspot];
			hotspots = updated;
			await persistHotspots(updated);
			newHotspot = null;
		}
	}

	async function deleteHotspot(id: string) {
		const updated = hotspots.filter(h => h.id !== id);
		hotspots = updated;
		await persistHotspots(updated);
		if (selectedHotspotId === id) selectedHotspotId = null;
	}



	// Draggable Dev Panel State
	let devPanelX = $state(20);
	let devPanelY = $state(100);
	let isDraggingPanel = $state(false);
	let panelDragStartX = $state(0);
	let panelDragStartY = $state(0);

	function handlePanelHeaderMouseDown(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.closest('input') || target.closest('select') || target.closest('textarea') || target.closest('button')) return;
		if (event.button !== 0) return;
		
		isDraggingPanel = true;
		panelDragStartX = event.clientX - devPanelX;
		panelDragStartY = event.clientY - devPanelY;
		
		window.addEventListener('mousemove', handlePanelHeaderMouseMove);
		window.addEventListener('mouseup', handlePanelHeaderMouseUp);
	}

	function handlePanelHeaderMouseMove(event: MouseEvent) {
		if (!isDraggingPanel) return;
		devPanelX = event.clientX - panelDragStartX;
		devPanelY = event.clientY - panelDragStartY;
	}

	function handlePanelHeaderMouseUp() {
		isDraggingPanel = false;
		window.removeEventListener('mousemove', handlePanelHeaderMouseMove);
		window.removeEventListener('mouseup', handlePanelHeaderMouseUp);
	}
</script>

<!-- Hidden YouTube Player container for background streaming -->
<div id="yt-player-container" style="position: fixed; bottom: 0; right: 0; width: 1px; height: 1px; z-index: -9999; opacity: 0.02; pointer-events: none; overflow: hidden;">
	<div id="yt-player"></div>
</div>

<!-- Custom Minimal Audio Controller (Shown only when playing and turntable UI is closed) -->
{#if isAudioPlaying && !(activeHotspot && activeHotspot.type === 'vinyl_player')}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div 
		class="mini-audio-controller is-playing"
		transition:fly={{ y: 12, duration: 250 }}
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Minimal Horizontal Line Visualizer -->
		<div class="mini-audio-visualizer">
			<div class="bar bar-1"></div>
			<div class="bar bar-2"></div>
			<div class="bar bar-3"></div>
			<div class="bar bar-4"></div>
			<div class="bar bar-5"></div>
			<div class="bar bar-6"></div>
			<div class="bar bar-7"></div>
			<div class="bar bar-8"></div>
			<div class="bar bar-9"></div>
			<div class="bar bar-10"></div>
			<div class="bar bar-11"></div>
			<div class="bar bar-12"></div>
		</div>

		<div class="mini-audio-track">{tracks[currentTrackIndex].name}</div>
		<div class="mini-audio-actions">
			<button class="mini-action-btn" onclick={() => changeTrack('prev')}>prev</button>
			<span class="mini-action-sep">/</span>
			<button class="mini-action-btn action-pop" onclick={togglePlay}>pause</button>
			<span class="mini-action-sep">/</span>
			<button class="mini-action-btn" onclick={() => changeTrack('next')}>next</button>
			<span class="mini-action-sep">/</span>
			<button
				class="mini-action-btn autoplay-toggle {autoplayEnabled ? 'autoplay-on' : 'autoplay-off'}"
				onclick={() => {
					autoplayEnabled = !autoplayEnabled;
					localStorage.setItem('autoplayEnabled', String(autoplayEnabled));
				}}
				title={autoplayEnabled ? 'Autoplay on — click to disable' : 'Autoplay off — click to enable'}
			>
				<span class="autoplay-indicator"></span>auto
			</button>
		</div>
	</div>
{/if}

<!-- CINEMATIC PAGE LOAD OVERLAY -->
<div class="page-load-overlay {isPageLoaded ? 'loaded' : ''}"></div>

<!-- MAIN VIEWPORT -->
<main 
	class="main-viewport"
	onclick={() => { activeHotspot = null; }}
>
	<!-- Minimal permanent header at top left -->
	<h1 class="minimal-header-title">
		sehaz.space
	</h1>
	<!-- HUD TOP BAR (ONLY VISIBLE IN DEV MODE) -->
	{#if devMode}
		<div class="hud-top-bar glass">
			<div class="hud-title">
				<span class="pulse-indicator"></span>
				<h1>SEHAZ'S SPACE • CONFIGURATOR</h1>
			</div>
			<div class="hud-controls">
				<button class="hud-btn active-btn" onclick={() => { devMode = false; newHotspot = null; }}>
					EXIT DEV MODE
				</button>
			</div>
		</div>
	{/if}

	<!-- ISOMETRIC SCENE AREA -->
	<div class="scene-container">
		<div class="parallax-box">
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div 
				class="room-wrapper room-{currentRoom}"
				onclick={handleRoomClick}
				style="cursor: {devMode ? 'crosshair' : 'default'}"
			>
				<div class="room-images-container">
					<div class="room-sliding-track {isInitializing ? 'no-transition' : ''}" style="transform: translateX({currentRoom === 'bedroom' ? '0%' : '-50%'});">
						<!-- Bedroom Pane -->
						<div class="room-viewport-pane">
							<!-- Bedroom Day -->
							<enhanced:img
								src={bedroomDay}
								alt="Isometric Bedroom Day"
								class="bedroom-image day-image"
								style="opacity: {!isNightMode ? 1 : 0};"
								draggable="false"
								fetchpriority="high"
								sizes="100vw"
								onload={() => { isPageLoaded = true; }}
							/>
							<!-- Bedroom Night -->
							<enhanced:img
								src={bedroomNight}
								alt="Isometric Bedroom Night"
								class="bedroom-image night-image"
								style="opacity: {isNightMode ? 1 : 0};"
								draggable="false"
								loading="lazy"
								sizes="100vw"
							/>

							<!-- INTERACTIVE HOTSPOTS OVERLAY - BEDROOM -->
							{#if currentRoom === 'bedroom'}
								<div class="hotspots-group" in:fade={{ delay: 1250, duration: 450 }} out:fade={{ duration: 0 }}>
									{#each hotspots.filter(h => (h.room || 'bedroom') === 'bedroom') as spot}
										{#if spot.type === 'room_switch'}
											<button
												class="hotspot-door-switch {spot.x > 50 ? 'anchor-right' : 'anchor-left'}"
												style="left: {spot.x}%; top: {spot.y}%;"
												onclick={(e) => {
													e.stopPropagation();
													currentRoom = currentRoom === 'bedroom' ? 'living_room' : 'bedroom';
													activeHotspot = null;
												}}
											>
												<div class="door-switch-circle">
													<svg class="door-arrow-icon" viewBox="0 0 24 24">
														<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
													</svg>
												</div>
												<span class="door-switch-text">
													Enter Living Room
												</span>
											</button>
										{:else}
											<button
												class="hotspot-dot"
												style="left: {spot.x}%; top: {spot.y}%;"
												onclick={(e) => {
													e.stopPropagation();
													handleHotspotClick(spot);
												}}
												title={spot.label}
											></button>
										{/if}

										{#if spot.type === 'vinyl_player' && isAudioPlaying}
											<div class="music-notes-emitter" style="left: {spot.x}%; top: {spot.y}%;">
												<span class="note note-1">♪</span>
												<span class="note note-2">♫</span>
												<span class="note note-3">♩</span>
												<span class="note note-4">♬</span>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- Dev click placement dot for Bedroom -->
							{#if devMode && newHotspot && newHotspot.room === 'bedroom'}
								<div 
									class="temp-dot"
									style="left: {newHotspot.x}%; top: {newHotspot.y}%;"
								></div>
							{/if}
						</div>

						<!-- Living Room Pane -->
						<div class="room-viewport-pane">
							<!-- Living Room Day -->
							<enhanced:img
								src={livingRoomDay}
								alt="Isometric Living Room Day"
								class="bedroom-image day-image"
								style="opacity: {!isNightMode ? 1 : 0};"
								draggable="false"
								loading="lazy"
								sizes="100vw"
							/>
							<!-- Living Room Night -->
							<enhanced:img
								src={livingRoomNight}
								alt="Isometric Living Room Night"
								class="bedroom-image night-image"
								style="opacity: {isNightMode ? 1 : 0};"
								draggable="false"
								loading="lazy"
								sizes="100vw"
							/>

							<!-- INTERACTIVE HOTSPOTS OVERLAY - LIVING ROOM -->
							{#if currentRoom === 'living_room'}
								<div class="hotspots-group" in:fade={{ delay: 1250, duration: 450 }} out:fade={{ duration: 0 }}>
									{#each hotspots.filter(h => h.room === 'living_room') as spot}
										{#if spot.type === 'room_switch'}
											<button
												class="hotspot-door-switch {spot.x > 50 ? 'anchor-right' : 'anchor-left'}"
												style="left: {spot.x}%; top: {spot.y}%;"
												onclick={(e) => {
													e.stopPropagation();
													currentRoom = currentRoom === 'bedroom' ? 'living_room' : 'bedroom';
													activeHotspot = null;
												}}
											>
												<div class="door-switch-circle">
													<svg class="door-arrow-icon" viewBox="0 0 24 24">
														<path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
													</svg>
												</div>
												<span class="door-switch-text">
													Enter Bedroom
												</span>
											</button>
										{:else}
											<button
												class="hotspot-dot"
												style="left: {spot.x}%; top: {spot.y}%;"
												onclick={(e) => {
													e.stopPropagation();
													handleHotspotClick(spot);
												}}
												title={spot.label}
											></button>
										{/if}

										{#if spot.type === 'vinyl_player' && isAudioPlaying}
											<div class="music-notes-emitter" style="left: {spot.x}%; top: {spot.y}%;">
												<span class="note note-1">♪</span>
												<span class="note note-2">♫</span>
												<span class="note note-3">♩</span>
												<span class="note note-4">♬</span>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- Dev click placement dot for Living Room -->
							{#if devMode && newHotspot && newHotspot.room === 'living_room'}
								<div 
									class="temp-dot"
									style="left: {newHotspot.x}%; top: {newHotspot.y}%;"
								></div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>





	<!-- ==================== DEV MODE CONFIGURATION PANEL ==================== -->
	{#if devMode}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="dev-panel glass"
			style="left: {devPanelX}px; top: {devPanelY}px; max-height: 82vh;"
		>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div 
				class="dev-header" 
				onmousedown={handlePanelHeaderMouseDown}
				style="cursor: move; user-select: none;"
			>
				<h3>🛠️ Hotspot Configurator</h3>
				<p>Drag header to move. Click on room to place.</p>
			</div>

			{#if newHotspot}
				<div class="dev-form">
					<h4>New Hotspot ({newHotspot.x}%, {newHotspot.y}%)</h4>
					<label>
						Label / Title:
						<input type="text" bind:value={newHotspot.label} />
					</label>
					<label>
						Interaction Type:
						<select bind:value={newHotspot.type}>
							<option value="general">General Details (Popup Card)</option>
							<option value="computer_desk">Computer Desk (CRT Terminal)</option>
							<option value="vinyl_player">Vinyl Player (Audio Deck)</option>
							<option value="bed_chill">Bed (Chill Corner Tabs)</option>
							<option value="wardrobe">Wardrobe (Projects Carousel)</option>
							<option value="light_switch">Light Switch (Day/Night Toggle)</option>
							<option value="room_switch">Room Switch (Door Transition)</option>
							<option value="rack">Rack (Movies & Shows)</option>
						</select>
					</label>
					<label>
						Target Room:
						<select bind:value={newHotspot.room}>
							<option value="bedroom">Bedroom</option>
							<option value="living_room">Living Room</option>
						</select>
					</label>
					<label>
						Description text:
						<textarea bind:value={newHotspot.description}></textarea>
					</label>
					<div class="dev-buttons">
						<button class="dev-btn-save" onclick={saveNewHotspot}>Save Hotspot</button>
						<button class="dev-btn-cancel" onclick={() => newHotspot = null}>Cancel</button>
					</div>
				</div>
			{/if}

			<div class="hotspots-list">
				<h4>Room Hotspots ({hotspots.length})</h4>
				{#if hotspots.length === 0}
					<p class="empty-list">No hotspots in room. Click on the image to add one.</p>
				{:else}
					<ul>
						{#each hotspots as h}
							<li class="hotspot-item {selectedHotspotId === h.id ? 'selected' : ''}">
								<div class="hotspot-item-details">
									<strong>{h.label}</strong>
									<span>x: {h.x}% | y: {h.y}% | {h.type} | {h.room || 'bedroom'}</span>
								</div>
								<button class="del-btn" onclick={() => deleteHotspot(h.id)} title="Delete Hotspot">❌</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="json-output">
				<h4>JSON Source (Saved in hotspots.json)</h4>
				<textarea readonly value={JSON.stringify(hotspots, null, 2)} onclick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}></textarea>
				<span class="click-to-copy">Click box to copy JSON</span>
			</div>
		</div>
	{/if}

	<!-- ==================== USER INTERACTIVE OVERLAYS ==================== -->
	{#if activeHotspot}
		{#key activeHotspot.id}
			{#if (activeHotspot.type === 'general' || activeHotspot.type === 'bed_chill' || activeHotspot.type === 'computer_desk') && activeHotspot.label !== 'synth' && activeHotspot.label !== 'chess' && activeHotspot.label !== 'bookshelf' && activeHotspot.label !== 'books 1' && activeHotspot.type !== 'rack'}
				<!-- MINIMAL TEXT POPUP NEAR THE HOTSPOT -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div 
					class="minimal-tooltip {activeHotspot.x > 90 ? 'edge-right' : activeHotspot.x < 10 ? 'edge-left' : ''}"
					style="left: {activeHotspot.x}%; top: {activeHotspot.y}%;"
					transition:fly|global={{ y: 8, duration: 200 }}
					onclick={(e) => e.stopPropagation()}
				>
					<p class="tooltip-text">{activeHotspot.description}</p>
					{#if activeHotspot.id === 'spot_1783883732878' /* journal link */}
						<a href="https://sehaz.substack.com" target="_blank" class="tooltip-link-btn">Open Substack &rarr;</a>
					{:else if activeHotspot.type === 'computer_desk'}
						<a href="https://desk.sehaz.space" target="_blank" class="tooltip-link-btn">Enter space &rarr;</a>
					{/if}
				</div>
			{:else if activeHotspot.type === 'vinyl_player'}
				<!-- CUSTOM PREMIUM RETRO TURNTABLE DECK MODAL -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="turntable-modal-overlay" onclick={() => activeHotspot = null}>
					<div class="turntable-modal-content glass" onclick={(e) => e.stopPropagation()}>
						<button class="turntable-close-btn" onclick={() => activeHotspot = null}>&times;</button>
						<div class="turntable-deck-layout">
							<!-- Left Column: Spinning Platter -->
							<div class="turntable-deck-left">
								<div class="deck-board">
									<div class="deck-strobe"></div>
									<div 
										class="vinyl-record-container" 
										onclick={togglePlay}
										style="cursor: pointer;"
										title={isAudioPlaying ? "Click record to pause" : "Click record to play"}
									>
										<!-- Platter disc -->
										<div 
											class="vinyl-record {isAudioPlaying ? 'record-rotating' : ''}"
											style="animation-duration: {currentRPM === 33 ? '5s' : currentRPM === 45 ? '3.5s' : '2s'}"
										>
											<div class="vinyl-lines"></div>
											<div class="vinyl-center-label">
												<div class="center-star">⭐</div>
												<div class="vinyl-spindle-hole"></div>
											</div>
										</div>
										<!-- Mechanical tonearm -->
										<div class="turntable-tonearm {isAudioPlaying ? 'tonearm-active' : ''}">
											<div class="tonearm-pivot"></div>
											<div class="tonearm-rod"></div>
											<div class="tonearm-cartridge">
												<div class="tonearm-needle-tip"></div>
											</div>
										</div>
									</div>
									<div class="deck-labels">
										<span class="deck-brand">SEHAZ-DECK 1200</span>
										<span class="deck-rpm-indicator">{currentRPM} rpm</span>
									</div>
								</div>
							</div>

							<!-- Right Column: Minimalist Audio Catalog Controls -->
							<div class="turntable-deck-right">
								<div class="turntable-playing-info">
									<span class="now-spinning-label">{isAudioPlaying ? 'Now Spinning' : 'Platter Idle'}</span>
									<h2 class="track-title-heading">{tracks[currentTrackIndex].name}</h2>
								</div>

								<!-- Speed Platter RPM Selector -->
								<div class="rpm-selector-group">
									<button class="rpm-label-btn {currentRPM === 33 ? 'active' : ''}" onclick={() => setRPM(33)}>33</button>
									<span class="rpm-sep">/</span>
									<button class="rpm-label-btn {currentRPM === 45 ? 'active' : ''}" onclick={() => setRPM(45)}>45</button>
									<span class="rpm-sep">/</span>
									<button class="rpm-label-btn {currentRPM === 78 ? 'active' : ''}" onclick={() => setRPM(78)}>78</button>
								</div>

								<!-- Typographic Playlist Selection -->
								<div class="turntable-tracks-list">
									<ul>
										{#each tracks as track, idx}
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
											<li 
												class="track-list-item {currentTrackIndex === idx ? 'track-active' : ''}" 
												onclick={() => { 
													currentTrackIndex = idx; 
													isAudioPlaying = false; 
													if (ytPlayer && isPlayerReady && typeof ytPlayer.loadVideoById === 'function') {
														try {
															ytPlayer.loadVideoById(track.ytId);
															ytPlayer.playVideo();
															isAudioPlaying = true;
														} catch(e) {
															console.error(e);
														}
													}
												}}
											>
												<span class="track-num">0{idx + 1}</span>
												<span class="track-title-text">{track.name}</span>
											</li>
										{/each}
									</ul>
								</div>

								<!-- Linear Volume Fader -->
								<div class="volume-fader-container">
									<span class="fader-label">Fader</span>
									<div class="fader-track-wrapper">
										<input 
											type="range" 
											min="0" 
											max="1" 
											step="0.05" 
											bind:value={audioVolume} 
											class="volume-fader-input"
										/>
									</div>
								</div>

								<!-- Action text links Playback Controls -->
								<div class="playback-controls-group">
									<button class="playback-text-btn" onclick={() => changeTrack('prev')}>prev</button>
									<span class="playback-sep">/</span>
									<button class="playback-text-btn action-play-toggle {isAudioPlaying ? 'playing' : ''}" onclick={togglePlay}>
										{isAudioPlaying ? 'pause' : 'play'}
									</button>
									<span class="playback-sep">/</span>
									<button class="playback-text-btn" onclick={() => changeTrack('next')}>next</button>
								</div>
								<!-- Autoplay toggle -->
								<button
									class="autoplay-toggle-btn {autoplayEnabled ? 'autoplay-on' : 'autoplay-off'}"
									onclick={() => {
										autoplayEnabled = !autoplayEnabled;
										localStorage.setItem('autoplayEnabled', String(autoplayEnabled));
									}}
									title={autoplayEnabled ? 'Autoplay is on — click to disable' : 'Autoplay is off — click to enable'}
								>
									<span class="autoplay-dot"></span>
									Autoplay {autoplayEnabled ? 'on' : 'off'}
								</button>
							</div>
						</div>
					</div>
				</div>
			{:else if activeHotspot.label === 'synth' || activeHotspot.type === 'synth'}
				<!-- CUSTOM PREMIUM RETRO SYNTHESIZER DECK MODAL -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="synth-modal-overlay" onclick={() => activeHotspot = null}>
					<div class="synth-modal-content glass" onclick={(e) => e.stopPropagation()}>
						<button class="synth-close-btn" onclick={() => activeHotspot = null}>&times;</button>
						
						<div class="synth-housing">
							<!-- Left wood trim cheek -->
							<div class="wood-cheek cheek-left"></div>
							
							<!-- Main synthesizer body -->
							<div class="synth-faceplate">
								<!-- Logo & Header bar -->
								<div class="synth-header-panel">
									<div class="synth-brand-logo">SEHAZ // SYNTH-8</div>
									<div class="synth-modes-indicator">POLYPHONIC ANALOG SYSTEM</div>
								</div>

								<!-- Controls Dashboard -->
								<div class="synth-dashboard">
									<!-- Waveform selector block -->
									<div class="control-block osc-block">
										<span class="block-label">OSCILLATOR</span>
										<div class="wave-buttons-grid">
											<button class="wave-btn {synthOscType === 'sawtooth' ? 'active' : ''}" onclick={() => synthOscType = 'sawtooth'}>SAW</button>
											<button class="wave-btn {synthOscType === 'square' ? 'active' : ''}" onclick={() => synthOscType = 'square'}>SQR</button>
											<button class="wave-btn {synthOscType === 'triangle' ? 'active' : ''}" onclick={() => synthOscType = 'triangle'}>TRI</button>
											<button class="wave-btn {synthOscType === 'sine' ? 'active' : ''}" onclick={() => synthOscType = 'sine'}>SIN</button>
										</div>
									</div>

									<!-- Filter block -->
									<div class="control-block filter-block">
										<span class="block-label">FILTER</span>
										<div class="knobs-row">
											<div class="knob-container">
												<span class="knob-label">CUTOFF</span>
												<div class="fader-track-vertical">
													<input type="range" min="100" max="4500" step="50" bind:value={synthCutoff} class="synth-slider-vertical" />
												</div>
												<span class="knob-value">{synthCutoff}Hz</span>
											</div>
											<div class="knob-container">
												<span class="knob-label">RES</span>
												<div class="fader-track-vertical">
													<input type="range" min="0.5" max="15" step="0.5" bind:value={synthRes} class="synth-slider-vertical" />
												</div>
												<span class="knob-value">{synthRes}</span>
											</div>
										</div>
									</div>

									<!-- ADSR envelope faders -->
									<div class="control-block adsr-block">
										<span class="block-label">ENVELOPE</span>
										<div class="faders-row">
											<div class="fader-container">
												<span class="fader-label">ATTACK</span>
												<div class="fader-track-vertical">
													<input type="range" min="0.01" max="1.0" step="0.05" bind:value={synthAttack} class="synth-slider-vertical" />
												</div>
												<span class="fader-value">{synthAttack}s</span>
											</div>
											<div class="fader-container">
												<span class="fader-label">RELEASE</span>
												<div class="fader-track-vertical">
													<input type="range" min="0.05" max="2.0" step="0.05" bind:value={synthRelease} class="synth-slider-vertical" />
												</div>
												<span class="fader-value">{synthRelease}s</span>
											</div>
										</div>
									</div>

									<!-- Vector scope oscilloscope screen -->
									<div class="control-block scope-block">
										<span class="block-label">OSCILLOSCOPE</span>
										<div class="scope-screen-housing">
											<canvas id="oscilloscope-canvas" width="200" height="96"></canvas>
										</div>
									</div>
								</div>

								<!-- Synthesizer keyboard bed -->
								<div class="synth-keyboard-container">
									<div class="synth-keyboard-bed">
										<!-- 15 White keys -->
										{#each synthKeys.filter(k => !k.isBlack) as key, idx}
											<button
												class="white-key {activeNoteKeys[key.note] ? 'active' : ''}"
												style="left: {idx * 6.66}%; width: 6.46%;"
												onmousedown={() => startNote(key.note, key.freq)}
												onmouseup={() => stopNote(key.note)}
												onmouseleave={() => stopNote(key.note)}
											>
												<span class="key-note-label">{key.chars[0]}</span>
											</button>
										{/each}

										<!-- 10 Overlaid black keys -->
										{#each synthKeys.filter(k => k.isBlack) as key}
											<button
												class="black-key {activeNoteKeys[key.note] ? 'active' : ''}"
												style="left: {blackKeyOffsets[key.note]}%; width: 4.2%;"
												onmousedown={() => startNote(key.note, key.freq)}
												onmouseup={() => stopNote(key.note)}
												onmouseleave={() => stopNote(key.note)}
											>
												<span class="key-note-label-black">{key.chars[key.chars.length - 1]}</span>
											</button>
										{/each}
									</div>
								</div>
							</div>

							<!-- Right wood trim cheek -->
							<div class="wood-cheek cheek-right"></div>
						</div>
					</div>
				</div>
			{:else if activeHotspot.type === 'chess' || activeHotspot.label === 'chess'}
				<!-- CUSTOM CHESS STATS & PLAYABLE LOFI PUZZLE MODAL -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="chess-modal-overlay" onclick={() => activeHotspot = null}>
					<div class="chess-modal-content glass" onclick={(e) => e.stopPropagation()}>
						<button class="chess-close-btn" onclick={() => activeHotspot = null}>&times;</button>
						
						<div class="chess-layout">
							<!-- Left Column: Chess.com Live Card -->
							<div class="chess-sidebar">
								<div class="chess-header-area">
									<div class="chess-tag">CHESS.COM PROFILE</div>
									<h2>Sehazzzzz</h2>
								</div>
								
								{#if chessLoading}
									<div class="chess-loading-state">
										<div class="spinner"></div>
										<p>Fetching Chess.com stats...</p>
									</div>
								{:else if chessError || !chessProfile}
									<div class="chess-error-state">
										<p>Stats temporarily offline</p>
										<a href="https://www.chess.com/member/Sehazzzzz" target="_blank" class="chess-action-btn">Visit Profile &rarr;</a>
									</div>
								{:else}
									<div class="chess-profile-card">
										{#if chessProfile.avatar}
											<div class="chess-avatar-wrapper">
												<img src={chessProfile.avatar} alt="Chess.com Avatar" class="chess-avatar" />
											</div>
										{/if}
										
										<div class="chess-stats-grid">
											<div class="stat-box">
												<span class="stat-title">Rapid</span>
												<span class="stat-value">{chessStats?.chess_rapid?.last?.rating || 'N/A'}</span>
											</div>
											<div class="stat-box">
												<span class="stat-title">Blitz</span>
												<span class="stat-value">{chessStats?.chess_blitz?.last?.rating || 'N/A'}</span>
											</div>
											<div class="stat-box">
												<span class="stat-title">Bullet</span>
												<span class="stat-value">{chessStats?.chess_bullet?.last?.rating || 'N/A'}</span>
											</div>
											<div class="stat-box">
												<span class="stat-title">Puzzles</span>
												<span class="stat-value">{chessStats?.tactics?.highest?.rating || 'N/A'}</span>
											</div>
										</div>
										
										<a href="https://www.chess.com/member/Sehazzzzz" target="_blank" class="chess-action-btn">Challenge Me &rarr;</a>
									</div>
								{/if}
							</div>
							
							<!-- Right Column: Playable Lofi Chess Board -->
							<div class="chess-board-area">
								<div class="board-header">
									<span class="puzzle-title">DAILY COZY PUZZLE</span>
									<span class="puzzle-task">White to Move — Mate in 1</span>
								</div>
								
								<!-- The 8x8 Chess Grid -->
								<div class="board-grid-wrapper">
									<div class="chessboard-grid">
										{#each chessBoard as row, rIdx}
											{#each row as piece, cIdx}
												{@const isDarkSquare = (rIdx + cIdx) % 2 === 1}
												{@const isSelected = selectedCell?.row === rIdx && selectedCell?.col === cIdx}
												<!-- svelte-ignore a11y_click_events_have_key_events -->
												<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
												<div
													class="chess-square {isDarkSquare ? 'dark-square' : 'light-square'} {isSelected ? 'selected-square' : ''}"
													onclick={() => handleCellClick(rIdx, cIdx)}
												>
													{#if piece}
														<span class="chess-piece-symbol {piece.startsWith('w') ? 'white-piece' : 'black-piece'}">
															{pieceSymbols[piece]}
														</span>
													{/if}
												</div>
											{/each}
										{/each}
									</div>
								</div>
								
								<!-- Board status feedback -->
								<div class="board-footer-feedback">
									{#if puzzleStatus === 'solved'}
										<span class="feedback-msg success-msg">Smothered Mate! Puzzle Solved! 🎉</span>
										<button class="retry-btn" onclick={resetChessPuzzle}>Play Again</button>
									{:else if puzzleStatus === 'wrong'}
										<span class="feedback-msg error-msg">Not the best move. Try again! ❌</span>
									{:else}
										<span class="feedback-msg helper-msg">Select White Knight (♘) to deliver checkmate.</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>
			{:else if activeHotspot.type === 'bookshelf' || activeHotspot.label === 'bookshelf' || activeHotspot.label === 'books 1'}
				<!-- IMMERSIVE PHYSICAL BOOKCASE MODAL -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="bookshelf-modal-overlay" onclick={() => activeHotspot = null}>
					<div class="bookshelf-modal-content" onclick={(e) => e.stopPropagation()}>
						<button class="bookshelf-close-btn" onclick={() => activeHotspot = null}>&times;</button>
						
						<!-- The Wood Bookcase Furniture Frame -->
						<div class="bookshelf-furniture-frame">
							<div class="bookshelf-side-pillar pillar-left"></div>
							
							<div class="bookshelf-shelves-container">
								<!-- Top Shelf: Albums -->
								<div class="shelf-tier">
									<div class="shelf-header-tag">FAVORITE ALBUMS</div>
									<div class="shelf-row-albums">
										{#each favoriteAlbums as album}
											<button 
												class="shelf-album-sleeve {selectedBookshelfItem?.title === album.title ? 'active-sleeve' : ''}"
												style="background-color: {album.coverColor};"
												onclick={() => selectedBookshelfItem = album}
											>
												<div class="album-cover-design design-{album.designType}">
													{#if album.designType === 'nevermind'}
														<div class="nevermind-waves"></div>
														<span class="album-title-short">Honestly, Nevermind</span>
													{:else if album.designType === 'freudian'}
														<div class="sky-gradient">
															<div class="sky-monument"></div>
														</div>
														<span class="album-title-short">Freudian</span>
													{:else if album.designType === 'fateh'}
														<div class="fateh-grid"></div>
														<span class="album-title-short">Fateh</span>
													{:else if album.designType === 'bala'}
														<div class="keychain-art"></div>
														<span class="album-title-short">Keychain Lalu</span>
													{:else if album.designType === 'igor'}
														<div class="igor-pink-bg">
															<div class="igor-face-shadow"></div>
														</div>
														<span class="album-title-short">IGOR</span>
													{:else if album.designType === 'diljit'}
														<div class="moonchild-gold"></div>
														<span class="album-title-short">Moonchild</span>
													{/if}
												</div>
												{#if album.coverUrl}
													<img src={album.coverUrl} alt={album.title} class="shelf-item-image" loading="lazy" />
												{/if}
											</button>
										{/each}
									</div>
									<div class="shelf-wood-plank"></div>
								</div>

								<!-- Bottom Shelf: Books -->
								<div class="shelf-tier" style="margin-top: 40px;">
									<div class="shelf-header-tag">FAVORITE BOOKS</div>
									<div class="shelf-row-books">
										{#each favoriteBooks as book}
											<button 
												class="shelf-book-cover {selectedBookshelfItem?.title === book.title ? 'active-cover' : ''}"
												style="background-color: {book.coverColor};"
												onclick={() => selectedBookshelfItem = book}
											>
												<div class="book-cover-design design-{book.designType}">
													{#if book.designType === 'suns'}
														<div class="sunburst"></div>
														<span class="book-title-short">Splendid Suns</span>
													{:else if book.designType === 'bug'}
														<div class="bug-silhouette"></div>
														<span class="book-title-short">Metamorphosis</span>
													{:else if book.designType === 'disquiet'}
														<div class="ink-cloud"></div>
														<span class="book-title-short">Disquiet</span>
													{:else if book.designType === 'train'}
														<div class="train-silhouette"></div>
														<span class="book-title-short">Train to Pakistan</span>
													{:else if book.designType === 'underground'}
														<div class="underground-cracks"></div>
														<span class="book-title-short">Underground</span>
													{/if}
												</div>
												{#if book.coverUrl}
													<img src={book.coverUrl} alt={book.title} class="shelf-item-image" loading="lazy" />
												{/if}
											</button>
										{/each}
									</div>
									<div class="shelf-wood-plank"></div>
								</div>
							</div>

							<div class="bookshelf-side-pillar pillar-right"></div>
						</div>

						<!-- IMMERSIVE FOCUSED ITEM OVERLAY CARD -->
						{#if selectedBookshelfItem}
							<div class="focused-item-backdrop" onclick={() => selectedBookshelfItem = null} transition:fade={{ duration: 150 }}>
								<div class="focused-item-card glass" onclick={(e) => e.stopPropagation()}>
									<button class="focused-card-close" onclick={() => selectedBookshelfItem = null}>&times;</button>
									
									<div class="focused-card-layout">
										<!-- Left: Large Art Cover Mockup -->
										<div class="focused-cover-container">
											<div class="focused-cover-mock design-{selectedBookshelfItem.designType}" style="background-color: {selectedBookshelfItem.coverColor};">
												{#if selectedBookshelfItem.designType === 'suns'}
													<div class="sunburst"></div>
												{:else if selectedBookshelfItem.designType === 'bug'}
													<div class="bug-silhouette"></div>
												{:else if selectedBookshelfItem.designType === 'disquiet'}
													<div class="ink-cloud"></div>
												{:else if selectedBookshelfItem.designType === 'train'}
													<div class="train-silhouette"></div>
												{:else if selectedBookshelfItem.designType === 'underground'}
													<div class="underground-cracks"></div>
												{:else if selectedBookshelfItem.designType === 'nevermind'}
													<div class="nevermind-waves"></div>
												{:else if selectedBookshelfItem.designType === 'freudian'}
													<div class="sky-gradient"><div class="sky-monument"></div></div>
												{:else if selectedBookshelfItem.designType === 'fateh'}
													<div class="fateh-grid"></div>
												{:else if selectedBookshelfItem.designType === 'bala'}
													<div class="keychain-art"></div>
												{:else if selectedBookshelfItem.designType === 'igor'}
													<div class="igor-pink-bg"><div class="igor-face-shadow"></div></div>
												{:else if selectedBookshelfItem.designType === 'diljit'}
													<div class="moonchild-gold"></div>
												{/if}
												{#if selectedBookshelfItem.coverUrl}
													<img src={selectedBookshelfItem.coverUrl} alt={selectedBookshelfItem.title} class="focused-item-image" loading="lazy" />
												{/if}
											</div>
										</div>

										<!-- Right: Review details with plenty of space -->
										<div class="focused-details-container">
											<span class="focused-meta-tag">{selectedBookshelfItem.category || selectedBookshelfItem.genre}</span>
											<h2 class="focused-title">{selectedBookshelfItem.title}</h2>
											<p class="focused-author">By {selectedBookshelfItem.author || selectedBookshelfItem.artist}</p>
											
											<div class="focused-star-rating">
												{#each Array(5) as _, i}
													<span class="focused-star">{i < Math.floor(selectedBookshelfItem.rating) ? '★' : '☆'}</span>
												{/each}
												<span class="focused-rating-num">({selectedBookshelfItem.rating}/5)</span>
											</div>

											{#if selectedBookshelfItem.favTrack}
												<div class="focused-track-badge">
													<strong>FAVORITE TRACK:</strong> "{selectedBookshelfItem.favTrack}"
												</div>
											{/if}

											<blockquote class="focused-personal-review">
												"{selectedBookshelfItem.review}"
											</blockquote>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
			</div>
		{:else if activeHotspot.type === 'rack' || (activeHotspot.type === 'general' && activeHotspot.label === 'rack')}
			<!-- MEDIA RACK MODAL -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="rack-modal-overlay" onclick={() => activeHotspot = null}>
				<div class="rack-modal-content" onclick={(e) => e.stopPropagation()}>
					<button class="rack-close-btn" onclick={() => activeHotspot = null}>&times;</button>

					<!-- Rack Header -->
					<div class="rack-header">
						<div class="rack-title-group">
							<h2 class="rack-title">THE RACK</h2>
							<p class="rack-subtitle">Movies & Shows</p>
						</div>
						<a href="https://letterboxd.com/sehazzzzz/" target="_blank" rel="noopener noreferrer" class="letterboxd-link">
							<span class="lbx-icon">
								<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-2-6l4-4-4-4v8z"/></svg>
							</span>
							Letterboxd
						</a>
					</div>

					<!-- Rack Body -->
					<div class="rack-body">
						<!-- Movies Section -->
						<div class="rack-tier">
							<div class="rack-tier-label">FAVORITE FILMS</div>
							<div class="rack-items-row">
								{#each favoriteMovies as movie}
									<button
										class="rack-media-card {selectedRackItem?.title === movie.title ? 'rack-card-active' : ''}"
										onclick={() => selectedRackItem = movie}
									>
										<div class="rack-poster-slot" style="background-color: {movie.posterColor};">
											<div class="rack-poster-art art-{movie.designType}"></div>
											{#if movie.posterUrl}
												<img src={movie.posterUrl} alt={movie.title} class="rack-poster-img" loading="lazy" />
											{/if}
											<div class="rack-poster-sheen"></div>
										</div>
										<div class="rack-card-spine"></div>
									</button>
								{/each}
							</div>
							<div class="rack-shelf-plank"></div>
						</div>

						<!-- Shows Section -->
						<div class="rack-tier" style="margin-top: 36px;">
							<div class="rack-tier-label">FAVORITE SHOWS</div>
							<div class="rack-items-row">
								{#each favoriteShows as show}
									<button
										class="rack-media-card {selectedRackItem?.title === show.title ? 'rack-card-active' : ''}"
										onclick={() => selectedRackItem = show}
									>
										<div class="rack-poster-slot" style="background-color: {show.posterColor};">
											<div class="rack-poster-art art-{show.designType}"></div>
											{#if show.posterUrl}
												<img src={show.posterUrl} alt={show.title} class="rack-poster-img" loading="lazy" />
											{/if}
											<div class="rack-poster-sheen"></div>
										</div>
										<div class="rack-card-spine"></div>
									</button>
								{/each}
							</div>
							<div class="rack-shelf-plank"></div>
						</div>
					</div>

					</div>

				<!-- Focused Detail Card (outside content div so it isn't clipped) -->
				{#if selectedRackItem}
					<div class="rack-focused-backdrop" onclick={() => selectedRackItem = null} transition:fade={{ duration: 150 }}>
						<div class="rack-focused-card glass" onclick={(e) => e.stopPropagation()}>
							<button class="rack-focused-close" onclick={() => selectedRackItem = null}>&times;</button>
							<div class="rack-focused-layout">
								<div class="rack-focused-poster">
									<div class="rack-focused-poster-art art-{selectedRackItem.designType}" style="background-color: {selectedRackItem.posterColor};">
										{#if selectedRackItem.posterUrl}
											<img src={selectedRackItem.posterUrl} alt={selectedRackItem.title} class="rack-focused-poster-img" loading="lazy" />
										{/if}
									</div>
								</div>
								<div class="rack-focused-details">
									<span class="rack-focused-tag">{selectedRackItem.genre}</span>
									<h2 class="rack-focused-title">{selectedRackItem.title}</h2>
									<p class="rack-focused-meta">{selectedRackItem.director} &middot; {selectedRackItem.year}</p>
									<div class="rack-focused-rating">
										{#each Array(5) as _, i}
											<span class="rack-star">{i < Math.floor(selectedRackItem.rating) ? '★' : '☆'}</span>
										{/each}
										<span class="rack-rating-num">({selectedRackItem.rating}/5)</span>
									</div>
									<blockquote class="rack-focused-review">"{selectedRackItem.review}"</blockquote>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<!-- STANDARD CENTERED MODALS (For other types like Wardrobe carousel, computer desk terminal, etc.) -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div class="modal-overlay" onclick={() => activeHotspot = null}>
					<div class="modal-content glass" onclick={(e) => e.stopPropagation()}>
						<!-- MODAL HEADER -->
						<div class="modal-header">
							<div class="modal-badge-title">
								<span class="modal-badge badge-{activeHotspot.color}">{activeHotspot.type.replace('_', ' ').toUpperCase()}</span>
								<h2>{activeHotspot.label}</h2>
							</div>
							<button class="close-modal" onclick={() => activeHotspot = null}>&times;</button>
						</div>

						<!-- MODAL DYNAMIC BODY -->
						<div class="modal-body">
							<!-- 3. COZY BED: CHILL CORNER TABS -->
							{#if activeHotspot.type === 'bed_chill'}
							<div class="chill-zone-container">
								<div class="chill-tabs-header">
									<button class={activeTab === 'games' ? 'active-tab' : ''} onclick={() => activeTab = 'games'}>🎮 Gaming</button>
									<button class={activeTab === 'hobbies' ? 'active-tab' : ''} onclick={() => activeTab = 'hobbies'}>🎹 Music Production</button>
									<button class={activeTab === 'philosophy' ? 'active-tab' : ''} onclick={() => activeTab = 'philosophy'}>✍️ Reflections</button>
								</div>
								
								<div class="chill-tab-content">
									{#if activeTab === 'games'}
										<div class="games-tab">
											<h3>Favorite Steam Deck Rotation</h3>
											<p>Isometric layouts have a desktop gaming vibe. Here are the files loaded in my system:</p>
											<div class="games-grid">
												<div class="game-card glass">
													<strong>🚛 Trucking Chill</strong>
													<p>American & Euro Truck Simulator 2</p>
													<span class="hours">300+ hrs • Lofi cruising</span>
												</div>
												<div class="game-card glass">
													<strong>⚔️ Cinematic Flow</strong>
													<p>Ghost of Tsushima</p>
													<span class="hours">Samurai arts & photography</span>
												</div>
												<div class="game-card glass">
													<strong>🕷️ Web Slinging</strong>
													<p>Marvel's Spider-Man 2</p>
													<span class="hours">High-speed traversal</span>
												</div>
												<div class="game-card glass">
													<strong>🔥 Rank Grinding</strong>
													<p>League of Legends</p>
													<span class="hours">Tactical micro mechanics</span>
												</div>
											</div>
										</div>
									{:else if activeTab === 'hobbies'}
										<div class="hobbies-tab">
											<h3>FL Studio & Beat Crafting</h3>
											<p>When I am not debugging code, I synthesize soundscapes. My documents directory stores licensing registries for my equipment:</p>
											<ul>
												<li>🎹 <strong>Image-Line FL Studio:</strong> My main digital audio workstation.</li>
												<li>🥁 <strong>XLN Addictive Drums 2:</strong> High fidelity drum modeling library.</li>
												<li>🎸 <strong>Toontrack EZ Bass & Drummer:</strong> Dynamic MIDI arrangements.</li>
											</ul>
											<p class="sub-quote">"Creating code is logical design; creating sound is sensory design. They complete the hemisphere."</p>
										</div>
									{:else if activeTab === 'philosophy'}
										<div class="philosophy-tab">
											<h3>Writing & Mindspace</h3>
											<p>Self-reflection keeps the mind grounded. Here are some of my personal notebook records:</p>
											<div class="writings-list">
												<div class="writing-entry">
													<em>"The Change I'm Still Learning"</em> — A short journal detailing personal growth, habits, and adapting to modern software engineering speeds.
												</div>
												<div class="writing-entry">
													<em>"Dreams are a Funny Thing"</em> — Essay on visual imagery in dreaming, and how isometric shapes represent neat boxes we organize thoughts into.
												</div>
												<div class="writing-entry">
													<em>"To The Mirror I Fear The Most"</em> — Reflections on self-confrontation, building confidence, and finding agency in development.
												</div>
											</div>
										</div>
									{/if}
								</div>
							</div>

						<!-- 4. WARDROBE: PROJECTS ARCHIVE SLIDER -->
						{:else if activeHotspot.type === 'wardrobe'}
							<div class="wardrobe-container">
								<div class="project-slide glass">
									<div class="project-header">
										<span class="project-number">PROJECT 0{activeProjectIndex + 1} / 0{projects.length}</span>
										<h3>{projects[activeProjectIndex].name}</h3>
									</div>
									<p class="project-desc">{projects[activeProjectIndex].desc}</p>
									
									<div class="project-meta">
										<div class="project-tech">
											<strong>Stack:</strong> {projects[activeProjectIndex].tech}
										</div>
										{#if projects[activeProjectIndex].docName}
											<div class="project-doc">
												📄 Verified in document: <code>{projects[activeProjectIndex].docName}</code>
											</div>
										{/if}
									</div>

									<div class="project-actions">
										<a href={projects[activeProjectIndex].link} class="project-link-btn" onclick={(e) => e.preventDefault()}>
											View Case Study &rarr;
										</a>
									</div>
								</div>

								<!-- Carousel Navigation -->
								<div class="wardrobe-nav">
									<button 
										class="nav-btn" 
										onclick={() => activeProjectIndex = (activeProjectIndex - 1 + projects.length) % projects.length}
									>
										&larr; Prev
									</button>
									<div class="nav-dots">
										{#each projects as _, idx}
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
											<span 
												class="nav-dot {activeProjectIndex === idx ? 'active-dot' : ''}"
												onclick={() => activeProjectIndex = idx}
											></span>
										{/each}
									</div>
									<button 
										class="nav-btn" 
										onclick={() => activeProjectIndex = (activeProjectIndex + 1) % projects.length}
									>
										Next &rarr;
									</button>
								</div>
							</div>

						<!-- 5. GENERAL / FALLBACK MODAL BODY -->
						{:else}
							<div class="general-modal-body">
								<p style="font-size: 1.05rem; line-height: 1.6; color: var(--text-secondary); white-space: pre-line;">
									{activeHotspot.description}
								</p>
							</div>
						{/if}

					</div>
				</div>
			</div>
		{/if}
	{/key}
{/if}
</main>

<style>
	/* VIEWPORT CONTAINERS */
	.main-viewport {
		width: 100vw;
		height: 100vh;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
	}

	/* HUD TOP BAR */
	.hud-top-bar {
		position: absolute;
		top: 20px;
		left: 20px;
		right: 20px;
		height: 65px;
		border-radius: 12px;
		padding: 0 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 20;
	}

	.hud-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.pulse-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: var(--accent-purple);
		box-shadow: 0 0 10px var(--accent-purple);
		animation: pulse-indicator-glow 1.5s ease-in-out infinite alternate;
	}

	@keyframes pulse-indicator-glow {
		0% { opacity: 0.4; transform: scale(0.9); }
		100% { opacity: 1; transform: scale(1.1); }
	}

	.hud-title h1 {
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: 2px;
		color: #ffffff;
		text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
	}

	.hud-controls {
		display: flex;
		gap: 12px;
	}

	.hud-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: var(--text-primary);
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		letter-spacing: 1px;
		transition: all 0.2s ease;
	}

	.hud-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.active-btn {
		background: var(--accent-purple) !important;
		border-color: var(--accent-purple) !important;
		box-shadow: 0 0 15px rgba(157, 78, 221, 0.4);
	}

	/* SCENE CONTAINERS (FULLSCREEN) */
	.scene-container {
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.parallax-box {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.room-wrapper {
		position: relative;
		width: 100vw;
		height: 100vh;
	}

	.room-images-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.room-sliding-track {
		display: flex;
		width: 200%; /* Two screens wide */
		height: 100%;
		transition: transform 1.25s cubic-bezier(0.85, 0, 0.15, 1); /* Ultra smooth slide */
	}

	.room-sliding-track.no-transition {
		transition: none !important;
	}

	.room-viewport-pane {
		width: 50%; /* 50% of 200% track = 100% viewport width each */
		height: 100%;
		position: relative;
		overflow: hidden;
	}

	.bedroom-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
		-webkit-user-drag: none;
		transition: opacity 2.8s cubic-bezier(0.4, 0, 0.2, 1); /* Atmospheric slow sunrise/sunset crossfade */
	}

	.day-image {
		z-index: 1;
	}

	.night-image {
		z-index: 2;
		pointer-events: none;
	}

	/* TEMP POINT IN DEV MODE */
	.temp-dot {
		position: absolute;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: var(--accent-pink);
		border: 2px dashed white;
		transform: translate(-50%, -50%);
		z-index: 15;
		pointer-events: none;
		box-shadow: 0 0 10px var(--accent-pink);
	}





	/* ==================== DEV PANEL CONFIGURATOR ==================== */
	.dev-panel {
		position: absolute;
		width: 290px;
		border-radius: 12px;
		padding: 15px;
		z-index: 30;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.dev-header h3 {
		font-size: 1.15rem;
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 4px;
	}

	.dev-header p {
		font-size: 0.8rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.dev-form {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 15px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.dev-form h4 {
		font-size: 0.95rem;
		color: var(--accent-pink);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 6px;
	}

	.dev-form label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.dev-form input, .dev-form select, .dev-form textarea {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		padding: 8px;
		color: #fff;
		font-family: var(--font-sans);
		font-size: 0.85rem;
	}

	.dev-form textarea {
		height: 60px;
		resize: none;
	}

	.dev-buttons {
		display: flex;
		gap: 10px;
		margin-top: 5px;
	}

	.dev-btn-save {
		flex: 2;
		background: var(--accent-purple);
		border: none;
		color: #fff;
		padding: 8px;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
	}

	.dev-btn-cancel {
		flex: 1;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #fff;
		padding: 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	.hotspots-list ul {
		list-style: none;
		max-height: 150px;
		overflow-y: auto;
		border: 1px solid rgba(255,255,255,0.05);
		border-radius: 6px;
	}

	.hotspot-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid rgba(255,255,255,0.05);
		background: rgba(255,255,255,0.01);
	}

	.hotspot-item.selected {
		background: rgba(157, 78, 221, 0.15);
	}

	.hotspot-item-details {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.hotspot-item-details strong {
		font-size: 0.85rem;
	}

	.hotspot-item-details span {
		font-size: 0.7rem;
		color: var(--text-secondary);
	}

	.del-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
	}

	.json-output textarea {
		width: 100%;
		height: 120px;
		background: #000;
		border: 1px solid rgba(255,255,255,0.15);
		color: #00ff66;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		padding: 8px;
		border-radius: 4px;
		resize: none;
	}

	.click-to-copy {
		display: block;
		font-size: 0.65rem;
		color: var(--text-secondary);
		margin-top: 4px;
		text-align: right;
	}

	/* ==================== INTERACTIVE USER MODALS ==================== */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(5, 4, 10, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		backdrop-filter: blur(8px);
	}

	.modal-content {
		width: 650px;
		max-width: 90vw;
		border-radius: 16px;
		overflow: hidden;
		animation: modal-zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.8);
		border-color: rgba(255, 255, 255, 0.15);
	}

	@keyframes modal-zoom {
		0% { transform: scale(0.92); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}

	.modal-header {
		padding: 20px 24px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-badge-title {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.modal-badge {
		align-self: flex-start;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 1px;
		padding: 3px 8px;
		border-radius: 4px;
		color: #fff;
	}

	.badge-purple { background-color: var(--accent-purple); }
	.badge-blue { background-color: var(--accent-blue); }
	.badge-pink { background-color: var(--accent-pink); }

	.modal-header h2 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #fff;
	}

	.close-modal {
		background: none;
		border: none;
		font-size: 2rem;
		color: var(--text-secondary);
		cursor: pointer;
		line-height: 1;
		transition: color 0.2s ease;
	}

	.close-modal:hover {
		color: #fff;
	}

	.modal-body {
		padding: 24px;
		max-height: 65vh;
		overflow-y: auto;
	}



	/* CUSTOM PREMIUM TURNTABLE MODAL */
	.turntable-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(5, 4, 8, 0.4); /* Reduced dark overlay opacity */
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		backdrop-filter: blur(12px);
	}

	.turntable-modal-content {
		width: 700px;
		max-width: 92vw;
		border-radius: 24px;
		/* Premium teak/walnut wooden plinth chassis casing */
		background: linear-gradient(135deg, #422a1e 0%, #2b1a11 100%);
		border: 2px solid #1c100b;
		box-shadow: 
			inset 0 0 25px rgba(0, 0, 0, 0.75),
			0 25px 60px rgba(0, 0, 0, 0.95);
		padding: 35px;
		position: relative;
		animation: turntable-zoom 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes turntable-zoom {
		0% { transform: scale(0.95); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}

	.turntable-close-btn {
		position: absolute;
		top: 20px;
		right: 25px;
		background: none;
		border: none;
		font-size: 2rem;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		line-height: 1;
		transition: all 0.2s ease;
	}

	.turntable-close-btn:hover {
		color: #ffffff;
		transform: scale(1.1);
	}

	.turntable-deck-layout {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 40px;
		align-items: center;
	}

	@media (max-width: 680px) {
		.turntable-deck-layout {
			grid-template-columns: 1fr;
			gap: 25px;
		}
	}

	/* Platter Board (Teenage Engineering style) */
	.turntable-deck-left {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.deck-board {
		background: #f4f3ee; /* Matte Warm Off-White (Teenage Engineering style) */
		border: 1px solid rgba(0, 0, 0, 0.08); /* Soft dark boundary outline */
		border-radius: 20px;
		width: 100%;
		padding: 25px;
		box-shadow: 
			inset 0 0 20px rgba(255, 255, 255, 0.8),
			0 12px 35px rgba(0, 0, 0, 0.4);
		position: relative;
	}

	.deck-strobe {
		position: absolute;
		bottom: 25px;
		left: 25px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #ff3b30; /* Strobe indicator */
		box-shadow: 0 0 8px #ff3b30, 0 0 15px rgba(255, 59, 48, 0.6);
		opacity: 0.8;
	}

	.deck-labels {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 15px;
		padding: 0 5px;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 1px;
		color: rgba(0, 0, 0, 0.4); /* Darker text for readability on off-white */
		text-transform: uppercase;
	}

	.deck-brand {
		font-weight: 700;
	}

	/* Vinyl Platter disc grooves radial lines */
	.vinyl-record-container {
		position: relative;
		width: 230px;
		height: 230px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #040306;
		border-radius: 50%;
		box-shadow: 
			inset 0 0 12px rgba(0,0,0,0.9),
			0 12px 30px rgba(0, 0, 0, 0.55); /* Static drop shadow stays cast downwards */
		margin: 0 auto;
	}

	.vinyl-record {
		width: 215px;
		height: 215px;
		border-radius: 50%;
		/* Beautiful rich blood-red concentric grooves */
		background: repeating-radial-gradient(circle, #b81414 0px, #b81414 2px, #750303 3px, #750303 5px);
		border: 4px solid #5a0202; /* Dark crimson border */
		box-shadow: none; /* Removed shadow from spinning disc to prevent rotation wobble */
		position: relative;
		transition: transform 0.1s linear;
	}

	.record-rotating {
		animation: vinyl-spin 5s linear infinite;
	}

	@keyframes vinyl-spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.vinyl-lines {
		position: absolute;
		top: 10px; left: 10px; right: 10px; bottom: 10px;
		border-radius: 50%;
		border: 1px double rgba(255, 255, 255, 0.04);
	}

	.vinyl-center-label {
		position: absolute;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		width: 66px; height: 66px;
		background: #111115; /* Matte black label center for high contrast */
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: inset 0 0 10px rgba(0,0,0,0.6);
	}

	.center-star {
		font-size: 1.4rem;
		color: #fff;
		text-shadow: 0 1px 2px rgba(0,0,0,0.4);
	}

	.vinyl-spindle-hole {
		width: 6px;
		height: 6px;
		background: #020103;
		border-radius: 50%;
		position: absolute;
	}

	/* Metallic tonearm styling */
	.turntable-tonearm {
		position: absolute;
		top: 15px;
		right: 15px;
		width: 40px;
		height: 40px;
		transform-origin: 20px 20px;
		transform: rotate(-30deg);
		transition: transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1);
	}

	.tonearm-active {
		transform: rotate(16deg);
	}

	.tonearm-pivot {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: radial-gradient(circle, #55555d 10%, #2e2d33 50%, #0d0d10 90%);
		border: 1px solid #4a4a52;
		box-shadow: 0 4px 10px rgba(0,0,0,0.6);
		position: absolute;
		top: 4px; left: 4px;
		z-index: 5;
	}

	.tonearm-rod {
		width: 3px;
		height: 140px;
		background: linear-gradient(90deg, #d3d3d3, #7a7a7a, #a6a6a6);
		position: absolute;
		top: 20px; left: 18px;
		transform-origin: top center;
		z-index: 4;
		border-radius: 2px;
		box-shadow: 1px 2px 4px rgba(0,0,0,0.4);
	}

	.tonearm-cartridge {
		width: 9px;
		height: 24px;
		background: #141317;
		border: 1px solid #333238;
		position: absolute;
		top: 155px; left: 15px;
		border-radius: 2px;
		transform: rotate(-15deg);
		box-shadow: 0 2px 5px rgba(0,0,0,0.5);
	}

	.tonearm-needle-tip {
		width: 3px;
		height: 3px;
		background: #ff3b30;
		border-radius: 50%;
		margin: 3px auto;
		box-shadow: 0 0 4px #ff3b30;
	}

	/* Right Panel: Catalog Typography Styling */
	.turntable-deck-right {
		display: flex;
		flex-direction: column;
		gap: 25px;
	}

	.now-spinning-label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: #ff3b30; /* Solid Red Color Pop tag */
		font-weight: 700;
		text-shadow: 0 0 5px rgba(255, 59, 48, 0.15);
	}

	.track-title-heading {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.8rem;
		font-weight: 400;
		line-height: 1.25;
		color: #ffffff;
		margin-top: 6px;
		text-shadow: 0 2px 10px rgba(0,0,0,0.4);
	}

	/* RPM selector buttons group */
	.rpm-selector-group {
		display: flex;
		align-items: center;
		gap: 12px;
		user-select: none;
	}

	.rpm-label-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 0.8rem;
		letter-spacing: 1.5px;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.rpm-label-btn:hover {
		color: #ffffff;
	}

	.rpm-label-btn.active {
		color: #ff3b30; /* Red active speed label */
		text-shadow: 0 0 5px rgba(255, 59, 48, 0.4);
	}

	.rpm-sep {
		color: rgba(255, 255, 255, 0.15);
		font-size: 0.85rem;
	}

	/* Typographic Tracks catalog list */
	.turntable-tracks-list ul {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0;
	}

	.track-list-item {
		display: flex;
		align-items: baseline;
		gap: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
	}

	.track-num {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: rgba(255, 255, 255, 0.25);
		letter-spacing: 1px;
	}

	.track-title-text {
		font-family: var(--font-sans);
		font-size: 0.95rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.55);
	}

	.track-list-item:hover .track-title-text {
		color: #ffffff;
		transform: translateX(4px);
	}
	.track-list-item:hover .track-num {
		color: rgba(255, 255, 255, 0.6);
	}

	.track-list-item.track-active .track-title-text {
		color: #ff3b30; /* Red color pop active track */
		font-weight: 700;
		text-shadow: 0 0 5px rgba(255, 59, 48, 0.2);
	}
	.track-list-item.track-active .track-num {
		color: #ff3b30;
	}

	/* Custom linear Fader slider bar (Teenage Engineering style) */
	.volume-fader-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 5px;
	}

	.fader-label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: rgba(255, 255, 255, 0.35);
	}

	.fader-track-wrapper {
		width: 100%;
		height: 28px;
		display: flex;
		align-items: center;
		position: relative;
	}

	.volume-fader-input {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 2px;
		background: rgba(255, 255, 255, 0.12);
		outline: none;
		border-radius: 1px;
		cursor: pointer;
	}

	.volume-fader-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 22px;
		background: #ff3b30; /* Red fader slider knob color pop */
		border-radius: 3px;
		border: 1px solid rgba(0,0,0,0.5);
		box-shadow: 
			0 2px 6px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 rgba(255,255,255,0.4);
		transition: background 0.1s ease;
	}

	.volume-fader-input::-webkit-slider-thumb:hover {
		background: #ff5e57;
		box-shadow: 
			0 2px 8px rgba(255, 59, 48, 0.5),
			inset 0 1px 0 rgba(255,255,255,0.5);
	}

	.volume-fader-input::-moz-range-thumb {
		width: 12px;
		height: 22px;
		background: #ff3b30;
		border-radius: 3px;
		border: 1px solid rgba(0,0,0,0.5);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
		cursor: pointer;
	}

	/* Typographic playback control links */
	.playback-controls-group {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 5px;
		user-select: none;
	}

	.playback-text-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 2px;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.playback-text-btn:hover {
		color: #ffffff;
	}

	.playback-text-btn.action-play-toggle.playing {
		color: #ff3b30; /* Highlight active pause status in red */
		text-shadow: 0 0 5px rgba(255, 59, 48, 0.4);
	}

	.playback-sep {
		color: rgba(255, 255, 255, 0.15);
		font-size: 0.85rem;
	}

	/* Autoplay toggle in turntable modal */
	.autoplay-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 2px;
		font-weight: 600;
		transition: all 0.2s ease;
		padding: 4px 0;
	}

	.autoplay-toggle-btn:hover {
		color: #ffffff;
	}

	.autoplay-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		transition: all 0.3s ease;
	}

	.autoplay-toggle-btn.autoplay-on {
		color: #4cd964;
	}

	.autoplay-toggle-btn.autoplay-on .autoplay-dot {
		background: #4cd964;
		box-shadow: 0 0 6px rgba(76, 217, 100, 0.8);
	}

	.autoplay-toggle-btn.autoplay-off {
		color: rgba(255, 255, 255, 0.4);
	}

	.autoplay-toggle-btn.autoplay-off .autoplay-dot {
		background: rgba(255, 255, 255, 0.25);
	}

	/* 3. COZY BED CHILL ZONE */
	.chill-tabs-header {
		display: flex;
		border-bottom: 1px solid rgba(255,255,255,0.08);
		margin-bottom: 20px;
	}

	.chill-tabs-header button {
		flex: 1;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-secondary);
		padding: 12px;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.chill-tabs-header button:hover {
		color: #fff;
	}

	.active-tab {
		color: var(--accent-purple) !important;
		border-color: var(--accent-purple) !important;
	}

	.games-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 15px;
		margin-top: 12px;
	}

	@media (max-width: 500px) {
		.games-grid {
			grid-template-columns: 1fr;
		}
	}

	.game-card {
		padding: 15px;
		border-radius: 8px;
		background: rgba(255,255,255,0.02);
	}

	.game-card strong {
		display: block;
		font-size: 0.95rem;
		color: #fff;
		margin-bottom: 4px;
	}

	.game-card p {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin-bottom: 8px;
	}

	.hours {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--accent-purple);
		background: rgba(157, 78, 221, 0.1);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.hobbies-tab ul {
		margin: 15px 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.hobbies-tab li {
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.hobbies-tab li strong {
		color: #fff;
	}

	.sub-quote {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.25rem;
		color: var(--text-secondary);
		border-left: 2px solid var(--accent-purple);
		padding-left: 15px;
		margin-top: 20px;
	}

	.writings-list {
		display: flex;
		flex-direction: column;
		gap: 15px;
		margin-top: 15px;
	}

	.writing-entry {
		padding: 12px 15px;
		border-left: 3px solid var(--accent-purple);
		background: rgba(255,255,255,0.01);
		border-radius: 0 8px 8px 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.writing-entry em {
		display: block;
		color: #fff;
		font-weight: 600;
		font-style: normal;
		margin-bottom: 4px;
	}

	/* 4. WARDROBE PROJECTS SLIDER */
	.project-slide {
		padding: 24px;
		border-radius: 12px;
		background: rgba(255,255,255,0.02);
		margin-bottom: 20px;
		min-height: 220px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.project-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		flex-wrap: wrap;
		gap: 10px;
	}

	.project-number {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-pink);
		letter-spacing: 1px;
	}

	.project-header h3 {
		font-size: 1.35rem;
		color: #fff;
		font-weight: 700;
	}

	.project-desc {
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: 18px;
	}

	.project-meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.85rem;
		border-top: 1px solid rgba(255,255,255,0.05);
		padding-top: 12px;
		margin-bottom: 15px;
	}

	.project-tech strong {
		color: #fff;
	}

	.project-doc {
		color: var(--text-secondary);
	}

	.project-doc code {
		background: rgba(0,0,0,0.3);
		padding: 2px 6px;
		border-radius: 4px;
		color: var(--accent-purple);
	}

	.project-link-btn {
		display: inline-block;
		background: var(--accent-purple);
		color: #fff;
		padding: 10px 20px;
		border-radius: 6px;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
		transition: all 0.2s ease;
		text-align: center;
	}

	.project-link-btn:hover {
		background: #af5fed;
		box-shadow: 0 0 15px rgba(157, 78, 221, 0.4);
		transform: translateY(-1px);
	}

	.wardrobe-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-btn {
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(255,255,255,0.1);
		color: #fff;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 600;
		font-size: 0.85rem;
		transition: all 0.2s ease;
	}

	.nav-btn:hover {
		background: rgba(255,255,255,0.12);
	}

	.nav-dots {
		display: flex;
		gap: 8px;
	}

	.nav-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255,255,255,0.25);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.active-dot {
		background: var(--accent-pink);
		box-shadow: 0 0 5px var(--accent-pink);
		transform: scale(1.2);
	}

	/* MINIMAL TOOLTIP NEXT TO HOTSPOT */
	.minimal-tooltip {
		position: absolute;
		width: 280px;
		margin-left: -140px; /* Horizontal centering without transform */
		margin-top: -65px;   /* Vertical placement above dot without transform */
		z-index: 50;
		text-align: center;
		pointer-events: auto;
	}

	.minimal-tooltip.edge-right {
		margin-left: -220px; /* Shift slightly left to keep within right viewport boundary */
	}

	.minimal-tooltip.edge-left {
		margin-left: -60px; /* Shift slightly right to keep within left viewport boundary */
	}

	.tooltip-text {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.4rem; /* Elegant serif font */
		font-weight: 400;
		line-height: 1.35;
		color: #ffffff;
		white-space: pre-line;
		text-shadow: 
			0 2px 10px rgba(0, 0, 0, 0.95), 
			0 1px 2px rgba(0, 0, 0, 0.9);
	}

	.tooltip-link-btn {
		display: inline-block;
		margin-top: 8px;
		background: rgba(0, 0, 0, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: #fff;
		padding: 5px 10px;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 600;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	.tooltip-link-btn:hover {
		background: #fff;
		color: #000;
		border-color: #fff;
	}

	/* MINIMAL AUDIO CONTROLLER */
	.mini-audio-controller {
		position: fixed;
		bottom: 30px;
		right: 35px;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: flex-end; /* Align to the right edge */
		gap: 6px;
		pointer-events: auto;
	}

	.mini-audio-track {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.45rem; /* Elegant, large serif font */
		font-weight: 400;
		color: #ffffff;
		text-align: right;
		text-shadow: 
			0 2px 10px rgba(0, 0, 0, 0.95), 
			0 1px 2px rgba(0, 0, 0, 0.9);
		user-select: none;
	}

	.mini-audio-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 2px;
		user-select: none;
	}

	.mini-action-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.75); /* Increased contrast for legibility */
		cursor: pointer;
		padding: 2px 4px;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 2px;
		font-weight: 600; /* Slightly bolder for readability */
		transition: all 0.2s ease;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9); /* Added drop shadow */
	}

	.mini-action-btn:hover {
		color: #ffffff;
		text-shadow: 0 0 5px rgba(255, 255, 255, 0.8), 0 1px 2px rgba(0, 0, 0, 0.9);
	}

	/* Color Pop for active play state - Red */
	.mini-action-btn.action-pop {
		color: #ff3b30; /* Vibrant solid red */
		font-weight: 700;
		text-shadow: 
			0 0 8px rgba(255, 59, 48, 0.8),
			0 1px 2px rgba(0, 0, 0, 0.9);
	}

	.mini-action-btn.action-pop:hover {
		color: #ffffff;
		text-shadow: 0 0 8px #ffffff, 0 1px 2px rgba(0, 0, 0, 0.9);
	}

	.mini-action-sep {
		color: rgba(255, 255, 255, 0.35); /* Increased contrast */
		font-size: 0.75rem;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
	}

	/* AUTOPLAY TOGGLE */
	.mini-action-btn.autoplay-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.autoplay-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.4);
		transition: all 0.3s ease;
	}

	.autoplay-toggle.autoplay-on .autoplay-indicator {
		background: #4cd964;
		box-shadow: 0 0 6px rgba(76, 217, 100, 0.8);
	}

	.autoplay-toggle.autoplay-off .autoplay-indicator {
		background: rgba(255, 255, 255, 0.35);
		box-shadow: none;
	}

	.autoplay-toggle.autoplay-on {
		color: #4cd964;
		text-shadow: 0 0 5px rgba(76, 217, 100, 0.5);
	}

	.autoplay-toggle.autoplay-off {
		color: rgba(255, 255, 255, 0.55);
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
	}

	.autoplay-toggle:hover {
		color: #ffffff;
	}

	/* MUSIC NOTES EMITTER (TURNTABLE HOTSPOT ANIMATION) */
	.music-notes-emitter {
		position: absolute;
		pointer-events: none;
		z-index: 25; /* Float on top of background details */
		width: 0;
		height: 0;
		transform: translate(-50%, -50%);
	}

	.note {
		position: absolute;
		font-size: 1.5rem; /* Larger base size */
		color: #ffffff; /* Clean white notes */
		opacity: 0;
		text-shadow: 
			0 0 8px rgba(255, 255, 255, 0.9), 
			0 2px 5px rgba(0, 0, 0, 0.95); /* Deep shadow for stark visibility */
		user-select: none;
	}

	/* Micro offset animation loops */
	.note-1 {
		animation: float-note-1 3.5s infinite ease-out;
		animation-delay: 0s;
	}
	.note-2 {
		animation: float-note-2 3.5s infinite ease-out;
		animation-delay: 0.9s;
		font-size: 1.2rem;
	}
	.note-3 {
		animation: float-note-3 3.5s infinite ease-out;
		animation-delay: 1.8s;
		font-size: 1.3rem;
	}
	.note-4 {
		animation: float-note-4 3.5s infinite ease-out;
		animation-delay: 2.7s;
		font-size: 1.1rem;
	}

	/* Particle path keyframes */
	@keyframes float-note-1 {
		0% {
			transform: translate(0, 0) scale(0.6) rotate(0deg);
			opacity: 0;
		}
		15% {
			opacity: 0.85;
		}
		100% {
			transform: translate(-25px, -65px) scale(1.1) rotate(-15deg);
			opacity: 0;
		}
	}

	@keyframes float-note-2 {
		0% {
			transform: translate(0, 0) scale(0.6) rotate(0deg);
			opacity: 0;
		}
		15% {
			opacity: 0.85;
		}
		100% {
			transform: translate(22px, -80px) scale(1) rotate(20deg);
			opacity: 0;
		}
	}

	@keyframes float-note-3 {
		0% {
			transform: translate(0, 0) scale(0.6) rotate(0deg);
			opacity: 0;
		}
		15% {
			opacity: 0.85;
		}
		100% {
			transform: translate(-12px, -95px) scale(1.2) rotate(-10deg);
			opacity: 0;
		}
	}

	@keyframes float-note-4 {
		0% {
			transform: translate(0, 0) scale(0.6) rotate(0deg);
			opacity: 0;
		}
		15% {
			opacity: 0.85;
		}
		100% {
			transform: translate(14px, -55px) scale(0.9) rotate(15deg);
			opacity: 0;
		}
	}

	/* DESK CTA POPUP STYLE */
	.desk-cta-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 30px 10px;
		text-align: center;
	}

	.desk-cta-text {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.45rem;
		color: #ffffff;
		margin-bottom: 25px;
		text-shadow: 0 2px 10px rgba(0,0,0,0.3);
	}

	.desk-cta-btn {
		display: inline-block;
		background: #ff3b30; /* Solid Red Color Pop action button */
		color: #ffffff;
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: 0.5px;
		padding: 12px 28px;
		border-radius: 30px;
		text-decoration: none;
		box-shadow: 0 4px 15px rgba(255, 59, 48, 0.3);
		transition: all 0.2s ease;
	}

	.desk-cta-btn:hover {
		background: #ff5e57;
		transform: translateY(-2px);
		box-shadow: 0 6px 20px rgba(255, 59, 48, 0.45);
	}

	/* MINIMAL HEADER TITLE */
	.minimal-header-title {
		position: fixed;
		top: 30px;
		left: 35px;
		z-index: 20;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.65rem;
		font-weight: 500;
		color: #ffffff;
		letter-spacing: 0.5px;
		text-shadow: 
			0 2px 10px rgba(0, 0, 0, 0.8),
			0 1px 2px rgba(0, 0, 0, 0.9);
		pointer-events: none;
		user-select: none;
		margin: 0;
	}

	/* PAGE LOAD FADE-IN OVERLAY */
	.page-load-overlay {
		position: fixed;
		inset: 0;
		background: #000;
		z-index: 9999;
		opacity: 1;
		visibility: visible;
		pointer-events: none;
		transition: opacity 1.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 1.4s step-end;
	}

	.page-load-overlay.loaded {
		opacity: 0;
		visibility: hidden;
	}

	/* MINI AUDIO VISUALIZER STYLE */
	.mini-audio-visualizer {
		display: flex;
		justify-content: flex-end;
		align-items: flex-end;
		gap: 3px;
		height: 12px;
		margin-bottom: 5px;
	}

	.mini-audio-visualizer .bar {
		width: 2px;
		height: 3px;
		background-color: #ffffff;
		border-radius: 1px;
		opacity: 0.75;
		transition: height 0.15s ease;
	}

	/* Bounce animations with keyframe delays */
	.is-playing .mini-audio-visualizer .bar-1  { animation: bounce-bar 0.9s ease-in-out infinite alternate; animation-delay: 0.1s; }
	.is-playing .mini-audio-visualizer .bar-2  { animation: bounce-bar 0.7s ease-in-out infinite alternate; animation-delay: 0.3s; }
	.is-playing .mini-audio-visualizer .bar-3  { animation: bounce-bar 1.1s ease-in-out infinite alternate; animation-delay: 0.5s; }
	.is-playing .mini-audio-visualizer .bar-4  { animation: bounce-bar 0.8s ease-in-out infinite alternate; animation-delay: 0.2s; }
	.is-playing .mini-audio-visualizer .bar-5  { animation: bounce-bar 1.0s ease-in-out infinite alternate; animation-delay: 0.4s; }
	.is-playing .mini-audio-visualizer .bar-6  { animation: bounce-bar 0.6s ease-in-out infinite alternate; animation-delay: 0.1s; }
	.is-playing .mini-audio-visualizer .bar-7  { animation: bounce-bar 0.9s ease-in-out infinite alternate; animation-delay: 0.3s; }
	.is-playing .mini-audio-visualizer .bar-8  { animation: bounce-bar 1.2s ease-in-out infinite alternate; animation-delay: 0.6s; }
	.is-playing .mini-audio-visualizer .bar-9  { animation: bounce-bar 0.7s ease-in-out infinite alternate; animation-delay: 0.2s; }
	.is-playing .mini-audio-visualizer .bar-10 { animation: bounce-bar 1.0s ease-in-out infinite alternate; animation-delay: 0.5s; }
	.is-playing .mini-audio-visualizer .bar-11 { animation: bounce-bar 0.8s ease-in-out infinite alternate; animation-delay: 0.3s; }
	.is-playing .mini-audio-visualizer .bar-12 { animation: bounce-bar 1.1s ease-in-out infinite alternate; animation-delay: 0.4s; }

	@keyframes bounce-bar {
		0% {
			height: 3px;
		}
		100% {
			height: 12px;
		}
	}

	/* PREMIUM EXPANDING DOOR SWITCH BUTTON */
	.hotspot-door-switch {
		position: absolute;
		display: flex;
		align-items: center;
		background: rgba(15, 12, 30, 0.45);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 2px solid rgba(255, 255, 255, 0.7);
		border-radius: 30px;
		padding: 4px;
		color: #ffffff;
		cursor: pointer;
		z-index: 25;
		transition: max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
		overflow: hidden;
		width: auto;
		min-width: 40px;
		max-width: 40px; /* Collapsed state circle */
		height: 40px;
		box-shadow: 0 4px 15px rgba(0,0,0,0.3);
	}

	/* Anchor positioning overrides */
	.hotspot-door-switch.anchor-left {
		transform: translate(0, -50%);
		flex-direction: row;
	}

	.hotspot-door-switch.anchor-right {
		transform: translate(-100%, -50%);
		flex-direction: row-reverse;
	}

	/* Expanding behavior */
	.hotspot-door-switch:hover {
		max-width: 190px; /* Tightly fit content to maintain a buttery smooth, slow transition */
		background: rgba(255, 255, 255, 0.15); /* Light frosted glass translucency */
		color: #ffffff;
		border-color: #ffffff;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25), 0 0 15px rgba(255, 255, 255, 0.15);
	}

	/* Adjust text padding dynamically based on anchor direction on hover */
	.hotspot-door-switch.anchor-left:hover {
		padding-right: 20px;
	}

	.hotspot-door-switch.anchor-right:hover {
		padding-left: 20px;
	}

	.door-switch-circle {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #ffffff;
		color: #05040a;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.hotspot-door-switch:hover .door-switch-circle {
		background: #ffffff;
		color: #05040a;
	}

	.door-arrow-icon {
		width: 16px;
		height: 16px;
		transition: transform 0.45s ease;
	}

	/* Point arrow left dynamically when in the living room */
	.room-wrapper.room-living_room .hotspot-door-switch .door-arrow-icon {
		transform: rotate(180deg);
	}

	.door-switch-text {
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 0.85rem;
		letter-spacing: 0.5px;
		white-space: nowrap;
		opacity: 0;
		transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Slide text in from correct side depending on anchor */
	.hotspot-door-switch.anchor-left .door-switch-text {
		margin-left: 14px;
		transform: translateX(-12px);
	}

	.hotspot-door-switch.anchor-right .door-switch-text {
		margin-right: 14px;
		transform: translateX(12px);
	}

	.hotspot-door-switch:hover .door-switch-text {
		opacity: 1;
		transform: translateX(0);
	}

	/* ==================== PREMIUM VIRTUAL SYNTHESIZER MODAL ==================== */
	.synth-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(3, 2, 7, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: synth-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes synth-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.synth-modal-content {
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		padding: 24px;
		background: rgba(10, 10, 15, 0.65);
		box-shadow: 
			0 25px 50px -12px rgba(0, 0, 0, 0.7),
			0 0 40px rgba(157, 78, 221, 0.15);
		max-width: 820px;
		width: 90vw;
		animation: synth-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes synth-slide-up {
		from { transform: translateY(20px) scale(0.98); }
		to { transform: translateY(0) scale(1); }
	}

	.synth-close-btn {
		position: absolute;
		top: -42px;
		right: 0;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-size: 2.2rem;
		cursor: pointer;
		line-height: 1;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		z-index: 10;
	}

	.synth-close-btn:hover {
		color: #ffffff;
		transform: scale(1.1);
	}

	/* Synthesizer Hardware Housing */
	.synth-housing {
		display: flex;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 
			0 15px 35px rgba(0,0,0,0.6),
			inset 0 1px 1px rgba(255,255,255,0.1);
		border: 1px solid #1a1a24;
	}

	.wood-cheek {
		width: 24px;
		background: linear-gradient(to right, #4e2912 0%, #3a1e0b 50%, #201005 100%);
		border-top: 1px solid rgba(255,255,255,0.1);
		border-bottom: 2px solid #120903;
		flex-shrink: 0;
	}

	.cheek-left {
		box-shadow: inset -3px 0 5px rgba(0,0,0,0.5);
	}

	.cheek-right {
		box-shadow: inset 3px 0 5px rgba(0,0,0,0.5);
		background: linear-gradient(to left, #4e2912 0%, #3a1e0b 50%, #201005 100%);
	}

	/* Synth Dashboard Faceplate */
	.synth-faceplate {
		flex-grow: 1;
		background: 
			radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.01) 0%, transparent 80%),
			linear-gradient(180deg, #22222a 0%, #111116 100%);
		padding: 20px 20px 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		border-bottom: 3px solid #060609;
		position: relative;
	}

	/* Top brand plate */
	.synth-header-panel {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		padding-bottom: 10px;
		user-select: none;
	}

	.synth-brand-logo {
		font-family: var(--font-sans);
		font-size: 1.1rem;
		font-weight: 800;
		letter-spacing: 4px;
		color: #ffffff;
		text-shadow: 0 1px 3px rgba(0,0,0,0.5);
	}

	.synth-modes-indicator {
		font-family: var(--font-sans);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 2px;
		color: rgba(255, 255, 255, 0.35);
	}

	/* Synth Controls Sections Dashboard */
	.synth-dashboard {
		display: grid;
		grid-template-columns: 1.2fr 1.3fr 1.3fr 1.6fr;
		gap: 16px;
		align-items: stretch;
	}

	.control-block {
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		padding: 12px 10px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		position: relative;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
	}

	.block-label {
		font-family: var(--font-sans);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 2px;
		color: #ff7a00; /* Warm Vintage Amber/Orange */
		text-transform: uppercase;
		text-align: center;
		border-bottom: 1px solid rgba(255, 122, 0, 0.15);
		padding-bottom: 4px;
		user-select: none;
	}

	/* Oscillator selector faders grid */
	.wave-buttons-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		height: 100%;
		align-content: center;
	}

	.wave-btn {
		background: linear-gradient(180deg, #3a3a3a 0%, #262626 100%);
		border: 1px solid #1a1a1a;
		color: #9f9f9f;
		border-radius: 4px;
		font-size: 0.68rem;
		font-weight: 700;
		cursor: pointer;
		padding: 8px 0;
		box-shadow: 
			0 1px 3px rgba(0,0,0,0.4),
			inset 0 1px 0 rgba(255,255,255,0.05);
		transition: all 0.15s ease;
		letter-spacing: 0.5px;
	}

	.wave-btn:hover {
		color: #e5e5e5;
		background: linear-gradient(180deg, #444 0%, #2e2e2e 100%);
	}

	.wave-btn.active {
		background: linear-gradient(180deg, #ff7a00 0%, #d45d00 100%); /* Vintage Orange toggle */
		color: #ffffff;
		border-color: #ff7a00;
		box-shadow: 
			0 2px 5px rgba(0,0,0,0.5),
			0 0 6px rgba(255, 122, 0, 0.3),
			inset 0 1px 0 rgba(255,255,255,0.25);
		text-shadow: 0 1px 2px rgba(0,0,0,0.4);
	}

	/* Vertical Sliders (Faders) Panel styling */
	.knobs-row, .faders-row {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 100%;
		padding: 4px 0;
	}

	.knob-container, .fader-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.knob-label, .fader-label {
		font-family: var(--font-sans);
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 1px;
		color: rgba(255,255,255,0.4);
		text-transform: uppercase;
		user-select: none;
	}

	.fader-track-vertical {
		height: 70px;
		width: 24px;
		background: #09090d;
		border-radius: 4px;
		display: flex;
		justify-content: center;
		align-items: center;
		box-shadow: inset 0 2px 5px rgba(0,0,0,0.6);
		border: 1px solid rgba(255,255,255,0.03);
		position: relative;
	}

	/* Custom vertical range slider track styling */
	.synth-slider-vertical {
		-webkit-appearance: none;
		appearance: none;
		width: 60px;
		height: 6px;
		background: transparent;
		transform: rotate(-90deg);
		outline: none;
		cursor: pointer;
		position: absolute;
		z-index: 5;
	}

	/* Slider Thumb (Handles) */
	.synth-slider-vertical::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 20px;
		background: linear-gradient(180deg, #f2f2f2 0%, #a6a6a6 100%);
		border-radius: 2px;
		border: 1px solid #404040;
		box-shadow: 
			0 2px 4px rgba(0,0,0,0.5),
			inset 0 1px 0 rgba(255,255,255,0.8);
		position: relative;
	}

	/* Highlight marker strip on handles */
	.synth-slider-vertical::-webkit-slider-thumb::after {
		content: '';
		position: absolute;
		left: 6px;
		top: 2px;
		width: 2px;
		height: 14px;
		background: #ff3c38; /* Red marker line */
	}

	/* Value labels */
	.knob-value, .fader-value {
		font-family: monospace;
		font-size: 0.65rem;
		color: rgba(255,255,255,0.6);
		background: rgba(0,0,0,0.4);
		padding: 2px 4px;
		border-radius: 3px;
		min-width: 32px;
		text-align: center;
		border: 1px solid rgba(255,255,255,0.05);
	}

	/* Oscilloscope Vector Scope Bezel */
	.scope-screen-housing {
		border: 2px solid #004d26;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 
			inset 0 0 12px rgba(0,255,128,0.25),
			0 0 10px rgba(0,255,128,0.08);
		background: #0a0a0f;
		display: flex;
		justify-content: center;
		align-items: center;
		height: 80px;
	}

	#oscilloscope-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	/* Keyboard bed frame and casing */
	.synth-keyboard-container {
		background: #08080c;
		border-radius: 8px;
		padding: 10px;
		box-shadow: 
			inset 0 3px 6px rgba(0,0,0,0.8),
			0 1px 0 rgba(255,255,255,0.05);
		position: relative;
	}

	.synth-keyboard-bed {
		height: 120px;
		position: relative;
		border-radius: 4px;
		overflow: hidden;
		background: #111;
		box-shadow: 0 4px 10px rgba(0,0,0,0.9);
	}

	/* White Keys Styling (3D look) */
	.white-key {
		position: absolute;
		top: 0;
		height: 100%;
		background: linear-gradient(180deg, #faf8f5 0%, #ece7dc 80%, #d8d0c0 100%);
		border: 1px solid #b5ad9d;
		border-bottom: 5px solid #9c9281;
		border-radius: 0 0 4px 4px;
		box-shadow: 
			inset 0 3px 0 rgba(255,255,255,0.8),
			0 4px 5px rgba(0,0,0,0.4);
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 8px;
		transition: all 0.08s ease;
		z-index: 1;
	}

	.white-key:hover {
		background: linear-gradient(180deg, #fffcf9 0%, #efeae0 80%, #ded6c5 100%);
	}

	.white-key.active, .white-key:active {
		background: linear-gradient(180deg, #dcd7ca 0%, #c4beaf 100%);
		border-color: #9c9484;
		border-bottom-width: 1px;
		transform: translateY(4px);
		box-shadow: 
			inset 0 4px 7px rgba(0,0,0,0.22),
			0 1px 2px rgba(0,0,0,0.15);
		padding-bottom: 4px;
	}

	.key-note-label {
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-weight: 800;
		color: rgba(90, 83, 69, 0.45);
		user-select: none;
	}

	.white-key.active .key-note-label, .white-key:active .key-note-label {
		color: rgba(90, 83, 69, 0.75);
		text-shadow: none;
	}

	/* Overlaid Black Keys Styling (3D look) */
	.black-key {
		position: absolute;
		top: 0;
		height: 60%;
		background: linear-gradient(180deg, #2b2b2b 0%, #1f1f1f 85%, #151515 100%);
		border-left: 1px solid #1c1c1c;
		border-right: 1px solid #1c1c1c;
		border-bottom: 6px solid #000000;
		border-radius: 0 0 3px 3px;
		box-shadow: 
			inset 0 1px 1px rgba(255,255,255,0.12),
			0 4px 5px rgba(0,0,0,0.5);
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 6px;
		z-index: 5;
		transition: all 0.08s ease;
	}

	.black-key:hover {
		background: linear-gradient(180deg, #363636 0%, #282828 85%, #1c1c1c 100%);
	}

	.black-key.active, .black-key:active {
		background: linear-gradient(180deg, #181818 0%, #0c0c0c 100%);
		border-bottom-width: 2px;
		height: 59%;
		transform: translateY(3px);
		box-shadow: 
			inset 0 3px 5px rgba(0,0,0,0.65),
			0 1px 2px rgba(0,0,0,0.3);
		padding-bottom: 4px;
	}

	.key-note-label-black {
		font-family: var(--font-sans);
		font-size: 0.6rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.35);
		user-select: none;
	}

	.black-key.active .key-note-label-black, .black-key:active .key-note-label-black {
		color: rgba(255, 255, 255, 0.6);
		text-shadow: none;
	}

	/* ==================== PLAYABLE CHESSBOARD & PROFILE MODAL ==================== */
	.chess-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(3, 2, 7, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: chess-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes chess-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.chess-modal-content {
		position: relative;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 16px;
		padding: 28px;
		background: rgba(10, 10, 15, 0.7);
		box-shadow: 
			0 25px 50px -12px rgba(0, 0, 0, 0.75),
			0 0 40px rgba(255, 122, 0, 0.08);
		max-width: 720px;
		width: 90vw;
		animation: chess-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes chess-slide-up {
		from { transform: translateY(20px) scale(0.98); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}

	.chess-close-btn {
		position: absolute;
		top: -42px;
		right: 0;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-size: 2.2rem;
		cursor: pointer;
		line-height: 1;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		z-index: 10;
	}

	.chess-close-btn:hover {
		color: #ffffff;
		transform: scale(1.1);
	}

	.chess-layout {
		display: grid;
		grid-template-columns: 1fr 1.3fr;
		gap: 32px;
		align-items: center;
	}

	@media (max-width: 640px) {
		.chess-layout {
			grid-template-columns: 1fr;
			gap: 24px;
		}
	}

	/* Sidebar stats card */
	.chess-sidebar {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 12px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
	}

	.chess-header-area h2 {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.65rem;
		color: #ffffff;
		margin: 4px 0 0 0;
	}

	.chess-tag {
		font-family: var(--font-sans);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 2px;
		color: #ff7a00;
	}

	/* Spinner */
	.chess-loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 0;
		gap: 12px;
		color: rgba(255, 255, 255, 0.5);
		font-family: var(--font-sans);
		font-size: 0.85rem;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgba(255, 255, 255, 0.1);
		border-top-color: #ff7a00;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.chess-error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 30px 0;
		text-align: center;
		color: rgba(255, 255, 255, 0.4);
	}

	/* Profile card values */
	.chess-profile-card {
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: center;
	}

	.chess-avatar-wrapper {
		width: 72px;
		height: 72px;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 4px 10px rgba(0,0,0,0.4);
	}

	.chess-avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.chess-stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		width: 100%;
	}

	.stat-box {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.stat-title {
		font-family: var(--font-sans);
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: rgba(255, 255, 255, 0.4);
	}

	.stat-value {
		font-family: monospace;
		font-size: 1rem;
		font-weight: 700;
		color: #ffffff;
	}

	.chess-action-btn {
		display: block;
		width: 100%;
		background: linear-gradient(180deg, #ff7a00 0%, #d45d00 100%);
		border: 1px solid #ff7a00;
		border-radius: 6px;
		color: #ffffff;
		font-family: var(--font-sans);
		font-size: 0.82rem;
		font-weight: 700;
		text-decoration: none;
		text-align: center;
		padding: 10px 0;
		transition: all 0.2s ease;
		box-shadow: 0 4px 10px rgba(255, 122, 0, 0.2);
	}

	.chess-action-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 15px rgba(255, 122, 0, 0.35);
	}

	/* Playable Board Area */
	.chess-board-area {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.board-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.puzzle-title {
		font-family: var(--font-sans);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 2px;
		color: #ff7a00;
	}

	.puzzle-task {
		font-family: var(--font-sans);
		font-size: 0.88rem;
		font-weight: 700;
		color: #ffffff;
	}

	.board-grid-wrapper {
		background: #201b17;
		padding: 6px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		box-shadow: 0 10px 20px rgba(0,0,0,0.5);
	}

	.chessboard-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows: repeat(8, 1fr);
		width: 100%;
		aspect-ratio: 1;
		border-radius: 4px;
		overflow: hidden;
	}

	.chess-square {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		cursor: pointer;
		position: relative;
		user-select: none;
	}

	.light-square {
		background-color: #ede6d6; /* Cozy cream light square */
	}

	.dark-square {
		background-color: #b59f88; /* Warm brown dark square */
	}

	.selected-square {
		background-color: #f7d070 !important; /* Selected cell overlay */
	}

	.chess-piece-symbol {
		font-size: 2rem;
		line-height: 1;
		display: block;
		transition: transform 0.1s ease;
	}

	@media (max-width: 480px) {
		.chess-piece-symbol {
			font-size: 1.4rem;
		}
	}

	.white-piece {
		color: #ffffff;
		text-shadow: 
			-1.5px -1.5px 0 #181512,  
			 1.5px -1.5px 0 #181512,
			-1.5px  1.5px 0 #181512,
			 1.5px  1.5px 0 #181512,
			 0 3px 6px rgba(0, 0, 0, 0.4);
	}

	.black-piece {
		color: #1a1715;
		text-shadow: 
			-1px -1px 0 rgba(255, 255, 255, 0.2),  
			 1px -1px 0 rgba(255, 255, 255, 0.2),
			-1px  1px 0 rgba(255, 255, 255, 0.2),
			 1px  1px 0 rgba(255, 255, 255, 0.2);
	}

	.board-footer-feedback {
		min-height: 38px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-family: var(--font-sans);
		font-size: 0.8rem;
		border-top: 1px solid rgba(255,255,255,0.05);
		padding-top: 12px;
	}

	.feedback-msg {
		font-weight: 500;
	}

	.success-msg {
		color: #2ed573;
		text-shadow: 0 0 8px rgba(46, 213, 115, 0.2);
	}

	.error-msg {
		color: #ff4757;
		animation: shake 0.3s ease-in-out;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-4px); }
		75% { transform: translateX(4px); }
	}

	.helper-msg {
		color: rgba(255, 255, 255, 0.4);
	}

	.retry-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		color: #ffffff;
		font-family: var(--font-sans);
		font-size: 0.72rem;
		font-weight: 700;
		padding: 4px 10px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.retry-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.retry-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
	}

	/* ==================== COZY BOOKSHELF MODAL STYLES ==================== */
	.bookshelf-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(3, 2, 7, 0.5);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: bookshelf-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes bookshelf-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.bookshelf-modal-content {
		position: relative;
		border: none;
		border-radius: 0;
		padding: 24px;
		background: none;
		box-shadow: none;
		max-width: 1160px;
		width: 96vw;
		animation: bookshelf-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes bookshelf-slide-up {
		from { transform: translateY(24px) scale(0.99); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}

	.bookshelf-close-btn {
		position: absolute;
		top: -36px;
		right: 12px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.45);
		font-size: 2.2rem;
		cursor: pointer;
		line-height: 1;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		z-index: 10;
	}

	.bookshelf-close-btn:hover {
		color: #ffffff;
		transform: scale(1.1);
	}

	/* The Wood Bookcase Furniture Frame */
	.bookshelf-furniture-frame {
		display: flex;
		width: 100%;
		background: #25140e; /* Wood veneer backboard */
		border: 12px solid #4a281c; /* Heavy walnut framing border */
		border-radius: 12px;
		box-shadow: 
			0 30px 60px rgba(0, 0, 0, 0.85),
			inset 0 0 50px rgba(0, 0, 0, 0.7);
		padding: 4px 0;
		position: relative;
		overflow: hidden;
	}

	.bookshelf-side-pillar {
		width: 16px;
		background: linear-gradient(90deg, #321910 0%, #4a281c 50%, #321910 100%);
		box-shadow: 
			inset 1px 0 0 rgba(255,255,255,0.06), 
			inset -1px 0 0 rgba(0,0,0,0.5);
	}

	.bookshelf-shelves-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 18px 24px;
		background: rgba(0, 0, 0, 0.2); /* Deep shadow inside shelf */
	}

	.shelf-tier {
		display: flex;
		flex-direction: column;
		width: 100%;
		perspective: 1200px;
	}

	.shelf-header-tag {
		font-family: var(--font-sans);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 2px;
		color: rgba(255, 255, 255, 0.25);
		margin-bottom: 12px;
		text-align: center;
		border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
		padding-bottom: 6px;
		user-select: none;
	}

	.shelf-row-albums {
		display: flex;
		justify-content: space-around;
		align-items: flex-end;
		height: 172px;
		padding: 0 10px;
		z-index: 2;
	}

	.shelf-row-books {
		display: flex;
		justify-content: space-around;
		align-items: flex-end;
		height: 200px;
		padding: 0 10px;
		z-index: 2;
	}

	/* Wood Shelf Board Plank */
	.shelf-wood-plank {
		width: 100%;
		height: 14px;
		background: linear-gradient(180deg, #44251a 0%, #291710 100%);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 2px solid #130a07;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
		z-index: 3;
		border-radius: 1px;
	}

	/* Album Sleeves */
	.shelf-album-sleeve {
		width: 140px;
		height: 140px;
		border: 1px solid rgba(0,0,0,0.4);
		border-radius: 4px;
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 
			-2px 3px 6px rgba(0,0,0,0.5),
			inset 0 1px 1px rgba(255,255,255,0.08);
		transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: bottom center;
		overflow: hidden;
		padding: 0;
	}

	.shelf-album-sleeve:hover {
		transform: scale(1.06) translateY(-8px) rotate(-2deg);
		box-shadow: -4px 10px 16px rgba(0,0,0,0.6);
		z-index: 10;
	}

	.shelf-album-sleeve.active-sleeve {
		transform: scale(1.08) translateY(-10px);
		box-shadow: 
			-4px 12px 20px rgba(0,0,0,0.65),
			0 0 15px rgba(255, 122, 0, 0.2);
		z-index: 11;
		border: 1.5px solid #ff7a00;
	}

	/* Book Covers (Facing Sideways / Forward) */
	.shelf-book-cover {
		width: 114px;
		height: 168px;
		border: 1px solid rgba(0,0,0,0.4);
		border-radius: 3px;
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 
			-2px 3px 6px rgba(0,0,0,0.4),
			inset 0 1px 1px rgba(255,255,255,0.08);
		transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: bottom center;
		overflow: hidden;
		padding: 0;
	}

	.shelf-book-cover:hover {
		transform: scale(1.06) translateY(-8px) rotate(2deg);
		box-shadow: -4px 10px 16px rgba(0,0,0,0.6);
		z-index: 10;
	}

	.shelf-book-cover.active-cover {
		transform: scale(1.08) translateY(-10px);
		box-shadow: 
			-4px 12px 20px rgba(0,0,0,0.65),
			0 0 15px rgba(255, 122, 0, 0.2);
		z-index: 11;
		border: 1.5px solid #ff7a00;
	}

	/* Album & Book Custom CSS Graphic Designs */
	.album-cover-design, .book-cover-design {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: center;
	}

	.album-title-short, .book-title-short {
		font-family: var(--font-sans);
		font-size: 0.48rem;
		font-weight: 700;
		color: rgba(255,255,255,0.85);
		text-transform: uppercase;
		text-align: center;
		letter-spacing: 0.5px;
		padding: 4px 2px;
		width: 100%;
		background: rgba(0,0,0,0.5);
		backdrop-filter: blur(2px);
		position: absolute;
		bottom: 0;
		left: 0;
		user-select: none;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Design Specific Backgrounds */
	.design-suns {
		background: radial-gradient(circle at center, #ea580c 0%, #7c2d12 70%);
	}
	.design-suns .sunburst {
		position: absolute;
		width: 55px;
		height: 55px;
		border-radius: 50%;
		background: rgba(253, 224, 71, 0.35);
		filter: blur(8px);
		top: 15px;
		left: 50%;
		transform: translateX(-50%);
	}

	.design-bug {
		background: #1c1917;
	}
	.design-bug .bug-silhouette {
		position: absolute;
		width: 24px;
		height: 32px;
		background: #dc2626;
		top: 25px;
		left: 50%;
		transform: translateX(-50%);
		mask: radial-gradient(circle at center, transparent 30%, black 30%);
		-webkit-mask: radial-gradient(circle at center, transparent 30%, black 30%);
		opacity: 0.85;
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(220, 38, 38, 0.5);
	}

	.design-disquiet {
		background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
	}
	.design-disquiet .ink-cloud {
		position: absolute;
		width: 70px;
		height: 70px;
		background: radial-gradient(circle, rgba(129, 140, 248, 0.15) 0%, transparent 60%);
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
	}

	.design-train {
		background: linear-gradient(180deg, #78350f 0%, #1e1b4b 100%);
	}
	.design-train .train-silhouette {
		position: absolute;
		width: 100%;
		height: 24px;
		background: #000000;
		bottom: 20px;
		clip-path: polygon(0 80%, 20% 50%, 40% 80%, 60% 30%, 80% 80%, 100% 80%);
	}

	.design-underground {
		background: #090d16;
	}
	.design-underground .underground-cracks {
		position: absolute;
		width: 100%;
		height: 100%;
		background: repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 10px);
	}

	.design-nevermind {
		background: #020205;
	}
	.design-nevermind .nevermind-waves {
		position: absolute;
		inset: 6px;
		border: 1px solid rgba(255,255,255,0.08);
		background: radial-gradient(circle at top right, rgba(255,255,255,0.04) 0%, transparent 70%);
	}

	.design-freudian {
		background: linear-gradient(180deg, #bae6fd 0%, #e0f2fe 100%);
	}
	.design-freudian .sky-gradient {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.design-freudian .sky-monument {
		width: 22px;
		height: 40px;
		background: #d6d3d1;
		margin-bottom: 20px;
		clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
		opacity: 0.9;
	}

	.design-fateh {
		background: #3c0b02;
	}
	.design-fateh .fateh-grid {
		position: absolute;
		width: 100%;
		height: 100%;
		background: radial-gradient(circle, #ea580c 0%, transparent 60%);
		opacity: 0.4;
	}

	.design-bala {
		background: linear-gradient(135deg, #450a0a 0%, #0f0505 100%);
	}
	.design-bala .keychain-art {
		position: absolute;
		width: 40px;
		height: 40px;
		border: 2px dashed rgba(239, 68, 68, 0.3);
		border-radius: 50%;
		top: 15px;
		left: 50%;
		transform: translateX(-50%);
	}

	.design-igor {
		background: #f472b6;
	}
	.design-igor .igor-pink-bg {
		position: absolute;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.design-igor .igor-face-shadow {
		width: 36px;
		height: 40px;
		background: #000000;
		border-radius: 6px;
		opacity: 0.9;
		clip-path: ellipse(40% 50% at 50% 50%);
	}

	.design-diljit {
		background: #030712;
	}
	.design-diljit .moonchild-gold {
		position: absolute;
		width: 36px;
		height: 36px;
		border: 1px solid rgba(234, 179, 8, 0.4);
		border-radius: 50%;
		background: radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, transparent 80%);
		top: 15px;
		left: 50%;
		transform: translateX(-50%);
	}

	/* ==================== IMMERSIVE FOCUSED ITEM OVERLAY CARD ==================== */
	.focused-item-backdrop {
		position: absolute;
		inset: -24px;
		background: rgba(3, 2, 7, 0.7);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: focused-fade-in 0.2s ease-out both;
		border-radius: 12px;
	}

	@keyframes focused-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.focused-item-card {
		position: relative;
		width: 680px;
		max-width: 90vw;
		background: rgba(13, 12, 19, 0.92);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 36px;
		box-shadow: 
			0 30px 60px rgba(0, 0, 0, 0.8),
			0 0 50px rgba(255, 122, 0, 0.1);
		animation: focused-card-zoom 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes focused-card-zoom {
		from { transform: scale(0.94) translateY(12px); opacity: 0; }
		to { transform: scale(1) translateY(0); opacity: 1; }
	}

	.focused-card-close {
		position: absolute;
		top: 16px;
		right: 18px;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.4);
		font-size: 1.8rem;
		cursor: pointer;
		line-height: 1;
		transition: all 0.2s ease;
	}

	.focused-card-close:hover {
		color: #ffffff;
		transform: scale(1.1);
	}

	.focused-card-layout {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 36px;
		align-items: center;
	}

	@media (max-width: 620px) {
		.focused-card-layout {
			grid-template-columns: 1fr;
			gap: 24px;
			text-align: center;
		}
		.focused-cover-container {
			display: flex;
			justify-content: center;
		}
	}

	/* Real cover art images over CSS placeholders */
	.shelf-item-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
		z-index: 5;
		pointer-events: none;
		display: block;
	}

	.focused-item-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
		z-index: 5;
		pointer-events: none;
		display: block;
	}

	.focused-cover-mock {
		width: 190px;
		height: 190px;
		border-radius: 6px;
		box-shadow: 
			0 12px 28px rgba(0,0,0,0.65),
			inset 0 1px 0 rgba(255,255,255,0.1);
		position: relative;
		overflow: hidden;
	}

	/* Book Mock Ratio (Vertical Rect) */
	.focused-cover-mock.design-suns, 
	.focused-cover-mock.design-bug, 
	.focused-cover-mock.design-disquiet, 
	.focused-cover-mock.design-train, 
	.focused-cover-mock.design-underground {
		width: 170px;
		height: 235px;
	}

	.focused-cover-mock::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%);
		z-index: 2;
	}

	.focused-details-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.focused-meta-tag {
		align-self: flex-start;
		font-family: var(--font-sans);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 2px;
		color: #ff7a00;
		text-transform: uppercase;
		border: 1px solid rgba(255, 122, 0, 0.3);
		padding: 3px 8px;
		border-radius: 4px;
		background: rgba(255, 122, 0, 0.06);
	}

	@media (max-width: 620px) {
		.focused-meta-tag {
			align-self: center;
		}
	}

	.focused-title {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.8rem;
		color: #ffffff;
		margin: 0;
		line-height: 1.2;
	}

	.focused-author {
		font-family: var(--font-sans);
		font-size: 0.95rem;
		color: rgba(255, 255, 255, 0.55);
		margin: -4px 0 0 0;
	}

	.focused-star-rating {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
	}

	.focused-star {
		color: #ff7a00;
		font-size: 1.15rem;
	}

	.focused-rating-num {
		font-family: monospace;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.4);
		margin-left: 8px;
	}

	.focused-track-badge {
		font-family: var(--font-sans);
		font-size: 0.82rem;
		color: #ffffff;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
		padding: 6px 12px;
		border-radius: 6px;
		align-self: flex-start;
		margin-top: 2px;
	}

	@media (max-width: 620px) {
		.focused-track-badge {
			align-self: center;
		}
	}

	.focused-track-badge strong {
		color: #ff7a00;
	}

	.focused-personal-review {
		margin: 12px 0 0 0;
		border-left: 3px solid #ff7a00;
		padding-left: 18px;
		font-family: var(--font-sans);
		font-size: 0.94rem;
		color: rgba(255, 255, 255, 0.75);
		font-style: italic;
		line-height: 1.65;
	}

	/* ===================== MEDIA RACK MODAL ===================== */
	.rack-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(3, 2, 7, 0.55);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: rack-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes rack-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.rack-modal-content {
		position: relative;
		max-width: 1080px;
		width: 96vw;
		animation: rack-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes rack-slide-up {
		from { transform: translateY(20px) scale(0.98); opacity: 0; }
		to { transform: translateY(0) scale(1); opacity: 1; }
	}

	.rack-close-btn {
		position: absolute;
		top: -8px;
		right: -48px;
		background: none;
		border: none;
		color: rgba(255,255,255,0.5);
		font-size: 2.4rem;
		cursor: pointer;
		line-height: 1;
		transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
		z-index: 10;
	}

	.rack-close-btn:hover {
		color: #fff;
		transform: scale(1.1);
	}

	/* Rack Header */
	.rack-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 28px;
		padding-bottom: 16px;
		border-bottom: 1px solid rgba(255,255,255,0.07);
	}

	.rack-title-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.rack-title {
		font-family: var(--font-sans);
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 6px;
		text-transform: uppercase;
		color: #ffffff;
		margin: 0;
	}

	.rack-subtitle {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 0.85rem;
		color: rgba(255,255,255,0.4);
		margin: 0;
	}

	.letterboxd-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #00e054;
		color: #000;
		font-family: var(--font-sans);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		text-decoration: none;
		padding: 7px 14px;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.letterboxd-link:hover {
		background: #1eff69;
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(0,224,84,0.3);
	}

	.lbx-icon {
		display: flex;
		align-items: center;
	}

	/* Rack Body */
	.rack-body {
		background: linear-gradient(180deg, #0d0b14 0%, #110e1a 100%);
		border: 2px solid rgba(255,255,255,0.06);
		border-radius: 10px;
		padding: 28px 24px 20px;
		box-shadow:
			0 20px 50px rgba(0,0,0,0.6),
			inset 0 1px 0 rgba(255,255,255,0.04);
	}

	.rack-tier {
		position: relative;
	}

	.rack-tier-label {
		font-family: var(--font-sans);
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 3px;
		text-transform: uppercase;
		color: rgba(255,255,255,0.3);
		margin-bottom: 14px;
	}

	.rack-items-row {
		display: flex;
		gap: 14px;
		overflow-x: auto;
		padding-bottom: 8px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.1) transparent;
	}

	.rack-items-row::-webkit-scrollbar {
		height: 4px;
	}

	.rack-items-row::-webkit-scrollbar-track {
		background: transparent;
	}

	.rack-items-row::-webkit-scrollbar-thumb {
		background: rgba(255,255,255,0.1);
		border-radius: 2px;
	}

	/* Media Card (DVD/Blu-ray case) */
	.rack-media-card {
		flex: 0 0 auto;
		width: 140px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		position: relative;
		transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
	}

	.rack-media-card:hover {
		transform: translateY(-6px);
	}

	.rack-media-card.rack-card-active {
		transform: translateY(-8px);
	}

	.rack-media-card.rack-card-active .rack-poster-slot {
		box-shadow:
			0 0 0 2px #9d4edd,
			0 8px 24px rgba(157,78,221,0.4);
	}

	.rack-poster-slot {
		width: 140px;
		height: 200px;
		border-radius: 4px;
		overflow: hidden;
		position: relative;
		box-shadow:
			2px 0 0 rgba(0,0,0,0.3),
			4px 2px 8px rgba(0,0,0,0.5);
		transition: box-shadow 0.25s ease;
	}

	.rack-poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		position: relative;
		z-index: 2;
	}

	.rack-poster-art {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.rack-poster-sheen {
		position: absolute;
		inset: 0;
		z-index: 3;
		background: linear-gradient(
			135deg,
			rgba(255,255,255,0.08) 0%,
			transparent 40%,
			transparent 60%,
			rgba(0,0,0,0.15) 100%
		);
		pointer-events: none;
	}

	.rack-card-spine {
		width: 100%;
		height: 3px;
		margin-top: 3px;
		background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04));
		border-radius: 0 0 2px 2px;
	}

	.rack-shelf-plank {
		height: 4px;
		margin-top: 8px;
		background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
		border-radius: 2px;
		box-shadow: 0 2px 6px rgba(0,0,0,0.3);
	}

	/* Focused Detail Card */
	.rack-focused-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.65);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.rack-focused-card {
		position: relative;
		max-width: 640px;
		width: 90vw;
		border-radius: 12px;
		padding: 28px;
		background: rgba(14, 12, 22, 0.92);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255,255,255,0.08);
		box-shadow: 0 30px 60px rgba(0,0,0,0.7);
		overflow: hidden;
	}

	.rack-focused-close {
		position: absolute;
		top: 12px;
		right: 14px;
		background: none;
		border: none;
		color: rgba(255,255,255,0.4);
		font-size: 1.6rem;
		cursor: pointer;
		line-height: 1;
		transition: color 0.2s;
		z-index: 5;
	}

	.rack-focused-close:hover {
		color: #fff;
	}

	.rack-focused-layout {
		display: flex;
		gap: 24px;
		align-items: flex-start;
		min-height: 0;
	}

	.rack-focused-poster {
		flex: 0 0 200px;
		min-height: 0;
	}

	.rack-focused-poster-art {
		width: 200px;
		height: 285px;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 12px 30px rgba(0,0,0,0.6);
		position: relative;
	}

	.rack-focused-poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.rack-focused-details {
		flex: 1;
		min-width: 0;
	}

	.rack-focused-tag {
		font-family: var(--font-sans);
		font-size: 0.6rem;
		font-weight: 600;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: #9d4edd;
		background: rgba(157,78,221,0.12);
		padding: 4px 10px;
		border-radius: 3px;
	}

	.rack-focused-title {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.5rem;
		font-weight: 400;
		color: #fff;
		margin: 10px 0 4px;
		line-height: 1.2;
	}

	.rack-focused-meta {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: rgba(255,255,255,0.45);
		margin: 0 0 12px;
	}

	.rack-focused-rating {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-bottom: 14px;
	}

	.rack-star {
		font-size: 0.95rem;
		color: #f5a623;
	}

	.rack-rating-num {
		font-family: var(--font-sans);
		font-size: 0.7rem;
		color: rgba(255,255,255,0.4);
		margin-left: 6px;
	}

	.rack-focused-review {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 0.88rem;
		color: rgba(255,255,255,0.6);
		line-height: 1.65;
		border-left: 2px solid rgba(157,78,221,0.3);
		padding-left: 14px;
		margin: 0;
	}
</style>
