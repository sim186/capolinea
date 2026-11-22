<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$lib/paths';
	import Brand from '$lib/components/Brand.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { loadFeeds, setFeed, type FeedCfg } from '$lib/data';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let feeds = $state<FeedCfg[] | null>(null);
	let missing = $state(false);
	loadFeeds().then((f) => (feeds = f));

	const id = $derived(page.params.feed);
	const cfg = $derived(feeds?.find((f) => f.id === id) ?? null);
	// il feed va impostato prima che le pagine figlie carichino i dati
	$effect.pre(() => {
		if (!feeds) return;
		missing = !cfg;
		if (cfg) setFeed(cfg.id, cfg);
	});

	const items = [
		{ href: '', label: 'Cerca', icon: 'search' },
		{ href: '/linee', label: 'Linee', icon: 'list' },
		{ href: '/avvisi', label: 'Avvisi', icon: 'alert' },
		{ href: '/mappa', label: 'Mappa', icon: 'map' },
		{ href: '/percorso', label: 'Percorso', icon: 'route' }
	] as const;
	const path = $derived(page.url.pathname.replace(base, '').replace(`/${id}`, '') || '/');
	const active = (href: string) =>
		href === ''
			? path === '/' || path.startsWith('/fermata')
			: path.startsWith(href) || (href === '/linee' && path.startsWith('/linea/'));
</script>

<header class="bar">
	<a class="brand" href="{base}/" aria-label="Capolinea, tutte le città">
		<Brand />
		<span>Capolinea</span>
	</a>
	{#if cfg}
		<a class="tag" href="{base}/" title="Cambia città">{cfg.name} · {cfg.operator}</a>
	{/if}
</header>

<main>
	{#if missing}
		<div class="page stack">
			<h1 class="display">Non trovata</h1>
			<p class="body">Questa città non esiste. <a href="{base}/" class="link">Scegline una</a>.</p>
		</div>
	{:else if cfg}
		{#key cfg.id}
			{@render children()}
		{/key}
	{/if}
</main>

{#if cfg}
	<nav class="nav" aria-label="Sezioni">
		{#each items as it (it.href)}
			<a href="{base}/{cfg.id}{it.href}" class:on={active(it.href)} aria-current={active(it.href) ? 'page' : undefined}>
				<span class="pill"><Icon name={it.icon} /></span>
				<span class="lbl">{it.label}</span>
			</a>
		{/each}
	</nav>
{/if}

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 20;
		height: var(--bar-h);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		padding-top: env(safe-area-inset-top);
		box-sizing: content-box;
		background: var(--surface);
		border-bottom: 1px solid var(--outline-variant);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.tag {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--on-surface-variant);
	}
	.link {
		color: var(--primary);
		font-weight: 700;
	}
	.nav {
		position: fixed;
		z-index: 30;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-around;
		height: calc(var(--nav-h) + env(safe-area-inset-bottom));
		padding: 12px 4px calc(16px + env(safe-area-inset-bottom));
		box-sizing: border-box;
		background: var(--surface-container);
	}
	.nav a {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		color: var(--on-surface-variant);
	}
	.pill {
		display: grid;
		place-items: center;
		width: 56px;
		height: 32px;
		border-radius: 16px;
		transition: background 0.15s;
	}
	.lbl {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.nav a.on {
		color: var(--on-surface);
	}
	.nav a.on .pill {
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
	.nav a.on .lbl {
		font-weight: 800;
	}
</style>
