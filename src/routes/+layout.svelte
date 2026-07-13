<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>sehaz.space</title>
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

{@render children()}
