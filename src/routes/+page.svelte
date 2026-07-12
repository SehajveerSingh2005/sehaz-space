<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import initialHotspots from '$lib/hotspots.json';
	import bedroomDay from '$lib/images/bedroom.png?enhanced';
	import bedroomNight from '$lib/images/bedroom-night.png?enhanced';

	// Hotspot Interface
	interface Hotspot {
		id: string;
		label: string;
		description: string;
		x: number; // percentage
		y: number; // percentage
		color: 'purple' | 'blue' | 'pink';
		type: 'computer_desk' | 'vinyl_player' | 'bed_chill' | 'wardrobe' | 'general';
	}

	// State Runes
	let devMode = $state(false);
	let activeHotspot = $state<Hotspot | null>(null);
	let selectedHotspotId = $state<string | null>(null);
	let isNightMode = $state(false);

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
							console.log('Autoplay request on ready...');
							event.target.playVideo();
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

			if (event.key.toLowerCase() === 'd') {
				devMode = !devMode;
				newHotspot = null;
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		// Trigger fade-in after a short delay to let the room image settle
		setTimeout(() => { isPageLoaded = true; }, 120);

		return () => {
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
			type: 'general'
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
				class="room-wrapper"
				onclick={handleRoomClick}
				style="cursor: {devMode ? 'crosshair' : 'default'}"
			>
				<div class="room-images-container">
					<enhanced:img
						src={bedroomDay}
						alt="Isometric Bedroom Day"
						class="bedroom-image day-image"
						style="opacity: {isNightMode ? 0 : 1};"
						draggable="false"
						fetchpriority="high"
					/>
					<enhanced:img
						src={bedroomNight}
						alt="Isometric Bedroom Night"
						class="bedroom-image night-image"
						style="opacity: {isNightMode ? 1 : 0};"
						draggable="false"
						loading="lazy"
					/>
				</div>

				<!-- INTERACTIVE HOTSPOTS OVERLAY -->
				{#each hotspots as spot}
					<button
						class="hotspot-dot"
						style="left: {spot.x}%; top: {spot.y}%;"
						onclick={(e) => {
							e.stopPropagation();
							if (devMode) {
								selectedHotspotId = spot.id;
							} else {
								if (spot.type === 'light_switch') {
									isNightMode = !isNightMode;
									return;
								}
								activeHotspot = spot;
							}
						}}
						title={spot.label}
					></button>

					{#if spot.type === 'vinyl_player' && isAudioPlaying}
						<div class="music-notes-emitter" style="left: {spot.x}%; top: {spot.y}%;">
							<span class="note note-1">♪</span>
							<span class="note note-2">♫</span>
							<span class="note note-3">♩</span>
							<span class="note note-4">♬</span>
						</div>
					{/if}
				{/each}

				<!-- Dev click placement dot -->
				{#if devMode && newHotspot}
					<div 
						class="temp-dot"
						style="left: {newHotspot.x}%; top: {newHotspot.y}%;"
					></div>
				{/if}
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
									<strong style="color: var(--accent-{h.color})">{h.label}</strong>
									<span>x: {h.x}% | y: {h.y}% | {h.type}</span>
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
			{#if activeHotspot.type === 'general' || activeHotspot.type === 'bed_chill' || activeHotspot.type === 'computer_desk'}
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
							</div>
						</div>
					</div>
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
		pointer-events: none;
		transition: opacity 1.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.page-load-overlay.loaded {
		opacity: 0;
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
</style>
